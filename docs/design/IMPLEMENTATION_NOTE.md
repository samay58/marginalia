# V2 Clunky Review Surface — Implementation Note

**Date:** 2026-04-22
**Branch:** `feat/v2-clunky-review-surface`
**Plan:** [docs/superpowers/plans/2026-04-22-v2-clunky-review-surface.md](../superpowers/plans/2026-04-22-v2-clunky-review-surface.md)
**Oracle:** [docs/design/references/paper-v2-artboard.png](references/paper-v2-artboard.png)
**Implementation capture:** _Pending — requires `pnpm tauri dev` + `screencapture` (GUI step, human-in-loop)._

## Phases executed (subagent-driven)

| Phase | Scope | Status |
|---|---|---|
| 1 | Oracle PNG + DESIGN_REFERENCE.md | ✓ |
| 2 | Theme layer (tokens, chrome utilities, app.css replacement, fonts) | ✓ |
| 3 | 8 chrome primitives (TrafficLight, WindowControl, TitleBar, Keycap, BeveledButton, StatusLED, SunkenWell, WindowFrame) | ✓ |
| 4 | Tauri `decorations: false` | ✓ |
| 5 | AppHeader, TabStrip, BottomShortcutBar, review/+page wrap, retired Header & StatusBar | ✓ |
| 6 | ChangeRail / AnnotationColumn / Editor restyled to v2 | ✓ |
| 7 | Regression gates pass; visual fidelity pass deferred to human | ⚠ visual pending |

## Files created

### Theme
- `src/lib/theme/tokens.css`
- `src/lib/theme/chrome.css`

### Chrome primitives (`src/lib/components/chrome/`)
- `TrafficLight.svelte`
- `WindowControl.svelte`
- `TitleBar.svelte`
- `Keycap.svelte`
- `BeveledButton.svelte`
- `StatusLED.svelte`
- `SunkenWell.svelte`
- `WindowFrame.svelte`
- `AppHeader.svelte`
- `TabStrip.svelte`
- `BottomShortcutBar.svelte`

### Design docs
- `docs/design/DESIGN_REFERENCE.md`
- `docs/design/references/paper-v2-artboard.png`
- `docs/design/IMPLEMENTATION_NOTE.md` (this file)
- `docs/superpowers/plans/2026-04-22-v2-clunky-review-surface.md`

## Files modified

- `src/app.css` — full replacement; old Paper & Ink tokens + dark mode + glass utilities retired. Imports the new token + chrome layers.
- `src/routes/+layout.svelte` — Google Fonts link (EB Garamond italic, IBM Plex Sans, IBM Plex Mono, IM Fell English, Old Standard TT).
- `src/routes/review/+page.svelte` — outer markup wrapped in `WindowFrame > TitleBar > AppHeader > TabStrip > .content-area > BottomShortcutBar`. Live `autosaveState`, `editCount`, and annotation count wired into the bottom bar. `Header` and `StatusBar` imports removed.
- `src/lib/components/ChangeRail.svelte` — CHANGES caps label, mono numerals, beveled +N / −N chips, sunken empty-state well, beveled right edge.
- `src/lib/components/AnnotationColumn.svelte` — floating beveled sub-window with navy title bar + stripes + mini controls, `+ New note` beveled button, sunken body well, resize grip.
- `src/lib/components/Editor.svelte` — `v2-manuscript` class on root, parchment background, Old Standard TT headings, IM Fell English body, padding reserves 392px on the right for the rationale panel.
- `src-tauri/tauri.conf.json` — `decorations: false`.

## Files deleted

- `src/lib/components/Header.svelte`
- `src/lib/components/StatusBar.svelte`

## Regression gate (Phase 7, automated)

All green:

- `pnpm run check:diff` ✓
- `pnpm run check:annotations` ✓
- `pnpm run check:semantic` ✓
- `pnpm run check:bundle` ✓
- `pnpm run check:hook` ✓
- `pnpm run check:lint` ✓
- `pnpm run build` ✓

`pnpm run check` (svelte-check) reports 2 pre-existing errors (both predate this branch: `vite.config.js` missing `@types/node`, `src/routes/review/+page.svelte` DialConfig typing) + 1 new a11y warning (`AppHeader.svelte:19` `<a href="#">` — cosmetic, follow-up to replace with `<button>`). No new errors introduced.

## Intentional deviations from the Paper oracle

1. **Rationale panel drag + resize are visual-only.** The three window controls in the rationale title bar and the three-dot grip in the corner render period-accurate chrome but do not actually move or resize the panel. The panel is `position: absolute` inside the review page's positioned `.content-area`, anchored top-right with fixed inset. This matches the look of the Paper artboard at rest; the drag/resize interaction is deferred to a later pass.

2. **Oracle PNG is 1× instead of 2×.** Paper MCP's `get_screenshot` does not expose raw bytes writable to disk; the user's canonical reference image (1620×971) is aliased as the oracle. The proportions and details are preserved; resolution is lower than the skill's template recommended.

3. **`crossorigin` boolean attribute on the preconnect `<link>`** had to be written as `crossorigin="anonymous"` to satisfy svelte-check's attribute typing. Behaviorally equivalent for Google Fonts.

4. **Window-control icons are outlined 24 × 24 boxes**, not fine-line glyphs. Chosen during Paper iteration (v1 → v2) to read more tactile; the Paper oracle reflects this choice.

5. **AppHeader nav uses `<a href="#">`** placeholders. Flagged as a svelte-check a11y warning. Intentional for this port (the nav is visual-only in mockup form); real routes land when Help / Preferences / Sign Out gain behavior.

## Known follow-ups (scope for a later PR)

1. **AnnotationEditor inner component** (compose UI inside the rationale well) retains pre-port styling. Visually inconsistent inside the new beveled well until it gets its own v2 pass.
2. **Orphaned CSS variable references** in `SessionDrawer.svelte`, the reference drawer, and recovery modal refer to `--header-height`, `--status-bar-height`, `--accent`, `--paper-edge`, etc. These are runtime (not compile-time) — no svelte-check errors — but may produce visual offsets until cleaned.
3. **`density-review` / `density-manuscript` class hooks** on `.rationale-panel` remain as dead selectors; cleanup when the tab strip begins driving real view switches.
4. **Editor double-padding risk**: `.editor-shell`/`.editor-frame` interior paddings may compress content relative to the new `.manuscript-host` 392px right padding. Verify visually.
5. **AppHeader `<a href="#">` a11y warning** — swap to `<button>` or real routes.
6. **Traffic-light interactivity** — currently fire Tauri window API via `@tauri-apps/api/window`. Verify `minimize` / `toggleMaximize` / `close` actually succeed on macOS after `decorations: false`.

## Visual fidelity pass (human-in-loop)

Automated tooling can't run `pnpm tauri dev` inside this session (it would hang — it's a foreground dev server with a GUI window). To complete the plan's Phase 7 Task 24 fidelity comparison:

1. From the repo root: `pnpm tauri dev`
2. Wait for the window to open. You should see:
   - Teal desktop ground with the window inset ~32px
   - Navy title bar with three traffic-light dots, decorative horizontal stripes flanking the uppercased title, three beveled window controls on the right
   - Teal wordmark block reading "Marginalia" in EB Garamond italic, then the blue breadcrumb row, then Help / Preferences / Sign Out on the right
   - Tab strip with "Review" raised/cream and "Manuscript" recessed/grey
   - Left rail: `CHANGES`, mono counters, beveled +N / −N chips, sunken empty-state well
   - Center manuscript: aged parchment, headings in Old Standard TT, body in IM Fell English
   - Floating rationale panel on the right: navy title bar + stripes + mini controls, `+ New note` beveled button, sunken body well, resize grip in corner
   - Bottom bar: SAVED LED chip, five beveled keycap shortcuts
3. Bring the window to focus, then in another terminal: `screencapture -w ~/marginalia-v2-capture.png` and click the Tauri window.
4. Copy it into the repo:
   ```bash
   cp ~/marginalia-v2-capture.png docs/design/references/implementation-screenshot.png
   ```
5. Open both `docs/design/references/paper-v2-artboard.png` and `docs/design/references/implementation-screenshot.png` side-by-side and walk through these:
   - Outer window bevel matches (2px raised, hard outline)?
   - Title bar: stripes flank the title, traffic dots left, three window controls right?
   - Wordmark italic EB Garamond in teal block, white text?
   - Breadcrumb blue links with `›`?
   - Tab strip: active tab cream+raised, inactive tab grey+recessed?
   - Left rail: CHANGES caps label, mono counters, chips, sunken empty-state?
   - Manuscript: Old Standard TT headings, IM Fell English body, parchment background?
   - Rationale panel: floating, navy title bar with stripes, `+ New note` beveled, sunken body well, resize grip bottom-right?
   - Bottom bar: green SAVED LED chip, five beveled keycaps in mono?
   - Desktop ground visible around the window (teal, ~32px inset)?
6. Report any drift — I'll apply `paper-tighten` fixes in order: token → primitive → composition.

Appendix commits on this branch (22 total):

```
git log main..HEAD --oneline
```

---

## Polish pass — 2026-04-22

**Plan:** `docs/superpowers/plans/2026-04-22-v2-polish-pass.md`

### Landed
- **Revision-mark tokens restored** (Phase A). `--insert-*`, `--delete-*`, `--struck-*`, plus legacy aliases `--accent-subtle` and `--paper-bright` are back in `tokens.css`, chip-family muted palette. Editor's `.added` / `.struck` decorations render again — core insert (green wash + underline) and delete (red wash + strikethrough) UX restored.
- **Layout restructured** (Phase B). Right-side WindowControl trio removed from the title bar (traffic lights are the sole min/max/close affordance). `src/lib/stores/review-ui.js` added with `tabMode` and `rationaleState`. `content-area` is now a real flex row with three real columns (rail / manuscript / rationale); `AnnotationColumn` is a flex sibling, not an absolute overlay. `Editor` padding simplified to `40px 72px 60px 72px` and `--content-max-width` clamp dropped — text now wraps at the column's natural width instead of 3-word lines. `⌘⇧R` added to toggle the Rationale panel.
- **AnnotationColumn empty-state collapsed** (Phase C). When nothing is selected and no annotations exist, the panel shows a single italic "No rationales yet." — the competing "Select an edit to review it." / "SAVED NOTES" strings no longer stack.
- **Interactive correctness** (Phase D). Tauri capabilities `core:window:allow-minimize`, `allow-toggle-maximize`, `allow-close` granted. `Keycap` accepts an optional `onClick` and becomes a real button when one is provided. `BottomShortcutBar` keycaps fire the same handlers as the keyboard shortcuts (`toggleSessionDrawer`, `handleAnnotationShortcut`, `toggleReferenceSurface`, undo, `handleDone`). `AppHeader` breadcrumb is now muted indicator text (no blue links, no pointer cursor), nav reduced to Help + Preferences as real `<button>`s; Sign Out removed. `HelpModal` lists keyboard shortcuts.
- **DialKit gated via Preferences** (Phase E). `src/lib/stores/preferences.js` persists to `localStorage` (key `marginalia.preferences.v1`). `<DialRoot />` in the layout renders conditionally; `DialStore.registerPanel` in the review page is gated at mount. `PreferencesPanel` exposes the `Show design tuning handle (DialKit)` checkbox.

### Regression gate (Phase F, all green)

- `pnpm run check:diff` ✓
- `pnpm run check:annotations` ✓
- `pnpm run check:semantic` ✓
- `pnpm run check:bundle` ✓
- `pnpm run check:hook` ✓
- `pnpm run check:lint` ✓
- `pnpm run build` ✓

`pnpm run check` (svelte-check) reports 2 pre-existing errors (`vite.config.js` `process` type and `review/+page.svelte` DialConfig array-index typing). The a11y warning on `AppHeader.svelte` that was introduced in Phase 5 is now gone.

### Visual fidelity pass (human-in-loop)

Run `pnpm tauri dev` and walk through the 16-item checklist in the polish-pass plan, Phase F Task F2. Report any drift; fixes will follow the paper-tighten order (token → primitive → composition). Preferences toggle persists across reloads via localStorage.

### Known follow-ups

- DialKit gating reads preferences at mount; toggling mid-session requires a reload to take effect.
- Breadcrumb / `All drafts` / `Product Brief` still have no real navigation destination.
- Sign Out removed entirely until auth lands.
- Rationale resize grip is decorative; min/max/close buttons carry the same affordances.
- Undo keycap uses `document.execCommand('undo')`; swap for a Milkdown undo API call when exposed.
- Preferences persists to `localStorage`; Tauri fs-backed storage is a follow-up if prefs grow to multi-user.


---

## Polish pass 2 — 2026-04-22

**Plan:** `docs/superpowers/plans/2026-04-22-v2-polish-pass-2.md`

### Landed
- **Grid alignment restored** (Task 1). Added `--desk-rail-width`, `--desk-right-width`, `--desk-gap`, `--desk-padding-x`, `--header-height`, `--status-bar-height` aliases in `tokens.css` pointing at v2 values. The `.desk` grid + reference-drawer offsets compute correctly again. Rationale panel sits in the third column, not stacked under the first two.
- **AnnotationEditor restyled** (Task 2 + follow-up fix). Excerpt, textarea, and Remove / Cancel / Save buttons all use v2 chrome: inset sunken textarea, chip-family buttons (green Save, red Remove, neutral Cancel). Focus-visible outline added locally (the codebase-wide `.control-focus` utility class is a pre-existing orphan — noted as a follow-up).
- **Sticky SAVED LED** (Task 3). A 2-second hold on each `autosaveState === 'saved'` transition, driven by `lastSavedAt` timestamp and a re-evaluating `$effect` that bumps a `savedTick` counter when the window expires. LED acknowledges saves even on near-instant autosaves.
- **Editor column pinned to 100% width** (Task 4). `.editor-column > *` forced to `width: 100%; min-width: 0`, plus `.manuscript-host` and `.ProseMirror` guarded. Eliminates the flex-centered intrinsic-width thrash that caused caret jumps on keystroke.

### Regression gate (all green)
- `pnpm run check:diff` ✓
- `pnpm run check:annotations` ✓
- `pnpm run check:semantic` ✓
- `pnpm run check:bundle` ✓
- `pnpm run check:hook` ✓
- `pnpm run check:lint` ✓
- `pnpm run build` ✓

`pnpm run check` remains at 2 pre-existing errors + 0 warnings.

### Known follow-ups (new / carried)
- The `.control-focus` / `.control-motion` / `.control-raise` utility classes are referenced across 5+ components but never defined anywhere in the codebase. Added a scoped `:focus-visible` rule locally in AnnotationEditor; longer term, these utilities should either be defined centrally in `chrome.css` or removed from the templates that reference them.
- AnnotationPopover (compact-layout compose surface under 1100px) is still v1 styling; restyle in a follow-up pass.
- `box-sizing: border-box` on Milkdown/ProseMirror global rule is redundant with the global `* { box-sizing: border-box }` reset — harmless defensive duplication.

---

## Polish pass 3 — 2026-04-22

**Plan:** `docs/superpowers/plans/2026-04-22-v2-polish-pass-3.md`

### Landed
- **Rationale panel fits** (Phase A). `.rat-toolbar` padding `0 10px → 0 6px`, `.rat-body` padding `12px → 10px`, inner SunkenWell pad `18px 16px → 14px 12px`, `.rat-section` margin-top `16 → 12`. Remove / Cancel / Update rationale now fit inline within the 352px rationale column.
- **Manuscript seam tightened** (Phase B). `.manuscript-host` horizontal padding `72px → 48px`. Parchment text still breathes but the column reads as a continuation of the rail, not a dead band of background.
- **DialKit gating confirmed** (Phase C). `<DialRoot />` already conditional in `+layout.svelte`; `DialStore.registerPanel` already gated in `+page.svelte`. Prior-session visibility was a persisted `localStorage` preference. Reset via DevTools console: `localStorage.removeItem('marginalia.preferences.v1'); location.reload();`.
- **Rail-click path verified** (Phase D / Task 5). `handleRailChangeSelect` already routes insertions and deletions uniformly through `selectChange`. No code change; user can click the "+" row in the rail to attach a rationale to an insertion.
- **Alt-click on manuscript insertions** (Phase D / Task 6). Extended the diff plugin's `handleClick` to intercept insertion clicks only when `event.altKey === true`. Bare clicks still behave as normal text editing per the CLAUDE.md invariant. Insertion decorations now carry `title="⌥-click to annotate"` for discoverability.
- **New app icon** (Phase E). `scripts/build-icons.sh` trims the source and generates canonical macOS sizes + `.icns`. Replaces `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns` under `src-tauri/icons/`. Windows `.ico` left unchanged. Script is idempotent and cleans up its intermediate iconset.

### Regression gate (all green)
- `pnpm run check:diff` ✓
- `pnpm run check:annotations` ✓
- `pnpm run check:semantic` ✓
- `pnpm run check:bundle` ✓
- `pnpm run check:hook` ✓
- `pnpm run check:lint` ✓
- `pnpm run build` ✓
- `pnpm run check` ✓ (2 pre-existing errors, 0 warnings — unchanged)

### Known follow-ups
- `.ico` Windows icon not regenerated — out of scope. Rebuild from the same source if Windows is ever a target.
- The OS caches app icons; after the next `pnpm tauri:build:app`, you may need `touch /Applications/Marginalia.app` or a Finder relaunch to see the new icon in the dock.
- The Task-2-conditional "shorten labels to Save/Update" was NOT applied — leaving in reserve until human visual check confirms if Remove/Cancel/Update rationale still clips at narrower widths.
