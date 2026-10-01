# Kanto VM Memory

This project-local engine plugin targets GB Studio 4.3.2 / engine 4.3.0-e1.
It retains the upstream VM header, changing only the shared-variable capacity
from 768 to 1664 and the concurrent context count from 16 to 6.
Each context retains its 64-word stack. The resulting script-memory allocation
is 4096 bytes. Kanto uses synchronous shared-script calls and no actor update
scripts; six contexts leave room for scene, interaction, and input scripts.

Do not add background script threads or upgrade the engine without checking
the context budget, call-stack depth, linked RAM layout, and save format.
The source header is from the GB Studio engine under the repository's MIT license.
