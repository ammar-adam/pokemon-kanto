import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {MapArt,text,uuid} from './author-art.mjs';
const root=path.resolve(import.meta.dirname,'..');
const ids=JSON.parse(await readFile(path.join(root,'artwork/pokemon-resource-ids.json'),'utf8'));
const out=path.join(root,'artwork/opening-imports');await mkdir(out,{recursive:true});
class Opening extends MapArt{
  lawn(){this.area(0,0,this.w,this.h,'lawn',0);for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){this.c.rect(x*8,y*8,8,8,3);if((x+3*y)%11===0){this.c.dot(x*8+2,y*8+4,2);this.c.dot(x*8+3,y*8+3,2);}}}
  border(){for(let y=0;y<this.h;y+=3){this.tree(0,y);this.tree(this.w-2,y);}for(let x=2;x<this.w-2;x+=2){this.tree(x,0);this.tree(x,this.h-3);}}
  path(x,y,w,h){this.area(x,y,w,h,'path',1,0);}
  roofHouse(x,y,w,h,slot=2){const door=this.house(x,y,w,h,'');this.paint(x,y,w,3,slot,15);return door;}
  sign(x,y){this.c.rect(x*8+1,y*8,14,10,0);this.c.rect(x*8+2,y*8+1,12,7,3);this.c.line(x*8+4,y*8+3,x*8+11,y*8+3,1);this.c.rect(x*8+6,y*8+10,4,5,1);this.paint(x,y,2,2,1,15);}
  shelf(x,y,w=4){this.area(x,y,w,2,'stone',5,15);for(let i=0;i<w;i++){this.c.rect((x+i)*8+1,y*8+2,6,11,2);this.c.line((x+i)*8+3,y*8+3,(x+i)*8+3,y*8+11,0);}this.c.line(x*8,y*8+15,(x+w)*8-1,y*8+15,0);}
  desk(x,y,w=4){this.area(x,y,w,2,'floor',2,15);this.c.rect(x*8,y*8,w*8,2,0);this.c.rect(x*8,y*8+13,w*8,3,1);}
  pc(x,y){this.desk(x,y,2);this.c.rect(x*8+1,y*8-7,14,11,0);this.c.rect(x*8+3,y*8-5,10,7,2);this.c.line(x*8+5,y*8-3,x*8+10,y*8-3,3);}
  rug(x,y,w,h){this.area(x,y,w,h,'floor',2,0);this.c.rect(x*8+2,y*8+2,w*8-4,h*8-4,2);this.c.rect(x*8+4,y*8+4,w*8-8,h*8-8,3);}
}
function interior(){const m=new Opening(20,18,'floor',1);m.edges();m.area(0,0,20,3,'stone',5,15);m.path(8,16,4,2);return m;}
const maps={};
{
 const m=new Opening(32,26);m.lawn();m.border();m.path(14,0,4,26);m.path(2,11,28,3);m.path(0,15,18,3);m.path(3,22,27,2);
 m.roofHouse(20,4,10,7,5);m.roofHouse(4,15,8,7,2);m.roofHouse(21,15,8,7,3);
 m.area(3,4,8,5,'water',3,15);m.area(3,9,8,1,'flower',4,0);m.sign(11,19);
 m.c.rect(176,34,32,9,3);text(m.c,'GYM',181,35);m.c.rect(40,122,32,9,3);text(m.c,'P C',45,123);m.c.rect(176,122,32,9,3);text(m.c,'MART',177,123);maps.viridian=m;
}
{
 const m=new Opening(32,26);m.lawn();m.border();m.path(14,0,4,26);m.path(4,11,24,3);m.path(7,10,2,4);m.path(24,10,2,4);m.path(14,20,11,4);
 m.roofHouse(4,4,8,7,2);m.roofHouse(21,4,8,7,3);m.roofHouse(18,15,12,8,5);m.path(23,22,2,2);
 m.area(2,20,9,6,'water',3,15);m.area(3,16,8,2,'flower',4,0);m.area(19,12,10,1,'flower',4,0);
 m.sign(4,13);m.sign(19,13);m.path(0,15,3,3);m.path(14,23,14,2);m.path(14,24,4,2);maps.fernvale=m;
}
{
 const m=interior();m.shelf(2,3,4);m.shelf(14,3,4);m.pc(2,7);m.desk(7,5,8);
 for(const x of [8,11,14]){const px=x*8;m.c.oval(px,38,12,12,0);m.c.oval(px+1,39,10,10,3);m.c.rect(px+2,39,8,4,2);m.c.line(px+1,44,px+10,44,0);m.c.rect(px+5,43,3,3,0);}
 m.shelf(2,12,4);m.shelf(14,12,4);m.rug(7,10,6,5);maps.laboratory=m;
}
{
 const m=interior();m.pc(2,4);m.shelf(14,3,4);m.desk(12,9,4);m.rug(7,8,4,5);
 m.area(3,9,3,5,'floor',3,15);m.c.rect(25,73,22,37,0);m.c.rect(27,75,18,33,2);m.c.rect(28,76,16,9,3);m.c.line(27,89,44,89,0);
 m.c.rect(103,27,24,16,0);m.c.rect(105,29,20,12,3);m.c.line(105,35,124,35,2);m.paint(12,3,4,3,1,15);maps.red_house=m;
}
{
 const m=interior();m.shelf(2,3,5);m.shelf(13,3,5);m.desk(6,6,8);m.rug(8,13,4,3);
 for(const x of [3,5,14,16]){m.c.oval(x*8+2,28,5,5,3);m.c.dot(x*8+4,30,0);}maps.viridian_mart=m;
}
{
 const m=interior();m.desk(3,6,14);m.pc(3,11);m.rug(7,11,6,5);m.area(13,3,4,2,'floor',2,15);
 m.c.rect(108,26,24,12,0);for(const x of [110,118,126]){m.c.oval(x,28,4,4,3);m.c.oval(x,33,4,4,2);}maps.viridian_center=m;
}
function runs(values,w,key){const a=[];for(let y=0;y<values.length/w;y++)for(let x=0;x<w;){let e=x+1;while(e<w&&values[y*w+e]===values[y*w+x])e++;a.push({x,y,width:e-x,height:1,[key]:values[y*w+x]});x=e;}return a;}
const manifest=[];
for(const [key,m]of Object.entries(maps)){
 const version=['fernvale','viridian'].includes(key)?'-v2':'';
 const sourcePath=`artwork/opening-imports/${key}${version}.png`;await writeFile(path.join(root,sourcePath),m.c.png());
 manifest.push({key,sceneId:ids.scenes[key]||uuid('opening:scene:'+key),id:uuid('opening:background:'+key+version),name:key,width:m.w,height:m.h,sourcePath,assetPath:`assets/backgrounds/opening-${key}${version}.png`,paletteEdits:runs(m.slots,m.w,'slot'),collisionEdits:runs(m.block,m.w,'value').map(e=>({...e,shape:'rectangle'}))});
}
await writeFile(path.join(root,'artwork/opening-asset-plan.json'),JSON.stringify(manifest,null,2));
console.log('Authored '+manifest.length+' opening backgrounds.');
