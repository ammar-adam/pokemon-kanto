import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storyJournal} from '../artwork/story-journal.mjs';
import {bossTeams,dexId,roster} from '../artwork/campaign-world.mjs';

const own=dex=>{const i=dexId(dex)-1;return i<8?30+i:400+(i-8)*10;};
const scripts=new Map();
let serial=0;
const E=(command,args={},children)=>({id:String(serial++),command,args,...(children?{children}:{})});
const IF=(v,operator,n,yes,no=[])=>E('EVENT_IF',{condition:{
  type:{'==':'eq','!=':'ne','<':'lt','>':'gt','<=':'lte','>=':'gte'}[operator],
  valueA:{type:'variable',value:String(v)},valueB:{type:'number',value:n}
}},{true:yes,false:no});
const EX=(value,yes,no=[])=>E('EVENT_IF',{condition:{type:'expression',value}},{true:yes,false:no});
const say=text=>E('EVENT_TEXT',{text:[].concat(text)});
const shared=(name,events)=>{
  if(!scripts.has(name))scripts.set(name,events);
  return [E('EVENT_CALL_CUSTOM_EVENT',{customEventId:name})];
};
const events=storyJournal({IF,EX,say,shared});
const registered=structuredClone([...scripts]);
storyJournal({IF,EX,say,shared});
assert.deepEqual([...scripts],registered,'repeated menu construction reuses shared scripts');
const compare=(a,type,b)=>({eq:a===b,ne:a!==b,lt:a<b,gt:a>b,lte:a<=b,gte:a>=b})[type];
let checks=0;
function run(initial={}) {
  const snapshot=structuredClone(initial),pages=[];
  let steps=0;
  const read=id=>initial[id]??0;
  function execute(list,stack=[]) {
    assert.ok(stack.length<=8,'journal shared-call depth fits its small VM stack');
    for(const event of list) {
      assert.ok(++steps<100,'bounded journal execution');
      if(event.command==='EVENT_TEXT')pages.push(...event.args.text);
      else if(event.command==='EVENT_CALL_CUSTOM_EVENT') {
        const id=event.args.customEventId;
        assert.ok(scripts.has(id),'known shared script');
        assert.ok(!stack.includes(id),'no recursion');
        execute(scripts.get(id),[...stack,id]);
      } else if(event.command==='EVENT_IF') {
        const c=event.args.condition;
        let yes;
        if(c.type==='expression') {
          const expression=c.value.replace(/\$(\d+)\$/g,(_,id)=>String(read(id)));
          assert.match(expression,/^[\d\s<>=!&|()+-]+$/);
          yes=Function('return ('+expression+');')();
        } else yes=compare(read(c.valueA.value),c.type,c.valueB.value);
        execute(event.children[yes?'true':'false'],stack);
      } else assert.fail('Journal may not execute '+event.command);
    }
  }
  execute(events);
  assert.deepEqual(initial,snapshot,'journal never mutates progress');
  assert.equal(pages.length,2,'one objective/place page and one clue page');
  assert.ok(pages.every(page=>page.trim()),'nonempty journal pages');
  return pages;
}
function expect(state,goal,place,clue) {
  const pages=run(state);
  assert.equal(pages[0],goal+'\n'+place);
  assert.ok(pages[1].includes(clue),JSON.stringify({state,pages,clue}));
  checks++;
  return pages;
}

// Match the native helpers' representation and narrower 16 x 3 wrapper too.
const known=new Set([1,10,12,26,27,...Array.from({length:130},(_,i)=>150+i),
  ...roster.map(p=>own(p.dex))]);
const referenced=new Set();
const eventIds=new Set();
function inspect(list) {
  for(const event of list) {
    assert.ok(!eventIds.has(event.id),'unique native event ID '+event.id);eventIds.add(event.id);
    assert.ok(['EVENT_IF','EVENT_TEXT','EVENT_CALL_CUSTOM_EVENT'].includes(event.command));
    if(event.command==='EVENT_IF') {
      const c=event.args.condition;
      const refs=c.type==='expression'?[...c.value.matchAll(/\$(\d+)\$/g)].map(m=>Number(m[1])):
        [Number(c.valueA.value)];
      for(const id of refs){assert.ok(known.has(id),'existing variable '+id);referenced.add(id);}
      for(const child of Object.values(event.children))inspect(child);
    }
    if(event.command==='EVENT_TEXT')for(const page of event.args.text) {
      assert.match(page,/^[\x20-\x7e\n]+$/,'plain native dialogue');
      const lines=page.split('\n');
      assert.ok(lines.length<=4,'four-line page limit');
      assert.ok(lines.every(line=>line.length<=18),'18-column line limit');
      assert.ok(lines.length<=3 && lines.every(line=>line.length<=16),
        'existing say helper preserves authored page boundaries: '+page);
    }
    if(event.command==='EVENT_CALL_CUSTOM_EVENT')assert.ok(scripts.has(event.args.customEventId));
  }
}
inspect(events);
for(const script of scripts.values())inspect(script);
assert.ok(scripts.size<=24,'bounded shared script count');
assert.equal(new Set([...scripts.values()].flat().map(e=>e.id)).size,
  [...scripts.values()].flat().length,'unique top-level native event IDs');

expect({},'TALK TO OAK.','PALLET LAB','SOUTH');
expect({246:1},'CHOOSE YOUR\nFIRST PARTNER.','PALLET LAB','POKE BALLS');
expect({1:1,27:1,246:1},'BATTLE BLUE.','PALLET LAB','EXIT');
expect({1:1,27:1,26:1},'COLLECT OAKS\nPARCEL.','VIRIDIAN MART','NORTH');
expect({1:2,27:2,26:0,247:1},'DELIVER OAKS\nPARCEL.','PALLET LAB','SOUTH');
expect({1:0,27:3,26:1},'COLLECT OAKS\nPARCEL.','VIRIDIAN MART','CLERK');
for(const rival of [1,2,3])expect({1:3,27:3,26:rival},'COLLECT OAKS\nPARCEL.','VIRIDIAN MART','CLERK');

const state={1:1,27:1,26:1,246:1,247:2,248:1};
const progression=[
  [{},'CHALLENGE BROCK.','PEWTER GYM','FOREST'],
  [{12:1},'DEFEAT THE\nMOON ROCKET.','MT MOON','ROUTE 3'],
  [{153:1},'CHALLENGE MISTY.','CERULEAN GYM','ROAD SOUTH'],
  [{150:1},'BATTLE BLUE.','CERULEAN CITY','NORTH EXIT'],
  [{263:1},'DEFEAT THE\nBRIDGE ROCKET.','NUGGET BRIDGE','BILL'],
  [{155:1},'VISIT BILL.','BILLS COTTAGE','TICKET'],
  [{156:1,157:1},'MEET THE\nSHIP CAPTAIN.','S.S. ANNE','CUT'],
  [{158:1},'TURN ON THE\nFIRST SWITCH.','VERMILION GYM','WESTERN'],
  [{163:1},'TURN ON THE\nSECOND SWITCH.','VERMILION GYM','MIDDLE'],
  [{163:2},'TURN ON THE\nTHIRD SWITCH.','VERMILION GYM','EASTERN'],
  [{163:3},'CHALLENGE SURGE.','VERMILION GYM','GROUND'],
  [{151:1},'DEFEAT THE\nROCKET GUARD.','ROCKET HIDEOUT','LIFT KEY'],
  [{170:1},'TAKE THE\nLIFT KEY.','ROCKET HIDEOUT','NORTHEAST'],
  [{160:1},'DEFEAT GIOVANNI.','ROCKET HIDEOUT','SCOPE'],
  [{159:1},'CHALLENGE ERIKA.','CELADON GYM','ROUTE 8'],
  [{152:1},'DEFEAT THE\nTOWER ROCKET.','TOWER SUMMIT','MR FUJI'],
  [{197:1},'TALK TO MR FUJI.','TOWER SUMMIT','FLUTE'],
  [{184:1,185:1},'CHALLENGE KOGA.','FUCHSIA GYM','ROUTE 12'],
  [{180:1},'TALK TO THE\nSAFARI RANGER.','SAFARI LODGE','GATE'],
  [{207:1},'MEET THE\nSURF KEEPER.','SAFARI LAKE','WEST'],
  [{186:1},'FIND THE\nGOLD TEETH.','SAFARI EAST','WARDEN'],
  [{188:1},'RETURN THE\nGOLD TEETH.','FUCHSIA WARDEN','STRENGTH'],
  [{187:1},'DEFEAT THE\nSCIENTIST.','SILPH LOBBY','SAFFRON'],
  [{233:1},'DEFEAT THE\nROCKET CAPTAIN.','SILPH RESEARCH','CARD KEY'],
  [{234:1},'TAKE THE\nCARD KEY.','SILPH RESEARCH','NORTHEAST'],
  [{189:1},'BATTLE BLUE.','SILPH OFFICE','OFFICE'],
  [{210:1},'DEFEAT GIOVANNI.','SILPH OFFICE','FREE SILPH'],
  [{190:1},'CHALLENGE\nSABRINA.','SAFFRON GYM','KOGAS BADGE'],
  [{181:1},'SEARCH THE\nSECRET STATUE.','POKEMON MANSION','PALLET'],
  [{198:1},'FIND THE\nSECRET KEY.','MANSION CELLAR','BLAINES KEY'],
  [{191:1},'CHALLENGE\nBLAINE.','CINNABAR GYM','WATER'],
  [{182:1},'CHALLENGE\nGIOVANNI.','VIRIDIAN GYM','RETURNED'],
  [{183:1},'BATTLE BLUE.','ROUTE 22','WEST'],
  [{211:1},'PUSH THE\nFIRST BOULDER.','VICTORY ROAD','STRENGTH'],
  [{199:1},'PUSH THE\nSECOND BOULDER.','VICTORY SUMMIT','CLIMB'],
  [{200:1},'CHALLENGE\nLORELEI.','INDIGO PLATEAU','ATTENDANT'],
  [{195:1,221:1},'CHALLENGE BRUNO.','BRUNOS ROOM','LORELEI'],
  [{195:2,222:1},'CHALLENGE\nAGATHA.','AGATHAS ROOM','BRUNO'],
  [{195:3,223:1},'CHALLENGE LANCE.','LANCES ROOM','AGATHA'],
  [{195:4,224:1},'CHALLENGE BLUE.','CHAMPION ROOM','LANCE'],
  [{195:5,196:1},'TALK TO OAK.','HALL OF FAME','RECORD']
];
const snapshots=[];
for(const [patch,goal,place,clue] of progression) {
  Object.assign(state,patch);snapshots.push({...state});expect(state,goal,place,clue);
}
const complete={...state,195:0};
for(let mask=0;mask<32;mask++) {
  const abandoned={...complete};
  [221,222,223,224,196].forEach((flag,i)=>abandoned[flag]=(mask>>i)&1);
  expect(abandoned,'CHALLENGE\nLORELEI.','INDIGO PLATEAU','FIRST');
  for(let step=1;step<=5;step++) {
    const [,goal,place,clue]=progression[35+step];
    expect({...abandoned,195:step},goal,place,clue);
  }
}
// Delivered parcel and persistent starter take precedence over incidental flags.
expect({...snapshots[0],26:0,246:0,247:0},'CHALLENGE BROCK.','PEWTER GYM','FOREST');
expect({...snapshots[6],156:0,155:0,263:0},'MEET THE\nSHIP CAPTAIN.','S.S. ANNE','CUT');
expect({...snapshots[13],170:0},'DEFEAT GIOVANNI.','ROCKET HIDEOUT','SCOPE');
expect({...snapshots[25],233:0,234:0},'BATTLE BLUE.','SILPH OFFICE','OFFICE');
expect({...snapshots[30],198:0,192:0},'CHALLENGE\nBLAINE.','CINNABAR GYM','KEY');
expect({...snapshots[15],206:1,197:0,185:0},'CHALLENGE KOGA.','FUCHSIA GYM','CYCLING ROAD');
expect({...snapshots[19],206:1,185:0},'MEET THE\nSURF KEEPER.','SAFARI LAKE','LAKE');
expect({...snapshots[20],207:0},'TALK TO THE\nSAFARI RANGER.','SAFARI LODGE','GATE');
expect({...snapshots[21],207:0},'RETURN THE\nGOLD TEETH.','FUCHSIA WARDEN','STRENGTH');

const badges=[12,150,151,152,180,181,182,183];
assert.deepEqual(Object.values(bossTeams).filter(team=>team.badge).map(team=>team.badge),badges);
const badgeGoals=[
  ['CHALLENGE BROCK.','PEWTER GYM','FOREST'],
  ['CHALLENGE MISTY.','CERULEAN GYM','SOUTH'],
  ['CHALLENGE SURGE.','VERMILION GYM','LOCKS'],
  ['CHALLENGE ERIKA.','CELADON GYM','TUNNEL'],
  ['CHALLENGE KOGA.','FUCHSIA GYM','ROUTE 12'],
  ['CHALLENGE\nSABRINA.','SAFFRON GYM','SILPH'],
  ['CHALLENGE\nBLAINE.','CINNABAR GYM','KEY'],
  ['CHALLENGE\nGIOVANNI.','VIRIDIAN GYM','RETURNED']
];
for(let mask=0;mask<256;mask++) {
  const alternate={...complete};
  badges.forEach((flag,i)=>alternate[flag]=(mask>>i)&1);
  const missing=badges.findIndex(flag=>alternate[flag]===0);
  expect(alternate,...(missing<0?['CHALLENGE\nLORELEI.','INDIGO PLATEAU','FIRST']:badgeGoals[missing]));
}
// Optional encounters, gifts and visited-town flags cannot restart the story.
const optional=[154,156,162,184,188,192,193,197,201,202,203,204,205,206,207,210,217,218,219,262,263];
for(const flag of optional)for(const value of [0,1,2]) {
  expect({...complete,[flag]:value},'CHALLENGE\nLORELEI.','INDIGO PLATEAU','FIRST');
}
for(const checkpoint of snapshots) {
  const before=run(checkpoint);
  for(const fossil of [0,1,2]) {
    assert.deepEqual(run({...checkpoint,154:fossil}),before,'optional fossil never blocks progress');checks++;
  }
}

const post={...complete,220:1,10:99};
expect(post,'SEEK MEWTWO.','CERULEAN CAVE','EAST');
Object.assign(post,{[own(150)]:1});expect(post,'SEEK ZAPDOS.','POWER PLANT','ROUTE 9');
Object.assign(post,{[own(145)]:1});expect(post,'MOVE THE\nSEAFOAM BOULDER.','SEAFOAM ISLANDS','STRENGTH');
Object.assign(post,{192:1});expect(post,'SEEK ARTICUNO.','SEAFOAM DEPTHS','CURRENT');
Object.assign(post,{[own(144)]:1});expect(post,'SEEK MOLTRES.','VICTORY SUMMIT','FIRE');
Object.assign(post,{[own(146)]:1});expect(post,'FIND NEW\nPOKEMON.','KANTO ROUTES','100');
Object.assign(post,{10:100});expect(post,'SEEK MEW.','OAKS RESERVE','WEST');
Object.assign(post,{[own(151)]:1});expect(post,'FIND THE MISSING\nPOKEMON.','KANTO','151');
Object.assign(post,{10:151});expect(post,'VISIT OAK.','PALLET LAB','RECORDED');
expect({...post,195:5,196:0},'VISIT OAK.','PALLET LAB','RECORDED');
for(const step of [0,1,2,3,4,5]) {
  expect({...post,10:100,195:step,248:0,12:0},'FIND THE MISSING\nPOKEMON.','KANTO','151');
}

const legendaryGoals=[
  ['SEEK MEWTWO.','CERULEAN CAVE','EAST'],
  ['SEEK ZAPDOS.','POWER PLANT','ROUTE 9'],
  ['SEEK ARTICUNO.','SEAFOAM DEPTHS','CURRENT'],
  ['SEEK MOLTRES.','VICTORY SUMMIT','FIRE']
];
for(let mask=0;mask<32;mask++)for(const count of [99,100,150,151]) {
  const alternate={...post,10:count,192:1};
  [150,145,144,146,151].forEach((dex,i)=>alternate[own(dex)]=(mask>>i)&1);
  const missing=[150,145,144,146].findIndex(dex=>alternate[own(dex)]===0);
  let goal;
  if(count>=151)goal=['VISIT OAK.','PALLET LAB','RECORDED'];
  else if(missing>=0)goal=legendaryGoals[missing];
  else if(alternate[own(151)]===1)goal=['FIND THE MISSING\nPOKEMON.','KANTO','151'];
  else if(count<100)goal=['FIND NEW\nPOKEMON.','KANTO ROUTES','100'];
  else goal=['SEEK MEW.','OAKS RESERVE','WEST'];
  expect(alternate,...goal);
}

for(const checkpoint of snapshots) {
  assert.deepEqual(run({...checkpoint,0:100,3:0,8:0,9:0,10:151,13:8,23:5,133:0,
    154:2,162:1,193:1,250:1,251:0,259:0,260:1}),run(checkpoint),
    'incidental party, menu, item and travel values do not change the story goal');
  checks++;
}

// These source reads detect drift without importing the writing game generator.
const design=readFileSync(new URL('../artwork/game-design.mjs',import.meta.url),'utf8');
const opening=readFileSync(new URL('../artwork/opening-story.mjs',import.meta.url),'utf8');
const campaign=readFileSync(new URL('../artwork/full-campaign.mjs',import.meta.url),'utf8');
const red=readFileSync(new URL('../artwork/red-progression.mjs',import.meta.url),'utf8');
for(const text of ['set(247,2),set(248,1)','set(247,1)','set(27,starter)'])assert.ok(opening.includes(text),text);
assert.ok(design.includes('variable:153,value:1'),'Mt Moon exit guard');
assert.ok(design.includes("IF(163,'==',3"),'Surge lock guard');
assert.ok(red.includes("IF(263,'==',1"),'Cerulean rival guard');
for(const text of ['guard(206,','guard(207,','guard(192,','guard(198,',
  'set(195,0)','set(220,1),set(196,1)','$187$ == 1 && $211$ == 1'])assert.ok(campaign.includes(text),text);
console.log('Story journal: '+checks+' stage/alternate checks passed; read-only native events, existing flags, and dialogue limits verified.');
