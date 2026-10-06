import assert from 'node:assert/strict';
import {readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read=p=>readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const provenance=json('plugins/kanto-memory/upstream/battle-hud-provenance.json');
const upstream=read('plugins/kanto-memory/upstream/engine-4.3.0-e1-ui.c').toString();
const patched=read('plugins/kanto-memory/engine/src/core/ui.c').toString();
assert.equal(hash(upstream),provenance.upstreamSHA256,'retained upstream renderer is unchanged');
assert.equal(hash(patched),provenance.overrideSHA256,'override matches the reviewed minimal patch');
assert.equal(hash(read('assets/backgrounds/battlefield.png')),provenance.battlefieldBackgroundSHA256,'background changes require a fresh reserved-tile audit');
assert.equal(hash(read('assets/fonts/bench-mono.png')),provenance.fixedFontSHA256,'font changes require a fresh glyph audit');

function tiles(p) {
  const image=PNG.sync.read(read(p));
  assert.equal(image.width%8,0); assert.equal(image.height%8,0);
  const result=[];
  for(let y=0;y<image.height;y+=8) for(let x=0;x<image.width;x+=8) {
    const tile=[];
    for(let j=0;j<8;j++) for(let i=0;i<8;i++) {
      const at=((y+j)*image.width+x+i)*4;
      tile.push(...image.data.subarray(at,at+4));
    }
    result.push(Buffer.from(tile).toString('hex'));
  }
  return {image,tiles:result};
}
const background=tiles('assets/backgrounds/battlefield.png');
// Raw-color uniqueness is a conservative ceiling before native deduplication.
// The current compiler emitted 28 tiles; even all 30 raw tiles fit below 0x20.
assert.equal(new Set(background.tiles).size,30);
assert.ok(new Set(background.tiles).size<=provenance.reservedTileFirst);
const font=tiles('assets/fonts/bench-mono.png');
assert.equal(new Set(font.tiles).size,69);
for(let i=0;i<font.image.data.length;i+=4) {
  const [r,g,b,a]=font.image.data.subarray(i,i+4);
  assert.equal(a,255);
  assert.ok(!(g>249 || (r>249 && b>249)),'font has no transparent width markers, so every glyph is eight pixels');
}
assert.ok(28<=provenance.reservedTileFirst);
assert.equal(provenance.reservedTileLast,provenance.reservedTileFirst+69-1);
assert.ok(provenance.reservedTileLast<0x80,'HUD stays in signed background-only tiles, outside sprite VRAM');
assert.ok(provenance.reservedTileLast<0xC0,'HUD stays outside all UI frame and temporary glyph tiles');
assert.deepEqual(json('assets/fonts/bench-mono.json').mapping,{});
const settings=json('project/settings.gbsres');
const fontMeta=json('assets/fonts/bench-mono.png.gbsres');
assert.equal(settings.defaultFontId,fontMeta.id,'the guarded default font remains font zero');
assert.equal(fontMeta.symbol,'font_bench_mono_caps');
const scene=json('project/scenes/battlefield/scene.gbsres');
assert.equal(scene.symbol,'scene_battlefield');
assert.equal(scene.type,'TOPDOWN','reserved range assumes signed background tile addressing');
assert.equal(scene.backgroundId,json('assets/backgrounds/battlefield.png.gbsres').id);

function resources(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?resources(path.join(dir,d.name)):
    d.name.endsWith('.gbsres')?[path.join(dir,d.name)]:[]);
}
let draws=0;
for(const f of resources(path.join(root,'project'))) {
  const resource=JSON.parse(readFileSync(f));
  const walk=value=>{
    if(!value || typeof value!=='object') return;
    if(value.command==='EVENT_TEXT_DRAW' && value.args.location==='background') {
      draws++;
      assert.ok(f.includes('/scenes/battlefield/') || /script_kanto_(identity_[14]_\d+|logic_hud)\.gbsres$/.test(f),
        'new background text owner requires an explicit tile-allocation audit: '+f);
      assert.ok(!/!F:/.test(value.args.text),'HUD does not switch away from the guarded font');
    }
    for(const child of Object.values(value)) if(typeof child==='object') walk(child);
  };
  walk(resource);
}
assert.equal(draws,459,'all 151 enemy/player name and type rows plus HP/level rows are audited');

// Verify that removing only the marked Kanto additions reconstructs upstream.
const noIncludes=patched.replace(/\n\/\/ Kanto: keep persistent battle HUD glyphs[\s\S]*?#define KANTO_HUD_GLYPH_COUNT 69u\n/,'');
const restored=noIncludes.replace(/        \/\/ Kanto battlefield uses tiles[\s\S]*?            return TRUE;\n        }\n/,'');
assert.equal(restored,upstream,'unrelated upstream renderer behavior is byte-for-byte preserved');

// Compile and execute the actual upstream and patched fixed-font C branches
// against an in-memory VRAM adapter. This is a source-level allocator test,
// not an emulator screenshot or evidence that the rebuilt ROM was played.
function fixedBranch(source) {
  const marker='    } else {\n        if (vwf_current_offset) ui_next_tile();\n';
  const start=source.indexOf(marker,source.indexOf('UBYTE ui_print_render'))+marker.length;
  assert.ok(start>=marker.length);
  return '        if (vwf_current_offset) ui_next_tile();\n'+source.slice(start,source.indexOf('\n    }\n}',start));
}
const nextTile=upstream.slice(upstream.indexOf('inline void ui_next_tile'),upstream.indexOf('\nvoid ui_print_reset')).replace('inline void','void');
const harness=`
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
typedef uint8_t UBYTE;
#define CGB 1
#define TRUE 1
#define FONT_RECODE 1
#define TEXT_BUFFER_START 0xCCu
#define TEXT_BUFFER_START_BANK1 0xC0u
#define KANTO_HUD_TILE_BASE 0x20u
#define KANTO_HUD_GLYPH_COUNT 69u
#define VBK_BANK_0 0
#define BANK(x) bank_##x
enum {bank_scene_battlefield=23,bank_font_bench_mono_caps=42};
static UBYTE scene_battlefield, other_scene, bkg[1024], win[1024];
static struct {UBYTE bank; const void *ptr;} current_scene;
static struct {UBYTE attr,mask;} vwf_current_font_desc;
static UBYTE _is_CGB,VBK_REG,ui_current_tile,ui_current_tile_bank,ui_prev_tile,ui_prev_tile_bank;
static UBYTE vwf_current_offset,vwf_current_font_idx,vwf_current_font_bank;
static UBYTE *text_render_base_addr;
static UBYTE vram[2][256][16],bitmaps[69][16];
static UBYTE *GetBkgAddr(void) {return bkg;}
static void SetBankedBkgData(UBYTE tile,UBYTE count,const UBYTE *data,UBYTE bank) {
  (void)bank; assert(count==1); memcpy(vram[VBK_REG][tile],data,16);
}
static void ui_load_tile(const UBYTE *data,UBYTE bank) {
  VBK_REG=ui_current_tile_bank; SetBankedBkgData(ui_current_tile,1,data,bank); VBK_REG=0;
}
${nextTile}
static UBYTE upstream_render(UBYTE letter,const UBYTE *bitmap) {
  (void)letter;
${fixedBranch(upstream)}
}
static UBYTE patched_render(UBYTE letter,const UBYTE *bitmap) {
${fixedBranch(patched)}
}
static void reset(UBYTE cgb) {
  memset(vram,0,sizeof(vram));
  for(int i=0;i<69;i++) memset(bitmaps[i],i+1,16);
  _is_CGB=cgb; VBK_REG=0; ui_current_tile=0xCC; ui_current_tile_bank=0;
  ui_prev_tile=0; ui_prev_tile_bank=0; vwf_current_offset=0;
  vwf_current_font_idx=0; vwf_current_font_bank=bank_font_bench_mono_caps;
  vwf_current_font_desc.attr=FONT_RECODE; vwf_current_font_desc.mask=0xFF;
  current_scene.bank=bank_scene_battlefield; current_scene.ptr=&scene_battlefield;
  text_render_base_addr=bkg;
}
static void fallback_unchanged(void) {
  UBYTE tile=ui_current_tile,bank=ui_current_tile_bank;
  assert(patched_render(35,bitmaps[35]));
  assert(ui_prev_tile==tile && ui_prev_tile_bank==bank);
  assert(ui_current_tile==tile+1 && ui_current_tile_bank==bank);
}
int main(void) {
  for(int cgb=0;cgb<2;cgb++) {
    int pool=cgb?116:52;
    reset(cgb);
    upstream_render(35,bitmaps[35]);
    UBYTE oldTile=ui_prev_tile,oldBank=ui_prev_tile_bank;
    text_render_base_addr=win;
    for(int n=0;n<pool;n++) upstream_render(12,bitmaps[12]);
    assert(vram[oldBank][oldTile][0]!=bitmaps[35][0]);
    for(int start=0;start<pool;start++) {
      reset(cgb);
      for(int n=0;n<start;n++) ui_next_tile();
      UBYTE tile=ui_current_tile,bank=ui_current_tile_bank;
      for(int glyph=0;glyph<69;glyph++) {
        assert(patched_render(glyph,bitmaps[glyph]));
        assert(ui_prev_tile==0x20+glyph && ui_prev_tile_bank==0);
        assert(ui_current_tile==tile && ui_current_tile_bank==bank);
      }
      text_render_base_addr=win;
      for(int n=0;n<pool*4;n++) patched_render(12,bitmaps[12]);
      for(int glyph=0;glyph<69;glyph++) assert(vram[0][0x20+glyph][0]==glyph+1);
    }
  }
  reset(1); text_render_base_addr=win; fallback_unchanged();
  reset(1); current_scene.bank++; fallback_unchanged();
  reset(1); current_scene.ptr=&other_scene; fallback_unchanged();
  reset(1); vwf_current_font_idx=1; fallback_unchanged();
  reset(1); vwf_current_font_bank++; fallback_unchanged();
  reset(1); vwf_current_font_desc.attr=0; fallback_unchanged();
  reset(1); vwf_current_font_desc.mask=0x7F; fallback_unchanged();
  reset(1); patched_render(69,bitmaps[12]); assert(ui_prev_tile==0xCC);
  puts("Actual C branches: original 52/116-tile pool conflict reproduced; 69 pinned glyphs survive four wraps from every cursor; all guards preserve fallback.");
  return 0;
}
`;
const temporary=mkdtempSync(path.join(tmpdir(),'kanto-hud-check-'));
try {
  const c=path.join(temporary,'hud.c'),binary=path.join(temporary,'hud-check');
  writeFileSync(c,harness);
  let result=spawnSync(process.env.CC||'cc',['-std=c99','-Wall','-Wextra','-Werror',c,'-o',binary],{encoding:'utf8'});
  assert.equal(result.status,0,'C harness compilation: '+(result.error||result.stderr));
  result=spawnSync(binary,[],{encoding:'utf8'});
  assert.equal(result.status,0,'C allocator regression: '+result.stderr);
  process.stdout.write(result.stdout);
} finally {rmSync(temporary,{recursive:true,force:true});}
console.log('HUD source/font/tile budgets passed. A new native build and genuine battle/menu/party/HP regression are still required.');
