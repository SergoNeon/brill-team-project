#!/bin/sh
set -eu
[ -f gta-bridge/src/main.cpp ] || { echo 'Run from BRILL MULTIPLAYER repository root' >&2; exit 1; }
REPO=https://github.com/AndroidModLoader/AndroidModLoader.git
PIN=2def78aec259cf9c8eabe52e78de8e434cf03bdd
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git clone --quiet "$REPO" "$TMP/aml"
git -C "$TMP/aml" checkout --quiet "$PIN"
mkdir -p gta-bridge/vendor/aml/mod/thirdparty
cp "$TMP/aml/LICENSE" gta-bridge/vendor/aml/LICENSE_MIT.txt
cp "$TMP/aml/template_of_mod/mod/"*.h gta-bridge/vendor/aml/mod/
cp "$TMP/aml/template_of_mod/mod/thirdparty/stb_sprintf.h" gta-bridge/vendor/aml/mod/thirdparty/stb_sprintf.h
printf '%s\n' 'Pinned MIT AML interface headers installed.'