import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { PNG } from 'pngjs';
import { Canvas,uuid,hash } from '../artwork/author-art.mjs';

const root=path.resolve(import.meta.dirname,'..');
const data=JSON.parse(await readFile(path.join(root,'artwork/kanto-data.json'),'utf8'));
const legacy=JSON.parse(await readFile(path.join(root,'artwork/campaign-asset-plan.json'),'utf8')).creatures.slice(0,20);
const oldDex=new Set(legacy.map(s=>s.dex));
const ordered=[...legacy.map(s=>data.roster.find(p=>p.dex===s.dex)),...data.roster.filter(p=>!oldDex.has(p.dex))];
const palette={FIRE:'charmander',GRASS:'bulbasaur',WATER:'squirtle',ICE:'squirtle',ELECTRIC:'pikachu',ROCK:'geodude',GROUND:'geodude',GHOST:'zubat',PSYCHIC:'zubat',POISON:'zubat',BUG:'bulbasaur',DRAGON:'squirtle',FLYING:'pidgey',NORMAL:'pidgey',FIGHTING:'charmander'};
const effects={recover:'heal','soft-boiled':'heal',rest:'heal','leech-seed':'seed','thunder-wave':'paralyze','stun-spore':'paralyze',hypnosis:'sleep','sleep-powder':'sleep',sing:'sleep','poison-powder':'poison',toxic:'poison',growl:'attackDown',smokescreen:'accuracyDown','sand-attack':'accuracyDown',harden:'guard','defense-curl':'guard',withdraw:'guard',barrier:'guard',reflect:'guard','light-screen':'guard',agility:'guard','double-team':'guard','focus-energy':'guard',splash:'splash'};
function choose(p){
  const legal=p.learnset.map(m=>data.moves[m.key]).filter(Boolean);
  const damage=legal.filter(m=>m.power>0&&!['explosion','self-destruct','dream-eater','hyper-beam'].includes(m.key));
  const basic=damage.find(m=>m.type==='NORMAL')||damage[0]||data.moves.tackle;
  const strong=damage.filter(m=>p.types.includes(m.type)).sort((a,b)=>b.power-a.power)[0]||damage.at(-1)||basic;
  const status=legal.filter(m=>effects[m.key]);
  const picked=[basic,strong,status[0]||data.moves.harden,status.at(-1)||data.moves.growl];
  return picked.map(m=>({...m,effect:m.power?'damage':effects[m.key]||'guard'}));
}
const roster=ordered.map((p,i)=>{
  const old=legacy[i],moveData=choose(p);
  return {...p,type:old?.type||p.types[0],palette:old?.palette||palette[p.types[0]],moves:old?.moves||moveData.map(m=>m.name),moveData,
    evolutions:data.evolutions.filter(e=>e.from===p.dex).map(e=>({...e,to:ordered.findIndex(q=>q.dex===e.to)+1})),index:i+1};
});
const folder=path.join(root,'artwork/roster-imports');
await mkdir(folder,{recursive:true});
const template=JSON.parse(await readFile(path.join(root,'artwork/pokemon-imports/charmander-centered.json'),'utf8'));
const palettes=['charmander','bulbasaur','squirtle','pikachu','geodude','zubat','onix','pidgey'];
function portrait(bytes){
  const png=PNG.sync.read(bytes),c=new Canvas(32,32,4);
  let left=png.width,top=png.height,right=-1,bottom=-1;
  for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3]>127){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  if(right<left)throw new Error('Blank sprite');
  const w=right-left+1,h=bottom-top+1,scale=Math.min(30/w,30/h,1),ow=Math.max(1,Math.round(w*scale)),oh=Math.max(1,Math.round(h*scale));
  for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){
    const sx=left+Math.min(w-1,Math.floor(x/scale)),sy=top+Math.min(h-1,Math.floor(y/scale)),at=(sy*png.width+sx)*4;
    if(png.data[at+3]<128)continue;
    const l=png.data[at]*.299+png.data[at+1]*.587+png.data[at+2]*.114;
    c.dot(Math.floor((32-ow)/2)+x,31-oh+y,l<65?0:l<155?2:3);
  }
  return c;
}
const imports=[];
for(const p of roster.slice(20)){
  const c=new Canvas(64,32,4);
  c.blit(portrait(await readFile(path.join(root,'artwork/reference/pokeapi',p.dex+'-front.png'))),0,0,4);
  c.blit(portrait(await readFile(path.join(root,'artwork/reference/pokeapi',p.dex+'-back.png'))),32,0,4);
  const bytes=c.png(),sourcePath='artwork/roster-imports/'+p.key+'.png',metadataPath='artwork/roster-imports/'+p.key+'.json';
  const m=structuredClone(template);m.id=uuid('roster:sprite:'+p.key);m.name=p.name;m.symbol='sprite_kanto_'+p.key.replaceAll('-','_');m.filename='kanto-'+p.key+'-centered.png';m.checksum=createHash('sha1').update(bytes).digest('hex');
  m.states.forEach((s,si)=>{s.id=uuid(p.key+':state:'+si);s.animations.forEach((a,ai)=>{a.id=uuid(p.key+':anim:'+si+':'+ai);a.frames.forEach((f,fi)=>{f.id=uuid(p.key+':frame:'+si+':'+ai+':'+fi);f.tiles.forEach((t,ti)=>{t.id=uuid(p.key+':tile:'+si+':'+ai+':'+fi+':'+ti);t.paletteIndex=palettes.indexOf(p.palette);});});});});
  const metadata=Buffer.from(JSON.stringify(m,null,2));
  await writeFile(path.join(root,sourcePath),bytes);await writeFile(path.join(root,metadataPath),metadata);
  imports.push({key:p.key,id:m.id,sourcePath,assetPath:'assets/sprites/'+m.filename,metadataPath,sourceSha256:hash(bytes),metadataSha256:hash(metadata),backSourceId:m.states[1].id});
}
await writeFile(path.join(root,'artwork/roster.json'),JSON.stringify(roster,null,2)+'\n');
await writeFile(path.join(root,'artwork/roster-asset-plan.json'),JSON.stringify(imports,null,2)+'\n');
console.log(JSON.stringify({species:roster.length,newSpritePairs:imports.length,evolutions:roster.flatMap(p=>p.evolutions).length}));
