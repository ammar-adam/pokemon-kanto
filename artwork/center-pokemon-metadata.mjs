import { readFile,writeFile } from 'node:fs/promises';
import { hash } from './author-art.mjs';
const art=JSON.parse(await readFile(new URL('pokemon-asset-plan.json',import.meta.url),'utf8'));
const centered=[];
for(const item of art.sprites.filter(s=>s.profile==='native_metadata')){
  const png=await readFile(new URL('../'+item.sourcePath,import.meta.url));
  const meta=JSON.parse(await readFile(new URL('../'+item.metadataPath,import.meta.url),'utf8'));
  for(const state of meta.states)for(const a of state.animations)for(const f of a.frames)for(const tile of f.tiles)tile.x-=8;
  meta.boundsX=-8;
  const metadataPath=`artwork/pokemon-imports/${item.key}-centered.json`,bytes=Buffer.from(JSON.stringify(meta,null,2));
  await writeFile(new URL('../'+metadataPath,import.meta.url),bytes,{flag:'wx'});
  centered.push({...item,assetPath:`assets/sprites/kanto-${item.key}-centered.png`,metadataPath,sourceSha256:hash(png),metadataSha256:hash(bytes)});
}
await writeFile(new URL('centered-asset-plan.json',import.meta.url),JSON.stringify(centered));
console.log('Centered eight native 32x32 metasprites without changing any PNG pixels.');
