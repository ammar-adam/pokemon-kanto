// Bounded native-pixel presentation pass. Does not change world or actor geometry.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import {Canvas,text} from '../artwork/author-art.mjs';
import {decodeResourceBytes} from './resource-bytes.mjs';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'verification/visual-polish');
await mkdir(path.join(out,'before'),{recursive:true});await mkdir(path.join(out,'after'),{recursive:true});
const shades=['071821','306850','86c06c','e0f8cf','65ff00'];
const paths=['assets/backgrounds/campaign-title-complete.png','assets/backgrounds/opening-red_house.png','assets/backgrounds/opening-laboratory.png','assets/backgrounds/opening-fernvale-v2.png','assets/ui/frame.png','assets/ui/cursor.png','project/palettes/default_ui.gbsres','assets/backgrounds/campaign-title-complete.png.gbsres'];
for(const f of paths){const b=path.join(out,'before',path.basename(f));try{await readFile(b);}catch{await copyFile(path.join(root,f),b);}}
function decode(bytes){const png=PNG.sync.read(bytes),c=new Canvas(png.width,png.height);for(let i=0;i<c.p.length;i++){const s=[...png.data.subarray(i*4,i*4+3)].map(x=>x.toString(16).padStart(2,'0')).join('');const n=shades.indexOf(s);if(n<0)throw Error('Unexpected color '+s);c.p[i]=n;}return c;}
const load=async f=>decode(await readFile(path.join(root,f)));
const before=async name=>decode(await readFile(path.join(out,'before',name)));
const save=async(f,c)=>{await writeFile(path.join(root,f),c.png());await writeFile(path.join(out,'after',path.basename(f)),c.png());};
function tileKey(c,x,y){let s='';for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)s+=c.p[(y+yy)*c.w+x+xx];return s;}
function floorTile(){const c=new Canvas(8,8,3);c.line(0,0,7,0,2);c.line(0,0,0,7,2);return tileKey(c,0,0);}
// Interior negative space: house boards and larger, quieter lab floor tiles.
for(const [name,house] of [['opening-red_house',true],['opening-laboratory',false]]){
 const c=await before(name+'.png'),original=await before(name+'.png'),floor=floorTile();
 for(let y=24;y<c.h;y+=8)for(let x=0;x<c.w;x+=8)if(tileKey(original,x,y)===floor){
  c.rect(x,y,8,8,3);
  if(house){if(y%16===8)c.line(x,y+7,x+7,y+7,2);if((x+(Math.floor(y/16)%2)*16)%32===0)c.line(x,y,x,y+6,2);}
  else{if(y%16===8)c.line(x,y+7,x+7,y+7,2);if(x%16===0)c.line(x,y,x,y+7,2);}
 }
 // Same blocked three-tile north wall, now a coherent dado instead of little boxes.
 c.rect(0,0,160,24,3);c.rect(0,0,160,2,0);c.rect(0,2,160,4,1);c.line(0,6,159,6,2);c.rect(0,7,160,12,3);
 for(let x=8;x<160;x+=16)c.line(x,8,x,17,2);
 c.line(0,19,159,19,2);c.rect(0,20,160,2,1);c.line(0,22,159,22,0);c.line(0,23,159,23,2);
 // Existing bookcase cells retain the same footprint and gaps.
 for(const [tx,ty,tw] of (house?[[14,3,4]]:[[2,3,4],[14,3,4],[2,12,4],[14,12,4]])){
  const x=tx*8,y=ty*8,w=tw*8;c.rect(x,y,w,16,0);c.rect(x+1,y+1,w-2,13,1);c.line(x+1,y+1,x+w-2,y+1,3);
  for(let i=2;i<w-2;i+=4){const h=8+(i%3);c.rect(x+i,y+13-h,3,h,2);c.line(x+i,y+13-h,x+i,y+12,3);}
  c.line(x+1,y+14,x+w-2,y+14,2);
 }
 if(house)for(let y=27;y<43;y++)for(let x=103;x<127;x++)c.dot(x,y,original.p[y*original.w+x]);
 await save('assets/backgrounds/'+name+'.png',c);
}
// Pallet: less visual noise, stronger grass/path separation, and shingled roofs.
{
 const c=await before('opening-fernvale-v2.png'),o=await before('opening-fernvale-v2.png');
 const flat='3'.repeat(64);const pathTile=new Canvas(8,8,3);pathTile.dot(2,2,2);pathTile.dot(6,5,2);const pk=tileKey(pathTile,0,0);
 const lawnTile=new Canvas(8,8,3);lawnTile.dot(2,4,2);lawnTile.dot(3,3,2);const lk=tileKey(lawnTile,0,0);
 const meta=JSON.parse(await readFile(path.join(root,'assets/backgrounds/opening-fernvale-v2.png.gbsres'),'utf8'));const attrs=decodeResourceBytes(meta.tileColors,{maximumValues:32*26});
 for(let y=0;y<c.h;y+=8)for(let x=0;x<c.w;x+=8){const k=tileKey(o,x,y),slot=attrs[y/8*32+x/8]&7;
  if(slot===0&&(k===flat||k===lk)){c.rect(x,y,8,8,2);if((x/8+3*y/8)%7===0){c.line(x+2,y+5,x+3,y+4,3);c.dot(x+5,y+5,3);}}
  if(slot===1&&k===pk){c.rect(x,y,8,8,3);if((x/8+2*y/8)%4===0)c.line(x+3,y+4,x+4,y+4,2);}
 }
 for(const [tx,ty,tw] of [[4,4,8],[21,4,8],[18,15,12]]){
  const x=tx*8,y=ty*8,w=tw*8;c.rect(x,y,w,24,0);c.rect(x+1,y+1,w-2,20,2);c.line(x+2,y+1,x+w-3,y+1,3);
  for(let yy=6;yy<21;yy+=6){c.line(x+1,y+yy,x+w-2,y+yy,1);for(let xx=1+(yy%12?4:0);xx<w-1;xx+=8)c.line(x+xx,y+yy-4,x+xx,y+yy-1,1);}
  c.line(x+1,y+21,x+w-2,y+21,1);c.line(x+2,y+22,x+w-3,y+22,2);
 }
 await save('assets/backgrounds/opening-fernvale-v2.png',c);
}
// Familiar three-starter title art, entirely from the project's retained sprite pixels.
{
 const c=new Canvas(160,144,3);c.rect(0,0,160,5,0);c.line(0,5,159,5,2);c.line(0,111,159,111,0);
 // Three-pixel block lettering with a deliberate outline and offset shadow.
 for(const [dx,dy] of [[2,2],[-1,0],[1,0],[0,-1],[0,1]])text(c,'POKEMON',18+dx,14+dy,0,3);
 text(c,'POKEMON',18,14,2,3);
 // Accent over the E, retaining the font's native pixel grid.
 c.line(75,8,78,6,0);c.line(75,9,78,7,0);
 text(c,'KANTO',65,43,0);c.line(16,48,51,48,1);c.line(109,48,143,48,1);
 for(const [key,x] of [['bulbasaur',16],['charmander',64],['squirtle',112]]){
  const s=await load('assets/sprites/kanto-'+key+'-centered.png');c.rect(x,56,32,48,3);c.line(x+2,101,x+29,101,1);c.line(x+5,102,x+26,102,2);
  for(let y=0;y<32;y++)for(let xx=0;xx<32;xx++){const v=s.p[y*s.w+xx];if(v!==4)c.dot(x+xx,64+y,v);}
 }
 text(c,'CHAMPION QUEST',39,104,0);
 await save('assets/backgrounds/campaign-title-complete.png',c);
 const file=path.join(root,'assets/backgrounds/campaign-title-complete.png.gbsres'),meta=JSON.parse(await readFile(file,'utf8'));
 const a=decodeResourceBytes(meta.tileColors,{maximumValues:360});
 // Only the three title portrait bands change palette assignment. Slot 7 is untouched.
 for(const [tx,slot] of [[2,0],[8,2],[14,3]])for(let y=7;y<=12;y++)for(let x=tx;x<tx+4;x++)a[y*20+x]=(a[y*20+x]&0xf8)|slot;
 let encoded='';for(let i=0;i<a.length;){let j=i+1;while(j<a.length&&a[j]===a[i])j++;encoded+=a[i].toString(16).padStart(2,'0')+(j-i===1?'!':(j-i).toString(16)+'+');i=j;}meta.tileColors=encoded;
 await writeFile(file,JSON.stringify(meta,null,2)+'\n');await copyFile(file,path.join(out,'after',path.basename(file)));
}
// Nine-slice native frame: ivory interior, dark double-rule border, unaltered text area.
{
 const c=new Canvas(24,24,3);c.rect(1,1,22,22,0);c.rect(2,2,20,20,3);c.rect(3,3,18,18,0);c.rect(4,4,16,16,3);
 for(const [x,y] of [[1,1],[22,1],[1,22],[22,22]])c.dot(x,y,3);
 await save('assets/ui/frame.png',c);
 const cursor=new Canvas(8,8,3);for(let y=1;y<7;y++)for(let x=1;x<=Math.min(y,7-y);x++)cursor.dot(x,y,0);await save('assets/ui/cursor.png',cursor);
 const file=path.join(root,'project/palettes/default_ui.gbsres'),p=JSON.parse(await readFile(file,'utf8'));p.colors=['F8F8F0','C0D0D8','607888','182838'];await writeFile(file,JSON.stringify(p,null,2)+'\n');await copyFile(file,path.join(out,'after',path.basename(file)));
}
console.log('Bounded title, opening rooms/Pallet, frame and UI palette pass saved. Runtime validation required.');
