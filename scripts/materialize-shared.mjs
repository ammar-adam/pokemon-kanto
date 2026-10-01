import { readFile,writeFile,mkdir } from 'node:fs/promises';
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
console.log('Materialized '+plan.customScripts.length+' native shared scripts');
