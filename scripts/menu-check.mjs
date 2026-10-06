import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const provenance=JSON.parse(fs.readFileSync(path.join(root,'plugins/kanto-menu/upstream/provenance.json')));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(fs.readFileSync(path.join(root,'plugins/kanto-menu/upstream/eventMenu.js'))),provenance.upstreamSHA256);
assert.equal(sha(fs.readFileSync(path.join(root,'plugins/kanto-menu/events/eventKantoMenu.js'))),provenance.overrideSHA256);
assert.equal(provenance.gbStudioCommit,'ccb891b2670134ba8237416772eea4ed09d34e1e');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'plugins/kanto-menu/upstream/menu-routing-baseline.json')));
const original=new Map(baseline.map(x=>[x.id,x]));
const menus=[];
function walk(v) {
 if(Array.isArray(v)) {for(const x of v)walk(x);}
 else if(v&&typeof v==='object') {if(['EVENT_MENU','EVENT_KANTO_MENU'].includes(v.command))menus.push(v);for(const x of Object.values(v))walk(x);}
}
for(const p of fs.readdirSync(path.join(root,'project'),{recursive:true})) if(p.endsWith('.gbsres'))walk(JSON.parse(fs.readFileSync(path.join(root,'project',p))));
assert.equal(menus.length,1014);let scoped=0,dialogue=0;
for(const m of menus) {
 const old=original.get(m.id);assert.ok(old,'menu ID preserved');assert.deepEqual(m.args,old.args,'all native arguments preserved');
 assert.equal(m.command,m.args.layout==='menu'?'EVENT_KANTO_MENU':'EVENT_MENU');
 if(m.command==='EVENT_KANTO_MENU') {scoped++;for(let i=1;i<=m.args.items;i++)assert.ok(m.args['option'+i].length<=17,'label fits full-width 17-character interior');}
 else dialogue++;
}
assert.equal(scoped,26);assert.equal(dialogue,988);
const native=new Map(menus.map(m=>[m.id,m]));menus.length=0;walk(JSON.parse(fs.readFileSync(path.join(root,'artwork/game-plan.json'))));
assert.equal(menus.length,1014);for(const m of menus){const n=native.get(m.id);assert.equal(m.command,n.command);assert.deepEqual(m.args,n.args);}
const context={module:{exports:{}},require:specifier=>{assert.equal(specifier,'../helpers/l10n');return {default:key=>key};}};
vm.runInNewContext(fs.readFileSync(path.join(root,'plugins/kanto-menu/events/eventKantoMenu.js'),'utf8'),context);const event=context.module.exports;assert.equal(event.id,'EVENT_KANTO_MENU');
function calls(input,indirect=false) {
 const result=[];const helpers=new Proxy({getVariableAlias:id=>'VAR_'+id,_isIndirectVariable:()=>indirect,_declareLocal:(...args)=>{result.push(['_declareLocal',...args]);return 'LOCAL_RESULT';}}, {get:(target,name)=>name in target?target[name]:(...args)=>result.push([name,...JSON.parse(JSON.stringify(args))])});event.compile(input,helpers);return result;
}
for(const m of native.values()) {
 const c=calls(m.args);
 if(m.command==='EVENT_MENU') {assert.deepEqual(c,[['textMenu',m.args.variable,Array.from({length:m.args.items},(_,i)=>m.args['option'+(i+1)]),m.args.layout,m.args.cancelOnLastOption,m.args.cancelOnB]]);continue;}
 assert.deepEqual(c.find(x=>x[0]==='_overlayClear'),['_overlayClear',0,0,20,m.args.items+2,'.UI_COLOR_WHITE',true,true]);
 assert.deepEqual(c.filter(x=>x[0]==='_overlayMoveTo'),[['_overlayMoveTo',0,18,'.OVERLAY_SPEED_INSTANT'],['_overlayMoveTo',0,16-m.args.items,'.OVERLAY_IN_SPEED'],['_overlayMoveTo',0,18,'.OVERLAY_OUT_SPEED'],['_overlayMoveTo',0,18,'.OVERLAY_SPEED_INSTANT']]);
 assert.equal(c.filter(x=>x[0]==='_menuItem').length,m.args.items);
}
let matrix=0;
for(let items=2;items<=8;items++)for(const cancelOnB of [false,true])for(const cancelOnLastOption of [false,true]) {
 const args={variable:'V0',items,cancelOnB,cancelOnLastOption,layout:'menu',...Object.fromEntries(Array.from({length:items},(_,i)=>['option'+(i+1),'OPTION '+(i+1)]))};
 const c=calls(args,true);assert.deepEqual(c[1],['_declareLocal','menu_result',1,true]);
 const expectedFlags=[];if(cancelOnLastOption)expectedFlags.push('.UI_MENU_LAST_0');if(cancelOnB)expectedFlags.push('.UI_MENU_CANCEL_B');assert.deepEqual(c.find(x=>x[0]==='_choice'),['_choice','LOCAL_RESULT',expectedFlags,items]);
 assert.deepEqual(c.at(-2),['_setInd','VAR_V0','LOCAL_RESULT']);matrix++;
}
console.log(`Menu source checks passed: ${scoped} scoped full-width menus, ${dialogue} unchanged native dialogue menus, ${matrix} indirect/cancel cases. Runtime verification is separate.`);
