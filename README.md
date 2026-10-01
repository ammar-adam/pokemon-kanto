# Pokemon Kanto: Champion Quest

An unofficial, custom Game Boy Color fan game with a compact Kanto journey
from Pallet Town to the Hall of Fame. This is original homebrew source, not a
copy of the commercial Pokemon Red/Blue ROM or its full game engine.

## Play

Choose Charmander, Bulbasaur, or Squirtle at Oak's lab, battle Blue, travel
through Viridian Forest and Mt. Moon, meet Bill, board the S.S. Anne, confront
Team Rocket, challenge all eight gyms, and conquer the Elite Four and Blue.
The project has 66 scenes, including 64 campaign areas, title and battle scenes.

- All 151 first-generation Pokemon have encounter, gift, or evolution paths.
- Level and stone evolution, a local trade-evolution service, shops, Fly travel,
  Master Ball, and postgame legendary encounters.
- Tower rescue, Safari Zone, Silph Co., Seafoam, Cinnabar Mansion, Victory Road,
  the League, Power Plant, Cerulean Cave, and a postgame reserve.
- Viridian Forest encounters include Caterpie, Weedle, Metapod, Pikachu,
  Butterfree, and Beedrill. Other routes and caves have distinct encounter pools.
- Bug Catchers, Scouts, Hikers, Lass, Sailor, Rocket Grunts, Blue, Giovanni,
  and gym leaders have different teams and one-time victory flags.
- Four moves per species, PP, type interactions, experience, party switching,
  six-member party, PC storage, healing, Pokedex pages, and battery saves.
- Color palettes vary by area, with custom map and trainer pixel art.

Battles, levels, encounters, progression, and capture rules are tailored to this
compact game. A wild Pokemon is guaranteed to be caught at one-third HP or
less. There is one saved representative per species, not duplicate catches.
This is a **complete-campaign preview**, not the original Red/Blue ROM or its
exact maps, dialogue, or battle engine. Levels cap at 100. There is no link-cable
multiplayer, breeding, held-item system, or original move-learning interface.
Not every original building or NPC is recreated. Moves are curated per species.

## Download And Install

Get the [latest release](https://github.com/ammar-adam/pokemon-kanto/releases)
and extract the ZIP. Open `Pokemon-Kanto.gbc` in a Game Boy Color-compatible
emulator, or follow [the Chromatic installation guide](distribution/INSTALL.md)
for a supported writable homebrew cartridge. The included Windows assistant
checks the ROM hash and opens that guide; it does **not** flash a cartridge.
Playing the ROM does not require Node, Python, GB Studio, or a connected device.

D-pad moves/selects; A interacts/confirms; B cancels supported menus; Start
opens the field menu. **Start a new game for v0.3.0.** Its expanded roster and VM
memory layout are incompatible with older saves. Back up old `.sav` files.

## Edit And Test

Open `project.gbsproj` in GB Studio 4.3.2 to edit or export a ROM. The `project/`
and `assets/` directories are the native game; `artwork/` retains deterministic
pixel-art and game-design authoring sources. Do not regenerate over later native
edits without reconciling them.

With Node 22+, run `npm ci` then `npm test` for source/resource checks. These cover authored
events, randomized encounter branches, multi-Pokemon trainer wins, navigation
reachability, sprite bounds, and native resource parity. GitHub Actions runs
the same checks on each push and pull request. It does **not** compile or run
the ROM on GitHub.

The release ROM is compiled with GB Studio CLI 4.3.2 and GBDK 4.5.0 using the
ModRetro Chromatic plugin. In the original Windows workspace, the verified
`work/run-chromatic.ps1` helper supplies an account-owned temporary directory
to the unchanged plugin server. Its project path must stay inside that workspace.
`release.json` in each ZIP records the exact ROM checksum and verification
limits. A successful compile and source checks do not prove live controller,
rendering, save/reload, or full campaign playability. The plugin's public
emulator and browser preview were unavailable for this release, so those
runtime checks remain open. The project-local `plugins/kanto-memory` engine
plugin is required for the expanded roster. Do not remove it or upgrade the
engine without checking linked RAM, call depth, and the save layout.

Pokemon names and character designs belong to their respective owners. The
project includes original maps and adapted sprite artwork; see
[asset sources](artwork/ASSET-SOURCES.md). This noncommercial fan project is
unaffiliated with those owners. The repository's inherited GB Studio license
does not grant rights to the Pokemon property.
