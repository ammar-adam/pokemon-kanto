import { readFile,writeFile,mkdir,readdir,unlink,realpath } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const plan=JSON.parse(await readFile(path.join(root,'artwork/game-plan.json'),'utf8'));
// The installed semantic tools do not expose native custom-script creation.
const folder=path.join(root,'project/scripts');
await mkdir(folder,{recursive:true});
for(const script of plan.customScripts){
  const filename=path.join(folder,script.symbol+'.gbsres');
  let old={};try{old=JSON.parse(await readFile(filename,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  await writeFile(filename,JSON.stringify({...old,...script},null,2)+'\n');
}
// The deterministic plan owns these generated scripts. Retire obsolete banks
// and wrappers so stale unused files do not inflate native project indexing.
const owned=new Set(plan.customScripts.map(s=>s.id));
const canonicalFolder=await realpath(folder);
let retired=0;
for(const name of await readdir(folder)){
  if(!/^script_kanto_[a-z0-9_]+\.gbsres$/.test(name))continue;
  const filename=path.join(folder,name),canonical=await realpath(filename);
  if(path.dirname(canonical)!==canonicalFolder)throw new Error('Generated script leaves its owned folder');
  const resource=JSON.parse(await readFile(filename,'utf8'));
  if(resource._resourceType==='script'&&resource.description==='Shared Kanto game logic'&&!owned.has(resource.id)){
    await unlink(filename);retired++;
  }
}
console.log('Materialized '+plan.customScripts.length+' native shared scripts');
console.log('Retired '+retired+' obsolete generated scripts');
