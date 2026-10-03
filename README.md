# Pokemon Kanto: Opening Remake Preview

## v0.4.0-alpha.2

The progression pass adds Blue's early Route 22 and Cerulean fights, all eight
Route 3 trainers, and Pewter's gym Camper. Route 22 no longer has endgame wild
Pokemon beside the starting city. Route 3 and Mt. Moon now also use weighted
Red species/level tables. All eight gym leaders have their Red/Blue party sizes,
species, and levels; later Blue teams vary their supporting Pokemon as well as
their starter. These roster facts follow the [Red trainer data](https://github.com/pret/pokered/blob/master/data/trainers/parties.asm).
HP, damage, capture, and move-learning rules are still the custom battle model.

The new trainers are interaction-triggered, not original sight-line encounters.
Forest has three Bug Catcher battles and a guide. Ekans and Sandshrew remain
available in the postgame reserve so accurate early tables do not remove their
evolution families from the collection. This remains an unfinished remake.

This branch starts a more faithful opening, not a finished recreation of Red/Blue.
Start at home, meet Oak, choose one of three starter balls, battle Blue, collect
Oak's parcel at Viridian Mart, and return it to unlock the Pokedex and northern
path. Viridian now has separate Mart and Pokemon Center interiors. Purchases
cost money; healing no longer restocks items. Route One and Viridian Forest use
Red's ten weighted species/level slots, including rare wild Pikachu.

Six opening backgrounds have new color artwork. These are custom layouts, not
exact original maps; the house is still one room. Encounter frequency, battle
stats, move learning, dialogue, and later campaign areas remain simplified.
There are 68 native scenes. The prior v0.3.0 campaign release is preserved.
**Start a new save for this preview.** Controller play, saves, and hardware
have not been verified. The 67 logic tests are source checks, not playtests.

Encounter references: [Route One](https://github.com/pret/pokered/blob/master/data/wild/maps/Route1.asm)
and [Viridian Forest](https://github.com/pret/pokered/blob/master/data/wild/maps/ViridianForest.asm).

## Campaign Foundation

An unofficial, custom Game Boy Color fan game with a compact Kanto journey
from Pallet Town to the Hall of Fame. This is original homebrew source, not a
copy of the commercial Pokemon Red/Blue ROM or its full game engine.

## Play

Choose Charmander, Bulbasaur, or Squirtle at Oak's lab, battle Blue, travel
through Viridian Forest and Mt. Moon, meet Bill, board the S.S. Anne, confront
Team Rocket, challenge all eight gyms, and conquer the Elite Four and Blue.
The opening remake builds on the earlier compact campaign.

- All 151 first-generation Pokemon have encounter, gift, or evolution paths.
- Level and stone evolution, a local trade-evolution service, shops, Fly travel,
  Master Ball, and postgame legendary encounters.
- Tower rescue, Safari Zone, Silph Co., Seafoam, Cinnabar Mansion, Victory Road,
  the League, Power Plant, Cerulean Cave, and a postgame reserve.
- Viridian Forest encounters include Caterpie, Weedle, Metapod, Kakuna,
  and Pikachu. Other routes and caves have distinct encounter pools.
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
opens the field menu. **Start a new game for v0.4.0-alpha.2.** Its progression and VM
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
