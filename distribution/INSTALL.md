# Play Pokemon Kanto

Download the latest release ZIP from https://github.com/ammar-adam/pokemon-kanto/releases
and extract it. You do not need a compiler, Python, Node, or GB Studio to play the ROM.

## Windows Quick Start

Double-click `Install-on-Chromatic.cmd`. It verifies the included ROM against
`release.json`, then opens the guide. This is a preparation assistant, NOT an
automatic cartridge writer. If local PowerShell policy blocks it, open INSTALL.html
directly and follow the same steps; do not disable your security settings.

## Chromatic

1. Use a supported writable homebrew cartridge. A standard retail game cartridge
   is not automatically writable. The Chromatic is not a USB mass-storage drive;
   dragging a ROM onto it is not installation.
2. Follow the official [DevDay quickstart](https://support.modretro.com/en_us/chromatic-devday-edition-quickstart-guid-By1iOlcMg).
   If Developer Mode activation is required, use the official
   [ModRetro Updater](https://support.modretro.com/en_us/articles/chromatic-firmware-updater-ryhoYnzCx).
   Enter activation codes ONLY in that updater, never in chat or a script.
3. In Codex with the ModRetro Chromatic plugin connected, attach or select this
   release and ask: "Inspect Pokemon-Kanto.gbc and discover my Chromatic.
   Show the exact device and ROM before installing."
4. Confirm the intended device, ROM size and SHA-256. Before approving a write,
   acknowledge that it erases the selected cartridge's game data, saves may be
   lost, and no backup is made. Do not approve until you are ready for that loss.
5. Let the original write finish. If it times out or its outcome is unknown,
   check that operation's status; do not automatically retry. Power-cycle only
   after a confirmed completed write, then boot the cartridge.

Windows hardware tooling is experimental and may require the VC++ runtime and
the vendor's administrator-approved unsigned Gowin driver installer. Install
drivers only through the plugin's setup flow when indicated, not from this ZIP.
No hardware write is performed by the included assistant.

## Emulator Or Editing

Open `Pokemon-Kanto.gbc` in a Game Boy Color-compatible emulator. Choose its
GBC mode and allow battery-backed saves. D-pad moves/selects, A confirms, B
cancels, Start opens the field menu. Preserve your emulator's save file when updating.
Start a new game for v0.4.0-alpha.5. Its progression and memory layout are incompatible
with older saves; back up your old save instead of overwriting it.

## Starting And Saving

1. Choose **New Game**, select File 1, 2, or 3, then choose your text speed.
   Meet Professor Oak at his lab south of your home in Pallet Town.
2. Press **Start > Save**, choose a file, and confirm. An occupied file asks
   before replacing its progress. Wait for the saved message before powering off.
3. Next time, choose **Continue**, select the same file, review your badge and
   Pokedex counts, and confirm. **Start > Options** changes text speed.

Starting a new game does not erase any file; saving over one does. The three
files live in the cartridge's battery-backed memory or your emulator's save
file. Use your emulator's own backup/export function to preserve that file.
Only saves from the exact same ROM build should be restored. Retail Pokemon
Blue saves and older homebrew builds are incompatible. This release has not
had a real save/power-cycle/load test yet; keep backups of important progress.

To edit, clone the repository and open `project.gbsproj` in GB Studio 4.3.2.
Use Play or Export ROM. See [official build documentation](https://www.gbstudio.dev/docs/build/).
To run source checks, install Node 22+ and run `npm ci` then `npm test`.

This is an unofficial, custom fan game, not a commercial Pokemon ROM or an
exact reproduction of Red/Blue. Names and character designs remain their owners'.
Read release.json for the exact verification limits of this build.
