import {readFileSync} from 'node:fs';
import {indexedDispatch} from './indexed-dispatch.mjs';

const catalog=JSON.parse(readFileSync(new URL('./red-moves.json',import.meta.url),'utf8')).moves;
const names=new Map();
for(const record of Object.values(JSON.parse(readFileSync(new URL('./red-learnsets.json',import.meta.url),'utf8')).species))for(const name of [...record.initialMoves,...record.levelUp.map(r=>r.move)])names.set(name.toLowerCase().replace(/[^a-z]/g,'').replace('highjumpkick','hijumpkick'),name);
export const MOVE_RADIX=100;
export const storedMoveCatalog=Object.freeze(Object.keys(catalog).sort().map((key,index)=>Object.freeze({id:index+1,key,name:names.get(key)||key.toUpperCase(),...catalog[key]})));
const normalize=name=>name.toLowerCase().replace(/[^a-z]/g,'').replace('highjumpkick','hijumpkick');
export const moveID=name=>{const move=storedMoveCatalog.find(m=>m.key===normalize(name));if(!move)throw new Error('Unknown stored move '+name);return move.id;};
export function packMove(id,pp){
 if(!Number.isInteger(id)||id<0||id>storedMoveCatalog.length||!Number.isInteger(pp)||pp<0||pp>=MOVE_RADIX||(!id&&pp))throw new RangeError('Invalid move word');
 return id*MOVE_RADIX+pp;
}
export function unpackMove(word){
 if(!Number.isInteger(word)||word<0||word>storedMoveCatalog.length*MOVE_RADIX+99)throw new RangeError('Invalid move word');
 const id=Math.trunc(word/MOVE_RADIX),pp=word%MOVE_RADIX;if(!id&&pp)throw new RangeError('Invalid empty slot');return {id,pp};
}
export function learnStoredMove(words,id){
 if(words.length!==4)throw new RangeError('Four slots required');if(!Number.isInteger(id)||id<1||id>storedMoveCatalog.length)throw new RangeError('Invalid learned move');const next=words.map(w=>{unpackMove(w);return w;});
 if(next.some(w=>unpackMove(w).id===id))return next;
 const value=packMove(id,storedMoveCatalog[id-1].pp),empty=next.indexOf(0);
 if(empty>=0)next[empty]=value;else{next.shift();next.push(value);}return next;
}

// Existing four PP words now store move identity * 100 + remaining PP.
// Retired flag: 1 is archived; bit 1 marks the new move format. Higher bits are reserved for status.
export function storedMoveLearningAuthoring({species,IF,EX,V,set,math,menu:makeMenu,say,shared,lv,pp,retired,movesAtLevel,redLearnsets,onMove,onStruggle,onTurn=({events})=>events}){
 const emitted=new Set();
 const once=(name,create)=>{const body=emitted.has(name)?[]:create();emitted.add(name);return shared(name,body);};
 const values=index=>Array.from({length:4},(_,slot)=>pp(index,slot));
 function atLevel(index,create){
  const tiers=[];for(let level=1;level<=100;level++){
   const moves=movesAtLevel(species[index].dex,level),last=tiers.at(-1);
   if(!last||last.moves.join('|')!==moves.join('|'))tiers.push({level,moves});
  }
  return tiers.reduce((previous,tier,i)=>i?[IF(lv(index),'>=',tier.level,create(tier.moves),previous)]:create(tier.moves),[]);
 }
 const initializeMoves=index=>once('learned_initialize_'+index,()=>[
  ...atLevel(index,moves=>values(index).map((variable,slot)=>set(variable,moves[slot]?packMove(moveID(moves[slot]),catalog[normalize(moves[slot])].pp):0))),
  math(retired(index),'mod',4),set(retired(index),2)
 ]);
 const ensureMoves=index=>once('learned_pack_'+index,()=>[
  EX(`$${retired(index)}$ % 4 == 0`,[
   ...atLevel(index,moves=>values(index).flatMap((variable,slot)=>moves[slot]?[
    IF(variable,'<',0,[set(variable,0)]),IF(variable,'>',catalog[normalize(moves[slot])].pp,[set(variable,catalog[normalize(moves[slot])].pp)]),math(variable,'add',moveID(moves[slot])*MOVE_RADIX)
   ]:[set(variable,0)])),math(retired(index),'add',2)
  ])
 ]);
 const refill=()=>once('learned_max_pp',()=>[
  set(15,0),...indexedDispatch('learned_pp_lookup',307,storedMoveCatalog.map(m=>({value:m.id,events:[set(15,m.pp)]})),{IF,shared})
 ]);
 const restorePP=index=>once('learned_restore_'+index,()=>[
  ...ensureMoves(index),...values(index).flatMap(variable=>[
   set(307,V(variable)),math(307,'div',MOVE_RADIX),...refill(),math(variable,'div',MOVE_RADIX),math(variable,'mul',MOVE_RADIX),math(variable,'add',15,'var')
  ])
 ]);
 const inheritMoves=(source,target)=>[
  ...values(target).map((variable,slot)=>set(variable,V(pp(source,slot))))
 ];
 function learnLevel(index,{announce=true}={}){
  return once('learned_level_'+index+(announce?'_announce':'_quiet'),()=>[
   ...ensureMoves(index),...redLearnsets[species[index].dex].levelUp.map(row=>{
    const id=moveID(row.move),value=packMove(id,catalog[normalize(row.move)].pp);
    const known=values(index).map(v=>`($${v}$ >= ${id*MOVE_RADIX} && $${v}$ < ${(id+1)*MOVE_RADIX})`).join(' || ');
    const append=values(index).reduceRight((otherwise,variable)=>[IF(variable,'==',0,[set(variable,value)],otherwise)],
     [...values(index).slice(0,3).map((variable,slot)=>set(variable,V(pp(index,slot+1)))),set(pp(index,3),value)]);
    return IF(lv(index),'==',row.level,[EX(known,[],[...append,...(announce?[say(`${species[index].name}\nLEARNED ${row.move}!`)]:[])])]);
   })
  ]);
 }
 const getWord=slot=>once('learned_word_'+slot,()=>indexedDispatch('learned_word_'+slot,1,species.map((_,index)=>({value:index+1,events:[set(307,V(pp(index,slot))),math(307,'div',MOVE_RADIX)]})),{IF,shared}));
 const spend=slot=>once('learned_spend_'+slot,()=>indexedDispatch('learned_spend_'+slot,1,species.map((_,index)=>({value:index+1,events:[math(pp(index,slot),'sub',1)]})),{IF,shared}));
 const execute=move=>once('learned_move_'+move.key,()=>onMove({move:move.name,stats:move}));
 const resolve=slot=>once('learned_resolve_'+slot,()=>indexedDispatch('learned_resolve_'+slot,307,storedMoveCatalog.map(move=>({value:move.id,events:onTurn({move:move.name,events:[
  ...spend(slot),set(18,1),set(14,slot+1),say(`USED ${move.name}!`),...execute(move)
 ]})})),{IF,shared}));
 const menu=index=>once('learned_menu_'+index,()=>[
  ...ensureMoves(index),set(14,0),makeMenu(14,values(index).map(String),true,'stored-moves')
 ]);
 const selection=index=>values(index).map((variable,slot)=>IF(14,'==',slot+1,[
  EX(`$${variable}$ % ${MOVE_RADIX} > 0`,[...getWord(slot),...resolve(slot)],[say('NO PP LEFT\nFOR THAT MOVE.')])
 ]));
 const fight=indexes=>indexes.map(index=>IF(1,'==',index+1,[
  ...ensureMoves(index),EX(values(index).map(v=>`($${v}$ % ${MOVE_RADIX})`).join(' + ')+' <= 0',
   once('learned_struggle',()=>onTurn({move:'STRUGGLE',events:onStruggle()})),[...menu(index),...selection(index)])
 ]));
 return {initializeMoves,ensureMoves,inheritMoves,restorePP,learnLevel,menu,selection,fight};
}
