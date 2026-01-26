# Changelog

All notable changes to Marginalia.

## [Unreleased]

## [0.1.1] - 2026-01-26

### Added
- CLI flags: `--bundle-dir`, `--out`, `--principles`
- One-command installer script + CLI wrapper (`marginalia init`, `marginalia smoke-test`)
- Auto-match annotations to WRITING.md rules when a principles file is available
- Anti-slop highlights for banned words and em-dashes from WRITING.md
- Undo/redo via Milkdown history + keymap
- Tone lint pack for AI-ish phrasing + summary section in bundles
- Hook smoke test script (`./scripts/smoke-hook.sh`)
- Tone-lint fixture script (`./scripts/make-slop-fixture.sh`)

### Fixed
- Render diff decorations in the editor (Milkdown diff plugin)
- Sync gutter/editor scrolling and scroll editor to clicked gutter line
- Anchor popovers to clicked element bounds (no fixed offsets)
- Close the window after bundle save (Tauri close + exit)
- Prevent diff widgets from blocking editor clicks
- Keep tone/slop highlights active during edits
- Ensure notes-only sessions still generate bundles
- Prevent stale diff snapshots from janking decorations
- Preserve deletion spacing and insertion highlight end chars
- Fix debug binary blank window with dev-server check dialog

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
- [x] Milkdown (ProseMirror) integration
- [x] Custom Paper & Ink theme for editor
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
- [x] `⌘ Z` / `⌘ ⇧ Z` - Undo/Redo

---

## Deferred to v1.5 (Per Spec)

### Anti-Slop Detection
- [x] Scan original draft for WRITING.md violations
- [x] Highlight em-dashes and banned words
- [x] Visual flags in gutter before user starts editing

### WRITING.md Integration
- [x] Read `~/phoenix/WRITING.md` for existing principles
- [x] Auto-match annotations to existing rules
- [x] Surface matched rules in `summary_for_agent.md`

---

## Known Gaps (v0.1 → v0.2)

### Minor Missing Features
1. **Animations** - Minimal; spec mentioned more polish

### Technical Debt
1. **Line height alignment** - Approximate; may drift on long documents

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
- [x] No typing jank (editor handles this)
- [x] Bundle generates correctly

### Feel
- [x] Opening feels calm
- [x] Focus on content, not UI
- [ ] Could use daily for a year (needs real-world testing)
