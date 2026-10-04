import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { Canvas } from '../artwork/author-art.mjs';

const root=path.resolve(import.meta.dirname,'..');
const roster=JSON.parse(await readFile(path.join(root,'artwork/roster.json'),'utf8'));
const ids=JSON.parse(await readFile(path.join(root,'artwork/pokemon-resource-ids.json'),'utf8'));
const commit='d2704a63c26f9ba046ade877445216b3de0519a4';
const digest=(data,algorithm='sha256')=>createHash(algorithm).update(data).digest('hex');

// The cached references have opaque white backgrounds. Only edge-connected
// white is transparent, preserving enclosed eye highlights and white markings.
function pixels(png,frame=0,size=png.height){
  const w=png.width,h=size,clear=new Uint8Array(w*h),queue=[];
  const color=(x,y)=>png.data.subarray(((y+frame*size)*w+x)*4,((y+frame*size)*w+x)*4+4);
  const visit=(x,y)=>{if(x<0||y<0||x>=w||y>=h||clear[y*w+x])return;const c=color(x,y);
    if(c[3]<128||(c[0]>245&&c[1]>245&&c[2]>245)){clear[y*w+x]=1;queue.push([x,y]);}};
  for(let x=0;x<w;x++){visit(x,0);visit(x,h-1);}for(let y=0;y<h;y++){visit(0,y);visit(w-1,y);}
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i];visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}
  const shades=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!clear[y*w+x]){const c=color(x,y),l=c[0]*.299+c[1]*.587+c[2]*.114;if(l>50)shades.push(l);}
  const split=(Math.min(...shades)+Math.max(...shades))/2;
  const c=new Canvas(w,h,4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!clear[y*w+x]){const rgb=color(x,y),l=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114;c.dot(x,y,l<=50?0:l<split?2:3);}
  return c;
}
function portrait(png){
  const source=pixels(png),out=new Canvas(32,32,4);
  let left=source.w,top=source.h,right=-1,bottom=-1;
  for(let y=0;y<source.h;y++)for(let x=0;x<source.w;x++)if(source.p[y*source.w+x]!==4){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  assert.ok(right>=left,'reference is not blank');
  const w=right-left+1,h=bottom-top+1,scale=Math.min(30/w,30/h,1),ow=Math.max(1,Math.round(w*scale)),oh=Math.max(1,Math.round(h*scale));
  for(let y=0;y<oh;y++)for(let x=0;x<ow;x++)out.dot(Math.floor((32-ow)/2)+x,31-oh+y,
    source.p[(top+Math.min(h-1,Math.floor(y/scale)))*source.w+left+Math.min(w-1,Math.floor(x/scale))]);
  assert.equal(out.p[0],4,'no opaque reference border');
  return out;
}
async function update(filename,canvas,expectedId){
  const file=path.join(root,'assets/sprites',filename),metaFile=file+'.gbsres';
  const meta=JSON.parse(await readFile(metaFile,'utf8'));
  assert.equal(meta.id,expectedId);assert.equal(meta.width,canvas.w);assert.equal(meta.height,canvas.h);
  const bytes=canvas.png();meta.checksum=digest(bytes,'sha1');
  await writeFile(file,bytes);await writeFile(metaFile,JSON.stringify(meta,null,2)+'\n');
}
const review=new Canvas(10*64,4*64+32,3),provenance=[];
for(const [i,p]of roster.entries()){
  const sheet=new Canvas(64,32,4);
  for(const [j,side]of ['front','back'].entries()){
    const reference='artwork/reference/pokeapi/'+p.dex+'-'+side+'.png',bytes=await readFile(path.join(root,reference));
    sheet.blit(portrait(PNG.sync.read(bytes)),j*32,0,4);provenance.push({key:p.key,side,reference,sha256:digest(bytes)});
  }
  await update('kanto-'+p.key+'-centered.png',sheet,ids.sprites[p.key]);
  if(i<20)review.blit(sheet,(i%10)*64,Math.floor(i/10)*64,4);
}
for(const [key,source]of [['red','red'],['blue','blue'],['oak','oak'],['joy','nurse']]){
  const reference='artwork/reference/'+source+'-overworld.png',url=`https://raw.githubusercontent.com/pret/pokered/${commit}/gfx/sprites/${source}.png`;
  let bytes;
  try{bytes=await readFile(path.join(root,reference));}catch(error){if(error.code!=='ENOENT')throw error;const response=await fetch(url);if(!response.ok)throw new Error(url+' '+response.status);bytes=Buffer.from(await response.arrayBuffer());await writeFile(path.join(root,reference),bytes);}
  const png=PNG.sync.read(bytes),canvas=new Canvas(key==='red'?96:16,16,4);
  assert.equal(png.width,16);
  if(key==='red'){
    // Retail order: down/up/left idle, then down/up/left walking.
    for(const [i,frame]of [0,3,1,4,2,5].entries()){
      const c=pixels(png,frame,16);
      for(let y=0;y<16;y++)for(let x=0;x<16;x++)canvas.dot(i*16+x,y,c.p[y*16+(i>=4?15-x:x)]);
    }
  }else canvas.blit(pixels(png,0,16),0,0,4);
  await update('kanto-'+key+'.png',canvas,ids.sprites[key]);
  review.blit(canvas,0,144+['red','blue','oak','joy'].indexOf(key)*32,4,2);
  provenance.push({key,reference,url,sha256:digest(bytes)});
}
await writeFile(path.join(root,'artwork/character-art-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
await writeFile(path.join(root,'artwork/character-refresh-review.png'),review.png());
console.log('151 front/back pairs and Red, Blue, Oak, Nurse Joy updated; stable native IDs preserved.');
