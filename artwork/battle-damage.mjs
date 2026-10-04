import {readFileSync} from 'node:fs';
import {indexedDispatch} from './indexed-dispatch.mjs';
export const redStats=JSON.parse(readFileSync(new URL('./red-base-stats.json',import.meta.url),'utf8')).stats;
const redMoves=JSON.parse(readFileSync(new URL('./red-moves.json',import.meta.url),'utf8')).moves;
export function moveStats(name){const key=name.toLowerCase().replace(/[^a-z]/g,'').replace('highjumpkick','hijumpkick');const m=redMoves[key];if(!m)throw new Error('Missing original move '+name);return m;}
export function damageAuthoring({species,IF,EX,V,set,math,chunked,shared,typeCode}){
  // Quotient/remainder multiplication avoids signed 16-bit GBVM overflow.
  // Inputs: factor 135, multiplier 308 (0..511), positive divisor 309.
  const multiplyDivide=()=>shared('damage_mul_div',[
    set(307,V(135)),math(307,'div',309,'var'),math(135,'mod',309,'var'),set(16,0),set(310,0),
    ...[256,128,64,32,16,8,4,2,1].flatMap(bit=>[
      math(16,'mul',2),set(301,V(309)),math(301,'sub',310,'var'),
      EX('$310$ >= $301$',[math(310,'sub',301,'var'),math(16,'add',1)],[math(310,'mul',2)]),
      IF(308,'>=',bit,[math(308,'sub',bit),math(16,'add',307,'var'),set(301,V(309)),math(301,'sub',135,'var'),
        EX('$310$ >= $301$',[math(310,'sub',301,'var'),math(16,'add',1)],[math(310,'add',135,'var')])])
    ])
  ]);
  const special='$300$ == 2 || $300$ == 3 || $300$ == 4 || $300$ == 5 || $300$ == 6 || $300$ == 11 || $300$ == 15';
  function base(attacker,defender,level,foeLevel){return [
    ...indexedDispatch('damage_attack_stats_'+attacker,attacker,species.map((p,i)=>({value:i+1,events:[
      set(308,redStats[p.dex].attack+9),EX(special,[set(308,redStats[p.dex].special+9)])
    ]})),{IF,shared}),
    ...indexedDispatch('damage_defense_stats_'+defender,defender,species.map((p,i)=>({value:i+1,events:[
      set(309,redStats[p.dex].defense+9),EX(special,[set(309,redStats[p.dex].special+9)])
    ]})),{IF,shared}),
    math(308,'mul',level,'var'),math(308,'div',50),math(308,'add',5),
    math(309,'mul',foeLevel,'var'),math(309,'div',50),math(309,'add',5),math(309,'mul',50),
    set(135,V(level)),math(135,'mul',2),math(135,'div',5),math(135,'add',2),math(135,'mul',301,'var'),
    ...multiplyDivide(),math(16,'add',2),IF(16,'>',999,[set(16,999)]),
    ...indexedDispatch('damage_stab_'+attacker,attacker,species.map((p,i)=>({value:i+1,events:[EX(p.types.map(t=>`$300$ == ${typeCode(t)}`).join(' || '),[
      set(135,V(16)),set(308,3),set(309,2),...multiplyDivide()
    ])]})),{IF,shared})
  ];}
  const variance=()=>[IF(16,'>',0,[set(135,V(16)),set(308,V(15)),set(309,255),...multiplyDivide(),IF(16,'==',0,[set(16,1)])])];
  return {base,variance,multiplyDivide};
}
