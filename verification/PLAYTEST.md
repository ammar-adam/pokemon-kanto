# Release Playtest Gate

The current build is **not cleared for another release or cartridge write**.
Compilation and source tests do not establish playability. `npm run package`
now refuses to produce a new package without completed, retained playtests of
the exact ROM. Existing published alphas are not retroactively verified.

## Required Checks

Use the approved public emulator or official browser preview. Device checks
are separate and must not overwrite a cartridge to work around a preview
failure. Preserve existing saves before testing. A fresh test save is not
permission to delete another save.

| Check ID | Required observation |
| --- | --- |
| opening | New Game, every text-speed option, starter choice, rival, parcel delivery, and first clear Journey objective work with normal controls. |
| battle-flow | Wild and multi-Pokemon trainer battles: faster/slower/tied priority, miss, zero PP, cancel, item, switch, capture, escape, faint, recovery, and victory. No double turn, hang, incorrect target, unreadable menu, or unexplained HP change. |
| campaign | Reach all eight gyms and finish the League from a normal new save. Check routes, quest gates, healing, shops, losses, and Journey directions. |
| postgame | Hall of Fame return and postgame encounter/collection routes work. |
| save-slot-1 | Save distinct progress in file 1, close/reopen the runtime, Continue, and confirm location, party, HP/PP, money, items, badges, and quest flags. |
| save-slot-2 | Repeat for file 2; file 1 remains unchanged. |
| save-slot-3 | Repeat for file 3; files 1 and 2 remain unchanged. |
| save-cancel | Cancel file selection and overwrite prompts; all previous saves remain unchanged. Confirmed overwrite affects only the selected file. |
| new-game-keeps-saves | Start a new adventure, return to title, and cold-load all three existing files without an unintended write. |
| audio | Listen to music and effects through opening, exploration, battle, victory, and resume; verify audible output and transitions. Linked music symbols or silent framebuffer captures do not prove sound. |
| visible-demo | Open the actual playable build in Codex's built-in browser for the user. Verify controls, framing, readable dialogue, and no blank/frozen frame. Do not substitute an image mockup. |

## Recording Acceptance

Only after observing the outcomes, create the local ignored
`verification/runtime-acceptance.json` with:

- `schemaVersion: 1`, `romSha256`, `romSizeBytes`, and `projectRevision` copied
  from the exact verified build, not a previous release.
- `tester`, ISO `testedAt`, and `environment: { kind, version }`. Kind is
  `emulator`, `browser`, or `chromatic`; record additional environments in the
  per-check observations when needed.
- `openIssues: []` only when no reported gameplay issue remains unresolved.
- `checks`: one entry per ID above with `id`, `status: "passed"`, a concrete
  `observed` description, and `evidence: [{ path, sha256 }]` for retained files
  inside this project. Preserve original recordings and exact-ROM metadata;
  use genuine audio evidence or a named listener's contemporaneous report for
  sound. Source-test logs are not playtest evidence.

The gate verifies receipt consistency and retained-file hashes. It does not
independently interpret recordings, authenticate human observations, guarantee
perfection, or prove compatibility with untested hardware. A code/build change
invalidates old ROM acceptance. Never create a passing receipt from fixtures
or mark an unavailable check passed. Keep saves and personal recordings out
of public Git commits; the package includes acceptance metadata, not private
evidence files.
