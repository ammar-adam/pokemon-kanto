import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const ids=JSON.parse(await readFile(new URL('pokemon-resource-ids.json',import.meta.url),'utf8'));
const art=JSON.parse(await readFile(new URL('pokemon-asset-plan.json',import.meta.url),'utf8'));
for(const species of art.creatures){
  const m=JSON.parse(await readFile(new URL(`assets/sprites/kanto-${species.key}-centered.png.gbsres`,root),'utf8'));
  assert.equal(m.id,ids.sprites[species.key]);
  assert.equal(m.states[1].id,ids.back[species.key]);
  for(const state of m.states){const tiles=state.animations[0].frames[0].tiles;assert.equal(tiles.length,8);const cells=new Set();for(const t of tiles){const x=8+t.x,y=16-t.y;assert.ok(x>=0&&x+8<=32&&y>=0&&y+16<=32,'no cropped objects');cells.add(`${x},${y}`);}assert.equal(cells.size,8);}
}
console.log('Eight front/back sprite pairs fit their native 32x32 canvases without cropping. Static source check only.');
