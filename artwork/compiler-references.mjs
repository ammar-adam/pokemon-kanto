// GB Studio 4.3.2 caches a silently empty script past five nested compilations.
// Its reference-only GBVM event compiles dependencies without executing them.
export function sceneCompilerReferences(plan) {
  const scripts=new Map(plan.customScripts.map(s=>[s.id,s]));
  const calls=events=>events.flatMap(e=>[
    ...(e.command==='EVENT_CALL_CUSTOM_EVENT'?[e.args.customEventId]:[]),
    ...Object.values(e.children||{}).flatMap(calls)
  ]);
  return plan.scripts.filter(s=>!s.target.actorId&&!s.target.triggerId&&s.target.scriptKey==='script').map(root=>{
    const done=new Set(),active=new Set(),order=[];
    function visit(id){
      if(done.has(id))return;
      if(active.has(id))throw new Error('Recursive compiler dependency '+id);
      const script=scripts.get(id);
      if(!script)throw new Error('Missing compiler dependency '+id);
      active.add(id);
      for(const child of calls(script.script))visit(child);
      active.delete(id);done.add(id);order.push(id);
    }
    for(const owner of plan.scripts.filter(s=>s.target.sceneId===root.target.sceneId)){
      if(owner.target.actorId&&owner.target.scriptKey==='startScript'&&calls(owner.events).length)
        throw new Error('Actor start dependencies must be compiled before scene initialization');
      for(const id of calls(owner.events))visit(id);
    }
    return {root,references:order.map(id=>({type:'script',id}))};
  });
}
