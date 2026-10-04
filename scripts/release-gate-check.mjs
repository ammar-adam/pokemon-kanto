import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertReleaseReady, verifyRuntimeEvidence, requiredPlaytests } from './release-gate.mjs';

// Synthetic fixtures exercise the gate, not the game. Never export them as receipts.
const rom=Buffer.from('synthetic ROM fixture');
const sha256=createHash('sha256').update(rom).digest('hex');
const build={buildPassed:true,headerValid:true,sha256,sizeBytes:rom.length,projectRevision:'a'.repeat(64)};
const evidence=Buffer.from('synthetic recording fixture');
const evidenceHash=createHash('sha256').update(evidence).digest('hex');
const playtest={schemaVersion:1,romSha256:sha256,romSizeBytes:rom.length,projectRevision:build.projectRevision,
  tester:'Unit test fixture',testedAt:'2026-10-04T00:00:00Z',environment:{kind:'emulator',version:'fixture'},openIssues:[],
  checks:requiredPlaytests.map(id=>({id,status:'passed',observed:'Synthetic fixture only',evidence:[{path:'sample.bin',sha256:evidenceHash}]}))};
assert.equal(assertReleaseReady(build,playtest,rom),sha256);
for(const change of [
  p=>p.romSha256='b'.repeat(64), p=>p.romSizeBytes++, p=>p.projectRevision='b'.repeat(64),
  p=>p.checks.pop(), p=>p.checks.push(p.checks[0]), p=>p.checks[0].status='unverified',
  p=>p.checks[0].observed='', p=>p.checks[0].evidence=[], p=>p.checks[0].evidence[0].sha256='bad',
  p=>p.environment.kind='source', p=>p.environment.version='', p=>p.tester='',
  p=>p.testedAt='unknown', p=>p.openIssues=['Save failed'], p=>delete p.openIssues,
]){
  const altered=structuredClone(playtest);change(altered);
  assert.throws(()=>assertReleaseReady(build,altered,rom));
}
assert.throws(()=>assertReleaseReady({...build,buildPassed:false},playtest,rom));
assert.throws(()=>assertReleaseReady({...build,headerValid:false},playtest,rom));
assert.throws(()=>assertReleaseReady(build,playtest,Buffer.from('different ROM')));
const root=await mkdtemp(path.join(os.tmpdir(),'kanto-release-gate-'));
try{
  await writeFile(path.join(root,'sample.bin'),evidence);
  await verifyRuntimeEvidence(root,playtest);
  await writeFile(path.join(root,'sample.bin'),'tampered');
  await assert.rejects(()=>verifyRuntimeEvidence(root,playtest),/changed/);
  await writeFile(path.join(root,'sample.bin'),'');
  await assert.rejects(()=>verifyRuntimeEvidence(root,playtest),/Empty/);
  const missing=structuredClone(playtest);missing.checks[0].evidence[0].path='missing.bin';
  await assert.rejects(()=>verifyRuntimeEvidence(root,missing),/ENOENT/);
  const outside=structuredClone(playtest);outside.checks[0].evidence[0].path=path.resolve('package.json');
  await assert.rejects(()=>verifyRuntimeEvidence(root,outside),/inside the project/);
}finally{
  // mkdtemp returned this exact task-owned directory; no user data is removed.
  await rm(root,{recursive:true,force:true});
}
console.log('Release gate checks passed; no actual runtime acceptance was created.');
