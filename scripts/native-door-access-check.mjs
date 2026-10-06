import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {decodeResourceBytes} from './resource-bytes.mjs';

const root=path.resolve(import.meta.dirname,'..');
const resources=[];
const nativeTransitions=[];
const neededScenes=new Set(['viridian','nugget_bridge','route_twelve','celadon','rocket_hideout','lavender','vermilion','ss_anne']);
const allNativeTriggers=[];
const sceneDirectories=new Map();
async function readResources(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()) await readResources(file);
    else if(entry.name.endsWith('.gbsres')) {
      const data=JSON.parse(await readFile(file,'utf8'));
      nativeTransitions.push(...transitions(data).map(t=>({...t,source:file})));
      if(data._resourceType==='scene') sceneDirectories.set(data.id,path.dirname(file));
      if(data._resourceType==='trigger'&&transitions(data).length) {
        allNativeTriggers.push({file,data:Object.fromEntries(['id','name','x','y','width','height'].map(key=>[key,data[key]]))});
      }
      const parts=path.relative(root,file).split(path.sep);
      // Keep geometry/target scenes only; shared-script event trees need not
      // remain resident just to collect their tiny transition arguments.
      if(data._resourceType==='sprite') {
        const geometry=Object.fromEntries(['_resourceType','id','boundsX','boundsY','boundsWidth','boundsHeight'].map(key=>[key,data[key]]));
        resources.push({file,data:geometry});
      } else if(data._resourceType==='settings'||(parts[0]==='project'&&parts[1]==='scenes'&&neededScenes.has(parts[2]))) resources.push({file,data});
    }
  }
}
await readResources(path.join(root,'project'));
await readResources(path.join(root,'assets'));
const sprites=new Map(resources.filter(r=>r.data._resourceType==='sprite').map(r=>[r.data.id,r.data]));
const settings=resources.find(r=>r.data._resourceType==='settings').data;
const player=sprites.get(settings.defaultPlayerSprites.TOPDOWN);

// GB Studio 4.3.2 generateGBVMData.ts and GBVM topdown.c/actor.c use
// sprite collision rectangles, not actor-origin points. Right/bottom are
// inclusive. CollisionGroup NONE still collides; pinned actors do not.
function box(sprite,x,y) {
  const left=x*8+(sprite.boundsX||0),top=y*8+(sprite.boundsY||0);
  return {left,top,right:left+(sprite.boundsWidth||16)-1,bottom:top+(sprite.boundsHeight||16)-1};
}
const intersects=(a,b)=>a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top;
const triggerBox=t=>({left:t.x*8,top:t.y*8,right:(t.x+t.width)*8-1,bottom:(t.y+t.height)*8-1});
function transitions(value,result=[]) {
  if(Array.isArray(value)) value.forEach(v=>transitions(v,result));
  else if(value&&typeof value==='object') {
    if(value.command==='EVENT_SWITCH_SCENE') result.push(value.args);
    Object.values(value).forEach(v=>transitions(v,result));
  }
  return result;
}
function reachable(scene,actors,start,stops=[]) {
  const collision=decodeResourceBytes(scene.collisions,{maximumValues:scene.width*scene.height});
  const obstacles=actors.filter(a=>!a.isPinned&&!a.disabled).map(a=>box(sprites.get(a.spriteSheetId),a.x,a.y));
  const blocked=(x,y,mask)=>x<0||y<0||x>=scene.width||y>=scene.height||Boolean(collision[y*scene.width+x]&mask);
  function canStep(x,y,dx,dy) {
    const b=box(player,x,y),left=Math.floor(b.left/8),right=Math.floor(b.right/8),top=Math.floor(b.top/8),bottom=Math.floor(b.bottom/8);
    // Match topdown.c: query the immediately adjacent edge, with the
    // opposing directional collision bit, before translating one 8px tile.
    if(dx) {
      for(let y=top;y<=bottom;y++) if(blocked(dx<0?left-1:right+1,y,dx<0?8:4)) return false;
    } else {
      for(let x=left;x<=right;x++) if(blocked(x,dy<0?top-1:bottom+1,dy<0?2:1)) return false;
    }
    const destination=box(player,x+dx,y+dy);
    return !obstacles.some(actor=>intersects(destination,actor));
  }
  const queue=[start],seen=new Set([start.join(',')]);
  for(let i=0;i<queue.length;i++) {
    const [x,y]=queue[i];
    // A scene-changing trigger ends this path; do not walk through it in
    // the search and invent an impossible route behind an automatic exit.
    if(i>0&&stops.some(t=>intersects(box(player,x,y),triggerBox(t)))) continue;
    for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const next=[x+dx,y+dy],key=next.join(',');
      if(!seen.has(key)&&canStep(x,y,dx,dy)) {seen.add(key);queue.push(next);}
    }
  }
  return queue;
}

const room=path.join(root,'project/scenes/viridian');
const scene=resources.find(r=>r.file===path.join(room,'scene.gbsres')).data;
const actors=resources.filter(r=>path.dirname(r.file)===path.join(room,'actors')).map(r=>r.data);
const doors=resources.filter(r=>path.dirname(r.file)===path.join(room,'triggers')&&r.data.name.startsWith('enter ')).map(r=>r.data);
const arrivals=[...new Map(nativeTransitions
  .filter(t=>t.sceneId===scene.id&&t.x.type==='number'&&t.y.type==='number')
  .map(t=>[[t.x.value,t.y.value].join(','),[t.x.value,t.y.value]])).values()];
assert.ok(arrivals.some(([x,y])=>x===15&&y===23),'Include the normal arrival from Route One');
assert.equal(doors.length,3,'Check Center, Mart, and Gym native door triggers');
const customer=actors.find(a=>a.name==='Shop Customer');
assert.ok(customer,'Find the actual native Shop Customer');
const originalActors=actors.map(a=>a.id===customer.id?{...a,x:25,y:23}:a);
const mart=doors.find(t=>t.name==='enter opening mart');
assert.ok(!reachable(scene,originalActors,[15,23]).some(([x,y])=>intersects(box(player,x,y),triggerBox(mart))),
  'Regression fixture: the original customer footprint blocks Mart access');
const customerBounds=box(sprites.get(customer.spriteSheetId),25,23);
assert.deepEqual(customerBounds,{left:200,top:176,right:215,bottom:191});
assert.ok(intersects(box(player,24,22),customerBounds),'Original customer blocks the two-tile doorway approach');
assert.ok(!intersects(box(player,23,22),customerBounds),'Adjacent boxes do not overlap');
let checked=0;
for(const arrival of arrivals) {
  const positions=reachable(scene,actors,arrival);
  for(const door of doors) {
    assert.ok(positions.some(([x,y])=>intersects(box(player,x,y),triggerBox(door))),
      `${scene.name}: ${door.name} unreachable from native arrival (${arrival.join(',')}) with actor footprints`);
    checked++;
  }
}
console.log(`${checked} native Viridian arrival/door routes pass using GBVM directional tile collisions and actor footprints; original Mart blocker fixture rejected. Geometry only, not runtime or quest-gate verification.`);

// Execute only the bounded native scene-init events responsible for moving
// or deactivating these route blockers. This models fresh/revisited scenes;
// it does not pretend to execute a ROM, battle, or SRAM load.
function initializedActors(scene,actors,variables) {
  const state=structuredClone(actors);
  function run(events) {
    for(const event of events) {
      const args=event.args||{};
      if(event.command==='EVENT_IF') {
        const condition=args.condition;
        assert.equal(condition.type,'eq');
        assert.equal(condition.valueA.type,'variable');
        assert.equal(condition.valueB.type,'number');
        run(event.children[(variables[condition.valueA.value]||0)===condition.valueB.value?'true':'false']||[]);
      } else if(event.command==='EVENT_ACTOR_SET_POSITION') {
        const actor=state.find(a=>a.id===args.actorId);
        assert.ok(actor);assert.equal(args.units,'tiles');
        assert.equal(args.x.type,'number');assert.equal(args.y.type,'number');
        actor.x=args.x.value;actor.y=args.y.value;
      } else if(event.command==='EVENT_ACTOR_DEACTIVATE') {
        const actor=state.find(a=>a.id===args.actorId);assert.ok(actor);actor.disabled=true;
      } else if(event.command==='EVENT_ACTOR_HIDE') {
        const actor=state.find(a=>a.id===args.actorId);if(actor) actor.hidden=true;
      }
    }
  }
  run(scene.script);
  return state;
}
function route(key) {
  const directory=path.join(root,'project/scenes',key);
  return {
    scene:resources.find(r=>r.file===path.join(directory,'scene.gbsres')).data,
    actors:resources.filter(r=>path.dirname(r.file)===path.join(directory,'actors')).map(r=>r.data),
    triggers:resources.filter(r=>path.dirname(r.file)===path.join(directory,'triggers')).map(r=>r.data)
  };
}
const bridge=route('nugget_bridge'),twelve=route('route_twelve');
function canReachDoor(route,flags,start,name) {
  const actors=initializedActors(route.scene,route.actors,flags);
  const again=initializedActors(route.scene,route.actors,flags);
  assert.deepEqual(again,actors,'Revisiting with the same saved flags restores the same blocker state');
  const target=route.triggers.find(t=>t.name===name);assert.ok(target);
  return reachable(route.scene,actors,start).some(([x,y])=>intersects(box(player,x,y),triggerBox(target)));
}
assert.ok(!canReachDoor(bridge,{},[15,28],'north bill house'),'Undefeated Bridge Rocket still blocks progression');
assert.ok(canReachDoor(bridge,{155:1},[15,28],'north bill house'),'Defeated Bridge Rocket leaves a two-tile passage');
assert.ok(canReachDoor(bridge,{155:1},[15,3],'south cerulean'),'Bridge return route remains open after victory');
const billGate=bridge.triggers.find(t=>t.name==='north bill house').script[0].args.condition;
assert.deepEqual(billGate,{type:'eq',valueA:{type:'variable',value:'155'},valueB:{type:'number',value:1}},'Bill still requires the Rocket victory flag');
assert.ok(!canReachDoor(twelve,{},[15,3],'south fuchsia'),'Unresolved encounters remain blocking');
assert.ok(!canReachDoor(twelve,{1740:1},[15,3],'south fuchsia'),'Capturing Snorlax does not bypass the Fisherman challenge');
assert.ok(!canReachDoor(twelve,{240:1},[15,3],'south fuchsia'),'Defeating Fisherman does not bypass uncaught Snorlax');
assert.ok(canReachDoor(twelve,{1740:1,240:1},[15,3],'south fuchsia'),'Captured Snorlax and defeated Fisherman clear the south route');
assert.ok(canReachDoor(twelve,{1740:1,240:1},[15,28],'route twelve north lavender'),'Resolved Route Twelve is passable northward');
const captured=initializedActors(twelve.scene,twelve.actors,{1740:1,240:1});
assert.equal(captured.find(a=>a.name==='Snorlax').disabled,true,'Deactivate captured Snorlax; merely hiding would retain collision');
const onlyHidden=twelve.actors.map(a=>a.name==='Snorlax'?{...a,hidden:true}:a.name==='Fisherman'?{...a,x:14}:a);
assert.ok(!reachable(twelve.scene,onlyHidden,[15,3]).some(([x,y])=>y>=30),'Hidden actors still collide in the pinned GBVM');
const lavender=route('lavender');
const fluteGate=lavender.triggers.find(t=>t.name==='west route twelve').script[0].args.condition;
assert.deepEqual(fluteGate,{type:'eq',valueA:{type:'variable',value:'185'},valueB:{type:'number',value:1}},'Lavender approach still requires the Poke Flute');
console.log('Bridge flag155, Snorlax owned1740, and Fisherman flag240 block/clear the native corridors correctly; conditional scene-init/revisit and existing Bill/Flute gates checked. Capture-only Snorlax clearance; runtime save/reload remains unverified.');

const celadon=route('celadon');
const celadonStops=celadon.triggers.filter(t=>transitions(t).length);
// Retain the exact native preimage so this narrowly approved fix cannot
// silently clear any other Celadon collision tile.
const originalCeladon='0fe+004+0f1c+004+0f1c+004+0f10+001c+0f4+001c+0f4+001c+0f4+002+0f8+009+0f8+00!0f4+002+0f8+009+0f8+00!0f4+002+0f8+009+0f8+00!0f4+002+0f8+009+0f8+00!0f4+002+0f8+009+0f8+00!0f4+002+0f8+009+0f8+00!0f4+002+0f3+002+0f3+009+0f3+002+0f3+00!0f4+001c+0f4+001c+0f2+0060+0f2+001c+0fe+0012+0fe+0012+0fe+0012+0fe+0012+0f10+004+0f14+002+0f6+004+0f1c+004+0fe+';
const cellCount=celadon.scene.width*celadon.scene.height;
const before=decodeResourceBytes(originalCeladon,{maximumValues:cellCount});
const expected=before.slice();
for(const [x,y] of [[6,23],[7,23],[12,23],[13,23],...Array.from({length:10},(_,i)=>[i+6,24])]) expected[y*celadon.scene.width+x]=0;
const actual=decodeResourceBytes(celadon.scene.collisions,{maximumValues:cellCount});
assert.deepEqual(actual,expected,'Only the visible Game Corner doorway and its pale front sidewalk are opened');
assert.equal(before.filter((v,i)=>v!==actual[i]).length,10,'Exactly ten blocked cells change, including the two-cell connector around the Route Eight exit');
const gameCorner=celadon.triggers.find(t=>t.name==='rocket hideout');
assert.deepEqual([gameCorner.x,gameCorner.y,gameCorner.width,gameCorner.height],[6,23,2,1],'Keep the entrance on the visible door at pixels48..63,184..191');
const originalScene={...celadon.scene,collisions:originalCeladon};
assert.ok(!reachable(originalScene,celadon.actors,[15,23]).some(([x,y])=>intersects(box(player,x,y),triggerBox(gameCorner))),
  'Original native collision preimage makes the visible entrance unreachable');
const hideout=route('rocket_hideout');
const exit=transitions(hideout.triggers.find(t=>t.name==='leave hideout'))[0];
assert.equal(exit.sceneId,celadon.scene.id);
assert.deepEqual([exit.x.value,exit.y.value,exit.direction],[6,24,'down'],'Return immediately outside the same visible doorway');
const landing=box(player,exit.x.value,exit.y.value);
assert.ok(!celadon.triggers.some(t=>intersects(landing,triggerBox(t))),'Returning does not immediately activate another trigger');
assert.ok(!celadon.actors.some(a=>!a.isPinned&&intersects(landing,box(sprites.get(a.spriteSheetId),a.x,a.y))),'No actor overlaps the return landing');
for(let y=Math.floor(landing.top/8);y<=Math.floor(landing.bottom/8);y++) {
  for(let x=Math.floor(landing.left/8);x<=Math.floor(landing.right/8);x++) assert.equal(actual[y*celadon.scene.width+x],0,'Return landing has clear two-tile footing');
}
const celadonArrivals=[...new Map(nativeTransitions
  .filter(t=>t.sceneId===celadon.scene.id&&t.x.type==='number'&&t.y.type==='number')
  .map(t=>[[t.x.value,t.y.value].join(','),[t.x.value,t.y.value]])).values()];
for(const start of celadonArrivals) {
  const positions=reachable(celadon.scene,celadon.actors,start,celadonStops);
  assert.ok(positions.some(([x,y])=>intersects(box(player,x,y),triggerBox(gameCorner))),`Game Corner is reachable from (${start})`);
}
assert.ok(reachable(celadon.scene,celadon.actors,[6,24],celadonStops).some(([x,y])=>x===15&&y===22),'Doorstep connects back to the central street without falling into the Route Eight exit');
const withoutConnector=actual.slice();withoutConnector[23*celadon.scene.width+12]=15;withoutConnector[23*celadon.scene.width+13]=15;
function encode(values) {
  let result='';
  for(let start=0;start<values.length;) {
    let end=start+1;while(end<values.length&&values[end]===values[start])end++;
    result+=values[start].toString(16).padStart(2,'0')+(end-start===1?'!':(end-start).toString(16)+'+');start=end;
  }
  return result;
}
assert.ok(!reachable({...celadon.scene,collisions:encode(withoutConnector)},celadon.actors,[15,23],celadonStops)
  .some(([x,y])=>intersects(box(player,x,y),triggerBox(gameCorner))),'Opening only the front sidewalk is insufficient because the automatic Route Eight exit intercepts the approach');
console.log(`Celadon exact ten-cell collision preimage regression, ${celadonArrivals.length} trigger-aware native arrival/door routes, and aligned trigger-free return landing passed. Artwork and visible entrance unchanged.`);

const vermilion=route('vermilion'),ship=route('ss_anne');
const shipReturn=transitions(ship.triggers.find(t=>t.name==='leave ss anne'))[0];
assert.deepEqual([shipReturn.sceneId,shipReturn.x.value,shipReturn.y.value,shipReturn.direction],
  [vermilion.scene.id,21,20,'down'],'Return west along the same pier, outside the boarding trigger');
const board=vermilion.triggers.find(t=>t.name==='board ss anne');
assert.deepEqual([board.x,board.y,board.width,board.height],[23,19,4,2]);
assert.ok(intersects(box(player,24,20),triggerBox(board)),'Original return overlapped automatic boarding');
const safeShipLanding=box(player,21,20);
assert.ok(!vermilion.triggers.some(t=>intersects(safeShipLanding,triggerBox(t))),'Safe return does not immediately re-board');
assert.ok(!vermilion.actors.some(a=>!a.isPinned&&intersects(safeShipLanding,box(sprites.get(a.spriteSheetId),a.x,a.y))),'No NPC occupies the safe pier landing');
const vermilionTiles=decodeResourceBytes(vermilion.scene.collisions,{maximumValues:vermilion.scene.width*vermilion.scene.height});
for(const x of [21,22]) assert.equal(vermilionTiles[20*vermilion.scene.width+x],0,'Both player-foot tiles are clear pier');
const vermilionStops=vermilion.triggers.filter(t=>transitions(t).length);
assert.ok(reachable(vermilion.scene,vermilion.actors,[21,20],vermilionStops).some(([x,y])=>x===15&&y===16),'Pier return reaches town without activating boarding');
const ticketGate=board.script[0].args.condition;
assert.deepEqual(ticketGate,{type:'eq',valueA:{type:'variable',value:'157'},valueB:{type:'number',value:1}},'Boarding still requires the ticket');
console.log('S.S. Anne return has two clear pier-foot tiles, no NPC/trigger overlap, and a trigger-aware path into town; ticket157 gate unchanged.');

// Small global landing-only audit, without retaining shared scripts or
// running all-scene path searches: catch forced immediate re-entry loops.
const arrivalOverlaps=[];
for(const transition of nativeTransitions) {
  if(transition.x.type!=='number'||transition.y.type!=='number') continue;
  const directory=sceneDirectories.get(transition.sceneId);
  if(!directory) continue;
  const footprint=box(player,transition.x.value,transition.y.value);
  for(const {file,data:trigger} of allNativeTriggers) {
    if(path.dirname(file)!==path.join(directory,'triggers')||trigger.name.startsWith('wild ')||trigger.name.startsWith('grass ')) continue;
    if(intersects(footprint,triggerBox(trigger))) arrivalOverlaps.push({
      from:path.relative(root,transition.source),scene:path.basename(directory),arrival:[transition.x.value,transition.y.value],trigger:trigger.name
    });
  }
}
assert.deepEqual(arrivalOverlaps,[],'Native arrivals must not overlap automatic scene-changing door/exit triggers');
console.log(`${nativeTransitions.length} authored native transitions checked for automatic door/exit overlap at their arrival; none found. Conditional quest eligibility and actual runtime remain separate.`);
