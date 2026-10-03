import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const roster=JSON.parse(await readFile(new URL('artwork/roster.json',root),'utf8'));
const headers={'User-Agent':'pokemon-kanto-authoring'};
async function get(url){const r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`${r.status} ${url}`);return r;}
const commit=(await (await get('https://api.github.com/repos/pret/pokered/commits/master')).json()).sha;
const files=await (await get(`https://api.github.com/repos/pret/pokered/contents/data/pokemon/base_stats?ref=${commit}`)).json();
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const stats={};
for(const p of roster){
  const file=files.find(f=>normalize(f.name.replace(/\.asm$/,''))===normalize(p.key));
  if(!file)throw new Error('No base stats for '+p.key);
  const source=await (await get(file.download_url)).text();
  const row=source.split(/\r?\n/).map(line=>line.split(';')[0].trim()).find(line=>/^db\s+\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$/.test(line));
  if(!row)throw new Error('Unrecognized stat declaration '+file.name);
  const [hp,attack,defense,speed,special]=row.replace(/^db\s+/,'').split(',').map(Number);
  if([hp,attack,defense,speed,special].some(n=>!Number.isInteger(n)||n<1||n>255))throw new Error('Invalid base stats '+p.key);
  stats[p.dex]={hp,attack,defense,speed,special};
}
await writeFile(new URL('artwork/red-base-stats.json',root),JSON.stringify({source:'https://github.com/pret/pokered',commit,stats},null,2)+'\n');
console.log('Retained original base stats for '+Object.keys(stats).length+' Pokemon at '+commit);
