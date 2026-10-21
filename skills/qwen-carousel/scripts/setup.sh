#!/usr/bin/env bash
set -euo pipefail
here=$(dirname "$(realpath "$0")")
root=$(realpath "$here/../../..")
npm --prefix "$root/skills/carousel/scripts" install --no-audit --no-fund
