import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {alignEncounterTerrain} from '../artwork/native-terrain.mjs';
import {decodeResourceBytes} from './resource-bytes.mjs';
const root=path.resolve(import.meta.dirname,'..');
const plan=JSON.parse(fs.readFileSync(path.join(root,'artwork/game-plan.json')));
const ids=JSON.parse(fs.readFileSync(path.join(root,'artwork/pokemon-resource-ids.json')));
const aligned=structuredClone(plan);alignEncounterTerrain(aligned,ids,root);
for(const o of [...aligned.actors,...aligned.triggers]){
 const current=[...plan.actors,...plan.triggers].find(x=>x.id===o.id);
 assert.deepEqual([current.x,current.y,current.width,current.height],[o.x,o.y,o.width,o.height],'authored terrain '+o.name);
}
const targets=[['forest',18,19],['forest',22,7],['mt_moon',19,23],['nugget_bridge',16,22]];
for(const [scene,x,y] of targets){
 const dir=path.join(root,'project/scenes',scene);
 const s=JSON.parse(fs.readFileSync(path.join(dir,'scene.gbsres')));
 const grid=decodeResourceBytes(s.collisions,{maximumValues:s.width*s.height});
 const clear=(x,y)=>x>=0&&x+1<s.width&&y>=1&&y<s.height&&[y-1,y].every(yy=>[x,x+1].every(xx=>!grid[yy*s.width+xx]));
 const actors=fs.readdirSync(path.join(dir,'actors')).map(n=>JSON.parse(fs.readFileSync(path.join(dir,'actors',n))));
 assert.ok(actors.some(a=>a.x===x&&a.y===y&&a.script?.length),'native interactive trainer '+scene);
 assert.ok(clear(x,y),'clear trainer body '+scene);
 assert.ok([[-2,0],[2,0],[0,-2],[0,2]].some(([dx,dy])=>clear(x+dx,y+dy)),'clear interaction approach '+scene);
}
let checked=0;
for(const key of fs.readdirSync(path.join(root,'project/scenes'))){
 const dir=path.join(root,'project/scenes',key,'triggers');if(!fs.existsSync(dir))continue;
 for(const name of fs.readdirSync(dir)){
  const native=JSON.parse(fs.readFileSync(path.join(dir,name)));
  if(!/^(wild |grass )/.test(native.name))continue;
  const authored=plan.triggers.find(t=>t.id===native.id);assert.ok(authored);
  assert.deepEqual([native.x,native.y,native.width,native.height],[authored.x,authored.y,authored.width,authored.height],'native encounter mask '+native.name);checked++;
 }
}
console.log('Terrain regressions passed: '+checked+' native encounter rectangles match the artwork-aligned plan; four trainers have clear body and interaction footing. Runtime movement remains separate.');
