import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shades = ['071821', '306850', '86c06c', 'e0f8cf', '65ff00'];
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const b of body) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const header = Buffer.alloc(4), tail = Buffer.alloc(4);
  header.writeUInt32BE(data.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, body, tail]);
}
class Canvas {
  constructor(w, h, fill = 3) { this.w = w; this.h = h; this.p = new Uint8Array(w * h).fill(fill); }
  dot(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.dot(i, j, c); }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let t = 0; t <= n; t++) this.dot(Math.round(x0 + (x1 - x0) * t / (n || 1)), Math.round(y0 + (y1 - y0) * t / (n || 1)), c);
  }
  oval(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (((i + .5) / w - .5) ** 2 + ((j + .5) / h - .5) ** 2 <= .25) this.dot(x + i, y + j, c); }
  blit(src, x, y, transparent = -1, scale = 1) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const c = src.p[j * src.w + i];
      if (c !== transparent) this.rect(x + i * scale, y + j * scale, scale, scale, c);
    }
  }
  png() {
    const hdr = Buffer.alloc(13); hdr.writeUInt32BE(this.w, 0); hdr.writeUInt32BE(this.h, 4); hdr[8] = 8; hdr[9] = 2;
    const raw = Buffer.alloc(this.h * (1 + this.w * 3));
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const rgb = shades[this.p[y * this.w + x]], i = y * (this.w * 3 + 1) + 1 + x * 3;
      raw[i] = parseInt(rgb.slice(0, 2), 16); raw[i + 1] = parseInt(rgb.slice(2, 4), 16); raw[i + 2] = parseInt(rgb.slice(4), 16);
    }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  }
}
const glyphs = {
  A:['01110','10001','10001','11111','10001','10001','10001'], B:['11110','10001','10001','11110','10001','10001','11110'], C:['01111','10000','10000','10000','10000','10000','01111'],
  D:['11110','10001','10001','10001','10001','10001','11110'], E:['11111','10000','10000','11110','10000','10000','11111'], F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01111','10000','10000','10111','10001','10001','01111'], H:['10001','10001','10001','11111','10001','10001','10001'], I:['11111','00100','00100','00100','00100','00100','11111'],
  J:['00111','00010','00010','00010','10010','10010','01100'], K:['10001','10010','10100','11000','10100','10010','10001'], L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'], N:['10001','11001','10101','10011','10001','10001','10001'], O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'], Q:['01110','10001','10001','10001','10101','10010','01101'], R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'], T:['11111','00100','00100','00100','00100','00100','00100'], U:['10001','10001','10001','10001','10001','10001','01110'],
  V:['10001','10001','10001','10001','10001','01010','00100'], W:['10001','10001','10001','10101','10101','10101','01010'], X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'], Z:['11111','00001','00010','00100','01000','10000','11111'], '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'], '3':['11110','00001','00001','01110','00001','00001','11110'], ' ':['00000','00000','00000','00000','00000','00000','00000']
};
function text(c, s, x, y, ink = 0, scale = 1) {
  for (const ch of s) { const g = glyphs[ch] || glyphs[' ']; g.forEach((row, yy) => [...row].forEach((v, xx) => { if (v === '1') c.rect(x + xx * scale, y + yy * scale, scale, scale, ink); })); x += 6 * scale; }
}
function uuid(key) {
  const h = createHash('sha256').update('pocket-frontier:' + key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function hash(b) { return createHash('sha256').update(b).digest('hex'); }
const manifest = { backgrounds: [], sprites: [], palettes: [
  {key:'meadow',name:'Meadow',colors:['203828','487850','98c878','e8f8d8']},
  {key:'path',name:'Footpath',colors:['283848','708898','b8d0d8','f0f8f8']},
  {key:'roof',name:'Coral Roof',colors:['382838','a84858','e89080','fff0d8']},
  {key:'water',name:'River',colors:['203850','4078b8','78c8e0','e0f8ff']},
  {key:'room',name:'Laboratory',colors:['303040','707898','b8c8d8','f0f8ff']},
  {key:'battle',name:'Battle White',colors:['182830','506870','a8c8b0','f8fff0']},
  {key:'ember',name:'Emberkin',colors:['201828','783048','e87850','fff0b0']},
  {key:'moss',name:'Mosslet',colors:['182830','285838','78b850','e8f8b0']},
  {key:'ripple',name:'Ripplet',colors:['182830','305078','60b8e0','e0f8ff']},
  {key:'volt',name:'Voltik',colors:['201828','685028','e8c848','ffffc8']},
  {key:'pebble',name:'Pebblit',colors:['202838','585878','9898b0','e8e8f0']},
  {key:'noct',name:'Noctula',colors:['282038','605080','b890c8','f0d8ff']},
  {key:'trainer',name:'Trainer',colors:['182830','383850','d86068','fff0d8']}
] };
const creatures = [
  {key:'emberkin',name:'EMBERKIN',type:'FIRE',palette:'ember'}, {key:'mosslet',name:'MOSSLET',type:'LEAF',palette:'moss'},
  {key:'ripplet',name:'RIPPLET',type:'WATER',palette:'ripple'}, {key:'voltik',name:'VOLTIK',type:'SPARK',palette:'volt'},
  {key:'pebblit',name:'PEBBLIT',type:'STONE',palette:'pebble'}, {key:'noctula',name:'NOCTULA',type:'WING',palette:'noct'}
];
function creature(n, back = false) {
  const c = new Canvas(32, 32, 4);
  const body = (x,y,w,h) => { c.oval(x,y,w,h,0); c.oval(x+1,y+1,w-2,h-2,2); };
  if (n === 1) {
    c.line(23,23,29,16,0); c.line(24,23,29,17,2); c.rect(27,12,3,6,0); c.rect(28,13,2,4,3);
    c.rect(8,3,3,6,0); c.rect(20,4,3,6,0); c.rect(9,4,1,4,2); c.rect(21,5,1,3,2);
    body(5,7,20,15); body(8,18,15,11); c.oval(12,20,7,7,3); c.rect(7,27,7,3,0); c.rect(20,27,5,3,0);
    c.rect(4,18,4,5,0); c.rect(23,18,3,5,0); c.rect(6,18,2,4,2); c.rect(23,18,2,4,2);
  } else if (n === 2) {
    c.line(16,8,16,2,0); c.oval(7,1,9,6,0); c.oval(8,2,7,4,2); c.oval(17,0,9,7,0); c.oval(18,1,7,5,3);
    body(4,8,23,17); c.oval(6,22,21,8,0); c.oval(7,22,19,6,2); c.rect(5,27,6,3,0); c.rect(22,26,6,4,0);
    c.oval(9,20,6,5,3); c.dot(23,19,0); c.dot(25,20,0);
  } else if (n === 3) {
    c.rect(2,21,4,6,0); c.rect(27,21,3,6,0); body(7,15,21,14); c.oval(12,17,12,10,0); c.oval(13,18,10,8,3);
    c.line(15,19,21,25,2); c.line(22,19,16,25,2); body(3,5,20,16); c.rect(8,2,3,6,0); c.rect(17,1,3,7,0);
    c.rect(9,3,1,3,3); c.rect(18,2,1,4,3); c.rect(8,27,5,3,0); c.rect(22,27,5,3,0);
  } else if (n === 4) {
    c.line(12,8,8,1,0); c.line(19,8,23,1,0); c.rect(6,0,4,3,3); c.rect(22,0,4,3,3);
    for (const y of [15,21,27]) { c.line(9,y,2,y+2,0); c.line(23,y,30,y+2,0); }
    body(8,9,17,20); c.rect(15,17,3,12,0); c.rect(11,18,3,4,3); c.rect(19,23,3,4,3); body(7,6,19,12);
  } else if (n === 5) {
    c.rect(3,8,7,7,0); c.rect(2,9,6,5,2); c.rect(1,4,3,8,0); c.rect(7,4,3,8,0);
    c.rect(23,8,7,7,0); c.rect(24,9,5,5,2); c.rect(22,4,3,8,0); c.rect(28,4,3,8,0);
    c.line(8,15,5,24,0); c.line(24,15,28,24,0); body(7,10,19,17); c.line(12,12,17,15,3); c.line(18,11,23,15,3);
    c.rect(7,25,5,5,0); c.rect(21,25,5,5,0); c.line(15,19,18,23,0); c.line(18,23,22,20,0);
  } else {
    c.oval(0,7,14,20,0); c.oval(1,8,12,17,2); c.oval(18,7,14,20,0); c.oval(19,8,12,17,2);
    c.oval(3,11,7,9,3); c.oval(22,11,7,9,3); c.oval(5,13,3,4,0); c.oval(24,13,3,4,0);
    body(11,5,10,23); c.line(13,7,10,1,0); c.line(19,7,22,1,0); c.rect(14,20,4,5,3);
  }
  if (!back) { c.rect(10,11,3,5,0); c.rect(19,11,3,5,0); c.dot(10,11,3); c.dot(19,11,3); c.line(14,18,17,18,0); }
  else { c.line(12,11,19,11,3); c.line(10,14,21,14,2); c.line(14,8,17,7,0); }
  return c;
}
function trainer(kind = 'trainer', frame = 0) {
  const c = new Canvas(16,16,4);
  c.rect(4,2,8,1,0); c.rect(3,3,10,5,0); c.rect(4,4,8,4,3);
  if (kind === 'prof') { c.rect(4,1,8,3,3); c.dot(6,5,0); c.dot(10,5,0); c.line(6,5,10,5,0); }
  else if (kind === 'nurse') { c.rect(4,1,8,3,3); c.rect(7,0,2,4,2); c.rect(6,1,4,2,2); }
  else { c.rect(4,0,7,4,2); c.rect(3,3,10,2,2); c.dot(5,5,0); c.dot(10,5,0); }
  c.rect(4,8,8,6,0); c.rect(5,8,6,4,kind === 'prof' || kind === 'nurse' ? 3 : 2);
  c.rect(2,8,2,4,0); c.rect(12,8,2,4,0); c.rect(3,9,1,2,3); c.rect(12,9,1,2,3);
  c.rect(4 + (frame % 2),13,3,3,0); c.rect(9 - (frame % 2),13,3,3,0);
  return c;
}
function directional() {
  const sheet = new Canvas(96,16,4);
  for (let i = 0; i < 6; i++) {
    const c = trainer('trainer', i);
    if (i === 2 || i === 3) { c.rect(4,4,8,4,2); c.rect(6,8,4,4,3); }
    if (i >= 4) { c.rect(3,4,5,4,4); c.rect(4,2,6,3,2); c.rect(10,4,3,4,3); c.dot(11,5,0); c.rect(3,9,3,4,3); }
    sheet.blit(c,i*16,0,4);
  }
  return sheet;
}
function tile(kind, variant = 0) {
  const c = new Canvas(8,8,3);
  if (kind === 'lawn') { c.rect(0,0,8,8,2); if (variant) { c.dot(1,2,1); c.dot(2,3,3); c.dot(6,6,1); } }
  if (kind === 'path') { c.dot(2,2,2); c.dot(6,5,2); }
  if (kind === 'grass') { c.rect(0,0,8,8,2); for (const x of [1,5]) { c.line(x,6,x,3,0); c.line(x,5,x-1,3,1); c.line(x,4,x+2,2,1); c.dot(x+1,2,3); } }
  if (kind === 'water') { c.rect(0,0,8,8,1); c.line(0,2,4,2,2); c.line(3,3,7,3,2); c.line(1,6,5,6,3); }
  if (kind === 'stone') { c.rect(0,0,8,8,2); c.rect(0,0,8,1,0); c.rect(0,7,8,1,1); c.rect(0,0,1,8,1); c.rect(3,3,2,1,3); }
  if (kind === 'floor') { c.rect(0,0,8,8,3); c.line(0,0,7,0,2); c.line(0,0,0,7,2); }
  if (kind === 'flower') { c.rect(0,0,8,8,2); c.rect(3,2,2,4,3); c.rect(2,3,4,2,3); c.dot(3,3,0); c.line(3,5,3,7,1); }
  return c;
}
class MapArt {
  constructor(w,h,fill='lawn',slot=0) { this.c = new Canvas(w*8,h*8); this.w=w; this.h=h; this.slots=new Uint8Array(w*h).fill(slot); this.block=new Uint8Array(w*h); for(let y=0;y<h;y++) for(let x=0;x<w;x++) this.cell(x,y,fill,slot,(x*7+y*3)%9===0?1:0); }
  cell(x,y,k,s=0,v=0,block=0) { this.c.blit(tile(k,v),x*8,y*8); this.slots[y*this.w+x]=s; this.block[y*this.w+x]=block; }
  area(x,y,w,h,k,s=0,block=0) { for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) this.cell(i,j,k,s,0,block); }
  paint(x,y,w,h,s,block) { for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) { this.slots[j*this.w+i]=s; if(block!==undefined) this.block[j*this.w+i]=block; } }
  tree(x,y) {
    this.paint(x,y,2,3,0,15); const c=this.c, px=x*8,py=y*8;
    c.rect(px+6,py+14,4,9,0); c.rect(px+7,py+15,2,7,1); c.oval(px,py,16,19,0); c.oval(px+1,py+1,14,16,1);
    c.oval(px+2,py+2,11,9,2); c.line(px+4,py+3,px+10,py+3,3); c.dot(px+12,py+11,2); c.dot(px+3,py+13,2);
  }
  house(x,y,w=8,h=7,label='LAB') {
    const c=this.c,px=x*8,py=y*8; this.paint(x,y,w,3,2,15); this.paint(x,y+3,w,h-3,1,15);
    c.rect(px,py,w*8,24,0); c.rect(px+1,py+1,w*8-2,22,2);
    for(let j=4;j<23;j+=5) c.line(px+2,py+j,px+w*8-3,py+j,1);
    for(let j=1;j<23;j+=5) for(let i=4;i<w*8-2;i+=8) c.dot(px+i+(j%2?0:4),py+j,3);
    c.rect(px+3,py+24,w*8-6,(h-3)*8,0); c.rect(px+4,py+25,w*8-8,(h-3)*8-1,3);
    for(const wx of [px+8,px+w*8-20]) { c.rect(wx,py+29,12,12,0); c.rect(wx+1,py+30,10,10,2); c.rect(wx+5,py+30,1,10,0); c.rect(wx+1,py+35,10,1,0); }
    const dx=x+Math.floor(w/2)-1,dy=y+h-2; c.rect(dx*8,dy*8,16,16,0); c.rect(dx*8+2,dy*8+2,12,14,1); c.dot(dx*8+12,dy*8+9,3);
    this.block[(dy+1)*this.w+dx]=0;this.block[(dy+1)*this.w+dx+1]=0;
    if(label) { c.rect(px+8,py+42,w*8-16,8,3); text(c,label,px+(w*8-label.length*6)/2,py+42); }
    return {x:dx,y:dy+1,width:2,height:1};
  }
  edges() { for(let x=0;x<this.w;x++) {this.block[x]=15;this.block[(this.h-1)*this.w+x]=15;} for(let y=0;y<this.h;y++) {this.block[y*this.w]=15;this.block[y*this.w+this.w-1]=15;} }
}
async function background(key,map) {
  const assetPath=`assets/backgrounds/${key}.png`; await writeFile(path.join(root,assetPath),map.c.png());
  const paletteEdits=[], collisionEdits=[];
  for(let y=0;y<map.h;y++) { let x=0; while(x<map.w) {const s=map.slots[y*map.w+x],b=map.block[y*map.w+x];let end=x+1;while(end<map.w&&map.slots[y*map.w+end]===s&&map.block[y*map.w+end]===b)end++;
    if(s!==0)paletteEdits.push({x,y,width:end-x,height:1,slot:s}); if(b)collisionEdits.push({shape:'rectangle',x,y,width:end-x,height:1,value:b}); x=end; } }
  manifest.backgrounds.push({key,assetPath,width:map.w,height:map.h,paletteEdits,collisionEdits});
}
async function sprite(key,c,profile='static',native=null) {
  const sourcePath=`artwork/imports/${key}.png`, bytes=c.png(); await writeFile(path.join(root,sourcePath),bytes);
  const item={key,sourcePath,assetPath:`assets/sprites/${key}.png`,profile};
  if(native) { const meta={_resourceType:'sprite',id:uuid(key),name:key,symbol:`sprite_${key}`,filename:`${key}.png`,width:c.w,height:c.h,checksum:createHash('sha1').update(bytes).digest('hex'),numTiles:16,canvasOriginX:0,canvasOriginY:0,canvasWidth:32,canvasHeight:32,boundsX:0,boundsY:-16,boundsWidth:32,boundsHeight:32,animSpeed:15,
      states:['','back'].map((name,state)=>({id:uuid(`${key}:state:${state}`),name,animationType:'fixed',flipLeft:false,animations:Array.from({length:8},(_,anim)=>({id:uuid(`${key}:${state}:${anim}`),frames:[{id:uuid(`${key}:${state}:${anim}:frame`),tiles:anim?[]:Array.from({length:8},(_,t)=>({id:uuid(`${key}:${state}:${anim}:tile:${t}`),x:(t%4)*8,y:Math.floor(t/4)*16,sliceX:state*32+(t%4)*8,sliceY:16-Math.floor(t/4)*16,flipX:false,flipY:false,palette:0,paletteIndex:native-1,objPalette:'OBP0',priority:false}))}]}))}))};
    const metadataPath=`artwork/imports/${key}.json`,metaBytes=Buffer.from(JSON.stringify(meta,null,2)); await writeFile(path.join(root,metadataPath),metaBytes);
    Object.assign(item,{profile:'native_metadata',metadataPath,sourceSha256:hash(bytes),metadataSha256:hash(metaBytes),backSourceId:meta.states[1].id});
  }
  manifest.sprites.push(item);
}
export { Canvas, MapArt, text, uuid, hash };
if (process.argv[1] === fileURLToPath(import.meta.url)) {
await mkdir(path.join(root,'artwork/imports'),{recursive:true});
await mkdir(path.join(root,'assets/backgrounds'),{recursive:true});
await sprite('ranger',directional(),'directional_animated');
for(const kind of ['prof','nurse','rival']) await sprite(kind,trainer(kind));
for(let n=1;n<=6;n++) {const c=new Canvas(64,32,4);c.blit(creature(n),0,0,4);c.blit(creature(n,true),32,0,4);await sprite(creatures[n-1].key,c,'native_metadata',n);}

const town=new MapArt(32,26);town.edges();
town.area(14,1,4,24,'path',1);town.area(3,15,25,3,'path',1);town.area(1,19,7,6,'water',3,15);
for(const [x,y] of [[0,0],[2,0],[4,0],[6,0],[8,0],[10,0],[12,0],[18,0],[20,0],[22,0],[24,0],[26,0],[28,0],[30,0],[0,3],[30,3],[0,6],[30,6],[0,9],[30,9],[0,12],[30,12],[30,18],[30,21]])town.tree(x,y);
town.house(4,6,8,7,'LAB');town.house(21,6,8,7,'ARENA');
town.house(21,19,7,6,'REST');town.area(4,19,7,2,'path',1);town.area(10,20,4,3,'flower',2);
town.area(14,0,4,3,'path',1);town.block.fill(0,14,18);
town.c.rect(8*8,15*8,6*8,8,3);text(town.c,'FERNVALE',8*8+1,15*8);
await background('fernvale',town);

const route=new MapArt(32,32);route.edges();route.area(14,1,4,30,'path',1);route.area(4,21,24,3,'path',1);route.area(4,12,24,3,'path',1);
for(let x=0;x<32;x+=2){route.tree(x,0);if(x<14||x>16)route.tree(x,29);}
for(let y=3;y<29;y+=3){route.tree(0,y);route.tree(30,y);}
for(const [x,y,w,h] of [[4,5,8,7],[20,5,8,7],[4,15,8,6],[20,15,8,6],[4,24,8,4],[20,24,8,4]])route.area(x,y,w,h,'grass',0);
route.area(24,23,5,6,'water',3,15);route.area(14,30,4,2,'path',1);route.block[(31)*32+14]=0;route.block[31*32+15]=0;route.block[31*32+16]=0;route.block[31*32+17]=0;
route.c.rect(12*8,12*8,8*8,8,3);text(route.c,'ROUTE 1',12*8+8,12*8);
await background('route_one',route);

const lab=new MapArt(20,18,'floor',4);lab.edges();lab.area(0,0,20,3,'stone',4,15);lab.area(2,3,4,4,'stone',4,15);lab.area(14,3,4,4,'stone',4,15);
lab.c.rect(16,25,30,29,0);lab.c.rect(18,27,26,24,3);text(lab.c,'FERN',19,29);text(lab.c,'LAB',22,39);
for(let x=5;x<=13;x+=4){lab.area(x,6,2,2,'stone',4,15);lab.c.oval(x*8+3,6*8+2,10,10,0);lab.c.oval(x*8+4,6*8+3,8,8,3);lab.c.rect(x*8+4,6*8+3,8,4,2);lab.c.dot(x*8+8,6*8+6,0);}
lab.area(8,11,4,6,'path',2);lab.area(8,17,4,1,'path',2);for(let x=8;x<12;x++)lab.block[17*20+x]=0;
await background('laboratory',lab);

const arena=new MapArt(20,18,'floor',4);arena.edges();arena.area(0,0,20,3,'stone',4,15);arena.area(0,3,2,12,'stone',4,15);arena.area(18,3,2,12,'stone',4,15);
arena.area(5,5,10,8,'path',2);arena.c.rect(40,40,80,64,0);arena.c.rect(42,42,76,60,3);arena.c.line(42,72,117,72,2);arena.c.oval(66,59,28,28,0);arena.c.oval(68,61,24,24,3);arena.c.line(68,73,91,73,0);arena.c.oval(77,70,6,6,0);arena.c.oval(79,72,2,2,3);
text(arena.c,'FERNVALE LEAGUE',35,8);arena.area(8,14,4,4,'path',2);for(let x=8;x<12;x++)arena.block[17*20+x]=0;
await background('arena',arena);

const battle=new MapArt(20,18,'floor',5);battle.c.rect(0,0,160,144,3);battle.c.oval(100,57,52,10,2);battle.c.oval(8,93,55,10,2);
battle.c.line(8,28,79,28,0);battle.c.line(79,24,79,28,0);battle.c.line(76,96,151,96,0);battle.c.line(76,92,76,96,0);battle.c.rect(0,104,160,40,3);
await background('battlefield',battle);

const title=new MapArt(20,18,'floor',5);title.c.rect(0,0,160,144,3);
for(let y=0;y<12;y++)for(let x=0;x<20;x++)if((x+y)%4===0)title.c.dot(x*8+3,y*8+2,2);
text(title.c,'POCKET',44,13,1,2);text(title.c,'POCKET',44,11,0,2);text(title.c,'FRONTIER',32,32,1,2);text(title.c,'FRONTIER',32,30,0,2);
text(title.c,'CHROMATIC EDITION',33,51,0);title.c.blit(creature(2),18,67,4);title.c.blit(creature(1),64,62,4);title.c.blit(creature(3),111,67,4);
title.paint(2,8,5,5,0);title.paint(8,7,5,6,2);title.paint(13,8,6,5,3);title.c.line(8,107,151,107,0);
await background('title',title);
manifest.creatures=creatures;
await writeFile(path.join(root,'artwork/asset-plan.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({sprites:manifest.sprites.length,backgrounds:manifest.backgrounds.length,palettes:manifest.palettes.length,root}));
}
