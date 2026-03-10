# Release

This is the maintainer release runbook.

## Prerequisites

- macOS build machine
- `pnpm` installed
- project dependencies installed
- `gh auth login` completed
- Apple signing configured if you are producing signed distribution artifacts

## Version bump checklist

Keep these three files aligned:

1. `package.json`
2. `src-tauri/Cargo.toml`
3. `src-tauri/tauri.conf.json`

Update [CHANGELOG.md](/Users/samaydhawan/Projects/active/marginalia/CHANGELOG.md) in the same pass.

## Verification before release

Run:

```bash
pnpm install
pnpm run check:diff
pnpm run check:annotations
pnpm run check:semantic
pnpm run check:bundle
pnpm run check:hook
pnpm run check:lint
pnpm run check
pnpm run build
pnpm tauri:build:app
```

Then run a manual smoke:

```bash
./scripts/marginalia smoke-test
```

Confirm the hook returns either:

- a valid `summary_for_agent.md` path when edits or notes were saved, or
- an explicit no-bundle outcome when the draft was closed untouched.

## Publishing

The release helper builds the DMG and creates the GitHub release:

```bash
./scripts/release.sh
```

Optional explicit tag:

```bash
./scripts/release.sh v0.1.3
```

The script uploads:

- the newest DMG from `src-tauri/target/release/bundle/dmg/`
- `scripts/install.sh`
- `scripts/marginalia`

## Post-release checks

- Verify the GitHub release assets downloaded correctly.
- Install from the released `install.sh` on a clean machine or account.
- Confirm `marginalia init --global` writes a valid Claude Code hook entry.
- Confirm the installed app opens via `open -a Marginalia`.

## Notes

- `pnpm tauri:build:dmg` is the artifact-producing command used by `scripts/release.sh`.
- `summary_for_agent.md` remains the agent-facing contract to smoke-test on every release.
