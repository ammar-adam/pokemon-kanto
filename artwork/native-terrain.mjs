import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';
import {decodeResourceBytes} from '../scripts/resource-bytes.mjs';
import {world} from './campaign-world.mjs';

// Use the current authored pixels and collisions, preserving all event/owner IDs.
export function alignEncounterTerrain(plan,ids,root) {
 const backgrounds=new Map();
 for(const name of fs.readdirSync(path.join(root,'assets/backgrounds')))if(name.endsWith('.gbsres')){
  const r=JSON.parse(fs.readFileSync(path.join(root,'assets/backgrounds',name)));backgrounds.set(r.id,name.slice(0,-7));
 }
 const moves=[['forest',20,19,18,19],['forest',22,8,22,7],['mt_moon',20,23,19,23],['nugget_bridge',18,22,16,22]];
 for(const [key,x,y,nx,ny] of moves){const a=plan.actors.find(a=>a.sceneId===ids.scenes[key]&&a.x===x&&a.y===y);if(a){a.x=nx;a.y=ny;}}
 for(const spec of world.filter(s=>['route','forest','bridge'].includes(s.kind)&&!['route_nineteen','route_twenty_one'].includes(s.key))){
  const s=JSON.parse(fs.readFileSync(path.join(root,'project/scenes',spec.key,'scene.gbsres')));
  const collision=decodeResourceBytes(s.collisions,{maximumValues:s.width*s.height});
  const image=PNG.sync.read(fs.readFileSync(path.join(root,'assets/backgrounds',backgrounds.get(s.backgroundId))));
  const tile=(x,y)=>{const bytes=[];for(let dy=0;dy<8;dy++)for(let dx=0;dx<8;dx++){const at=((y*8+dy)*image.width+x*8+dx)*4;bytes.push(...image.data.subarray(at,at+4));}return bytes.join(',');};
  const grass=tile(...(spec.kind==='bridge'?[3,25]:[4,5]));
  for(const t of plan.triggers.filter(t=>t.sceneId===s.id&&/^(wild |grass )/.test(t.name))){
   if(spec.kind==='bridge'){
    const match=t.name.match(/^wild \S+ ([0-3]) ([02])$/);if(!match)throw new Error('Unknown bridge trigger '+t.name);
    const patch=Number(match[1]);t.x=[3,7,20,24][patch];t.y=25+Number(match[2]);t.width=4;
   }
   if(spec.key==='route_one'&&/^grass [23] (15|17|19)$/.test(t.name))t.y=Number(t.name.split(' ').at(-1))+4;
   let best=[];
   for(let y=t.y;y<t.y+t.height;y++){
    let run=[];for(let x=t.x;x<=t.x+t.width;x++){
     if(x<t.x+t.width&&tile(x,y)===grass&&!collision[y*s.width+x])run.push(x);
     else{if(run.length>best.length)best=run.map(x=>[x,y]);run=[];}
    }
   }
   if(!best.length)throw new Error('No grass footing for '+t.name);
   t.x=best[0][0];t.y=best[0][1];t.width=best.length;t.height=1;
  }
 }
}
