# CLAUDE.md

Working notes for coding agents in this repo.

## Product shape

Marginalia is a disposable review surface for agent-written drafts:

1. a hook notices a draft file,
2. the app opens,
3. the user edits inline and optionally saves rationales,
4. the app writes a bundle,
5. the agent reads `summary_for_agent.md`.

The desktop review model is:

- left: stable change rail
- center: manuscript editor
- right: explicit rationale surface

Selecting an edit is browse mode. Composing a rationale is explicit.

## Commands

```bash
pnpm install
pnpm dev
pnpm tauri dev
pnpm tauri:build:app
pnpm tauri:build:dmg
pnpm run check:diff
pnpm run check:annotations
pnpm run check:semantic
pnpm run check:bundle
pnpm run check:hook
pnpm run check:lint
pnpm run check
pnpm run build
```

`pnpm check` is Svelte type checking. Behavior-specific regressions live in the `check:*` scripts.

## Architecture

### Primary files

- `src/routes/review/+page.svelte`
  Coordinates file loading, recovery, keyboard shortcuts, selection/composer state, and bundle finalization.
- `src/lib/stores/app.js`
  Holds document state, plain-text projections, diff state, and annotation records.
- `src/lib/utils/diff.js`
  Computes stable text changes from rendered plain text.
- `src/lib/utils/annotations.js`
  Defines durable annotation records, target metadata, reattachment scoring, and stale-note resolution.
- `src/lib/utils/bundle.js`
  Generates the review bundle. Current bundle format is `3.0`.
- `src/lib/components/Editor.svelte`
  Hosts Milkdown and renders persistent note markers from resolved annotations.
- `src/lib/components/ChangeRail.svelte`
  Displays visible changes only.
- `src/lib/components/AnnotationColumn.svelte`
  Renders the explicit rationale workflow for desktop.
- `src/lib/components/AnnotationPopover.svelte`
  Compact-layout rationale UI.
- `src-tauri/src/lib.rs`
  File I/O, bundle persistence, CLI args, and window lifecycle hooks.

### Current data model

- `annotations` is an array of stable annotation records, not a map keyed by change ID.
- Each annotation stores target metadata: prior change ID, excerpt, line context, and block key.
- Resolution is conservative:
  - exact change match first
  - heuristic reattachment second
  - otherwise mark the note `stale`
- Stale notes must never silently drift to a new edit.

### Important behavior contracts

- Diffs are computed from rendered plain text, not raw markdown.
- Whitespace-only changes are filtered from the visible review surface.
- Clicking inserted text in the manuscript must behave like normal editing. Only deletion widgets remain click-intercepted.
- Selecting an edit must not focus or reopen the rationale composer by itself.
- Saved manuscript markers are keyed by stable annotation IDs and grouped by block, not mutable geometry buckets.
- Recovery snapshots should preserve in-progress rationale drafts.

## Bundle contract

Current bundle contents:

- `original.md`
- `final.md`
- `changes.json`
- `annotations.json`
- `changes.patch`
- `provenance.json`
- `summary_for_agent.md`

`summary_for_agent.md` is the primary agent input. `annotations.json` is an array of annotation records with `status`, `matched_rule`, and target metadata.

## Environment notes

- Vite dev runs on port `1420` because Tauri points at it directly.
- `src-tauri/tauri.conf.json` uses `"closable": true`; close interception happens in `+page.svelte` via `onCloseRequested`.
- Version bumps must stay aligned across:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`

## Docs

Canonical docs live in:

- [docs/README.md](/Users/samaydhawan/Projects/active/marginalia/docs/README.md)
- [docs/architecture.md](/Users/samaydhawan/Projects/active/marginalia/docs/architecture.md)
- [docs/reliability.md](/Users/samaydhawan/Projects/active/marginalia/docs/reliability.md)
- [docs/maintainers/release.md](/Users/samaydhawan/Projects/active/marginalia/docs/maintainers/release.md)
