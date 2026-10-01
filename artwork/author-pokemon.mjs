import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, MapArt, text, uuid, hash } from './author-art.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = { sprites: [], backgrounds: [], palettes: [], creatures: [
  {key:'charmander',name:'CHARMANDER',type:'FIRE',palette:'charmander',dex:4,moves:['SCRATCH','EMBER','GROWL','SMOKESCREEN']},
  {key:'bulbasaur',name:'BULBASAUR',type:'GRASS',palette:'bulbasaur',dex:1,moves:['TACKLE','VINE WHIP','GROWL','LEECH SEED']},
  {key:'squirtle',name:'SQUIRTLE',type:'WATER',palette:'squirtle',dex:7,moves:['TACKLE','WATER GUN','TAIL WHIP','WITHDRAW']},
  {key:'pikachu',name:'PIKACHU',type:'ELECTRIC',palette:'pikachu',dex:25,moves:['QUICK ATTACK','THUNDERSHOCK','GROWL','THUNDER WAVE']},
  {key:'geodude',name:'GEODUDE',type:'ROCK',palette:'geodude',dex:74,moves:['TACKLE','ROCK THROW','DEFENSE CURL','HARDEN']},
  {key:'zubat',name:'ZUBAT',type:'FLYING',palette:'zubat',dex:41,moves:['BITE','WING ATTACK','SUPERSONIC','LEECH LIFE']},
  {key:'onix',name:'ONIX',type:'ROCK',palette:'onix',dex:95,moves:['TACKLE','ROCK THROW','SCREECH','HARDEN']},
  {key:'pidgey',name:'PIDGEY',type:'FLYING',palette:'pidgey',dex:16,moves:['QUICK ATTACK','GUST','SAND ATTACK','AGILITY']}
] };
const colorSets = [
  ['fff0bf','f29042','bd4c28','30202c'], ['e3f7da','65b99d','2d746e','1a3433'],
  ['f0f7d9','73bee0','477eaa','233a53'], ['fffacb','edd34d','b2762d','352831'],
  ['f4efdf','a6a29b','686766','302d31'], ['e5deff','8d8cdc','505bb0','252443'],
  ['f4efdf','adaaa3','716d68','363136'], ['fff0cd','c6a071','916540','332936']
];
manifest.creatures.forEach((c,i)=>manifest.palettes.push({key:c.key,name:c.name,colors:colorSets[i]}));
manifest.palettes.push({key:'red',name:'Red and Kanto Trainers',colors:['fff1d5','df6261','9b454a','292732']});
function pokemon(n, back=false) {
  const c = new Canvas(32,32,4);
  const oval=(x,y,w,h,ink=2)=>{c.oval(x,y,w,h,0);c.oval(x+1,y+1,w-2,h-2,ink);};
  const eye=(x,y)=>{c.rect(x,y,3,5,0);c.dot(x,y,3);};
  if(n===1){
    c.line(22,25,29,19,0);c.line(23,25,29,20,2);
    c.line(28,20,27,12,0);c.line(27,12,30,7,0);c.line(30,7,31,15,0);
    c.rect(28,12,3,7,2);c.rect(29,14,2,4,3);
    oval(8,14,16,16);oval(4,3,20,16);c.oval(11,20,9,8,3);
    c.line(9,19,4,22,0);c.line(8,20,5,22,2);c.line(21,19,25,22,0);
    c.rect(7,28,7,3,0);c.rect(20,27,6,4,0);c.rect(8,28,4,1,3);c.rect(22,28,3,1,3);
    if(!back){eye(7,7);eye(17,7);c.line(10,15,18,15,0);c.dot(20,13,0);}
    else {c.line(9,7,16,5,3);c.line(11,19,18,18,0);c.oval(10,19,9,7,2);}
  }else if(n===2){
    oval(7,11,24,15);oval(11,2,16,14);c.line(18,3,18,13,0);c.line(12,7,22,7,0);
    c.line(19,2,24,0,0);c.line(19,3,24,1,2);c.line(18,4,13,1,0);
    c.rect(10,24,6,6,0);c.rect(11,24,4,5,2);c.rect(24,23,5,6,0);c.rect(25,24,3,4,2);
    oval(1,12,18,15);c.line(3,14,3,9,0);c.line(3,9,7,13,0);c.line(13,13,16,8,0);c.line(16,8,18,15,0);
    c.rect(3,26,5,5,0);c.rect(4,26,3,3,2);c.rect(15,25,5,5,0);c.rect(16,25,3,3,2);
    c.rect(5,15,2,2,0);c.rect(22,20,3,2,0);c.dot(7,25,0);
    if(!back){eye(3,18);eye(12,18);c.line(7,24,11,24,0);}else{c.line(5,18,13,17,3);}
  }else if(n===3){
    c.line(25,23,30,26,0);c.line(30,26,29,30,0);c.line(29,30,26,28,0);c.dot(28,27,2);
    oval(10,14,18,16,3);c.oval(11,15,15,13,0);c.oval(12,16,13,11,2);
    c.line(13,18,23,25,3);c.line(23,18,14,25,3);
    oval(3,2,20,17);oval(3,18,7,8);oval(22,18,7,8);
    c.rect(8,27,6,4,0);c.rect(20,27,6,4,0);c.rect(9,28,4,2,2);c.rect(21,28,4,2,2);
    if(!back){eye(6,7);eye(16,7);c.line(9,14,17,14,0);c.oval(12,20,7,8,3);c.line(13,24,18,24,0);}else{c.line(8,6,15,4,3);}
  }else if(n===4){
    c.line(7,12,3,0,0);c.line(8,12,5,0,0);c.line(9,11,6,2,2);
    c.line(20,11,23,0,0);c.line(21,11,26,0,0);c.line(22,11,25,3,2);
    c.rect(3,0,3,4,0);c.rect(24,0,3,4,0);
    c.line(23,25,30,21,0);c.line(30,21,26,17,0);c.line(26,17,31,11,0);
    c.line(23,26,29,22,2);c.line(28,21,25,17,2);c.line(26,16,31,12,2);
    oval(7,15,17,15);oval(4,8,21,14);c.rect(5,28,7,3,0);c.rect(19,28,7,3,0);
    c.line(8,22,4,25,0);c.line(23,22,27,25,0);
    if(!back){eye(7,12);eye(17,12);c.rect(5,17,3,2,0);c.rect(21,17,3,2,0);c.dot(14,18,0);c.line(12,20,17,20,0);}
    else{c.line(8,21,20,21,0);c.line(10,25,20,25,0);c.line(9,12,16,11,3);}
  }else if(n===5){
    c.line(8,19,3,17,0);c.line(3,17,3,7,0);c.rect(1,4,7,7,0);c.rect(2,5,5,5,2);c.line(3,12,5,17,2);
    c.line(24,19,29,16,0);c.line(29,16,28,7,0);c.rect(25,3,7,7,0);c.rect(26,4,5,5,2);
    oval(7,11,19,17);c.line(11,13,17,12,3);c.line(20,14,24,18,3);c.line(12,24,15,26,0);
    if(!back){c.line(10,17,14,18,0);c.line(18,18,22,16,0);c.dot(12,19,0);c.dot(20,19,0);c.line(13,23,20,23,0);}
    else{c.line(13,16,17,18,0);c.line(17,18,21,15,0);}
  }else if(n===6){
    for(const [x,sign] of [[12,-1],[19,1]]){
      c.line(x,14,x+sign*11,4,0);c.line(x+sign*11,4,x+sign*10,23,0);c.line(x+sign*10,23,x+sign*5,18,0);c.line(x+sign*5,18,x,27,0);
      for(let j=0;j<12;j++)c.line(x,14+j/2,x+sign*(9-Math.floor(j/4)),8+j,2);
      c.line(x,15,x+sign*9,8,0);c.line(x,16,x+sign*7,20,0);
    }
    oval(11,8,11,20);c.line(12,11,11,3,0);c.line(11,3,15,9,0);c.line(19,9,22,3,0);c.line(22,3,21,13,0);
    c.line(14,26,12,31,0);c.line(18,26,21,31,0);
    if(!back){c.oval(13,14,7,10,0);c.rect(14,15,1,4,3);c.rect(18,15,1,4,3);c.rect(16,22,2,2,3);}else{c.line(14,12,18,11,3);}
  }else if(n===7){
    for(const [x,y,w,h] of [[22,26,5,5],[18,24,7,7],[12,23,9,8],[5,20,10,10],[1,14,10,11],[4,7,11,11],[10,6,12,12]])oval(x,y,w,h);
    oval(16,3,15,13);c.line(21,5,20,0,0);c.line(20,0,25,5,0);c.line(22,2,23,5,2);
    c.line(4,18,9,17,3);c.line(8,23,12,23,3);c.line(16,25,19,27,0);
    if(!back){c.line(18,7,22,9,0);c.line(24,9,28,7,0);c.dot(20,10,0);c.dot(26,10,0);c.line(21,13,28,13,0);}else{c.line(20,7,26,6,3);}
  }else{
    c.line(22,24,30,22,0);c.line(30,22,28,28,0);c.line(28,28,21,28,0);
    oval(6,12,21,17);c.oval(8,14,12,12,3);c.line(13,18,24,24,0);
    oval(6,4,17,15);c.line(11,7,13,0,0);c.line(13,0,17,7,0);c.line(15,6,19,2,0);
    c.line(6,13,1,15,0);c.line(1,15,7,17,0);c.line(9,28,8,31,0);c.line(19,28,20,31,0);
    if(!back){eye(9,9);c.line(7,8,12,7,0);c.dot(3,15,3);}else{c.line(10,9,17,8,3);}
  }
  return c;
}
function person(kind,frame=0){
  const c=new Canvas(16,16,4);c.rect(4,2,8,7,0);c.rect(5,3,6,5,3);
  c.rect(4,8,8,6,0);c.rect(5,9,6,4,kind==='oak'||kind==='joy'?3:2);
  c.rect(2,9,2,4,0);c.rect(12,9,2,4,0);c.dot(3,10,3);c.dot(12,10,3);
  c.rect(4+frame%2,13,3,3,0);c.rect(9-frame%2,13,3,3,0);
  if(kind==='red'){c.rect(3,1,9,3,0);c.rect(4,1,7,2,2);c.rect(3,4,11,1,2);c.dot(8,2,3);}
  if(kind==='oak'){c.rect(4,0,8,4,0);c.rect(5,1,6,3,3);c.rect(3,3,2,2,3);c.line(7,9,8,12,0);}
  if(kind==='joy'){c.rect(3,1,10,4,2);c.rect(5,0,6,3,3);c.rect(7,0,2,3,2);c.rect(6,1,4,1,2);c.rect(2,4,2,5,2);c.rect(12,4,2,5,2);}
  if(kind==='brock'){c.rect(3,1,10,3,0);c.rect(4,0,2,3,0);c.rect(8,0,2,3,0);c.line(5,5,7,5,0);c.line(9,5,11,5,0);c.rect(5,8,6,4,3);}
  if(kind==='blue'){c.rect(4,0,2,4,0);c.rect(7,1,2,3,0);c.rect(10,0,2,4,0);c.rect(3,2,10,2,0);}
  if(kind!=='brock'){c.dot(6,5,0);c.dot(10,5,0);}return c;
}
async function sprite(key,c,slot=null){
  const sourcePath=`artwork/pokemon-imports/${key}.png`,assetPath=`assets/sprites/kanto-${key}.png`,bytes=c.png();
  await writeFile(path.join(root,sourcePath),bytes,{flag:'wx'});
  const item={key,sourcePath,assetPath,profile:key==='red'?'directional_animated':'static'};
  if(slot!==null){
    const meta={_resourceType:'sprite',id:uuid('kanto:'+key),name:key,symbol:`sprite_kanto_${key}`,filename:`kanto-${key}.png`,width:64,height:32,checksum:createHash('sha1').update(bytes).digest('hex'),numTiles:16,canvasOriginX:0,canvasOriginY:0,canvasWidth:32,canvasHeight:32,boundsX:0,boundsY:-16,boundsWidth:32,boundsHeight:32,animSpeed:15,
      states:['','back'].map((name,s)=>({id:uuid(`kanto:${key}:state:${s}`),name,animationType:'fixed',flipLeft:false,animations:Array.from({length:8},(_,a)=>({id:uuid(`kanto:${key}:${s}:${a}`),frames:[{id:uuid(`kanto:${key}:${s}:${a}:frame`),tiles:a?[]:Array.from({length:8},(_,t)=>({id:uuid(`kanto:${key}:${s}:${a}:tile:${t}`),x:t%4*8-8,y:Math.floor(t/4)*16,sliceX:s*32+t%4*8,sliceY:16-Math.floor(t/4)*16,flipX:false,flipY:false,palette:0,paletteIndex:slot,objPalette:'OBP0',priority:false}))}]}))}))};
    const metadataPath=`artwork/pokemon-imports/${key}.json`,m=Buffer.from(JSON.stringify(meta,null,2));
    await writeFile(path.join(root,metadataPath),m,{flag:'wx'});Object.assign(item,{profile:'native_metadata',metadataPath,sourceSha256:hash(bytes),metadataSha256:hash(m),backSourceId:meta.states[1].id});
  }manifest.sprites.push(item);
}
async function background(key,map){const sourcePath=`artwork/pokemon-imports/${key}.png`;await writeFile(path.join(root,sourcePath),map.c.png(),{flag:'wx'});manifest.backgrounds.push({key,sourcePath,assetPath:`assets/backgrounds/kanto-${key}.png`,width:map.w,height:map.h});}
await mkdir(path.join(root,'artwork/pokemon-imports'),{recursive:true});
const red=new Canvas(96,16,4);
for(let i=0;i<6;i++){const c=person('red',i);if(i===2||i===3){c.rect(5,4,6,4,2);c.rect(6,9,4,4,3);}if(i>3){c.rect(3,4,5,4,4);c.rect(10,4,3,4,3);c.dot(11,5,0);c.rect(3,9,4,4,3);}red.blit(c,i*16,0,4);}
await sprite('red',red);for(const kind of ['oak','joy','brock','blue'])await sprite(kind,person(kind));
const sheet=new Canvas(8*40,80,3);
for(let i=0;i<8;i++){const c=new Canvas(64,32,4),front=pokemon(i+1),back=pokemon(i+1,true);c.blit(front,0,0,4);c.blit(back,32,0,4);await sprite(manifest.creatures[i].key,c,i);sheet.blit(front,i*40+4,2,4);sheet.blit(back,i*40+4,42,4);}
await writeFile(path.join(root,'artwork/pokemon-sprites-review.png'),sheet.png(),{flag:'wx'});
const town=new MapArt(32,26);town.edges();town.area(14,1,4,24,'path',1);town.area(3,15,25,3,'path',1);town.area(1,19,7,6,'water',3,15);
for(const [x,y] of [[0,0],[2,0],[4,0],[6,0],[8,0],[10,0],[12,0],[18,0],[20,0],[22,0],[24,0],[26,0],[28,0],[30,0],[0,3],[30,3],[0,6],[30,6],[0,9],[30,9],[0,12],[30,12],[30,18],[30,21]])town.tree(x,y);
town.house(4,6,8,7,'OAK LAB');town.house(21,6,8,7,'GYM');town.house(21,19,7,6,'CENTER');town.area(4,19,7,2,'path',1);town.area(10,20,4,3,'flower',2);town.area(14,0,4,3,'path',1);town.block.fill(0,14,18);
town.c.rect(8*8,15*8,6*8,8,3);text(town.c,'PALLET',8*8+1,15*8);await background('fernvale',town);
const lab=new MapArt(20,18,'floor',4);lab.edges();lab.area(0,0,20,3,'stone',4,15);lab.area(2,3,4,4,'stone',4,15);lab.area(14,3,4,4,'stone',4,15);
lab.c.rect(16,25,30,29,0);lab.c.rect(18,27,26,24,3);text(lab.c,'OAK',22,29);text(lab.c,'LAB',22,39);
for(let x=5;x<=13;x+=4){lab.area(x,6,2,2,'stone',4,15);lab.c.oval(x*8+3,50,10,10,0);lab.c.oval(x*8+4,51,8,8,3);lab.c.rect(x*8+4,51,8,4,2);lab.c.dot(x*8+8,54,0);}
lab.area(8,11,4,7,'path',2);await background('laboratory',lab);
const arena=new MapArt(20,18,'floor',4);arena.edges();arena.area(0,0,20,3,'stone',4,15);arena.area(0,3,2,12,'stone',4,15);arena.area(18,3,2,12,'stone',4,15);arena.area(5,5,10,8,'path',2);
arena.c.rect(40,40,80,64,0);arena.c.rect(42,42,76,60,3);arena.c.line(42,72,117,72,2);arena.c.oval(66,59,28,28,0);arena.c.oval(68,61,24,24,3);arena.c.line(68,73,91,73,0);arena.c.oval(77,70,6,6,0);
text(arena.c,'PEWTER GYM',50,8);arena.area(8,14,4,4,'path',2);await background('arena',arena);
const title=new MapArt(20,18,'floor',5);title.c.rect(0,0,160,144,3);
text(title.c,'POKEMON',39,10,0,2);text(title.c,'KANTO CHAPTER',41,31,0);
title.c.blit(pokemon(2),15,51,4);title.c.blit(pokemon(1),65,44,4);title.c.blit(pokemon(3),112,51,4);
title.c.line(8,91,151,91,0);text(title.c,'OAK TO BROCK',47,98,0);
await background('title',title);
await writeFile(path.join(root,'artwork/pokemon-asset-plan.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({sprites:manifest.sprites.length,backgrounds:manifest.backgrounds.length,pokemon:manifest.creatures.length}));
