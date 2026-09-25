# V2 Polish Pass 3 — Rationale Fit, Column Unification, Insertion Select, App Icon

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Five cleanup tasks: (a) make the Rationale panel fit within its 352px column without cutoff on Remove / Cancel / Update rationale; (b) unify the rail↔manuscript seam so the parchment reads as a single column, not a gap; (c) guarantee the DialKit tuning handle is hidden by default; (d) give insertions a working, non-disruptive selection path for rationale attachment; (e) replace the macOS app icon with the new green-M-on-lined-paper design.

**Architecture:** Six phases, each single-file or narrow-scope. No feature work — polish, diagnosis, icon packaging. The insertion-selection fix uses `Alt/Option-click` on manuscript insertions (preserves the CLAUDE.md invariant that bare clicks behave as normal editing) + confirms the rail-click path already works.

**Locked decisions (from AskUserQuestion):**
1. Column issues — all three: rationale fit (biggest), rail/manuscript gap, DialKit handle visible.
2. Insertion rationale path — user picked "clicked the green inserted text directly." CLAUDE.md invariant says bare clicks on insertions stay as editing. Resolve by adding **Alt/Option-click** override on manuscript insertions + verifying rail-click route.
3. Rationale cutoff — tighten padding; keep three-button row on one line.

**Tech Stack:** SvelteKit 5, existing v2 token system, Tauri 2. Icon pipeline uses built-in `iconutil`, `sips`, and ImageMagick `magick` (all verified present on host).

**Source material:**
- User screenshots: 2026-04-22 15:46–15:47, four captures.
- Icon source: `docs/design/references/marginalia-icon-source.png` (1024×1024 RGBA, already saved).
- Prior plans: `docs/superpowers/plans/2026-04-22-v2-clunky-review-surface.md`, `…-polish-pass.md`, `…-polish-pass-2.md`.

**Non-goals:**
- No new features.
- No change to CLAUDE.md's "bare click on insertion = normal editing" invariant — the Option-click route is additive.
- No `.ico` file for Windows — macOS-only bundle (keep the existing `icon.ico` unchanged).
- No dark-mode icon variant.

**Execution discipline:**
- Continue on branch `feat/v2-clunky-review-surface`.
- Commit per task. Conventional commits.
- Each code-touching task ends with `pnpm run check` (baseline: 2 pre-existing errors, 0 warnings).
- Phase F runs the full regression suite + `pnpm run build`.
- Visual checkpoints are human-in-loop (`pnpm tauri dev`).

---

## File Structure

### Modified
- `src/lib/components/AnnotationColumn.svelte` — tighten `.rat-toolbar`, `.rat-body`, `.rat-feature`, `.rat-section` padding; reduce SunkenWell pad; shorten "Update rationale" and "Save rationale" button labels if still tight.
- `src/lib/components/AnnotationEditor.svelte` — rename `saveLabel` defaults via prop defaults; not touching file (parent already passes the right label).
- `src/lib/components/Editor.svelte` — reduce `.manuscript-host` left-padding from `72px` to `48px` to tighten the visual rail-to-text distance; add a hover-affordance outline on `.added` insertions hinting at Alt-click.
- `src/lib/utils/milkdown-diff-plugin.js` — extend the existing `.added` decoration click handling to fire `onClickChange` when the event's `altKey` is true.
- `src/routes/review/+page.svelte` — wire `handleEditorChangeClick` to accept insertions (currently may short-circuit on type === 'insertion') and route to `selectChange` with the popover/rail flow; verify rail-click route still works for insertions.
- `src-tauri/icons/32x32.png` — regenerated from new source.
- `src-tauri/icons/128x128.png` — regenerated.
- `src-tauri/icons/128x128@2x.png` — regenerated (= 256×256).
- `src-tauri/icons/icon.icns` — regenerated via `iconutil` from an `.iconset` folder.

### Created
- `scripts/build-icons.sh` — a small, idempotent shell script that trims the source PNG, generates an `.iconset/` directory at Apple's canonical resolutions, and compiles `.icns`. One-shot artefact generator; checked into the repo so the icon can be rebuilt from source later.
- `src-tauri/icons/icon.iconset/` — intermediate output of the build script (small, fine to commit for reproducibility).

### Untouched
- `src-tauri/icons/icon.ico` (Windows icon — keep existing; out of scope).
- Store, diff engine, annotation resolver, bundle generator, Rust code, `scripts/check-*.mjs`.

---

## Phase A — Rationale panel fit (P0)

### Task 1: Tighten Rationale panel inner padding so three-button row fits

**Files:**
- Modify: `src/lib/components/AnnotationColumn.svelte`

Context: at column width 352px, the compose toolbar shows Remove + Cancel + Update rationale. Current paddings (toolbar `0 10px`, body `12px`, SunkenWell `18px 16px`) leave the third button clipped on the right. Trim paddings symmetrically and keep one-line layout.

- [ ] **Step 1: Inspect current padding values to ground your edits**

Run: `sed -n '260,300p' src/lib/components/AnnotationColumn.svelte`
Confirm: `.rat-toolbar` has `padding: 0 10px`, `.rat-body` has `padding: 12px`.

- [ ] **Step 2: Reduce `.rat-toolbar` horizontal padding to `0 6px`**

Find:
```css
  .rat-toolbar {
    display: flex;
    justify-content: flex-end;
    height: 42px;
    padding: 0 10px;
```
Change `padding: 0 10px;` → `padding: 0 6px;`.

- [ ] **Step 3: Reduce `.rat-body` padding to `10px`**

Find:
```css
  .rat-body {
    flex: 1;
    padding: 12px;
```
Change `padding: 12px;` → `padding: 10px;`.

- [ ] **Step 4: Reduce the SunkenWell pad override in the template**

Find the `<SunkenWell pad="18px 16px">` line in the template. Change `pad="18px 16px"` → `pad="14px 12px"`.

- [ ] **Step 5: Reduce `.rat-section` and `.rat-feature` internal gap**

Find `.rat-section { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }`. Change `margin-top: 16px` → `margin-top: 12px`. Leave `.rat-feature` alone.

- [ ] **Step 6: Run svelte-check**

Run: `pnpm run check`
Expected: `svelte-check found 2 errors and 0 warnings in 2 files` (baseline, unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AnnotationColumn.svelte
git commit -m "style(rationale): tighten panel padding so Remove/Cancel/Update rationale fit inline"
```

- [ ] **Step 8: Human visual checkpoint**

Run `pnpm tauri dev`, open a draft with at least one edit, click "+ New note" for the deletion, click Edit rationale on the saved note. Verify the three-button row (Remove, Cancel, Update rationale) fits inline with no right-edge clipping.

### Task 2: Shorten button labels if Task 1 still leaves them tight

**Files:**
- Modify (conditional): `src/lib/components/AnnotationColumn.svelte`

Condition: Task 1 visual check still shows clipping on "Update rationale."

- [ ] **Step 1: If clipping remains, change the `saveLabel` passed to AnnotationEditor**

Find the `<AnnotationEditor ... saveLabel={selectedAnnotationEntry ? 'Update rationale' : 'Save rationale'} />` line. Change the two label strings to `'Update'` and `'Save'` respectively.

```svelte
  saveLabel={selectedAnnotationEntry ? 'Update' : 'Save'}
```

- [ ] **Step 2: Run svelte-check**

Run: `pnpm run check`
Expected: baseline (2 errors, 0 warnings).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/AnnotationColumn.svelte
git commit -m "style(rationale): shorten save-button labels to Save/Update for tighter column fit"
```

- [ ] **Step 4: Human visual checkpoint again**

If still tight after this, re-open the plan — layout change beyond padding.

---

## Phase B — Rail/Manuscript seam

### Task 3: Reduce `.manuscript-host` left padding from 72px to 48px

**Files:**
- Modify: `src/lib/components/Editor.svelte`

Context: the manuscript-host's 72px left padding creates visible parchment space between the rail's right border and the text column, which reads as a "gap" rather than a continuation. 48px still gives readable text margin while tightening the visual seam.

- [ ] **Step 1: Inspect current rule**

Run: `sed -n '508,525p' src/lib/components/Editor.svelte`

- [ ] **Step 2: Edit `.manuscript-host` padding**

Find:
```css
  .manuscript-host {
    flex: 1;
    width: 100%;
    min-width: 0;
    background: var(--paper);
    border-left: 1px solid var(--chrome-shadow);
    box-shadow: inset 1px 0 0 var(--chrome-highlight);
    padding: 40px 72px 60px 72px;
    overflow-y: auto;
    overflow-x: hidden;
  }
```
Change `padding: 40px 72px 60px 72px;` → `padding: 40px 48px 60px 48px;`.

- [ ] **Step 3: Run svelte-check**

Run: `pnpm run check`
Expected: baseline.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Editor.svelte
git commit -m "style(editor): tighten manuscript-host horizontal padding for cleaner rail-to-text seam"
```

- [ ] **Step 5: Human visual checkpoint**

Run `pnpm tauri dev`. Confirm the visible parchment-color strip between the rail's dark seam and the text body is noticeably smaller, text still breathes, lines wrap naturally.

---

## Phase C — DialKit hidden by default

### Task 4: Verify gating and reset persisted preference

**Files:**
- No source changes (verification + localStorage reset).

Context: `<DialRoot />` is already conditionally rendered in `src/routes/+layout.svelte` behind `{#if showDialkit}` where `showDialkit = VITE_DIALKIT || $preferences.showDialkitHandle`. `DialStore.registerPanel` in `src/routes/review/+page.svelte` is also gated. If the handle is visible on first load, someone toggled the localStorage preference on (or set VITE_DIALKIT=1).

- [ ] **Step 1: Confirm gating is wired correctly**

Run: `grep -n "DialRoot\|showDialkit\|VITE_DIALKIT\|preferences" src/routes/+layout.svelte`
Expected: `showDialkit = $derived(VITE_DIALKIT || $preferences.showDialkitHandle);` and `{#if showDialkit} <DialRoot /> {/if}`.

Run: `grep -n "dialkitEnabled" src/routes/review/+page.svelte`
Expected: `const dialkitEnabled = import.meta.env.VITE_DIALKIT === '1' || get(preferences).showDialkitHandle;` followed by guarded `DialStore.registerPanel(...)`.

If both guards are present, gating is correct. The current visibility in the user's running app is from a persisted `true` in localStorage.

- [ ] **Step 2: Reset the persisted preference during dev for the human**

Tell the human operator: in the running Tauri webview, open DevTools (`Cmd+Option+I`), go to the Application → Local Storage → `tauri://localhost` (or similar), and delete the `marginalia.preferences.v1` key. Or run this in the DevTools console:

```js
localStorage.removeItem('marginalia.preferences.v1'); location.reload();
```

After reload, the handle should disappear. Toggling "Show design tuning handle" in Preferences re-shows it.

- [ ] **Step 3: No commit** — verification-only.

---

## Phase D — Insertion selection path

### Task 5: Confirm the rail-click path already fires selectChange for insertions

**Files:**
- No code changes (audit only).

Context: user tried clicking the green insertion in the manuscript. Bare click doesn't select insertions (by design — see CLAUDE.md). The rail row for an insertion should fire `onSelectChange(change)` via `handleSelect`. Verify.

- [ ] **Step 1: Inspect the rail handler**

Run: `sed -n '65,85p' src/lib/components/ChangeRail.svelte`
Confirm `handleSelect` calls `onSelectChange(change, rect.right + 8, rect.top)` regardless of `change.type`.

- [ ] **Step 2: Trace the parent wiring**

Run: `grep -n "onSelectChange\|handleRailChangeSelect\|selectChange(" src/routes/review/+page.svelte | head -20`
Confirm: `<ChangeRail onSelectChange={handleRailChangeSelect} />` and `handleRailChangeSelect` calls `selectChange(change, { openPopover: compactLayout })` without filtering by change type.

If both hold, the rail path works. If not, a follow-up bug fix is needed — escalate.

- [ ] **Step 3: No commit** — verification-only. Report findings.

### Task 6: Add Alt-click affordance on manuscript insertions

**Files:**
- Modify: `src/lib/utils/milkdown-diff-plugin.js` — extend the `.added` decoration so its click handler selects the change *only* when `event.altKey` is true; otherwise bubble normally (preserves the CLAUDE.md editing invariant for bare clicks).
- Modify: `src/lib/components/Editor.svelte` — add a subtle hover hint on `.added` that communicates "⌥-click to annotate" via a `title` attribute.

Context: the Milkdown diff plugin builds Prosemirror `Decoration.inline` for insertions. Some of its existing handlers already attach data attributes. We want to intercept clicks where `altKey` is true and route them to the Editor's `onClickChange` prop.

- [ ] **Step 1: Inspect the current `.added` decoration**

Run: `sed -n '85,120p' src/lib/utils/milkdown-diff-plugin.js`
Confirm the `Decoration.inline(docPos, endPos, { class: ..., 'data-change-id': change.id, 'data-change-text': change.text, 'data-change-type': 'insertion' })` call exists.

- [ ] **Step 2: Locate where `.added` clicks are already handled (if anywhere)**

Run: `grep -n "onClickChange\|data-change-type\|handleEditorChangeClick" src/lib/components/Editor.svelte src/lib/utils/milkdown-diff-plugin.js | head -20`

Most likely the Editor binds a click handler on its root that reads `data-change-id` + `data-change-type` from `event.target.closest('[data-change-id]')` and calls `onClickChange` — with a branch that short-circuits for `insertion`.

- [ ] **Step 3: Extend the Editor's manuscript click handler to allow Alt-click on insertions**

Find the click handler in `src/lib/components/Editor.svelte`. Locate the branch that early-returns for insertions (something like `if (type === 'insertion') return;`). Change it to:

```js
if (type === 'insertion' && !event.altKey) return;
```

Keep the rest of the handler — it will now fire `onClickChange(change, event.clientX, event.clientY)` for `alt+click` on insertions.

- [ ] **Step 4: Add a `title` attribute to the decoration for discoverability**

In `src/lib/utils/milkdown-diff-plugin.js`, extend the `Decoration.inline` call for insertions to include `title: '⌥-click to annotate'`. The full attribute object becomes:

```js
Decoration.inline(docPos, endPos, {
  class: selectedChangeId === change.id ? 'added selected' : 'added',
  'data-change-id': change.id,
  'data-change-text': change.text,
  'data-change-type': 'insertion',
  title: '⌥-click to annotate',
})
```

- [ ] **Step 5: Run svelte-check**

Run: `pnpm run check`
Expected: baseline (2 errors, 0 warnings).

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/milkdown-diff-plugin.js src/lib/components/Editor.svelte
git commit -m "feat(editor): Alt-click on manuscript insertions selects the change for rationale"
```

- [ ] **Step 7: Human visual checkpoint**

Run `pnpm tauri dev`. Add a text insertion in the manuscript. Hover the green-wash addition — tooltip shows "⌥-click to annotate." Bare click → cursor places in the text. `Option-click` → the Rationale panel selects the insertion and shows its excerpt. Clicking "+ New note" then composing saves the rationale against the insertion.

---

## Phase E — App icon replacement

### Task 7: Write `scripts/build-icons.sh`

**Files:**
- Create: `scripts/build-icons.sh`

Context: one reusable script so the icon can be rebuilt from source later. Trims the source's transparent margin, produces canonical sizes, compiles `.icns`.

- [ ] **Step 1: Create the script**

Write this exact content:

```bash
#!/usr/bin/env bash
set -euo pipefail

# build-icons.sh — regenerate Marginalia's macOS icon assets from
# docs/design/references/marginalia-icon-source.png.
#
# Output:
#   src-tauri/icons/32x32.png
#   src-tauri/icons/128x128.png
#   src-tauri/icons/128x128@2x.png       (= 256×256)
#   src-tauri/icons/icon.icns            (compiled via iconutil)
#
# Requires: ImageMagick (magick), iconutil, sips — all stock on macOS dev boxes.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/design/references/marginalia-icon-source.png"
OUT_DIR="$ROOT/src-tauri/icons"
ICONSET="$OUT_DIR/icon.iconset"

if [ ! -f "$SRC" ]; then
  echo "error: source image not found at $SRC" >&2
  exit 1
fi

for cmd in magick iconutil sips; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required tool '$cmd' is not on PATH" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR" "$ICONSET"

TRIMMED="$OUT_DIR/.source-trimmed.png"
magick "$SRC" -trim +repage -resize 1024x1024 -background none -gravity center -extent 1024x1024 "$TRIMMED"

# Canonical Apple iconset sizes
magick "$TRIMMED" -resize 16x16      "$ICONSET/icon_16x16.png"
magick "$TRIMMED" -resize 32x32      "$ICONSET/icon_16x16@2x.png"
magick "$TRIMMED" -resize 32x32      "$ICONSET/icon_32x32.png"
magick "$TRIMMED" -resize 64x64      "$ICONSET/icon_32x32@2x.png"
magick "$TRIMMED" -resize 128x128    "$ICONSET/icon_128x128.png"
magick "$TRIMMED" -resize 256x256    "$ICONSET/icon_128x128@2x.png"
magick "$TRIMMED" -resize 256x256    "$ICONSET/icon_256x256.png"
magick "$TRIMMED" -resize 512x512    "$ICONSET/icon_256x256@2x.png"
magick "$TRIMMED" -resize 512x512    "$ICONSET/icon_512x512.png"
magick "$TRIMMED" -resize 1024x1024  "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o "$OUT_DIR/icon.icns"

# Tauri-specific PNG outputs referenced by tauri.conf.json
cp "$ICONSET/icon_32x32.png"        "$OUT_DIR/32x32.png"
cp "$ICONSET/icon_128x128.png"      "$OUT_DIR/128x128.png"
cp "$ICONSET/icon_128x128@2x.png"   "$OUT_DIR/128x128@2x.png"

rm -f "$TRIMMED"

echo "ok: icon assets regenerated under $OUT_DIR"
```

Then make it executable:

```bash
chmod +x scripts/build-icons.sh
```

- [ ] **Step 2: Commit**

```bash
git add scripts/build-icons.sh
git commit -m "chore(icons): add build-icons.sh for idempotent Marginalia icon generation"
```

### Task 8: Run the script and commit the generated assets

**Files:**
- Modify (regenerated): `src-tauri/icons/32x32.png`, `src-tauri/icons/128x128.png`, `src-tauri/icons/128x128@2x.png`, `src-tauri/icons/icon.icns`
- Create: `src-tauri/icons/icon.iconset/*.png` (10 files)

- [ ] **Step 1: Back up the existing `icon.icns` before overwriting (for diff)**

Run: `cp src-tauri/icons/icon.icns /tmp/marginalia-icon.before.icns`

- [ ] **Step 2: Execute the script**

Run: `./scripts/build-icons.sh`
Expected output: `ok: icon assets regenerated under /Users/samaydhawan/Projects/active/marginalia/src-tauri/icons`.

- [ ] **Step 3: Verify output dimensions**

Run:
```bash
for f in src-tauri/icons/32x32.png src-tauri/icons/128x128.png src-tauri/icons/128x128@2x.png; do
  sips -g pixelWidth -g pixelHeight "$f" 2>&1 | tail -3
done
```
Expected: 32×32, 128×128, 256×256 respectively.

Run:
```bash
file src-tauri/icons/icon.icns
```
Expected: `Mac OS X icon`.

- [ ] **Step 4: Open the .icns in Finder to visually confirm**

Run: `open src-tauri/icons/icon.icns`
Preview.app should show the icon at multiple sizes. Confirm the green M + lined paper + folded corner are visible and legible even at 32×32.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/icons/
git commit -m "chore(icons): regenerate macOS app icon from new source design"
```

### Task 9: Confirm Tauri bundle picks up the new icons

**Files:**
- No source changes; verification of `tauri.conf.json` references.

- [ ] **Step 1: Re-read the `icon` array in `src-tauri/tauri.conf.json`**

Run: `grep -A 6 '"icon":' src-tauri/tauri.conf.json`
Expected: the five entries `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`. All are already correct; no changes needed.

- [ ] **Step 2: Dry-run build**

Run: `pnpm run build` (frontend only — quick sanity) and optionally `pnpm tauri:build:app` if time permits (a full .app bundle takes a few minutes). The app bundle step is optional at plan-execution time; the human can verify on the next release build.

- [ ] **Step 3: No commit.**

---

## Phase F — Regression gate + implementation note

### Task 10: Run the full check suite

**Files:** None.

- [ ] **Step 1: Full gate**

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

Expected: all green. `pnpm run check` holds at baseline (2 errors, 0 warnings).

- [ ] **Step 2: No commit** for verification.

### Task 11: Append polish-pass-3 block to IMPLEMENTATION_NOTE.md

**Files:**
- Modify: `docs/design/IMPLEMENTATION_NOTE.md`

- [ ] **Step 1: Append**

Append this block to the end of the file:

```markdown

---

## Polish pass 3 — 2026-04-22

**Plan:** `docs/superpowers/plans/2026-04-22-v2-polish-pass-3.md`

### Landed
- **Rationale panel fits** (Phase A). Toolbar pad `0 10px → 0 6px`, body pad `12px → 10px`, SunkenWell pad `18px 16px → 14px 12px`, section margin-top `16 → 12`. Remove / Cancel / Update rationale sit on a single row with no right-edge clipping. If still tight on narrower windows, labels shortened to Save / Update.
- **Manuscript seam tightened** (Phase B). `.manuscript-host` horizontal padding dropped from 72px to 48px. Parchment still breathes; the column reads as a continuation of the window body rather than a band of dead space.
- **DialKit hidden confirmed** (Phase C). Gating in `+layout.svelte` and `+page.svelte` already correct; prior-session visibility was a persisted `localStorage` preference. Documented localStorage reset procedure for human operators; no source changes.
- **Alt-click on insertions** (Phase D). Rail-click path confirmed working; added `event.altKey`-gated manuscript click on `.added` decorations that routes to `onClickChange`. Decorations carry a `title="⌥-click to annotate"` tooltip for discoverability. Bare click still behaves as normal editing per the CLAUDE.md invariant.
- **New app icon** (Phase E). `scripts/build-icons.sh` trims the source and generates canonical macOS sizes + an `.icns`. Replaces `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns` under `src-tauri/icons/`. Windows `.ico` left unchanged.

### Regression gate (all green)
- `pnpm run check:diff` ✓
- `pnpm run check:annotations` ✓
- `pnpm run check:semantic` ✓
- `pnpm run check:bundle` ✓
- `pnpm run check:hook` ✓
- `pnpm run check:lint` ✓
- `pnpm run build` ✓

### Known follow-ups
- `.ico` Windows icon not regenerated — out of scope for this macOS-only pass. Regenerate from the same source if a Windows target is added.
- Note card label truncation (NOTE 1 L…) in the saved-notes list can still clip on narrow columns; reserve for a later pass if visible after the Phase A fit fix.
- AnnotationPopover (compact-layout compose surface) still v1 styling.
```

- [ ] **Step 2: Commit**

```bash
git add docs/design/IMPLEMENTATION_NOTE.md
git commit -m "docs(design): polish-pass-3 implementation note"
```

### Task 12: Final human fidelity checkpoint

**Files:** None.

- [ ] **Step 1: Run `pnpm tauri dev` and walk through this list:**

1. Rationale panel: Remove / Cancel / Update rationale fit inline.
2. Rail / manuscript seam is tighter; parchment isn't showing a wide dead band to the left of the text.
3. DialKit handle is hidden; only appears after enabling in Preferences.
4. `⌥-click` on a green inserted word selects it for rationale; bare click puts the caret in the text normally.
5. App icon in the dock shows the green M with lined paper. Quit and relaunch — OS caches icons, may require re-bundling or a Finder cache clear (`touch /Applications/Marginalia.app` after a bundled build).

Report any drift; open polish-pass-4 if required.

---

## Self-review

- [ ] Every code-touching task ends with `git commit`. Verification tasks end without commit (explicitly stated).
- [ ] All four user-selected layout issues (rationale fit, rail/manuscript gap, DialKit, insertion-rationale) plus the new icon ask are reflected in at least one task.
- [ ] No placeholders. Every code/CSS/Bash block is ready to paste.
- [ ] Type consistency: `showDialkit`, `dialkitEnabled`, `selectedChange`, `onClickChange`, `handleRailChangeSelect` refer to existing symbols; no invented names.
- [ ] Phase A can ship independently (the most user-visible fit issue).
- [ ] Phase E script is idempotent — rerunnable safely if the source is updated.
- [ ] Alt-click change is additive — CLAUDE.md's "bare click = editing" invariant remains intact.

---

## Exit criteria

All six phases green. Automated regression clean. Running app confirms: rationale buttons fit, parchment column feels unified, DialKit hidden, ⌥-click works, app icon replaced in the dock (after next bundle).
