# Pokemon Kanto: First Chapter

A custom Game Boy Color fan game featuring actual first-generation Pokemon,
Red, Professor Oak, Blue, Nurse Joy, and Brock. This is an expanded first
chapter, not the full commercial Red/Blue game or a proprietary ROM download.

## Game

Choose Charmander, Bulbasaur, or Squirtle at Oak's lab. Battle Blue, explore
Route 1, catch Pokemon, train against a Youngster, and challenge Brock's
Geodude and Onix for the Boulder Badge. Exploration remains available after
the badge. The town, lab, route and gym are condensed into a small map.

- Eight Pokemon: Charmander, Bulbasaur, Squirtle, Pikachu, Geodude, Zubat,
  Onix and Pidgey, with custom hand-authored front/back pixel sprites.
- Four named moves per species, individual PP, Struggle, critical hits,
  elemental advantages, Electric immunity for Geodude/Onix, and battle effects.
- Individual HP, levels, and experience. Levels currently cap at 20.
- A maximum six-member party; excess unique catches go into Bill's PC.
- PC deposit/withdrawal, party switching, fainting and full-party recovery.
- Nurse Joy restores HP, PP and supplies near the CENTER building.
- A Start menu for Pokemon, the eight-entry Pokedex, trainer card and saving.
- New Game and Continue, with native battery-backed save events.

Weaken a wild Pokemon before throwing a Poke Ball from BAG. Capture is
guaranteed at one-third HP or less. Trainer Pokemon cannot be caught.
There is one saved representative per species, not duplicate individual catches.
Moves, encounter distribution, stats, XP, capture and status effects use custom
compact-game balancing; they do not reproduce the complete Generation I engine.
There are no evolutions, 151-species roster, trading, Elite Four, or full Kanto
campaign in this build. Those remain expansion work, not completed features.

## Files And Controls

- `build/pokemon-kanto.gbc`: new compiled GBC-only cartridge.
- `build/pocket-frontier.gbc`: preserved earlier original-creature ROM.
- `project.gbsproj`: editable native GB Studio project; built with CLI 4.3.2.
- `project/`: editable scenes, actors, triggers, palettes, variables, and events.
- `artwork/`: retained pixel-authoring sources and game-design source.
- `verification/`: build receipts, authored-logic results, and acceptance limits.

Use a Game Boy Color-compatible emulator or an appropriate homebrew cartridge.
D-pad moves and selects. A interacts and confirms. B cancels supported menus.
Start opens the overworld menu. A physical Chromatic is not needed to compile.
No cartridge flashing or hardware deployment has been performed.

## Build And Verification

From the original Windows workspace, use the verified helper:

```powershell
& '.\work\run-chromatic.ps1' -ProjectPath '<absolute path to project.gbsproj>' -RequestPath '<absolute path to artwork\pokemon-build-request.json>'
```

The helper preserves the installed plugin and its original temporary-directory
ownership checks. Its project path must remain inside the workspace. The desktop
GB Studio editor is separate and was not installed as part of this task.

Fresh compilation and inspection receipts are retained in `verification/`.
The final 256 KB ROM compiles successfully, its cartridge header is valid, and
36 authored-event unit checks pass. All eight front/back sprite pairs fit their
32x32 canvases, and static graphics budgets have no reported diagnostics.
`artwork/logic-check.mjs` checks the actual native resources rather than only
the design generator. Its results explicitly identify authored-event unit
simulation, not ROM execution. Static graphics review is not gameplay evidence.

The public plugin emulator timed out on the Pokemon build before the final
sprite-coordinate correction. The final build has not run in an emulator.
Browser preview
still cannot build because the app's temporary directory is not trusted. Live
movement, rendering, controller timing, save reloads, and complete gameplay
remain unverified. No alternate caller was used to bypass emulator restrictions.

The project retains the original minimal font/UI resources and their existing
license. Pokemon names and character designs belong to their respective owners.
The maps, raster files, scripts and balancing were custom authored here.
The earlier Pocket Frontier ZIP remains untouched in workspace outputs.
Preserve edited native resources and PNGs; do not regenerate over later edits.
