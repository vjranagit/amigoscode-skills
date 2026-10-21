#!/usr/bin/env bash
# Validates content.json, renders cover + 6-8 content slides + outro, checks fit.
set -euo pipefail
[[ $# -eq 2 ]] || { echo 'usage: scripts/make.sh <content.json> <out-dir>' >&2; exit 2; }
content=$(realpath "$1"); out=$(realpath -m "$2"); here=$(dirname "$(realpath "$0")")
root=$(realpath "$here/../../..")
node_modules="$root/skills/carousel/scripts/node_modules"
template="$root/skills/carousel/templates/carousel.html.mjs"
[[ -d "$node_modules/playwright" && -f "$template" ]] || { echo 'carousel install missing: run scripts/setup.sh' >&2; exit 3; }
mkdir -p "$out"
env -u DISPLAY -u WAYLAND_DISPLAY node "$here/render.mjs" "$content" "$out" "$node_modules/package.json" "$template"
