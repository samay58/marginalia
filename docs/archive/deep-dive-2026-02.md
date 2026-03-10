# Marginalia: Technical Deep Dive

A comprehensive writeup of what this project is, how it's built, and the assumptions baked into every layer. Written for external pressure testing.

---

## The Problem

When an AI agent writes a long draft, the feedback loop degrades into lossy translation. The human edits in a separate editor, then describes those edits back to the agent in natural language. Nuance dies in that translation: what changed, why it changed, and what pattern should repeat next time.

Marginalia is an attempt at a different interaction model: launch a lightweight native app *from inside the agentic CLI loop* at the exact moment a draft hits disk, capture the user's edits as structured data with short rationales, and hand the agent a machine-consumable summary it can apply immediately.

The core bet: your edits ARE the instructions. No lossy prose translation needed.

## The Disposable Software Philosophy

This is not meant to grow into a document editor. It's disposable software: open fast, do one job (capture edits + intent), get out of the way. The app exists only for the duration of a review session. When you press Esc, it writes a bundle and exits. There is no save, no file browser, no tabs, no persistence between sessions.

This philosophy drives every major design decision. It means the app can be opinionated in ways a general-purpose editor cannot: a single file per session, no document management, a fixed set of keyboard shortcuts, and a close-on-done lifecycle.

---

## Stack Choices and Rationale

### Tauri 2 (Rust shell)

The native layer is deliberately thin. `src-tauri/src/lib.rs` is 266 lines. It does exactly four things:

1. Parse CLI arguments (`open <file> --bundle-dir --out --principles`)
2. Read/write files from the filesystem
3. Save the bundle directory (a set of named files)
4. Close the application window

The Rust layer owns no business logic. All diff computation, bundle generation, and state management lives in the JavaScript frontend. Tauri was chosen over Electron for binary size and cold-start time. The app targets macOS exclusively; the window uses `titleBarStyle: Overlay`, and the frontend intercepts close requests so it can write the bundle + status JSON before exiting.

One non-obvious detail: the debug binary checks whether the Vite dev server is running on port 1420 (with a retry loop of 10 attempts at 200ms intervals). If it's not running, it shows an error dialog and exits instead of rendering a blank window. This prevents a frustrating failure mode during development.

### Svelte 5 + SvelteKit

The frontend uses Svelte 5 with the new runes syntax (`$state`, `$props`, `$derived`, `$effect`). SvelteKit is configured with `adapter-static` to produce a static SPA that Tauri serves from the filesystem. The desktop review UI lives at `src/routes/review/+page.svelte` (the `/` route is a marketing page).

State management uses Svelte stores (not runes stores) in `src/lib/stores/app.js`. This is a conscious choice: the stores are imported across multiple components and utility modules, and Svelte's writable/derived store API provides cleaner cross-component reactivity than rune-based state for this pattern. The components themselves use runes for local state.

### Milkdown (ProseMirror)

The editor is Milkdown 7, which wraps ProseMirror with a markdown-first API. This was chosen over CodeMirror because Marginalia needs WYSIWYG markdown rendering (headings render as headings, bold renders as bold) rather than syntax-highlighted source code. Milkdown provides commonmark parsing/serialization out of the box while still exposing the ProseMirror plugin system for custom decorations.

Three custom ProseMirror plugins are registered:

1. **milkdown-diff-plugin.js**: Renders diff decorations (strikethrough widgets for deletions, inline highlights for insertions)
2. **milkdown-slop-plugin.js**: Highlights tone violations and banned words from WRITING.md
3. **milkdown-history-plugin.js**: Undo/redo via ProseMirror's history module (3 lines of meaningful code)

### diff-match-patch

Google's diff-match-patch library handles the actual diffing. It operates on flat strings, not structured documents. In Marginalia, the diff is computed on the *rendered plain text* extracted from ProseMirror, not on the raw markdown source. The rationale is that users see rendered text, so diffs should reflect what they see, not the underlying markup.

The shipping implementation now tokenizes that rendered text before diffing. That keeps rewrite-sized edits coherent in the UI: whole words and short phrases survive as editorial units instead of collapsing into character shards like `oday's` / `he`.

### Vanilla CSS with Custom Properties

No Tailwind. No CSS-in-JS. The entire design system is expressed as CSS custom properties in `app.css`. The token naming follows a "Paper & Ink" metaphor:

- `--paper`, `--paper-matte`, `--paper-bright`, `--paper-edge` for backgrounds
- `--ink`, `--ink-faded`, `--ink-ghost`, `--ink-whisper` for text
- `--struck-bg`, `--struck-text`, `--struck-line` for deletion marks (muted brick, like old manuscript corrections)
- `--added-bg`, `--added-text` for insertions (deep verdigris, like editorial pen)
- `--accent` is amber, used for indicators and actions only

Dark mode is a full token override under `:root.dark`, not a filter or inversion. Each component uses scoped `<style>` blocks referencing these tokens.

---

## Architecture: How the Modules Work Together

### The Full Lifecycle

```
1. CLI/Hook invokes: marginalia open file.md --out /tmp/status.json
2. Tauri starts, parses CLI args, stores them in CliState
3. Frontend mounts, calls get_cli_options via Tauri invoke
4. Frontend calls read_file to load the markdown content
5. initializeWithContent() sets original content in stores
6. Editor.svelte initializes Milkdown with the content
7. After first render, plain text is extracted and stored as originalPlainText
8. User edits. Each keystroke:
   a. Milkdown's markdownUpdated listener fires
   b. onChange propagates the markdown source to editedContent store
   c. onPlainTextChange extracts plain text and updates editedPlainText store
   d. After 150ms debounce, diff decorations are recomputed
9. User attaches rationales via the persistent annotation column in full layout, or via the popover fallback in compact layout (both anchored to stable change IDs)
10. User presses Esc or Cmd+Enter:
    a. handleDone() runs
    b. diffResult is computed (or the reactive derived store value is used)
    c. generateBundle() produces bundle artifacts as strings
    d. save_bundle Tauri command writes them to ~/.marginalia/bundles/
    e. Status JSON is written to the --out path
    f. close_window exits the process
11. The calling hook reads the status JSON and tells the agent to read summary_for_agent.md
```

### The Diffing Pipeline

This is where the real complexity lives. The pipeline has three stages:

**Stage 1: Plain Text Extraction** (`prosemirror-text.js`)

`buildTextMap()` walks the ProseMirror document tree and produces two things: a flat string of rendered text, and an `offsets` array that maps each character index in the flat string back to a ProseMirror document position. This mapping is critical because ProseMirror positions include structural nodes (paragraphs, headings) that don't correspond to visible characters.

The offsets array has a sentinel at the end (`doc.content.size`) so that `offsetToPos(text.length)` returns the correct end position. Text blocks are separated by `\n` in the flat string.

**Stage 2: Diff Computation** (`diff.js`)

`computeDiff()` takes the original and edited plain text strings, tokenizes them into editorially meaningful units (words, whitespace, punctuation), compresses those tokens into a compact alphabet for diff-match-patch, runs `dmp.diff_main()` plus semantic/lossless cleanup, then expands the diff back into real text and builds a `Change[]` array. Each change tracks:

- `id`: A deterministic content-based hash of `type|offset|text.length|text`. New changes get deterministic IDs, then reconciliation logic tries to preserve prior IDs across routine offset shifts so annotations stay attached while the user keeps editing.
- `editedOffset`: The character position in the edited document where this change appears. Deletions don't advance this offset (they're shown at the point where text was removed). Insertions do advance it.
- `location`: Line/col computed from the edited text, used for gutter display.

The change ID scheme uses a simple hash function, not a cryptographic hash. Collisions are still theoretically possible, but the practical reliability story now comes from the combination of deterministic IDs and context-aware ID reconciliation against the prior diff snapshot.

**Stage 3: Decoration Rendering + Anchor Geometry** (`milkdown-diff-plugin.js`, `Editor.svelte`)

The diff plugin creates ProseMirror decorations from the change list. It uses the `offsets` array from `buildTextMap()` to convert `editedOffset` (position in flat text) back to ProseMirror document positions.

Insertions are rendered as inline decorations: a CSS class `added` applied to the range `[docPos, endPos]` in the document. There's careful handling of the end position to ensure the last character of an insertion is included in the highlight.

Deletions are rendered as non-editable inline widgets: a single struck manuscript span injected at the deletion offset and tagged with change metadata so the plugin-level click handler can select the underlying change. The implementation is intentionally minimal so deletions remain visible and clickable in the manuscript without becoming part of the editable text flow or triggering fragile nested hit-testing paths in WebKit.

The review desk now also has a secondary anchor layer inside the manuscript surface. Those anchors are not line-number math. `Editor.svelte` maps change offsets back into ProseMirror, resolves the containing textblock DOM nodes, and positions slim marks / selected circles / annotation badges from the block rectangles. That preserves the reliability gains from the rail-centric interaction model while restoring a visible bridge between index and manuscript.

A staleness check compares the current document's extracted text against the text snapshot stored in `_editedText` on the diff result. If they don't match (the document changed since the diff was computed), decorations are cleared to prevent misaligned highlights.

Diff decoration updates are debounced at 150ms after the last keystroke to reduce visual jumpiness during active typing.

### The Lint Pipeline

Two sources of "don't write like that" matchers:

1. **tone-lint.js**: 11 hardcoded rules for common AI-ish patterns (hedging, corporate filler, generic enthusiasm, vague intensifiers, etc.). Each rule has a regex pattern and a suggestion.

2. **writing-rules.js**: Parses a user-provided WRITING.md file (passed via `--principles`). Extracts two types of rules:
   - Numbered rules with `**bold title**` get indexed as keyword matchers
   - Items under `### Banned ...` sections become word-boundary regex matchers
   - Em-dash detection is special-cased if any rule mentions "em-dash"

Both are merged and passed to the slop plugin, which applies them as ProseMirror inline decorations with class `slop-violation`. The lint findings are also collected separately by `lint.js` for inclusion in the bundle output, with caps at 2 findings per rule and 8 total.

### The Annotation System

When a user selects a change, Marginalia keeps one selected change ID in state and routes rationale editing to one of two surfaces:

- **Full layout:** the persistent right-side annotation column
- **Compact layout:** the popover fallback

Both surfaces use the same editor model:
- Preview of the changed text
- Short rationale field
- Category chips: Tone, Clarity, Accuracy, Style, Structure
- Save/Remove controls

Annotations are stored in a `Map<changeId, Annotation>` in the Svelte store. Each annotation can optionally be matched against WRITING.md rules via the `writingRuleMatcher` function, which tokenizes the rationale and checks for keyword matches against the parsed rule index. Matched rules get surfaced as `[IMPORTANT]` items in the bundle summary.

### The Bundle Contract

On close, `generateBundle()` produces a directory with 7 files:

1. **original.md**: The raw input content (markdown source, not plain text)
2. **final.md**: The edited content (markdown source)
3. **changes.json**: Structured diff with metadata (marginalia_version, source_file, session_duration, principles_path, and the change array)
4. **annotations.json**: Rationales keyed to change IDs, plus general notes and principle candidates
5. **summary_for_agent.md**: The agent-facing summary (what changed, why it changed, what to repeat)
6. **changes.patch**: Apply-ready patch
7. **provenance.json**: Artifact hashes + metadata

The summary is the only file the agent needs to read. The structured files exist for downstream automation (tracking patterns across sessions, building rule databases).

### The Hook Integration

`hooks/post-write.sh` is a Claude Code PostToolUse hook that triggers on `Write|Edit` tool calls. The trigger logic:

1. If `MARGINALIA_REVIEW_REGEX` env var is set, match the file path against it
2. If the written content contains `<!-- REVIEW -->`, trigger
3. If the file path ends with `-draft.md`, trigger

The hook launches the app in blocking mode via the release binary, the installed CLI, the .app bundle (with `open -W`), or the debug binary (only if the dev server is running). It writes the status JSON path via `--out /tmp/marginalia-$$.json`.

After the app exits, the hook reads the status JSON and emits a `hookSpecificOutput` JSON to Claude Code with one of:
- "Read {path}/summary_for_agent.md for revision guidance"
- "User approved without changes"
- "User cancelled"
- "Error: {message}"

The fallback chain for finding the app binary: local release > installed CLI > local .app bundle > /Applications/Marginalia.app > debug binary (with dev server check). This means the hook works in development, CI, and installed contexts.

---

## The Visual Design System

### Typography

Four font stacks, each with a specific role:

- **Body** (`--font-body`): Charter, the serif face. Used for all editor content. Chosen for its readability at body sizes and manuscript feel.
- **Display** (`--font-display`): Iowan Old Style. Used for headings. Slightly more editorial than Charter.
- **UI** (`--font-ui`): System sans-serif (-apple-system). Used for chrome: header, gutter numbers, popover labels, buttons.
- **Mono** (`--font-mono`): SF Mono. Used for code blocks and the Esc hint badge.

### Color Philosophy

The palette is warm, not cool. Paper backgrounds are off-white (#FAF9F7), not sterile white. Ink colors are warm darks (#2C2825), not pure black. This is intentional: the app should feel like marking up a manuscript, not using a code editor.

Revision marks use historical color associations:
- **Struck** (deletions): Muted brick (#8B4D3B on #F5E6E1). Think old red pencil correction marks.
- **Added** (insertions): Deep verdigris (#2D5F52 on #E5F0ED). Think editorial green pen.

These are deliberately not the red/green of a traditional diff viewer. Red/green carries "error/success" connotation; brick/verdigris carries "was/now" connotation.

### Spacing and Metrics

The spacing scale is a 4px base: 4, 8, 12, 16, 24, 32, 40. The editor has a max content width of 42rem (672px at 16px base), enforcing a readable line length. The gutter is 3.5rem wide. Line height is 1.6875rem (27px), which is generous for serif body text.

Border radii are small: 4px, 6px, 8px. Nothing rounds past 8px. Shadows are subtle warm-toned rgba with the ink color base.

### Glass Surface

A `.glass-surface` utility class applies backdrop-filter blur, translucent background, and subtle border. It now belongs primarily to the fixed chrome: header and status strip. The review desk panels themselves lean on quieter static surfaces so the manuscript stays visually central and the app avoids becoming a glass-heavy productivity UI.

### Dark Mode

Dark mode is not an afterthought: it has hand-tuned values for every token. Paper becomes deep warm dark (#1C1A18), ink becomes warm light (#EBE8E4). The struck/added colors shift to darker backgrounds with lighter text, preserving the same brick/verdigris hue at different lightness. Shadows go from warm rgba to cold rgba (more opacity needed against dark backgrounds).

Dark mode toggles by checking `prefers-color-scheme: dark` on mount and listening for changes. It adds/removes a `dark` class on `<html>`.

---

## Assumptions Worth Pressure Testing

### 1. Plain text diffing is correct

The decision to diff rendered plain text (not markdown source) means a user who changes `**bold**` to `*italic*` sees a diff of the rendered text changing from "bold" to "italic", not the markup characters changing. This is usually what you want, but it means structural-only changes (e.g., changing a paragraph to a heading without changing text) produce no diff.

The alternative (diffing markdown source) would show markup changes as edits, which would be noisy for the user but more complete. The current approach assumes users primarily care about textual content, not document structure.

### 2. Content-based change IDs are stable enough

Change IDs are deterministic, but deterministic IDs alone are not enough. Routine editing shifts offsets and rewrites surrounding text, so Marginalia now reconciles new diffs against the previous snapshot using text similarity, local before/after context anchors, and offset distance. That materially improves annotation survival, especially for repeated similar edits.

The remaining risk is not simple offset shift anymore; it is large rewrites that genuinely change the change text and context enough that the old edit is no longer meaningfully the same edit. In those cases, losing the prior attachment is the right behavior.

### 3. The debounce timing is right

Diff decorations update 150ms after the last keystroke. Too short and decorations jump around during typing. Too long and the user feels lag. 150ms was chosen empirically but hasn't been tested on slower machines or with very large documents.

### 4. Single file per session is the right scope

The app loads one file and reviews it. There's still reference support (up to 3 read-only files via Cmd+Shift+O, persisted in localStorage), but references are now secondary to the review flow: a pane mode in full layout and a drawer in compact layout. The core interaction remains single-file review with rationale capture, not multi-document editing.

### 5. The bundle format is the right contract

Five files feels like a lot. The agent only reads `summary_for_agent.md`. The structured files (`changes.json`, `annotations.json`) exist for potential downstream automation that doesn't exist yet. If that automation never materializes, the bundle is over-engineered. If it does, having structured data from day one is valuable.

### 6. PostToolUse hook is the right trigger point

The hook fires on every `Write|Edit` tool call, then checks whether the file matches trigger patterns. This means it fires frequently (on every file write) but exits immediately for non-matching files. The alternative would be a more targeted matcher in the hook config, but that pushes pattern logic into Claude Code settings JSON instead of the hook script.

The 30-minute timeout (1800000ms) is the maximum a review session can last before Claude Code kills the hook. This is generous but means a forgotten Marginalia window will block the agent for 30 minutes.

### 7. Blocking is essential

The entire design assumes the hook blocks the agent while the user reviews. If the agent continues working on other things during review, the feedback is stale by the time it arrives. This is a strong assumption: it means Marginalia can only work in a synchronous agent loop. An async model (agent continues, user reviews later, feedback applied in a new turn) would require a fundamentally different integration.

### 8. The anti-slop detection is useful

The tone lint rules are hardcoded opinions about what constitutes AI-ish writing. "I believe", "Furthermore", "significant", "world-class" all trigger. This is useful for the author of these rules but may not generalize. There's no mechanism for users to disable built-in rules; they can only add rules via WRITING.md.

The WRITING.md parser is also opinionated: it expects numbered rules with bold titles and banned-word sections with specific heading formats. A user with a differently structured writing guide would get no benefit.

### 9. Milkdown is the right editor framework

Milkdown wraps ProseMirror, which means the position mapping between flat text and document structure is complex (the entire `prosemirror-text.js` / `buildTextMap()` pipeline exists because of this). A CodeMirror-based approach would have simpler position mapping (it works with flat text natively) but wouldn't provide WYSIWYG rendering. A Tiptap-based approach would be similar to Milkdown but with a different API surface.

The ProseMirror decoration system is powerful but has sharp edges: widget decorations must be carefully positioned to avoid disrupting the editing flow, and the `contenteditable: false` attribute on deletion widgets can cause cursor navigation issues. Marginalia mitigates that by keeping deletion widgets visually small, non-editable, and activation-focused rather than trying to make them behave like editable text.

---

## What's Working

- The editorial aesthetic is coherent. Paper & Ink tokens, serif body text, manuscript-style revision marks. It doesn't look like a SaaS app.
- The bundle format captures everything needed for agent revision. summary_for_agent.md is concise and actionable.
- The CLI and hook integration covers development, installed, and CI scenarios.
- The installer is a single curl command that handles app, CLI, and hook installation.
- Writing rules parsing and auto-matching is a genuinely useful feature for repeat users.

## What's Fragile

- The diff decoration pipeline has multiple coordinate systems (flat text offset, ProseMirror position, line/col, screen coordinates) and the mapping between them is the source of most reported bugs.
- Deletion widgets must stay visually minimal; richer nested DOM inside the editable manuscript can trigger browser hit-testing instability.
- Gutter line numbers are computed from newline counts in plain text, which can drift from ProseMirror's visual line layout for long paragraphs that wrap.
- The reference panel renders content in a `<pre>` tag, not in the editor, so it's read-only and loses formatting.
- Dark mode uses a class toggle on `<html>`, which means a flash of wrong-mode content is possible on cold start before JavaScript runs.

## What's Missing

- No test suite of any kind (unit, integration, or e2e)
- No ESLint or Prettier configuration
- No error boundary: a crash in the diff pipeline could leave the app in a broken state with no recovery
- No telemetry or usage tracking (by design, but makes it hard to understand adoption patterns)
- No way to customize the built-in tone rules without editing source code
- The `closable: false` trick means users can't Cmd+W the window; they must use Esc or the Done button, which is non-standard macOS behavior

---

## Code Patterns to Note

### State flows downward, events flow upward

`+page.svelte` is the orchestrator. It passes data down as props and receives events via callback props. Components don't directly mutate the store; they call functions exported from `stores/app.js`. This is a deliberate architectural choice: the store module is the single source of truth, and all mutations go through its exported functions.

### Derived stores do the heavy lifting

`diffResult` is a derived store that auto-recomputes whenever `originalPlainText` or `editedPlainText` changes. This means the diff is always fresh without manual invalidation. Similarly, `linesWithChanges`, `linesWithAnnotations`, `linesWithSlop`, and `changeSummary` are all derived. The component tree simply subscribes to these stores and re-renders when values change.

### ProseMirror plugins use closures for external state

The diff and slop plugins take getter functions (`getDiffResult`, `getSlopMatchers`) rather than direct values. This is because ProseMirror plugins are initialized once and the getter is called on each transaction to get the current state from outside the plugin system. It's a bridge between Svelte's reactive system and ProseMirror's transaction-based system.

### The bundle generator is pure

`generateBundle()` takes all its inputs as arguments and returns a plain object with string values. It has no side effects and doesn't touch the filesystem. The Tauri `save_bundle` command handles actual I/O. This makes the bundle logic testable in isolation (if tests existed).

---

## Open Questions for Pressure Testing

1. Is the edit-capture-as-instructions model actually better than natural language feedback for AI revision? What evidence exists either way?
2. Does the blocking-hook model scale to longer documents (5,000+ words) where review might take 20+ minutes?
3. Is the bundle directory over-engineered if the agent only reads the summary? Should the contract be simpler?
4. Should the tone lint rules be configurable or are opinionated defaults the right call?
5. Is Tauri the right choice for cold-start performance, or would a web-based approach (launched via `open` to a local server) be faster?
6. Does the plain-text diffing model hold up for documents with significant structural markup (tables, code blocks, nested lists)?
7. Is the Paper & Ink design vocabulary too specific (literary, editorial) for users who are reviewing technical documents, product specs, or code documentation?
8. Should the annotation system support multi-change grouping (annotating a pattern across multiple edits) rather than single-change rationales?
9. Is there a path to making this work with non-Claude agentic loops, or is the hook integration too Claude-specific?
10. The CODEX-HANDOFF.md notes that adoption dropped off after 4 days. Is that a polish problem (fixable bugs) or a conceptual problem (the interaction model doesn't reduce enough friction to justify a context switch)?
