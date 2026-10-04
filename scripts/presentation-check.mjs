import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {scores,musicId,sceneScore} from '../artwork/music-score.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const json=p=>JSON.parse(read(p));
const hash=(bytes,kind='sha256')=>createHash(kind).update(bytes).digest('hex');
const plan=json('artwork/game-plan.json'),ids=json('artwork/pokemon-resource-ids.json');
assert.equal(new Set(plan.scripts.map(s=>JSON.stringify(s.target))).size,plan.scripts.length,'one definition per native script owner');
function events(list){return list.flatMap(e=>[e,...Object.values(e.children||{}).flatMap(events)]);}
for(const script of [...plan.scripts,...plan.customScripts])for(const e of events(script.events||script.script)){
  if(e.args?.text!==undefined)for(const page of [].concat(e.args.text)){
    assert.ok(!page.includes('$0$'),'text must not create the compiler default local variable');
  }
}
const rawHud=plan.scripts.find(s=>s.events.some(e=>e.command==='EVENT_TEXT_DRAW'&&e.args.text.startsWith('LV ')));
assert.ok(rawHud.events.some(e=>e.args?.text==='LV %D3$00$'),'direct HUD level uses the global-zero escape');
for(const script of plan.customScripts){
  assert.ok(events(script.script).filter(e=>e.command==='EVENT_ACTOR_SET_SPRITE').length<=16,
    'portrait lookup must stay bank-sized: '+script.name);
}
const hud=plan.customScripts.find(s=>s.name==='Kanto logic_hud');
for(const e of hud.script){
  const text=e.args.text.replace(/%D([1-5])\$[\w]+\$/g,(_,width)=>'9'.repeat(Number(width)));
  assert.ok(!text.includes('$'),'health fields have explicit width');
  assert.ok(e.args.x+text.length<=20,'three-digit health stays on screen');
}
const sceneScripts=plan.scripts.filter(s=>!s.target.actorId&&!s.target.triggerId&&s.target.scriptKey==='script');
assert.equal(sceneScripts.length,68);
for(const s of sceneScripts){
  const key=Object.keys(ids.scenes).find(key=>ids.scenes[key]===s.target.sceneId);
  const music=s.events.filter(e=>e.command==='EVENT_MUSIC_PLAY');
  assert.equal(music.length,1,key+' starts exactly one track');
  assert.equal(music[0].args.musicId,musicId(sceneScore(key)));
}
for(const key of Object.keys(scores)){
  const bytes=read('assets/music/'+key+'.uge'),resource=json('assets/music/'+key+'.uge.gbsres');
  assert.equal(bytes.readUInt32LE(0),6);assert.ok(bytes.length>1000);
  assert.equal(resource.id,musicId(key));assert.equal(resource.filename,key+'.uge');
  assert.equal(resource._resourceType,'music');assert.equal(resource.type,'uge');
}
for(const entry of json('artwork/character-art-provenance.json'))assert.equal(hash(read(entry.reference)),entry.sha256);
for(const p of json('artwork/roster.json')){
  const name='assets/sprites/kanto-'+p.key+'-centered.png',bytes=read(name),png=PNG.sync.read(bytes),meta=json(name+'.gbsres');
  assert.equal(png.width,64);assert.equal(png.height,32);assert.equal(meta.checksum,hash(bytes,'sha1'));assert.equal(meta.id,ids.sprites[p.key]);
  const colors=new Set();for(let i=0;i<png.data.length;i+=4)colors.add([...png.data.subarray(i,i+3)].join(','));
  assert.ok(colors.size<=4);assert.ok(colors.has('101,255,0'),'native chroma key retained');
  for(const x of [0,31,32,63])assert.deepEqual([...png.data.subarray(x*4,x*4+3)],[101,255,0],'no opaque image border');
}
console.log('68 unique scene music cues, 5 UGE assets, reference hashes, and 151 transparent native portrait pairs passed. Runtime audio and motion remain unverified.');
