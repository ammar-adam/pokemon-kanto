import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {roster,dexId,bossTeams,rivalVariants} from '../artwork/campaign-world.mjs';
import {hpAuthoring,maxHP} from '../artwork/hp-stats.mjs';

// VM modules let the real authoring entry point run with its output kept in memory.
if(!process.execArgv.includes('--experimental-vm-modules')){
  const child=spawnSync(process.execPath,['--no-warnings','--experimental-vm-modules',fileURLToPath(import.meta.url)],{stdio:'inherit'});
  if(child.error)throw child.error;
  process.exit(child.status??1);
}

let plan;
const authorURL=new URL('../artwork/game-design.mjs',import.meta.url);
const author=new vm.SourceTextModule(await readFile(authorURL,'utf8'),{identifier:authorURL.href,
  initializeImportMeta:meta=>{meta.url=authorURL.href;}});
await author.link(async(specifier,referencing)=>{
  const exports={...await import(specifier.startsWith('node:')?specifier:new URL(specifier,referencing.identifier).href)};
  if(specifier==='node:fs/promises')exports.writeFile=async(filename,contents)=>{
    assert.equal(String(filename).replaceAll('\\','/').split('/').at(-1),'game-plan.json');
    assert.equal(plan,undefined,'authoring writes exactly one in-memory plan');
    plan=JSON.parse(contents);
  };
  const names=Object.keys(exports);
  return new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,exports[name]);});
});
await author.evaluate();
assert.ok(plan,'captured authored plan');
const custom=new Map(plan.customScripts.map(s=>[s.id,s]));
const actors=new Map(plan.actors.map(a=>[a.id,a]));
const named=name=>{
  const actor=plan.actors.find(a=>a.name===name);
  assert.ok(actor,'actor '+name);
  return plan.scripts.find(s=>s.target.actorId===actor.id).events;
};
const shared=name=>{
  const script=plan.customScripts.find(s=>s.name==='Kanto '+name);
  assert.ok(script,'shared script '+name);
  return script.script;
};
const stats=JSON.parse(await readFile(new URL('../artwork/red-base-stats.json',import.meta.url),'utf8')).stats;
const reference=(dex,level)=>Math.floor(2*(stats[dex].hp+9)*level/100)+level+10;

class Halt extends Error{constructor(kind,args){super(kind);this.kind=kind;this.args=args;}}
class Logic{
  constructor(vars={},choices=[],rolls=[]){this.v={...vars};this.choices=[...choices];this.rolls=[...rolls];this.steps=0;}
  get(id){return this.v[id]??0;}
  put(id,value){assert.ok(Number.isInteger(value)&&value>=-32768&&value<=32767,'signed16 write '+id+': '+value);this.v[id]=value;}
  expression(text){
    const expression=text.replace(/\$(\d+)\$/g,(_,id)=>String(this.get(id)));
    assert.match(expression,/^[\d\s<>=!&|()+\-*/%.]+$/);
    return Function('return ('+expression+')')();
  }
  value(x){
    if(x.type==='number')return x.value;
    if(x.type==='variable')return this.get(x.value);
    if(x.type==='expression')return this.expression(x.value);
    const a=this.value(x.valueA),b=this.value(x.valueB);
    return {eq:a===b,ne:a!==b,lt:a<b,gt:a>b,lte:a<=b,gte:a>=b}[x.type];
  }
  body(events){
    const labels=new Map(events.flatMap((e,i)=>e.command==='EVENT_DEFINE_LABEL'?[[e.args.label,i]]:[]));
    for(let i=0;i<events.length;i++){
      try{this.event(events[i]);}
      catch(error){if(error instanceof Halt&&error.kind==='goto'&&labels.has(error.args))i=labels.get(error.args);else throw error;}
    }
  }
  event(event){
    assert.ok(++this.steps<100000,'bounded authored execution');
    const a=event.args||{};
    switch(event.command){
      case 'EVENT_SET_VALUE':this.put(a.variable,this.value(a.value));break;
      case 'EVENT_VARIABLE_MATH':{
        const current=this.get(a.vectorX);
        let other=a.other==='var'?this.get(a.vectorY):a.value;
        if(a.other==='rnd'){
          other=this.rolls.length?this.rolls.shift():a.maxValue;
          assert.ok(other>=a.minValue&&other<=a.maxValue,'random result in authored range');
        }
        this.put(a.vectorX,({set:()=>other,add:()=>current+other,sub:()=>current-other,
          mul:()=>current*other,div:()=>Math.trunc(current/other),mod:()=>current%other})[a.operation]());
        break;
      }
      case 'EVENT_IF':this.body(event.children[this.value(a.condition)?'true':'false']||[]);break;
      case 'EVENT_CALL_CUSTOM_EVENT':assert.ok(custom.has(a.customEventId));this.body(custom.get(a.customEventId).script);break;
      case 'EVENT_ACTOR_INVOKE':{
        assert.ok(actors.has(a.actorId));
        this.body(plan.scripts.find(s=>s.target.actorId===a.actorId).events);break;
      }
      case 'EVENT_MENU':assert.ok(this.choices.length,'menu choice supplied');this.put(a.variable,this.choices.shift());break;
      case 'EVENT_GOTO_LABEL':throw new Halt('goto',a.label);
      case 'EVENT_SWITCH_SCENE':throw new Halt('switch',a);
      case 'EVENT_SCENE_POP_STATE':throw new Halt('pop',a);
      default:assert.ok(['EVENT_TEXT','EVENT_TEXT_DRAW','EVENT_DEFINE_LABEL','EVENT_ACTOR_SET_SPRITE',
        'EVENT_ACTOR_SET_STATE','EVENT_ACTOR_EFFECTS','EVENT_SOUND_PLAY_EFFECT','EVENT_SCENE_PUSH_STATE',
        'EVENT_ACTOR_HIDE','EVENT_ACTOR_SHOW','EVENT_SCRIPT_LOCK','EVENT_SCRIPT_UNLOCK'].includes(event.command),event.command);
    }
  }
  run(events){try{this.body(events);return null;}catch(error){if(error instanceof Halt)return error;throw error;}}
}

const slots=index=>index<8?{hp:40+index,own:30+index,member:50+index,level:60+index,xp:70+index,retired:80+index}:
  {hp:401+(index-8)*10,own:400+(index-8)*10,member:402+(index-8)*10,level:403+(index-8)*10,xp:404+(index-8)*10,retired:409+(index-8)*10};
const partner=(dex,level,missing=0)=>{
  const id=dexId(dex),s=slots(id-1),hp=reference(dex,level)-missing;
  return {0:level,1:id,2:reference(dex,level),3:hp,10:1,25:1,[s.own]:1,[s.member]:1,[s.level]:level,[s.hp]:hp};
};
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
let helperSerial=0;
const event=(command,args,children)=>({id:'hp-test-'+helperSerial++,command,args,...(children?{children}:{})});
const V=id=>({type:'variable',value:String(id)});
const helper=hpAuthoring({species:roster,V,
  set:(id,value)=>event('EVENT_SET_VALUE',{variable:String(id),value:typeof value==='object'?value:{type:'number',value}}),
  math:(id,operation,value,other='val')=>event('EVENT_VARIABLE_MATH',{vectorX:String(id),operation,other,
    ...(other==='var'?{vectorY:String(value)}:{value}),clamp:false}),
  IF:(id,operator,value,yes,no=[])=>event('EVENT_IF',{condition:{type:{'==':'eq','<':'lt','>':'gt'}[operator],valueA:V(id),valueB:{type:'number',value}}},{true:yes,false:no}),
  EX:(expression,yes,no=[])=>event('EVENT_IF',{condition:{type:'expression',value:expression}},{true:yes,false:no}),
  chunked:(_name,events)=>events
});

test('All 151 species at levels 1..100 match original HP without signed16 overflow',()=>{
  const dynamic=helper.maxHPEvents(V(4),7,6);
  for(const p of roster){
    const fixed=helper.maxHPEvents(p.index,7,6);
    for(let level=1;level<=100;level++){
      const expected=reference(p.dex,level);
      assert.equal(maxHP(p.dex,level),expected);
      for(const events of [fixed,dynamic]){
        const l=new Logic({4:p.index,7:level,135:777,307:888});l.run(events);
        assert.equal(l.get(6),expected);assert.equal(l.get(7),level);assert.equal(l.get(4),p.index);
        assert.equal(l.get(135),777);assert.equal(l.get(307),888);
      }
    }
  }
  assert.deepEqual([4,1,7].map(dex=>maxHP(dex,5)),[19,20,20]);
  assert.equal(maxHP(113,100),628);
});
test('HP helper rejects destructive output aliases and invalid reference inputs',()=>{
  assert.throws(()=>helper.maxHPEvents(1,7,7),/overwrite/);
  assert.throws(()=>helper.maxHPEvents(V(4),7,4),/overwrite/);
  assert.throws(()=>maxHP(152,5),/Missing/);
  assert.throws(()=>maxHP(1,0),/1\.\.100/);
  assert.throws(()=>maxHP(1,101),/1\.\.100/);
});
test('Load clamps individual HP, retains injuries and fainting for every species',()=>{
  for(const p of roster){
    const s=slots(p.index-1),maximum=reference(p.dex,50);
    for(const [stored,expected]of [[maximum-7,maximum-7],[maximum+20,maximum],[0,0],[-1,0]]){
      const l=new Logic({1:p.index,[s.level]:50,[s.hp]:stored});l.run(shared('load_hp'));
      assert.equal(l.get(0),50);assert.equal(l.get(2),maximum);assert.equal(l.get(3),expected);assert.equal(l.get(s.hp),expected);
    }
  }
});
test('Healing restores each owned species and leaves unowned and retired slots alone',()=>{
  const vars={};for(const p of roster){const s=slots(p.index-1);Object.assign(vars,{[s.own]:1,[s.level]:100,[s.hp]:1});}
  const l=new Logic(vars);l.run(named('HEAL-ALL'));
  for(const p of roster)assert.equal(l.get(slots(p.index-1).hp),reference(p.dex,100));
  const a=slots(0),b=slots(1),unowned=new Logic({[a.level]:5,[b.own]:1,[b.retired]:1,[b.level]:16});
  unowned.run(named('HEAL-ALL'));assert.equal(unowned.get(a.hp),0);assert.equal(unowned.get(b.hp),0);
});
test('Field and battle switches load the target species maximum without free healing',()=>{
  const source=partner(4,5),target=dexId(113),s=slots(target-1),maximum=reference(113,50);
  const choices=[...Array(Math.floor((target-1)/7)).fill(8),(target-1)%7+1];
  const vars={...source,[s.own]:1,[s.member]:1,[s.level]:50,[s.hp]:maximum-20,25:2};
  for(const events of [named('PARTY'),shared('party_view')]){
    const l=new Logic({...vars,132:target},choices);l.run(events);
    assert.equal(l.get(1),target);assert.equal(l.get(2),maximum);assert.equal(l.get(3),maximum-20);
    assert.equal(l.get(s.hp),maximum-20);assert.equal(l.get(slots(dexId(4)-1).hp),reference(4,5));
  }
});
test('Capture retains foe HP at enemy level and never overwrites an existing catch',()=>{
  for(const p of roster){
    const s=slots(p.index-1),maximum=reference(p.dex,50);
    const vars={4:p.index,5:1,6:maximum,7:50,8:1,19:0,25:0};
    const l=new Logic(vars,[1],[0]);assert.equal(l.run(named('BAG')).kind,'pop');
    assert.equal(l.get(s.hp),1);assert.equal(l.get(s.level),50);assert.equal(l.get(s.own),1);assert.equal(l.get(25),1);
    const duplicate=new Logic({...vars,[s.own]:1,[s.hp]:3,[s.level]:5},[1],[0]);duplicate.run(named('BAG'));
    assert.equal(duplicate.get(s.hp),3);assert.equal(duplicate.get(s.level),5);
  }
});
test('Master Ball rejects invalid targets and preserves injuries when sent to the PC',()=>{
  const dex=113,id=dexId(dex),s=slots(id-1),maximum=reference(dex,100);
  for(const [current,expected]of [[maximum+20,null],[-1,null],[0,null],[maximum-30,maximum-30]]){
    const l=new Logic({4:id,5:current,6:maximum,7:100,19:0,25:6,202:1},[4]);
    const end=l.run(named('BAG'));
    if(expected===null){assert.equal(end,null);assert.equal(l.get(202),1);assert.equal(l.get(s.own),0);assert.equal(l.get(18),0);}
    else {assert.equal(end.kind,'pop');assert.equal(l.get(s.hp),expected);assert.equal(l.get(202),0);}
    assert.equal(l.get(s.member),0);assert.equal(l.get(25),6);
  }
});
test('Gift registration restores full species HP independently of enemy current HP',()=>{
  for(const [dex,level]of [[133,25],[122,20],[131,25],[138,30],[140,30],[142,35]]){
    const s=slots(dexId(dex)-1),l=new Logic({4:dexId(dex),5:1,7:level});l.run(shared('register'));
    assert.equal(l.get(s.hp),reference(dex,level));assert.equal(l.get(s.level),level);assert.equal(l.get(s.own),1);
  }
});
test('Level-up and immediate evolution preserve missing HP in active and stored slots',()=>{
  const from=dexId(4),to=dexId(5),source=slots(from-1),target=slots(to-1);
  const l=new Logic({...partner(4,15,7),7:1,[source.xp]:29});l.run(named('GAIN-XP'));
  assert.equal(l.get(1),to);assert.equal(l.get(0),16);assert.equal(l.get(2),reference(5,16));
  assert.equal(l.get(3),reference(5,16)-7);assert.equal(l.get(target.hp),reference(5,16)-7);
  assert.equal(l.get(source.hp),0);assert.equal(l.get(source.retired),1);
});
test('Level 100 HP, level cap and fainted level-up remain valid',()=>{
  const s=slots(dexId(113)-1);
  let l=new Logic({...partner(113,99,30),7:1,[s.xp]:197});l.run(named('GAIN-XP'));
  assert.equal(l.get(s.level),100);assert.equal(l.get(s.hp),reference(113,100)-30);
  l=new Logic({...partner(113,100,30),7:100,[s.xp]:200});l.run(named('GAIN-XP'));
  assert.equal(l.get(s.level),100);assert.equal(l.get(s.hp),reference(113,100)-30);
  l=new Logic({...partner(113,99),3:0,[s.hp]:0,7:1,[s.xp]:197});l.run(named('GAIN-XP'));
  assert.equal(l.get(s.level),100);assert.equal(l.get(s.hp),0);assert.equal(l.get(3),0);
});
test('Stone and trade evolution preserve missing HP and do not revive fainted partners',()=>{
  for(const [dex,targetDex,mode]of [[133,134,1],[64,65,6]]){
    const s=slots(dexId(targetDex)-1);
    for(const missing of [0,9,reference(dex,30)]){
      const l=new Logic(partner(dex,30,missing),[mode]);l.run(named('Evolution Expert'));
      const expected=missing===reference(dex,30)?0:reference(targetDex,30)-missing;
      assert.equal(l.get(1),dexId(targetDex));assert.equal(l.get(2),reference(targetDex,30));
      assert.equal(l.get(s.hp),expected);assert.equal(l.get(3),expected);
    }
  }
});
test('Trainer, rival and Youngster HP use species stats instead of authored HP tuples',()=>{
  for(const [mode,team]of Object.entries(bossTeams))for(let stage=1;stage<=team.team.length;stage++){
    const l=new Logic({19:Number(mode),20:stage,27:1});l.run(named('BOSS-CONFIG'));
    assert.equal(l.get(6),reference(roster[l.get(4)-1].dex,l.get(7)));assert.equal(l.get(5),l.get(6));
  }
  for(const [mode,variants]of Object.entries(rivalVariants))for(const [starter,pairs]of Object.entries(variants)){
    const stageStart=bossTeams[mode].team.length-pairs.length+1;
    pairs.forEach(([dex,level],i)=>{
      const l=new Logic({19:Number(mode),20:stageStart+i,27:Number(starter)});l.run(named('BOSS-CONFIG'));
      assert.equal(l.get(4),dexId(dex));assert.equal(l.get(6),reference(dex,level));
    });
  }
  for(const mode of [2,3]){
    const l=new Logic({19:mode,20:1,27:1});l.run(named('BOSS-CONFIG'));
    assert.equal(l.get(6),reference(roster[l.get(4)-1].dex,l.get(7)));assert.equal(l.get(5),l.get(6));
  }
});
test('HP authoring adds no variable slots',()=>{
  // Named metadata includes unused slots; memory-check verifies the referenced budget.
  assert.equal(plan.variables.length,1688);
  assert.equal(new Set(plan.variables.map(v=>v.variableId)).size,1688);
});
console.log(`${passed} HP checks passed; no generated or native resources written.`);
