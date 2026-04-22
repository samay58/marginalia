#!/usr/bin/env bash
set -euo pipefail

# build-icons.sh — regenerate Marginalia's macOS icon assets from
# docs/design/references/marginalia-icon-source.png.
#
# Output:
#   src-tauri/icons/32x32.png
#   src-tauri/icons/128x128.png
#   src-tauri/icons/128x128@2x.png       (= 256×256)
#   src-tauri/icons/icon.icns            (compiled via iconutil)
#
# Requires: ImageMagick (magick), iconutil, sips — all stock on macOS dev boxes.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/design/references/marginalia-icon-source.png"
OUT_DIR="$ROOT/src-tauri/icons"
ICONSET="$OUT_DIR/icon.iconset"

if [ ! -f "$SRC" ]; then
  echo "error: source image not found at $SRC" >&2
  exit 1
fi

for cmd in magick iconutil sips; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required tool '$cmd' is not on PATH" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR" "$ICONSET"

TRIMMED="$OUT_DIR/.source-trimmed.png"
magick "$SRC" -trim +repage -resize 1024x1024 -background none -gravity center -extent 1024x1024 "$TRIMMED"

magick "$TRIMMED" -resize 16x16      "$ICONSET/icon_16x16.png"
magick "$TRIMMED" -resize 32x32      "$ICONSET/icon_16x16@2x.png"
magick "$TRIMMED" -resize 32x32      "$ICONSET/icon_32x32.png"
magick "$TRIMMED" -resize 64x64      "$ICONSET/icon_32x32@2x.png"
magick "$TRIMMED" -resize 128x128    "$ICONSET/icon_128x128.png"
magick "$TRIMMED" -resize 256x256    "$ICONSET/icon_128x128@2x.png"
magick "$TRIMMED" -resize 256x256    "$ICONSET/icon_256x256.png"
magick "$TRIMMED" -resize 512x512    "$ICONSET/icon_256x256@2x.png"
magick "$TRIMMED" -resize 512x512    "$ICONSET/icon_512x512.png"
magick "$TRIMMED" -resize 1024x1024  "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o "$OUT_DIR/icon.icns"

cp "$ICONSET/icon_32x32.png"        "$OUT_DIR/32x32.png"
cp "$ICONSET/icon_128x128.png"      "$OUT_DIR/128x128.png"
cp "$ICONSET/icon_128x128@2x.png"   "$OUT_DIR/128x128@2x.png"

rm -f "$TRIMMED"

echo "ok: icon assets regenerated under $OUT_DIR"
