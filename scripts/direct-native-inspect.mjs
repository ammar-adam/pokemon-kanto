// Independent direct-CLI diagnostics. This is not a public ModRetro receipt.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {scores} from '../artwork/music-score.mjs';
import {inspectSaveLayout} from './save-layout.mjs';
const root=path.resolve(import.meta.dirname,'..');
const [romPath,noiPath,globalsPath,outputPath]=process.argv.slice(2);
if(!outputPath)throw new Error('Arguments: exact-ROM exact-NOI exact-globals output-report');
const rom=await readFile(romPath),symbolsText=await readFile(noiPath,'utf8'),globalsText=await readFile(globalsPath,'utf8');
const sha256=createHash('sha256').update(rom).digest('hex');
const logo=Buffer.from('ceed6666cc0d000b03730083000c000d0008111f8889000edccc6ee6ddddd999bbbb67636e0eecccdddc999fbbb9333e','hex');
assert.ok(rom.subarray(0x104,0x134).equals(logo),'Nintendo logo valid');
let check=0;for(const v of rom.subarray(0x134,0x14d))check=(check-v-1)&255;assert.equal(check,rom[0x14d],'header checksum');
let sum=0;for(let i=0;i<rom.length;i++)if(i!==0x14e&&i!==0x14f)sum=(sum+rom[i])&65535;assert.equal(sum,rom.readUInt16BE(0x14e),'global checksum');
assert.equal(rom.length,32768*(2**rom[0x148]),'declared ROM size');assert.equal(rom[0x143],0xc0,'GBC-only cartridge');
const symbols=Object.fromEntries([...symbolsText.matchAll(/^DEF (\S+) 0x([0-9A-F]+)$/gmi)].map(m=>[m[1],parseInt(m[2],16)]));
const plan=JSON.parse(await readFile(path.join(root,'artwork/game-plan.json'),'utf8'));
const catalog=new Set(plan.scripts.flatMap(s=>s.events.filter(e=>e.command==='EVENT_GBVM_SCRIPT')
  .flatMap(e=>e.args.references.filter(r=>r.type==='script').map(r=>r.id))));
if(!catalog.size)throw new Error('Missing compiler dependency catalogs');
const compiledSharedScripts=[];
for(const script of plan.customScripts.filter(s=>catalog.has(s.id))){
  const address=symbols['_'+script.symbol];
  if(!Number.isInteger(address)||address<0x10000)throw new Error('Missing compiled shared routine '+script.name);
  const offset=(address>>>16)*0x4000+(address&0x3fff);
  // A depth-truncated custom routine contains only VM_RET_FAR / VM_RET_FAR_N.
  if(script.script.length&&rom[offset]===0x0b)throw new Error('Empty compiled shared routine '+script.name);
  compiledSharedScripts.push(script.symbol);
}
const saveLayout=inspectSaveLayout(rom,symbols);
const compiledMusic=Object.keys(scores).map(key=>{
  const symbol='_music_kanto_'+key+'_Data',address=symbols[symbol];
  if(!Number.isInteger(address)||address<0x10000)throw new Error('Music missing from the linked ROM: '+key);
  return {key,symbol,address};
});
const scriptAddresses=Object.entries(symbols).filter(([name])=>name.startsWith('_script_')).map(([,address])=>address).sort((a,b)=>a-b);
const compiledCalls=[];
for(const [source,target]of [
  ['learned_move_tackle','logic_attack'],['learned_move_rage','logic_attack'],['enemy_move_tackle','logic_hud'],
  ['turn_before_1','turn_compare_speed'],['turn_after_player','turn_queued_enemy'],
  ['turn_queued_enemy','enemy_queued_turn'],['capture_poke_ball','capture_species_rate'],
  ['field_menu','story_journal'],['story_journal','story_journal_postgame']
]){
  const from=symbols['_script_kanto_'+source],to=symbols['_script_kanto_'+target];
  if(!Number.isInteger(from)||!Number.isInteger(to))throw new Error('Missing compiled battle routine '+source+' / '+target);
  const bank=from>>>16,address=from&0xffff,next=scriptAddresses.find(n=>n>from&&(n>>>16)===bank);
  const offset=bank*0x4000+(address&0x3fff),end=next===undefined?(bank+1)*0x4000:bank*0x4000+(next&0x3fff);
  // GBVM VM_CALL_FAR encodes opcode, address high, address low, bank.
  const call=Buffer.from([0x0a,(to>>>8)&255,to&255,(to>>>16)&255]);
  if(rom.subarray(offset,end).indexOf(call)<0)throw new Error('Export dropped battle call '+source+' -> '+target);
  compiledCalls.push({source,target});
}
const variableOffsets=[...globalsText.matchAll(/^VAR_\w+ = (\d+)$/gm)].map(m=>Number(m[1]));
if(/^VAR_\w+_LOCAL_\d+ =/m.test(globalsText))throw new Error('Unexpected compiler default local variable; inspect zero-valued text references');
const header=await readFile(path.join(root,'plugins/kanto-memory/engine/include/vm.h'),'utf8');
const variableCapacity=Number(header.match(/#define VM_HEAP_SIZE (\d+)/)[1]);
const dataEnd=symbols.s__DATA+symbols.l__DATA;
if(!variableOffsets.length||Math.max(...variableOffsets)>=variableCapacity||!Number.isFinite(dataEnd)||dataEnd>=symbols['.STACK'])throw new Error('Linked VM variables or RAM exceed the reserved memory budget');

const report={schemaVersion:1,evidenceType:'direct official CLI-derived build and independent linked-ROM inspection; not plugin-authenticated',romPath:path.resolve(romPath),noiPath:path.resolve(noiPath),globalsPath:path.resolve(globalsPath),romSha256:sha256,sizeBytes:rom.length,headerValid:true,compiledCalls,compiledSharedScriptCount:compiledSharedScripts.length,compiledMusic,saveLayout,memory:{variableCount:variableOffsets.length,variableCapacity,dataEnd,reservedStackStart:symbols['.STACK'],gapBytes:symbols['.STACK']-dataEnd,runtimeStackVerified:false},runtimeVerified:false,releaseAcceptanceCreated:false};
await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
