#!/bin/sh
set -eu
so=${1:-gta-bridge/libs/arm64-v8a/libbrillgtabridge.so}
: "${ANDROID_NDK:?Set ANDROID_NDK to a configured Android NDK root}"
readelf="$ANDROID_NDK/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-readelf"
test -f "$so"
"$readelf" -h "$so" | grep -q 'AArch64'
syms=$("$readelf" --dyn-syms "$so")
for symbol in __GetModInfo __INeedASpecificGame OnModLoad OnModUnload BrillGtaReady BrillGtaConnect BrillGtaDisconnect BrillGtaStatus; do
  printf '%s\n' "$syms" | grep -q " $symbol$" || { echo "Missing export: $symbol" >&2; exit 1; }
done
if "$readelf" -d "$so" | grep -q 'libGTASA.so'; then
  echo 'Unexpected proprietary game library link' >&2; exit 1
fi
printf 'BRILL_GTA_BRIDGE_BUILD=PASS\n'