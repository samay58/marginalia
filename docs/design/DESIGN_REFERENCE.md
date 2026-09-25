# Marginalia v2 Design Reference

**Status:** Locked. The only place to change a token is here. Downstream code references tokens by name, never inline hex.

**Paper source:** `marginalia_experiment` file, page `1-0`, artboard `34-0` ("Marginalia – Draft Review (nostalgic)"). Visual oracle: `docs/design/references/paper-v2-artboard.png` (1620×971, 1x — aliased from the user's reference image because Paper MCP does not expose raw bytes for scale=2 export).

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
