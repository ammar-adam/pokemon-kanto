import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');

// GB Studio emits linker names from authored symbols. Distinct resource IDs
// do not prevent identically named actors from sharing a generated script.
function collectSymbols(value,source,location=[],result=[]) {
  if(Array.isArray(value)) {
    value.forEach((item,index)=>collectSymbols(item,source,[...location,index],result));
  } else if(value&&typeof value==='object') {
    for(const [key,item] of Object.entries(value)) {
      const at=[...location,key];
      if(key==='symbol'&&item) result.push({symbol:item,source,location:at.join('.')});
      else collectSymbols(item,source,at,result);
    }
  }
  return result;
}

function assertUniqueSymbols(records) {
  const symbols=new Map();
  for(const {symbol,source,location} of records) {
    const owner=`${source}:${location}`;
    assert.match(symbol,/^[A-Za-z_][A-Za-z0-9_]*$/,`Invalid native symbol at ${owner}`);
    assert.ok(!symbols.has(symbol),
      `Duplicate native symbol ${symbol}: ${symbols.get(symbol)} and ${owner}`);
    symbols.set(symbol,owner);
  }
  return symbols.size;
}

const actor=(source,symbol='actor_blue')=>collectSymbols({
  _resourceType:'actor',id:source,symbol,script:[]
},source);
assert.throws(()=>assertUniqueSymbols([
  ...actor('laboratory/blue.gbsres'),...actor('route_twenty_two/blue.gbsres')
]),/Duplicate native symbol actor_blue/,'Identical events must not excuse distinct actors');
assert.equal(assertUniqueSymbols([
  ...actor('laboratory/blue.gbsres','actor_laboratory_blue'),
  ...actor('route_twenty_two/blue.gbsres','actor_route_twenty_two_blue')
]),2);
assert.throws(()=>assertUniqueSymbols([
  ...collectSymbols({symbol:'sprite_bulbasaur'},'assets/original.gbsres'),
  ...collectSymbols({symbol:'sprite_bulbasaur'},'assets/centered.gbsres')
]),/Duplicate native symbol sprite_bulbasaur/,'Asset metadata must also be checked');
assert.throws(()=>assertUniqueSymbols(collectSymbols({variables:[
  {id:'0',symbol:'var_level'},{id:'1',symbol:'var_level'}
]},'variables.gbsres')),/Duplicate native symbol var_level/,'Check nested variable symbols');
assert.throws(()=>assertUniqueSymbols(actor('bad.gbsres','actor invalid')),/Invalid native symbol/);

let resources=0;
const records=[];
async function inspect(directory) {
  const entries=(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()) await inspect(file);
    else if(entry.name.endsWith('.gbsres')) {
      resources++;
      collectSymbols(JSON.parse(await readFile(file,'utf8')),path.relative(root,file),[],records);
    }
  }
}
await inspect(path.join(root,'project'));
await inspect(path.join(root,'assets'));
const count=assertUniqueSymbols(records);
console.log(`${count} unique native symbols across ${resources} project/asset resources; collision regression fixtures passed. Source check only.`);
