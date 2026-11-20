# BRILL MULTIPLAYER

Native Android launcher and independent server-directory API for **BRILL MULTIPLAYER**, a Brill Team Project platform. This is **v0.1.0** of the launcher, not the finished 3D game client.

## Working MVP

- Native Android application (Java, Android SDK 35, min Android 8.0) with Russian UI and original black/red/gold branding.
- Server directory with live online/max slots from the SA-MP UDP query protocol.
- Favorites stored locally, add custom server IP and port, copy address.
- Connection button attempts a system-handled `samp://` link; if not supported by an installed game client, it copies IP and provides instructions. **No bundled SA-MP / GTA engine or proprietary game assets.**
- Self-hosted Node.js directory API at `/api/v1/servers`; server whitelist prevents querying arbitrary addresses. 15-second caching and UDP timeout protect the server from repeated queries.
- Public installation page and signed APK, hosted on HTTPS.

## Links

- Landing page: https://nexus.brill.city:28912/multiplayer/
- APK: https://nexus.brill.city:28912/multiplayer/BRILL-MULTIPLAYER.apk
- Directory: https://nexus.brill.city:28912/multiplayer/api/v1/servers
- Existing game server: 77.42.93.209:27877 (BRILL MOBILE RP; hosted independently)

## Build

```bash
# JDK 17, Gradle 8.10.2, Android SDK platform 35 / build-tools 35
cd android
gradle :app:assembleDebug
```

Install Gradle from trusted official sources or create your own wrapper if using a CI environment. Production signing keystore and password are intentionally **not** in the repository. They must never be committed. Release APK is signed by a stable private key retained on the authorized VPS; losing that key prevents upgrades under the same Android package name.

## API

```bash
cd backend
BRILL_PORT=28915 node server.mjs
curl http://127.0.0.1:28915/api/v1/servers
```

Only the pre-configured official server is checked by the backend. User-added servers are local favorites and show an unverified status. Future versions can provide opt-in registration and verified server ownership.

## Next engineering milestones

1. Android physical-device UI/smoke testing and safe update delivery.
2. Dedicated BRILL game runtime and network client; native SA-MP compatibility is not guaranteed, and the existing GTA SA data cannot be redistributed without appropriate rights.
3. Native launcher ↔ game process handoff, verified resource downloads, update signing and multiplayer authentication.
4. Account/character integration with BRILL RP, server-owner dashboard, moderation and anti-abuse.
5. Visual QA, accessibility, telemetry opt-in and app-store compliance.

**No claims:** this v0.1.0 APK does not render a 3D world or replace ReSA. It is a functional independently built launcher and live directory frontend.

## BRILL 3D experimental game client

A separate **actual 3D networked test game** in `game3d/` has been added. It is built with Godot 4.7 and deliberately uses *no* proprietary GTA assets. Its own ENet test server listens on UDP 28916, separate from the old SA-MP RP server. Game UI has a button "ИГРАТЬ НА BRILL 3D". It is independent from the catalog-only launcher. Install the 3D test APK to run the actual 3D prototype, NOT the original small launcher package.

Test APK: https://nexus.brill.city:28912/multiplayer/BRILL-MULTIPLAYER-3D-TEST.apk

The current code shares player coordinates for a simple colored capsule in a small procedural city. It is not an SA-MP replacement and does not connect to the GTA map or GTA accounts.

## SA-MP protocol client development

The first version of the real Android network transport is in `client-core/`; its implementation connects to SA-MP **0.3.DL-R1** and has passed QA network tests. The corresponding Android NDK/JNI wrapper is in `android/app/src/main/cpp` and `NativeBridge.java`. **It does not yet load and render GTA San Andreas** and must not be marketed as a completed replacement for ReSA. Building a playable client requires appropriate licensed GTA assets from the user's own installation and further integration of the mobile RenderWare-compatible runtime, native game hooks, game-world streaming and synchronization with SA-MP.

## Native server session (development version 0.2.0)

The Android application now contains `NetworkSessionActivity.java`, showing a genuine SA-MP 0.3.DL-R1 session without sending the player to a `samp://` application. It connects using our Android ARM64 native Go/RakNet bridge, displays protocol events and server dialogs, and can send chat and commands. This is a **network diagnostic**, **not a GTA San Andreas game-rendering client**.

The separately signed beta, versionCode 3 (Android 8+ ARM64) is hosted at `https://nexus.brill.city:28912/multiplayer/BRILL-MULTIPLAYER-NETWORK-TEST.apk`. It can upgrade the originally signed package `city.brill.multiplayer`, though the full play button deliberately opens the connection test and warns the user that no GTA graphics are available. The official default launcher APK remains unchanged.

The next major engineering dependency is lawful access to a game engine able to load GTA San Andreas with user-authorized game assets, a valid client-side integration interface, and an actual device test of rendering and gameplay. No third-party GTA libraries are committed to the BRILL source tree.