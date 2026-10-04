import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const requiredPlaytests = [
  'opening', 'battle-flow', 'campaign', 'postgame',
  'save-slot-1', 'save-slot-2', 'save-slot-3',
  'save-cancel', 'new-game-keeps-saves', 'audio', 'visible-demo',
];
const hashPattern = /^[a-f0-9]{64}$/;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

export function assertReleaseReady(build, playtest, rom) {
  const sha256 = createHash('sha256').update(rom).digest('hex');
  assert.equal(build.buildPassed, true, 'Native build must pass');
  assert.equal(build.headerValid, true, 'Cartridge header must pass');
  assert.equal(build.sha256, sha256, 'Build receipt belongs to a different ROM');
  assert.equal(build.sizeBytes, rom.length, 'Build receipt ROM size mismatch');
  assert.ok(hashPattern.test(build.projectRevision), 'Build needs a source revision');
  assert.equal(playtest.schemaVersion, 1, 'Unsupported runtime acceptance format');
  assert.equal(playtest.romSha256, sha256, 'Playtests belong to a different ROM');
  assert.equal(playtest.romSizeBytes, rom.length, 'Playtest ROM size mismatch');
  assert.equal(playtest.projectRevision, build.projectRevision, 'Playtest source revision mismatch');
  assert.ok(nonempty(playtest.tester), 'Runtime acceptance needs a named tester');
  assert.ok(nonempty(playtest.testedAt) && Number.isFinite(Date.parse(playtest.testedAt)), 'Runtime acceptance needs a test date');
  assert.ok(['emulator', 'browser', 'chromatic'].includes(playtest.environment?.kind), 'Source checks are not runtime playtests');
  assert.ok(nonempty(playtest.environment?.version), 'Record the tested runtime or device version');
  assert.deepEqual(playtest.openIssues, [], 'Unresolved playtest issues block release');
  assert.ok(Array.isArray(playtest.checks), 'Runtime checks are missing');
  assert.deepEqual(playtest.checks.map(check => check.id).sort(), [...requiredPlaytests].sort(), 'Complete every required runtime check exactly once');
  for (const check of playtest.checks) {
    assert.equal(check.status, 'passed', `Runtime check has not passed: ${check.id}`);
    assert.ok(nonempty(check.observed), `Record the actual observation: ${check.id}`);
    assert.ok(Array.isArray(check.evidence) && check.evidence.length, `Retain evidence for ${check.id}`);
    for (const evidence of check.evidence) {
      assert.ok(nonempty(evidence.path), `Missing evidence path: ${check.id}`);
      assert.ok(hashPattern.test(evidence.sha256), `Missing evidence hash: ${check.id}`);
    }
  }
  return sha256;
}

export async function verifyRuntimeEvidence(root, playtest) {
  const canonicalRoot = await realpath(root);
  for (const check of playtest.checks) {
    for (const evidence of check.evidence) {
      const file = await realpath(path.resolve(root, evidence.path));
      const relative = path.relative(canonicalRoot, file);
      assert.ok(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'Evidence must remain inside the project');
      const bytes = await readFile(file);
      assert.ok(bytes.length, `Empty runtime evidence: ${evidence.path}`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), evidence.sha256, `Runtime evidence changed: ${evidence.path}`);
    }
  }
}
