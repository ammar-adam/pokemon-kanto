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
const scripts=new Map(plan.customScripts.map(s=>[s.id,s]));
function checkEvents(events,owner){for(const e of events){
  if(owner&&e.args?.actorId&&!['player','$self$'].includes(e.args.actorId))assert.ok(owner.actors[e.args.actorId],'shared actor binding exists');
  if(e.command==='EVENT_CALL_CUSTOM_EVENT'){
    const target=scripts.get(e.args.customEventId);assert.ok(target,'shared script target exists');
    for(const id of Object.keys(target.actors))assert.equal(e.args[`$actor[${id}]$`],id,'scene actor is forwarded');
    for(const id of Object.keys(target.variables))assert.ok(e.args[`$variable[${id}]$`],'shared variable argument exists');
  }
  for(const list of Object.values(e.children||{}))checkEvents(list,owner);
}}
for(const s of plan.customScripts)checkEvents(s.script,s);
for(const s of plan.scripts)checkEvents(s.events);
console.log(refs.size+'/'+heap+' VM variables; '+((heap+contexts*stack)*2)+' bytes of script memory. Linked RAM still requires build verification.');
