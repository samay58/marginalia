# V2 Clunky Old-School Review Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Paper v2 "clunky old-school" Marginalia design (navy chrome, beveled panels, editorial serif manuscript, keycap shortcut bar) into the existing Tauri/SvelteKit review surface, macOS only, replacing the current Paper & Ink token system.

**Architecture:** Extract a locked token system from the Paper v2 artboard into `docs/design/DESIGN_REFERENCE.md`, materialize it as CSS custom properties in a new theme layer, build a small set of reusable chrome primitives (window frame, title bar, traffic lights, window controls, keycaps, beveled buttons, sunken wells, status LED), reconfigure the Tauri window to draw its own chrome, then recompose `src/routes/review/+page.svelte` and restyle the existing panel components (`ChangeRail`, `AnnotationColumn`, `Editor`, `StatusBar`, `Header`) in terms of the new primitives and tokens.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), Tauri 2, existing `diff-match-patch` + `Milkdown` stack untouched; Google Fonts for EB Garamond, IM Fell English, Old Standard TT, IBM Plex Sans, IBM Plex Mono.

**Visual oracle:** Paper artboard node id `34-0` ("Marginalia – Draft Review (nostalgic)" clone) in the `marginalia_experiment` Paper file. Reference PNG saved at `docs/design/references/nostalgic-desktop-target.png`.

**Non-goals:**
- No new review features, no behavior changes, no data-model changes.
- No iOS or Windows build — macOS only.
- No dark mode (design is light-mode only).
- No logic changes to `src/lib/stores/app.js`, `src/lib/utils/*`, or any `scripts/check-*.mjs`.

**Execution discipline:**
- TDD does not cleanly apply — this is a styling port. Each task has a **visual verification step**: run `pnpm tauri dev`, load the review surface, compare to Paper v2. The existing `pnpm run check:*` suite is a **regression gate** at the end of each phase — any failure means the styling PR broke content behavior and must be fixed before proceeding.
- Commit after every task. Conventional commits (`feat:`, `refactor:`, `style:`).
- The Paper MCP tool (`mcp__paper__*`) is used inline for token extraction in Phase 1; if running in a Codex or non-Paper-enabled runtime, the engineer falls back to the saved PNG and the deviation must be logged.

---

## File Structure

### Created

- `docs/superpowers/plans/2026-04-22-v2-clunky-review-surface.md` — this plan
- `docs/design/DESIGN_REFERENCE.md` — locked token inventory + artboard map
- `docs/design/references/nostalgic-desktop-target.png` — already saved from the user's reference image
- `docs/design/references/paper-v2-artboard.png` — scale=2 oracle export of node 34-0
- `docs/design/IMPLEMENTATION_NOTE.md` — post-port notes, deviations, reuse decisions
- `src/lib/theme/tokens.css` — CSS custom properties (colors, type, spacing, bevels)
- `src/lib/theme/chrome.css` — bevel utility classes, typographic base, scrollbar styling
- `src/lib/components/chrome/WindowFrame.svelte` — outer beveled window container
- `src/lib/components/chrome/TitleBar.svelte` — navy title bar with stripes + traffic lights + window controls
- `src/lib/components/chrome/TrafficLight.svelte` — R/Y/B beveled dot
- `src/lib/components/chrome/WindowControl.svelte` — min/max/close beveled glyph button
- `src/lib/components/chrome/Keycap.svelte` — beveled keycap with mono glyph + label
- `src/lib/components/chrome/BeveledButton.svelte` — general raised button
- `src/lib/components/chrome/StatusLED.svelte` — colored LED dot + mono label
- `src/lib/components/chrome/SunkenWell.svelte` — inset container for readouts/empty states
- `src/lib/components/chrome/AppHeader.svelte` — wordmark block + breadcrumb + right-side nav
- `src/lib/components/chrome/TabStrip.svelte` — chunky folder tabs (Review / Manuscript)
- `src/lib/components/chrome/BottomShortcutBar.svelte` — SAVED LED + keycap row

### Modified

- `src/app.css` — strip the old Paper & Ink tokens, import the new theme layer, remove dark mode, remove glass utilities.
- `src/routes/+layout.svelte` — inject font `<link>` tags via `<svelte:head>` (if not already loading Google Fonts).
- `src/routes/review/+page.svelte` — wrap existing content tree in `WindowFrame`, `TitleBar`, `AppHeader`, `TabStrip`, `BottomShortcutBar`; replace references to `Header.svelte` and `StatusBar.svelte`.
- `src/lib/components/ChangeRail.svelte` — retheme to v2 rail style (CHANGES caps label, mono numerals, beveled chips, sunken well for empty state).
- `src/lib/components/AnnotationColumn.svelte` — retheme to the v2 Rationale sub-window (beveled frame, stripe-decorated title bar, beveled `+ New note`, sunken body well, resize grip).
- `src/lib/components/Editor.svelte` — retheme manuscript typography (Old Standard TT headings, IM Fell English body, paper background).
- `src-tauri/tauri.conf.json` — `decorations: false`, keep `titleBarStyle: "Overlay"`, hidden title.

### Retired / Replaced

- `src/lib/components/Header.svelte` — replaced by `chrome/AppHeader.svelte`; delete at end of Phase 5.
- `src/lib/components/StatusBar.svelte` — replaced by `chrome/BottomShortcutBar.svelte`; delete at end of Phase 5.

### Untouched

- `src/lib/stores/app.js`, `src/lib/utils/**`, `src/lib/components/AnnotationEditor.svelte`, `AnnotationPopover.svelte`, `ReferencePane.svelte`, `SessionDrawer.svelte`, Rust code in `src-tauri/src/`, all `scripts/check-*.mjs`.

---

## Phase 1 — Extract the design system

### Task 1: Save the Paper v2 oracle screenshot

**Files:**
- Create: `docs/design/references/paper-v2-artboard.png`

- [ ] **Step 1: Export artboard 34-0 from Paper at scale=2**

In a Paper-enabled session, call `mcp__paper__get_screenshot` with `{ nodeId: "34-0", scale: 2 }`. Save the returned PNG to `docs/design/references/paper-v2-artboard.png` using the Write tool (base64-decode if needed). If Paper is unavailable, use `docs/design/references/nostalgic-desktop-target.png` as a stand-in and log this as an intentional deviation in Task 28.

- [ ] **Step 2: Verify the file exists and is a valid PNG**

Run: `file docs/design/references/paper-v2-artboard.png`
Expected output contains: `PNG image data`

- [ ] **Step 3: Commit**

```bash
git add docs/design/references/paper-v2-artboard.png
git commit -m "docs(design): add Paper v2 artboard scale-2 oracle screenshot"
```

### Task 2: Write DESIGN_REFERENCE.md with the full token inventory

**Files:**
- Create: `docs/design/DESIGN_REFERENCE.md`

- [ ] **Step 1: In a Paper-enabled session, fetch computed styles for the key nodes**

Call `mcp__paper__get_computed_styles` with:
```
nodeIds: [
  "35-0",    // Window outer
  "5O-0",    // TitleBar
  "5M-0",    // Wordmark block
  "5N-0",    // Wordmark text (Marginalia)
  "59-0",    // AppHeader
  "54-0",    // TabStrip
  "57-0",    // TabReview (active)
  "55-0",    // TabManuscript (inactive)
  "4Q-0",    // ReviewRail
  "4R-0",    // Rail sunken well
  "4Y-0",    // Green +0 chip
  "4W-0",    // Red -0 chip
  "4B-0",    // ManuscriptPane
  "4P-0",    // Manuscript H1
  "4N-0",    // Manuscript H2
  "4M-0",    // Manuscript body
  "3Z-0",    // Rationale panel
  "6S-0",    // Rationale titlebar (rebuilt)
  "40-0",    // Rationale sunken body well
  "36-0",    // BottomBar
  "7L-0",    // SAVED chip
  "7O-0"     // Keycap sample (⌘ G)
]
```

- [ ] **Step 2: Write the design reference document**

Write this exact content to `docs/design/DESIGN_REFERENCE.md` (token values below are the final locked values already extracted during the Paper build; if any computed-style value disagrees, update this file in the same commit and note the correction):

````markdown
# Marginalia v2 Design Reference

**Status:** Locked. The only place to change a token is here. Downstream code references tokens by name, never inline hex.

**Paper source:** `marginalia_experiment` file, page `1-0`, artboard `34-0` ("Marginalia – Draft Review (nostalgic)"). Visual oracle: `docs/design/references/paper-v2-artboard.png` (scale=2 export).

## Paper artboard map

| Node ID | Semantic name | Notes |
|---|---|---|
| 34-0 | Artboard root (desktop ground) | 1440×900, `#2E6E65` |
| 35-0 | Window frame | Outer beveled container |
| 5O-0 | Title bar | Navy, 50px, 2px bottom border |
| 5Y-0 | Traffic-light cluster | Three 16px dots |
| 61-0 / 60-0 / 5Z-0 | Red / Yellow / Blue dots | |
| 5W-0 | Title center (stripes + label) | Replaced by frame 62-0 |
| 5P-0 | Window controls cluster | Replaced by frame 6L-0 |
| 59-0 | App header | 58px, off-white body, beveled bottom |
| 5M-0 | Wordmark block | Teal, 212px wide |
| 5N-0 | Wordmark text | EB Garamond 700 italic, 28px |
| 5G-0 | Breadcrumb row | |
| 5A-0 | Header nav | Help / Prefs / Sign Out |
| 54-0 | Tab strip | 38px, warm grey base |
| 57-0 | Review tab (active) | Raised bevel, cream fill |
| 55-0 | Manuscript tab (inactive) | Recessed bevel, grey fill |
| 3Y-0 | Content area | Three-pane container |
| 4Q-0 | Review rail | 244px, beveled right edge |
| 52-0 | "CHANGES" label | |
| 4U-0 | Changes summary row | |
| 4Y-0 | Green `+0` chip | |
| 4W-0 | Red `−0` chip | |
| 4R-0 | Rail empty-state well | Sunken |
| 4B-0 | Manuscript pane | Aged parchment |
| 4O-0 / 4L-0 / 4I-0 / 4F-0 / 4C-0 | H1 + 4 section blocks | |
| 3Z-0 | Rationale panel | Floating, beveled |
| 6S-0 | Rationale title bar | Navy, stripes |
| 42-0 | Rationale toolbar | `+ New note` strip |
| 40-0 | Rationale body well | Sunken |
| 78-0 | Resize grip | Bottom-right dots |
| 36-0 | Bottom bar | 50px, SAVED + keycaps |
| 7L-0 | SAVED LED chip | Green well |
| 7O-0 / 7S-0 / 7W-0 / 80-0 / 84-0 | Five shortcut keycaps | ⌘G / ⌘/ / ⌘⇧O / ⌘Z / Esc |

## Color tokens

| Token | Hex | Role |
|---|---|---|
| `--desktop-ground` | `#2E6E65` | Chalkboard teal outside the window |
| `--window-body` | `#E8E4D5` | Warm system grey, everything behind the chrome |
| `--paper` | `#ECE3C8` | Aged parchment (manuscript pane) |
| `--navy-chrome` | `#1B2B5E` | Title bar ground |
| `--navy-shadow` | `#0B1230` | Title-bar bottom rule + outer window outline |
| `--wordmark-teal` | `#1F7A6E` | Wordmark block |
| `--chrome-highlight` | `#F5F2E4` | Top-left bevel highlight |
| `--chrome-shadow` | `#6B6A62` | Bottom-right bevel shadow |
| `--deep-shadow` | `#1A1612` | Ink shadow / window outline |
| `--button-face` | `#C9C3B0` | Raised button / keycap fill |
| `--tab-inactive` | `#C9C3B0` | Inactive tab fill |
| `--ink` | `#1A1612` | Body text |
| `--muted` | `#5B5A55` | Secondary text |
| `--link` | `#1B3EAC` | Hyperlink blue |
| `--traffic-red` | `#E35145` | |
| `--traffic-yellow` | `#E0B137` | |
| `--traffic-blue` | `#3B6FCF` | |
| `--chip-green-bg` | `#CEE2C2` | +0 chip |
| `--chip-green-border` | `#3D6B4A` | |
| `--chip-green-text` | `#2B4E35` | |
| `--chip-red-bg` | `#E8C4C4` | −0 chip |
| `--chip-red-border` | `#8A3838` | |
| `--chip-red-text` | `#8A3838` | |
| `--led-green` | `#58A667` | SAVED LED body |
| `--led-highlight` | `#C7E8CB` | LED inner highlight |
| `--rationale-well-bg` | `#F5F2E4` | Sunken panel fill |

## Typography

Five families. Loaded from Google Fonts. All `font-display: swap`.

| Role | Family | Weight | Size | Line-height | Transform/tracking |
|---|---|---|---|---|---|
| Wordmark | EB Garamond | 700 italic | 28px | 32px | tracking -0.01em |
| Title bar | IBM Plex Sans | 700 | 14px | 14px | uppercase, tracking 0.02em |
| Rationale title | IBM Plex Sans | 700 | 12px | 12px | uppercase, tracking 0.08em |
| Tab (active) | IBM Plex Sans | 700 | 13px | 13px | — |
| Tab (inactive) | IBM Plex Sans | 500 | 12px | 12px | — |
| Breadcrumb link | IBM Plex Sans | 500 | 13px | 13px | — |
| Rail `CHANGES` label | IBM Plex Sans | 700 | 11px | 11px | tracking 0.18em |
| Keycap glyph | IBM Plex Mono | 700 | 11px | 11px | — |
| Keycap label | IBM Plex Mono | 400 | 11px | 14px | — |
| Status chip | IBM Plex Mono | 700 | 11px | 11px | tracking 0.04em |
| Manuscript H1 | Old Standard TT | 700 | 38px | 46px | tracking -0.005em |
| Manuscript H2 | Old Standard TT | 700 | 22px | 28px | — |
| Manuscript body | IM Fell English | 400 | 18px | 28px | — |
| Rationale empty-state | EB Garamond | 400 italic | 16px | 22px | — |

## Spacing scale (px)

`2, 4, 6, 8, 10, 12, 14, 18, 24, 36, 64`

Exposed as `--space-0-5`, `--space-1`, `--space-1-5`, `--space-2`, `--space-2-5`, `--space-3`, `--space-3-5`, `--space-4-5`, `--space-6`, `--space-9`, `--space-16`.

## Bevel recipes

| Token | Value | Use |
|---|---|---|
| `--bevel-raised-1` | `inset 1px 1px 0 var(--chrome-highlight), inset -1px -1px 0 var(--chrome-shadow)` | Keycap, window control, tab active |
| `--bevel-sunken-1` | `inset 1px 1px 0 var(--chrome-shadow), inset -1px -1px 0 var(--chrome-highlight)` | Sunken well, inactive tab |
| `--bevel-window-2` | `inset 2px 2px 0 var(--chrome-highlight), inset -2px -2px 0 var(--chrome-shadow), 0 0 0 1px var(--deep-shadow)` | Outer window, rationale panel |
| `--bevel-raised-chip` | `inset 1px 1px 0 rgba(255,255,255,0.6), inset -1px -1px 0 rgba(0,0,0,0.15)` | Chip rims |

## Border specs

- Outer window: `1px solid var(--navy-shadow)` (plus `--bevel-window-2`)
- Title bar bottom: `2px solid var(--navy-shadow)`
- App header bottom: `2px solid var(--chrome-shadow)` with `box-shadow: inset 0 -1px 0 var(--chrome-highlight)`
- Tab strip bottom: `2px solid var(--chrome-shadow)` with `box-shadow: inset 0 1px 0 var(--chrome-highlight)`
- Panel outlines: `1px solid var(--navy-shadow)`

## Layout metrics

| Token | px | Role |
|---|---|---|
| `--window-pad` | 32 | Desktop padding around the window |
| `--titlebar-h` | 50 | |
| `--appheader-h` | 58 | |
| `--tabstrip-h` | 38 | |
| `--bottombar-h` | 50 | |
| `--rail-w` | 244 | Left review rail |
| `--rationale-w` | 352 | Floating rationale panel |
| `--rationale-inset` | 12 | Offset of floating panel inside content area |

## Interaction affordances

- The window chrome draws its own title bar; Tauri decorations must be disabled.
- The title bar is the drag region (Tauri `data-tauri-drag-region`). Buttons inside the title bar must opt out with `data-tauri-drag-region="false"`.
- Traffic-light dots wire to min/zoom/close via `@tauri-apps/api/window`.
- Window controls on the right are additional affordances for the same actions (belt-and-braces for the nostalgic look).
- Rationale panel is sticky inside the content area for this port; drag + resize are visual-only (the grip renders but does not drag). Log as intentional deviation.

## Intentional light-mode only

The v1 tokens included a dark-mode override. v2 is light-only. Dark mode is explicitly out of scope until the design is re-extended.
````

- [ ] **Step 3: Validate the file compiles as a markdown lint target**

Run: `pnpm exec markdownlint docs/design/DESIGN_REFERENCE.md || true`
Expected: no blocking errors; warnings are acceptable. (`markdownlint` may not be installed; if missing, skip.)

- [ ] **Step 4: Commit**

```bash
git add docs/design/DESIGN_REFERENCE.md
git commit -m "docs(design): lock v2 clunky design system — tokens, artboard map, bevel recipes"
```

---

## Phase 2 — Theme layer (fonts, tokens, chrome utilities)

### Task 3: Load the five web fonts

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Inspect the current layout**

Run: `sed -n '1,80p' src/routes/+layout.svelte`
Expected output: current layout markup. Confirm whether `<svelte:head>` already exists.

- [ ] **Step 2: Add Google Fonts preconnect + stylesheet inside `<svelte:head>`**

Add (inside `<svelte:head>`, above any existing `<title>`):

```svelte
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@1,700&family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@500;700&family=IM+Fell+English&family=Old+Standard+TT:wght@400;700&display=swap"
/>
```

- [ ] **Step 3: Start the dev server and confirm fonts load without CSP errors**

Run in one terminal: `pnpm tauri dev`
In the Tauri dev window, open DevTools (Cmd+Option+I) → Network tab → filter `fonts.gstatic.com`. Expected: four requests, all 200 OK, no CSP violation in Console.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "chore(fonts): load v2 type families from Google Fonts"
```

### Task 4: Write the token CSS file

**Files:**
- Create: `src/lib/theme/tokens.css`

- [ ] **Step 1: Write tokens.css**

Create `src/lib/theme/tokens.css` with this exact content:

```css
/* =============================================================================
   MARGINALIA V2 DESIGN TOKENS
   Locked to docs/design/DESIGN_REFERENCE.md. Do not override inline.
   ============================================================================= */

:root {
  /* --- Colors ------------------------------------------------------------- */
  --desktop-ground: #2E6E65;
  --window-body: #E8E4D5;
  --paper: #ECE3C8;
  --navy-chrome: #1B2B5E;
  --navy-shadow: #0B1230;
  --wordmark-teal: #1F7A6E;
  --chrome-highlight: #F5F2E4;
  --chrome-shadow: #6B6A62;
  --deep-shadow: #1A1612;
  --button-face: #C9C3B0;
  --tab-inactive: #C9C3B0;
  --ink: #1A1612;
  --muted: #5B5A55;
  --link: #1B3EAC;
  --traffic-red: #E35145;
  --traffic-yellow: #E0B137;
  --traffic-blue: #3B6FCF;
  --chip-green-bg: #CEE2C2;
  --chip-green-border: #3D6B4A;
  --chip-green-text: #2B4E35;
  --chip-red-bg: #E8C4C4;
  --chip-red-border: #8A3838;
  --chip-red-text: #8A3838;
  --led-green: #58A667;
  --led-highlight: #C7E8CB;
  --rationale-well-bg: #F5F2E4;

  /* --- Typography --------------------------------------------------------- */
  --font-chrome: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-wordmark: "EB Garamond", Palatino, Georgia, serif;
  --font-h: "Old Standard TT", "Source Serif 4", Georgia, serif;
  --font-body: "IM Fell English", "Old Standard TT", Georgia, serif;

  /* --- Spacing scale ------------------------------------------------------ */
  --space-0-5: 2px;
  --space-1: 4px;
  --space-1-5: 6px;
  --space-2: 8px;
  --space-2-5: 10px;
  --space-3: 12px;
  --space-3-5: 14px;
  --space-4-5: 18px;
  --space-6: 24px;
  --space-9: 36px;
  --space-16: 64px;

  /* --- Layout metrics ----------------------------------------------------- */
  --window-pad: 32px;
  --titlebar-h: 50px;
  --appheader-h: 58px;
  --tabstrip-h: 38px;
  --bottombar-h: 50px;
  --rail-w: 244px;
  --rationale-w: 352px;
  --rationale-inset: 12px;

  /* --- Bevel recipes ------------------------------------------------------ */
  --bevel-raised-1:
    inset 1px 1px 0 var(--chrome-highlight),
    inset -1px -1px 0 var(--chrome-shadow);
  --bevel-sunken-1:
    inset 1px 1px 0 var(--chrome-shadow),
    inset -1px -1px 0 var(--chrome-highlight);
  --bevel-window-2:
    inset 2px 2px 0 var(--chrome-highlight),
    inset -2px -2px 0 var(--chrome-shadow),
    0 0 0 1px var(--deep-shadow);
  --bevel-raised-chip:
    inset 1px 1px 0 rgba(255, 255, 255, 0.6),
    inset -1px -1px 0 rgba(0, 0, 0, 0.15);

  /* --- Text colors (role-indexed) ----------------------------------------- */
  --text-body: var(--ink);
  --text-muted: var(--muted);
  --text-link: var(--link);
  --text-chrome-on-navy: var(--chrome-highlight);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/theme/tokens.css
git commit -m "feat(theme): add v2 clunky CSS token file"
```

### Task 5: Write the chrome utility CSS file

**Files:**
- Create: `src/lib/theme/chrome.css`

- [ ] **Step 1: Write chrome.css**

Create `src/lib/theme/chrome.css`:

```css
/* =============================================================================
   MARGINALIA V2 CHROME UTILITIES
   Bevel helpers, typographic base, scrollbars. Layer-ordered AFTER tokens.css.
   ============================================================================= */

.raised-1 {
  box-shadow: var(--bevel-raised-1);
}

.sunken-1 {
  box-shadow: var(--bevel-sunken-1);
}

.window-2 {
  box-shadow: var(--bevel-window-2);
}

.chip-raised {
  box-shadow: var(--bevel-raised-chip);
}

/* Draggable title-bar region. Buttons inside must opt out. */
.drag-region {
  -webkit-app-region: drag;
  app-region: drag;
}

.drag-region > button,
.drag-region > a,
.drag-region > [data-tauri-drag-region='false'] {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

/* Manuscript document typography — applied inside Editor via a class root. */
.v2-manuscript {
  font-family: var(--font-body);
  font-size: 18px;
  line-height: 28px;
  color: var(--ink);
}

.v2-manuscript h1,
.v2-manuscript h2,
.v2-manuscript h3 {
  font-family: var(--font-h);
  color: var(--ink);
  letter-spacing: -0.005em;
}

.v2-manuscript h1 {
  font-size: 38px;
  line-height: 46px;
  font-weight: 700;
  margin: 0 0 24px 0;
}

.v2-manuscript h2 {
  font-size: 22px;
  line-height: 28px;
  font-weight: 700;
  margin: 0 0 14px 0;
}

.v2-manuscript p {
  margin: 0 0 28px 0;
}

/* Scrollbars — narrow, neutral, period-appropriate (no rounded thumb). */
::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: var(--button-face);
  box-shadow: var(--bevel-sunken-1);
}

::-webkit-scrollbar-thumb {
  background: var(--button-face);
  box-shadow: var(--bevel-raised-1);
  border: 1px solid var(--navy-shadow);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/theme/chrome.css
git commit -m "feat(theme): add v2 chrome utilities (bevels, drag region, manuscript base)"
```

### Task 6: Replace `src/app.css` with the new theme

**Files:**
- Modify: `src/app.css`

- [ ] **Step 1: Capture the current file for reference (optional)**

Run: `git log -1 --format=%H -- src/app.css` and note the SHA so it can be recovered from history if needed.

- [ ] **Step 2: Overwrite `src/app.css`**

Replace the entire contents of `src/app.css` with:

```css
/* =============================================================================
   MARGINALIA V2 REVIEW SURFACE — GLOBAL STYLES
   All tokens live in ./lib/theme/tokens.css. Chrome utilities in ./lib/theme/chrome.css.
   ============================================================================= */

@import './lib/theme/tokens.css';
@import './lib/theme/chrome.css';

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  font-family: var(--font-chrome);
  color: var(--ink);
  background: var(--desktop-ground);
  overflow: hidden;
}

:root[data-marginalia-mode='review'] body {
  background: var(--desktop-ground);
}

:root[data-marginalia-mode='site'] body {
  background: var(--window-body);
}

.no-select {
  user-select: none;
  -webkit-user-select: none;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 3: Run svelte-check as a regression gate**

Run: `pnpm run check`
Expected: zero errors (warnings about unused CSS in components are fine; we'll clean those in Phase 6).

- [ ] **Step 4: Start the dev server and confirm the page still loads**

Run: `pnpm tauri dev`
Expected: the window opens on the teal background; the review surface still renders (it will look broken/unstyled — that is expected, we haven't rewired components yet). No console errors about missing CSS variables.

- [ ] **Step 5: Commit**

```bash
git add src/app.css
git commit -m "refactor(theme): replace Paper & Ink tokens with v2 clunky theme layer"
```

---

## Phase 3 — Chrome primitives

Each primitive is a standalone Svelte 5 component using runes. Each ends with a dev-server visual spot-check. Order matters: leaf primitives first, composites last.

### Task 7: `TrafficLight.svelte`

**Files:**
- Create: `src/lib/components/chrome/TrafficLight.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  /** @typedef {'red' | 'yellow' | 'blue'} Tone */
  /** @type {{ tone: Tone, onClick?: (e: MouseEvent) => void, label?: string }} */
  let { tone, onClick, label } = $props();

  const fill = {
    red: 'var(--traffic-red)',
    yellow: 'var(--traffic-yellow)',
    blue: 'var(--traffic-blue)'
  };
</script>

<button
  type="button"
  class="dot"
  style:background-color={fill[tone]}
  aria-label={label ?? tone}
  data-tauri-drag-region="false"
  onclick={onClick}
></button>

<style>
  .dot {
    width: 16px;
    height: 16px;
    border-radius: 16px;
    border: 1px solid var(--navy-shadow);
    box-shadow:
      inset 1px 1px 0 rgba(255, 255, 255, 0.55),
      inset -1px -1px 0 rgba(0, 0, 0, 0.35);
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .dot:active {
    box-shadow:
      inset 1px 1px 0 rgba(0, 0, 0, 0.35),
      inset -1px -1px 0 rgba(255, 255, 255, 0.55);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/TrafficLight.svelte
git commit -m "feat(chrome): add TrafficLight primitive"
```

### Task 8: `WindowControl.svelte`

**Files:**
- Create: `src/lib/components/chrome/WindowControl.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  /** @typedef {'minimize' | 'maximize' | 'close'} Kind */
  /** @type {{ kind: Kind, onClick?: (e: MouseEvent) => void, size?: number, onNavy?: boolean }} */
  let { kind, onClick, size = 24, onNavy = true } = $props();
</script>

<button
  type="button"
  class="ctl"
  style:width="{size}px"
  style:height="{size}px"
  style:color={onNavy ? 'var(--chrome-highlight)' : 'var(--ink)'}
  aria-label={kind}
  data-tauri-drag-region="false"
  onclick={onClick}
>
  {#if kind === 'minimize'}
    <span class="bar" style:background-color="var(--ink)"></span>
  {:else if kind === 'maximize'}
    <span class="box" style:border-color="var(--ink)"></span>
  {:else}
    <span class="x">✕</span>
  {/if}
</button>

<style>
  .ctl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .ctl:active {
    box-shadow: var(--bevel-sunken-1);
  }
  .bar {
    width: 10px;
    height: 2px;
    margin-top: 8px;
  }
  .box {
    width: 12px;
    height: 10px;
    background: transparent;
    border: 2px solid;
  }
  .x {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    line-height: 13px;
    color: var(--ink);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/WindowControl.svelte
git commit -m "feat(chrome): add WindowControl primitive (min/max/close)"
```

### Task 9: `TitleBar.svelte`

**Files:**
- Create: `src/lib/components/chrome/TitleBar.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  import TrafficLight from './TrafficLight.svelte';
  import WindowControl from './WindowControl.svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  /** @type {{ title: string }} */
  let { title } = $props();

  async function minimize() {
    try { await getCurrentWindow().minimize(); } catch {}
  }
  async function zoom() {
    try { await getCurrentWindow().toggleMaximize(); } catch {}
  }
  async function close() {
    try { await getCurrentWindow().close(); } catch {}
  }
</script>

<div class="titlebar drag-region" data-tauri-drag-region>
  <div class="lights">
    <TrafficLight tone="red" onClick={close} label="Close" />
    <TrafficLight tone="yellow" onClick={minimize} label="Minimize" />
    <TrafficLight tone="blue" onClick={zoom} label="Zoom" />
  </div>

  <div class="center">
    <div class="stripes left">
      {#each Array(7) as _, i}
        <span class:dark={i % 2 === 1}></span>
      {/each}
    </div>
    <span class="label">{title}</span>
    <div class="stripes right">
      {#each Array(7) as _, i}
        <span class:dark={i % 2 === 1}></span>
      {/each}
    </div>
  </div>

  <div class="controls">
    <WindowControl kind="minimize" onClick={minimize} />
    <WindowControl kind="maximize" onClick={zoom} />
    <WindowControl kind="close" onClick={close} />
  </div>
</div>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: var(--titlebar-h);
    padding: 0 6px;
    background: var(--navy-chrome);
    border-bottom: 2px solid var(--navy-shadow);
    flex-shrink: 0;
  }
  .lights {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px 0 4px;
    flex-shrink: 0;
  }
  .center {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px;
  }
  .stripes {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 0;
  }
  .stripes span {
    height: 1px;
    background: var(--chrome-highlight);
  }
  .stripes span.dark {
    background: var(--navy-shadow);
  }
  .label {
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--chrome-highlight);
    padding: 0 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px;
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/TitleBar.svelte
git commit -m "feat(chrome): add TitleBar with stripes, traffic lights, window controls"
```

### Task 10: `Keycap.svelte`

**Files:**
- Create: `src/lib/components/chrome/Keycap.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  /** @type {{ keys: string, label: string }} */
  let { keys, label } = $props();
</script>

<span class="kc">
  <span class="cap">{keys}</span>
  <span class="lab">{label}</span>
</span>

<style>
  .kc {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
  }
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
  .lab {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink);
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/Keycap.svelte
git commit -m "feat(chrome): add Keycap primitive"
```

### Task 11: `BeveledButton.svelte`

**Files:**
- Create: `src/lib/components/chrome/BeveledButton.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  /** @type {{ onClick?: (e: MouseEvent) => void, children: import('svelte').Snippet }} */
  let { onClick, children } = $props();
</script>

<button type="button" class="btn" onclick={onClick}>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    padding: 5px 12px;
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
  .btn:active {
    box-shadow: var(--bevel-sunken-1);
    padding: 6px 11px 4px 13px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/BeveledButton.svelte
git commit -m "feat(chrome): add BeveledButton primitive"
```

### Task 12: `StatusLED.svelte`

**Files:**
- Create: `src/lib/components/chrome/StatusLED.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  /** @type {{ label: string, on?: boolean }} */
  let { label, on = true } = $props();
</script>

<span class="led-chip">
  <span class="dot" class:on></span>
  <span class="lab">{label}</span>
</span>

<style>
  .led-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--chip-green-bg);
    border: 1px solid var(--chip-green-border);
    box-shadow: var(--bevel-raised-chip);
  }
  .dot {
    width: 8px;
    height: 8px;
    background: var(--led-green);
    border: 1px solid var(--chip-green-text);
    box-shadow: inset 1px 1px 0 var(--led-highlight);
    flex-shrink: 0;
  }
  .dot:not(.on) {
    background: var(--muted);
    box-shadow: none;
  }
  .lab {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--chip-green-text);
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/StatusLED.svelte
git commit -m "feat(chrome): add StatusLED primitive"
```

### Task 13: `SunkenWell.svelte`

**Files:**
- Create: `src/lib/components/chrome/SunkenWell.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  /** @type {{ children: import('svelte').Snippet, pad?: string }} */
  let { children, pad = '14px 12px' } = $props();
</script>

<div class="well" style:padding={pad}>
  {@render children()}
</div>

<style>
  .well {
    background: var(--rationale-well-bg);
    border: 1px solid var(--chrome-shadow);
    box-shadow: var(--bevel-sunken-1);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/SunkenWell.svelte
git commit -m "feat(chrome): add SunkenWell container primitive"
```

### Task 14: `WindowFrame.svelte`

**Files:**
- Create: `src/lib/components/chrome/WindowFrame.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  /** @type {{ children: import('svelte').Snippet }} */
  let { children } = $props();
</script>

<div class="ground">
  <div class="window">
    {@render children()}
  </div>
</div>

<style>
  .ground {
    background: var(--desktop-ground);
    padding: var(--window-pad);
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  .window {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--window-body);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-window-2);
    overflow: hidden;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/WindowFrame.svelte
git commit -m "feat(chrome): add WindowFrame outer container"
```

---

## Phase 4 — Tauri window reconfiguration

### Task 15: Disable native decorations so our chrome draws the title bar

**Files:**
- Modify: `src-tauri/tauri.conf.json:23-25`

- [ ] **Step 1: Change `decorations` to `false`**

Edit `src-tauri/tauri.conf.json`, set `"decorations": false`. Keep `"titleBarStyle": "Overlay"` and `"hiddenTitle": true`. Leave `"closable": true`.

After edit, the relevant block reads:

```json
"titleBarStyle": "Overlay",
"hiddenTitle": true,
"decorations": false,
"closable": true
```

- [ ] **Step 2: Rebuild and launch Tauri**

Run: `pnpm tauri dev`
Expected: the window opens with **no native title bar**. At this point the window is still draggable only by OS hot zones (upper-left corner). This is expected — the drag region lives inside `TitleBar.svelte` via `data-tauri-drag-region` and kicks in when Task 25 wires the component into the page.

- [ ] **Step 3: Confirm you can close the window using `Cmd+W` or `Cmd+Q`**

If either fails, stop and investigate Tauri global shortcuts before continuing.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore(tauri): disable native decorations for custom chrome"
```

---

## Phase 5 — Review surface recomposition

### Task 16: Write `AppHeader.svelte`

**Files:**
- Create: `src/lib/components/chrome/AppHeader.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  /** @type {{ breadcrumb: Array<{ label: string, active?: boolean }>, nav: string[] }} */
  let { breadcrumb, nav } = $props();
</script>

<div class="header">
  <div class="wordmark">
    <span>Marginalia</span>
  </div>
  <nav class="crumbs" aria-label="Breadcrumb">
    {#each breadcrumb as item, i}
      {#if i > 0}<span class="sep">›</span>{/if}
      <span class="crumb" class:active={item.active}>{item.label}</span>
    {/each}
  </nav>
  <div class="nav">
    {#each nav as item, i}
      {#if i > 0}<span class="pipe">|</span>{/if}
      <a href="#" class="link">{item}</a>
    {/each}
  </div>
</div>

<style>
  .header {
    display: flex;
    align-items: stretch;
    height: var(--appheader-h);
    background: var(--window-body);
    border-bottom: 2px solid var(--chrome-shadow);
    box-shadow: inset 0 -1px 0 var(--chrome-highlight);
    flex-shrink: 0;
  }
  .wordmark {
    display: flex;
    align-items: center;
    width: 212px;
    padding: 0 18px;
    background: var(--wordmark-teal);
    border: 1px solid #0B3A32;
    box-shadow:
      inset 1px 1px 0 rgba(255, 255, 255, 0.22),
      inset -1px -1px 0 rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }
  .wordmark span {
    font-family: var(--font-wordmark);
    font-style: italic;
    font-weight: 700;
    font-size: 28px;
    letter-spacing: -0.01em;
    color: var(--chrome-highlight);
  }
  .crumbs {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 0 24px;
    gap: 12px;
  }
  .crumb {
    font-family: var(--font-chrome);
    font-size: 13px;
    font-weight: 500;
    color: var(--link);
  }
  .crumb.active {
    color: var(--ink);
    font-weight: 700;
  }
  .sep {
    font-family: var(--font-chrome);
    font-size: 12px;
    color: var(--chrome-shadow);
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 24px;
    flex-shrink: 0;
  }
  .link {
    font-family: var(--font-chrome);
    font-size: 13px;
    font-weight: 500;
    color: var(--link);
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }
  .pipe {
    color: var(--chrome-shadow);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/AppHeader.svelte
git commit -m "feat(chrome): add AppHeader with wordmark + breadcrumb + nav"
```

### Task 17: Write `TabStrip.svelte`

**Files:**
- Create: `src/lib/components/chrome/TabStrip.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  /** @type {{ tabs: Array<{ id: string, label: string }>, activeId: string, onSelect?: (id: string) => void }} */
  let { tabs, activeId, onSelect } = $props();
</script>

<div class="strip">
  {#each tabs as tab}
    <button
      type="button"
      class="tab"
      class:active={tab.id === activeId}
      onclick={() => onSelect?.(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    align-items: flex-end;
    height: var(--tabstrip-h);
    background: var(--tab-inactive);
    border-bottom: 2px solid var(--chrome-shadow);
    box-shadow: inset 0 1px 0 var(--chrome-highlight);
    padding: 4px 6px 0 6px;
    gap: 2px;
    flex-shrink: 0;
  }
  .tab {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 26px;
    background: var(--tab-inactive);
    border: 1px solid var(--navy-shadow);
    box-shadow:
      inset 1px 1px 0 var(--chrome-highlight),
      inset -1px -1px 0 var(--chrome-shadow);
    font-family: var(--font-chrome);
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
    white-space: nowrap;
    cursor: pointer;
  }
  .tab.active {
    height: 34px;
    background: var(--window-body);
    border-bottom: 1px solid var(--window-body);
    box-shadow:
      inset 1px 1px 0 var(--chrome-highlight),
      inset -1px 0 0 var(--chrome-shadow);
    margin-bottom: -1px;
    font-weight: 700;
    color: var(--ink);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/TabStrip.svelte
git commit -m "feat(chrome): add TabStrip primitive"
```

### Task 18: Write `BottomShortcutBar.svelte`

**Files:**
- Create: `src/lib/components/chrome/BottomShortcutBar.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script>
  import Keycap from './Keycap.svelte';
  import StatusLED from './StatusLED.svelte';

  /** @type {{ edits: number, annotations: number, saved: boolean }} */
  let { edits, annotations, saved } = $props();

  const shortcuts = [
    { keys: '⌘ G', label: 'notes' },
    { keys: '⌘ /', label: 'rationale' },
    { keys: '⌘ ⇧ O', label: 'add ref' },
    { keys: '⌘ Z', label: 'undo' },
    { keys: 'ESC', label: 'done' }
  ];
</script>

<div class="bar">
  <div class="status">
    <span class="count">{edits} edits</span>
    <span class="count muted">{annotations} annotations</span>
    <StatusLED label={saved ? 'SAVED' : 'UNSAVED'} on={saved} />
  </div>
  <div class="spacer"></div>
  <div class="shortcuts">
    {#each shortcuts as s}
      <Keycap keys={s.keys} label={s.label} />
    {/each}
  </div>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    height: var(--bottombar-h);
    background: var(--window-body);
    border-top: 2px solid var(--chrome-shadow);
    box-shadow: inset 0 1px 0 var(--chrome-highlight);
    padding: 0 14px;
    gap: 18px;
    flex-shrink: 0;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .count {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink);
    white-space: nowrap;
  }
  .count.muted {
    color: var(--muted);
  }
  .spacer {
    flex: 1;
  }
  .shortcuts {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/chrome/BottomShortcutBar.svelte
git commit -m "feat(chrome): add BottomShortcutBar with SAVED LED + keycaps"
```

### Task 19: Recompose `src/routes/review/+page.svelte`

**Files:**
- Modify: `src/routes/review/+page.svelte`

- [ ] **Step 1: Read the existing file top-to-bottom and locate the top-level markup block**

Run: `sed -n '1,220p' src/routes/review/+page.svelte`
Expected: identify the top-level wrapping `<div>`, the existing `<Header/>`, `<ChangeRail/>`, `<Editor/>`, `<AnnotationColumn/>`, and `<StatusBar/>` calls.

- [ ] **Step 2: Add imports for new chrome components at the top of the `<script>` block**

Add these imports immediately after the existing imports:

```js
import WindowFrame from '$lib/components/chrome/WindowFrame.svelte';
import TitleBar from '$lib/components/chrome/TitleBar.svelte';
import AppHeader from '$lib/components/chrome/AppHeader.svelte';
import TabStrip from '$lib/components/chrome/TabStrip.svelte';
import BottomShortcutBar from '$lib/components/chrome/BottomShortcutBar.svelte';
```

- [ ] **Step 3: Add a `currentTab` rune and the breadcrumb/nav data near the top of `<script>`**

```js
let currentTab = $state('review');
const breadcrumb = [
  { label: 'All drafts' },
  { label: 'Product Brief' },
  { label: 'Draft Review', active: true }
];
const nav = ['Help', 'Preferences', 'Sign Out'];
```

- [ ] **Step 4: Wrap the existing markup tree**

Replace the outermost wrapping element with:

```svelte
<WindowFrame>
  <TitleBar title="Marginalia — Draft Review" />
  <AppHeader {breadcrumb} {nav} />
  <TabStrip
    tabs={[{ id: 'review', label: 'Review' }, { id: 'manuscript', label: 'Manuscript' }]}
    activeId={currentTab}
    onSelect={(id) => (currentTab = id)}
  />

  <div class="content-area">
    <!-- existing ChangeRail, Editor, AnnotationColumn go here -->
  </div>

  <BottomShortcutBar edits={0} annotations={0} saved={true} />
</WindowFrame>
```

Leave the existing `<ChangeRail/>`, `<Editor/>`, `<AnnotationColumn/>` inside `.content-area` untouched for now — they'll be restyled in Phase 6.

Remove the old `<Header/>` and `<StatusBar/>` calls and their imports.

Add a scoped style for `.content-area`:

```css
.content-area {
  display: flex;
  flex: 1;
  position: relative;
  background: var(--window-body);
  overflow: hidden;
}
```

- [ ] **Step 5: Run svelte-check**

Run: `pnpm run check`
Expected: zero errors. If `Header` or `StatusBar` imports remain, delete them.

- [ ] **Step 6: Visual smoke — run the dev server and confirm the chrome renders**

Run: `pnpm tauri dev`
Expected: window opens on teal ground, you see the navy title bar with stripes, the wordmark block in teal, the breadcrumb, the tab strip, then the old-style content below, then the bottom shortcut bar. The content area still looks like v1 styling at this point — that's fixed in Phase 6.

- [ ] **Step 7: Commit**

```bash
git add src/routes/review/+page.svelte
git commit -m "feat(review): wrap review surface in v2 chrome shell"
```

### Task 20: Delete retired components

**Files:**
- Delete: `src/lib/components/Header.svelte`
- Delete: `src/lib/components/StatusBar.svelte`

- [ ] **Step 1: Confirm no other imports remain**

Run: `grep -rn --include='*.svelte' --include='*.js' --include='*.ts' -e "components/Header" -e "components/StatusBar" src/`
Expected: no output.

- [ ] **Step 2: Delete files**

```bash
rm src/lib/components/Header.svelte src/lib/components/StatusBar.svelte
```

- [ ] **Step 3: Run svelte-check**

Run: `pnpm run check`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/components/
git commit -m "refactor(review): remove Header and StatusBar (replaced by chrome primitives)"
```

---

## Phase 6 — Panel restyling

### Task 21: Restyle `ChangeRail.svelte`

**Files:**
- Modify: `src/lib/components/ChangeRail.svelte`

- [ ] **Step 1: Inspect the current component**

Run: `sed -n '1,200p' src/lib/components/ChangeRail.svelte`
Expected: identify the root markup, the list container, and the current `<style>` block using `--paper`, `--ink-*` tokens.

- [ ] **Step 2: Replace the root `<style>` block with v2 styling**

Replace the entire `<style>` block (scoped styles) with this (preserve element class names by editing the component's markup to use them; if the current component uses different class names, rename the selectors or adjust the markup to match):

```svelte
<style>
  .rail {
    display: flex;
    flex-direction: column;
    width: var(--rail-w);
    flex-shrink: 0;
    background: var(--window-body);
    border-right: 2px solid var(--chrome-shadow);
    box-shadow: inset -1px 0 0 var(--chrome-highlight);
    padding: 18px 14px;
  }
  .label {
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 11px;
    color: var(--ink);
    letter-spacing: 0.18em;
  }
  .summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink);
  }
  .summary .muted {
    color: var(--muted);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 20px;
    padding: 0 6px;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 11px;
    box-shadow: var(--bevel-raised-chip);
    flex-shrink: 0;
  }
  .chip.added {
    background: var(--chip-green-bg);
    border: 1px solid var(--chip-green-border);
    color: var(--chip-green-text);
  }
  .chip.removed {
    background: var(--chip-red-bg);
    border: 1px solid var(--chip-red-border);
    color: var(--chip-red-text);
  }
  .divider {
    height: 2px;
    border-top: 1px solid var(--chrome-shadow);
    border-bottom: 1px solid var(--chrome-highlight);
    background: transparent;
    margin-top: 20px;
  }
  .empty {
    margin-top: 18px;
    padding: 14px 12px;
    background: var(--rationale-well-bg);
    border: 1px solid var(--chrome-shadow);
    box-shadow: var(--bevel-sunken-1);
    font-family: var(--font-chrome);
    font-size: 12px;
    font-style: italic;
    color: var(--muted);
    line-height: 18px;
  }
</style>
```

- [ ] **Step 3: Update markup to the exact class names**

Ensure the markup structure is:

```svelte
<aside class="rail">
  <div class="label">CHANGES</div>
  <div class="summary">
    <span>{edits} edits</span>
    <span class="muted">{noted} noted</span>
    <span style="margin-left:auto; display:flex; gap:6px;">
      <span class="chip added">+{inserted}</span>
      <span class="chip removed">−{deleted}</span>
    </span>
  </div>
  <div class="divider"></div>
  {#if edits === 0}
    <div class="empty">No edits yet. Start editing to populate the review index.</div>
  {:else}
    <!-- existing change list, unchanged -->
  {/if}
</aside>
```

Adapt local variable names to what the component already exposes (`edits`, `noted`, `inserted`, `deleted`). If the existing props don't match, add derived aliases in the `<script>` block rather than renaming store properties.

- [ ] **Step 4: Run svelte-check + dev server**

Run: `pnpm run check`
Expected: zero errors.

Run: `pnpm tauri dev`
Expected: the rail now reads CHANGES label, mono counters, the +0/−0 chips, and the sunken empty-state well. Compare visually against `docs/design/references/paper-v2-artboard.png` left column.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ChangeRail.svelte
git commit -m "style(rail): retheme ChangeRail to v2 chrome (CHANGES label, chips, sunken empty-state)"
```

### Task 22: Restyle `AnnotationColumn.svelte` as the Rationale sub-window

**Files:**
- Modify: `src/lib/components/AnnotationColumn.svelte`

- [ ] **Step 1: Inspect the current component**

Run: `sed -n '1,260p' src/lib/components/AnnotationColumn.svelte`

- [ ] **Step 2: Wrap the column in a beveled sub-window frame**

Modify the root markup to:

```svelte
<aside class="rationale-panel">
  <div class="rat-titlebar">
    <span class="rat-title">Rationale</span>
    <div class="rat-stripes">
      {#each Array(5) as _, i}<span class:dark={i % 2 === 1}></span>{/each}
    </div>
    <div class="rat-ctls">
      <button class="rat-ctl"><span class="rat-bar"></span></button>
      <button class="rat-ctl"><span class="rat-box"></span></button>
      <button class="rat-ctl rat-x">✕</button>
    </div>
  </div>
  <div class="rat-toolbar">
    <BeveledButton onClick={startNewNote}>+ New note</BeveledButton>
  </div>
  <div class="rat-body">
    <SunkenWell pad="18px 16px">
      {#if annotations.length === 0}
        <span class="rat-empty">No rationales yet.</span>
      {:else}
        <!-- existing list, unchanged -->
      {/if}
    </SunkenWell>
  </div>
  <div class="rat-grip">
    <span></span><span></span><span></span>
    <span style="opacity:0"></span><span></span><span></span>
    <span style="opacity:0"></span><span style="opacity:0"></span><span></span>
  </div>
</aside>
```

Add imports at the top of `<script>`:

```js
import BeveledButton from './chrome/BeveledButton.svelte';
import SunkenWell from './chrome/SunkenWell.svelte';
```

Bind `startNewNote` to whatever the existing "new note" handler is (rename the local alias if needed).

- [ ] **Step 3: Replace the component's `<style>` block**

```svelte
<style>
  .rationale-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 22px;
    width: var(--rationale-w);
    display: flex;
    flex-direction: column;
    background: var(--window-body);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-window-2);
  }
  .rat-titlebar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    background: var(--navy-chrome);
    padding: 0 6px;
    border-bottom: 2px solid var(--navy-shadow);
    flex-shrink: 0;
  }
  .rat-title {
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--chrome-highlight);
    padding: 0 6px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .rat-stripes {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 2px;
    padding: 8px 0;
  }
  .rat-stripes span {
    height: 1px;
    background: var(--chrome-highlight);
  }
  .rat-stripes span.dark {
    background: var(--navy-shadow);
  }
  .rat-ctls {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }
  .rat-ctl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    padding: 0;
    cursor: pointer;
  }
  .rat-bar { width: 10px; height: 2px; background: var(--ink); margin-top: 8px; }
  .rat-box { width: 11px; height: 9px; background: transparent; border: 2px solid var(--ink); }
  .rat-x { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--ink); }

  .rat-toolbar {
    display: flex;
    justify-content: flex-end;
    height: 42px;
    padding: 0 10px;
    align-items: center;
    background: var(--window-body);
    border-bottom: 1px solid var(--chrome-shadow);
    box-shadow: inset 0 -2px 0 var(--chrome-highlight);
    flex-shrink: 0;
  }

  .rat-body {
    flex: 1;
    padding: 12px;
    overflow: auto;
  }
  .rat-empty {
    font-family: var(--font-wordmark);
    font-style: italic;
    font-size: 16px;
    color: var(--chrome-shadow);
  }

  .rat-grip {
    position: absolute;
    right: 3px;
    bottom: 3px;
    display: grid;
    grid-template-columns: repeat(3, 2px);
    gap: 2px;
    pointer-events: none;
  }
  .rat-grip span {
    width: 2px;
    height: 2px;
    background: var(--ink);
  }
</style>
```

- [ ] **Step 4: Run svelte-check + dev server**

Run: `pnpm run check`
Expected: zero errors.

Run: `pnpm tauri dev`
Expected: the right-side column now reads as a framed navy-titled sub-window with stripes, `+ New note` beveled button, sunken well body, resize grip.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/AnnotationColumn.svelte
git commit -m "style(rationale): retheme AnnotationColumn to v2 beveled sub-window"
```

### Task 23: Restyle manuscript typography in `Editor.svelte`

**Files:**
- Modify: `src/lib/components/Editor.svelte`

- [ ] **Step 1: Inspect the component**

Run: `sed -n '1,240p' src/lib/components/Editor.svelte`

- [ ] **Step 2: Wrap the editor root in `.v2-manuscript` and set the paper ground**

Locate the outermost element that hosts the Milkdown editor. Add the `v2-manuscript` class to it (existing classes stay), and ensure the immediate container has the paper background. Add scoped styles:

```svelte
<style>
  .manuscript-host {
    flex: 1;
    background: var(--paper);
    border-left: 1px solid var(--chrome-shadow);
    box-shadow: inset 1px 0 0 var(--chrome-highlight);
    padding: 40px 392px 60px 64px;
    overflow-y: auto;
    overflow-x: hidden;
  }
  :global(.v2-manuscript .ProseMirror) {
    font-family: var(--font-body);
    font-size: 18px;
    line-height: 28px;
    color: var(--ink);
  }
  :global(.v2-manuscript .ProseMirror h1) {
    font-family: var(--font-h);
    font-size: 38px;
    line-height: 46px;
    font-weight: 700;
    margin-bottom: 24px;
  }
  :global(.v2-manuscript .ProseMirror h2) {
    font-family: var(--font-h);
    font-size: 22px;
    line-height: 28px;
    font-weight: 700;
    margin: 28px 0 14px 0;
  }
  :global(.v2-manuscript .ProseMirror p) {
    margin-bottom: 28px;
  }
</style>
```

Update the root element to:

```svelte
<section class="manuscript-host v2-manuscript">
  <!-- existing editor instance -->
</section>
```

Rename the existing outer class if it already has one — keep any class that the Milkdown integration relies on.

- [ ] **Step 3: Run svelte-check + dev server**

Run: `pnpm run check`
Expected: zero errors.

Run: `pnpm tauri dev`
Expected: manuscript is parchment-colored, H1 renders in Old Standard TT Bold, body in IM Fell English.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Editor.svelte
git commit -m "style(editor): retheme manuscript typography to Old Standard TT + IM Fell English on parchment"
```

---

## Phase 7 — Fidelity pass + regression gate

### Task 24: Side-by-side fidelity comparison

**Files:**
- Create: `docs/design/IMPLEMENTATION_NOTE.md`

- [ ] **Step 1: Run the dev app and capture a screenshot**

Run in one terminal: `pnpm tauri dev`
In another: bring the Tauri window to foreground. On macOS, run `screencapture -w /tmp/marginalia-v2-impl.png` and click the Tauri window. Copy to the repo:

```bash
cp /tmp/marginalia-v2-impl.png docs/design/references/implementation-screenshot.png
```

- [ ] **Step 2: Compare to the Paper oracle**

Open both side-by-side: `docs/design/references/paper-v2-artboard.png` and `docs/design/references/implementation-screenshot.png`. Walk through these in order, noting each miss:

1. Outer window bevel matches (2px raised, hard outline)?
2. Title bar: stripes flank the title, traffic dots left, three window controls right?
3. Wordmark italic EB Garamond in teal block, white text?
4. Breadcrumb blue links with `›`?
5. Tab strip: active tab cream+raised, inactive tab grey+recessed?
6. Left rail: CHANGES caps label, mono counters, chips, sunken empty-state?
7. Manuscript: Old Standard TT headings, IM Fell English body, parchment background?
8. Rationale panel: floating, navy title bar with stripes, `+ New note` beveled, sunken body well, resize grip bottom-right?
9. Bottom bar: green SAVED LED chip, five beveled keycaps in mono?
10. Desktop ground visible around the window (teal, ~32px inset)?

- [ ] **Step 3: Fix drift in the paper-tighten order**

For each miss from Step 2, fix in this order:
1. Token value in `tokens.css` or `DESIGN_REFERENCE.md` (re-lock if wrong).
2. Chrome primitive in `src/lib/components/chrome/`.
3. Composition in `src/routes/review/+page.svelte` or panel component.
4. Only last resort: add a new primitive or token and document why.

Make small commits per fix.

- [ ] **Step 4: Write IMPLEMENTATION_NOTE.md**

Write `docs/design/IMPLEMENTATION_NOTE.md`:

```markdown
# V2 Clunky Review Surface — Implementation Note

**Date:** 2026-04-22
**Plan:** docs/superpowers/plans/2026-04-22-v2-clunky-review-surface.md
**Oracle:** docs/design/references/paper-v2-artboard.png
**Implementation capture:** docs/design/references/implementation-screenshot.png

## Reused primitives
<list the new chrome/* components, the existing ChangeRail / AnnotationColumn / Editor which were restyled>

## New tokens introduced beyond the initial DESIGN_REFERENCE.md
<list any tokens added during fidelity fixes, with rationale>

## Intentional deviations from the Paper oracle
- Rationale panel is sticky in layout (drag + resize grip is visual only) — deferred to a later pass.
- <anything else that came up>

## Known fidelity gaps
<if any remain after Task 24>

## Files created
<list>

## Files modified
<list>

## Files deleted
- src/lib/components/Header.svelte
- src/lib/components/StatusBar.svelte
```

- [ ] **Step 5: Commit**

```bash
git add docs/design/IMPLEMENTATION_NOTE.md docs/design/references/implementation-screenshot.png
git commit -m "docs(design): v2 implementation note + side-by-side capture"
```

### Task 25: Regression gate — run the full check suite

**Files:**
- None.

- [ ] **Step 1: Run each regression script**

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

Expected: all succeed. If any fail, stop and fix — the styling port must not break content behavior.

- [ ] **Step 2: Close out the plan**

If everything green, append to `docs/design/IMPLEMENTATION_NOTE.md`:

```markdown

## Regression gate
- pnpm run check ✓
- pnpm run check:diff ✓
- pnpm run check:annotations ✓
- pnpm run check:semantic ✓
- pnpm run check:bundle ✓
- pnpm run check:hook ✓
- pnpm run check:lint ✓
- pnpm run build ✓
```

- [ ] **Step 3: Final commit**

```bash
git add docs/design/IMPLEMENTATION_NOTE.md
git commit -m "docs(design): close v2 port — all regression gates green"
```

---

## Self-review checklist (for the engineer executing this plan)

- [ ] Every task has an explicit `git commit` step.
- [ ] No task references a file path that wasn't listed in File Structure.
- [ ] Every code block can be pasted verbatim with no `<...>` placeholders inside the code (annotations in prose like `<list>` in the final note are OK — that's a template to fill in).
- [ ] The Paper MCP fallback in Task 1 is honored if Paper isn't available.
- [ ] Rails/popover/editor restyles don't touch the store, diff engine, or annotation resolver.
- [ ] `pnpm run check:*` is run at the end, not mid-stream — the final gate is intentional.
