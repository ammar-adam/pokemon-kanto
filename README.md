# Pokemon Kanto: Opening Remake Preview

## Unreleased Battle And Blue Accuracy Pass

New release packages are blocked until the exact ROM passes the retained live
checks in [the release playtest checklist](verification/PLAYTEST.md), including
all three save/reload files, battle flow, the campaign, audible sound, and an
on-screen playable demo. Source tests alone cannot clear this gate. The current
ROM's approved emulator boot still times out; its test session was closed.

FIGHT now resolves by move priority and species Speed. Quick Attack goes first
against ordinary moves; equal priority uses Speed, and ties use a random side.
Foe paralysis lowers Speed. Each side acts at most once; fainting before an
action prevents that action and its PP charge. Speed uses fixed DV 9 and zero
stat experience, matching this game's other stats.

Poke Balls now use all 151 original catch rates and Blue's ordinary-ball
HP/status checks. Low HP helps but no longer guarantees a catch. Sleep, poison,
and paralysis improve the outcome; valid Master Ball targets always succeed.
Great/Ultra/Safari Balls, shake animations, freeze/burn, and the original ROM's
random generator are not implemented. Failed catches still spend one turn.

Start > Journey now gives a specific next objective, destination, and clue
from Oak's parcel through the gyms, League, and postgame. It follows quest
flags, alternate routes, and the current League attempt, without changing
progress or writing a save.

The direct battle HUD now uses an escaped reference to global variable zero,
preventing the compiler from allocating an unintended local beyond the VM
heap. Scene initialization also declares shared scripts in dependency order,
using reference-only events with no runtime assembly. This avoids GB Studio
4.3.2 silently caching empty routines when nested compilation exceeds its
depth limit. Native verification requires all 2,606 shared routines to be
linked, rejects return-only stubs for nonempty authored routines, and checks
nine critical call sites. Fourteen intentional no-op learning hooks are allowed.

Attack/defense, type, HP, and opponent-move lookups now select a small indexed
branch instead of scanning the entire roster. The authored attack regression
checks every species and permits fewer than 200 comparisons; the measured
worst case is 151. Opponent turns stay below 250 in the species, level, and
move-slot test matrix, with a measured worst case of 202. These are source-work
bounds, not hardware frame-rate claims.

Viridian Forest and Route 22 now use Blue's version-specific encounter slots:
Caterpie and Metapod dominate the forest, Pikachu remains rare, and Nidoran
female is the common Nidoran on Route 22. Other early shared tables are retained.
The source checks pass locally and on GitHub. The combined 4 MiB native ROM
build passes with all shared routines, nine critical call sites, five music
tracks, three non-overlapping save regions, and the linked memory budget
verified. Its SHA-256 is
`754c464704c03d4a3731654f0d7eb3538d67178813fbc1aaa31adf39a51921c9`.
This is an unreleased local build, not a replacement for the existing download.
It still needs live playtesting before another release or install.

The approved public emulator currently times out during opening, including
with zero initial frames. The official browser export rejects its Windows
temporary directory before compilation. Earlier rebuilt ROMs encountered the
same startup timeout. All test sessions were closed; no hardware was written.
These are preview blockers, not missing user consent.

## v0.4.0-alpha.5

This presentation pass adds five original chiptune tracks, authentic-design
portraits for the first 20 species, corrected transparent backgrounds for all
151 portrait pairs, and reference-based Red, Blue, Oak, and Nurse Joy sprites.
Music is assigned to all 68 scenes. These are original compositions, not the
commercial game's soundtrack.

Health updates no longer reload sprites or scan the full roster. Portraits
refresh only on battle entry and replacements. Moves and remaining PP share a
full-width menu; B returns without spending a turn. Poison and Leech Seed now
resolve after the opponent acts, scale with maximum HP, and clamp correctly.
Oak, Mom, Blue, and the parcel quest have expanded direction and motivation.

The opening now has New Game and Continue with three independent save files.
New adventures offer Fast, Normal, or Instant text. Continue previews badges
and Pokedex progress. Start > Save chooses a file and asks before overwriting;
Start > Options changes text speed. New Game does not delete saved progress.
These are this homebrew's saves, not compatible with retail Pokemon Blue saves
or older alpha builds. Runtime persistence remains unverified.

This is still a custom homebrew alpha, **not a 1:1 Pokemon Blue remake**.
The maps, movement, story scenes, and several battle rules remain simplified.
The source checks and native build do not verify runtime smoothness or sound.
Start a new save and keep your old save backed up.

## Previous Battle Pass

Three separate feature commits add species-based HP, original level-up moves,
and named opponent moves. The release remains a balance-test alpha, not the
original Red/Blue engine or a verified full playthrough. **Start a new save.**

### HP

HP now uses each species' original base HP, fixed DV 9, and zero stat
experience. Starters, wild encounters, trainer teams, healing, and gifts use
the same formula. Level-up and evolution preserve missing HP and do not
revive fainted Pokemon. Captures retain their remaining HP; gifts arrive healed.

### Move Learning

All 151 species now use original Red initial moves and level-up learnsets,
with original PP. Moves unlock on level-up; retained moves keep their PP.
The latest four learned moves are selected automatically. Manual forgetting,
TM/HM teaching, and inherited evolution moves are not implemented. Evolution
recomputes the target species' moves and restores PP. Complex battle effects
are still simplified or explicitly fail; this is not the exact Red engine.

### Opponent Moves

Wild Pokemon and trainers choose uniformly from their species' current
level-derived moves, announce the move, and use its power, type, and accuracy.
Growl, Tail Whip, Leer, and Harden use capped physical damage modifiers.
Recovery, drain, recoil, and fixed-damage moves have dedicated handling.
Opponent PP, sophisticated trainer AI, full status/stage rules,
multi-hit/multi-turn effects, and several special moves remain unfinished.
Unsupported non-damaging effects fail rather than becoming generic attacks.

### Existing Damage Model

The battle pass uses original base Attack, Defense, and combined Special stats
for all 151 Pokemon, plus original damaging-move power/type and move accuracy.
Damage includes same-type bonuses, type matchups, and a 217-255 random factor.
Misses spend PP and a turn. Native arithmetic is checked against an independent
reference and a boundary-value matrix.
Base data is pinned to a [pokered revision](https://github.com/pret/pokered/tree/d2704a63c26f9ba046ade877445216b3de0519a4).

This is not yet the original battle engine: combat stats use fixed DV 9 and
zero stat experience; status effects, critical hits, multi-hit moves, and the
capture features outside ordinary Poke Balls/Master Balls remain incomplete. Damage is capped
at 999 before type modifiers. Runtime speed, audio, saves, and gameplay have
not been verified. Start a new save and treat this as a balance-test alpha.

## Earlier Progression

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
ten weighted species/level slots, including rare wild Pikachu. The unreleased
pass above corrects the forest's version-exclusive slots from Red to Blue.

Six opening backgrounds have new color artwork. These are custom layouts, not
exact original maps; the house is still one room. Encounter frequency, battle
stats, move learning, dialogue, and later campaign areas remain simplified.
There are 68 native scenes. The prior v0.3.0 campaign release is preserved.
**Start a new save for this preview.** Controller play, saves, and hardware
have not been verified. Automated logic checks are source checks, not playtests.

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
- Up to four level-derived moves per species, PP, type interactions, experience, party switching,
  six-member party, PC storage, healing, Pokedex pages, and battery saves.
- Color palettes vary by area, with custom map and trainer pixel art.

Battles, levels, encounters, and progression are tailored to this compact game.
The unreleased capture pass uses species catch rates, HP, and status; low HP
alone does not guarantee success. There is one saved representative per species,
not duplicate catches.
This is a **complete-campaign preview**, not the original Red/Blue ROM or its
exact maps, dialogue, or battle engine. Levels cap at 100. There is no link-cable
multiplayer, breeding, held-item system, or original move-learning interface.
Not every original building or NPC is recreated. Move replacement is automatic.

## Download And Install

Get the [latest release](https://github.com/ammar-adam/pokemon-kanto/releases)
and extract the ZIP. Open `Pokemon-Kanto.gbc` in a Game Boy Color-compatible
emulator, or follow [the Chromatic installation guide](distribution/INSTALL.md)
for a supported writable homebrew cartridge. The included Windows assistant
checks the ROM hash and opens that guide; it does **not** flash a cartridge.
Playing the ROM does not require Node, Python, GB Studio, or a connected device.

D-pad moves/selects; A interacts/confirms; B cancels supported menus; Start
opens the field menu. **Start a new game for v0.4.0-alpha.5.** Its progression and VM
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
