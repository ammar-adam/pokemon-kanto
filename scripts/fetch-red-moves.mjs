import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../artwork/',import.meta.url);
const {commit}=JSON.parse(await readFile(new URL('red-base-stats.json',root),'utf8'));
const source=`https://raw.githubusercontent.com/pret/pokered/${commit}/data/moves/moves.asm`;
const response=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Move data '+response.status);
const moves={};
for(const line of (await response.text()).split(/\r?\n/)){
  const match=line.match(/^\s*move\s+(\w+),\s*(\w+),\s*(\d+),\s*(\w+),\s*(\d+),\s*(\d+)/);if(!match)continue;
  const [,name,effect,power,type,accuracy,pp]=match;
  moves[name.replace(/_/g,'').replace(/^PSYCHICM$/,'PSYCHIC').toLowerCase()]={power:Number(power),type:type.replace('_TYPE',''),accuracy:Number(accuracy),pp:Number(pp),effect};
}
if(Object.keys(moves).length!==165)throw new Error('Expected all 165 original moves');
await writeFile(new URL('red-moves.json',root),JSON.stringify({source,moves},null,2)+'\n');
console.log('Retained 165 original move records.');
