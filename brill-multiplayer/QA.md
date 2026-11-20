# BRILL MULTIPLAYER v0.1.0 — QA record

## Verified on VPS (2026-11-19)

- `./gradle :app:assembleDebug --offline`: BUILD SUCCESSFUL, Android package `city.brill.multiplayer`, `versionCode 1`, min SDK 26, target SDK 35.
- APK signed with a stable RSA-3072 release key using Android APK Signature Scheme v2 and v3. Signing certificate digest tracked privately. This does not prove malware-free or app-store eligibility.
- Node.js API responds with live SAMP query `BRILL MOBILE RP` and `0/500` at time of test.
- Nginx published `/multiplayer/` and `/multiplayer/BRILL-MULTIPLAYER.apk`; verified from independent Brill-radio device using full HTTP response and ZIP header.
- Browser catalog and API are public; old BRILL MOBILE RP site remains at `/` on the same 28912 TLS port.

## Not verified

- Real Android install and touch test, `samp://` handling on ReSA or another SA-MP client, persistent favorite behavior on a physical handset.
- Custom 3D rendering, game server connection from an independent game client without SA-MP, content downloading, 500-player load.
- Google Play distribution, penetration test, independent security audit.

## Public release gate

Do not claim that BRILL v0.1.0 is a 3D multiplayer game. It is a working native launcher; the full game runtime remains a separate development stream.

## BRILL MULTIPLAYER 3D experimental runtime (2026-11-19)

- Separate Godot 4.7 project in `game3d/`, package `city.brill.multiplayer.game`, APK 26.96 MiB.
- Player sees a generated city and third-person camera; touch controls for movement and jump.
- Standalone ENet dedicated server managed by `brill-multiplayer-3d.service` on UDP `28916`, isolated from original SA-MP UDP `27877`.
- Two independent headless Godot clients joined simultaneously and server logged both peer joins.
- Android APK exported successfully and APK signature v2/v3 verified, Internet permission present.
- Public Android download `https://nexus.brill.city:28912/multiplayer/BRILL-MULTIPLAYER-3D-TEST.apk` checked externally over HTTPS, HTTP 200, zip header valid.
- **Open issues:** game prototype has basic/placeholder geometrical city, no GTA assets or legacy SA-MP protocol, no real economy/factions/cars, no mobile handset test, peer position handling is basic (server relay without production-grade validation/authority). Multiplayer capacity 120 is a configured socket maximum, not a load-tested capacity.

## Licensed native SA-MP transport integration (2026-11-19)

- Identified an Apache-2.0 RakNet/SA-MP protocol implementation with support for 0.3.DL-R1. The closed/research-only Android client repositories were excluded from redistribution because their source licenses were unclear and binary GTA libraries were bundled.
- Adapted the protocol-only Go modules into `client-core/` with upstream notice and license; 4 package test suites pass.
- Verified the native C bridge against the isolated SA-MP QA service: actual RakNet connection, SA-MP join event, initial dialog and 18s stable session. No production account changes.
- Built the ARM64 `libbrillprotocol.so` with Android NDK and the JNI `libbrilljni.so` inside the Android application. Android APK build passed in development mode; not publicly promoted because the game-world renderer is not yet connected.
- Original SA-MP production service remains online. Wrong standalone Godot 3D test service disabled, no longer promoted as a real GTA multiplayer client.

## BRILL Android network client v0.2.0 (2026-11-20)

- Connected actual Apache-2.0 licensed SA-MP 0.3.DL-R1 RakNet core (`libbrillprotocol.so`) to `NativeBridge.java`/`libbrilljni.so`.
- Added `NetworkSessionActivity` with direct protocol connection, nickname selection, live server event display, chat, slash commands, text inputs and masked passwords, SA-MP list/tablist dialogs and cancellation, explicit disconnect and reconnect.
- The main screen's old `samp://` hand-off and requirement for ReSA were removed. It now opens BRILL's own native network session and explains that a visual GTA engine has not yet been integrated.
- Android Java + NDK CMake Gradle build completed successfully. APK includes ARM64 native transport and JNI wrapper and was cryptographically signed by the stable BRILL release key, app versionCode 3; no user GTA assets included.
- Beta download: `https://nexus.brill.city:28912/multiplayer/BRILL-MULTIPLAYER-NETWORK-TEST.apk` confirmed reachable over HTTPS from an independent machine (status 200, correct APK ZIP magic).
- QA-only Go native test passed against actual isolated SA-MP `0.3.DL-R1` service in preceding build. **Physical Android run, user-facing dialogs and gameplay rendering are not verified.** Do not describe this as finished GTA mobile multiplayer.
- Production `/multiplayer/BRILL-MULTIPLAYER.apk` remains the previously released catalog launcher. Production SA-MP and RAGE:MP game services were not altered by this Android-client build.

### Engine integration gate

The third-party Android GTA:SA game engine is a proprietary component (`libGTASA.so`) and is not included in the licensed BRILL source code. Public repositories with complete mobile SA-MP clients were studied but do not include an adequate redistributable code license and/or bundle proprietary GTA libraries. Android sandboxing prevents an arbitrary application from automatically using code or private files stored inside a separate application. Successfully building BRILL's network transport does not solve game rendering, local input/physics, legitimate game assets, client security, streaming or animation.

**Do not clone, redistribute or bundle proprietary GTA SA game libraries from unverified forks.** A compliant client must have a legally permitted game-engine integration and properly authorized game assets, followed by Android device QA and real gameplay tests before claiming the main goal is complete.

## BRILL ↔ Android GTA SA integration bridge (2026-11-20)

- Reviewed a GPLv3 Android game plugin SDK and an MIT-licensed AndroidModLoader; selected only the MIT AML API headers for the initial cross-process *game mod* integration prototype.
- Compiled a BRILL game-process module `gta-bridge/libs/arm64-v8a/libbrillgtabridge.so` with Android NDK 26.2.11394342. ARM64 ELF output is 369,176 bytes. Export verification passed for AML metadata, game filter, mod lifecycle callbacks and BRILL's C transport interface.
- The module checks for the installed GTA native library and, when invoked explicitly from inside that game, can attempt to load BRILL's protocol library from the **same** Android process. No code injection into other apps or Rockstar binary redistribution is bundled.
- **Not tested in GTA:** APK ownership/compatibility, AML loader installation, platform linker namespace support, game rendering/hooking, actual login and visual player syncing.
- The original SA-MP production server remains active. This is the basis for legal game runtime integration, not a completed GTA client or an update to the released APK.