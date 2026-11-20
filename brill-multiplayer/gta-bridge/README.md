# BRILL MULTIPLAYER — Android GTA San Andreas bridge

**Status:** cross-compiled ARM64 mod; untested inside a legally installed GTA San Andreas Android application. The bridge is not a playable GTA multiplayer client by itself.

## What it does

- Builds an AndroidModLoader (AML) native `.so` with metadata `net.brill.multiplayer` and game filter `com.rockstargames.gtasa`.
- Checks whether AML and `libGTASA.so` are available in the process.
- Defines a game-process connection interface `BrillGtaConnect(IP:port, nickname)`, `BrillGtaDisconnect`, `BrillGtaStatus`, `BrillGtaReady`.
- Dynamically resolves `BrillStart`, `BrillStop`, `BrillState`, `BrillRelease` from the already built Apache-2.0 licensed `libbrillprotocol.so` **in the same process**, rather than from the independent catalog app's private sandbox.
- Does not bundle Rockstar binary code or game assets and does not modify SA-MP production server.

## What it does NOT do

- It does not load GTA from a separate launcher app. Android application sandboxes cannot simply access another application's game engine or private files.
- It does not implement render hooks, HUD, player/vehicle state sync, player login UI, game startup, resource downloads, anti-cheat, or version-specific offsets.
- It does not automatically enter a GTA world. `BrillGtaConnect` needs to be called by a future game-side UI integration, after an explicit user action.
- It is not verified to run with any specific purchased game APK or AML loader installation. Physical device validation and compatible game build (GTA:SA Android 2.10 arm64 targeted for initial test) are necessary.

## Legal basis

- AML interface headers (vendored from `AndroidModLoader/AndroidModLoader`, MIT license, copyright RusJJ), see `vendor/aml/LICENSE_MIT.txt`.
- BRILL's SA-MP/RakNet transport is based on `SA-MP-Android/SA-MP-Pilot` (Apache-2.0) and is separately built in `../client-core/`.
- No proprietary GTA code/assets are included in this source distribution. Users must supply or own a legally installed compatible GTA San Andreas Android version. The distribution terms and permitted modification mechanisms must be checked for the actual game release.

## Build

```bash
ANDROID_NDK=/path/to/android-ndk-r26d
cd gta-bridge
"$ANDROID_NDK/ndk-build" NDK_PROJECT_PATH=. APP_BUILD_SCRIPT=Android.mk NDK_APPLICATION_MK=Application.mk -j2
```

Expected output: `libs/arm64-v8a/libbrillgtabridge.so` (AArch64 ELF shared library). The project builds with NDK 26.2.11394342. Source includes the MIT AML headers so compilation does not require an unlicensed GTA engine SDK or hidden Rockstar files.

## Key rollout gate

Test on an actual Android phone with an authorized GTA SA installation and a compatible AML loading environment. Confirm game launch **without BRILL** first, then instrument AML loading and check for BRILL module readiness. Next, test protocol loading in the *same process* and establish QA-only SA-MP handshake. Only after that implement native game event hooks for local ped position, input, remote players, vehicles, and visible Russian HUD. Keep production BRILL MOBILE RP isolated until those tests succeed.

For a clean clone from GitHub, generate the pinned MIT AML headers before building:

```sh
sh gta-bridge/scripts/bootstrap-headers.sh
```

`gta-bridge/vendor/aml` contains header snapshots in the build VPS; the GitHub branch uses the bootstrap script to avoid duplicating the entire upstream API. The MIT license is retained.