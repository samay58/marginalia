# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product shape

Marginalia is a disposable macOS review surface for agent-written drafts:

1. a hook notices a draft file,
2. the app opens,
3. the user edits inline and optionally saves rationales,
4. the app writes a 7-file bundle,
5. the agent reads `summary_for_agent.md`.

The desktop review model is a three-pane layout: change rail (left), manuscript editor (center), rationale surface (right). Compact layouts swap the rationale column for a popover.

Selecting an edit is browse mode. Composing a rationale is explicit (button or `Cmd+/`).

## Commands

```bash
pnpm install
pnpm dev              # marketing site only (localhost:1420)
pnpm tauri dev        # desktop review app at /review (requires Rust toolchain)
pnpm tauri:build:app  # build .app bundle
pnpm tauri:build:dmg  # build DMG release artifact
```

Validation (run all before shipping):

```bash
pnpm run check:diff         # diff ID retention
pnpm run check:annotations  # annotation model invariants
pnpm run check:semantic     # semantic diff correctness
pnpm run check:bundle       # bundle artifact completeness
pnpm run check:hook         # hook async queue behavior
pnpm run check:lint         # lint model checks
pnpm run check              # Svelte type checking (svelte-check)
pnpm run build              # production frontend build
```

Each `check:*` script is a standalone regression test in `scripts/`. `pnpm run check` is Svelte type checking, not a test runner.

## Tech stack

- **Frontend**: SvelteKit 5 (Svelte 5 runes), adapter-static in SPA mode (no SSR)
- **Desktop shell**: Tauri 2 (Rust). The Rust layer is intentionally thin: file I/O, bundle persistence, CLI arg parsing, window lifecycle. All review logic lives in the frontend.
- **Editor**: Milkdown (ProseMirror-based markdown editor)
- **Diffing**: `diff-match-patch` on rendered plain text, not raw markdown
- **Layout tuning**: `dialkit` provides live-tunable CSS custom properties via `DialStore`
- **Animations**: `motion` (Framer Motion for JS)

## Architecture

### Route structure

Two route groups under `src/routes/`:

- `(marketing)/+page.svelte` serves the landing page at `/`
- `review/+page.svelte` serves the desktop review app at `/review`

The root layout (`+layout.svelte`) sets `data-marginalia-mode` to `review` or `site` based on the current path. Tauri's window config points directly at `/review`.

### Core data flow

1. Rust reads the markdown file and exposes it via Tauri commands.
2. The frontend stores original and edited markdown plus their plain-text projections (`src/lib/stores/app.js`).
3. Typing updates `editedPlainText` immediately. Expensive derived stores (diff, annotation resolution) read from `debouncedEditedPlainText`, which lags by ~120ms to batch keystrokes.
4. Diffing runs on the plain-text projections (what the user actually sees), not raw markdown.
5. Annotations resolve against the latest diff using a conservative policy: exact match, heuristic reattachment, or stale.
6. On finalize, the frontend generates the bundle and Rust persists it to disk.

### Primary files

- `src/routes/review/+page.svelte` — app orchestration, recovery, keyboard shortcuts, selection/composer state, bundle finalization
- `src/lib/stores/app.js` — document state, plain-text projections, debounced diff chain, trivial/substantive change split
- `src/lib/utils/diff.js` — stable text diff with ID retention across edits
- `src/lib/utils/annotations.js` — annotation records, target metadata, reattachment scoring, stale resolution
- `src/lib/utils/bundle.js` — bundle generation (format `3.0`)
- `src/lib/components/Editor.svelte` — Milkdown host, persistent note markers from resolved annotations
- `src/lib/components/ChangeRail.svelte` — left-side change index: substantive changes shown with type icons, trivial edits collapsed at bottom
- `src/lib/components/AnnotationColumn.svelte` — desktop rationale workflow (headerless, minimal chrome)
- `src/lib/components/AnnotationPopover.svelte` — compact-layout rationale UI
- `src-tauri/src/lib.rs` — native file/bundle I/O, CLI parsing, window commands

### Annotation model

- `annotations` is an array of stable records, not a map keyed by change ID.
- Each record stores target metadata: prior change ID, excerpt, line context, block key.
- Resolution is conservative: exact match first, heuristic reattachment second, otherwise `stale`.
- Stale notes must never silently drift to a new edit.

### Session lifecycle

- Sessions begin when a file is loaded. Autosave snapshots go to `~/.marginalia/sessions/`.
- Recovery restores: content, plain-text projections, saved annotations, selection state, general notes, in-progress rationale drafts.
- Finalizing writes a bundle and clears the active session marker.

## Change classification

Changes are split into two tiers:

- **Substantive**: more than one word, not punctuation-only. Shown prominently in the change rail with type icons (`+` insert, `-` delete, `~` replace) and the actual text.
- **Trivial**: one word or fewer, or punctuation-only. Collapsed into an expandable "N minor edits" summary at the bottom of the rail.

Both tiers are still visible in the editor inline and included in the bundle output. The classification only affects the rail.

## Removed features

Slop/lint matching (tone violations, WRITING.md ban patterns, the `linesWithSlop` store, `slopMatchers`, `SessionDrawer` lint column, `milkdown-slop-plugin`) was removed. The `writingRuleMatcher` for auto-tagging annotations with matched rules is kept.

## Important behavior contracts

- Diffs are computed from rendered plain text, not raw markdown.
- Whitespace-only changes are filtered from the visible review surface.
- Clicking inserted text in the manuscript must behave like normal editing. Only deletion widgets remain click-intercepted.
- Selecting an edit must not focus or reopen the rationale composer.
- Saved manuscript markers are keyed by stable annotation IDs and grouped by block, not mutable geometry buckets.

## Bundle contract

Bundles are written to `~/.marginalia/bundles/[timestamp]_[filename]/`.

Contents:

- `original.md`, `final.md`
- `changes.json` (format `3.0`), `annotations.json` (schema `3.0`)
- `changes.patch`
- `provenance.json` (schema `1.0`)
- `summary_for_agent.md` (primary agent input)

## Hook system

`hooks/post-write.sh` is a Claude Code post-write hook with single-instance queueing.

Trigger rules (default):
- file ends with `-draft.md`
- file contains `<!-- REVIEW -->`
- `MARGINALIA_REVIEW_REGEX` env var overrides both

Key env vars: `MARGINALIA_REVIEW_MODE` (sync/async), `MARGINALIA_QUEUE_DIR`, `MARGINALIA_BIN_OVERRIDE`.

The hook enqueues requests and processes them one at a time. It writes a status JSON, then emits a hook response directing the agent to read `summary_for_agent.md`.

## Environment notes

- Vite dev server is hardcoded to port `1420` (Tauri expects it).
- `src-tauri/tauri.conf.json` uses `"closable": true`; close interception happens in `+page.svelte` via `onCloseRequested`.
- Version bumps must stay aligned across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.

## Docs

- `docs/README.md` — user-facing overview
- `docs/architecture.md` — canonical implementation doc
- `docs/reliability.md` — behavior contracts and validation runbook
- `docs/maintainers/release.md` — release checklist
- `docs/design/` — design exploration references
