import { readFile } from 'node:fs/promises';
const groups=JSON.parse(await readFile(new URL('../artwork/native-edit-plan.json',import.meta.url),'utf8'));
const group=groups[Number(process.argv[2])];
if(!group)throw new Error('Unknown edit group');
console.log(JSON.stringify({sceneId:group.sceneId,operations:group.operations.slice(Number(process.argv[3]),Number(process.argv[3])+Number(process.argv[4]))}));
