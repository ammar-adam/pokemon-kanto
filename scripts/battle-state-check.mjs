import assert from 'node:assert/strict';
import {roster} from '../artwork/campaign-world.mjs';
import {redStats,damageAuthoring} from '../artwork/battle-damage.mjs';
import {criticalAuthoring,criticalThreshold,isHighCriticalMove} from '../artwork/critical-hits.mjs';
import {playerStatusAuthoring} from '../artwork/player-status.mjs';
const scripts=new Map();let serial=0;
const E=(command,args={},children)=>({id:String(serial++),command,args,...(children?{children}:{})});
const V=value=>({type:'variable',value:String(value)}),N=value=>({type:'number',value});
const set=(variable,value)=>E('SET',{variable:String(variable),value:typeof value==='object'?value:N(value)});
const math=(variable,operation,value,other='val')=>E('MATH',{variable:String(variable),operation,other,value});
const rand=(variable,min,max)=>E('RAND',{variable:String(variable),min,max});
const IF=(variable,op,value,yes,no=[])=>E('IF',{condition:{type:op,a:V(variable),b:N(value)}},{true:yes,false:no});
const EX=(expression,yes,no=[])=>E('IF',{condition:{expression}},{true:yes,false:no});
const shared=(name,events)=>{if(!scripts.has(name))scripts.set(name,events);return [E('CALL',{name})];};
const say=text=>E('TEXT',{text});
const retired=i=>i<8?80+i:409+(i-8)*10;
// The independently supplied target type codes represent the actual chart inputs.
const effectiveness=()=>[set(309,V(9000)),set(310,V(9001)),IF(300,'==',5,[EX('$309$ == 9 || $310$ == 9',[set(16,0)])]),IF(300,'==',1,[EX('$309$ == 14 || $310$ == 14',[set(16,0)])])];
const status=playerStatusAuthoring({species:roster,retired,IF,EX,V,set,math,rand,say,shared,effectiveness,storeHP:()=>[E('STORE')]});
const critical=criticalAuthoring({species:roster,IF,EX,set,math,rand,shared});
class Logic{
 constructor(v={},rolls=[]){this.v={1:1,2:100,3:100,300:5,...v};this.rolls=[...rolls];this.text=[];this.actions=0;this.stored=[];this.steps=0;}
 get(id){return this.v[id]||0;}put(id,n){assert.ok(Number.isInteger(n)&&n>=-32768&&n<=32767);this.v[id]=n;}
 val(x){return x.type==='variable'?this.get(x.value):x.value;}
 condition(c){if(c.expression){const s=c.expression.replace(/\$(\d+)\$/g,(_,n)=>this.get(n));assert.match(s,/^[\d\s<>=!&|()+\-*/%.]+$/);return Function('return ('+s+')')();}const a=this.val(c.a),b=this.val(c.b);return {'==':a===b,'!=':a!==b,'<':a<b,'>':a>b,'<=':a<=b,'>=':a>=b}[c.type];}
 run(list){for(const e of list){assert.ok(++this.steps<10000);const a=e.args;
  if(e.command==='SET')this.put(a.variable,this.val(a.value));
  else if(e.command==='MATH'){const x=this.get(a.variable),n=a.other==='var'?this.get(a.value):a.value;this.put(a.variable,{set:()=>n,add:()=>x+n,sub:()=>x-n,mul:()=>x*n,div:()=>Math.trunc(x/n),mod:()=>x%n}[a.operation]());}
  else if(e.command==='RAND'){assert.ok(this.rolls.length);const n=this.rolls.shift();assert.ok(n>=a.min&&n<=a.max);this.put(a.variable,n);}
  else if(e.command==='IF')this.run(e.children[this.condition(a.condition)?'true':'false']);
  else if(e.command==='CALL'){assert.ok(scripts.has(a.name));this.run(scripts.get(a.name));}
  else if(e.command==='TEXT')this.text.push(a.text);else if(e.command==='ACT')this.actions++;else if(e.command==='STORE')this.stored.push(this.get(3));else throw new Error(e.command);
 }}
}
let cases=0;
for(let i=0;i<roster.length;i++)for(const high of [false,true])for(const selector of [1,4]){
 const events=critical.roll(selector,high);const threshold=Math.min(255,Math.floor(redStats[roster[i].dex].speed/2)*(high?8:1));
 assert.equal(criticalThreshold(roster[i].dex,high),threshold);
 for(const roll of [0,Math.max(0,threshold-1),threshold,255]){const l=new Logic({[selector]:i+1},[roll]);l.run(events);assert.equal(l.get(305),roll<threshold?1:0);cases++;}
}
for(const name of ['KARATE CHOP','RAZOR LEAF','CRABHAMMER','SLASH'])assert.ok(isHighCriticalMove(name));
assert.equal(isHighCriticalMove('SCRATCH'),false);
const types=['NORMAL','FIRE','WATER','GRASS','ELECTRIC','ICE','FIGHTING','POISON','GROUND','FLYING','PSYCHIC','BUG','ROCK','GHOST','DRAGON'];
const damage=damageAuthoring({species:roster,IF,EX,V,set,math,shared,chunked:shared,typeCode:t=>types.indexOf(t)+1,criticalFlag:305});
const attacker=roster.findIndex(p=>p.dex===4)+1,defender=roster.findIndex(p=>p.dex===1)+1;
for(const level of [1,3,16,50,100])for(const crit of [false,true]){
 const l=new Logic({1:attacker,4:defender,0:level,7:level,300:1,301:40,305:crit?1:0});l.run(damage.base(1,4,0,7));
 const attack=Math.floor((redStats[4].attack+9)*level/50)+5,defense=Math.floor((redStats[1].defense+9)*level/50)+5;
 const expected=Math.min(999,Math.floor((Math.floor(2*(crit?level*2:level)/5)+2)*40*attack/(defense*50))+2);
 assert.equal(l.get(16),expected,'critical doubles effective level, not the final damage');cases++;
}
for(let i=0;i<roster.length;i++){
 const marker=retired(i),l=new Logic({1:i+1,[marker]:2});l.run(status.effects.PARALYZE_EFFECT({}));assert.equal(l.get(marker),6);assert.equal(l.get(16),0);
 l.run(status.load());assert.equal(l.get(307),1);l.v[1]=i===0?2:1;l.run(status.load());assert.equal(l.get(307),0,'switch does not transfer status');l.v[1]=i+1;assert.equal(l.get(marker),6,'original status persists');cases++;
}
let l=new Logic({[retired(0)]:2,9000:9});l.run(status.effects.PARALYZE_EFFECT({}));assert.equal(l.get(retired(0)),2,'Ground is immune to Thunder Wave');
l=new Logic({[retired(0)]:2,9000:8,300:8});l.run(status.effects.POISON_EFFECT({}));assert.equal(l.get(retired(0)),2,'Poison types cannot be poisoned');
l=new Logic({[retired(0)]:6});l.run(status.effects.POISON_EFFECT({}));assert.equal(l.get(retired(0)),6,'primary status is not overwritten');
l=new Logic({[retired(0)]:6},[25]);l.run(status.action([E('ACT')]));assert.equal(l.actions,0);
l=new Logic({[retired(0)]:6},[26]);l.run(status.action([E('ACT')]));assert.equal(l.actions,1);
l=new Logic({[retired(0)]:2},[5]);l.run(status.effects.SLEEP_EFFECT({}));assert.equal(l.get(retired(0)),22);
for(const expected of [18,14,2]){l.run(status.action([E('ACT')]));assert.equal(l.get(retired(0)),expected);assert.equal(l.actions,0);}l.run(status.action([E('ACT')]));assert.equal(l.actions,1);
l=new Logic({[retired(0)]:10,3:3});l.run(status.residual());assert.equal(l.get(3),0);assert.deepEqual(l.stored,[0]);
l=new Logic({[retired(0)]:2,16:27},[10]);l.run(status.effects.PARALYZE_SIDE_EFFECT1({}));assert.equal(l.get(retired(0)),6);assert.equal(l.get(16),27,'secondary status preserves actual damage');
l=new Logic({[retired(0)]:2,16:27},[11]);l.run(status.effects.PARALYZE_SIDE_EFFECT1({}));assert.equal(l.get(retired(0)),2);
const saved=JSON.parse(JSON.stringify({[retired(0)]:6}));l=new Logic(saved);l.run(status.load());assert.equal(l.get(307),1,'status survives serialized state');
console.log('Critical/status source checks passed: '+cases+' species/threshold/side cases plus immunity, persistence, switching, paralysis, sleep, poison and secondary chance boundaries. No emulator execution.');
