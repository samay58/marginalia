# Marginalia Polish & Reliability Spec

Last updated: February 10, 2026  
Tracking system: `beads` (`marg-*` issues)

## 1. Purpose

Marginalia should feel instrument-grade: reliable enough that humans trust what was captured, and structured enough that agents can apply feedback without inference gaps.

This spec defines:

1. The reliability and UX bar for production use.
2. The technical contracts that preserve edit intent.
3. The rollout sequence, including what is already shipped vs. still pending.

## 2. Product Outcomes

1. Human confidence: users can edit naturally and never fear losing work or context.
2. Agent fidelity: feedback bundles capture textual, structural, and rationale intent with traceable provenance.
3. Operational calm: hook integrations avoid spawn storms and support both blocking and non-blocking workflows.

## 3. Quality Bar (Anti-Slop)

Every change in this roadmap must satisfy all of the following:

1. Deterministic behavior under rapid editing and repeated saves.
2. Recoverability for crash/close edge cases.
3. Explainability via explicit metadata (versions, hashes, status fields).
4. UI stability over novelty (no cursor traps, no jumping targets while typing).
5. Regression coverage for each reliability contract.

## 4. Workstreams and Status

### WS-A: Editing Fidelity & Session Safety (Tier 1)

Status: **shipped** (tracked across `marg-z5h`, `marg-lxi`, `marg-ee2`, `marg-s3h`)

#### A1. Stable change interaction model
- Replaced line-gutter centric flow with a stable change rail (`src/lib/components/ChangeRail.svelte`).
- Removed inline deletion widgets from editable flow to avoid cursor/selection corruption (`src/lib/utils/milkdown-diff-plugin.js`).
- Preserved change IDs across routine offset shifts via reconciliation logic (`src/lib/utils/diff.js`).
- Strengthened ID retention for repeated similar edits via context-aware reconciliation scoring against prior edited snapshots (`src/lib/utils/diff.js`, `src/lib/stores/app.js`).

#### A2. Structural/semantic change channel
- Added semantic diff pipeline for non-textual intent (`src/lib/utils/semantic-diff.js`).
- Captures block-type, heading-level, list nesting/kind, link target, formatting-only, code-fence language, and table-structure changes.
- Bundles now emit `semantic_changes` and include semantic summaries in `summary_for_agent.md` (`src/lib/utils/bundle.js`).

#### A3. Safe close, autosave, recovery, degraded mode
- Restored normal macOS close behavior with intercepted finalize-on-close flow (`src/routes/+page.svelte`, `src-tauri/tauri.conf.json`).
- Added session autosave snapshots and resume/discard recovery path (`src/routes/+page.svelte`, `src/lib/stores/app.js`).
- Added degraded mode fallback so bundle output still completes when highlight/diff subsystems fail (`src/routes/+page.svelte`, `src/lib/components/Editor.svelte`).

### WS-B: Bundle Contract v2 (Tier 3 Data Reliability)

Status: **shipped** (`marg-xwx`)

#### B1. New bundle artifacts
- Added machine-readable patch output: `changes.patch`.
- Added provenance artifact: `provenance.json`.

#### B2. Provenance schema and hashing
- `provenance.json` includes schema version, bundle format version, session metadata, engine metadata, counts, artifact byte sizes, and artifact SHA-256 hashes.
- `changes.json` now includes `bundle_format_version`.

#### B3. Verification
- Regression coverage in `scripts/check-bundle-artifacts.mjs`.
- Script validates patch round-trip and provenance hash integrity.

### WS-C: Hook Orchestration (Tier 3 Workflow Reliability)

Status: **shipped** (`marg-b17`)

#### C1. Async + sync review modes
- Hook supports `MARGINALIA_REVIEW_MODE=sync|async` (`hooks/post-write.sh`).
- CLI/installer support `--sync` / `--async` for Claude hook configuration:
  - `scripts/marginalia`
  - `scripts/install.sh`
- Async mode writes Claude hook entries with `async: true` and env-prefixed command.

#### C2. Single-instance queue
- Implemented deterministic queueing in hook script with monotonic sequence IDs and run lock.
- Stale lock recovery included for robustness after process interruption.
- Queue controls exposed via env vars:
  - `MARGINALIA_QUEUE_DIR`
  - `MARGINALIA_QUEUE_POLL_SECONDS`
  - `MARGINALIA_QUEUE_MAX_WAIT_SECONDS`
- Hook launch path now respects `MARGINALIA_APP_PATH` and prefers app-bundle launch (`open -W`) before raw binaries for consistent macOS icon/lifecycle behavior.

#### C3. Regression coverage
- Added `scripts/check-hook-async-queue.sh`.
- Verifies:
  - serialized (non-overlapping) review execution,
  - valid hook output shape,
  - async/sync settings generation and de-dup behavior.

### WS-D: UX/Design Polish (Tier 2)

Status: **shipped for current phase**

Implemented:
- Reduced jitter by pause-based diff refresh behavior.
- Better visual predictability via stable change rail and preserved anchors.
- Dark-mode first paint bootstrap so theme class is applied before hydration (`marg-1ub`).
- Blur/perf budget tuning with focal vs static glass surfaces to reduce scroll/typing compositing load (`marg-0st`).
- Shared interaction motion/focus token pass applied across primary controls (`marg-fjf`).
- Density toggle (`Review` vs `Manuscript`) with persisted preference and layout-specific variable overrides (`marg-35e`).
- Configurable lint controls with session ignore + explainable trigger details (`marg-0z8`).

Pending (next beads):
1. No open polish beads remain from this phase; create new beads for any additional UX iteration.

## 5. Bundle v2 Contract

Current bundle contents:

1. `original.md`
2. `final.md`
3. `changes.json`
4. `annotations.json`
5. `summary_for_agent.md`
6. `changes.patch`
7. `provenance.json`

Contract notes:

1. `summary_for_agent.md` remains the primary agent consumption file.
2. `changes.patch` is the machine-apply artifact.
3. `provenance.json` is the forensic/debug artifact.
4. `changes.json` remains structured diff + semantic channel, now version-marked.

## 6. Hook Integration Contract

Trigger behavior:

1. `-draft.md` suffix, or
2. `<!-- REVIEW -->` marker, or
3. optional regex override via `MARGINALIA_REVIEW_REGEX`.

Execution behavior:

1. requests enqueue on match,
2. single active review process,
3. output posted through `hookSpecificOutput.additionalContext`.

Mode behavior:

1. `sync`: blocking review loop.
2. `async`: non-blocking Claude loop (when hook config uses `async: true`), with completion context delivered later.

## 7. Regression Suite

Runbook:

1. `pnpm run check:diff`
2. `pnpm run check:semantic`
3. `pnpm run check:bundle`
4. `pnpm run check:hook`
5. `pnpm run check:lint`
6. `pnpm run check`
7. `pnpm run build`

Latest gates:

1. February 10, 2026 (`marg-4sd`): full runbook passed (`check:diff`, `check:semantic`, `check:bundle`, `check:hook`, `check:lint`, `check`, `build`).
2. February 10, 2026 (`marg-omj`): distribution/launch validation passed (`check:hook`, `check`, `build`, `tauri:build:app`), with `/Applications` replacement and icon metadata/resource verification.

## 8. Open Risks / Next Decisions

1. Diff ID reconciliation is heuristic; long sessions with repeated similar edits may still warrant deeper ProseMirror-step anchoring.
2. Interaction and density improvements should be monitored in real sessions to tune defaults if users prefer one mode heavily.

## 9. Beads Snapshot

Closed in this execution wave:

1. `marg-z5h`
2. `marg-lxi`
3. `marg-ee2`
4. `marg-s3h`
5. `marg-xwx`
6. `marg-b17`
7. `marg-1ub`
8. `marg-0st`
9. `marg-fjf`
10. `marg-35e`
11. `marg-0z8`
12. `marg-0db`
13. `marg-xp1`
14. `marg-4sd`
15. `marg-omj`
16. `marg-jd0`

No open issues remain in this phase after sync.
