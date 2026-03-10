# Changelog

All notable changes to Marginalia.

## [Unreleased]

### Changed

- Replaced always-live annotation behavior with an explicit compose flow on desktop.
- Reworked saved-note anchoring around durable annotation records and conservative remapping.
- Marked ambiguous note remaps as stale instead of silently moving them.
- Simplified the right-side review surface into a single rationale workflow.
- Preserved in-progress rationale drafts in recovery snapshots.
- Promoted the bundle contract to `3.0` and updated `annotations.json` to use stable records with target metadata.
- Added annotation-specific regression coverage.
- Reorganized docs into a canonical `docs/` tree and archived older handoff/spec material.

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
