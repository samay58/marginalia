# V2 Polish Pass 2 — Grid Alignment, Save Rationale, Sticky SAVED

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restore the broken three-column alignment (root cause: `.desk` grid tokens removed in Phase 2), make the "+ New note" compose flow visually correct so users can save rationales, and hold the SAVED LED green for 2s on each autosave so it's actually perceivable.

**Architecture:** Five focused phases, each single-file where possible. Biggest phase is 2 (AnnotationEditor restyle). No structural changes to `.desk` grid — we alias the missing tokens. All four answered decisions are locked:

1. Grid fix → alias tokens (minimal), not restructure.
2. Annotation scope → AnnotationEditor only (AnnotationPopover stays v1 for now).
3. SAVED LED hold → 2 seconds.
4. Compact breakpoint → keep at ~1100px.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), existing v2 token system at `src/lib/theme/tokens.css`.

**Source material:**
- User screenshots: 2026-04-22 15:21–15:24, five captures showing broken grid (image 5), working revision marks (image 6), narrow-window rationale hide (image 7), clean Help modal (image 8), clean Manuscript tab mode (image 9).
- Prior plan: `docs/superpowers/plans/2026-04-22-v2-polish-pass.md`
- Design tokens: `docs/design/DESIGN_REFERENCE.md`

**Non-goals:**
- No touching `.desk` grid structure beyond adding legacy-token aliases.
- No restyling `AnnotationPopover` (separate pass).
- No changes to diff engine, annotation resolver, bundle format, store.
- No compact-mode breakpoint changes.

**Execution discipline:**
- Branch: `feat/v2-clunky-review-surface` (continue).
- Each task ends with a commit. Conventional commits.
- After each task, run `pnpm run check`. Baseline: 2 pre-existing errors + 0 warnings. Do not introduce new diagnostics.
- After the last phase, run the full `pnpm run check:*` suite + `pnpm run build`.
- Visual verification is human-in-loop (`pnpm tauri dev`); subagents never invoke it.

---

## File Structure

### Modified

- `src/lib/theme/tokens.css` — add `--desk-rail-width`, `--desk-right-width`, `--desk-gap`, `--desk-padding-x` aliases. Fixes the broken `.desk` grid silently.
- `src/lib/components/AnnotationEditor.svelte` — replace scoped styles and (where needed) class names so the compose UI (excerpt quote, textarea, Remove / Cancel / Save buttons) reads as v2 chrome: beveled raised buttons, mono labels, chip-family inset textarea, sits cleanly inside the rationale sunken well.
- `src/routes/review/+page.svelte` — add `stickySavedUntil` state + derived `sticky saved` signal; pass the derived value to `<BottomShortcutBar />`'s `saved` prop so the LED holds green 2 seconds past each `autosave` transition.

### Created

None. This pass is all modifications.

### Untouched

- Store logic, diff/annotation utilities, bundle generator, Rust code, `scripts/check-*.mjs`, `AnnotationPopover.svelte`, `AnnotationColumn.svelte`.

---

## Phase 1 — Restore three-column alignment (P0)

### Task 1: Alias the legacy `.desk` grid tokens

**Files:**
- Modify: `src/lib/theme/tokens.css:33` (append after the `--rationale-well-bg` line)

- [ ] **Step 1: Add the alias block**

Edit `src/lib/theme/tokens.css`. Find the line that reads `--rationale-well-bg: #F5F2E4;` (around line 33). Immediately after it, insert:

```css
  /* --- Legacy .desk grid aliases --------------------------------------------
     The pre-v2 review surface drove its three-column grid from --desk-* tokens
     that lived in the old app.css. Phase 2 removed app.css and those tokens,
     which silently invalidated the grid-template-columns value in
     src/routes/review/+page.svelte and collapsed the Rationale panel under
     the rail + editor. Restoring the tokens as aliases onto v2 values fixes
     alignment without restructuring the grid.
     -------------------------------------------------------------------- */
  --desk-rail-width: var(--rail-w);
  --desk-right-width: var(--rationale-w);
  --desk-gap: 0px;
  --desk-padding-x: 0px;
  --header-height: var(--appheader-h);
  --status-bar-height: var(--bottombar-h);
```

The `--header-height` / `--status-bar-height` aliases are a safety belt because `SessionDrawer.svelte` and the reference drawer still reference them (flagged in IMPLEMENTATION_NOTE.md under "Known follow-ups"). Adding them here is a no-op for the grid but fixes latent drawer-offset issues.

- [ ] **Step 2: Verify svelte-check clean**

Run: `pnpm run check`
Expected: `svelte-check found 2 errors and 0 warnings in 2 files` (pre-existing baseline, unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/lib/theme/tokens.css
git commit -m "fix(theme): alias --desk-* tokens to v2 values to restore three-column review grid"
```

- [ ] **Step 4: Human visual checkpoint**

Run (outside the subagent): `pnpm tauri dev`
Expected: rail (244 px), manuscript (flex-center), rationale (352 px) render as three horizontally-aligned columns. No stacking. No beige gap between rail and manuscript.

If columns still stack, the token alias isn't sufficient — stop and escalate. (Fallback: the `.desk` grid rule may need its `grid-template-columns` updated to use v2 tokens directly. That's out of scope for this task; report and we'll reopen.)

---

## Phase 2 — Save-rationale path works visually

### Task 2: Restyle `AnnotationEditor.svelte` to v2 chrome

**Files:**
- Modify: `src/lib/components/AnnotationEditor.svelte`

Context: user says "no way to save the rationale or confirm it looks good." The compose flow already wires correctly — the user sees + New note → the editor — but the Save / Cancel buttons inside the editor are styled with pre-v2 tokens (`--accent`, `--accent-hover`, `--shadow-sm`, `--radius-md`) that no longer exist, so the buttons render near-invisibly on the new beveled well. Fix: full `<style>` replacement + minor class additions, preserving all existing script logic and markup structure.

- [ ] **Step 1: Inspect the current file so your edits land cleanly**

Run: `sed -n '1,100p' src/lib/components/AnnotationEditor.svelte`

Confirm:
- Props interface at top uses rune-era `$props()`.
- Template has `.annotation-editor > .annotation-excerpt | .annotation-empty, .annotation-input, .annotation-actions > (.annotation-actions-left > .annotation-remove, .annotation-actions-right > .annotation-cancel + .annotation-save)`.
- No need to change markup other than the excerpt smart quotes being left alone.

- [ ] **Step 2: Replace the `<style>` block**

Open the file, find the opening `<style>` tag, and replace everything between `<style>` and `</style>` (inclusive of the `<style>` tags themselves remains unchanged) with:

```svelte
<style>
  .annotation-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .annotation-excerpt {
    margin: 0;
    padding: 8px 10px;
    background: var(--rationale-well-bg);
    border: 1px solid var(--chrome-shadow);
    box-shadow: var(--bevel-sunken-1);
    font-family: var(--font-body);
    font-size: 14px;
    font-style: italic;
    line-height: 20px;
    color: var(--ink);
  }

  .annotation-empty {
    margin: 0;
    font-family: var(--font-body);
    font-size: 14px;
    font-style: italic;
    color: var(--muted);
  }

  .annotation-input {
    width: 100%;
    min-height: 96px;
    padding: 10px 12px;
    background: var(--chrome-highlight);
    border: 1px solid var(--chrome-shadow);
    box-shadow: var(--bevel-sunken-1);
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 22px;
    color: var(--ink);
    resize: vertical;
    outline: none;
  }

  .annotation-input::placeholder {
    color: var(--muted);
    font-style: italic;
  }

  .annotation-input:focus {
    box-shadow:
      var(--bevel-sunken-1),
      inset 0 0 0 1px var(--link);
  }

  .annotation-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .annotation-actions-left,
  .annotation-actions-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .annotation-remove,
  .annotation-cancel,
  .annotation-save {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 72px;
    height: 28px;
    padding: 0 14px;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    font-family: var(--font-chrome);
    font-size: 12px;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
    white-space: nowrap;
  }

  .annotation-remove:active,
  .annotation-cancel:active,
  .annotation-save:active {
    box-shadow: var(--bevel-sunken-1);
  }

  .annotation-save {
    background: var(--chip-green-bg);
    border-color: var(--chip-green-border);
    color: var(--chip-green-text);
  }

  .annotation-save:disabled {
    background: var(--button-face);
    color: var(--muted);
    cursor: not-allowed;
    box-shadow: var(--bevel-raised-1);
    opacity: 0.7;
  }

  .annotation-remove {
    background: var(--chip-red-bg);
    border-color: var(--chip-red-border);
    color: var(--chip-red-text);
  }
</style>
```

Do **not** alter the `<script>` block, the JSDoc-typed props, or the template markup. Button semantics, handlers, `disabled` state, and keyboard shortcuts stay exactly as they are.

- [ ] **Step 3: Verify svelte-check clean**

Run: `pnpm run check`
Expected: 2 pre-existing errors, 0 warnings. No new diagnostics.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/AnnotationEditor.svelte
git commit -m "style(annotation): restyle AnnotationEditor to v2 chrome so Save/Cancel read correctly in the rationale well"
```

- [ ] **Step 5: Human visual checkpoint (run after Phase 1's Task 1 human check passes)**

Run: `pnpm tauri dev`

In the running app:
1. Make at least one edit in the manuscript so a change exists.
2. Select the change by clicking it in the manuscript or rail.
3. Click "+ New note" in the Rationale panel.
4. Confirm the textarea is inset, has a sunken appearance, and shows the placeholder.
5. Type 2–3 words; confirm the green "Save rationale" button becomes active.
6. Click Save. Confirm: the annotation appears in the Saved notes list; the panel returns to list mode.

If Save is invisible or inert, stop and report.

---

## Phase 3 — Sticky SAVED LED (2 seconds)

### Task 3: Hold the SAVED chip green for 2 s after every save

**Files:**
- Modify: `src/routes/review/+page.svelte`

Context: `autosaveState` transitions `saving` → `saved` in <100 ms on small edits. The current `saved={autosaveState === 'saved' || autosaveState === 'idle'}` prop feeds the LED chip, but because `saved` is the default post-hydrate state the chip is always green, and the brief `saving` flicker is too fast to perceive. We want: the LED actively "pulses" green for exactly 2 s whenever `autosaveState` becomes `'saved'`, regardless of the ambient state thereafter.

- [ ] **Step 1: Read the existing autosave region + BottomShortcutBar wiring**

Run:
```bash
sed -n '145,160p' src/routes/review/+page.svelte
grep -n "autosaveState = 'saved'" src/routes/review/+page.svelte
grep -n "<BottomShortcutBar" src/routes/review/+page.svelte
sed -n '1695,1715p' src/routes/review/+page.svelte
```

Confirm:
- `let autosaveState = $state('idle');` at line ~154.
- `autosaveState = 'saved';` fires at ~line 377 (success path).
- `<BottomShortcutBar ... saved={autosaveState === 'saved' || autosaveState === 'idle'} />` around line 1702.

- [ ] **Step 2: Add a sticky-saved timestamp next to the existing autosave state**

In the script, right after the `let autosaveState = $state('idle');` declaration (~line 154), add:

```js
  /** Wall-clock timestamp in ms when the last save completed; drives the
   *  sticky-green LED for STICKY_SAVED_MS afterward. */
  let lastSavedAt = $state(0);
  const STICKY_SAVED_MS = 2000;
```

- [ ] **Step 3: Stamp `lastSavedAt` on every save**

Find the line `autosaveState = 'saved';` (~line 377). Immediately after it, add:

```js
      lastSavedAt = Date.now();
```

Keep indentation matching the surrounding block. Do NOT remove or modify the `autosaveState = 'saved';` assignment or the `writeActiveSessionState(...)` call above it.

- [ ] **Step 4: Add a reactive timer that re-evaluates sticky state**

Somewhere in the top-of-script initialization region (after `lastSavedAt` is declared and near other `$state`/timing vars), add:

```js
  let savedTick = $state(0);

  $effect(() => {
    // Keep the LED green for STICKY_SAVED_MS after lastSavedAt, then tick to
    // revert. Reads lastSavedAt as a dep so it resets on every save.
    if (!lastSavedAt) return;
    const elapsed = Date.now() - lastSavedAt;
    const remaining = STICKY_SAVED_MS - elapsed;
    if (remaining <= 0) return;
    const id = setTimeout(() => { savedTick++; }, remaining + 20);
    return () => clearTimeout(id);
  });
```

- [ ] **Step 5: Derive the sticky-saved flag and pass it to BottomShortcutBar**

Add alongside other `$derived` declarations (if none in this file, place immediately after the `$effect` in Step 4):

```js
  const ledSaved = $derived.by(() => {
    savedTick; // dependency only — no read value
    if (autosaveState === 'saving') return false;
    if (autosaveState === 'error') return false;
    if (!lastSavedAt) return autosaveState === 'saved' || autosaveState === 'idle';
    return Date.now() - lastSavedAt < STICKY_SAVED_MS;
  });
```

- [ ] **Step 6: Rewire the `<BottomShortcutBar />` call**

Find the `<BottomShortcutBar` line (~1702). Replace the `saved={autosaveState === 'saved' || autosaveState === 'idle'}` attribute with:

```svelte
    saved={ledSaved}
```

Keep all other attributes on that element unchanged.

- [ ] **Step 7: Verify svelte-check clean**

Run: `pnpm run check`
Expected: 2 pre-existing errors, 0 warnings.

- [ ] **Step 8: Commit**

```bash
git add src/routes/review/+page.svelte
git commit -m "feat(review): hold SAVED LED green for 2 s after autosave so the pulse is perceivable"
```

- [ ] **Step 9: Human visual checkpoint**

Run: `pnpm tauri dev`. Make a quick edit. Observe the bottom bar: the LED should dim briefly (saving), then pulse green for ~2 s, then return to the neutral-saved baseline.

---

## Phase 4 — Stabilize editor column width (cursor-jump fix)

### Task 4: Guard `.editor-column` and `.editor-surface` against flex-thrash

**Files:**
- Modify: `src/routes/review/+page.svelte` (scoped styles around line 1955)
- Modify: `src/lib/components/Editor.svelte` (`.editor-surface` / `.editor-shell` scoped styles)

Context: user reports cursor jumpiness during delete/add. Likely cause: with `--content-max-width` clamp removed in Phase 6-B6 but `.editor-column` still `display: flex; justify-content: center`, the editor child can grow to intrinsic content width on each keystroke, which Milkdown re-measures and re-places the caret. Fix: pin the editor to `width: 100%` within its grid cell and add `min-width: 0` belt-and-braces.

- [ ] **Step 1: Update `.editor-column` scoped style in `+page.svelte`**

Find the `.editor-column { ... }` rule (~line 1955):

```css
  .editor-column {
    min-width: 0;
    overflow: hidden;
    display: flex;
    justify-content: center;
  }
```

Replace with:

```css
  .editor-column {
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .editor-column > :global(*) {
    width: 100%;
    min-width: 0;
  }
```

- [ ] **Step 2: Guard the editor's internal surface selectors**

In `src/lib/components/Editor.svelte`, locate the `.manuscript-host` scoped style (already present from Phase 6). Add (or append) these rules to it:

```css
  .manuscript-host {
    width: 100%;
    min-width: 0;
  }

  :global(.manuscript-host .milkdown),
  :global(.manuscript-host .ProseMirror) {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
```

If `.manuscript-host` already has `width: 100%`, don't duplicate — just ensure `min-width: 0` is present.

- [ ] **Step 3: Verify svelte-check clean**

Run: `pnpm run check`
Expected: 2 pre-existing errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/routes/review/+page.svelte src/lib/components/Editor.svelte
git commit -m "fix(editor): pin editor-column and manuscript surfaces to 100% width so the caret doesn't shift on keystroke"
```

- [ ] **Step 5: Human visual checkpoint**

Run: `pnpm tauri dev`. Type a sentence and delete a word in the middle. The caret should hold a stable position in the text without re-centering.

---

## Phase 5 — Regression + fidelity + update implementation note

### Task 5: Run the full regression gate

**Files:** None.

- [ ] **Step 1: Run the full suite**

```bash
pnpm run check
pnpm run check:diff
pnpm run check:annotations
pnpm run check:semantic
pnpm run check:bundle
pnpm run check:hook
pnpm run check:lint
pnpm run build
```

Expected: all succeed. `pnpm run check` = 2 pre-existing errors + 0 warnings.

- [ ] **Step 2: No commit for verification**

### Task 6: Update `docs/design/IMPLEMENTATION_NOTE.md`

**Files:**
- Modify: `docs/design/IMPLEMENTATION_NOTE.md`

- [ ] **Step 1: Append a polish-pass-2 block at end of file**

Add to the bottom:

```markdown

---

## Polish pass 2 — 2026-04-22

**Plan:** `docs/superpowers/plans/2026-04-22-v2-polish-pass-2.md`

### Landed
- **Grid alignment restored** (Phase 1). Added `--desk-rail-width`, `--desk-right-width`, `--desk-gap`, `--desk-padding-x`, `--header-height`, `--status-bar-height` aliases in `tokens.css` pointing at v2 values. The `.desk` grid + reference-drawer offsets now compute correctly. Rationale panel sits in the third column, not stacked under the first two.
- **AnnotationEditor restyled** (Phase 2). Excerpt, textarea, and Remove / Cancel / Save buttons all use v2 chrome: inset sunken textarea, chip-family buttons (green Save, red Remove, neutral Cancel). The save flow is now visible and operable.
- **Sticky SAVED LED** (Phase 3). A 2-second hold on each `autosaveState === 'saved'` transition, driven by a `lastSavedAt` timestamp and a re-evaluating `$effect`. LED acknowledges saves even on near-instant autosaves.
- **Editor column pinned to 100% width** (Phase 4). `.editor-column > *` forced to `width: 100%; min-width: 0`, plus `.manuscript-host` and `.ProseMirror` guarded. Caret holds position on keystroke-driven edits.

### Known follow-ups (carried over / new)
- AnnotationPopover (compact-layout compose surface) is still v1 styling; restyle in a follow-up pass.
- Breadcrumb / Sign Out still stubbed pending real routes.
- Rationale drag-resize still visual-only; min/max/close cover the same affordance.
- Preferences persists to `localStorage`; Tauri fs-backed storage deferred.
```

- [ ] **Step 2: Commit**

```bash
git add docs/design/IMPLEMENTATION_NOTE.md
git commit -m "docs(design): polish-pass-2 implementation note"
```

### Task 7: Final human fidelity checkpoint

**Files:** None.

- [ ] **Step 1: Walk through the 16-item checklist from polish-pass 1 Phase F Task F2 again.** Items 1 (columns aligned) and the earlier-undocumented "save rationale" + "SAVED LED readable" should now pass in addition to the items that already did. Report any remaining drift.

---

## Self-review

- [ ] Every task ends with `git commit`.
- [ ] All 4 locked decisions reflected:
  - Decision 1 (alias tokens): Task 1.
  - Decision 2 (AnnotationEditor only): Task 2.
  - Decision 3 (2 s sticky SAVED): Task 3 (`STICKY_SAVED_MS = 2000`).
  - Decision 4 (keep 1100 px compact breakpoint): no task — unchanged by design.
- [ ] No placeholders. Every CSS block and JS snippet is ready to paste.
- [ ] Type consistency across phases: `autosaveState`, `lastSavedAt`, `ledSaved`, `STICKY_SAVED_MS` are all defined in the same task and referenced only where defined.
- [ ] Phase 1 can ship standalone if Phases 2–4 stall — fixes the most visible user complaint.

---

## Exit criteria

All five phases green. Automated gate clean. Visual walk-through confirms: three columns aligned, Save button visible and operable, SAVED LED pulses on edits, caret stable during typing.
