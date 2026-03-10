# Architecture

This is the canonical implementation doc for Marginalia.

If you need release steps, read [docs/maintainers/release.md](/Users/samaydhawan/Projects/active/marginalia/docs/maintainers/release.md). If you need reliability guarantees, read [docs/reliability.md](/Users/samaydhawan/Projects/active/marginalia/docs/reliability.md).

## Product model

Marginalia is not a general editor. It is a disposable review surface that sits inside an agent loop:

1. a draft file lands on disk,
2. a hook opens Marginalia,
3. the user edits inline and optionally explains important changes,
4. the app writes a bundle,
5. the agent reads `summary_for_agent.md`.

The job is to preserve intent with minimal friction, then get out of the way.

## Review surface

The current desktop UI has three distinct areas:

- Change rail: visible edits only, ordered by document position.
- Manuscript editor: Milkdown editor with diff decorations and persistent saved-note markers.
- Rationale column: explicit compose/read states for change-bound rationales.

Compact layouts use a popover instead of the full rationale column.

Important interaction rule: selecting an edit is not the same as composing a rationale. Compose mode must be entered deliberately.

## Core data flow

1. Rust reads the markdown file and exposes it to the frontend.
2. The frontend stores:
   - original markdown
   - edited markdown
   - original plain text
   - edited plain text
   - annotation records
3. Diffing runs on the plain-text projections, because that is what the user actually reviewed.
4. Resolved annotations are derived against the latest diff.
5. On finalize, the frontend generates the bundle and Rust persists it.

## Annotation model

Annotations are durable records, not a `changeId -> note` map.

Each record stores:

- stable annotation ID
- rationale text
- optional matched writing rule
- target metadata:
  - last resolved change ID
  - change type
  - excerpt
  - line hint
  - before/current/after line context
  - block key
- created/updated timestamps

Resolution policy:

1. exact change ID match,
2. conservative heuristic reattachment,
3. otherwise mark the note `stale`.

Stale notes are a first-class state. They should never drift silently to a different edit.

## Bundle contract

Current bundle contents:

- `original.md`
- `final.md`
- `changes.json`
- `annotations.json`
- `changes.patch`
- `provenance.json`
- `summary_for_agent.md`

`summary_for_agent.md` is the primary agent-facing artifact.

Current schema notes:

- `changes.json` is bundle format `3.0`
- `annotations.json` schema is `3.0`
- `provenance.json` schema is `1.0`

## Main modules

- `src/routes/review/+page.svelte`
  App orchestration, recovery, selection/composer state, bundle finalization.
- `src/lib/stores/app.js`
  Shared document state and derived annotation/diff state.
- `src/lib/utils/diff.js`
  Stable text diff logic.
- `src/lib/utils/annotations.js`
  Annotation creation, normalization, remapping, and stale resolution.
- `src/lib/utils/bundle.js`
  Bundle generation and summary/provenance output.
- `src/lib/components/Editor.svelte`
  Milkdown host plus manuscript note markers.
- `src/lib/components/ChangeRail.svelte`
  Left-side review index.
- `src/lib/components/AnnotationColumn.svelte`
  Desktop rationale workflow.
- `src/lib/components/AnnotationPopover.svelte`
  Compact rationale workflow.
- `src-tauri/src/lib.rs`
  Native file and bundle I/O, CLI parsing, window commands.
- `hooks/post-write.sh`
  Hook queueing and handoff back to the agent.

## Session lifecycle

- A session begins when a file is loaded.
- Autosave snapshots are written under `~/.marginalia/sessions/`.
- Recovery can resume the last active session, including in-progress rationale drafts.
- Finalizing a review writes a bundle and clears the active session marker.

## Non-goals

- full document management
- collaborative editing
- open-ended comment threads
- silently “helpful” note reassignment

If a behavior makes the review surface feel like a general editor instead of a sharp review tool, it is probably the wrong direction.
