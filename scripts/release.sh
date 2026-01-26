#!/usr/bin/env bash
set -euo pipefail

REPO="${MARGINALIA_REPO:-samaydhawan/marginalia}"
TAG="${1:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

require_cmd pnpm
require_cmd gh
require_cmd python3

VERSION="$(
  python3 - <<'PY'
import json
from pathlib import Path

config = Path("src-tauri/tauri.conf.json")
data = json.loads(config.read_text(encoding="utf-8"))
print(data.get("version", "0.0.0"))
PY
)"

if [[ -z "${TAG}" ]]; then
  TAG="v${VERSION}"
fi

pnpm tauri:build:dmg

DMG_PATH="$(ls -t src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null | head -1 || true)"
if [[ -z "${DMG_PATH}" ]]; then
  echo "DMG not found in src-tauri/target/release/bundle/dmg" >&2
  exit 1
fi

gh release create "${TAG}" \
  "${DMG_PATH}" \
  "scripts/install.sh" \
  "scripts/marginalia" \
  --repo "${REPO}" \
  --title "Marginalia ${VERSION}" \
  --generate-notes
