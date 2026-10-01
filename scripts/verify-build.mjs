import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const receipt = {
  buildPassed: true,
  builder: build.result.builder,
  sizeBytes: rom.length,
  sha256,
  colorMode: inspect.result.colorMode,
  cartridgeType: inspect.result.cartridgeTypeName,
  headerValid: inspect.result.valid,
  projectRevision: build.result.debugArtifacts?.sourceProvenance?.projectRevision || null,
  sourceChecks: 'npm test passed locally; GitHub Actions checks source only',
  romExecuted: false,
  runtimeLimit: 'Public emulator timed out; browser preview unavailable. Gameplay, saves, and hardware play remain unverified.'
};
await writeFile(path.join(root, 'verification/current-release.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ sha256, sizeBytes: rom.length, projectRevision: receipt.projectRevision }));
