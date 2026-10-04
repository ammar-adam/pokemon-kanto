import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeResourceBytes } from '../scripts/resource-bytes.mjs';
import { bossTeams,rivalVariants,world,roster,dexId } from './campaign-world.mjs';
import { openingEncounters } from './opening-story.mjs';
import {redStats,moveStats} from './battle-damage.mjs';
import {movesAtLevel} from './move-learning.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plan=JSON.parse(await readFile(path.join(root,'artwork/game-plan.json'),'utf8'));
const resources=[];
async function walk(dir){for(const d of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())await walk(p);else if(p.endsWith('.gbsres'))resources.push(JSON.parse(await readFile(p,'utf8')));}}
await walk(path.join(root,'project'));
const byId=Object.fromEntries(resources.filter(r=>r.id).map(r=>[r.id,r]));
function effective(events){return events.map(e=>({...e,args:e.command==='EVENT_IF'?{condition:e.args.condition}:e.args,children:Object.fromEntries(Object.entries(e.children||{}).map(([key,list])=>[key,effective(list)]))}));}
for(const s of plan.scripts){const owner=byId[s.target.actorId||s.target.triggerId||s.target.sceneId];assert.ok(owner,'script owner exists');assert.deepEqual(effective(owner[s.target.scriptKey]),effective(s.events),'native script matches authored plan');}
for(const s of plan.customScripts||[])assert.deepEqual(effective(byId[s.id]?.script||[]),effective(s.script),'native shared script matches authored plan');
const named=plan.actors.reduce((all,a)=>{all[a.name]??=byId[a.id];return all;},{});
const scenes=Object.fromEntries(resources.filter(r=>r._resourceType==='scene').map(r=>[r.name,r]));
const results=[];
function test(name,fn){fn();results.push({name,passed:true});console.log('PASS '+name);}
class Halt { constructor(kind,args){this.kind=kind;this.args=args;} }
// This executes authored event semantics for unit checks, not a ROM or emulator.
class Logic {
  constructor(vars={},choices=[],rolls=[]){this.v={...vars};this.choices=[...choices];this.rolls=[...rolls];this.trace=[];this.text=[];this.steps=0;this.slots={};this.loadBranches={};this.textSpeed=null;}
  get(v){return this.v[v]||0;}
  val(x){
    if(x.type==='variable')return this.get(x.value);
    if(x.type==='number')return x.value;
    if(x.type==='expression')return this.expression(x.value);
    const a=this.val(x.valueA),b=this.val(x.valueB);
    return {eq:a===b,ne:a!==b,lt:a<b,gt:a>b,lte:a<=b,gte:a>=b}[x.type];
  }
  expression(e){const safe=e.replace(/\$(\d+)\$/g,(_,id)=>String(this.get(id)));assert.match(safe,/^[\d\s<>=!&|()+\-*/%.]+$/);return Function('return ('+safe+')')();}
  body(events){const labels=Object.fromEntries(events.flatMap((e,i)=>e.command==='EVENT_DEFINE_LABEL'?[[e.args.label,i]]:[]));for(let i=0;i<events.length;i++){try{this.event(events[i]);}catch(e){if(e instanceof Halt && e.kind==='goto' && labels[e.args]!==undefined)i=labels[e.args];else throw e;}}}
  event(e){assert.ok(++this.steps<100000,'bounded event execution');const a=e.args||{};this.trace.push(e.command);switch(e.command){
    case 'EVENT_TEXT':this.text.push(...[].concat(a.text));break;
    case 'EVENT_SET_VALUE':this.v[a.variable]=this.val(a.value);break;
    case 'EVENT_RESET_VARIABLES':this.v={};break;
    case 'EVENT_VARIABLE_MATH':{const current=this.get(a.vectorX);let other=a.other==='var'?this.get(a.vectorY):a.value;
      if(a.other==='rnd'){other=this.rolls.length?this.rolls.shift():a.maxValue;assert.ok(other>=a.minValue && other<=a.maxValue,`RNG ${other} must be ${a.minValue}..${a.maxValue}`);}
      this.v[a.vectorX]=({set:()=>other,add:()=>current+other,sub:()=>current-other,mul:()=>current*other,div:()=>Math.trunc(current/other),mod:()=>current%other})[a.operation]();assert.ok(Number.isInteger(this.v[a.vectorX])&&this.v[a.vectorX]>=-32768&&this.v[a.vectorX]<=32767,'GBVM arithmetic stays signed 16-bit');break;}
    case 'EVENT_IF_VALUE':{const x=this.get(a.variable),y=a.comparator;const yes=({'==':x===y,'!=':x!==y,'<':x<y,'>':x>y,'<=':x<=y,'>=':x>=y})[a.operator];this.body(e.children[yes?'true':'false']||[]);break;}
    case 'EVENT_IF_EXPRESSION':this.body(e.children[this.expression(a.expression)?'true':'false']||[]);break;
    case 'EVENT_IF':this.body(e.children[this.val(a.condition)?'true':'false']||[]);break;
    case 'EVENT_MENU':{assert.ok(this.choices.length,'expected a supplied menu choice');const choice=this.choices.shift();assert.ok(choice>=0 && choice<=a.items);this.v[a.variable]=choice;break;}
    case 'EVENT_ACTOR_INVOKE':this.body(byId[a.actorId].script);break;
    case 'EVENT_CALL_CUSTOM_EVENT':assert.ok(byId[a.customEventId],'shared script exists');this.body(byId[a.customEventId].script);break;
    case 'EVENT_GOTO_LABEL':throw new Halt('goto',a.label);
    case 'EVENT_SWITCH_SCENE':throw new Halt('switch',a);
    case 'EVENT_SCENE_POP_STATE':throw new Halt('pop',a);
    case 'EVENT_IF_SAVED_DATA':this.body(e.children[this.slots[a.saveSlot]?'true':'false']||[]);break;
    case 'EVENT_SAVE_DATA':this.slots[a.saveSlot]={...this.v};this.loadBranches[a.saveSlot]=e.children.load||[];this.body(e.children.true||[]);break;
    case 'EVENT_PEEK_DATA':assert.ok(this.slots[a.saveSlot]);this.v[a.variableDest]=this.slots[a.saveSlot][a.variableSource]||0;break;
    case 'EVENT_LOAD_DATA':assert.ok(this.slots[a.saveSlot]);this.v={...this.slots[a.saveSlot]};this.body(this.loadBranches[a.saveSlot]||[]);throw new Halt('load',a);
    case 'EVENT_TEXT_SET_ANIMATION_SPEED':this.textSpeed=a.speed;break;
    case 'EVENT_SET_INPUT_SCRIPT':case 'EVENT_MUSIC_PLAY':break;
    default:assert.ok(['EVENT_TEXT','EVENT_TEXT_DRAW','EVENT_DEFINE_LABEL','EVENT_ACTOR_SET_SPRITE','EVENT_ACTOR_SET_STATE','EVENT_ACTOR_EFFECTS','EVENT_ACTOR_HIDE','EVENT_ACTOR_SHOW','EVENT_ACTOR_SET_POSITION','EVENT_SOUND_PLAY_EFFECT','EVENT_SCRIPT_LOCK','EVENT_SCRIPT_UNLOCK','EVENT_REMOVE_INPUT_SCRIPT','EVENT_SCENE_PUSH_STATE','EVENT_SCENE_RESET_STATE'].includes(e.command),'known native event '+e.command);
  }}
  run(events){try{this.body(events);return null;}catch(e){if(e instanceof Halt)return e;throw e;}}
}
const referenceHP=(dex,level)=>Math.floor((redStats[dex].hp+9)*level/50)+level+10;
const base={0:3,1:2,2:36,3:36,4:3,5:28,6:28,7:3,8:6,9:3,10:1,11:0,12:0,19:0,25:1,27:2,31:1,41:36,51:1,60:3,61:3,62:3,63:3,...Object.fromEntries(Array.from({length:32},(_,i)=>[100+i,35]))};
test('Health redraw is constant work and never uploads a sprite',()=>{
  const l=new Logic(base);l.run(named.HUD.script);
  assert.deepEqual(l.trace,['EVENT_TEXT_DRAW','EVENT_TEXT_DRAW','EVENT_TEXT_DRAW']);
});

test('An attack resolves roster lookups with fewer than 200 comparisons',()=>{
  let worst=0;
  for(const p of roster){const l=new Logic({...base,1:p.index,4:p.index,300:1,301:40},[],[16,255]);l.run(named.ATTACK.script);
    const count=l.trace.filter(command=>command==='EVENT_IF').length;worst=Math.max(worst,count);
    assert.ok(count<200,p.name+' attack comparisons: '+count);
  }
  console.log('INFO Worst attack lookup/control comparisons: '+worst);
});

test('Blue forest and Route Twenty Two use the correct version-exclusive weighting',()=>{
  const weight=(area,dex)=>openingEncounters[area].filter(row=>row[0]===dex).reduce((sum,row)=>sum+row[2],0);
  assert.equal(weight('forest',10),45);assert.equal(weight('forest',11),40);
  assert.equal(weight('forest',13),5);assert.equal(weight('forest',14),5);assert.equal(weight('forest',25),5);
  assert.equal(weight('route_twenty_two',29),40);assert.equal(weight('route_twenty_two',32),5);
});
test('Identity lookup selects two portraits with at most eighteen comparisons',()=>{
  const identity=plan.customScripts.find(s=>s.name==='Kanto battle_identity');
  for(const p of roster){const l=new Logic({...base,1:p.index,4:p.index});l.run(identity.script);
    assert.equal(l.trace.filter(e=>e==='EVENT_ACTOR_SET_SPRITE').length,2);
    assert.ok(l.trace.filter(e=>e==='EVENT_IF').length<=18);
  }
});
test('Poison and seed use one sixteenth HP, clamp, and cannot drain a fainted foe',()=>{
  const residual=plan.customScripts.find(s=>s.name==='Kanto end_turn_residual').script;
  let l=new Logic({...base,303:1,6:160,5:40});l.run(residual);assert.equal(l.get(5),30);
  l=new Logic({...base,303:1,6:15,5:1,28:1,3:10});l.run(residual);assert.equal(l.get(5),0);assert.equal(l.get(3),10);
  l=new Logic({...base,6:160,5:2,28:1,3:10});l.run(residual);assert.equal(l.get(5),0);assert.equal(l.get(3),12);assert.equal(l.get(41),12);
  l=new Logic({...base,303:1,28:1,3:0});l.run(residual);assert.equal(l.get(5),28);
});
test('New game begins at home without a starter, Pokedex, or free balls',()=>{const l=new Logic({},[1,1,1]);const end=l.run(scenes.Title.script);assert.equal(end.kind,'switch');assert.equal(end.args.sceneId,scenes.red_house.id);assert.equal(l.get(0),5);assert.equal(l.get(2),0);assert.equal(l.get(8),0);assert.equal(l.get(1),0);assert.equal(l.get(248),0);assert.equal(l.get(133),3000);assert.equal(l.get(22),11);assert.equal(l.textSpeed,1);});
test('New game clears a prior collection and badge',()=>{const l=new Logic({12:1,30:1,31:1,32:1,10:3},[1,1,1]);l.run(scenes.Title.script);assert.equal(l.get(12),0);assert.equal(l.get(30),0);assert.equal(l.get(31),0);assert.equal(l.get(10),0);});
test('Continue previews and loads the chosen file without starting a new game',()=>{for(let slot=0;slot<3;slot++){const l=new Logic({},[2,slot+1,1]);l.slots[slot]={...base,12:1};assert.equal(l.run(scenes.Title.script).kind,'load');assert.equal(l.get(12),1);assert.equal(l.get(31),1);assert.ok(l.text.some(t=>t.startsWith(`FILE ${slot+1} - RED`)));assert.ok(!l.trace.includes('EVENT_RESET_VARIABLES'));}});
test('Each starter ball grants exactly one level-five partner after meeting Oak',()=>{for(let starter=1;starter<=3;starter++){const l=new Logic({0:5},[1]);l.run(named['Professor Oak'].script);l.run(named[roster[starter-1].name+' Ball'].script);assert.equal(l.get(1),starter);assert.equal(l.get(29+starter),1);assert.equal(l.get(39+starter),referenceHP(roster[starter-1].dex,5));assert.equal(l.get(3),l.get(2));assert.equal(l.get(49+starter),1);assert.equal(l.get(59+starter),5);assert.equal(l.get(100+(starter-1)*4),35);assert.equal(l.get(10),1);assert.equal(l.get(25),1);assert.equal(l.get(8),0);}});
function referenceDamage(attacker,defender,level,enemyLevel,power,type,multipliers=[],critical=false,roll=255){
  const special=['FIRE','WATER','GRASS','ELECTRIC','ICE','PSYCHIC','DRAGON'].includes(type);
  const a=Math.floor((redStats[attacker][special?'special':'attack']+9)*level/50)+5,d=Math.floor((redStats[defender][special?'special':'defense']+9)*enemyLevel/50)+5;
  let n=Math.min(999,Math.floor((Math.floor(2*level/5)+2)*power*a/(d*50))+2);
  if(roster.find(p=>p.dex===attacker).types.includes(type))n=Math.floor(n*1.5);
  for(const factor of multipliers)n=factor===0?0:n>0?Math.max(1,Math.floor(n*factor)):0;
  if(critical)n*=2;return n>0?Math.max(1,Math.floor(n*roll/255)):0;
}
test('Move power, elemental advantage, dual resistance and HP clamping',()=>{let l=new Logic({...base,300:1,301:40});l.run(named.ATTACK.script);assert.equal(l.get(16),referenceDamage(1,7,3,3,40,'NORMAL'));assert.equal(l.get(5),28-l.get(16));l=new Logic({...base,300:4,301:35});l.run(named.ATTACK.script);assert.equal(l.get(16),referenceDamage(1,7,3,3,35,'GRASS',[2]));l=new Logic({...base,4:2,5:1,300:4,301:35});l.run(named.ATTACK.script);assert.equal(l.get(16),referenceDamage(1,1,3,3,35,'GRASS',[.5,.5]));assert.equal(l.get(5),0);});
test('Water resistance and Guard reduce one hit and store party HP',()=>{const l=new Logic({...base,17:1,7:8},[],[3,255]);l.run(named.COUNTER.script);const hit=Math.max(1,Math.floor(referenceDamage(7,1,8,3,20,'WATER',[.5])/2));assert.equal(l.get(3),36-hit);assert.equal(l.get(41),36-hit);assert.equal(l.get(17),0);});
test('Original stat and move records retain generation-one differences',()=>{assert.equal(Object.keys(redStats).length,151);assert.equal(redStats[4].special,50);assert.equal(redStats[25].defense,30);assert.equal(moveStats('GUST').type,'NORMAL');assert.equal(moveStats('TACKLE').power,35);assert.equal(moveStats('FLAMETHROWER').power,95);});
test('Cartridge multiply-divide stays in range and matches exact integer arithmetic',()=>{
  const script=byId[plan.customScripts.find(s=>s.name==='Kanto damage_mul_div').id].script;
  for(const factor of [0,1,17,127,255,999,10500,12012])for(const multiplier of [0,1,2,3,9,127,255,256,511])for(const divisor of [1,2,3,50,250,255,24500]){
    const expected=Number(BigInt(factor)*BigInt(multiplier)/BigInt(divisor));if(expected>30000)continue;
    const l=new Logic({135:factor,308:multiplier,309:divisor});l.run(script);assert.equal(l.get(16),expected,`${factor} * ${multiplier} / ${divisor}`);
  }
});
test('All 151 player attackers match independent physical and Special calculations',()=>{
  for(const p of roster)for(const level of [1,50,100])for(const [code,type]of [[1,'NORMAL'],[2,'FIRE']])for(const roll of [217,255]){
    const l=new Logic({...base,1:p.index,4:dexId(41),0:level,7:level,5:30000,300:code,301:95},[],[16,roll]);l.run(named.ATTACK.script);
    assert.equal(l.get(16),referenceDamage(p.dex,41,level,level,95,type,[],false,roll),`${p.name} ${type} L${level}`);
  }
});
test('Every species selects and announces a real level-appropriate opponent move',()=>{
  for(const p of roster)for(const level of [1,50,100]){
    const l=new Logic({...base,1:dexId(41),4:p.index,0:level,7:level,3:30000,5:30000,6:30000});l.run(named.COUNTER.script);
    const move=movesAtLevel(p.dex,level).at(-1),text=l.text.join(' ').replace(/\s+/g,' ');
    assert.ok(text.includes('THE FOE USED '+move+'!'),p.name+' '+level+' '+text);
    assert.ok(!text.includes('THE FOE ATTACKS!'));
  }
});
test('Opponent move selection and resolution avoid whole-roster scans',()=>{
  let worst=0;
  for(const p of roster)for(const level of [1,50,100]){
    const moves=movesAtLevel(p.dex,level);
    for(let slot=1;slot<=Math.max(1,moves.length);slot++){
      const l=new Logic({...base,1:dexId(41),4:p.index,0:level,7:level,3:30000,5:30000,6:30000},[],moves.length>1?[slot]:[]);
      l.run(named.COUNTER.script);
      const count=l.trace.filter(command=>command==='EVENT_IF').length;worst=Math.max(worst,count);
      assert.ok(count<250,`${p.name} L${level} move ${slot}: ${count} comparisons`);
    }
  }
  console.log('INFO Worst opponent turn lookup/control comparisons: '+worst);
});
test('Heavy resistance still takes one damage while immunities remain zero',()=>{const l=new Logic({...base,0:1,7:100,4:dexId(31),300:8,301:15},[],[16,217]);l.run(named.ATTACK.script);assert.equal(l.get(16),1);});
test('A successful low-HP capture preserves HP and adds a species once',()=>{let l=new Logic({...base,4:4,5:9},[1],[0]);assert.equal(l.run(named.BAG.script).kind,'pop');assert.equal(l.get(33),1);assert.equal(l.get(43),9);assert.equal(l.get(10),2);assert.equal(l.get(8),5);l=new Logic({...base,4:4,5:9,33:1,10:2},[1],[0]);l.run(named.BAG.script);assert.equal(l.get(10),2);});
test('Blue capture uses independent species and full-HP thresholds',()=>{for(const [rolls,caught]of [[[190,85],true],[[190,86],false],[[191],false]]){const l=new Logic({...base,4:4},[1],rolls);const end=l.run(named.BAG.script);assert.equal(end?.kind==='pop',caught);assert.equal(l.get(18),1);assert.equal(l.get(8),5);assert.equal(l.rolls.length,0);}});
test('Blue capture scales its HP threshold without guaranteeing rare catches',()=>{for(const roll of [198,199]){const l=new Logic({...base,4:4,5:14},[1],[190,roll]);assert.equal(l.run(named.BAG.script)?.kind==='pop',roll===198);}const rare=new Logic({...base,4:dexId(150),5:1},[1],[4]);assert.equal(rare.run(named.BAG.script),null);assert.equal(rare.get(18),1);const asleep=new Logic({...base,4:dexId(150),302:1},[1],[24]);assert.equal(asleep.run(named.BAG.script).kind,'pop');});
test('No capsules or full HP consumes neither item nor turn',()=>{let l=new Logic({...base,8:0},[1]);l.run(named.BAG.script);assert.equal(l.get(18),0);assert.equal(l.get(8),0);l=new Logic(base,[2]);l.run(named.BAG.script);assert.equal(l.get(9),3);assert.equal(l.get(18),0);});
test('Potion heals, clamps to maximum and persists individual HP',()=>{const l=new Logic({...base,3:20,41:20},[2]);l.run(named.BAG.script);assert.equal(l.get(3),36);assert.equal(l.get(41),36);assert.equal(l.get(9),2);assert.equal(l.get(18),1);});
test('Champion opponents cannot be caught or escaped',()=>{const l=new Logic({...base,19:1},[1]);l.run(named.BAG.script);assert.equal(l.get(8),6);assert.equal(l.get(18),0);});
test('Bag Back does not fall through to Party or Run',()=>{const l=new Logic(base,[2,3,4]);assert.equal(l.run(scenes.battlefield.script).kind,'pop');assert.equal(l.get(3),referenceHP(1,3));assert.equal(l.choices.length,0);assert.ok(!l.trace.includes('EVENT_ACTOR_EFFECTS'));});
test('Party switching spends one turn without accidentally running',()=>{const l=new Logic({...base,33:1,53:1,43:36},[3,4,4],[1,95,255]);assert.equal(l.run(scenes.battlefield.script).kind,'pop');assert.equal(l.get(1),4);assert.equal(l.get(43),referenceHP(25,3)-referenceDamage(7,25,3,3,35,'NORMAL'));});
test('Fainting automatically brings in the next healthy owned partner',()=>{const l=new Logic({...base,3:1,41:1,32:1,52:1,42:36,5:100,6:100},[1,1,4],[1,1,95,255]);assert.equal(l.run(scenes.battlefield.script).kind,'pop');assert.equal(l.get(41),0);assert.equal(l.get(1),3);assert.equal(l.get(3),referenceHP(7,3));assert.equal(l.get(104),35);});
test('Full-party defeat heals and returns to an accessible town tile',()=>{const l=new Logic({...base,3:1,41:1,5:100,6:100},[1,1],[1,1,95,255]);const end=l.run(scenes.battlefield.script);assert.equal(end.kind,'switch');assert.equal(end.args.sceneId,scenes.fernvale.id);assert.equal(l.get(1),2);assert.equal(l.get(41),referenceHP(1,3));});
test('Nested overworld party menu cannot accidentally save',()=>{const pause=scenes.fernvale.script.find(e=>e.command==='EVENT_SET_INPUT_SCRIPT');const l=new Logic({...base,32:1,52:1,42:36},[1,3]);l.run(pause.children.true);assert.equal(l.get(1),3);assert.deepEqual(l.slots,{});});
test('Explicit Save produces an independent snapshot in each of three files',()=>{const pause=scenes.fernvale.script.find(e=>e.command==='EVENT_SET_INPUT_SCRIPT');const l=new Logic({...base,22:11});for(let slot=0;slot<3;slot++){l.v[133]=3000+slot;l.choices=[3,slot+1,1];l.run(pause.children.true);assert.equal(l.slots[slot][31],1);assert.equal(l.slots[slot][22],11+slot);}assert.deepEqual(Object.values(l.slots).map(s=>s[133]),[3000,3001,3002]);});
test('Cancel at either save menu preserves every file and the active file',()=>{const pause=scenes.fernvale.script.find(e=>e.command==='EVENT_SET_INPUT_SCRIPT');for(const choices of [[3,0],[3,4],[3,2,0],[3,2,1]]){const l=new Logic({...base,22:11},choices);l.slots[1]={133:999};l.run(pause.children.true);assert.deepEqual(l.slots,{1:{133:999}});assert.equal(l.get(22),11);assert.ok(!l.trace.includes('EVENT_SAVE_DATA'));}});
test('Overwrite requires explicit confirmation and only changes the chosen file',()=>{const pause=scenes.fernvale.script.find(e=>e.command==='EVENT_SET_INPUT_SCRIPT');const l=new Logic({...base,22:21},[3,2,2]);l.slots={0:{133:1},1:{133:2},2:{133:3}};l.run(pause.children.true);assert.equal(l.slots[1][31],1);assert.equal(l.slots[1][22],22);assert.deepEqual(l.slots[0],{133:1});assert.deepEqual(l.slots[2],{133:3});});
test('New adventures never erase existing files, including a reused file',()=>{for(const pace of [1,2,3]){const l=new Logic({},[1,2,2,pace]);l.slots={0:{12:1},1:{12:1,133:777},2:{10:50}};const before=structuredClone(l.slots);assert.equal(l.run(scenes.Title.script).kind,'switch');assert.deepEqual(l.slots,before);assert.equal(l.get(22),[12,2,22][pace-1]);assert.equal(l.textSpeed,[1,3,0][pace-1]);assert.ok(!l.trace.includes('EVENT_SAVE_DATA'));}});
test('Backing out of setup or an empty Continue file returns to the opening menu',()=>{for(const choices of [[1,0,1,3,1],[1,2,1,1,3,1],[2,1,1,3,1],[2,2,0,1,3,1]]){const l=new Logic({},choices);l.slots[1]={10:42};const end=l.run(scenes.Title.script);assert.equal(end.kind,'switch');assert.equal(l.get(22),13);assert.deepEqual(l.slots[1],{10:42});}});
test('Text options preserve the file number and reload through the saved continuation',()=>{const pause=scenes.fernvale.script.find(e=>e.command==='EVENT_SET_INPUT_SCRIPT');for(const choice of [1,2,3]){const l=new Logic({...base,22:12},[7,choice]);l.run(pause.children.true);assert.equal(l.get(22)%10,2);assert.equal(l.textSpeed,[1,3,0][choice-1]);l.choices=[3,2,1];l.run(pause.children.true);l.choices=[2,2,1];assert.equal(l.run(scenes.Title.script).kind,'load');assert.equal(l.textSpeed,[1,3,0][choice-1]);assert.equal(l.text.filter(t=>t.includes('SAVED TO')).length,1);}const l=new Logic({...base,22:23},[7,0]);l.run(pause.children.true);assert.equal(l.get(22),23);});
test('Brock advances from Geodude to level fourteen Onix and awards Boulder Badge',()=>{const l=new Logic({...base,19:1,20:1,5:0,71:5});l.run(named.VICTORY.script);assert.equal(l.get(20),2);assert.equal(l.get(4),7);assert.equal(l.get(7),14);assert.equal(l.get(0),4);assert.equal(l.get(2),referenceHP(1,4));assert.equal(l.run(named.VICTORY.script).kind,'pop');assert.equal(l.get(12),1);assert.equal(l.get(9),3);});
test('Nurse Joy restores HP and PP without giving free items',()=>{const l=new Logic({...base,8:0,9:0,41:0,104:0,61:3});l.run(named['Nurse Joy'].script);assert.equal(l.get(41),referenceHP(1,3));assert.equal(l.get(104),35);assert.equal(l.get(61),3);assert.equal(l.get(8),0);assert.equal(l.get(9),0);});
test('Six-Pokemon party sends a seventh unique catch to PC storage',()=>{const l=new Logic({...base,25:6,10:6,4:7,5:1,7:4},[1],[0]);assert.equal(l.run(named.BAG.script).kind,'pop');assert.equal(l.get(36),1);assert.equal(l.get(56),0);assert.equal(l.get(25),6);assert.equal(l.get(66),4);assert.equal(l.get(46),1);});
test('PC refuses depositing the last party member',()=>{const l=new Logic(base,[2]);l.run(named['Bills PC'].script);assert.equal(l.get(51),1);assert.equal(l.get(25),1);});
test('PC deposits and withdraws with an exact six-member cap',()=>{let l=new Logic({...base,25:2,33:1,53:1,43:36},[4]);l.run(named['Bills PC'].script);assert.equal(l.get(53),0);assert.equal(l.get(25),1);l=new Logic({...base,33:1,25:6},[4]);l.run(named['Bills PC'].script);assert.equal(l.get(53),0);assert.equal(l.get(25),6);l=new Logic({...base,33:1},[4]);l.run(named['Bills PC'].script);assert.equal(l.get(53),1);assert.equal(l.get(25),2);});
test('Boxed Pokemon cannot enter battle or replace a fainted party member',()=>{const l=new Logic({...base,33:1,53:0,43:36},[4]);l.run(named.PARTY.script);assert.equal(l.get(1),2);assert.equal(l.get(18),0);});
test('Electric attacks have no effect on Geodude or Onix',()=>{for(const foe of [5,7]){const l=new Logic({...base,1:4,4:foe,14:2,300:5,301:40});l.run(named.ATTACK.script);assert.equal(l.get(16),0);assert.equal(l.get(5),28);}});
test('Blue chooses the starter with an elemental advantage',()=>{for(const [starter,foe]of [[1,3],[2,1],[3,2]]){const l=new Logic({...base,27:starter,19:2},[4,2,3,4]);try{l.run(scenes.battlefield.script);}catch(e){assert.match(e.message,/expected a supplied menu choice/);}assert.equal(l.get(4),foe);assert.equal(l.get(7),5);}});
test('Starter balls require Oak and cannot grant a second partner',()=>{const l=new Logic();l.run(named['CHARMANDER Ball'].script);assert.equal(l.get(1),0);l.run(named['Professor Oak'].script);l.choices=[1];l.run(named['CHARMANDER Ball'].script);l.run(named['SQUIRTLE Ball'].script);assert.equal(l.get(1),1);assert.equal(l.get(32),0);assert.equal(l.get(25),1);});
test('Parcel delivery unlocks the Pokedex and shop exactly once',()=>{const l=new Logic(base);l.run(named['Mart Clerk'].script);assert.equal(l.get(247),1);assert.equal(l.get(248),0);l.run(named['Mart Clerk'].script);assert.equal(l.get(247),1);l.run(named['Professor Oak'].script);assert.equal(l.get(247),2);assert.equal(l.get(248),1);l.run(named['Professor Oak'].script);assert.equal(l.get(247),2);});
test('Opening shop charges actual prices and respects money and bag limits',()=>{for(const [choice,item,price]of [[1,8,200],[2,9,300]]){let l=new Logic({...base,248:1,133:3000},[choice]);l.run(named['Mart Clerk'].script);assert.equal(l.get(133),3000-price);assert.equal(l.get(item),base[item]+1);l=new Logic({...base,248:1,133:price-1},[choice]);l.run(named['Mart Clerk'].script);assert.equal(l.get(item),base[item]);l=new Logic({...base,248:1,133:3000,[item]:99},[choice]);l.run(named['Mart Clerk'].script);assert.equal(l.get(133),3000);assert.equal(l.get(item),99);}});
test('Home and Route One each give only one potion',()=>{const l=new Logic();for(const name of ['Home PC','Mart Employee']){const before=l.get(9);l.run(named[name].script);l.run(named[name].script);assert.equal(l.get(9),before+1);}});
test('Forest gate remains closed until the parcel is returned',()=>{const t=plan.triggers.find(t=>t.name==='north forest');let l=new Logic(base);assert.equal(l.run(byId[t.id].script),null);l=new Logic({...base,248:1});assert.equal(l.run(byId[t.id].script).args.sceneId,scenes.forest.id);});
test('Lab exit requires a starter and the opening rival victory',()=>{const t=plan.triggers.find(t=>t.name==='leave lab');let l=new Logic();assert.equal(l.run(byId[t.id].script),null);l=new Logic(base);assert.equal(l.run(byId[t.id].script).args.sceneId,scenes.battlefield.id);assert.equal(l.get(19),2);l=new Logic({...base,26:1});assert.equal(l.run(byId[t.id].script).args.sceneId,scenes.fernvale.id);});
const fight=named.FIGHT.script;
test('A complete fight turn executes each side once in its resolved order',()=>{
  for(const enemyFirst of [0,1]){
    const rolls=enemyFirst?[1,1,95,255,95,16,255]:[1,0,95,16,255,95,255];
    const l=new Logic(base,[1,1,4],rolls);assert.equal(l.run(scenes.battlefield.script).kind,'pop');
    const actions=l.text.filter(t=>t.includes('USED'));
    assert.equal(actions.length,2);assert.equal(actions[enemyFirst?0:1].includes('THE FOE USED'),true);
    assert.equal(l.get(104),34);assert.equal(l.get(105),35);
    assert.equal(l.get(41),referenceHP(1,3)-referenceDamage(7,1,3,3,35,'NORMAL'));
    assert.equal(l.rolls.length,0);
  }
});
test('A 95-percent move hits at 95 and misses at 96 while spending PP and a turn',()=>{for(const roll of [95,96]){const l=new Logic({...base,302:1},[1],[1,0,roll,16,255]);l.run(fight);assert.equal(l.get(104),34);assert.equal(l.get(18),2);assert.equal(l.get(5)<28,roll===95);assert.equal(l.get(3),36);}});
test('A move spends only its own individual PP',()=>{const l=new Logic({...base,302:1},[1],[1,0,95,16,255]);l.run(fight);assert.equal(l.get(104),34);assert.equal(l.get(105),35);assert.equal(l.get(18),2);});
test('An empty move and B cancel spend no PP or turn',()=>{let l=new Logic({...base,105:0},[2]);l.run(fight);assert.equal(l.get(104),35);assert.equal(l.get(105),0);assert.equal(l.get(18),0);l=new Logic(base,[0]);l.run(fight);assert.equal(l.get(18),0);assert.equal(l.get(104),35);});
test('All PP empty enables Struggle with persistent recoil',()=>{const l=new Logic({...base,302:1,104:0,105:0,106:0,107:0},[],[1,0,16,255]);l.run(fight);assert.equal(l.get(5),28-referenceDamage(1,7,3,3,50,'NORMAL'));assert.equal(l.get(3),32);assert.equal(l.get(41),32);assert.equal(l.get(18),2);});
test('Critical hit doubles damage before the random multiplier',()=>{const l=new Logic({...base,300:1,301:40},[],[1]);l.run(named.ATTACK.script);const hit=referenceDamage(1,7,3,3,40,'NORMAL',[],true);assert.equal(l.get(16),hit);assert.equal(l.get(5),28-hit);});
test('Grass Leech Seed drains after the foe acts and heals within maximum HP',()=>{const l=new Logic({...base,0:7,61:7,41:20},[1,3,4],[1,1,95,255]);assert.equal(l.run(scenes.battlefield.script).kind,'pop');assert.equal(l.get(28),1);assert.equal(l.get(5),27);assert.equal(l.get(41),21-referenceDamage(7,1,3,7,35,'NORMAL'));assert.equal(l.get(106),34);assert.ok(l.text.findIndex(t=>t.includes('THE FOE USED'))<l.text.findIndex(t=>t.includes('DRAINED THE FOE')));});
test('Pikachu Thunder Wave and Pidgey Sand Attack set battle effects',()=>{let l=new Logic({...base,1:4,63:9},[3]);l.run(fight);assert.equal(l.get(69),1);l=new Logic({...base,1:8,67:5},[2]);l.run(fight);assert.equal(l.get(68),1);});
test('PC preserves a valid lead even when the remaining party is fainted',()=>{const l=new Logic({...base,25:2,33:1,53:1,43:0},[2]);l.run(named['Bills PC'].script);assert.equal(l.get(1),4);assert.equal(l.get(25),1);assert.equal(l.get(3),0);});
test('Individual experience levels only the battling Pokemon',()=>{const l=new Logic({...base,71:5,19:0});l.run(named.VICTORY.script);assert.equal(l.get(61),4);assert.equal(l.get(60),3);assert.equal(l.get(71),2);assert.equal(l.get(2),referenceHP(1,4));});
test('Every transition lands on clear two-tile player footing',()=>{for(const r of resources){for(const key of ['script','startScript']){function check(events){for(const e of events||[]){if(e.command==='EVENT_SWITCH_SCENE'){const s=byId[e.args.sceneId],x=e.args.x.value,y=e.args.y.value;const bytes=decodeResourceBytes(s.collisions,{maximumValues:s.width*s.height});assert.equal(bytes[y*s.width+x],0,`landing ${s.name} ${x},${y}`);assert.equal(bytes[y*s.width+x+1],0,`landing right ${s.name} ${x},${y}`);}for(const child of Object.values(e.children||{}))check(child);}}check(r[key]);}}});
test('Home is reachable from the relocated laboratory exit',()=>{const s=scenes.fernvale,b=decodeResourceBytes(s.collisions,{maximumValues:s.width*s.height}),queue=[[23,23]],seen=new Set();let reachable=false;while(queue.length){const [x,y]=queue.shift(),k=`${x},${y}`;if(seen.has(k)||x<1||y<1||x+1>=s.width||y>=s.height||b[y*s.width+x]||b[y*s.width+x+1])continue;seen.add(k);if(x===7&&y===11)reachable=true;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,y+dy]);}assert.ok(reachable);});
test('Opening encounters use every weighted Blue slot and its level',()=>{
  for(const [area,slots]of Object.entries(openingEncounters)){
    const t=plan.triggers.find(t=>t.sceneId===scenes[area].id&&(t.name.startsWith('wild ')||t.name.startsWith('grass ')));assert.ok(t,area);let start=0;
    for(const [dex,level,weight]of slots){for(const roll of [start+1,start+weight]){const l=new Logic(base,[],[1,roll]);assert.equal(l.run(byId[t.id].script).kind,'switch');assert.equal(l.get(4),dexId(dex));assert.equal(l.get(7),level);}start+=weight;}assert.equal(start,100);
  }
});
test('Pewter east gate requires the Boulder Badge',()=>{const t=plan.triggers.find(t=>t.name==='east route three');let l=new Logic(base);assert.equal(l.run(byId[t.id].script),null);l=new Logic({...base,12:1});assert.equal(l.run(byId[t.id].script).args.sceneId,scenes.route_three.id);});
test('Every gym leader fields the full Red team in order before awarding a badge',()=>{
  const teams={1:[[74,12],[95,14]],4:[[120,18],[121,21]],5:[[100,21],[25,18],[26,24]],6:[[71,29],[114,24],[45,29]],29:[[109,37],[89,39],[109,37],[110,43]],30:[[64,38],[122,37],[49,38],[65,43]],31:[[58,42],[77,40],[78,42],[59,47]],32:[[111,45],[51,42],[31,44],[34,45],[112,50]]};
  for(const [mode,team]of Object.entries(teams)){
    const badge=bossTeams[mode].badge,l=new Logic({...base,19:Number(mode),20:1,133:0});l.run(named['BOSS-CONFIG'].script);
    for(const [i,[dex,level]]of team.entries()){assert.equal(l.get(badge),0);assert.equal(l.get(4),dexId(dex));assert.equal(l.get(7),level);const end=l.run(named.VICTORY.script);assert.equal(end?.kind||null,i===team.length-1?'pop':null);}assert.equal(l.get(badge),1);
  }
});
test('Blue changes his complete variable lineup for all three starters',()=>{
  for(const [mode,variants]of Object.entries(rivalVariants))for(const [starter,pairs]of Object.entries(variants))for(const [i,[dex,level]]of pairs.entries()){
    const l=new Logic({...base,19:Number(mode),27:Number(starter),20:bossTeams[mode].team.length-pairs.length+i+1});l.run(named['BOSS-CONFIG'].script);assert.equal(l.get(4),dexId(dex));assert.equal(l.get(7),level);assert.equal(l.get(5),referenceHP(dex,level));
  }
});
test('Champion support Pokemon complement the chosen starter',()=>{
  const expected={1:[59,103,9],2:[103,130,6],3:[130,59,3]};
  for(const [starter,party]of Object.entries(expected))for(const [i,dex]of party.entries()){const l=new Logic({...base,19:41,27:Number(starter),20:i+4});l.run(named['BOSS-CONFIG'].script);assert.equal(l.get(4),dexId(dex));assert.equal(l.get(7),[61,63,65][i]);}
});
test('New trainers stand on clear tiles and have an open interaction edge',()=>{
  const targets=plan.actors.filter(a=>[scenes.route_three.id,scenes.arena.id].includes(a.sceneId)||a.sceneId===scenes.cerulean.id&&a.name==='Blue');
  for(const a of targets){const s=byId[a.sceneId],b=decodeResourceBytes(s.collisions,{maximumValues:s.width*s.height});const clear=(x,y)=>x>=0&&x+1<s.width&&y>=0&&y<s.height&&!b[y*s.width+x]&&!b[y*s.width+x+1];assert.ok(clear(a.x,a.y),a.name+' footing');assert.ok([[0,1],[0,-1],[-2,0],[2,0]].some(([dx,dy])=>clear(a.x+dx,a.y+dy)),a.name+' interaction');}
});
test('Route Twenty Two uses the early rival until all eight badges are earned',()=>{
  const a=plan.actors.find(a=>a.sceneId===scenes.route_twenty_two.id&&a.name==='Blue');const script=byId[a.id].script;
  let l=new Logic({...base,248:1},[1]);assert.equal(l.run(script).kind,'switch');assert.equal(l.get(19),57);
  l=new Logic({...base,248:1,262:1});assert.equal(l.run(script),null);
  l=new Logic({...base,248:1,262:1,12:1,150:1,151:1,152:1,180:1,181:1,182:1,183:1},[1]);assert.equal(l.run(script).kind,'switch');assert.equal(l.get(19),42);
});
test('Cerulean rival victory opens Nugget Bridge and each new trainer retires after a win',()=>{
  const gate=byId[plan.triggers.find(t=>t.name==='north bridge').id].script;
  assert.equal(new Logic(base).run(gate),null);assert.equal(new Logic({...base,263:1}).run(gate).args.sceneId,scenes.nugget_bridge.id);
  for(let mode=57;mode<=65;mode++){const l=new Logic({...base,19:mode,20:1});for(let i=0;i<bossTeams[mode].team.length;i++)l.run(named.VICTORY.script);assert.equal(l.get(bossTeams[mode].flag),1);}
  assert.equal(plan.actors.filter(a=>a.sceneId===scenes.route_three.id).length,8);
});
test('Surge lock requires ordered switches and Cut',()=>{
  const switches=plan.actors.filter(a=>a.sceneId===scenes.vermilion_gym.id&&a.name==='Electric Switch').sort((a,b)=>a.x-b.x);
  const l=new Logic(base);for(const a of switches)l.run(byId[a.id].script);assert.equal(l.get(163),3);
  const gate=plan.triggers.find(t=>t.name==='enter vermilion gym');assert.equal(new Logic(base).run(byId[gate.id].script),null);
  assert.equal(new Logic({...base,158:1}).run(byId[gate.id].script).args.sceneId,scenes.vermilion_gym.id);
});
test('Bill gives the ticket; Captain gives Cut; Giovanni needs the Lift Key',()=>{
  const bill=plan.actors.find(a=>a.name==='Bill'),captain=plan.actors.find(a=>a.name==='S.S. Captain'),boss=plan.actors.find(a=>a.name==='Giovanni');
  let l=new Logic(base);l.run(byId[bill.id].script);assert.equal(l.get(157),1);
  l.run(byId[captain.id].script);assert.equal(l.get(158),1);
  l=new Logic(base);assert.equal(l.run(byId[boss.id].script),null);
  l=new Logic({...base,160:1},[1]);assert.equal(l.run(byId[boss.id].script).kind,'switch');assert.equal(l.get(19),8);
});
test('Forest trainers and later route trainers use distinct teams and win flags',()=>{
  const modes=[11,14,15,25,26,27,28],flags=modes.map(m=>bossTeams[m].flag);
  assert.equal(new Set(flags).size,flags.length);
  assert.ok(modes.every(m=>bossTeams[m].team.length>=1));
  assert.ok(new Set(modes.flatMap(m=>bossTeams[m].team.map(([pokemon])=>pokemon))).size>=8);
});
test('Paged PC menu reaches new species and keeps party and box counts consistent',()=>{
  const l=new Logic({...base,400:1,401:56,402:0,403:8,25:1},[8,2]);l.run(named['Bills PC'].script);
  assert.equal(l.get(402),1);assert.equal(l.get(25),2);
});
const pokemonVars=(dex,level=30)=>{const i=dexId(dex)-1;return i<8?{id:i+1,own:30+i,hp:40+i,member:50+i,level:60+i,xp:70+i,retired:80+i}:{id:i+1,own:400+(i-8)*10,hp:401+(i-8)*10,member:402+(i-8)*10,level:403+(i-8)*10,xp:404+(i-8)*10,retired:409+(i-8)*10};};
const partner=(dex,level)=>{const p=pokemonVars(dex),maximum=referenceHP(dex,level);return {1:p.id,0:level,2:maximum,3:maximum,25:1,10:1,[p.own]:1,[p.hp]:maximum,[p.member]:1,[p.level]:level};};
test('All 151 species have an encounter, gift, or reachable evolution path',()=>{
  assert.equal(roster.length,151);assert.equal(new Set(roster.map(p=>p.dex)).size,151);
  const reachable=new Set([...world.flatMap(s=>openingEncounters[s.key]?openingEncounters[s.key].map(([dex])=>dexId(dex)):s.encounters||[]),...[1,4,7,106,107,122,131,133,138,140,142,143,144,145,146,150,151].map(dexId)]);
  let changed=true;while(changed){changed=false;for(const p of roster)if(reachable.has(p.index))for(const e of p.evolutions)if(!reachable.has(e.to)){reachable.add(e.to);changed=true;}}
  assert.equal(reachable.size,151,roster.filter(p=>!reachable.has(p.index)).map(p=>p.name).join(', '));
});
test('Level evolution preserves the party slot, level and Pokedex history',()=>{
  const from=pokemonVars(10),to=pokemonVars(11),l=new Logic({...partner(10,6),[from.xp]:11,7:1});
  l.run(named['GAIN-XP'].script);
  assert.equal(l.get(1),to.id);assert.equal(l.get(to.level),7);assert.equal(l.get(to.hp),referenceHP(11,7));
  assert.equal(l.get(from.member),0);assert.equal(l.get(from.retired),1);assert.equal(l.get(from.own),1);
  assert.equal(l.get(to.member),1);assert.equal(l.get(25),1);assert.equal(l.get(10),2);
});
test('Evolved ancestors cannot be withdrawn, but can be caught again',()=>{
  const from=pokemonVars(10),l=new Logic({...base,[from.own]:1,[from.retired]:1,10:2},[8,2]);
  l.run(named['Bills PC'].script);assert.equal(l.get(from.member),0);assert.equal(l.get(25),1);
  l.choices=[1];l.rolls=[100];l.v[4]=from.id;l.v[5]=1;l.v[6]=40;l.v[7]=6;
  assert.equal(l.run(named.BAG.script).kind,'pop');assert.equal(l.get(from.retired),0);assert.equal(l.get(from.member),1);assert.equal(l.get(10),2);
});
test('Water, thunder and fire stones give the chosen Eevee evolution',()=>{
  for(const [method,dex]of [[1,134],[2,135],[3,136]]){const l=new Logic(partner(133,25),[method]);l.run(named['Evolution Expert'].script);assert.equal(l.get(1),dexId(dex));assert.equal(l.get(25),1);}
});
test('The local trade service evolves Kadabra without deleting collection history',()=>{
  const l=new Logic(partner(64,40),[6]);l.run(named['Evolution Expert'].script);assert.equal(l.get(1),dexId(65));assert.equal(l.get(pokemonVars(64).own),1);
});
test('Training reaches level 100 and never exceeds it',()=>{
  const p=pokemonVars(151),l=new Logic({...partner(151,99),[p.xp]:197,7:1});l.run(named['GAIN-XP'].script);assert.equal(l.get(p.level),100);
  l.v[7]=100;l.run(named['GAIN-XP'].script);assert.equal(l.get(p.level),100);
});
test('All species heal to their base-stat HP at every supported level',()=>{
  for(let level=1;level<=100;level++){
    const vars={};for(const p of roster){const v=pokemonVars(p.dex);Object.assign(vars,{[v.own]:1,[v.level]:level,[v.hp]:1});}
    const l=new Logic(vars);l.run(named['HEAL-ALL'].script);
    for(const p of roster)assert.equal(l.get(pokemonVars(p.dex).hp),referenceHP(p.dex,level),`${p.name} L${level}`);
  }
});
test('Level-up preserves missing HP and does not revive a fainted partner',()=>{
  for(const hp of [0,1,referenceHP(151,40)-7]){
    const p=pokemonVars(151),l=new Logic({...partner(151,40),3:hp,[p.hp]:hp,[p.xp]:79,7:1});
    l.run(named['GAIN-XP'].script);
    assert.equal(l.get(p.hp),hp===0?0:hp+referenceHP(151,41)-referenceHP(151,40));
    assert.equal(l.get(2),referenceHP(151,41));
  }
});
test('Evolution preserves damage instead of fully healing the new species',()=>{
  const p=pokemonVars(133),l=new Logic({...partner(133,25),3:referenceHP(133,25)-8,[p.hp]:referenceHP(133,25)-8},[1]);
  l.run(named['Evolution Expert'].script);
  assert.equal(l.get(pokemonVars(134).hp),referenceHP(134,25)-8);
  assert.equal(l.get(2),referenceHP(134,25));
});
test('Learning Leech Seed preserves existing PP and gives only the new move full PP',()=>{
  const p=pokemonVars(1),l=new Logic({...partner(1,6),[p.xp]:11,7:1,104:5,105:7,106:0,107:0});
  l.run(named['GAIN-XP'].script);
  assert.equal(l.get(61),7);assert.equal(l.get(104),5);assert.equal(l.get(105),7);
  assert.equal(l.get(106),moveStats('LEECH SEED').pp);assert.equal(l.get(107),0);
  assert.ok(l.text.join(' ').includes('LEARNED LEECH'));
  Object.assign(l.v,{4:dexId(7),5:28,6:28,7:3});l.choices=[3];l.rolls=[1,1,95,255];l.run(fight);assert.equal(l.get(28),1);assert.equal(l.get(106),moveStats('LEECH SEED').pp-1);
});
test('Named Growl, Tail Whip, and Harden change only the intended battle stages',()=>{
  for(const [dex,level,slot,bit]of [[1,3,2,1],[7,3,2,2],[11,7,1,4]]){
    const l=new Logic({...base,4:dexId(dex),7:level},[],slot===1?[]:[slot]);l.run(named.COUNTER.script);
    assert.equal(l.get(136),bit);assert.equal(l.get(3),base[3]);
  }
});
test('Player switch and defeated-foe replacement clear only their own stages',()=>{
  const l=new Logic({...base,136:31,33:1,53:1,43:12},[4]);l.run(named.PARTY.script);assert.equal(l.get(136),12);
  l.v[136]=31;l.v[29]=1;l.v[19]=1;l.v[20]=2;l.run(named['BOSS-CONFIG'].script);assert.equal(l.get(136),19);assert.equal(l.get(29),0);
});
test('Enemy Explosion ends a wild battle and simultaneous party defeat returns to town',()=>{
  const sturdy=partner(151,100),p=pokemonVars(151);
  let l=new Logic({...sturdy,4:dexId(101),7:50,5:referenceHP(101,50),6:referenceHP(101,50),9:1,3:300,[p.hp]:300},[2,2], [4,255]);
  assert.equal(l.run(scenes.battlefield.script).kind,'pop');assert.equal(l.get(11),1);
  l=new Logic({...base,4:dexId(101),7:50,5:referenceHP(101,50),6:referenceHP(101,50),9:1,3:1,41:1},[2,2],[4,255]);
  assert.equal(l.run(scenes.battlefield.script).kind,'switch');assert.equal(l.get(11),0);assert.equal(l.get(41),referenceHP(1,3));
});
test('The Master Ball guarantees a wild catch and cannot catch trainer Pokemon',()=>{
  const l=new Logic({...base,202:1,4:dexId(150),5:300,6:304,7:70},[4]);assert.equal(l.run(named.BAG.script).kind,'pop');assert.equal(l.get(202),0);assert.equal(l.get(pokemonVars(150).own),1);
  const blocked=new Logic({...base,202:1,19:41},[4]);blocked.run(named.BAG.script);assert.equal(blocked.get(202),1);
});
test('Koga through Giovanni award all four remaining badges after their full teams',()=>{
  for(const mode of [29,30,31,32]){
    const l=new Logic({...partner(151,80),19:mode,20:1,7:40});l.run(named['BOSS-CONFIG'].script);
    bossTeams[mode].team.forEach((_,i)=>{const end=l.run(named.VICTORY.script);assert.equal(end?.kind,i===bossTeams[mode].team.length-1?'pop':undefined);});
    assert.equal(l.get(bossTeams[mode].badge),1);
  }
});
test('All five League teams advance the sequence, with no badge healing',()=>{
  const l=new Logic({...partner(151,80),3:100,[pokemonVars(151).hp]:100});
  for(const mode of [37,38,39,40,41]){l.v[19]=mode;l.v[20]=1;l.run(named['BOSS-CONFIG'].script);for(let i=0;i<bossTeams[mode].team.length;i++)l.run(named.VICTORY.script);assert.equal(l.get(195),bossTeams[mode].leagueStep);}
  assert.equal(l.get(196),1);assert.ok(l.get(3)<l.get(2),'league victory did not fully heal');
});
test('The League gate rejects missing badges, rival victory, or Strength',()=>{
  const t=plan.triggers.find(t=>t.name==='league badge gate'),state={...base,...Object.fromEntries([12,150,151,152,180,181,182,183,187,211].map(v=>[v,1]))};
  for(const missing of [12,150,151,152,180,181,182,183,187,211])assert.equal(new Logic({...state,[missing]:0}).run(byId[t.id].script),null);
  assert.equal(new Logic(state).run(byId[t.id].script).args.sceneId,scenes.victory_road.id);
});
test('Fuji, Safari, Silph and Mansion objectives set the required quest flags',()=>{
  const l=new Logic({...base,197:1});l.run(named['Mr Fuji'].script);assert.equal(l.get(185),1);
  l.run(named['Gold Teeth'].script);l.run(named.Warden.script);assert.equal(l.get(187),1);
  l.run(named['Surf Keeper'].script);assert.equal(l.get(186),1);
  l.v[234]=1;l.run(named['Card Key'].script);assert.equal(l.get(189),1);
  l.run(named['Secret Key'].script);assert.equal(l.get(191),1);
});
test('Hall of Fame saves the completed campaign and postgame unlock',()=>{
  const oak=plan.actors.find(a=>a.sceneId===scenes.hall_of_fame.id&&a.name==='Professor Oak');
  const l=new Logic({...base,196:1},[1,1]);l.run(byId[oak.id].script);
  assert.equal(l.get(220),1);assert.equal(l.slots[0][220],1);assert.equal(l.slots[0][196],1);
});
test('Healing keeps purchased supplies instead of resetting them',()=>{
  const l=new Logic({...base,8:50,9:40});l.run(named['Nurse Joy'].script);assert.equal(l.get(8),50);assert.equal(l.get(9),40);
});
const output={provenance:'authored-native-event-unit-simulation',romExecuted:false,emulatorFramesInspected:false,tests:results,passed:results.length};
await mkdir(path.join(root,'verification'),{recursive:true});
await writeFile(path.join(root,'verification/logic-results.json'),JSON.stringify(output,null,2));
console.log(`${results.length} authored-logic checks passed. This is not an emulator playtest.`);
