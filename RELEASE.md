# Release

## Prereqs

- macOS with Apple signing configured for Tauri builds
- `pnpm` + project deps installed
- `gh` authenticated (`gh auth login`)

## Steps

0. Verify the hook loop locally:
   - Run `./scripts/smoke-hook.sh`
   - Make a tiny edit or add General Notes (`Cmd+G`), then press `Esc`
   - Confirm it prints an agent-readable `summary_for_agent.md` path
1. Update `src-tauri/tauri.conf.json` version and `CHANGELOG.md`
2. Run `pnpm install`
3. Run `./scripts/release.sh` (optional tag: `./scripts/release.sh v0.1.1`)
4. Verify assets on the GitHub Release

Release assets:
- DMG from `src-tauri/target/release/bundle/dmg`
- `scripts/install.sh`
- `scripts/marginalia`

## Latest Verification / Release

- 2026-01-26: Ran `./scripts/smoke-hook.sh` twice. Hook executed and returned well-formed PostToolUse JSON. (No bundle was produced because the draft was closed without edits/notes.)
- 2026-01-26: Published GitHub Release `v0.1.2` with `Marginalia_0.1.2_aarch64.dmg` + `install.sh` + `marginalia`.
