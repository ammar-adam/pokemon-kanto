# Kanto VM Memory

This project-local engine plugin targets GB Studio 4.3.2 / engine 4.3.0-e1.
It retains the upstream VM header, changing only the shared-variable capacity
from 768 to 1664 and the concurrent context count from 16 to 6.
Each context retains its 64-word stack. The resulting script-memory allocation
is 4096 bytes. Kanto uses synchronous shared-script calls and no actor update
scripts; six contexts leave room for scene, interaction, and input scripts.

Do not add background script threads or upgrade the engine without checking
the context budget, call-stack depth, linked RAM layout, and save format.
The source header is from the GB Studio engine under the repository's MIT license.

## Persistent battle HUD glyphs

The `engine/src/core/ui.c` override retains the upstream 4.3.0-e1 renderer and
adds one guarded fixed-font branch. The original renderer uses a circular text
tile pool for both window text and background text. Repeated dialogue and menu
draws therefore replace glyphs that the battle HUD still references.

Only background text in `scene_battlefield`, using default font zero
`font_bench_mono_caps` with its fixed-width recode descriptor, enters the new
branch. Its 69 recoded glyphs use stable bank-0 tiles `0x20` through `0x64`.
Battlefield art compiles to 28 tiles; even its conservative raw-image unique
tile count of 30 fits below `0x20`. The reserved glyphs stay below tile `0x80`,
in the signed background-only VRAM region, and outside the sprite and temporary
UI pools. Each HUD draw loads its actual native font bitmap into the stable
slot without advancing the temporary window-text cursor. Other scenes, layers,
fonts, and renderer paths retain upstream behavior.

`upstream/` retains the exact original renderer, SHA-256 provenance, and a
minimal unified diff. `scripts/battle-hud-check.mjs` checks the asset budgets,
the explicit guards, and byte-for-byte preservation of unrelated upstream
source. It also compiles the actual original and modified fixed-font C branches
into a host-side VRAM adapter: the original pool overwrite is reproduced, and
the pinned glyphs survive repeated wraps from every possible cursor position.
This check needs a C compiler (`cc`, or `CC`) and does not establish native ROM
runtime correctness. After rebuilding, verify real opening/main/move menus,
HP changes, party changes, battle exit/re-entry, and save/load with the exact
new cartridge. Re-audit these ranges before changing the background or font,
adding background text elsewhere, or upgrading the engine.
