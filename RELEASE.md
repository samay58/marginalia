# Release

## Prereqs

- macOS with Apple signing configured for Tauri builds
- `pnpm` + project deps installed
- `gh` authenticated (`gh auth login`)

## Steps

1. Update `src-tauri/tauri.conf.json` version and `CHANGELOG.md`
2. Run `pnpm install`
3. Run `./scripts/release.sh` (optional tag: `./scripts/release.sh v0.1.1`)
4. Verify assets on the GitHub Release

Release assets:
- DMG from `src-tauri/target/release/bundle/dmg`
- `scripts/install.sh`
- `scripts/marginalia`
