# BRILL MULTIPLAYER native 0.3.DL-R1 protocol core

This module implements the network transport for BRILL's independent Android game client. It is **not a GTA:SA renderer**. The embedded legacy SA-MP server at `77.42.93.209:27877` is untouched; all integration tests are isolated to QA on `127.0.0.1:27878`.

## Tested

- SA-MP 0.3.DL-R1 RakNet handshake, server challenge, client joining and dialogs on the isolated QA server
- Android/ARM64 `libbrillprotocol.so` Go c-shared build via Android NDK 26.2
- Android JNI wrapper `libbrilljni.so` and native Java `NativeBridge` compile inside BRILL's Android application
- 18-second Linux c-shared session test: status remained connected > 12 seconds (fixed timed cancellation bug)
- No native GTA graphics or game assets: **not** yet playable as a SA-MP alternative

## Source licensing

Protocol source adapted from `SA-MP-Android/SA-MP-Pilot`, Apache-2.0, pinned to the upstream SHA recorded in `scripts/bootstrap.sh`. Retain the complete Apache-2.0 license and original NOTICE. No proprietary GTA libraries, copyrighted game resources or unlicensed Android SA-MP forks may be copied into this module.

## Build steps

1. Install Go 1.26.4, Android SDK 35 and NDK 26.2.11394342.
2. Run `bash client-core/scripts/bootstrap.sh` from repo root (clones pinned Apache-2.0 upstream and copies only required network modules; respects license notices).
3. Run `cd client-core && go test ./...`.
4. Run `CGO_ENABLED=1 GOOS=android GOARCH=arm64 CC=$ANDROID_NDK/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android26-clang go build -buildmode=c-shared -trimpath -ldflags='-s -w' -o build/arm64-v8a/libbrillprotocol.so ./bridge`.
5. Copy resulting `libbrillprotocol.so` and `libbrillprotocol.h` to the Android application's `app/src/main/jniLibs/arm64-v8a/` and `app/src/main/cpp/`, respectively.
6. `cd android && gradle :app:assembleDebug` (CMake compiles the JNI wrapper).

## API contract

C exports: `BrillStart`, `BrillStop`, `BrillState`, `BrillNextEvent`, `BrillCommand`, `BrillChat`, `BrillRespondDialog`, `BrillRelease`. Text buffers returned from the C API must be freed using `BrillRelease`. Java wrapper `NativeBridge` provides matching methods. Network operations must execute off the Android main thread. API status and events are preliminary and not stable.