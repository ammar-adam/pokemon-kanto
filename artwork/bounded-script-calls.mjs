import {sceneCompilerReferences} from './compiler-references.mjs';

// The upstream asset walker follows every core custom call without a shared
// visited cache. Dynamic battle branches multiply those paths. Keep runtime
// calls on the normal callScript compiler API, with a linear asset manifest.
export function boundScriptCalls(plan,{E,N,shared}){
 const byId=new Map(plan.customScripts.map(s=>[s.id,s]));
 const walk=(events,visit)=>{for(const e of events){visit(e);for(const children of Object.values(e.children||{}))walk(children,visit);}};
 const roots=sceneCompilerReferences(plan);
 const known=new Set(plan.variables.map(v=>v.variableId));
 function assets(owners){
  const variables=new Set(),references=new Map(),sprites=new Map();
  const ref=(type,id)=>{if(typeof id==='string'&&id)references.set(type+':'+id,{type,id});};
  function vars(v){if(!v||typeof v!=='object')return;if(v.type==='variable'&&/^\d+$/.test(v.value))variables.add(String(Number(v.value)));
   for(const [key,value]of Object.entries(v)){
    if(['variable','variableSource','variableDest','vectorX','vectorY','word1','word2','word3','word4','word5','word6'].includes(key)&&/^\d+$/.test(value))variables.add(String(Number(value)));
    if(typeof value==='string'){for(const m of value.matchAll(/\$(\d+)\$/g))variables.add(String(Number(m[1])));for(const m of value.matchAll(/!F:([0-9a-f-]+)!/g))ref('font',m[1]);}
    else if(typeof value==='object')vars(value);
   }
  }
  for(const events of owners)walk(events,e=>{
   vars(e.args);for(const r of e.args?.references||[])if(r.type!=='script')ref(r.type,r.id);
   for(const [key,type]of [['fontId','font'],['soundId','sound'],['emoteId','emote'],['tilesetId','tileset'],['backgroundId','background']])ref(type,e.args?.[key]);
   if(['EVENT_ACTOR_SET_SPRITE','EVENT_PLAYER_SET_SPRITE'].includes(e.command))sprites.set(JSON.stringify([e.command,e.args]),e);
  });
  for(const id of variables){if(!known.has(id))throw new Error('Undeclared compiler asset variable '+id);ref('variable',id);}
  return {references:[...references.values()],sprites:[...sprites.values()]};
 }
 for(const {root,references}of roots){
  const owners=plan.scripts.filter(s=>s.target.sceneId===root.target.sceneId).map(s=>s.events);
  const inventory=assets([...owners,...references.map(r=>byId.get(r.id).script)]);
  root.events.unshift(E('EVENT_GBVM_SCRIPT',{script:'',references:inventory.references}));
  const declarations=[];
  for(let start=0;start<inventory.sprites.length;start+=8){
   const events=inventory.sprites.slice(start,start+8).map(e=>E(e.command,structuredClone(e.args)));
   const calls=shared('compiler_sprites_'+root.target.sceneId.replaceAll('-','_')+'_'+start,events);
   const script=plan.customScripts.find(s=>s.id===calls[0].args.customEventId);
   for(const e of events){const actor=e.args.actorId;if(actor&&!['player','$self$'].includes(actor))script.actors[actor]={id:actor,name:actor};}
   for(const call of calls){call.args.__kantoAssetCatalog=true;for(const actor of Object.keys(script.actors))call.args['$actor['+actor+']$']=actor;}
   declarations.push(...calls);
  }
  if(declarations.length)root.events.unshift(E('EVENT_IF',{condition:{type:'eq',valueA:N(0),valueB:N(1)}},{true:declarations,false:[]}));
 }
 for(const owner of [...plan.scripts,...plan.customScripts])walk(owner.events||owner.script,e=>{
  if(e.command==='EVENT_CALL_CUSTOM_EVENT'&&!e.args.__kantoAssetCatalog)e.command='EVENT_KANTO_CALL';
 });
}
