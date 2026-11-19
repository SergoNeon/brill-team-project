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