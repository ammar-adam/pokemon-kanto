import { readFile,writeFile,readdir } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const ids=JSON.parse(await readFile(path.join(root,'artwork/pokemon-resource-ids.json'),'utf8'));
const roster=JSON.parse(await readFile(path.join(root,'artwork/roster.json'),'utf8'));
for(const pokemon of roster){
  const m=JSON.parse(await readFile(path.join(root,'assets/sprites/kanto-'+pokemon.key+'-centered.png.gbsres'),'utf8'));
  ids.sprites[pokemon.key]=m.id;ids.back[pokemon.key]=m.states[1].id;
}
const art=JSON.parse(await readFile(path.join(root,'artwork/campaign-asset-plan.json'),'utf8'));
for(const sprite of art.sprites.filter(s=>s.key.startsWith('trainer-'))){
  const m=JSON.parse(await readFile(path.join(root,sprite.assetPath+'.gbsres'),'utf8'));ids.sprites[sprite.key]=m.id;
}
for(const map of art.backgrounds){if(!ids.scenes[map.key]&&map.sceneId)ids.scenes[map.key]=map.sceneId;}
try{for(const map of JSON.parse(await readFile(path.join(root,'artwork/opening-asset-plan.json'),'utf8')))ids.scenes[map.key]=map.sceneId;}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile(path.join(root,'artwork/pokemon-resource-ids.json'),JSON.stringify(ids,null,2)+'\n');
console.log('Indexed '+roster.length+' Pokemon sprite pairs and '+Object.keys(ids.scenes).length+' scene IDs');
