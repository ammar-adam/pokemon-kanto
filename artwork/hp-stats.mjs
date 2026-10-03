import {readFileSync} from 'node:fs';

const stats=JSON.parse(readFileSync(new URL('./red-base-stats.json',import.meta.url),'utf8')).stats;
export const HP_DV=9;

export function maxHP(dex,level){
  if(!stats[dex])throw new Error('Missing original HP stat '+dex);
  if(!Number.isInteger(level)||level<1||level>100)throw new Error('HP level must be 1..100');
  return Math.floor((stats[dex].hp+HP_DV)*level/50)+level+10;
}

export function hpAuthoring({species,IF,EX,V,set,math,chunked}){
  // A number is a one-based roster ID; V(id) selects a runtime species variable.
  // The output must differ from the level and species input variables.
  function maxHPEvents(speciesId,levelVariable,destinationVariable){
    if(String(destinationVariable)===String(levelVariable)||
      (typeof speciesId==='object'&&String(destinationVariable)===String(speciesId.value)))
      throw new Error('HP output must not overwrite its inputs');
    const base=i=>{
      const s=stats[species[i]?.dex];
      if(!s)throw new Error('Missing original HP for roster ID '+(i+1));
      return s.hp+HP_DV;
    };
    const events=typeof speciesId==='number'?[set(destinationVariable,base(speciesId-1))]:[
      set(destinationVariable,HP_DV),
      ...chunked('hp_base_'+speciesId.value+'_'+destinationVariable,
        species.map((_,i)=>IF(speciesId.value,'==',i+1,[set(destinationVariable,base(i))])))
    ];
    // Divide by 50 instead of doubling: Chansey L100 peaks at 25900.
    return [...events,math(destinationVariable,'mul',levelVariable,'var'),
      math(destinationVariable,'div',50),math(destinationVariable,'add',levelVariable,'var'),
      math(destinationVariable,'add',10)];
  }
  const clampHPEvents=(current,maximum)=>[
    IF(current,'<',0,[set(current,0)]),
    EX(`$${current}$ > $${maximum}$`,[set(current,V(maximum))])
  ];
  // oldMaximum is scratch, consumed as oldMaximum - newMaximum.
  const resizeHPEvents=(current,oldMaximum,newMaximum)=>[
    ...clampHPEvents(current,oldMaximum),
    IF(current,'>',0,[math(oldMaximum,'sub',newMaximum,'var'),math(current,'sub',oldMaximum,'var')]),
    ...clampHPEvents(current,newMaximum)
  ];
  return {maxHPEvents,clampHPEvents,resizeHPEvents};
}
