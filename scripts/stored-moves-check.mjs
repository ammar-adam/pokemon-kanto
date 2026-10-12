import assert from 'node:assert/strict';
import {roster} from '../artwork/campaign-world.mjs';
import {storedMoveCatalog,moveID,packMove,unpackMove,learnStoredMove} from '../artwork/stored-moves.mjs';
import {moveLearningAuthoring,movesAtLevel} from '../artwork/move-learning.mjs';
let serial=0;const scripts=new Map();
const E=(command,args={},children)=>({id:String(serial++),command,args,...(children?{children}:{})});
const V=value=>({type:'variable',value:String(value)}),N=value=>({type:'number',value});
const set=(variable,value)=>E('EVENT_SET_VALUE',{variable:String(variable),value:typeof value==='object'?value:N(value)});
const math=(variable,operation,value,other='val')=>E('EVENT_VARIABLE_MATH',{vectorX:String(variable),operation,other,...(other==='var'?{vectorY:String(value)}:{value})});
const IF=(variable,operator,value,yes,no=[])=>E('EVENT_IF',{condition:{type:{'==':'eq','!=':'ne','<':'lt','>':'gt','<=':'lte','>=':'gte'}[operator],valueA:V(variable),valueB:N(value)}},{true:yes,false:no});
const EX=(value,yes,no=[])=>E('EVENT_IF',{condition:{type:'expression',value}},{true:yes,false:no});
const shared=(name,events)=>{if(!scripts.has(name))scripts.set(name,events);return [E('EVENT_CALL_CUSTOM_EVENT',{customEventId:name})];};
const slot=(i,j)=>i<8?100+i*4+j:405+(i-8)*10+j;
const lv=i=>i<8?60+i:403+(i-8)*10,retired=i=>i<8?80+i:409+(i-8)*10;
const learning=moveLearningAuthoring({species:roster,IF,EX,V,set,math,shared,lv,pp:slot,retired,
 menu:(variable,words)=>E('TEST_MENU',{variable,words}),say:text=>E('EVENT_TEXT',{text}),
 onMove:({move})=>[E('TEST_EXECUTE',{move})],onStruggle:()=>[E('TEST_EXECUTE',{move:'STRUGGLE'})]});
class Logic{
 constructor(vars={},choices=[]){this.v={...vars};this.choices=[...choices];this.moves=[];this.steps=0;}
 get(id){return this.v[id]||0;}put(id,n){assert.ok(Number.isInteger(n)&&n>=-32768&&n<=32767);this.v[id]=n;}
 value(x){if(x.type==='number')return x.value;if(x.type==='variable')return this.get(x.value);
  if(x.type==='expression'){const s=x.value.replace(/\$(\d+)\$/g,(_,n)=>this.get(n));assert.match(s,/^[\d\s<>=!&|()+\-*/%.]+$/);return Function('return ('+s+')')();}
  const a=this.value(x.valueA),b=this.value(x.valueB);return {eq:a===b,ne:a!==b,lt:a<b,gt:a>b,lte:a<=b,gte:a>=b}[x.type];}
 run(list){for(const e of list){assert.ok(++this.steps<100000);const a=e.args;
  if(e.command==='EVENT_SET_VALUE')this.put(a.variable,this.value(a.value));
  else if(e.command==='EVENT_VARIABLE_MATH'){const x=this.get(a.vectorX),n=a.other==='var'?this.get(a.vectorY):a.value;this.put(a.vectorX,{set:()=>n,add:()=>x+n,sub:()=>x-n,mul:()=>x*n,div:()=>Math.trunc(x/n),mod:()=>x%n}[a.operation]());}
  else if(e.command==='EVENT_IF')this.run(e.children[this.value(a.condition)?'true':'false']);
  else if(e.command==='EVENT_CALL_CUSTOM_EVENT'){assert.ok(scripts.has(a.customEventId));this.run(scripts.get(a.customEventId));}
  else if(e.command==='TEST_MENU'){assert.ok(this.choices.length);this.put(a.variable,this.choices.shift());}
  else if(e.command==='TEST_EXECUTE')this.moves.push(a.move);
  else assert.equal(e.command,'EVENT_TEXT');
 }}
 words(i){return Array.from({length:4},(_,j)=>this.get(slot(i,j)));}
}
let cases=0;
for(const m of storedMoveCatalog)for(let pp=0;pp<=m.pp;pp++){assert.deepEqual(unpackMove(packMove(m.id,pp)),{id:m.id,pp});assert.ok(packMove(m.id,pp)<=32767);cases++;}
for(let i=0;i<roster.length;i++)for(const level of [1,5,16,30,50,100]){
 const legacy={1:i+1,[lv(i)]:level};const moves=movesAtLevel(roster[i].dex,level);
 for(let j=0;j<4;j++)legacy[slot(i,j)]=moves[j]?Math.min(j+1,storedMoveCatalog[moveID(moves[j])-1].pp):0;
 const l=new Logic(legacy);l.run(learning.ensureMoves(i));
 assert.equal(l.get(retired(i)),2);
 assert.deepEqual(l.words(i).map(unpackMove),Array.from({length:4},(_,j)=>({id:moves[j]?moveID(moves[j]):0,pp:moves[j]?j+1:0})));
 const before=l.words(i);l.run(learning.ensureMoves(i));assert.deepEqual(l.words(i),before,'migration is idempotent');cases++;
}
const index=dex=>roster.findIndex(p=>p.dex===dex);
for(const [from,to,level] of [[4,5,16],[25,26,30],[133,134,37],[64,65,30],[11,12,10]]){
 const a=index(from),b=index(to),l=new Logic({1:b+1,[lv(a)]:level,[lv(b)]:level});
 l.run(learning.initializeMoves(a));l.v[slot(a,0)]--;const before=l.words(a);
 l.run(learning.inheritMoves(a,b));l.v[retired(b)]=2;
 assert.deepEqual(l.words(b),before,'evolution preserves move IDs and depleted PP');
 l.choices=[1];l.run(learning.menu(b));l.run(learning.selection(b));
 assert.equal(l.moves.at(-1),storedMoveCatalog[unpackMove(before[0]).id-1].name,'the inherited move actually executes');
 assert.equal(l.get(slot(b,0)),before[0]-1);cases++;
}
const eevee=index(133),vaporeon=index(134);
const l=new Logic({1:vaporeon+1,[lv(eevee)]:37,[lv(vaporeon)]:37});l.run(learning.initializeMoves(eevee));l.run(learning.inheritMoves(eevee,vaporeon));l.v[retired(vaporeon)]=2;
let expected=l.words(vaporeon);l.v[lv(vaporeon)]=42;
// Independently append only the evolved species' move learned at this exact level.
import {redLearnsets} from '../artwork/move-learning.mjs';
const learned=redLearnsets[134].levelUp.filter(r=>r.level===42);assert.equal(learned.length,1);assert.equal(learned[0].move,'ACID ARMOR');assert.ok(!expected.some(word=>unpackMove(word).id===moveID('ACID ARMOR')));for(const row of learned)expected=learnStoredMove(expected,moveID(row.move));
l.run(learning.learnLevel(vaporeon));assert.deepEqual(l.words(vaporeon),expected);
const snapshot=structuredClone(l.v),loaded=new Logic(snapshot,[0]);loaded.run(learning.menu(vaporeon));loaded.run(learning.selection(vaporeon));assert.deepEqual(loaded.words(vaporeon),expected);assert.deepEqual(loaded.moves,[],'B cancel consumes no PP');
loaded.run(learning.restorePP(vaporeon));assert.deepEqual(loaded.words(vaporeon).map(unpackMove).map(m=>m.id),expected.map(unpackMove).map(m=>m.id),'healing keeps inherited identities');
for(const word of loaded.words(vaporeon)){const m=unpackMove(word);if(m.id)assert.equal(m.pp,storedMoveCatalog[m.id-1].pp);}
const exhausted=new Logic({1:vaporeon+1,[lv(vaporeon)]:42,[retired(vaporeon)]:2});for(let j=0;j<4;j++)exhausted.v[slot(vaporeon,j)]=packMove(unpackMove(expected[j]).id,0);exhausted.run(learning.fight([vaporeon]));assert.deepEqual(exhausted.moves,['STRUGGLE']);
console.log('Stored-move source checks passed: '+cases+' packing/migration/evolution cases plus inherited execution, later learning, healing, cancellation, serialized reload and Struggle. No native runtime is claimed.');
