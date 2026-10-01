import { readFile,writeFile } from 'node:fs/promises';
const input=new URL('../artwork/native-edit-plan.json',import.meta.url);
const output=new URL('../artwork/native-scene-edits.json',import.meta.url);
if(process.argv[2]==='prepare'){
  const groups=JSON.parse(await readFile(input,'utf8')),scenes=new Map();
  for(const group of groups){const ops=scenes.get(group.sceneId)||[];ops.push(...group.operations);scenes.set(group.sceneId,ops);}
  const batches=[];
  for(const [sceneId,operations]of scenes){let group=[],size=0;for(const op of operations){const bytes=JSON.stringify(op).length;if(group.length&&(size+bytes>40000||group.length>=64)){batches.push({sceneId,operations:group});group=[];size=0;}group.push(op);size+=bytes;}if(group.length)batches.push({sceneId,operations:group});}
  await writeFile(output,JSON.stringify(batches));
  console.log(JSON.stringify({batches:batches.length,operations:batches.reduce((n,b)=>n+b.operations.length,0),largest:Math.max(...batches.map(b=>JSON.stringify(b).length))}));
}else{
  const batches=JSON.parse(await readFile(output,'utf8'));
  console.log(JSON.stringify(batches[Number(process.argv[2])]));
}
