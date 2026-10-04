// Bank-sized leaves keep roster lookups logarithmic without adding VM variables.
export function indexedDispatch(name,selector,rows,{IF,shared},leafSize=8) {
  if(!Number.isInteger(leafSize)||leafSize<1||leafSize>16)throw new Error('Invalid dispatch leaf size');
  for(let i=0;i<rows.length;i++){
    if(!Number.isInteger(rows[i].value)||(i&&rows[i-1].value>=rows[i].value))throw new Error('Dispatch keys must be sorted and unique');
  }
  function branch(group){
    if(!group.length)return [];
    if(group.length<=leafSize){
      const events=group.reduceRight((otherwise,row)=>[IF(selector,'==',row.value,row.events,otherwise)],[]);
      return shared(name+'_range_'+group[0].value+'_'+group.at(-1).value,events);
    }
    const middle=Math.floor(group.length/2);
    return [IF(selector,'<',group[middle].value,branch(group.slice(0,middle)),branch(group.slice(middle)))];
  }
  return shared(name,branch(rows));
}
