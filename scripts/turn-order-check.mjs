import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {turnOrderAuthoring,movePriority} from '../artwork/turn-order.mjs';
import {redStats} from '../artwork/battle-damage.mjs';

const species=JSON.parse(readFileSync(new URL('../artwork/roster.json',import.meta.url),'utf8'));
const scripts=new Map();
const IF=(v,op,n,yes,no=[])=>({kind:'if',v,op,n,yes,no});
const EX=(expression,yes,no=[])=>({kind:'expression',expression,yes,no});
const V=v=>({v});
const set=(v,value)=>({kind:'set',v,value});
const math=(v,op,n,other='val')=>({kind:'math',v,op,n,other});
const rand=(v,min,max)=>({kind:'random',v,min,max});
const shared=(name,events)=>{if(!scripts.has(name))scripts.set(name,events);return [{kind:'call',name}];};
const enemyMoves={moves:[{id:1,name:'TACKLE'},{id:2,name:'QUICK ATTACK'},{id:3,name:'COUNTER'}],
  select:()=>[set(14,V(305))],counter:({selected})=>{assert.equal(selected,true);return [{kind:'enemy'}];}};
const author=turnOrderAuthoring({species,IF,EX,V,set,math,rand,shared,enemyMoves});
const turns=Object.fromEntries(['TACKLE','QUICK ATTACK','COUNTER'].map(move=>[move,author({move,events:[{kind:'player'}]})]));
function run(move,vars={},options={}){
  const state={0:50,1:1,3:100,4:2,5:100,7:50,305:1,104:35,...vars},order=[],rolls=[...(options.rolls||[])];
  const value=x=>typeof x==='object'?state[x.v]||0:x;
  let comparisons=0;
  const visit=events=>{for(const e of events){
    if(e.kind==='set')state[e.v]=value(e.value);
    else if(e.kind==='math'){const a=state[e.v]||0,b=e.other==='var'?state[e.n]||0:e.n;state[e.v]=e.op==='mul'?a*b:e.op==='div'?Math.trunc(a/b):a+b;assert.ok(state[e.v]>=-32768&&state[e.v]<=32767);}
    else if(e.kind==='if'){comparisons++;const a=state[e.v]||0,b=e.n;visit((e.op==='=='?a===b:e.op==='<'?a<b:e.op==='>'?a>b:e.op==='>='?a>=b:a<=b)?e.yes:e.no);}
    else if(e.kind==='expression'){const code=e.expression.replace(/\$(\d+)\$/g,(_,v)=>state[v]||0);assert.match(code,/^[0-9 <>=&|()]+$/);visit(Function('return '+code)()?e.yes:e.no);}
    else if(e.kind==='call')visit(scripts.get(e.name));
    else if(e.kind==='random'){assert.ok(rolls.length,'an explicit speed-tie roll is required');const n=rolls.shift();assert.ok(n>=e.min&&n<=e.max);state[e.v]=n;}
    else if(e.kind==='player'){order.push('player');state[104]--;state[5]=Math.max(0,state[5]-(options.playerDamage||1));state[14]=4;if(options.recoil)state[3]=0;}
    else if(e.kind==='enemy'){assert.equal(state[14],state[305],'the queued move survives the player callback');order.push('enemy');state[3]=Math.max(0,state[3]-(options.enemyDamage||1));state[14]=99;}
    else throw new Error(e.kind);
  }};
  visit(turns[move]);assert.equal(state[18],2);return {state,order,comparisons};
}
const speed=(dex,level)=>Math.floor((redStats[dex].speed+9)*level/50)+5;
let cases=0;
for(let i=0;i<species.length;i++)for(const level of [1,50,100])for(const foe of [1,24,49,100,150]){
  const a=speed(species[i].dex,level),b=speed(species[foe].dex,level);
  for(const tie of a===b?[0,1]:[0]){
    const result=run('TACKLE',{1:i+1,4:foe+1,0:level,7:level},{rolls:[tie]});
    assert.deepEqual(result.order,a<b||a===b&&tie===1?['enemy','player']:['player','enemy']);
    assert.ok(result.comparisons<40,'speed lookup is bounded');cases++;
  }
}
const slow=species.findIndex(p=>p.dex===79)+1,fast=species.findIndex(p=>p.dex===101)+1;
assert.deepEqual(run('QUICK ATTACK',{1:slow,4:fast}).order,['player','enemy']);
assert.deepEqual(run('TACKLE',{1:fast,4:slow,305:2}).order,['enemy','player']);
assert.deepEqual(run('COUNTER',{1:fast,4:slow}).order,['enemy','player']);
assert.deepEqual(run('TACKLE',{1:slow,4:fast,305:3}).order,['player','enemy']);
assert.deepEqual(run('QUICK ATTACK',{1:slow,4:fast,305:2}).order,['enemy','player']);
const moderate=species.findIndex(p=>p.dex===25)+1;
assert.deepEqual(run('TACKLE',{1:moderate,4:fast,69:1}).order,['player','enemy']);
let result=run('TACKLE',{1:slow,4:fast,3:1},{enemyDamage:1});
assert.deepEqual(result.order,['enemy']);assert.equal(result.state[104],35,'fainted before moving: no PP spent');
result=run('TACKLE',{1:fast,4:slow,5:1});assert.deepEqual(result.order,['player']);assert.equal(result.state[104],34);
assert.deepEqual(run('TACKLE',{1:fast,4:slow},{recoil:true}).order,['player']);
assert.equal(movePriority('QUICK ATTACK'),1);assert.equal(movePriority('Counter'),-1);assert.equal(movePriority('STRUGGLE'),0);
console.log(cases+' speed comparisons plus priority, ties, paralysis, queued identity and faint-before-action checks passed.');
