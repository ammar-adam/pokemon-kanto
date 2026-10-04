import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseReady, verifyRuntimeEvidence } from './release-gate.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rom=await readFile(path.join(root,'build/pokemon-kanto.gbc'));
const metadata=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const acceptance=JSON.parse(await readFile(path.join(root,'verification/current-release.json'),'utf8'));
let playtest;
try {
  playtest=JSON.parse(await readFile(path.join(root,'verification/runtime-acceptance.json'),'utf8'));
} catch (error) {
  throw new Error('Release blocked: retain completed same-ROM live playtests in verification/runtime-acceptance.json. See verification/PLAYTEST.md.', {cause:error});
}
const sha256=createHash('sha256').update(rom).digest('hex');
assertReleaseReady(acceptance,playtest,rom);
await verifyRuntimeEvidence(root,playtest);
const out=path.join(root,'dist/Pokemon-Kanto');
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'Pokemon-Kanto.gbc'),rom);
for(const name of ['INSTALL.md','INSTALL.html','Install-on-Chromatic.cmd','Install-on-Chromatic.ps1']) await copyFile(path.join(root,'distribution',name),path.join(out,name));
await copyFile(path.join(root,'artwork/opening-preview-v2.png'),path.join(out,'map-preview.png'));
await writeFile(path.join(out,'release.json'),JSON.stringify({version:metadata.version,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),rom:{file:'Pokemon-Kanto.gbc',sizeBytes:rom.length,sha256},verification:acceptance,runtimeAcceptance:playtest},null,2));
console.log(out);
