import assert from 'node:assert/strict';
import { decodeResourceBytes as decode } from './resource-bytes.mjs';
assert.deepEqual([...decode('0f2+00!8010+', {maximumValues:19})], [15,15,0,...Array(16).fill(128)]);
assert.deepEqual([...decode('FF!00!', {maximumValues:2})], [255,0]);
for (const bad of ['f!', 'gg!', '00', '000+', '00!junk', '001000000000000000+', '003+']) {
  assert.throws(()=>decode(bad,{maximumValues:2}));
}
assert.throws(()=>decode('00!',{maximumValues:2}));
console.log('Portable resource codec fixtures passed.');
