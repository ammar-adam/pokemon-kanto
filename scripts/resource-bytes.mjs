// GB Studio's native byte-run format: a hex byte, then ! or a hex count and +.
export function decodeResourceBytes(encoded, { maximumValues }) {
  if (!Number.isSafeInteger(maximumValues) || maximumValues < 0) throw new Error('Invalid resource limit');
  const result = [];
  const token = /([0-9a-f]{2})(!|([0-9a-f]+)\+)/iy;
  while (token.lastIndex < encoded.length) {
    const offset = token.lastIndex;
    const match = token.exec(encoded);
    if (!match || token.lastIndex <= offset) throw new Error('Invalid byte run at '+offset);
    const count = match[2] === '!' ? 1 : Number.parseInt(match[3], 16);
    if (!Number.isSafeInteger(count) || count < 1 || result.length + count > maximumValues) throw new Error('Resource size exceeds limit');
    const value = Number.parseInt(match[1], 16);
    for (let i=0; i<count; i++) result.push(value);
  }
  if (result.length !== maximumValues) throw new Error('Resource grid size mismatch');
  return Uint8Array.from(result);
}
