import assert from 'node:assert/strict';
import {indexedDispatch} from '../artwork/indexed-dispatch.mjs';
for(const length of [0,1,8,9,151,512]){
  const scripts=new Map();
  const shared=(name,events)=>{scripts.set(name,events);return [{call:name}];};
  const IF=(variable,operator,value,yes,no=[])=>({variable,operator,value,yes,no});
  const rows=Array.from({length},(_,i)=>({value:i*2+1,events:[{set:i*2+2}]}));
  const root=indexedDispatch('lookup',1,rows,{IF,shared});
  for(let input=-1;input<=length*2+1;input++){
    let selector=input,comparisons=0,hits=0;
    const run=events=>{for(const e of events){
      if(e.call)run(scripts.get(e.call));
      else if(e.set!==undefined){selector=e.set;hits++;}
      else {comparisons++;run((e.operator==='<'?selector<e.value:selector===e.value)?e.yes:e.no);}
    }};
    run(root);
    const exists=rows.some(row=>row.value===input);
    assert.equal(hits,exists?1:0,'exactly one matching branch, even if the selector changes');
    assert.equal(selector,exists?input+1:input);
    assert.ok(comparisons<=Math.ceil(Math.log2(Math.max(1,length/8)))+8,'bounded comparisons');
  }
}
const dummy={IF:()=>({}),shared:()=>[]};
assert.throws(()=>indexedDispatch('bad',1,[{value:2},{value:1}],dummy),/sorted/);
assert.throws(()=>indexedDispatch('bad',1,[{value:1},{value:1}],dummy),/unique/);
assert.throws(()=>indexedDispatch('bad',1,[],dummy,0),/leaf size/);
console.log('Indexed dispatch boundaries, sparse keys, selector mutation and logarithmic work passed.');
