# Kanto full-width single-column menus

This project-local plugin is pinned to GB Studio 4.3.2 commit
ccb891b2670134ba8237416772eea4ed09d34e1e. Its EVENT_KANTO_MENU command handles
26 single-column side menus in three native resources. All 988 dialogue-layout
menus retain the core EVENT_MENU path. Event IDs, labels, selection variables,
cancellation flags, branches and ordering are preserved.

The single-column compiler sequence is the native 4.3.2 sequence with four
geometry changes: window width 10 -> 20 tiles and three x=10 positions -> x=0.
Text speed, vertical position, waits, menu navigation, indirect variables and
closing reset are unchanged. The interior now fits 17 fixed-width characters;
the longest authored side-menu label is 13. Full-width windows use the engine's
existing scanline sprite occlusion. Actor code and the persistent battle HUD
renderer are not modified.

The original upstream menu handler, MIT license, source hashes and plugin diff
are retained under upstream/. The project-local helper boundary uses actual
4.3.2 ScriptBuilder helpers, including underscore-prefixed helpers; rerun the
integration check before upgrading the compiler.

## Checks

- node scripts/menu-check.mjs validates all 1,014 native menu events against
  the retained routing baseline and matching authoring-plan entries, the exact
  output helper sequence and 28 indirect-selection/cancellation cases.
- node scripts/menu-plugin-native-check.cjs /path/to/gb-studio checks the real
  pinned project loader, QuickJS plugin boundary and native ScriptBuilder. It
  compares full generated assembly, allowing only the four geometry lines for
  single-column menus; dialogue menus remain identical.
- npm test includes the menu source check and all previous source checks.

The previous cloud executor was replaced during a scoped native build before
any ROM result. This plugin and the four native/authoring files were recovered
byte-for-byte using pre-reset hashes, while the validation scripts were rebuilt.
These facts do not establish a passing native build or runtime regression.
Actual new-ROM playtesting remains required: long labels, species pagination,
selection, B cancel, NPC occlusion, return to world, evolution menu and battle
HUD. Never restore an emulator state from another ROM. Preserve the release
requirements in verification/PLAYTEST.md; no new release is approved by source
or compiler tests alone.
