import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plan=JSON.parse(await readFile(path.join(root,'artwork/game-plan.json'),'utf8'));
const resources=[];
async function walk(dir){for(const d of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())await walk(p);else if(p.endsWith('.gbsres'))resources.push(JSON.parse(await readFile(p,'utf8')));}}
await walk(path.join(root,'project'));
const byId=Object.fromEntries(resources.map(r=>[r.id,r]));
function signature(e){const a=e.args||{};return JSON.stringify([e.command,a.variable,a.vectorX,a.actorId,a.label,a.input,a.condition?.valueA?.value,a.condition?.valueB?.value,a.condition?.type]);}
function fresh(e){return {...e,id:randomUUID(),...(e.children?{children:Object.fromEntries(Object.entries(e.children).map(([k,v])=>[k,v.map(fresh)]))}:{})};}
function align(old,next){
  const dp=Array.from({length:old.length+1},()=>new Uint16Array(next.length+1));
  for(let i=old.length-1;i>=0;i--)for(let j=next.length-1;j>=0;j--)dp[i][j]=signature(old[i])===signature(next[j])?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
  const matches=new Map();let i=0,j=0;
  while(i<old.length&&j<next.length){if(signature(old[i])===signature(next[j])){matches.set(j,old[i]);i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
  return next.map((e,k)=>{const before=matches.get(k);if(!before)return fresh(e);return {...before,...e,id:before.id,args:{...before.args,...e.args},...(e.children?{children:Object.fromEntries(Object.entries(e.children).map(([branch,list])=>[branch,align(before.children?.[branch]||[],list)]))}:{})};});
}
const groups=[];
for(const s of plan.scripts){const owner=byId[s.target.actorId||s.target.triggerId||s.target.sceneId],old=owner?.[s.target.scriptKey]||[];s.events=align(old,s.events);const wanted=new Set(s.events.map(e=>e.id)),oldIds=new Set(old.map(e=>e.id));
  const operations=old.filter(e=>!wanted.has(e.id)).map(e=>({type:'event.edit',action:'delete',target:s.target,eventId:e.id}));
  for(const [i,e]of s.events.entries())if(oldIds.has(e.id)){const before=old.find(x=>x.id===e.id);if(JSON.stringify(before)!==JSON.stringify(e))operations.push({type:'event.edit',action:'update',target:s.target,eventId:e.id,patch:{command:e.command,args:e.args,children:e.children||{}}});}else operations.push({type:'event.edit',action:'insert',target:s.target,event:e,index:i});
  if(operations.length)groups.push({sceneId:s.target.sceneId,operations});
}
await writeFile(path.join(root,'artwork/game-plan.json'),JSON.stringify(plan));
await writeFile(path.join(root,'artwork/native-edit-plan.json'),JSON.stringify(groups));
console.log(JSON.stringify({changedScripts:groups.length,operations:groups.reduce((n,g)=>n+g.operations.length,0)}));
