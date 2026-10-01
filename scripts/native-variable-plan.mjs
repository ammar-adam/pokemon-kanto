import { readFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const plan=JSON.parse(await readFile(new URL('artwork/game-plan.json',root),'utf8'));
const native=JSON.parse(await readFile(new URL('project/variables.gbsres',root),'utf8'));
const existing=new Set(native.variables.map(v=>v.id));
console.log(JSON.stringify(plan.variables.filter(v=>!existing.has(v.variableId)).map(v=>({type:'variable.upsert',variableId:v.variableId,name:v.name,symbol:v.symbol}))));
