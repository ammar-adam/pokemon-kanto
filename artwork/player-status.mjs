import {indexedDispatch} from './indexed-dispatch.mjs';

// Reuse each species' retired/format word: 1=archived, low two bits=format,
// quotient by four: 0=healthy, 1=paralysis, 2=poison, 3..5=sleep turns + 2.
export function playerStatusAuthoring({species,retired,IF,EX,V,set,math,rand,say,shared,effectiveness,storeHP}){
 const load=(out=307)=>[set(out,0),...indexedDispatch('player_status_load_'+out,1,species.map((_,i)=>({value:i+1,events:[set(out,V(retired(i))),math(out,'div',4)]})),{IF,shared})];
 const put=status=>[
  set(308,typeof status==='object'?status:status),math(308,'mul',4),
  ...indexedDispatch('player_status_store',1,species.map((_,i)=>({value:i+1,events:[set(16,V(retired(i))),math(16,'mod',4),math(16,'add',308,'var'),set(retired(i),V(16))]})),{IF,shared})
 ];
 const apply=(status,move,text)=>[
  ...load(),IF(307,'!=',0,[say('BUT IT FAILED!')],[
   set(135,V(16)),set(16,1),
   ...(status===1||status===2?effectiveness(4,1):[]),
   ...(status===2?[EX('$309$ == 8 || $310$ == 8',[set(16,0)])]:[]),
   IF(16,'>',0,[...put(status),say(text)],[say('IT HAS NO EFFECT!')]),set(16,V(135))
  ])
 ];
 const effects={
  PARALYZE_EFFECT:move=>apply(1,move,'YOUR POKEMON\nWAS PARALYZED!'),
  POISON_EFFECT:move=>apply(2,move,'YOUR POKEMON\nWAS POISONED!'),
  SLEEP_EFFECT:move=>[rand(15,3,5),...apply(V(15),move,'YOUR POKEMON\nFELL ASLEEP!')]
 };
 for(const [effect,chance,status] of [['POISON_SIDE_EFFECT1',20,2],['POISON_SIDE_EFFECT2',40,2],['PARALYZE_SIDE_EFFECT1',10,1],['PARALYZE_SIDE_EFFECT2',30,1]])effects[effect]=move=>[
  rand(15,1,100),IF(15,'<=',chance,apply(status,move,status===1?'YOUR POKEMON\nWAS PARALYZED!':'YOUR POKEMON\nWAS POISONED!'))
 ];
 const action=events=>[
  ...load(),IF(307,'>=',3,[
   IF(307,'==',3,[...put(0),say('YOUR POKEMON\nWOKE UP!')],[math(307,'sub',1),...put(V(307)),say('YOUR POKEMON\nIS FAST ASLEEP.')])
  ],[IF(307,'==',1,[rand(15,1,100),IF(15,'<=',25,[say('YOUR POKEMON\nIS PARALYZED!')],events)],events)])
 ];
 const residual=()=>[
  ...load(),EX('$307$ == 2 && $3$ > 0',[
   set(16,V(2)),math(16,'div',16),IF(16,'<',1,[set(16,1)]),math(3,'sub',16,'var'),IF(3,'<',0,[set(3,0)]),...storeHP(),say('POISON HURT\nYOUR POKEMON!')
  ])
 ];
 return {load,put,effects,action,residual};
}
