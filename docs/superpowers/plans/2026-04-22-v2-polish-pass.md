# V2 Polish Pass — Alignment, Interactivity, Core UX Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the v2 clunky review surface clean, aligned, and functionally correct. Fix layout overlap + aggressive text wrapping, restore the core insert/delete revision marks that went missing when we replaced the token system, reduce the Rationale panel's competing empty-state strings, and make every surface that looks interactive actually interactive.

**Architecture:** Six focused phases, each independently committable and revertible. The biggest structural change is Phase B, where the Rationale panel becomes a real flex-sibling column instead of an absolutely-positioned overlay — this single change resolves most of the alignment and text-wrap complaints the user flagged.

**Approved decisions (locked before implementation started):**

1. Rationale layout → **flex sibling column**.
2. Rationale min/max/close → **full behavior**: close hides panel, min collapses to title bar, max expands over manuscript.
3. Manuscript tab → **distraction-free editor**, full width, no rail or rationale.
4. Window controls → **remove right-side trio**, traffic lights only.
5. Breadcrumb → **muted indicator text**, non-interactive.
6. Header nav → **Help + Preferences live, Sign Out hidden**.
7. Keycaps → **clickable**, fire same action as keyboard shortcut.
8. DialKit handle → **hide by default**, revealed via Preferences toggle or `VITE_DIALKIT=1`.
9. Revision marks → **chip-family muted palette** (green insert, red delete).

**Source material:**
- Oracle: `docs/design/references/paper-v2-artboard.png`
- User screenshots: the two CleanShot captures from 2026-04-22 14:10 showing the real running app.
- Prior plan: `docs/superpowers/plans/2026-04-22-v2-clunky-review-surface.md`
- Design tokens: `docs/design/DESIGN_REFERENCE.md`
- Implementation notes: `docs/design/IMPLEMENTATION_NOTE.md`

**Non-goals:**
- No changes to the diff engine, annotation resolver, bundle format, or store.
- No dark mode.
- No real backend for Sign Out / auth.
- No resize-by-dragging on the Rationale panel (grip stays decorative; min/max/close give the same affordance).
- No accessibility audit beyond fixing the existing `href="#"` warning.

**Execution discipline:**
- Feature branch is `feat/v2-clunky-review-surface`. We continue on the same branch.
- Each task ends with a commit. Conventional commits.
- After each phase, run the relevant regression scripts. Phase F runs the whole gate.
- If a step requires running the GUI app (`pnpm tauri dev`), surface it as a human-in-loop checkpoint; the subagent does not attempt it.

---

## File Structure

### Modified

- `src/lib/theme/tokens.css` — add revision-mark tokens, add 2 supporting tokens the existing Editor code relies on.
- `src/lib/components/chrome/TitleBar.svelte` — remove right-side WindowControl trio; widen stripes.
- `src/lib/components/chrome/AppHeader.svelte` — swap `<a href="#">` for muted non-interactive breadcrumb spans; limit nav to Help + Preferences as `<button>`s.
- `src/lib/components/chrome/TabStrip.svelte` — no markup change, but confirm the parent passes `onSelect` and wires state.
- `src/lib/components/chrome/BottomShortcutBar.svelte` — keycaps become buttons that fire actions passed in by the parent.
- `src/lib/components/chrome/Keycap.svelte` — accept an optional `onClick` prop and wrap glyph+label in a `<button>` when present, `<span>` when not.
- `src/lib/components/AnnotationColumn.svelte` — collapse competing empty-state strings to one line; remove the stale "Select an edit to review it." / "SAVED NOTES" scaffolding inside the new v2 frame; wire min/max/close/visibility state through a parent prop.
- `src/lib/components/Editor.svelte` — remove the 392px right-padding reservation, drop `.editor-frame` max-width clamp, simplify `.manuscript-host` padding; verify `.added` / `.struck` decoration classes still exist after the Phase 6 restyle.
- `src/routes/review/+page.svelte` — make `.content-area` a flex row with three columns (rail / manuscript / rationale); manage rationale visibility + min/max state; manage tab mode (review vs manuscript); expose keycap handlers; gate `DialStore.registerPanel` on a preferences flag; wire breadcrumb + nav; remove the a11y warning; add `⌘⇧R` to re-show a hidden Rationale panel; add click handlers to traffic lights that still work if Tauri capability missing.
- `src/routes/+layout.svelte` — conditional render of `<DialRoot />` based on preferences / env.
- `src-tauri/capabilities/default.json` — verify `core:window:allow-minimize`, `core:window:allow-maximize`, `core:window:allow-close`, `core:window:allow-toggle-maximize` are permitted.

### Created

- `src/lib/stores/preferences.js` — a small persistent store for Preferences (dialkit handle visibility is the first entry; easy to extend).
- `src/lib/stores/review-ui.js` — ephemeral UI state: `tabMode` (`'review' | 'manuscript'`), `rationaleState` (`'open' | 'minimized' | 'maximized' | 'closed'`). Session-scoped, reset on reload.
- `src/lib/components/chrome/HelpModal.svelte` — keyboard-shortcut list + link stub.
- `src/lib/components/chrome/PreferencesPanel.svelte` — current entries: DialKit handle toggle.

### Untouched

- Store logic (`src/lib/stores/app.js`), diff/annotation utilities, bundle generator, Rust code, all `scripts/check-*.mjs`.

---

## Phase A — Restore revision-mark tokens (core UX unblock)

This is highest priority. The user called insertions missing their green styling "core to the interface." The regression was caused when Phase 2 replaced `src/app.css` and removed the old revision-mark tokens. The Editor's `.added` / `.struck` decoration classes still reference `--insert-bg`, `--insert-ink`, `--insert-line`, `--struck-bg`, `--struck-text`, `--struck-line`, `--delete-ink` — all undefined. We restore those tokens using the chip-family palette the user approved.

### Task A1: Add revision-mark tokens to `tokens.css`

**Files:**
- Modify: `src/lib/theme/tokens.css`

- [ ] **Step 1: Append the block below to `src/lib/theme/tokens.css` inside `:root { ... }` right after the `--rationale-well-bg` line.**

```css
  /* --- Revision marks (chip-family muted) --------------------------------- */
  --insert-ink: #2B4E35;
  --insert-bg: rgba(61, 107, 74, 0.12);
  --insert-line: #3D6B4A;
  --delete-ink: #8A3838;
  --delete-bg: rgba(138, 56, 56, 0.1);
  --delete-line: #8A3838;
  --struck-bg: var(--delete-bg);
  --struck-text: var(--delete-ink);
  --struck-line: var(--delete-line);

  /* --- Legacy token aliases for existing decoration code ------------------ */
  --accent-subtle: var(--insert-bg);
  --paper-bright: var(--chrome-highlight);
```

Rationale: `--struck-*` are aliases the Editor uses. `--accent-subtle` and `--paper-bright` are referenced inside the `.added.selected` and `::selection` rules of the existing Editor.svelte CSS (lines ~755–795 in the current file); aliasing them to the v2 palette is the cheapest fix.

- [ ] **Step 2: Run `pnpm run check`**

Run: `pnpm run check`
Expected: 2 pre-existing errors + 1 pre-existing a11y warning. No new errors. (This step only adds new tokens; it cannot introduce errors.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/theme/tokens.css
git commit -m "fix(theme): restore revision-mark tokens (insert/delete/struck) + legacy aliases"
```

### Task A2: Visual verification

**Files:** None (human-in-loop).

- [ ] **Step 1: Launch the dev app**

Run: `pnpm tauri dev`
(Controller should surface this as a human checkpoint. Subagent: do not attempt.)

- [ ] **Step 2: Produce a sample edit**

In the manuscript, delete a few words (they should render with red strikethrough on soft red wash) and type a few new words (they should render in green ink on soft green wash, with a thin green underline).

- [ ] **Step 3: If colors look too muted or too saturated, tune values in `tokens.css` and re-run. Otherwise proceed.**

No commit for this task unless tuning happened, in which case:

```bash
git add src/lib/theme/tokens.css
git commit -m "style(theme): tune revision-mark token saturation after visual check"
```

---

## Phase B — Layout restructure (fix overlap + wrap + right-trio)

### Task B1: Remove right-side WindowControl trio from `TitleBar.svelte`

**Files:**
- Modify: `src/lib/components/chrome/TitleBar.svelte`

Rationale: decision 4 — traffic lights only. Duplicate controls cause ambiguity; the user flagged "elements look like buttons but don't work like buttons" — the right trio was decorative and this is the cleanest response.

- [ ] **Step 1: Read the current file. Find the `<WindowControl ... />` calls and the `<div class="controls">` wrapper.**

Run: `sed -n '1,100p' src/lib/components/chrome/TitleBar.svelte`

- [ ] **Step 2: Delete the three `<WindowControl ... />` lines and the `<div class="controls">...</div>` wrapper in the template.**

- [ ] **Step 3: Delete the `import WindowControl from './WindowControl.svelte';` line from the `<script>` block** (no more uses after step 2).

- [ ] **Step 4: Delete the `.controls { ... }` block from the scoped `<style>` block.**

- [ ] **Step 5: Leave `TrafficLight` calls and their `minimize` / `zoom` / `close` handlers intact.**

- [ ] **Step 6: Run `pnpm run check`**

Expected: 2 pre-existing errors, no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/chrome/TitleBar.svelte
git commit -m "refactor(chrome): remove duplicate right-side window controls, keep traffic lights as the sole min/max/close affordance"
```

### Task B2: Preserve `WindowControl.svelte` as a reusable primitive

**Files:** None. Do not delete `WindowControl.svelte` — it's still used by AnnotationColumn's rationale title bar for its own min/max/close. Verify its continued use remains valid.

- [ ] **Step 1: Confirm the primitive is still referenced.**

Run: `grep -rn "WindowControl" src/ --include='*.svelte'`
Expected: at least the `AnnotationColumn.svelte` import + usage. If only TitleBar referenced it (now deleted), the file becomes dead code and should be removed. Otherwise keep it.

- [ ] **Step 2: No commit needed for a pure verification step.**

### Task B3: Create `src/lib/stores/review-ui.js` for tab + rationale state

**Files:**
- Create: `src/lib/stores/review-ui.js`

- [ ] **Step 1: Write the file.**

```js
// Ephemeral review-surface UI state. Session-scoped: reset on page reload.
import { writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<'review' | 'manuscript'>} */
export const tabMode = writable('review');

/** @type {import('svelte/store').Writable<'open' | 'minimized' | 'maximized' | 'closed'>} */
export const rationaleState = writable('open');

export function toggleRationaleClosed() {
  rationaleState.update((s) => (s === 'closed' ? 'open' : 'closed'));
}

export function toggleRationaleMinimized() {
  rationaleState.update((s) => (s === 'minimized' ? 'open' : 'minimized'));
}

export function toggleRationaleMaximized() {
  rationaleState.update((s) => (s === 'maximized' ? 'open' : 'maximized'));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/review-ui.js
git commit -m "feat(review): add ephemeral UI state store for tab mode and rationale panel"
```

### Task B4: Restructure `src/routes/review/+page.svelte` `.content-area` as a flex row

This is the heart of Phase B. It converts the absolutely-positioned Rationale panel into a flex sibling column.

**Files:**
- Modify: `src/routes/review/+page.svelte`

- [ ] **Step 1: Read the current content-area template and its scoped style.**

Run:
```bash
sed -n '1480,1540p' src/routes/review/+page.svelte
grep -n "\.content-area" src/routes/review/+page.svelte
```

Locate the `.content-area` opening element and the scoped `<style>` rule that defines it.

- [ ] **Step 2: Add imports for the new UI state store at the top of the existing `<script>` block.**

```js
import { tabMode, rationaleState } from '$lib/stores/review-ui.js';
```

Also add an `import { derived } from 'svelte/store';` if not already imported, and declare reactive flags:

```js
// Placed alongside other $derived / reactive declarations in <script>.
const showRail = $derived($tabMode === 'review');
const showRationale = $derived($tabMode === 'review' && $rationaleState !== 'closed');
const rationaleMinimized = $derived($rationaleState === 'minimized');
const rationaleMaximized = $derived($rationaleState === 'maximized');
```

- [ ] **Step 3: Rewrite the `.content-area` template block.**

Replace the existing `.content-area` wrapping div (and its direct children) with:

```svelte
<div
  class="content-area"
  class:mode-manuscript={$tabMode === 'manuscript'}
  class:rationale-max={rationaleMaximized}
>
  {#if showRail}
    <ChangeRail ... />
  {/if}

  <Editor ... />

  {#if showRationale}
    <AnnotationColumn
      minimized={rationaleMinimized}
      maximized={rationaleMaximized}
      onMinimize={toggleRationaleMinimized}
      onMaximize={toggleRationaleMaximized}
      onClose={toggleRationaleClosed}
      ...existingProps
    />
  {/if}
</div>
```

Pull the existing prop-passing on `ChangeRail` / `Editor` / `AnnotationColumn` into the respective spots (do not duplicate props; preserve what was there in Phase 5). Remove any absolute-positioning scoped styles from `AnnotationColumn` in a follow-up task (Task B5 handles this).

- [ ] **Step 4: Update the scoped `.content-area` styles.**

Replace the existing `.content-area` scoped style with:

```css
.content-area {
  display: flex;
  flex: 1;
  background: var(--window-body);
  overflow: hidden;
  min-height: 0;
}

.content-area.mode-manuscript :global(.rail),
.content-area.mode-manuscript :global(.rationale-panel) {
  display: none;
}

.content-area.rationale-max :global(.manuscript-host) {
  display: none;
}
```

- [ ] **Step 5: Import the toggle helpers in the `<script>` block**

```js
import {
  toggleRationaleClosed,
  toggleRationaleMinimized,
  toggleRationaleMaximized
} from '$lib/stores/review-ui.js';
```

- [ ] **Step 6: Add the ⌘⇧R hotkey to re-open the Rationale if it's closed.**

In the `handleWindowKeydown` function near line 1069, add (after the existing `⌘⇧O` branch):

```js
if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'r') {
  event.preventDefault();
  toggleRationaleClosed();
  return;
}
```

- [ ] **Step 7: `pnpm run check`**

Expected: 2 pre-existing errors; no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/routes/review/+page.svelte
git commit -m "feat(review): restructure content area as flex columns; add ⌘⇧R to toggle Rationale; tab mode switches distraction-free editor"
```

### Task B5: Convert `AnnotationColumn.svelte` from absolute to flex child

**Files:**
- Modify: `src/lib/components/AnnotationColumn.svelte`

- [ ] **Step 1: Read the component to find the `.rationale-panel` selector and its current `position: absolute` + `top/right/bottom/width` rules.**

Run: `grep -n "\.rationale-panel" src/lib/components/AnnotationColumn.svelte | head`

- [ ] **Step 2: Replace the `.rationale-panel` root style block with the flex-child form.**

Existing style likely includes `position: absolute; top: 12px; right: 12px; bottom: 22px; width: var(--rationale-w);`. Replace with:

```css
.rationale-panel {
  display: flex;
  flex-direction: column;
  width: var(--rationale-w);
  flex-shrink: 0;
  background: var(--window-body);
  border-left: 1px solid var(--navy-shadow);
  box-shadow: inset 1px 0 0 var(--chrome-highlight);
  position: relative; /* for resize grip anchoring */
  overflow: hidden;
}

.rationale-panel.minimized {
  height: 34px; /* just the title bar */
  align-self: flex-start;
}

.rationale-panel.maximized {
  flex: 1;
  width: auto;
}

.rationale-panel.minimized .rat-toolbar,
.rationale-panel.minimized .rat-body,
.rationale-panel.minimized .rat-grip {
  display: none;
}
```

- [ ] **Step 3: Accept new props for min/max state and handlers.**

In the `<script>` block, add:

```js
let {
  minimized = false,
  maximized = false,
  onMinimize,
  onMaximize,
  onClose,
  // ...existing props
} = $props();
```

Bind `class:minimized={minimized}` and `class:maximized={maximized}` on the root `<aside class="rationale-panel" ...>` element.

- [ ] **Step 4: Wire the three min/max/close buttons inside `.rat-titlebar`.**

Find the existing `<button class="rat-ctl" aria-label="Minimize">` etc and add `onclick={onMinimize}` / `onclick={onMaximize}` / `onclick={onClose}` respectively.

- [ ] **Step 5: `pnpm run check`**

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/AnnotationColumn.svelte
git commit -m "refactor(rationale): convert AnnotationColumn from absolute overlay to flex sibling; wire min/max/close"
```

### Task B6: Simplify `Editor.svelte` padding

**Files:**
- Modify: `src/lib/components/Editor.svelte`

- [ ] **Step 1: Locate `.manuscript-host` scoped styles.**

Run: `grep -n "\.manuscript-host\|\.editor-frame\|content-max-width" src/lib/components/Editor.svelte | head`

- [ ] **Step 2: Simplify the host padding.**

Find the `.manuscript-host` block and change its padding from `40px 392px 60px 64px` to `40px 72px 60px 72px`. Remove any `max-width` constraints from `.editor-frame` or `.editor-shell` within the component — the manuscript now fills the flex: 1 column naturally without needing a max-width guard.

If the existing `.editor-frame` or `.editor-shell` CSS uses `--content-max-width`, replace the rule with `max-width: none;` or delete the rule entirely.

- [ ] **Step 3: `pnpm run check`**

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Editor.svelte
git commit -m "fix(editor): drop 392px right-pad reservation and editor-frame max-width; let the manuscript fill its flex column"
```

### Task B7: Human visual checkpoint

**Files:** None.

- [ ] **Step 1: Run `pnpm tauri dev`**

- [ ] **Step 2: Confirm all of the following:**
  - Left rail ends cleanly at its right border, no beige gap before manuscript.
  - Manuscript text wraps at a natural column width (~720–800 px, 10–12 words per line), not at 3 words.
  - Rationale panel sits flush to the right edge of the window with its own border; no overlap with tab strip or bottom bar.
  - Switching to "Manuscript" tab hides both side panels; "Review" restores them.
  - Closing Rationale (click its `X`) hides the panel; `⌘⇧R` reopens.
  - Minimize collapses Rationale to just the title bar; clicking minimize again expands.
  - Maximize expands Rationale to take over the manuscript column; clicking maximize again returns to default.

- [ ] **Step 3: Only proceed to Phase C after Phase B's visual checkpoint passes.**

---

## Phase C — AnnotationColumn empty-state collapse

### Task C1: Remove the competing empty-state strings in `AnnotationColumn.svelte`

**Files:**
- Modify: `src/lib/components/AnnotationColumn.svelte`

Context: the user's screenshot shows three stacked empty-state strings — "Select an edit to review it.", "SAVED NOTES", "No rationales yet." — inside the rationale panel. The Paper oracle shows only "No rationales yet." We collapse.

- [ ] **Step 1: Locate the rat-body block.**

Run: `grep -n "Select an edit\|SAVED NOTES\|No rationales" src/lib/components/AnnotationColumn.svelte`

- [ ] **Step 2: Reduce the empty state to a single italic line.**

Inside `.rat-body > SunkenWell`, replace the entire empty-state branch with:

```svelte
{#if !hasSelection && annotations.length === 0}
  <span class="rat-empty">No rationales yet.</span>
{:else if !hasSelection}
  <ul class="rat-list">
    <!-- existing list rendering preserved -->
  </ul>
{:else}
  <!-- existing compose UI preserved -->
{/if}
```

If the component doesn't already expose a `hasSelection` flag, derive it from the existing `selectedChangeId` / `selectedAnnotationId` state. Use whatever variable the component already uses to decide between list-mode and compose-mode.

- [ ] **Step 3: `pnpm run check`**

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/AnnotationColumn.svelte
git commit -m "style(rationale): collapse competing empty-state strings to a single italic 'No rationales yet.' line"
```

---

## Phase D — Interactive correctness

### Task D1: Verify Tauri window capabilities

**Files:**
- Potentially modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Inspect capabilities.**

Run: `cat src-tauri/capabilities/default.json`
Look for `core:window:allow-minimize`, `core:window:allow-maximize`, `core:window:allow-close`, `core:window:allow-toggle-maximize`, or the catch-all `core:window:default`.

- [ ] **Step 2: If any of those are missing, add them to the `permissions` array.**

Typical permissions block for this plan:

```json
{
  "identifier": "default",
  "description": "Default window capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close"
  ]
}
```

Preserve existing permissions; do not replace the whole file, just add the missing ones.

- [ ] **Step 3: `pnpm tauri dev`** and click each traffic light.

Expected behavior: red closes the window, yellow minimizes, blue toggles zoom. If any silently fails, check the Tauri dev-tools console for capability errors.

- [ ] **Step 4: Commit if file changed.**

```bash
git add src-tauri/capabilities/default.json
git commit -m "chore(tauri): grant window min/max/close capabilities for custom chrome traffic lights"
```

### Task D2: Make Keycap and BottomShortcutBar clickable

**Files:**
- Modify: `src/lib/components/chrome/Keycap.svelte`
- Modify: `src/lib/components/chrome/BottomShortcutBar.svelte`
- Modify: `src/routes/review/+page.svelte`

- [ ] **Step 1: Update `Keycap.svelte` to accept `onClick`.**

Replace the existing template and script with:

```svelte
<script>
  /** @type {{ keys: string, label: string, onClick?: () => void }} */
  let { keys, label, onClick } = $props();
</script>

{#if onClick}
  <button type="button" class="kc kc-btn" onclick={onClick}>
    <span class="cap">{keys}</span>
    <span class="lab">{label}</span>
  </button>
{:else}
  <span class="kc">
    <span class="cap">{keys}</span>
    <span class="lab">{label}</span>
  </span>
{/if}

<style>
  .kc, .kc-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: default;
  }
  .kc-btn { cursor: pointer; }
  .cap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 26px;
    padding: 0 8px;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
    white-space: nowrap;
  }
  .kc-btn:active .cap { box-shadow: var(--bevel-sunken-1); }
  .lab {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink);
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 2: Pass `onClick` through `BottomShortcutBar.svelte`.**

Modify the `BottomShortcutBar.svelte` script to accept handlers:

```js
/** @type {{
 *   edits: number,
 *   annotations: number,
 *   saved: boolean,
 *   onNotes?: () => void,
 *   onRationale?: () => void,
 *   onAddRef?: () => void,
 *   onUndo?: () => void,
 *   onDone?: () => void
 * }} */
let { edits, annotations, saved, onNotes, onRationale, onAddRef, onUndo, onDone } = $props();

const shortcuts = [
  { keys: '⌘ G', label: 'notes', fn: onNotes },
  { keys: '⌘ /', label: 'rationale', fn: onRationale },
  { keys: '⌘ ⇧ O', label: 'add ref', fn: onAddRef },
  { keys: '⌘ Z', label: 'undo', fn: onUndo },
  { keys: 'ESC', label: 'done', fn: onDone }
];
```

Update the `{#each shortcuts as s}` block:

```svelte
{#each shortcuts as s}
  <Keycap keys={s.keys} label={s.label} onClick={s.fn} />
{/each}
```

- [ ] **Step 3: Wire handlers in `src/routes/review/+page.svelte`.**

Find the `<BottomShortcutBar ... />` call. Change it to:

```svelte
<BottomShortcutBar
  edits={/* existing edit count */}
  annotations={/* existing annotation count */}
  saved={/* existing autosave flag */}
  onNotes={toggleSessionDrawer}
  onRationale={handleAnnotationShortcut}
  onAddRef={toggleReferenceSurface}
  onUndo={() => document.execCommand?.('undo')}
  onDone={handleDone}
/>
```

For `onUndo`, if the Milkdown editor has a `undo()` API already exposed by the existing `<Editor />` component, prefer that. If not, `document.execCommand('undo')` is a short-term solution; mark as "revisit" in the implementation note.

- [ ] **Step 4: `pnpm run check`**

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/chrome/Keycap.svelte \
        src/lib/components/chrome/BottomShortcutBar.svelte \
        src/routes/review/+page.svelte
git commit -m "feat(chrome): make bottom-bar keycaps clickable; wire each to its keyboard shortcut's handler"
```

### Task D3: Muted breadcrumb + minimal header nav in `AppHeader.svelte`

**Files:**
- Modify: `src/lib/components/chrome/AppHeader.svelte`

- [ ] **Step 1: Replace the breadcrumb markup.**

Replace the existing `<nav class="crumbs">` contents so breadcrumb items render as `<span>`s with muted styling, not `<a href="#">` links:

```svelte
<nav class="crumbs" aria-label="Breadcrumb">
  {#each breadcrumb as item, i}
    {#if i > 0}<span class="sep">›</span>{/if}
    <span class="crumb" class:active={item.active}>{item.label}</span>
  {/each}
</nav>
```

Update the scoped style for `.crumb`:

```css
.crumb {
  font-family: var(--font-chrome);
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
}
.crumb.active {
  color: var(--ink);
  font-weight: 700;
}
```

No more link-blue on breadcrumbs — only active breadcrumb is ink, others are muted.

- [ ] **Step 2: Replace the header nav markup.**

Change the `<div class="nav">` block to only include Help + Preferences as real `<button>`s, dropping Sign Out entirely:

```svelte
<div class="nav">
  <button type="button" class="nav-link" onclick={onHelp}>Help</button>
  <span class="pipe">|</span>
  <button type="button" class="nav-link" onclick={onPreferences}>Preferences</button>
</div>
```

Update the scoped style:

```css
.nav-link {
  background: transparent;
  border: 0;
  padding: 0;
  font-family: var(--font-chrome);
  font-size: 13px;
  font-weight: 500;
  color: var(--link);
  cursor: pointer;
}
.nav-link:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: Accept `onHelp` and `onPreferences` props.**

```js
/** @type {{
 *   breadcrumb: Array<{ label: string, active?: boolean }>,
 *   onHelp?: () => void,
 *   onPreferences?: () => void
 * }} */
let { breadcrumb, onHelp, onPreferences } = $props();
```

Remove the old `nav: string[]` prop.

- [ ] **Step 4: Update the call site in `review/+page.svelte`.**

Remove the `const nav = [...]` constant. Change the `<AppHeader />` invocation to:

```svelte
<AppHeader
  {breadcrumb}
  onHelp={() => (helpOpen = true)}
  onPreferences={() => (preferencesOpen = true)}
/>
```

Add `let helpOpen = $state(false);` and `let preferencesOpen = $state(false);` alongside other state declarations.

- [ ] **Step 5: `pnpm run check`**

Expected: the pre-existing a11y warning about `<a href="#">` is now gone. 2 pre-existing errors remain.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/chrome/AppHeader.svelte src/routes/review/+page.svelte
git commit -m "feat(header): muted breadcrumb, Help+Preferences buttons, remove Sign Out stub"
```

### Task D4: Minimal HelpModal component

**Files:**
- Create: `src/lib/components/chrome/HelpModal.svelte`
- Modify: `src/routes/review/+page.svelte`

- [ ] **Step 1: Write the component.**

```svelte
<script>
  /** @type {{ open: boolean, onClose: () => void }} */
  let { open, onClose } = $props();

  const shortcuts = [
    { keys: '⌘ G', label: 'Toggle session notes' },
    { keys: '⌘ /', label: 'New rationale on selected edit' },
    { keys: '⌘ ⇧ O', label: 'Toggle references' },
    { keys: '⌘ O', label: 'Open another draft' },
    { keys: '⌘ Z / ⌘ ⇧ Z', label: 'Undo / Redo' },
    { keys: '⌘ ⇧ R', label: 'Toggle Rationale panel' },
    { keys: '⌘ Enter', label: 'Finalize review' },
    { keys: 'ESC', label: 'Finalize or dismiss popover' }
  ];
</script>

{#if open}
  <div
    class="backdrop"
    role="button"
    tabindex="0"
    aria-label="Close help"
    onclick={onClose}
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="titlebar">
        <span class="title" id="help-title">Keyboard Shortcuts</span>
        <button class="close" type="button" aria-label="Close" onclick={onClose}>✕</button>
      </div>
      <ul class="kb-list">
        {#each shortcuts as s}
          <li>
            <span class="k">{s.keys}</span>
            <span class="l">{s.label}</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    width: 420px;
    background: var(--window-body);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-window-2);
    display: flex;
    flex-direction: column;
  }
  .titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 34px;
    background: var(--navy-chrome);
    padding: 0 10px;
    border-bottom: 2px solid var(--navy-shadow);
    flex-shrink: 0;
  }
  .title {
    flex: 1;
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--chrome-highlight);
  }
  .close {
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    width: 22px;
    height: 22px;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .close:active { box-shadow: var(--bevel-sunken-1); }
  .kb-list {
    list-style: none;
    padding: 12px 16px;
    margin: 0;
  }
  .kb-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
  }
  .k {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    height: 22px;
    padding: 0 8px;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
    white-space: nowrap;
  }
  .l {
    font-family: var(--font-chrome);
    font-size: 13px;
    color: var(--ink);
  }
</style>
```

- [ ] **Step 2: Render in `review/+page.svelte`.**

Import `HelpModal` and place it at the end of the `<WindowFrame>` tree:

```svelte
<HelpModal open={helpOpen} onClose={() => (helpOpen = false)} />
```

- [ ] **Step 3: `pnpm run check`, commit.**

```bash
git add src/lib/components/chrome/HelpModal.svelte src/routes/review/+page.svelte
git commit -m "feat(help): minimal HelpModal listing keyboard shortcuts"
```

---

## Phase E — DialKit gating via Preferences

### Task E1: Persistent Preferences store

**Files:**
- Create: `src/lib/stores/preferences.js`

- [ ] **Step 1: Write.**

```js
// Persistent preferences. Backed by localStorage in dev; Tauri fs in prod is a follow-up.
import { writable } from 'svelte/store';

const KEY = 'marginalia.preferences.v1';

const defaults = {
  showDialkitHandle: false
};

function load() {
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function save(value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
}

function createPreferences() {
  const { subscribe, set, update } = writable(load());
  return {
    subscribe,
    set: (value) => {
      save(value);
      set(value);
    },
    update: (fn) => {
      update((current) => {
        const next = fn(current);
        save(next);
        return next;
      });
    }
  };
}

export const preferences = createPreferences();
```

- [ ] **Step 2: Commit.**

```bash
git add src/lib/stores/preferences.js
git commit -m "feat(prefs): add persistent preferences store"
```

### Task E2: Gate `<DialRoot />` and `DialStore.registerPanel`

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/review/+page.svelte`

- [ ] **Step 1: Conditional `<DialRoot />` in the layout.**

Replace the unconditional `<DialRoot />` line with:

```svelte
<script>
  // Existing imports preserved.
  import { preferences } from '$lib/stores/preferences.js';

  const VITE_DIALKIT = import.meta.env.VITE_DIALKIT === '1';
  const showDialkit = $derived(VITE_DIALKIT || $preferences.showDialkitHandle);
</script>

{#if showDialkit}
  <DialRoot />
{/if}
```

- [ ] **Step 2: Guard `DialStore.registerPanel` in `review/+page.svelte`.**

Import `preferences` and `import.meta.env`. Wrap the existing `DialStore.registerPanel` call (around line 491) inside:

```js
if (import.meta.env.VITE_DIALKIT === '1' || get(preferences).showDialkitHandle) {
  DialStore.registerPanel(DESK_PANEL_ID, 'Review Desk', DESK_CONFIG);
  const unsubDesk = DialStore.subscribe(DESK_PANEL_ID, applyDeskValues);
  // ...existing related code
}
```

(`get` from `svelte/store`.)

The unregister path around line 606 must only run if the register actually happened — use a local boolean flag `let dialkitRegistered = false;` to track.

- [ ] **Step 3: `pnpm run check`, commit.**

```bash
git add src/routes/+layout.svelte src/routes/review/+page.svelte
git commit -m "feat(prefs): gate DialKit handle on preferences toggle / VITE_DIALKIT env"
```

### Task E3: Minimal PreferencesPanel

**Files:**
- Create: `src/lib/components/chrome/PreferencesPanel.svelte`
- Modify: `src/routes/review/+page.svelte`

- [ ] **Step 1: Write the component.**

```svelte
<script>
  import { preferences } from '$lib/stores/preferences.js';

  /** @type {{ open: boolean, onClose: () => void }} */
  let { open, onClose } = $props();

  function toggleDialkit(e) {
    const checked = e.currentTarget.checked;
    preferences.update((p) => ({ ...p, showDialkitHandle: checked }));
  }
</script>

{#if open}
  <div
    class="backdrop"
    role="button"
    tabindex="0"
    aria-label="Close preferences"
    onclick={onClose}
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prefs-title"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="titlebar">
        <span class="title" id="prefs-title">Preferences</span>
        <button class="close" type="button" aria-label="Close" onclick={onClose}>✕</button>
      </div>
      <div class="body">
        <label>
          <input
            type="checkbox"
            checked={$preferences.showDialkitHandle}
            onchange={toggleDialkit}
          />
          Show design tuning handle (DialKit)
        </label>
        <p class="note">Shows the live CSS-token tuning handle in the top-right of the desktop. Useful for design iteration.</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    width: 420px;
    background: var(--window-body);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-window-2);
    display: flex;
    flex-direction: column;
  }
  .titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 34px;
    background: var(--navy-chrome);
    padding: 0 10px;
    border-bottom: 2px solid var(--navy-shadow);
  }
  .title {
    flex: 1;
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--chrome-highlight);
  }
  .close {
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    width: 22px;
    height: 22px;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .close:active { box-shadow: var(--bevel-sunken-1); }
  .body {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-chrome);
    font-size: 13px;
    color: var(--ink);
  }
  .note {
    margin: 0;
    padding-left: 24px;
    font-family: var(--font-chrome);
    font-size: 11px;
    color: var(--muted);
  }
</style>
```

- [ ] **Step 2: Render it in `review/+page.svelte` alongside HelpModal.**

```svelte
<PreferencesPanel open={preferencesOpen} onClose={() => (preferencesOpen = false)} />
```

- [ ] **Step 3: `pnpm run check`, commit.**

```bash
git add src/lib/components/chrome/PreferencesPanel.svelte src/routes/review/+page.svelte
git commit -m "feat(prefs): add minimal PreferencesPanel with DialKit handle toggle"
```

---

## Phase F — Fidelity + regression gate

### Task F1: Run all regression gates

**Files:** None.

- [ ] **Step 1: Run the full check suite.**

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

Expected: all succeed. The a11y warning on AppHeader should be gone after Task D3. The 2 pre-existing errors (vite.config.js, DialConfig typing in review/+page) remain.

If any NEW error appears, stop, diagnose, and fix before proceeding.

- [ ] **Step 2: No commit for a pure verification step.**

### Task F2: Visual fidelity checkpoint

**Files:** None (human-in-loop).

- [ ] **Step 1: `pnpm tauri dev`**

- [ ] **Step 2: Walk through this checklist against `docs/design/references/paper-v2-artboard.png`:**

1. Three columns (rail + manuscript + rationale) are cleanly aligned with no beige gaps.
2. Manuscript text wraps at a natural column width — no 3-word lines.
3. A deletion in the manuscript shows red strikethrough with soft red wash.
4. An insertion in the manuscript shows green ink on soft green wash with a thin underline.
5. Traffic lights (red/yellow/blue) actually minimize / zoom / close the window.
6. There is no duplicate right-side min/max/close trio in the title bar.
7. Breadcrumb (All drafts › Product Brief › Draft Review) is muted text, no blue link color, no pointer cursor on the inactive segments.
8. Help button opens the keyboard-shortcut modal; Preferences opens the preferences panel.
9. DialKit tuning handle is hidden by default.
10. Toggling "Show design tuning handle" in Preferences makes the handle appear.
11. Rationale panel's `X` button hides the panel; `⌘⇧R` reopens.
12. Rationale panel's `_` button collapses to its title bar only.
13. Rationale panel's `□` button expands to take over the manuscript column.
14. Clicking "Manuscript" tab hides rail + rationale; clicking "Review" restores them.
15. Bottom-bar keycaps clickable; `⌘G notes` opens the session drawer on click, same as pressing `⌘G`.
16. SAVED LED chip shows green dot when autosave is idle or saved; dims when saving.

- [ ] **Step 3: Report drift.**

Any item that fails → fix in the smallest possible token/primitive/composition change (token → primitive → composition order). Commit individually. Repeat checkpoint.

### Task F3: Update IMPLEMENTATION_NOTE.md

**Files:**
- Modify: `docs/design/IMPLEMENTATION_NOTE.md`

- [ ] **Step 1: Append a "Polish pass" section.**

```markdown

---

## Polish pass — 2026-04-22

**Plan:** `docs/superpowers/plans/2026-04-22-v2-polish-pass.md`

### Landed
- Revision-mark tokens restored; insert shows green wash + green underline, delete shows red wash + red strikethrough.
- Rationale panel is now a flex sibling; overlap + text-wrap issues resolved.
- Duplicate right-side window controls removed; traffic lights are the sole min/max/close affordance.
- AnnotationColumn empty-state collapsed to single italic line.
- Keycaps clickable (dual affordance: keyboard or click).
- Breadcrumb is muted indicator text, non-interactive.
- Help modal (keyboard shortcuts) + Preferences panel (DialKit toggle) live; Sign Out removed.
- DialKit hidden by default; revealed via Preferences toggle or `VITE_DIALKIT=1`.
- ⌘⇧R toggles Rationale panel visibility.
- Manuscript tab enters distraction-free mode (editor full width, rail and rationale hidden).

### Known follow-ups
- Breadcrumb / `All drafts` / `Product Brief` have no real navigation destination yet — surface when a drafts index lands.
- Sign Out will need real auth later.
- Rationale drag-resize is still grip-only-visual; the min/max/close buttons supply the equivalent affordances for now.
- Preferences persists to `localStorage`; Tauri `fs`-backed storage is a follow-up when preferences grow.
- Undo keycap calls `document.execCommand('undo')`; replace with a proper Milkdown undo API call when exposed.
```

- [ ] **Step 2: Commit.**

```bash
git add docs/design/IMPLEMENTATION_NOTE.md
git commit -m "docs(design): polish-pass implementation note"
```

---

## Self-review checklist

- [ ] Every task ends with a `git commit`.
- [ ] Each code block is ready-to-paste; no `<TBD>` or `...existing...` inside code that needs to compile.
- [ ] All 9 locked decisions are reflected in at least one task.
- [ ] TDD skipped intentionally (visual port) — regression gate is the whole `check:*` suite.
- [ ] No new dependencies beyond what's already in `package.json`.
- [ ] Human checkpoints are explicit (Task A2, B7, F2) — subagents don't attempt `pnpm tauri dev`.
- [ ] Phase A (revision marks) can ship standalone and fix the worst user-visible regression even if B–F stall.

---

## Exit criteria

All six phases' checkpoints pass. The running app matches the Paper oracle within the tolerances noted in `IMPLEMENTATION_NOTE.md`. All `check:*` regression scripts green. The user can click every surface that looks clickable and get a response.
