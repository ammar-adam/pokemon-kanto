import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Canvas,MapArt,text,uuid,hash } from './author-art.mjs';
import { world,additionalSpecies,legacyAdditionalSpecies } from './campaign-world.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=JSON.parse(await readFile(path.join(root,'artwork/pokemon-asset-plan.json'),'utf8'));
const out=path.join(root,'artwork/campaign-imports');
await mkdir(out,{recursive:true});
const palettes=[
  {key:'canopy',name:'Canopy Emerald',colors:['edf8dc','8bd18c','398270','193b43']},
  {key:'paving',name:'Pearl Paving',colors:['f8fbff','cbd7e0','8d9faa','344853']},
  {key:'coral',name:'Coral Tile',colors:['fff2e9','ee9398','b94c65','4f3048']},
  {key:'blue',name:'Cerulean Tile',colors:['edffff','8cdae8','368bba','273d63']},
  {key:'gold',name:'Vermilion Tile',colors:['fffae7','ebd56c','b78545','523b4d']},
  {key:'pink',name:'Celadon Blossom',colors:['fff0f8','e0a4d4','ad62a7','473953']},
  {key:'violet',name:'Lavender Evening',colors:['f7f0ff','b9addb','7a739c','353746']},
  {key:'stone',name:'Pewter Granite',colors:['f7f3ef','c1b7ac','837f82','373c48']},
  {key:'cave',name:'Cave Mineral',colors:['ddebe9','9aafb3','5b727b','293e49']}
];
class Region extends MapArt {
  cell(x,y,kind,slot=0,variant=0,block=0){
    if(x<0||y<0||x>=this.w||y>=this.h)return;
    super.cell(x,y,kind,slot,variant,block);
    const px=x*8,py=y*8,c=this.c;
    if(kind==='lawn'){c.rect(px,py,8,8,3);if((x*3+y)%7===0){c.dot(px+2,py+3,2);c.dot(px+3,py+2,2);c.dot(px+5,py+6,2);}}
    if(kind==='grass'){c.rect(px,py,8,8,2);for(const dx of [1,5]){c.line(px+dx,py+6,px+dx,py+3,1);c.dot(px+dx-1,py+3,1);c.dot(px+dx+1,py+2,3);c.dot(px+dx,py+6,0);}}
    if(kind==='path'){c.rect(px,py,8,8,3);c.dot(px+2,py+2,2);if(variant)c.line(px,py+7,px+7,py+7,2);}
    if(kind==='water'){c.rect(px,py,8,8,1);c.line(px+1,py+2,px+4,py+2,2);c.dot(px+5,py+3,3);c.line(px+3,py+6,px+6,py+6,2);}
    if(kind==='floor'){c.rect(px,py,8,8,3);c.line(px,py,px+7,py,2);c.line(px,py,px,py+7,2);c.dot(px+1,py+1,2);}
    if(kind==='stone'){c.rect(px,py,8,8,1);c.line(px+1,py+1,px+6,py+1,3);c.line(px,py+7,px+7,py+7,0);c.line(px+7,py+1,px+7,py+7,0);c.dot(px+3,py+4,2);}
  }
  tree(x,y){
    this.paint(x,y,2,3,0,15);const c=this.c,px=x*8,py=y*8;
    c.rect(px+6,py+13,4,10,0);c.rect(px+7,py+14,2,7,1);
    const rows=['.....000000.....','...0011111100...','..011222222110..','.01222333322210.','0122332222322210','0123222222223210','0122221111222210','0122112222112210','0111222332221110','0011222222221100','.00122211222100.','..001111111100..','....00000000....'];
    rows.forEach((row,j)=>[...row].forEach((v,i)=>{if(v!=='.')c.dot(px+i,py+j,Number(v));}));
  }
  house(x,y,w=8,h=7,label='CENTER'){
    const door=super.house(x,y,w,h,label),c=this.c,px=x*8,py=y*8;
    for(let dy=3;dy<21;dy+=4)for(let dx=3;dx<w*8-3;dx+=8){c.line(px+dx,py+dy,px+dx+5,py+dy,3);c.dot(px+dx+5,py+dy+1,1);}
    c.rect(px+8,py+24,w*8-16,2,1);c.rect(px+w*8-17,py-3,6,11,0);c.rect(px+w*8-16,py-2,4,9,2);
    for(const dx of [10,w*8-22]){c.rect(px+dx,py+40,10,2,1);c.dot(px+dx+2,py+39,2);c.dot(px+dx+7,py+39,2);}
    return door;
  }
}
function gate(m,side){
  if(side==='n')m.area(14,0,4,4,'path',1,0);
  if(side==='s')m.area(14,m.h-4,4,4,'path',1,0);
  if(side==='e')m.area(m.w-4,15,4,3,'path',1,0);
  if(side==='w')m.area(0,15,4,3,'path',1,0);
}
function border(m){m.edges();for(let x=0;x<m.w;x+=2){if(x<14||x>16)m.tree(x,0);if(x<14||x>16)m.tree(x,m.h-3);}for(let y=3;y<m.h-3;y+=3){m.tree(0,y);m.tree(m.w-2,y);}for(const side of ['n','s','e','w'])gate(m,side);}
function sign(m,label){m.c.rect(32,112,Math.min(192,label.length*6+8),10,3);text(m.c,label,36,113);m.paint(4,14,Math.min(24,Math.ceil((label.length*6+8)/8)),2,1);}
function town(spec){
  const m=new Region(32,26);border(m);m.area(14,3,4,20,'path',1);m.area(2,15,28,3,'path',1);
  m.house(4,6,8,7,spec.key==='fernvale'?'OAK LAB':({saffron:'SILPH',fuchsia:'SAFARI',cinnabar:'FOSSIL LAB'}[spec.key]||'CENTER'));m.house(21,6,8,7,spec.key==='fernvale'?'RED HOME':spec.key==='lavender'?'TOWER':spec.key==='indigo'?'LEAGUE':'GYM');
  m.area(3,19,8,4,'flower',4);m.area(22,19,6,4,'water',3,15);
  if(spec.key==='cerulean'){m.area(2,3,10,2,'water',3,15);m.area(20,3,10,2,'water',3,15);}
  if(spec.key==='vermilion'){m.area(20,18,10,6,'water',3,15);m.area(20,19,8,2,'path',2,0);text(m.c,'PORT',169,153);}
  if(spec.key==='celadon'){m.house(2,19,10,6,'GAME CORNER');m.area(21,19,9,4,'flower',4);}
  if(spec.key==='lavender'){m.c.rect(23*8,2*8,4*8,4*8,0);m.c.rect(23*8+1,2*8+1,4*8-2,4*8-2,2);m.paint(23,2,4,4,2,15);}
  sign(m,spec.name);return m;
}
function landscape(spec){
  const m=new Region(32,32);border(m);m.area(14,3,4,26,'path',1);m.area(2,15,28,3,'path',1);
  for(const [x,y,w,h]of [[4,5,8,7],[20,5,8,7],[4,19,8,9],[20,19,8,9]])m.area(x,y,w,h,'grass',0);
  if(spec.kind==='forest'){for(const [x,y]of [[8,8],[22,8],[8,22],[24,24],[4,19],[20,18]])m.tree(x,y);}
  if(spec.kind==='bridge'){m.area(1,3,12,26,'water',3,15);m.area(19,3,12,26,'water',3,15);m.area(14,3,4,26,'floor',2);for(let y=3;y<29;y+=2){m.cell(13,y,'stone',2,0,15);m.cell(18,y,'stone',2,0,15);}m.area(3,25,8,3,'grass',0,0);m.area(20,25,8,3,'grass',0,0);}
  if(['route_nineteen','route_twenty_one'].includes(spec.key)){
    m.area(2,3,28,26,'water',3,0);
    m.area(4,9,6,5,'path',1,0);m.area(22,21,6,5,'path',1,0);
    m.tree(6,10);m.tree(24,22);
  }
  if(spec.key==='cycling_road'){for(let y=4;y<29;y+=4){m.c.rect(123,y*8,2,12,2);m.c.rect(139,y*8,2,12,2);}}
  sign(m,spec.name);return m;
}
function cave(spec){
  const m=new Region(32,32,'floor',5);m.edges();m.area(0,0,32,3,'stone',5,15);m.area(0,29,32,3,'stone',5,15);m.area(0,0,2,32,'stone',5,15);m.area(30,0,2,32,'stone',5,15);
  m.area(4,6,7,4,'stone',5,15);m.area(21,6,7,4,'stone',5,15);m.area(4,21,7,5,'stone',5,15);m.area(21,21,7,5,'stone',5,15);
  m.area(14,0,4,32,'path',1,0);m.area(2,15,28,3,'path',1,0);
  for(const [x,y]of [[3,12],[26,12],[8,27],[24,3]]){m.c.rect(x*8+2,y*8+1,5,6,0);m.c.line(x*8+3,y*8+2,x*8+3,y*8+5,3);m.paint(x,y,1,1,3);}
  if(spec.kind==='hideout'){m.area(6,18,6,2,'floor',2);for(let x=6;x<12;x++){m.c.line(x*8+1,147,x*8+6,151,0);m.c.line(x*8+6,151,x*8+1,155,0);}m.area(14,5,4,3,'floor',2);text(m.c,'R',122,43);}
  if(spec.key.startsWith('pokemon_tower')||spec.key==='tower_summit'){
    for(const x of [4,8,21,25])for(const y of [5,11,21,25]){m.area(x,y,2,2,'stone',6,15);m.c.rect(x*8+6,y*8+3,3,10,0);m.c.rect(x*8+3,y*8+6,9,3,0);}
  }
  if(spec.key.startsWith('silph_')){m.area(4,6,7,4,'floor',3,15);m.area(21,6,7,4,'floor',3,15);for(const x of [5,8,22,25]){m.c.rect(x*8,55,12,9,0);m.c.rect(x*8+1,56,10,6,3);}m.area(14,20,4,2,'floor',4,0);}
  if(spec.key.startsWith('seafoam')){for(const [x,y]of [[4,6],[21,6],[4,21],[21,21]])m.area(x,y,7,4,'water',3,15);}
  sign(m,spec.name);return m;
}
function room(spec){
  const ship=spec.kind==='ship',w=ship?24:20,h=ship?24:18,m=new Region(w,h,'floor',1);m.edges();m.area(0,0,w,3,'stone',2,15);m.area(2,4,4,3,'stone',2,15);m.area(w-6,4,4,3,'stone',2,15);
  m.area(8,h-5,4,5,'path',2,0);m.c.rect(8*8,9*8,4*8,2,1);text(m.c,spec.name,(w*8-spec.name.length*6)/2,9);
  if(spec.kind==='gym'){m.area(6,4,8,8,'floor',2);m.c.oval(64,50,32,32,0);m.c.oval(66,52,28,28,3);m.c.line(66,66,93,66,0);m.c.rect(77,63,6,6,0);m.c.rect(79,65,2,2,3);if(spec.theme==='blue'){m.area(2,8,3,5,'water',3,15);m.area(15,8,3,5,'water',3,15);}if(spec.theme==='pink'){m.area(2,8,3,5,'flower',4,15);m.area(15,8,3,5,'flower',4,15);}}
  if(ship){m.area(3,11,4,3,'floor',4);m.area(17,11,4,3,'floor',4);m.c.rect(16,144,40,16,0);m.c.rect(18,145,36,13,3);m.paint(2,18,5,2,3,15);}
  return m;
}
function runs(values,w){const out=[];for(let y=0;y<values.length/w;y++){let x=0;while(x<w){const v=values[y*w+x];let end=x+1;while(end<w&&values[y*w+end]===v)end++;out.push({x,y,width:end-x,height:1,value:v});x=end;}}return out;}
const manifest={backgrounds:[],sprites:[],palettes,creatures:[...base.creatures,...additionalSpecies]};
for(const spec of world){const map=spec.kind==='town'?town(spec):['cave','hideout'].includes(spec.kind)?cave(spec):['route','forest','bridge'].includes(spec.kind)?landscape(spec):room(spec);const sourcePath=`artwork/campaign-imports/${spec.key}.png`;await writeFile(path.join(root,sourcePath),map.c.png());manifest.backgrounds.push({...spec,id:uuid('campaign:background:'+spec.key),sceneId:uuid('campaign:scene:'+spec.key),sourcePath,assetPath:`assets/backgrounds/campaign-${spec.key}.png`,width:map.w,height:map.h,paletteKeys:['canopy','paving',spec.theme||'coral','blue','pink','cave','stone'],paletteEdits:runs(map.slots,map.w).map(({value,...r})=>({...r,slot:value})),collisionEdits:runs(map.block,map.w).map(r=>({...r,shape:'rectangle'}))});}
const titleArt=new Canvas(160,144,3);
for(let y=0;y<144;y+=8){titleArt.line(0,y,159,y,2);for(let x=(y/8)%2?4:0;x<160;x+=16)titleArt.dot(x,y+4,2);}
titleArt.rect(8,8,144,43,1);titleArt.rect(10,10,140,39,3);
text(titleArt,'POKEMON',39,14,0,2);
text(titleArt,'KANTO',50,35,0);
for(let i=0;i<8;i++){const x=5+i*19;titleArt.oval(x,65,17,17,0);titleArt.oval(x+2,67,13,13,2);titleArt.line(x,73,x+16,73,0);titleArt.rect(x+6,71,5,5,0);titleArt.dot(x+8,73,3);}
titleArt.line(12,96,147,96,0);text(titleArt,'CHAMPION QUEST',38,103,0);
const titleSource='artwork/campaign-imports/title-complete.png';
await writeFile(path.join(root,titleSource),titleArt.png());
manifest.backgrounds.push({key:'title_complete',name:'Pokemon Kanto Champion Quest',id:uuid('campaign:background:title-complete'),sceneId:'12f07015-0a42-504a-8d39-3f689e13ad3a',sourcePath:titleSource,assetPath:'assets/backgrounds/campaign-title-complete.png',width:20,height:18,paletteKeys:['canopy','paving','coral','blue'],paletteEdits:[{x:0,y:0,width:20,height:18,slot:1},{x:1,y:1,width:18,height:5,slot:2},{x:0,y:7,width:20,height:6,slot:3}]});
// Authored native 32x32 cells, with front and rear views kept on one 64x32 sheet.
function creature(index,back=false){
  const c=new Canvas(32,32,4),oval=(x,y,w,h,col=2)=>{c.oval(x,y,w,h,0);c.oval(x+1,y+1,w-2,h-2,col);};
  if(index===0){for(const [x,y]of [[20,24],[15,22],[10,18],[8,13]])oval(x,y,10,9);oval(4,4,17,16);c.line(11,5,8,0,0);c.line(12,5,15,0,0);c.rect(6,16,8,4,3);c.dot(9,16,0);}
  if(index===1){c.line(23,22,30,17,0);c.line(30,17,28,9,0);c.line(28,9,25,13,0);oval(7,16,22,13);oval(2,8,18,16);oval(3,2,7,10);oval(15,3,7,10);c.oval(7,5,3,5,3);c.oval(18,6,2,4,3);c.rect(4,26,7,4,0);c.rect(21,26,7,4,0);c.rect(5,20,8,4,3);c.line(2,17,0,15,0);c.line(2,19,0,20,0);}
  if(index===2){oval(5,10,23,20);oval(6,5,21,19);c.line(7,12,3,1,0);c.line(3,1,12,7,0);c.line(22,9,28,2,0);c.line(28,2,27,14,0);c.rect(5,25,6,6,0);c.rect(21,25,6,6,0);c.line(14,6,18,1,0);c.line(18,1,21,7,0);c.rect(11,22,11,3,3);}
  if(index===3||index===4){const points=index===3?[[16,1],[20,11],[30,11],[23,18],[26,29],[16,23],[6,29],[9,18],[2,11],[12,11]]:[[16,1],[22,9],[30,8],[26,17],[31,23],[22,25],[20,31],[13,27],[4,30],[7,21],[0,17],[9,12]];for(let y=1;y<32;y++)for(let x=0;x<32;x++){let inside=false;for(let a=0,b=points.length-1;a<points.length;b=a++){const [ax,ay]=points[a],[bx,by]=points[b];if(((ay>y)!==(by>y))&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;}if(inside)c.dot(x,y,2);}for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];c.line(...a,...b,0);}oval(10,10,13,13,3);oval(13,13,7,7,2);c.dot(15,14,3);if(back)c.line(11,11,22,22,0);}
  if(index===5){c.line(22,23,29,18,0);c.line(29,18,26,9,0);c.line(26,9,31,4,0);c.rect(28,4,3,3,3);oval(6,14,19,17);oval(5,7,21,17);c.line(8,9,2,2,0);c.line(2,2,7,0,0);c.line(7,0,10,8,0);c.line(22,9,28,1,0);c.line(28,1,31,5,0);c.line(31,5,25,9,0);c.oval(11,21,10,8,3);c.rect(5,28,8,3,0);c.rect(22,28,8,3,0);}
  if(index===6){for(const [x,y,w,h]of [[7,0,6,16],[13,0,6,15],[20,2,6,15]])oval(x,y,w,h);oval(4,13,23,17);c.rect(3,27,8,4,0);c.rect(21,27,8,4,0);c.line(7,17,23,16,3);}
  if(index===7){oval(9,16,15,14);c.rect(5,25,7,5,0);c.rect(22,25,7,5,0);for(const [x,y,w,h]of [[1,3,15,12],[10,0,14,13],[18,4,14,13],[11,9,14,12],[0,12,15,11]])oval(x,y,w,h,3);c.oval(9,8,15,10,2);for(const [x,y]of [[5,7],[18,4],[25,10],[7,17],[20,16]])c.oval(x,y,3,3,0);}
  if(index===8){oval(11,12,12,18);oval(7,5,19,14);c.line(16,8,16,0,0);c.line(16,0,19,7,0);c.oval(4,19,5,8,0);c.oval(24,19,5,8,0);c.dot(4,24,3);c.dot(25,24,3);}
  if(index===9){oval(5,7,24,22);c.line(10,7,8,3,0);c.line(8,3,15,6,0);c.line(21,7,24,2,0);c.line(24,2,27,9,0);c.line(6,16,0,19,0);c.line(25,17,31,19,0);c.line(10,21,14,27,3);c.line(22,21,19,27,3);}
  if(index===10){oval(11,13,11,16);for(const [x,y]of [[1,3],[18,3]]){c.line(16,16,x,y,0);c.line(16,16,x+10,y+3,0);c.line(x,y,x+10,y+3,2);c.line(x+10,y+3,x+4,y+24,0);}oval(11,3,10,12);c.line(14,27,12,31,0);c.line(20,27,22,31,0);}
  if(index===11){oval(9,8,15,21);for(const x of [1,21]){c.line(14,15,x,4,0);c.line(x,4,x+9,18,0);c.line(x+9,18,14,21,0);c.line(14,15,x+3,7,2);c.line(14,21,x+8,18,3);}c.line(12,25,7,31,0);c.line(20,25,24,31,0);}
  if(![3,4].includes(index)){if(!back){c.rect(10,17,2,3,0);c.rect(20,17,2,3,0);c.dot(10,17,3);c.dot(20,17,3);c.line(13,23,17,23,0);}else{c.line(9,19,21,18,3);c.line(12,24,18,24,0);}}
  return c;
}
for(const [i,species]of legacyAdditionalSpecies.entries()){
  const key=species.key,c=new Canvas(64,32,4);c.blit(creature(i),0,0,4);c.blit(creature(i,true),32,0,4);
  const sourcePath=`artwork/campaign-imports/${key}.png`,assetPath=`assets/sprites/kanto-${key}-centered.png`,bytes=c.png();await writeFile(path.join(root,sourcePath),bytes);
  const template=JSON.parse(await readFile(path.join(root,'artwork/pokemon-imports/charmander-centered.json'),'utf8'));
  const slot=base.creatures.findIndex(s=>s.key===species.palette);template.id=uuid('campaign:sprite:'+key);template.name=key;template.symbol='sprite_'+key;template.filename=path.basename(assetPath);template.checksum=createHash('sha1').update(bytes).digest('hex');
  template.states.forEach((s,si)=>{s.id=uuid(key+':state:'+si);s.animations.forEach((a,ai)=>{a.id=uuid(key+':anim:'+si+':'+ai);a.frames.forEach((f,fi)=>{f.id=uuid(key+':frame:'+si+':'+ai+':'+fi);f.tiles.forEach((t,ti)=>{t.id=uuid(key+':tile:'+si+':'+ai+':'+fi+':'+ti);t.paletteIndex=slot;});});});});
  const metadataPath=`artwork/campaign-imports/${key}.json`,metadata=Buffer.from(JSON.stringify(template,null,2));await writeFile(path.join(root,metadataPath),metadata);
  manifest.sprites.push({key,sourcePath,assetPath,metadataPath,id:template.id,profile:'native_metadata',sourceSha256:hash(bytes),metadataSha256:hash(metadata),backSourceId:template.states[1].id});
}
function person(kind){
  const c=new Canvas(16,16,4);
  c.rect(4,1,8,7,0);c.rect(5,2,6,6,3);c.rect(4,8,8,6,0);c.rect(5,8,6,5,2);
  c.rect(2,9,2,4,0);c.rect(12,9,2,4,0);c.rect(3,10,1,2,3);c.rect(12,10,1,2,3);
  c.rect(4,13,3,3,0);c.rect(9,13,3,3,0);
  if(kind==='misty'){c.rect(3,0,10,3,2);c.rect(10,2,4,5,2);c.rect(11,3,2,3,3);c.rect(6,9,4,3,3);}
  if(kind==='surge'){c.rect(3,0,10,4,2);c.rect(4,1,8,2,3);c.rect(5,8,6,4,0);c.rect(6,9,4,2,2);}
  if(kind==='erika'){c.rect(3,0,10,6,0);c.rect(4,1,8,5,2);c.rect(6,2,5,4,3);c.rect(3,8,10,6,2);c.line(6,8,10,12,3);c.rect(10,0,3,2,3);}
  if(kind==='giovanni'){c.rect(3,0,10,3,0);c.rect(4,1,8,1,2);c.rect(6,8,4,5,3);c.rect(7,9,2,4,0);c.rect(4,12,8,2,0);}
  if(kind==='rocket'){c.rect(3,0,10,4,0);c.rect(4,1,8,2,2);c.rect(4,8,8,6,0);c.rect(6,9,4,3,3);c.dot(7,10,0);c.dot(8,11,0);}
  if(kind==='catcher'){c.rect(2,1,12,4,0);c.rect(3,2,10,2,2);c.line(13,7,15,0,0);c.line(11,1,15,2,0);c.rect(5,9,6,3,3);}
  if(kind==='sailor'){c.rect(3,0,10,4,3);c.rect(3,2,10,1,0);c.rect(4,8,8,6,3);c.rect(7,8,2,6,0);c.rect(4,13,8,1,0);}
  if(kind==='koga'){c.rect(3,0,10,4,0);c.line(3,0,8,3,2);c.rect(5,8,6,5,0);c.line(5,8,10,12,2);c.rect(3,5,3,2,2);}
  if(kind==='sabrina'){c.rect(3,0,10,13,0);c.rect(5,3,6,5,3);c.rect(5,8,6,5,2);c.rect(3,11,2,3,0);c.rect(11,11,2,3,0);}
  if(kind==='blaine'){c.rect(4,0,8,4,3);c.rect(4,4,8,2,0);c.rect(5,4,2,1,3);c.rect(9,4,2,1,3);c.rect(6,6,4,2,3);c.rect(3,8,10,6,3);c.rect(7,9,2,5,0);}
  if(kind==='lorelei'){c.rect(3,0,10,6,2);c.rect(3,4,2,8,2);c.rect(11,4,2,8,2);c.rect(5,4,6,3,3);c.rect(5,5,6,1,0);c.rect(4,9,8,5,0);c.rect(5,10,6,3,2);}
  if(kind==='bruno'){c.rect(4,0,8,3,0);c.rect(3,8,10,5,3);c.rect(5,10,6,1,0);c.rect(4,13,8,3,2);c.rect(7,13,2,3,0);}
  if(kind==='agatha'){c.rect(3,0,10,4,3);c.rect(4,1,8,2,2);c.rect(3,8,9,6,0);c.rect(4,9,7,4,2);c.line(14,7,14,15,0);c.rect(12,7,3,1,0);}
  if(kind==='lance'){c.rect(3,0,10,4,2);c.line(3,0,7,2,0);c.rect(2,8,12,7,0);c.rect(3,9,10,5,2);c.rect(6,8,4,5,3);c.rect(7,8,2,3,0);}
  c.dot(6,5,0);c.dot(10,5,0);return c;
}
for(const key of ['misty','surge','erika','giovanni','rocket','catcher','sailor','koga','sabrina','blaine','lorelei','bruno','agatha','lance']){
  const sourcePath=`artwork/campaign-imports/trainer-${key}.png`,assetPath=`assets/sprites/trainer-${key}.png`,bytes=person(key).png();await writeFile(path.join(root,sourcePath),bytes);
  manifest.sprites.push({key:'trainer-'+key,sourcePath,assetPath,profile:'static16x16',sourceSha256:hash(bytes)});
}
await writeFile(path.join(root,'artwork/campaign-asset-plan.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({maps:manifest.backgrounds.length,sprites:manifest.sprites.length,pokemon:manifest.creatures.length}));
