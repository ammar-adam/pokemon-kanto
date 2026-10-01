import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeResourceBytes } from 'file:///C:/Users/aaamm/.codex/plugins/cache/openai-curated-remote/modretro-chromatic/1.0.33+codex.distribution.66e8961d3ce30093ea3c9ee4/dist/resource-codec.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plan=JSON.parse(await readFile(path.join(root,'artwork/game-plan.json'),'utf8'));
const resources=[];
async function walk(dir){for(const d of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())await walk(p);else if(p.endsWith('.gbsres'))resources.push(JSON.parse(await readFile(p,'utf8')));}}
await walk(path.join(root,'project'));
const byId=Object.fromEntries(resources.filter(r=>r.id).map(r=>[r.id,r]));
function effective(events){return events.map(e=>({...e,args:e.command==='EVENT_IF'?{condition:e.args.condition}:e.args,children:Object.fromEntries(Object.entries(e.children||{}).map(([key,list])=>[key,effective(list)]))}));}
for(const s of plan.scripts){const owner=byId[s.target.actorId||s.target.triggerId||s.target.sceneId];assert.ok(owner,'script owner exists');assert.deepEqual(effective(owner[s.target.scriptKey]),effective(s.events),'native script matches authored plan');}
const named=Object.fromEntries(plan.actors.map(a=>[a.name,byId[a.id]]));
const scenes=Object.fromEntries(resources.filter(r=>r._resourceType==='scene').map(r=>[r.name,r]));
const results=[];
function test(name,fn){fn();results.push({name,passed:true});console.log('PASS '+name);}
class Halt { constructor(kind,args){this.kind=kind;this.args=args;} }
// This executes authored event semantics for unit checks, not a ROM or emulator.
class Logic {
  constructor(vars={},choices=[],rolls=[]){this.v={...vars};this.choices=[...choices];this.rolls=[...rolls];this.trace=[];this.steps=0;this.saved=null;}
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
  event(e){assert.ok(++this.steps<12000,'bounded event execution');const a=e.args||{};this.trace.push(e.command);switch(e.command){
    case 'EVENT_SET_VALUE':this.v[a.variable]=this.val(a.value);break;
    case 'EVENT_RESET_VARIABLES':this.v={};break;
    case 'EVENT_VARIABLE_MATH':{const current=this.get(a.vectorX);let other=a.other==='var'?this.get(a.vectorY):a.value;
      if(a.other==='rnd'){other=this.rolls.length?this.rolls.shift():a.maxValue;assert.ok(other>=a.minValue && other<=a.maxValue,'RNG result in bounds');}
      this.v[a.vectorX]=({set:()=>other,add:()=>current+other,sub:()=>current-other,mul:()=>current*other,div:()=>Math.trunc(current/other),mod:()=>current%other})[a.operation]();break;}
    case 'EVENT_IF_VALUE':{const x=this.get(a.variable),y=a.comparator;const yes=({'==':x===y,'!=':x!==y,'<':x<y,'>':x>y,'<=':x<=y,'>=':x>=y})[a.operator];this.body(e.children[yes?'true':'false']||[]);break;}
    case 'EVENT_IF_EXPRESSION':this.body(e.children[this.expression(a.expression)?'true':'false']||[]);break;
    case 'EVENT_IF':this.body(e.children[this.val(a.condition)?'true':'false']||[]);break;
    case 'EVENT_MENU':{assert.ok(this.choices.length,'expected a supplied menu choice');const choice=this.choices.shift();assert.ok(choice>=0 && choice<=a.items);this.v[a.variable]=choice;break;}
    case 'EVENT_ACTOR_INVOKE':this.body(byId[a.actorId].script);break;
    case 'EVENT_GOTO_LABEL':throw new Halt('goto',a.label);
    case 'EVENT_SWITCH_SCENE':throw new Halt('switch',a);
    case 'EVENT_SCENE_POP_STATE':throw new Halt('pop',a);
    case 'EVENT_IF_SAVED_DATA':this.body(e.children[this.saved?'true':'false']||[]);break;
    case 'EVENT_SAVE_DATA':this.saved={...this.v};this.body(e.children.true||[]);break;
    case 'EVENT_LOAD_DATA':assert.ok(this.saved);this.v={...this.saved};throw new Halt('load',a);
    case 'EVENT_SET_INPUT_SCRIPT':break;
    default:assert.ok(['EVENT_TEXT','EVENT_TEXT_DRAW','EVENT_DEFINE_LABEL','EVENT_ACTOR_SET_SPRITE','EVENT_ACTOR_SET_STATE','EVENT_ACTOR_EFFECTS','EVENT_ACTOR_HIDE','EVENT_ACTOR_SHOW','EVENT_ACTOR_SET_POSITION','EVENT_SOUND_PLAY_EFFECT','EVENT_SCRIPT_LOCK','EVENT_SCRIPT_UNLOCK','EVENT_REMOVE_INPUT_SCRIPT','EVENT_SCENE_PUSH_STATE','EVENT_SCENE_RESET_STATE'].includes(e.command),'known native event '+e.command);
  }}
  run(events){try{this.body(events);return null;}catch(e){if(e instanceof Halt)return e;throw e;}}
}
const base={0:3,1:2,2:36,3:36,4:3,5:28,6:28,7:3,8:6,9:3,10:1,11:0,12:0,19:0,25:1,27:2,31:1,41:36,51:1,60:3,61:3,62:3,63:3,...Object.fromEntries(Array.from({length:32},(_,i)=>[100+i,35]))};
test('New game initializes level, HP, inventory and lab arrival',()=>{const l=new Logic({},[1]);const end=l.run(scenes.Title.script);assert.equal(end.kind,'switch');assert.equal(end.args.sceneId,scenes.laboratory.id);assert.equal(l.get(0),5);assert.equal(l.get(2),44);assert.equal(l.get(8),6);});
test('New game clears a prior collection and badge',()=>{const l=new Logic({12:1,30:1,31:1,32:1,10:3},[1]);l.run(scenes.Title.script);assert.equal(l.get(12),0);assert.equal(l.get(30),0);assert.equal(l.get(31),0);assert.equal(l.get(10),0);});
test('Continue loads an existing journal without starting a new game',()=>{const l=new Logic({},[2]);l.saved={...base,12:1};assert.equal(l.run(scenes.Title.script).kind,'load');assert.equal(l.get(12),1);assert.equal(l.get(31),1);});
test('All three starters have individual level, HP, PP and a party slot',()=>{for(let starter=1;starter<=3;starter++){const l=new Logic({0:5,2:44},[starter]);l.run(named['Professor Oak'].script);assert.equal(l.get(1),starter);assert.equal(l.get(29+starter),1);assert.equal(l.get(39+starter),44);assert.equal(l.get(49+starter),1);assert.equal(l.get(59+starter),5);assert.equal(l.get(100+(starter-1)*4),35);assert.equal(l.get(10),1);assert.equal(l.get(25),1);}});
test('Tackle, elemental advantage, resistance and HP clamping',()=>{let l=new Logic({...base,14:1});l.run(named.ATTACK.script);assert.equal(l.get(5),19);l=new Logic({...base,14:2});l.run(named.ATTACK.script);assert.equal(l.get(16),26);assert.equal(l.get(5),2);l=new Logic({...base,4:2,5:3,14:2});l.run(named.ATTACK.script);assert.equal(l.get(16),6);assert.equal(l.get(5),0);});
test('Guard halves one hit and stores individual party HP',()=>{const l=new Logic({...base,17:1},[],[1]);l.run(named.COUNTER.script);assert.equal(l.get(3),32);assert.equal(l.get(41),32);assert.equal(l.get(17),0);});
test('Low-HP catch is guaranteed and adds a species once',()=>{let l=new Logic({...base,4:4,5:9},[1],[100]);assert.equal(l.run(named.BAG.script).kind,'pop');assert.equal(l.get(33),1);assert.equal(l.get(43),36);assert.equal(l.get(10),2);assert.equal(l.get(8),5);l=new Logic({...base,4:4,5:9,33:1,10:2},[1],[100]);l.run(named.BAG.script);assert.equal(l.get(10),2);});
test('Full-HP catch boundary succeeds at 35 and fails at 36',()=>{for(const roll of [35,36]){const l=new Logic({...base,4:4},[1],[roll]);const end=l.run(named.BAG.script);assert.equal(end?.kind==='pop',roll===35);assert.equal(l.get(18),1);assert.equal(l.get(8),5);}});
test('Mid-HP catch boundary succeeds at 75 and fails at 76',()=>{for(const roll of [75,76]){const l=new Logic({...base,4:4,5:14},[1],[roll]);const end=l.run(named.BAG.script);assert.equal(end?.kind==='pop',roll===75);}});
test('No capsules or full HP consumes neither item nor turn',()=>{let l=new Logic({...base,8:0},[1]);l.run(named.BAG.script);assert.equal(l.get(18),0);assert.equal(l.get(8),0);l=new Logic(base,[2]);l.run(named.BAG.script);assert.equal(l.get(9),3);assert.equal(l.get(18),0);});
test('Potion heals, clamps to maximum and persists individual HP',()=>{const l=new Logic({...base,3:20,41:20},[2]);l.run(named.BAG.script);assert.equal(l.get(3),36);assert.equal(l.get(41),36);assert.equal(l.get(9),2);assert.equal(l.get(18),1);});
test('Champion opponents cannot be caught or escaped',()=>{const l=new Logic({...base,19:1},[1]);l.run(named.BAG.script);assert.equal(l.get(8),6);assert.equal(l.get(18),0);});
test('Bag Back does not fall through to Party or Run',()=>{const l=new Logic(base,[2,3,4]);assert.equal(l.run(scenes.battlefield.script).kind,'pop');assert.equal(l.get(3),36);assert.equal(l.choices.length,0);assert.ok(!l.trace.includes('EVENT_ACTOR_EFFECTS'));});
test('Party switching spends one turn without accidentally running',()=>{const l=new Logic({...base,33:1,53:1,43:36},[3,4,4],[2]);assert.equal(l.run(scenes.battlefield.script).kind,'pop');assert.equal(l.get(1),4);assert.equal(l.get(43),30);});
test('Fainting automatically brings in the next healthy owned partner',()=>{const l=new Logic({...base,3:1,41:1,32:1,52:1,42:36,5:100,6:100},[1,1,4],[2]);assert.equal(l.run(scenes.battlefield.script).kind,'pop');assert.equal(l.get(41),0);assert.equal(l.get(1),3);assert.equal(l.get(3),36);});
test('Full-party defeat heals and returns to an accessible town tile',()=>{const l=new Logic({...base,3:1,41:1,5:100,6:100},[1,1],[2]);const end=l.run(scenes.battlefield.script);assert.equal(end.kind,'switch');assert.equal(end.args.sceneId,scenes.fernvale.id);assert.equal(l.get(1),2);assert.equal(l.get(41),36);});
test('Nested overworld party menu cannot accidentally save',()=>{const pause=scenes.fernvale.script.find(e=>e.command==='EVENT_SET_INPUT_SCRIPT');const l=new Logic({...base,32:1,52:1,42:36},[1,3]);l.run(pause.children.true);assert.equal(l.get(1),3);assert.equal(l.saved,null);});
test('Explicit Save produces a journal snapshot',()=>{const pause=scenes.fernvale.script.find(e=>e.command==='EVENT_SET_INPUT_SCRIPT');const l=new Logic(base,[3]);l.run(pause.children.true);assert.equal(l.saved[31],1);assert.equal(l.saved[0],3);});
test('Brock advances from Geodude to Onix and awards Boulder Badge',()=>{const l=new Logic({...base,19:1,20:1,5:0,71:5});l.run(named.VICTORY.script);assert.equal(l.get(20),2);assert.equal(l.get(4),7);assert.equal(l.get(7),10);assert.equal(l.get(0),4);assert.equal(l.get(2),40);assert.equal(l.run(named.VICTORY.script).kind,'pop');assert.equal(l.get(12),1);assert.equal(l.get(9),3);});
test('Nurse Joy restores HP and PP without changing individual levels',()=>{const l=new Logic({...base,8:0,9:0,41:0,104:0,61:3});l.run(named['Nurse Joy'].script);assert.equal(l.get(41),36);assert.equal(l.get(104),35);assert.equal(l.get(61),3);assert.equal(l.get(8),6);assert.equal(l.get(9),3);});
test('Six-Pokemon party sends a seventh unique catch to PC storage',()=>{const l=new Logic({...base,25:6,10:6,4:7,5:1,7:4},[1],[100]);assert.equal(l.run(named.BAG.script).kind,'pop');assert.equal(l.get(36),1);assert.equal(l.get(56),0);assert.equal(l.get(25),6);assert.equal(l.get(66),4);assert.equal(l.get(46),40);});
test('PC refuses depositing the last party member',()=>{const l=new Logic(base,[2]);l.run(named['Bills PC'].script);assert.equal(l.get(51),1);assert.equal(l.get(25),1);});
test('PC deposits and withdraws with an exact six-member cap',()=>{let l=new Logic({...base,25:2,33:1,53:1,43:36},[4]);l.run(named['Bills PC'].script);assert.equal(l.get(53),0);assert.equal(l.get(25),1);l=new Logic({...base,33:1,25:6},[4]);l.run(named['Bills PC'].script);assert.equal(l.get(53),0);assert.equal(l.get(25),6);l=new Logic({...base,33:1},[4]);l.run(named['Bills PC'].script);assert.equal(l.get(53),1);assert.equal(l.get(25),2);});
test('Boxed Pokemon cannot enter battle or replace a fainted party member',()=>{const l=new Logic({...base,33:1,53:0,43:36},[4]);l.run(named.PARTY.script);assert.equal(l.get(1),2);assert.equal(l.get(18),0);});
test('Electric attacks have no effect on Geodude or Onix',()=>{for(const foe of [5,7]){const l=new Logic({...base,1:4,4:foe,14:2});l.run(named.ATTACK.script);assert.equal(l.get(16),0);assert.equal(l.get(5),28);}});
test('Blue chooses the starter with an elemental advantage',()=>{for(const [starter,foe]of [[1,3],[2,1],[3,2]]){const l=new Logic({...base,27:starter,19:2},[4,2,3,4]);try{l.run(scenes.battlefield.script);}catch(e){assert.match(e.message,/expected a supplied menu choice/);}assert.equal(l.get(4),foe);assert.equal(l.get(7),5);}});
const fight=named.FIGHT.script;
test('A move spends only its own individual PP',()=>{const l=new Logic(base,[1],[16]);l.run(fight);assert.equal(l.get(104),34);assert.equal(l.get(105),35);assert.equal(l.get(18),1);});
test('An empty move and Back spend no PP or turn',()=>{let l=new Logic({...base,105:0},[2]);l.run(fight);assert.equal(l.get(104),35);assert.equal(l.get(105),0);assert.equal(l.get(18),0);l=new Logic(base,[5]);l.run(fight);assert.equal(l.get(18),0);assert.equal(l.get(104),35);});
test('All PP empty enables Struggle with persistent recoil',()=>{const l=new Logic({...base,104:0,105:0,106:0,107:0},[],[16]);l.run(fight);assert.equal(l.get(5),19);assert.equal(l.get(3),32);assert.equal(l.get(41),32);assert.equal(l.get(18),1);});
test('Critical hit doubles damaging moves',()=>{const l=new Logic({...base,14:1},[],[1]);l.run(named.ATTACK.script);assert.equal(l.get(16),18);assert.equal(l.get(5),10);});
test('Grass Leech Seed drains the foe and heals within maximum HP',()=>{const l=new Logic({...base,41:20},[1,4,4]);assert.equal(l.run(scenes.battlefield.script).kind,'pop');assert.equal(l.get(28),1);assert.equal(l.get(5),26);assert.equal(l.get(41),16);assert.equal(l.get(107),34);});
test('Pikachu Thunder Wave and Charmander Smokescreen set battle effects',()=>{let l=new Logic({...base,1:4},[4]);l.run(fight);assert.equal(l.get(69),1);l=new Logic({...base,1:1},[4]);l.run(fight);assert.equal(l.get(68),1);});
test('PC preserves a valid lead even when the remaining party is fainted',()=>{const l=new Logic({...base,25:2,33:1,53:1,43:0},[2]);l.run(named['Bills PC'].script);assert.equal(l.get(1),4);assert.equal(l.get(25),1);assert.equal(l.get(3),0);});
test('Individual experience levels only the battling Pokemon',()=>{const l=new Logic({...base,71:5,19:0});l.run(named.VICTORY.script);assert.equal(l.get(61),4);assert.equal(l.get(60),3);assert.equal(l.get(71),2);assert.equal(l.get(2),40);});
test('Every transition lands on clear two-tile player footing',()=>{for(const r of resources){for(const key of ['script','startScript']){function check(events){for(const e of events||[]){if(e.command==='EVENT_SWITCH_SCENE'){const s=byId[e.args.sceneId],x=e.args.x.value,y=e.args.y.value;const bytes=decodeResourceBytes(s.collisions,{maximumValues:s.width*s.height});assert.equal(bytes[y*s.width+x],0,`landing ${s.name} ${x},${y}`);assert.equal(bytes[y*s.width+x+1],0,`landing right ${s.name} ${x},${y}`);}for(const child of Object.values(e.children||{}))check(child);}}check(r[key]);}}});
test('Healer is reachable from the laboratory exit',()=>{const s=scenes.fernvale,b=decodeResourceBytes(s.collisions,{maximumValues:s.width*s.height}),queue=[[7,13]],seen=new Set();let reachable=false;while(queue.length){const [x,y]=queue.shift(),k=`${x},${y}`;if(seen.has(k)||x<1||y<1||x+1>=s.width||y>=s.height||b[y*s.width+x]||b[y*s.width+x+1])continue;seen.add(k);if(x===19&&y===23)reachable=true;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,y+dy]);}assert.ok(reachable);});
const output={provenance:'authored-native-event-unit-simulation',romExecuted:false,emulatorFramesInspected:false,tests:results,passed:results.length};
await mkdir(path.join(root,'verification'),{recursive:true});
await writeFile(path.join(root,'verification/logic-results.json'),JSON.stringify(output,null,2));
console.log(`${results.length} authored-logic checks passed. This is not an emulator playtest.`);
