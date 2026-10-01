import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const plan=JSON.parse(await readFile(new URL('artwork/game-plan.json',root),'utf8'));
const header=await readFile(new URL('plugins/kanto-memory/engine/include/vm.h',root),'utf8');
const refs=new Set();
function walk(value){
  if(!value||typeof value!=='object')return;
  if(value.type==='variable'&&/^\d+$/.test(value.value))refs.add(String(value.value));
  for(const [key,item]of Object.entries(value)){
    if(['variable','vectorX','vectorY'].includes(key)&&/^\d+$/.test(item))refs.add(String(item));
    if(typeof item==='string')for(const match of item.matchAll(/\$(\d+)\$/g))refs.add(match[1]);
    if(typeof item==='object')walk(item);
  }
}
walk(plan.scripts);walk(plan.customScripts);
const heap=Number(header.match(/#define VM_HEAP_SIZE (\d+)/)[1]);
const contexts=Number(header.match(/#define VM_MAX_CONTEXTS (\d+)/)[1]);
const stack=Number(header.match(/#define VM_CONTEXT_STACK_SIZE (\d+)/)[1]);
assert.ok(refs.size<=heap,'all referenced variables fit the VM heap');
assert.equal(new Set(plan.variables.map(v=>v.variableId)).size,plan.variables.length,'variable IDs are unique');
for(const id of refs)assert.ok(plan.variables.some(v=>v.variableId===id),'variable '+id+' has editor metadata');
console.log(refs.size+'/'+heap+' VM variables; '+((heap+contexts*stack)*2)+' bytes of script memory. Linked RAM still requires build verification.');
