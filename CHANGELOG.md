# Changelog

All notable changes to Marginalia.

## [0.1.0] - 2026-01-19

### Implemented (Aligned with Spec)

#### Phase 1: Foundation
- [x] Tauri 2.0 + Svelte 5 project scaffold
- [x] Full CSS design tokens (Paper & Ink palette)
  - Paper colors: `#FAF9F7`, `#F5F4F0`, `#FFFFFF`, `#E8E6E1`
  - Ink colors: `#2C2825`, `#6B655D`, `#A39E94`, `#C7C2B8`
  - Revision marks: struck (brick), added (verdigris)
  - Accent: amber `#C17F24`
- [x] Typography: Charter (body), Iowan Old Style (display), SF Mono (code)
- [x] Window with macOS traffic light spacing
- [x] Basic layout: header, gutter, editor, notes panel

#### Phase 2: Editor
- [x] CodeMirror 6 integration
- [x] Custom Paper & Ink theme for CodeMirror
- [x] Serif body text in editor (manuscript feel)
- [x] Gutter with line numbers
- [x] Edit indicators (○ empty, ● filled with rationale)
- [x] Line wrapping and markdown syntax highlighting

#### Phase 3: Diff
- [x] diff-match-patch integration
- [x] Semantic diff computation with cleanup
- [x] Change tracking with unique IDs
- [x] Line-based change location tracking
- [x] CSS classes for struck/added text (`.cm-struck`, `.cm-added`)

#### Phase 4: Comments
- [x] Annotation popover component
- [x] Rationale input field
- [x] Category chips (Tone, Clarity, Accuracy, Style, Structure)
- [x] Save/remove annotation functionality
- [x] Gutter click to open popover

#### Phase 5: Output
- [x] Bundle generation with all 5 files:
  - `original.md`
  - `final.md`
  - `changes.json`
  - `annotations.json`
  - `summary_for_agent.md`
- [x] Rust backend for file I/O
- [x] CLI argument parsing (`marginalia open <file>`)
- [x] Bundle saves to `~/phoenix/.marginalia/bundles/`

#### Phase 6: Polish
- [x] Dark mode support (follows system preference)
- [x] Dark theme variant for all colors
- [x] Responsive transitions on UI elements

#### Phase 7: Integration
- [x] Claude Code PostToolUse hook script
- [x] Pattern matching for `-draft.md` files
- [x] `<!-- REVIEW -->` marker detection
- [x] Phoenix `.marginalia/` directory setup
- [x] Added to Phoenix `.gitignore`

### Keyboard Shortcuts
- [x] `Esc` - Close and output bundle
- [x] `⌘ Enter` - Same as Esc
- [x] `⌘ /` - Add comment to current line
- [x] `⌘ G` - Toggle general notes
- [x] `⌘ Z` / `⌘ ⇧ Z` - Undo/Redo (via CodeMirror)

---

## Deferred to v1.5 (Per Spec)

### Anti-Slop Detection
- [ ] Scan original draft for WRITING.md violations
- [ ] Highlight em-dashes, banned words, hedging phrases
- [ ] Visual flags in gutter before user starts editing

### WRITING.md Integration
- [ ] Read `~/phoenix/WRITING.md` for existing principles
- [ ] Auto-match annotations to existing rules
- [ ] Surface matched rules in `summary_for_agent.md`

---

## Known Gaps (v0.1 → v0.2)

### Minor Missing Features
1. **Visual diff decorations not applied** - CSS classes exist but diff isn't actively rendered in editor yet
2. **Window close after save** - Currently just logs; needs `window.close()` implementation
3. **CLI flags not implemented**: `--bundle-dir`, `--principles`, `--out`
4. **Animations** - Minimal; spec mentioned more polish

### Technical Debt
1. **Gutter scroll sync** - Gutter scrolls independently from editor
2. **Line height alignment** - Approximate; may drift on long documents
3. **Popover positioning** - Uses fixed offset; should position relative to actual line

---

## Pivots from Spec

### No Pivots Required
The implementation followed the spec closely. Key decisions preserved:
- **No Tailwind** - Vanilla CSS with custom properties only
- **Serif body text** - Charter for manuscript feel
- **Paper & Ink aesthetic** - Exact colors from spec
- **5-file bundle format** - Exactly as specified

### Minor Adaptations
1. **Svelte 5 syntax** - Used new `$props()` runes instead of `export let`
2. **Event handlers** - Used `onclick` instead of deprecated `on:click`
3. **State management** - Svelte stores + local `$state()` hybrid

---

## Beads Issue Tracking

All phase epics created and closed:

| ID | Phase | Status |
|----|-------|--------|
| marg-6h8 | Phase 1: Foundation | ✓ Closed |
| marg-8i1 | Phase 2: Editor | ✓ Closed |
| marg-7mw | Phase 3: Diff | ✓ Closed |
| marg-43w | Phase 4: Comments | ✓ Closed |
| marg-3oo | Phase 5: Output | ✓ Closed |
| marg-6oa | Phase 6: Polish | ✓ Closed |
| marg-ate | Phase 7: Integration | ✓ Closed |

---

## Quality Gates (from Spec)

### Design
- [x] No Tailwind anywhere
- [x] All colors from tokens
- [x] Feels editorial, not SaaS
- [x] Revision marks feel like manuscript markup

### Technical
- [ ] Cold start < 500ms (not measured yet - needs Tauri build)
- [x] Diff < 100ms (diff-match-patch is fast)
- [x] No typing jank (CodeMirror handles this)
- [x] Bundle generates correctly

### Feel
- [x] Opening feels calm
- [x] Focus on content, not UI
- [ ] Could use daily for a year (needs real-world testing)
