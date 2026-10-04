# Presentation and Battle Clarity Alpha

- Five original four-channel chiptune tracks, with music cues in all 68 scenes.
- Reference-based portraits replace the rough first 20 Pokemon designs. All 151
  front/back pairs now remove opaque reference-image borders.
- Red, Blue, Oak, and Nurse Joy use reference-based overworld artwork.
- Health updates no longer scan all species and reload both portraits. The
  bank-sized portrait lookup runs on entry and replacements only.
- Full-width move choices show remaining PP. B cancels without spending a turn.
  Fixed-width health values fit even at three digits.
- Poison and Leech Seed resolve after the opponent acts, scale with maximum HP,
  and clamp damage and healing.
- Expanded opening conversations explain Oak's research, the parcel errand,
  and the route from Pallet toward Pewter.

## Install

Extract the ZIP and read INSTALL.html. The included Windows assistant verifies
the download and opens the guide; it does not write a cartridge. Back up your
old save and start a new game. Playing the ROM in a GBC-compatible emulator
does not require development tools.

## Verification and Limits

The source suite passes 83 gameplay-logic checks, HP and move cases covering
all 151 species and levels 1-100, plus navigation, sprite, music-cue, and memory
checks. The included release.json records native-build checks and the ROM hash.
Audio output, controller responsiveness, save/reload, and this revision on real
hardware remain unverified because runtime testing was unavailable.

This remains custom homebrew, not a 1:1 Pokemon Blue recreation. Maps and many
battle rules remain simplified, and the music is not the commercial soundtrack.
Artwork provenance and ownership notes are in artwork/ASSET-SOURCES.md.
