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
