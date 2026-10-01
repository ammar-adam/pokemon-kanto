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
