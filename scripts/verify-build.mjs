import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scores } from '../artwork/music-score.mjs';
import { inspectSaveLayout } from './save-layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultsPath = process.argv[2] || path.resolve(root, '../../../outputs/setup-verification/results.json');
const records = JSON.parse(await readFile(resultsPath, 'utf8'));
const build = records.find(record => record.tool === 'rom_build');
const inspect = records.find(record => record.tool === 'rom_inspect');
if (!build || !inspect || build.isError || inspect.isError || !build.result.success || build.result.exitCode !== 0 || build.result.diagnostics.length) {
  throw new Error('Official build or inspection did not pass cleanly');
}
const rom = await readFile(path.join(root, 'build/pokemon-kanto.gbc'));
const sha256 = createHash('sha256').update(rom).digest('hex');
if (build.result.rom.sha256 !== sha256 || inspect.result.sha256 !== sha256 || !inspect.result.valid || inspect.result.sizeBytes !== rom.length) {
  throw new Error('Build and inspection receipts do not match the current ROM');
}
const symbolsText=await readFile(build.result.debugArtifacts.noiPath,'utf8');
const globalsText=await readFile(build.result.debugArtifacts.globalsPath,'utf8');
const symbols=Object.fromEntries([...symbolsText.matchAll(/^DEF (\S+) 0x([0-9A-F]+)$/gmi)].map(m=>[m[1],parseInt(m[2],16)]));
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
const receipt = {
  buildPassed: true,
  builder: build.result.builder,
  sizeBytes: rom.length,
  sha256,
  colorMode: inspect.result.colorMode,
  cartridgeType: inspect.result.cartridgeTypeName,
  headerValid: inspect.result.valid,
  compiledCalls,
  compiledMusic,
  saveLayout,
  projectRevision: build.result.debugArtifacts?.sourceProvenance?.projectRevision || null,
  memory: { variableCount:variableOffsets.length, variableCapacity, dataEnd, reservedStackStart:symbols['.STACK'], gapBytes:symbols['.STACK']-dataEnd, runtimeStackVerified:false },
  sourceChecks: 'npm test passed locally; GitHub Actions checks source only',
  romExecuted: false,
  runtimeLimit: 'Earlier approved public emulator open requests timed out, including a zero-frame attempt. Those test sessions were closed. Official browser export rejects its Windows temporary directory. This receipt verifies compilation only: gameplay timing, audio output, saves, and this revision on hardware remain unverified.'
};
await writeFile(path.join(root, 'verification/current-release.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ sha256, sizeBytes: rom.length, projectRevision: receipt.projectRevision }));
