# Changelog

All notable changes to Marginalia.

## [0.2.0] - 2026-09-25

### Changed

- New quiet monochrome interface: native window controls, one sans (IBM Plex Sans, bundled), hairline structure, one accent for the primary action and insertions, light and dark mode.
- Clicking inserted text now selects that edit and keeps the caret, so rationales can be added to any new edit.
- ⌘/ explains the selected edit, and opens the rationale panel if it is hidden.
- Escape closes the open layer first (help, popover, references, composer, notes) and only finishes the review when nothing is open.
- `summary_for_agent.md` rewritten: each reason appears once, deletions and insertions are labelled correctly, and unexplained edits are listed.
- Review targets and change groups became the identity layer for rationales (bundle format `3.1`, provenance `1.1`).
- Focus mode hides the change list and rationale panel. The status bar shows edit and rationale counts, save state and clickable shortcuts.
- Added a content security policy and a check that every CSS variable read is defined. `pnpm run verify` runs every check.
- Replaced always-live annotation behavior with an explicit compose flow on desktop.
- Reworked saved-note anchoring around durable annotation records and conservative remapping.
- Marked ambiguous note remaps as stale instead of silently moving them.
- Simplified the right-side review surface into a single rationale workflow.
- Preserved in-progress rationale drafts in recovery snapshots.
- Added annotation-specific regression coverage.
- Reorganized docs into a canonical `docs/` tree and archived older handoff/spec material.

### Removed

- Tone and slop lint, DialKit layout tuning, and the density toggle.

### Fixed

- The hook no longer runs `pnpm tauri build` when it cannot find the app.

## [0.1.2] - 2026-01-26

### Changed

- Default bundle output moved to `~/.marginalia/bundles/`.
- Claude Code hook triggers became generic: `*-draft.md` or `<!-- REVIEW -->`.
- Public docs were scrubbed for release.

## [0.1.1] - 2026-01-26

### Added

- `--bundle-dir`, `--out`, and `--principles` CLI flags.
- `marginalia init` and `marginalia smoke-test`.
- WRITING.md rule matching and tone-lint summaries.
- `changes.patch` and hook smoke tooling.

### Fixed

- Inline diff rendering and editor click behavior.
- Bundle generation for notes-only sessions.
- Highlight persistence during editing.
- Hook launch and dev-window startup issues.

## [0.1.0] - 2026-01-19

### Added

- Initial Tauri + Svelte review app.
- Milkdown-based manuscript editor.
- Structured diff generation.
- Change-bound annotations.
- Claude Code hook integration.
