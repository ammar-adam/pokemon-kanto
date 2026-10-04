# Asset Sources

All 151 Pokemon front/back sprite references come from
[PokeAPI/sprites](https://github.com/PokeAPI/sprites), using Generation II Crystal
front and back images. The retained references are cropped, scaled with nearest
neighbor sampling, and reduced to the cartridge's three visible sprite colors.
These are Pokemon artwork and remain the property of their respective owners;
the repository's code license does not license those characters or sprites.

Red, Blue, Oak, and Nurse Joy use overworld sprite references from the pinned
pret/pokered revision linked below, converted to native sprite colors and
animation order. `character-art-provenance.json` records source hashes.
`scripts/refresh-character-art.mjs` reproduces these conversions while retaining
native sprite IDs. Other trainers and the custom maps remain project-authored.
The world layout is not a reconstruction of the original game's maps.

The five music tracks are original homebrew compositions, not the commercial
soundtrack. `music-score.mjs` contains their scores; `scripts/author-music.mjs`
uses the installed GB Studio UGE serializer without modifying its installation.

Names, base statistics, original-generation learnsets, and evolution information
are cached from [PokeAPI v2](https://pokeapi.co/docs/v2). The generated
`kanto-data.json` preserves the input facts used by the roster authoring script.
The game uses compact custom battle rules; current moves derive from the
pinned Red learnset snapshot rather than the older curated four-move sets.

The battle pass retains numeric original base stats and move records in
`red-base-stats.json` and `red-moves.json`, from
[pret/pokered](https://github.com/pret/pokered/tree/d2704a63c26f9ba046ade877445216b3de0519a4).
Both files retain provenance; the two `fetch-red-*` scripts reproduce the
extraction. No commercial ROM is required or bundled. The base-stat data
supersedes modern PokeAPI values for HP, Attack, Defense, and combined Special.
`red-learnsets.json` records initial moves and level-up facts for all 151
species from the same revision. `fetch-red-learnsets.mjs --check` verifies
the snapshot against its pinned upstream records.

The Blue-specific encounter slots in `opening-story.mjs` follow the same pinned
revision's [Viridian Forest table](https://github.com/pret/pokered/blob/d2704a63c26f9ba046ade877445216b3de0519a4/data/wild/maps/ViridianForest.asm)
and [Route 22 table](https://github.com/pret/pokered/blob/d2704a63c26f9ba046ade877445216b3de0519a4/data/wild/maps/Route22.asm).
The `BLUE` branches determine species and levels; the ten slot weights are
20, 20, 15, 10, 10, 10, 5, 5, 4, and 1 percent. These encounter facts do not
make the custom maps, battle engine, or story an exact recreation.

`red-catch-rates.json` retains all 151 numeric catch rates from that same pinned
revision. `capture-rules.mjs` implements the ordinary Poke Ball/Master Ball
outcome checks from [ItemUseBall](https://github.com/pret/pokered/blob/d2704a63c26f9ba046ade877445216b3de0519a4/engine/items/item_effects.asm).
It excludes other ball types, special encounter exceptions, and the original
random generator. Tests compare native-event arithmetic with a numeric model.

Speed uses the existing base-stat snapshot. Quick Attack and Counter priority,
Speed comparison, and random tie-breaking follow the battle ordering in
[core.asm](https://github.com/pret/pokered/blob/d2704a63c26f9ba046ade877445216b3de0519a4/engine/battle/core.asm).
The rest of Counter's effect is not implemented. Journal text is original and
describes this project's custom map layout and progression.
