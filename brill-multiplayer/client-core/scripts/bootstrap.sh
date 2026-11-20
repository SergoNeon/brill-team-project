#!/bin/sh
set -eu
if [ ! -f 'client-core/bridge/bridge.go' ]; then
 echo 'Run from the BRILL MULTIPLAYER project root' >&2
 exit 1
fi
UPSTREAM_URL='https://github.com/SA-MP-Android/SA-MP-Pilot.git'
UPSTREAM_SHA='aa8c7971d2f3c8762a9f20c9ef35b42d5927a768'
TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT
# git SHA pin avoids silently importing changes to the protocol core.
git clone -q "$UPSTREAM_URL" "$TEMP/pilot"
(cd "$TEMP/pilot" && git checkout -q "$UPSTREAM_SHA")
for module in domain gpci raknet samp; do
 rm -rf "client-core/internal/$module"
 cp -a "$TEMP/pilot/internal/$module" "client-core/internal/$module"
done
cp "$TEMP/pilot/LICENSE" client-core/THIRD_PARTY_APACHE_2_LICENSE.txt
cp "$TEMP/pilot/NOTICE" client-core/UPSTREAM_NOTICE.txt
python3 - <<'PY'
from pathlib import Path
root=Path('client-core/internal')
for p in root.rglob('*.go'):
 src=p.read_text()
 p.write_text(src.replace('github.com/SA-MP-Android/SA-MP-Pilot/internal/','brill.city/multiplayer/clientcore/internal/'))
PY
printf '%s\n' 'Protocol source restored from pinned Apache-2.0 upstream.'