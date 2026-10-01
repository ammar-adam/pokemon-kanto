import { readFile,readdir } from 'node:fs/promises';
import path from 'node:path';
const sceneId=process.argv[2];
const root=path.resolve(import.meta.dirname,'..');
const plan=JSON.parse(await readFile(path.join(root,'artwork/game-plan.json'),'utf8'));
const known=new Set();
const byId=new Map();
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(full.endsWith('.gbsres')){const resource=JSON.parse(await readFile(full,'utf8'));if(resource.id){known.add(resource.id);byId.set(resource.id,resource);}}}}
await walk(path.join(root,'project'));
const operationsFor=sceneId=>[
  ...plan.actors.filter(a=>a.sceneId===sceneId&&!known.has(a.id)).map(a=>({type:'actor.create',id:a.id,name:a.name,spriteSheetId:a.spriteSheetId,x:a.x,y:a.y,direction:a.direction,properties:a.properties})),
  ...plan.actors.filter(a=>a.sceneId===sceneId&&known.has(a.id)&&byId.get(a.id).spriteSheetId!==a.spriteSheetId).map(a=>({type:'actor.update',actorId:a.id,spriteSheetId:a.spriteSheetId})),
  ...plan.triggers.filter(t=>t.sceneId===sceneId&&!known.has(t.id)).map(t=>({type:'trigger.create',id:t.id,name:t.name,x:t.x,y:t.y,width:t.width,height:t.height}))
];
console.log(JSON.stringify(sceneId==='all'?[...new Set([...plan.actors,...plan.triggers].map(o=>o.sceneId))].map(id=>({sceneId:id,operations:operationsFor(id)})).filter(g=>g.operations.length):operationsFor(sceneId)));
