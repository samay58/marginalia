# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product Improvement Handoff

**If you're here to investigate issues and plan improvements**, read:
- `CODEX-HANDOFF.md` - Full context, failure modes, and deliverables
- Session packet at `~/phoenix/01-active/current-personal-projects/marginalia/session-packet-2026-01-25/`

The project has 10 open issues and adoption dropped off after 4 days of real use.

---

## What is Marginalia?

A native macOS app for reviewing AI-generated drafts. Users make inline edits, add short rationales ("no hedging", "quantify the miss"), and Marginalia outputs a structured bundle that Claude can read to revise correctly.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm tauri dev        # Development server with hot reload (first run compiles Rust, ~2min)
pnpm tauri build      # Production build → target/release/bundle/macos/Marginalia.app
pnpm build            # Frontend only (Vite)
pnpm check            # Svelte type checking
```

No test suite is configured.

## Testing (Fast)

```bash
./scripts/smoke-hook.sh
```

This runs the hook locally, opens Marginalia, blocks until you exit, and verifies the bundle summary exists.

### Feedback Without Text Edits

- Use **General notes** (`⌘ G`) for feedback that isn’t tied to a specific edit.
- Annotations (`⌘ /`) are attached to a diff change; you need at least one edit on a line to add one.
- Use `Esc` / `⌘ Enter` / **Done** to save. `⌘ Q` cancels.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close, output bundle |
| `⌘ Enter` | Same as Esc |
| `⌘ O` | Open file picker |
| `⌘ /` | Add comment to current edit |
| `⌘ G` | Toggle general notes panel |
| `⌘ Z` / `⌘ ⇧ Z` | Undo / Redo |

## Architecture

### Stack
- **Shell**: Tauri 2.0 (Rust backend)
- **Frontend**: Svelte 5 with SvelteKit
- **Editor**: Milkdown (ProseMirror-based markdown editor)
- **Diff**: diff-match-patch library
- **Styling**: Vanilla CSS with custom properties (no Tailwind)

### Data Flow

```
CLI args → Tauri (lib.rs) → Svelte stores (app.js) → Editor
                                    ↓
                              diff computed
                                    ↓
User edits → diffResult → milkdown-diff-plugin → decorations
                                    ↓
                         bundle.js → save_bundle (Rust)
```

### Key Files

**Frontend** (`src/`):
- `routes/+page.svelte` - Main app page, orchestrates components and keyboard handling
- `lib/stores/app.js` - Centralized state: content, diffResult, annotations, slopMatchers
- `lib/components/Editor.svelte` - Milkdown wrapper with diff/slop plugins
- `lib/components/Gutter.svelte` - Line numbers with change/annotation indicators
- `lib/components/AnnotationPopover.svelte` - Rationale input with category chips

**Utilities** (`src/lib/utils/`):
- `diff.js` - computeDiff() using diff-match-patch, tracks editedOffset for decorations
- `bundle.js` - generateBundle() creates the 5-file output structure
- `milkdown-diff-plugin.js` - ProseMirror plugin for struck/added decorations
- `milkdown-slop-plugin.js` - ProseMirror plugin for WRITING.md violation highlights
- `prosemirror-text.js` - buildTextMap() maps plain text offsets to doc positions
- `writing-rules.js` - Parses WRITING.md to create violation matchers

**Rust Backend** (`src-tauri/src/lib.rs`):
- `read_file`, `write_file` - Filesystem access
- `save_bundle` - Creates bundle directory with all files
- `get_cli_options` - Parses `--bundle-dir`, `--principles`, `--out` flags
- `close_window` - Clean exit after bundle save

### Bundle Output Structure

When user presses Esc or ⌘Enter, generates to `~/phoenix/.marginalia/bundles/[timestamp]_[filename]/`:
- `original.md` - Original content
- `final.md` - Edited version
- `changes.json` - Structured diff with change IDs and locations
- `annotations.json` - User rationales mapped to change IDs
- `summary_for_agent.md` - Human-readable summary for Claude

### State Management

Svelte stores in `app.js`:
- `originalContent` / `editedContent` - Raw markdown
- `originalPlainText` / `editedPlainText` - Rendered text for accurate diffing
- `diffResult` - Derived store, recomputes when plain text changes
- `annotations` - Map<changeId, Annotation>
- `slopMatchers` - Array of regex patterns from WRITING.md

### Diff Plugin Architecture

The milkdown-diff-plugin creates ProseMirror decorations:
- Deletions → Widget decorations (struck-through spans inserted at position)
- Insertions → Inline decorations (highlight existing text with `.added` class)

Position mapping uses `buildTextMap()` which creates an `offsets` array mapping each character index in plain text to its corresponding ProseMirror document position.

## Svelte 5 Patterns

This project uses Svelte 5 runes syntax:
- Props: `let { content, onChange } = $props()` (not `export let`)
- Local state: `let value = $state(false)`
- Effects: `$effect(() => { ... })`
- Event handlers: `onclick={handler}` (not `on:click={handler}`)

## Design System

"Paper & Ink" aesthetic - editorial markup on quality paper.

Key CSS custom properties in `app.css`:
- Paper: `--paper` (#FAF9F7), `--paper-matte`, `--paper-edge`
- Ink: `--ink` (#2C2825), `--ink-faded`, `--ink-ghost`
- Revision marks: `--struck-*` (brick red), `--added-*` (verdigris)
- Typography: Charter (body), Iowan Old Style (display), SF Mono (code)

## CLI Usage

```bash
marginalia open ./draft.md                          # Basic usage
marginalia open ./draft.md --bundle-dir ~/bundles   # Custom output directory
marginalia open ./draft.md --out /tmp/path.txt      # Write bundle path to file
marginalia open ./draft.md --principles ~/WRITING.md # Custom principles file
```

## Claude Code Integration

The app integrates via PostToolUse hook. See `hooks/post-write.sh` for pattern matching:
- `*-draft.md` files
- `<!-- REVIEW -->` marker in content

Hook writes bundle path to `--out` file for Claude to read back.
