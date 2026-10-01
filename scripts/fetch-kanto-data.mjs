import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root=path.resolve(import.meta.dirname,'..');
const cache=path.join(root,'artwork/reference/pokeapi');
await mkdir(cache,{recursive:true});
const api='https://pokeapi.co/api/v2/';
async function json(endpoint){
  const filename=path.join(cache,endpoint.replaceAll('/','-')+'.json');
  try{return JSON.parse(await readFile(filename,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const response=await fetch(api+endpoint+'/',{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(endpoint+': '+response.status);
  const data=await response.json();
  await writeFile(filename,JSON.stringify(data));
  return data;
}
async function png(url,filename){
  const output=path.join(cache,filename);
  try{await readFile(output);return;}catch(error){if(error.code!=='ENOENT')throw error;}
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(url+': '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.readUInt32BE(0)!==0x89504e47)throw new Error('Expected PNG');
  await writeFile(output,bytes);
}
const roster=[];
for(let dex=1;dex<=151;dex++){
  const pokemon=await json('pokemon/'+dex);
  const species=await json('pokemon-species/'+dex);
  if(pokemon.id!==dex||species.id!==dex)throw new Error('Unexpected API identity');
  const types=(pokemon.past_types.find(p=>p.generation.name==='generation-i')?.types||pokemon.types).map(t=>t.type.name.toUpperCase());
  // Fairy was introduced later; preserve the original Kanto typing.
  for(let i=0;i<types.length;i++)if(types[i]==='FAIRY')types[i]='NORMAL';
  const eligible=pokemon.moves.flatMap(m=>m.version_group_details.filter(v=>v.version_group.name==='red-blue'&&v.move_learn_method.name==='level-up').map(v=>({key:m.move.name,level:v.level_learned_at}))).sort((a,b)=>a.level-b.level);
  roster.push({dex,key:pokemon.name,name:({'nidoran-f':'NIDORAN F','nidoran-m':'NIDORAN M','mr-mime':'MR MIME',farfetchd:'FARFETCHD'}[pokemon.name]||pokemon.name.toUpperCase()),types,baseStats:Object.fromEntries(pokemon.stats.map(s=>[s.stat.name,s.base_stat])),catchRate:species.capture_rate,chain:Number(species.evolution_chain.url.split('/').at(-2)),learnset:eligible,source:api+'pokemon/'+dex+'/'});
  const sprites=pokemon.sprites.versions['generation-ii'].crystal;
  await png(sprites.front_default||pokemon.sprites.front_default,dex+'-front.png');
  await png(sprites.back_default||pokemon.sprites.back_default,dex+'-back.png');
  if(dex%20===0)console.log('Cached '+dex+'/151 species and sprite pairs');
}
const moves={};
for(const key of new Set(roster.flatMap(p=>p.learnset.map(m=>m.key)))){
  const m=await json('move/'+key);
  moves[key]={key,name:m.name.replaceAll('-',' ').toUpperCase(),type:m.type.name.toUpperCase(),power:m.power||0,accuracy:m.accuracy||100,pp:m.pp,damageClass:m.damage_class.name,ailment:m.meta?.ailment?.name||'none'};
}
const evolutions=[];
for(const chain of new Set(roster.map(p=>p.chain))){
  const data=await json('evolution-chain/'+chain);
  function visit(node){
    const from=Number(node.species.url.split('/').at(-2));
    for(const next of node.evolves_to){
      const to=Number(next.species.url.split('/').at(-2));
      if(from<=151&&to<=151)for(const detail of next.evolution_details)evolutions.push({from,to,trigger:detail.trigger.name,level:detail.min_level,item:detail.item?.name||null});
      visit(next);
    }
  }
  visit(data.chain);
}
const data={source:'PokeAPI v2; sprite references from PokeAPI/sprites (Generation II Crystal)',roster,moves,evolutions};
await writeFile(path.join(root,'artwork/kanto-data.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({species:roster.length,moves:Object.keys(moves).length,evolutions:evolutions.length,sha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')}));
