# Marginalia Upgrade Spec: Reliability, UX, and Workflow Evolution

Status: Draft  
Last Updated: 2026-02-10  
Author: Codex (for Marginalia core team)

## 1. Objective

Convert Marginalia from a promising prototype into a dependable production tool for co-authoring loops with agents.

Primary outcomes:

1. Humans trust that their edits and rationales are captured correctly.
2. Agents receive complete, unambiguous change intent (textual + structural + semantic).
3. The review loop remains fast, calm, and failure-tolerant under real usage.

## 2. Product Principles

1. Reliability first: never lose user work; preserve annotation intent under ongoing edits.
2. Calm UX: avoid jumpy highlights, cursor traps, and misleading precision.
3. Native expectations: standard macOS close behavior and recovery affordances.
4. Forensic traceability: every output bundle can explain what happened and why.
5. Progressive sophistication: keep default flow simple; expose advanced controls when needed.

## 3. Scope

In scope:

1. Change identity and anchoring model overhaul.
2. Diff rendering model changes (remove inline uneditable deletion widgets).
3. Structural and semantic change capture.
4. Close lifecycle, autosave/recovery, and degraded mode behavior.
5. Performance model shift to incremental tracking + final bundle synthesis.
6. Workflow upgrades (smart triggering, async mode, queueing).
7. Lint configurability and explainability.
8. Bundle schema evolution (patch + provenance).
9. Interaction design hardening (motion/focus/elevation tokens, dark-mode first paint, density toggle).

Out of scope:

1. Turning Marginalia into a full document manager.
2. Multi-user collaboration.
3. Cloud sync or remote persistence.

## 4. Current-State Diagnosis (Mapped to Existing Code)

Current implementation facts:

1. Change IDs are hash-derived from `type|offset|text[0..50]` in `src/lib/utils/diff.js`.
2. Deletions are rendered as `contenteditable=false` widgets in `src/lib/utils/milkdown-diff-plugin.js`.
3. Annotation lookup relies on volatile change IDs in `src/lib/stores/app.js` and `src/routes/+page.svelte`.
4. Main interaction model is line-gutter-driven (`src/lib/components/Gutter.svelte`) using newline-based positions.
5. Close behavior is non-standard due to `closable: false` in `src-tauri/tauri.conf.json`, with custom close handling in `src/routes/+page.svelte`.
6. No crash recovery snapshot mechanism exists.
7. Diff recomputation is tied to active editing and decoration refresh.
8. Bundle lacks machine patch and provenance details (`src/lib/utils/bundle.js`).
9. Hook mode is blocking-only (`hooks/post-write.sh`) with filename/content-marker triggering.

Resulting risks:

1. Annotation detachment when offsets shift.
2. Cursor/selection glitches from inline uneditable deletion widgets.
3. Missed meaning for mark/attribute/node-only changes.
4. User trust erosion from non-native close behavior and no recovery.
5. UI jitter and stale anchor interactions under heavy typing.
6. Weak forensic debugging when agent application diverges from intent.

## 5. Target Architecture

### 5.1 Change Identity and Anchor Engine

Introduce a transaction-backed `ChangeAnchorEngine` as the canonical source of change identity.

Core behavior:

1. Generate stable `change_id` once at change creation (`uuidv7`).
2. Store anchor positions in ProseMirror coordinate space, not plain-text offsets.
3. Re-map anchors on every transaction using `tr.mapping`.
4. Track anchor validity states: `active`, `collapsed`, `orphaned`.
5. Preserve annotation linkage even when visible text shifts.

Data model (`ChangeRecord`):

1. `change_id: string`
2. `session_id: string`
3. `change_kind: insertion | deletion | replacement | structural | semantic`
4. `anchor_from: number`
5. `anchor_to: number`
6. `assoc: -1 | 1` (bias for mapping behavior)
7. `created_txn_seq: number`
8. `last_mapped_txn_seq: number`
9. `text_snapshot_before: string | null`
10. `text_snapshot_after: string | null`
11. `block_context: { heading_path: string[], node_type: string, excerpt: string }`
12. `status: active | collapsed | orphaned`
13. `metadata: Record<string, unknown>`

Notes:

1. `prosemirror-changeset` can be used for incremental insert/delete span aggregation.
2. Structural/semantic tracking must remain separate because mark/attribute deltas are not covered by text span engines.

### 5.2 Structural and Semantic Change Channel

Add `SemanticChangeTracker` pipeline to capture non-textual meaning changes.

Captured events:

1. Node type changes (paragraph to heading, heading level changes, list type changes).
2. List structure changes (indent/outdent, nesting shifts).
3. Mark toggles (bold/italic/code/strike changes without text edits).
4. Link destination changes where display text remains unchanged.
5. Code fence metadata updates (language, info string).
6. Table structure edits (row/column add/remove, header changes).

Event model (`SemanticChangeEvent`):

1. `event_id`
2. `change_id` (linked to primary change or standalone)
3. `event_type`
4. `before`
5. `after`
6. `anchor_from`, `anchor_to`
7. `created_at`

### 5.3 Rendering Model: Stable Change Rail, Not Line Illusion

Replace line-number-first workflow with a `ChangeRail` grouped by block context.

UI behavior:

1. Show entries by section and excerpt, not pseudo-fixed line numbers.
2. Clicking a change rail item scrolls editor to anchor and highlights target.
3. Inline insertion highlights remain in document.
4. Deletions render in side rail cards (or tracked-changes layer), not `contenteditable=false` inline widgets.
5. While typing, highlights are frozen; updates apply after idle pause.

### 5.4 Interaction Stability State Machine

Implement explicit highlight update states:

1. `typing` while keystrokes continue.
2. `stabilizing` for `N` ms idle window (default `250ms`).
3. `stable` when anchors and rail are safely refreshed.

Rules:

1. No target movement during active popover editing.
2. Saved annotation should trigger subtle confirmation only (no reflow or jump).

### 5.5 Lifecycle, Close Behavior, and Recovery

Adopt native close semantics while guaranteeing output safety.

Required changes:

1. Set window `closable: true` in `src-tauri/tauri.conf.json`.
2. Intercept close request in frontend and run `safeFinalizeSession()`.
3. Persist autosave snapshots during session.
4. On launch, detect recoverable session and offer `Resume` or `Discard`.

Autosave snapshot content:

1. Original markdown.
2. Current markdown.
3. Change ledger and semantic events.
4. Annotations and general notes.
5. Session metadata and last successful write timestamp.

Storage path:

1. `~/.marginalia/sessions/<session-id>/snapshot.json`

Recovery guarantees:

1. Crash or force-close does not lose active review content.
2. Bundle can still be generated from recovered session state.

### 5.6 Error Boundary and Degraded Mode

Add a failure-tolerant fallback path.

Requirements:

1. If diff/highlight subsystem fails, editing remains available.
2. Annotation and notes capture still works.
3. `Done` still writes a useful bundle with explicit degraded-mode notice.
4. Status output includes machine-readable failure reason.

### 5.7 Performance Model

Move from full-document diff work during typing to incremental transaction tracking.

Runtime behavior:

1. Incremental ledger updates on transaction stream.
2. Debounced visual recompute after idle pause.
3. Full canonical diff/patch generation only on `Done`.

Performance budgets:

1. Median keypress-to-paint under `16ms`.
2. P95 interactive update under `50ms` for docs up to `10k` words.
3. No visible cursor lag under continuous typing.

### 5.8 Workflow Intelligence and Orchestration

#### 5.8.1 Triggering

Replace filename-only inference with configurable intent + stability checks.

Trigger conditions:

1. File write stability window met (no writes for `N` ms).
2. Intent signal present (marker, ruleset, project config, or explicit invocation).

#### 5.8.2 Async Review Mode

Support two hook modes:

1. `sync` (current behavior): agent blocks until review completion.
2. `async`: hook launches background review and injects context next turn.

#### 5.8.3 Single Instance + Queue

Prevent review window storms by queueing requests.

Rules:

1. One active review window at a time.
2. New requests enqueue with timestamp and file metadata.
3. User can skip/defer queued items.
4. Queue state survives app restart.

### 5.9 Lint System Upgrades

Make lint configurable and explainable.

Capabilities:

1. Toggle built-in rule packs on/off.
2. Per-rule mute duration (`session`, `project`, `always`).
3. Show reason details for each lint flag.
4. One-click "ignore for this session."

### 5.10 Bundle Contract v2 (Patch + Provenance)

Evolve bundle schema to support reliable replay and auditing.

New/updated files:

1. `changes.json` (expanded typed changes + anchors + semantic events).
2. `changes.patch` (machine-applicable unified diff between original and final).
3. `annotations.json` (stable `change_id` references, not hash-offset IDs).
4. `provenance.json` with:
5. `marginalia_version`
6. `bundle_schema_version`
7. `session_id`
8. `input_sha256`
9. `output_sha256`
10. `ruleset_version`
11. `generated_at`
12. `degraded_mode` flag + reasons if applicable.

Backward compatibility:

1. Keep existing files for one compatibility cycle.
2. Include `bundle_schema_version` and dual-write v1+v2 during migration phase.

## 6. UX and Visual System Improvements (Tier 2)

### 6.1 Interaction Tokens

Introduce token groups:

1. Motion durations (`fast`, `base`, `slow`) and easing curves.
2. Elevation tiers for surfaces and overlays.
3. Focus ring styles with WCAG-compliant contrast.
4. Hover/pressed/selected state tokens.

### 6.2 Dark Mode First Paint

Prevent theme flash by applying theme class before first app render in `src/app.html`.

Requirements:

1. Respect stored user preference first.
2. Fallback to system preference.
3. No light-to-dark flash on cold start.

### 6.3 Blur Budgeting

Retain aesthetic intent while avoiding scroll jank.

Rules:

1. Keep blur only on highest-value surfaces.
2. Replace low-value blur surfaces with opaque/translucent alternatives when FPS drops.

### 6.4 Density Modes

Add two display densities:

1. `Review` mode: tighter layout, stronger contrast, fast scanning.
2. `Manuscript` mode: current reading-first aesthetic.

## 7. Phased Delivery Plan

### Phase 1 (Tier 1A): Reliability Foundation

Deliverables:

1. ChangeAnchorEngine with stable IDs and transaction mapping.
2. Annotation rebinding to stable IDs.
3. Deletion widget removal from editable flow.
4. ChangeRail v1 replacing line-gutter targeting for annotation entry.

Exit criteria:

1. No annotation loss in simulated edit-shift scenarios.
2. No cursor trap regressions in deletion-heavy edits.

### Phase 2 (Tier 1B): Lifecycle and Resilience

Deliverables:

1. Native close behavior + safe finalize flow.
2. Session autosave and recovery prompt.
3. Error boundary + degraded mode bundle path.
4. Idle-stabilized visual update pipeline.

Exit criteria:

1. Crash recovery success rate above `99%` in test harness.
2. Bundle output always generated in degraded mode scenarios.

### Phase 3 (Tier 1C + Tier 3A): Semantic Intelligence + Workflow

Deliverables:

1. SemanticChangeTracker and structural event output.
2. Smart trigger engine (stability + intent).
3. Async hook mode.
4. Single-instance queue manager.
5. Lint configurability controls.
6. Bundle v2 patch + provenance rollout.

Exit criteria:

1. Link-only and formatting-only edits consistently represented in bundle output.
2. Async mode reliably injects review context on next turn.
3. Queue prevents concurrent-window spawn storms.

### Phase 4 (Tier 2): Experience Polish

Deliverables:

1. Motion/elevation/focus token system rollout.
2. Dark-mode first paint fix.
3. Blur budget tuning.
4. Density toggle.

Exit criteria:

1. No theme flash on cold launch.
2. Smooth scrolling and interaction under both density modes.

## 8. Acceptance Criteria

Functional:

1. Change IDs remain stable across unrelated edits before anchor location.
2. Deletion rendering does not rely on uneditable inline widgets.
3. Bundles include textual and semantic change channels.
4. Close actions from red button/Cmd+W/Cmd+Q complete safe finalize.
5. Resume flow appears after crash with intact session state.
6. Async mode does not block agent and still injects review output later.

Quality:

1. Crash-free session rate above `99.5%`.
2. Annotation retention rate above `99%` under randomized edit churn tests.
3. P95 idle highlight refresh under `150ms` for `10k` word docs.
4. No visually disruptive target movement while typing.

## 9. Test Strategy

Unit tests:

1. Anchor mapping/rebasing correctness across insert/delete/replace sequences.
2. Semantic event detection for mark/node/attribute changes.
3. Bundle v2 schema generation and hash correctness.
4. Lint config precedence and mute behavior.

Integration tests:

1. End-to-end edit + annotation + done flow with realistic document fixtures.
2. Close interception from all close vectors (Cmd+W, red button, Cmd+Q).
3. Recovery from simulated crash with snapshot restore.
4. Queue behavior with multiple incoming review requests.

E2E workflow tests:

1. Sync hook mode roundtrip from write to applied summary.
2. Async mode roundtrip with next-turn context injection.
3. Degraded mode output after forced renderer failure.

Regression fixtures:

1. Long wrapped paragraphs.
2. Heavy deletion blocks.
3. Link URL-only edits.
4. Table and code fence structural edits.

## 10. Rollout and Migration

Feature flags:

1. `anchor_engine_v2`
2. `semantic_tracker_v1`
3. `change_rail_v1`
4. `autosave_recovery_v1`
5. `hook_async_mode_v1`
6. `bundle_schema_v2`

Rollout policy:

1. Land behind flags and test with internal dogfood sessions.
2. Enable per-feature progressively, not as one big-bang release.
3. Dual-write bundle v1+v2 during migration.
4. Remove v1 write path after compatibility window and validation.

## 11. Beads Execution Plan

Current tracking:

1. Epic: `marg-lku` (`Author Marginalia reliability + UX upgrade spec`)
2. Child 1: `marg-lku.1` (architecture mapping) - completed
3. Child 2: `marg-lku.2` (spec authoring) - in progress during drafting
4. Child 3: `marg-lku.3` (finalize + sync) - pending

Recommended follow-on implementation beads:

1. Build ChangeAnchorEngine and annotation rebinding.
2. Replace deletion widgets with rail/tracked-changes rendering.
3. Implement SemanticChangeTracker and schema wiring.
4. Implement native close + safe finalize + autosave/recovery.
5. Add degraded mode and hard failure boundaries.
6. Implement hook async mode and review queue manager.
7. Add lint configuration UX and rule mute controls.
8. Roll out bundle v2 patch + provenance.
9. Apply visual token and density mode polish pass.

## 12. Risks and Mitigations

Risk: Anchor mapping bugs may silently misbind annotations.  
Mitigation: deterministic randomized mapping tests + session-level integrity checks before bundle write.

Risk: Semantic tracker over-reports noisy changes.  
Mitigation: event normalization, dedupe rules, and confidence thresholds.

Risk: Async hook mode creates temporal mismatch in user expectations.  
Mitigation: explicit mode indicator and clear pending-review state messaging.

Risk: Queueing adds operational complexity and hidden backlog.  
Mitigation: visible queue UI with skip/defer controls and max queue caps.

Risk: Bundle v2 migration breaks downstream consumers.  
Mitigation: dual-write period and schema version pinning.

## 13. Open Questions

1. Should recovery snapshots be encrypted at rest by default or opt-in?
2. What is the retention policy for autosave sessions and queued review artifacts?
3. Should semantic event verbosity be user-configurable (minimal vs verbose)?
4. What is the target compatibility window for bundle v1 consumers?
5. Should async mode become default once stabilized, or remain explicit opt-in?

## 14. Definition of Done

This upgrade is complete when:

1. Core reliability goals are met (stable anchors, recovery, degraded output safety).
2. UX goals are met (no cursor traps, calm highlights, native close behavior).
3. Agent handoff quality is materially improved (semantic capture + patch + provenance).
4. Hook integration supports both sync and async workflows without operational chaos.
5. Quality gates and tests are in place to prevent regression.
