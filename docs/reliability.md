# Reliability

This document defines the behavior Marginalia must not regress.

## Quality bar

Every review session should feel trustworthy:

1. edits remain editable,
2. saved notes stay attached or become clearly stale,
3. recovery restores real working state,
4. bundle output is explicit and versioned,
5. the UI never invents state transitions on the user’s behalf.

## Edit interaction contract

- Diffing runs on rendered plain text.
- Visible changes exclude whitespace-only fragments that are not shown inline.
- Clicking inserted text must behave like normal editing.
- Only deletion affordances are click-intercepted in the manuscript.
- Selecting an edit must not automatically focus or reopen the rationale composer.
- Compose mode is explicit: button press or `⌘/`.

## Annotation contract

Annotations are stable records with target metadata, not ephemeral UI state.

Each saved note must either:

- resolve exactly to the same change,
- reattach conservatively to one clearly best candidate,
- or become `stale`.

Marginalia must never silently move a note when the remap is ambiguous.

### What makes a note durable

- stable annotation ID
- prior change ID
- excerpt
- line hint
- surrounding line context
- block key

### What makes a note stale

- the old change no longer exists,
- the best candidate is below the reattach threshold,
- or multiple candidates are too close to call.

## Marker placement contract

- Persistent manuscript markers are rendered from resolved saved annotations only.
- Marker identity is keyed by annotation ID, not geometry.
- Marker stacking is grouped by resolved block, not rounded pixel buckets.
- Marker refresh must respond to document/layout changes, not every keystroke in the rationale UI.

## Recovery contract

Snapshots live under `~/.marginalia/sessions/`.

Recovery should restore:

- original and edited content
- plain-text projections
- saved annotations
- selected change / selected annotation
- general notes
- in-progress rationale drafts

If highlight or diff subsystems fail, Marginalia should fall back to degraded mode and still capture final text plus notes.

## Bundle contract

Current output:

1. `original.md`
2. `final.md`
3. `changes.json`
4. `annotations.json`
5. `changes.patch`
6. `provenance.json`
7. `summary_for_agent.md`

Version markers:

- `changes.json.bundle_format_version = "3.0"`
- `annotations.json.schema_version = "3.0"`
- `provenance.json.schema_version = "1.0"`

## Hook contract

Default trigger behavior:

1. file ends with `-draft.md`, or
2. file contains `<!-- REVIEW -->`, or
3. `MARGINALIA_REVIEW_REGEX` overrides both.

Operational guarantees:

- one active review at a time
- queued launches instead of window storms
- sync and async modes through the same hook

## Validation runbook

Run all of these before shipping:

1. `pnpm run check:diff`
2. `pnpm run check:annotations`
3. `pnpm run check:semantic`
4. `pnpm run check:bundle`
5. `pnpm run check:hook`
6. `pnpm run check:lint`
7. `pnpm run check`
8. `pnpm run build`

## Known hard problems

- Diff reconciliation is still heuristic in long sessions with many repeated similar edits.
- Richer structural anchoring may eventually need ProseMirror-step lineage, not just text-context scoring.
- Compact-layout compose/recovery flows need periodic real-device QA because they are easier to regress than desktop.
