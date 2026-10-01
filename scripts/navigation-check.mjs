import { readFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import { decodeResourceBytes } from './resource-bytes.mjs';
const root=path.resolve(import.meta.dirname,'..');
const plan=JSON.parse(await readFile(path.join(root,'artwork/game-plan.json'),'utf8'));
const scenes=new Map();
const entrances=new Map();
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else if(item.name==='scene.gbsres'){const s=JSON.parse(await readFile(file,'utf8'));scenes.set(s.id,s);}}}
await walk(path.join(root,'project/scenes'));
const errors=[];
function inspect(events,source){for(const event of events){if(event.command==='EVENT_SWITCH_SCENE'){
  const s=scenes.get(event.args.sceneId),x=event.args.x.value,y=event.args.y.value;
  if(!s){errors.push(`${source}: unknown scene`);continue;}
  const b=decodeResourceBytes(s.collisions,{maximumValues:s.width*s.height});
  if(x<0||y<0||x+1>=s.width||y>=s.height||b[y*s.width+x]||b[y*s.width+x+1])errors.push(`${source} -> ${s.name} (${x},${y}) blocked`);
  const arrivals=entrances.get(s.id)||[];arrivals.push([x,y]);entrances.set(s.id,arrivals);
}for(const child of Object.values(event.children||{}))inspect(child,source);}}
for(const script of plan.scripts)inspect(script.events,scenes.get(script.target.sceneId)?.name||script.target.sceneId);
for(const script of plan.customScripts||[])inspect(script.script,script.name);
for(const scene of scenes.values()){
  const arrivals=entrances.get(scene.id)||[];
  if(!arrivals.length)continue;
  const blocked=decodeResourceBytes(scene.collisions,{maximumValues:scene.width*scene.height}),seen=new Set(),queue=[...arrivals];
  for(let at=0;at<queue.length;at++){
    const [x,y]=queue[at],key=`${x},${y}`;
    if(seen.has(key)||x<0||y<0||x+1>=scene.width||y>=scene.height||blocked[y*scene.width+x]||blocked[y*scene.width+x+1])continue;
    seen.add(key);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,y+dy]);
  }
  for(const t of plan.triggers.filter(t=>t.sceneId===scene.id)){
    let reachable=false;
    for(let y=t.y;y<t.y+t.height;y++)for(let x=t.x;x<t.x+t.width;x++)if(seen.has(`${x},${y}`))reachable=true;
    if(!reachable)errors.push(`${scene.name}: trigger ${t.name} unreachable from any arrival`);
  }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('All authored scene transitions land on clear two-tile footing.');
