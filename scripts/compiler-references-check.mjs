import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sceneCompilerReferences} from '../artwork/compiler-references.mjs';

const plan=JSON.parse(readFileSync(new URL('../artwork/game-plan.json',import.meta.url),'utf8'));
const scripts=new Map(plan.customScripts.map(s=>[s.id,s]));
const calls=events=>events.flatMap(e=>[
  ...(e.command==='EVENT_CALL_CUSTOM_EVENT'?[e.args.customEventId]:[]),
  ...Object.values(e.children||{}).flatMap(calls)
]);
let references=0;
const used=new Set();
for(const {root,references:expected} of sceneCompilerReferences(plan)){
  const primer=root.events[0];
  assert.equal(primer.command,'EVENT_GBVM_SCRIPT');
  assert.equal(primer.args.script,'','compile-only references must execute no assembly');
  assert.deepEqual(primer.args.references,expected,'complete callee-first scene catalog');
  const cached=new Set(),truncated=[];
  function compile(id,depth=5){
    if(cached.has(id))return;
    cached.add(id);used.add(id);
    if(depth<0){truncated.push(id);return;}
    for(const child of calls(scripts.get(id).script))compile(child,depth-1);
  }
  for(const ref of expected){compile(ref.id);references++;}
  for(const owner of plan.scripts.filter(s=>s.target.sceneId===root.target.sceneId)){
    for(const id of calls(owner.events))compile(id,4);
  }
  assert.deepEqual(truncated,[],'no shared routine reaches the compiler depth limit');
}
const target={sceneId:'scene',scriptKey:'script'};
const call=id=>({command:'EVENT_CALL_CUSTOM_EVENT',args:{customEventId:id}});
const fixture={scripts:[{target,events:[call('a')]}],customScripts:[
  {id:'a',script:[call('b')]},{id:'b',script:[]}
]};
assert.deepEqual(sceneCompilerReferences(fixture)[0].references.map(r=>r.id),['b','a']);
fixture.customScripts[1].script=[call('a')];
assert.throws(()=>sceneCompilerReferences(fixture),/Recursive/);
fixture.customScripts[1].script=[call('missing')];
assert.throws(()=>sceneCompilerReferences(fixture),/Missing/);
console.log(`${used.size} shared routines covered by ${references} dependency-ordered references across 68 scenes; no runtime assembly added.`);
