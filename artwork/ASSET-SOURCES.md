# Asset Sources

The first 20 Pokemon sprite pairs, trainer sprites, and world backgrounds were
authored for this project. Additional Pokemon sprite references come from
[PokeAPI/sprites](https://github.com/PokeAPI/sprites), using Generation II Crystal
front and back images. The retained references are cropped, scaled with nearest
neighbor sampling, and reduced to the cartridge's three visible sprite colors.
These are Pokemon artwork and remain the property of their respective owners;
the repository's code license does not license those characters or sprites.

Names, base statistics, original-generation learnsets, and evolution information
are cached from [PokeAPI v2](https://pokeapi.co/docs/v2). The generated
`kanto-data.json` preserves the input facts used by the roster authoring script.
The game uses compact custom battle rules and curated four-move sets.

The battle pass retains numeric original base stats and move records in
`red-base-stats.json` and `red-moves.json`, from
[pret/pokered](https://github.com/pret/pokered/tree/d2704a63c26f9ba046ade877445216b3de0519a4).
Both files retain provenance; the two `fetch-red-*` scripts reproduce the
extraction. No commercial ROM is required or bundled. The base-stat data
supersedes modern PokeAPI Attack/Defense/Special values for damage only.
