import {redStats} from './battle-damage.mjs';
import {indexedDispatch} from './indexed-dispatch.mjs';

export const movePriority=move=>{
  const key=move.toLowerCase().replace(/[^a-z]/g,'');
  return key==='quickattack'?1:key==='counter'?-1:0;
};

// Evolution scratch is idle during a move: 304 holds order, 306 the queued foe move.
// The completed-turn marker 18=2 prevents the scene from giving the foe a second action.
export function turnOrderAuthoring({species,IF,EX,V,set,math,rand,shared,enemyMoves}) {
  const emitted=new Set();
  const once=(name,create)=>{
    if(emitted.has(name))return shared(name,[]);
    emitted.add(name);return shared(name,create());
  };
  const speed=(selector,level,out)=>[
    ...indexedDispatch('turn_speed_'+selector,selector,species.map((p,i)=>({value:i+1,events:[set(out,redStats[p.dex].speed+9)]})),{IF,shared}),
    math(out,'mul',level,'var'),math(out,'div',50),math(out,'add',5)
  ];
  const compare=()=>once('turn_compare_speed',()=>[
    ...speed(1,0,308),...speed(4,7,309),
    IF(69,'==',1,[math(309,'div',4),IF(309,'<',1,[set(309,1)])]),
    EX('$308$ < $309$',[set(304,1)],[EX('$308$ == $309$',[rand(304,0,1)])])
  ]);
  const enemy=()=>once('turn_queued_enemy',()=>[
    EX('$3$ > 0 && $5$ > 0',[set(14,V(306)),...enemyMoves.counter({selected:true})])
  ]);
  function before(priority){return once('turn_before_'+(priority+1),()=>[
    set(304,0),...enemyMoves.select(),set(306,V(14)),set(307,0),
    ...enemyMoves.moves.filter(m=>movePriority(m.name)!==0).map(m=>IF(306,'==',m.id,[set(307,movePriority(m.name))])),
    IF(307,'>',priority,[set(304,1)],[IF(307,'==',priority,compare())]),
    IF(304,'==',1,enemy())
  ]);}
  return ({move,events})=>[
    ...before(movePriority(move)),
    EX('$3$ > 0 && $5$ > 0',events),
    ...once('turn_after_player',()=>[IF(304,'==',0,enemy()),set(18,2)])
  ];
}
