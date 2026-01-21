# Building Marginalia: A Complete Walkthrough

This document explains how Marginalia was built, the decisions we made along the way, and why. It's meant to be read cover-to-cover.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution](#the-solution)
3. [Design Philosophy: Paper & Ink](#design-philosophy-paper--ink)
4. [Tech Stack Decisions](#tech-stack-decisions)
5. [Architecture Overview](#architecture-overview)
6. [The Diff System](#the-diff-system)
7. [The Bundle Format](#the-bundle-format)
8. [Claude Code Integration](#claude-code-integration)
9. [Evolution from Spec](#evolution-from-spec)
10. [The Hardest Problems](#the-hardest-problems)

---

## The Problem

Here's the workflow that Marginalia replaces:

```
┌─────────────────────────────────────────────────────────────────┐
│  THE OLD WAY (frustrating)                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Claude drafts an IC memo                                    │
│                    ↓                                            │
│  2. You copy it to Obsidian or another editor                   │
│                    ↓                                            │
│  3. You mark it up, making changes                              │
│                    ↓                                            │
│  4. You describe your changes in prose back to Claude:          │
│     "Remove the hedging language in paragraph 2,                │
│      and quantify the miss in Q3..."                            │
│                    ↓                                            │
│  5. Claude misinterprets half of them                           │
│                    ↓                                            │
│  6. You repeat steps 4-5 until exhausted                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The fundamental issue: **prose is a lossy format for describing edits**. When you say "remove the hedging," Claude has to guess which words you mean. When you say "quantify the miss," Claude might add numbers in the wrong place.

What if Claude could see exactly what you changed, character by character?

---

## The Solution

Marginalia is a native macOS app that:

1. Opens a draft file
2. Lets you edit it directly
3. Tracks every change you make
4. Lets you add short rationales ("no hedging", "quantify")
5. Outputs a structured bundle that Claude can read perfectly

```
┌─────────────────────────────────────────────────────────────────┐
│  THE MARGINALIA WAY                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Claude writes draft → ic-memo-draft.md                      │
│                    ↓                                            │
│  2. Marginalia opens automatically (hook)                       │
│                    ↓                                            │
│  3. You edit inline, add 3-word rationales                      │
│     ┌──────────────────────────────────────┐                    │
│     │  "arguably" → deleted, "no hedging"  │                    │
│     │  "significant" → "47%", "quantify"   │                    │
│     └──────────────────────────────────────┘                    │
│                    ↓                                            │
│  4. Press Esc. Bundle outputs.                                  │
│                    ↓                                            │
│  5. Claude reads structured diff, revises correctly             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The key insight: **your edits ARE the instructions**. No translation needed.

---

## Design Philosophy: Paper & Ink

Before writing any code, we established a visual language. This matters more than you might think. The aesthetic shapes how the tool feels to use, and how seriously you take the edits you're making.

### The Metaphor

Marginalia should feel like annotating a manuscript with a fountain pen on quality paper. Not like using a SaaS app with colored badges and notification dots.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   What we're NOT building:          What we ARE building:       │
│                                                                 │
│   ┌─────────────────────┐           ┌─────────────────────┐     │
│   │ ▶ CHANGES (3) ────  │           │                     │     │
│   │ 🔴 Line 12: deleted │           │  The company has    │     │
│   │ 🟢 Line 14: added   │           │  arguably achieved  │     │
│   │ ⚠️  Warning: long   │           │  ~~~~~~~~           │     │
│   └─────────────────────┘           │  significant growth │     │
│                                     │  ~~~~~~~~~~         │     │
│   Tech dashboard                    │  47% growth         │     │
│   with alerts                       │                     │     │
│                                     └─────────────────────┘     │
│                                                                 │
│                                     Manuscript with             │
│                                     pen marks                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Color Palette

Every color has a reason:

```css
/* PAPER - Warm, off-white. Not sterile hospital white. */
--paper: #FAF9F7;        /* Main background - aged paper */
--paper-matte: #F5F4F0;  /* Slightly darker for panels */
--paper-edge: #E8E6E1;   /* Borders and dividers */

/* INK - Deep and warm. Not harsh pure black. */
--ink: #2C2825;          /* Main text - like real ink */
--ink-faded: #6B655D;    /* Secondary text */
--ink-ghost: #A39E94;    /* Hints and placeholders */

/* REVISION MARKS */
--struck-text: #8B4D3B;  /* Muted brick red - old correction marks */
--added-text: #2D5F52;   /* Deep verdigris - editorial insertions */
```

Why these specific colors?

- **#FAF9F7 (paper)**: Pure white (#FFFFFF) feels clinical. This warm off-white has a touch of cream, like aged paper.
- **#2C2825 (ink)**: Pure black (#000000) is harsh on screens. This warm near-black has brown undertones, like actual ink.
- **#8B4D3B (struck)**: Red for deletions is a cliché, but this specific muted brick recalls old editorial marks, not error states.
- **#2D5F52 (added)**: Green for additions, but verdigris specifically. It's the color of aged copper, of permanence.

### Typography

```css
--font-body: "Charter", "Bitstream Charter", Cambria, serif;
--font-display: "Iowan Old Style", Palatino, Georgia, serif;
--font-ui: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
```

Why serif for the body text?

Because you're editing a *document*, not filling out a form. Serif fonts say "this is text worth reading." The UI chrome uses system fonts to stay out of the way.

### The "No Tailwind" Rule

We deliberately avoided Tailwind CSS. Not because Tailwind is bad, but because:

1. **Consistency**: With CSS custom properties, every color comes from a single source of truth
2. **Aesthetic control**: Tailwind's utility classes encourage "good enough" combinations. We wanted exact values.
3. **Simplicity**: 200 lines of CSS tokens is easier to understand than scattered utility classes

---

## Tech Stack Decisions

### The Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        MARGINALIA STACK                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Svelte 5 Frontend                     │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐│   │
│  │  │   Editor    │ │   Gutter    │ │  Annotation Popover ││   │
│  │  │ (Milkdown)  │ │ (line nums) │ │    (rationales)     ││   │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘│   │
│  │                                                          │   │
│  │  ┌─────────────────────────────────────────────────────┐│   │
│  │  │              Svelte Stores (State)                  ││   │
│  │  │  originalContent, editedContent, diffResult,        ││   │
│  │  │  annotations, slopMatchers                          ││   │
│  │  └─────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ invoke()                         │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Tauri 2.0 (Rust)                       │   │
│  │                                                          │   │
│  │  • read_file / write_file                                │   │
│  │  • save_bundle (creates output directory)                │   │
│  │  • get_cli_options (parses command line)                 │   │
│  │  • Native file dialogs via plugin                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Tauri?

We needed a native macOS app, not a web app. Options considered:

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **Electron** | Mature, lots of examples | 150MB+ bundle, RAM hungry | ❌ |
| **Tauri** | 5MB bundle, native performance | Newer, Rust learning curve | ✅ |
| **Swift/AppKit** | True native | Separate from web skills, slower iteration | ❌ |

Tauri won because:
- The final app is ~5MB instead of 150MB
- It uses the system WebView, not bundled Chromium
- Rust backend means we can do file I/O safely
- We get to keep using web tech for the UI

### Why Svelte 5?

We needed a reactive frontend framework. Options:

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **React** | Ubiquitous, tons of libraries | Boilerplate, bundle size | ❌ |
| **Vue** | Good DX, lighter than React | Still fairly large | ❌ |
| **Svelte 5** | Tiny output, true reactivity, new runes syntax | Newer, smaller ecosystem | ✅ |

Svelte 5's "runes" syntax is particularly clean:

```javascript
// State declaration
let count = $state(0);

// Props
let { content, onChange } = $props();

// Derived values
let doubled = $derived(count * 2);

// Effects (side effects when dependencies change)
$effect(() => {
  console.log('Count changed to', count);
});
```

No useState, no useEffect, no dependency arrays. Just JavaScript with some compiler magic.

### Why Milkdown?

We needed a markdown editor with these capabilities:
1. Render markdown as you type (WYSIWYG-ish)
2. Allow custom decorations (for diff highlighting)
3. Give us access to the document structure (for position mapping)

Options:

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **CodeMirror 6** | Powerful, great for code | More code-focused, heavier | ❌ |
| **Tiptap** | ProseMirror-based, nice API | Large bundle | ❌ |
| **Milkdown** | ProseMirror-based, markdown-first, modular | Newer | ✅ |

Milkdown is a thin wrapper around ProseMirror, specifically designed for markdown. This matters because:

1. **ProseMirror's plugin system** lets us inject custom decorations
2. **Document model** gives us character-level position information
3. **Markdown-first** means we don't fight the abstraction

### Why diff-match-patch?

For computing the difference between original and edited text:

```javascript
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();
const diffs = dmp.diff_main(original, edited);
dmp.diff_cleanupSemantic(diffs);

// Result: array of [operation, text] pairs
// operation: -1 = deletion, 0 = equal, 1 = insertion
```

This library:
- Is battle-tested (used in Google Docs)
- Handles edge cases well (Unicode, whitespace)
- Has semantic cleanup (groups related changes)
- Is tiny (~10KB)

---

## Architecture Overview

### Data Flow

Here's how data moves through the system:

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                                │
└─────────────────────────────────────────────────────────────────┘

   STARTUP
   ═══════
   CLI args ──────► Tauri parses ──────► Frontend receives
       │                                        │
       │            ┌───────────────────────────┘
       │            │
       ▼            ▼
   "marginalia open ./draft.md"    invoke('get_cli_options')
                                            │
                                            ▼
                                   invoke('read_file')
                                            │
                                            ▼
                                   initializeWithContent()
                                            │
                                   ┌────────┴────────┐
                                   │                 │
                                   ▼                 ▼
                           originalContent    editedContent
                               (store)           (store)


   EDITING
   ═══════
   User types ──────► Milkdown ──────► markdownUpdated callback
                                               │
                      ┌────────────────────────┘
                      │
                      ▼
              Extract plain text (buildTextMap)
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
   editedPlainText           editedContent
       (store)                  (store)
         │
         │ Derived store computes diff
         ▼
   ┌─────────────────────────────────────────┐
   │              diffResult                  │
   │  {                                       │
   │    changes: [                            │
   │      { id: 'c_abc', type: 'deletion',    │
   │        text: 'arguably', editedOffset: 47 },
   │      { id: 'c_def', type: 'insertion',   │
   │        text: '47%', editedOffset: 112 }  │
   │    ],                                    │
   │    _editedText: '...' // for verification│
   │  }                                       │
   └─────────────────────────────────────────┘
         │
         │ Plugin reads diffResult
         ▼
   ┌─────────────────────────────────────────┐
   │         milkdown-diff-plugin             │
   │                                          │
   │  For each change:                        │
   │    1. Map editedOffset → doc position    │
   │    2. Create decoration at that position │
   │       • deletion → widget (struck span)  │
   │       • insertion → inline highlight     │
   └─────────────────────────────────────────┘


   OUTPUT
   ══════
   User presses Esc ──────► handleDone()
                                 │
                                 ▼
                         generateBundle()
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
         original.md        changes.json    summary_for_agent.md
         final.md          annotations.json
              │                  │                  │
              └──────────────────┴──────────────────┘
                                 │
                                 ▼
                    invoke('save_bundle', { files })
                                 │
                                 ▼
                    ~/phoenix/.marginalia/bundles/
                    └── 2026-01-20T14-30-00_draft/
                        ├── original.md
                        ├── final.md
                        ├── changes.json
                        ├── annotations.json
                        └── summary_for_agent.md
```

### State Management

We use a hybrid approach: Svelte stores for global state, local `$state()` for component-specific state.

```
┌─────────────────────────────────────────────────────────────────┐
│                      STATE ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────┘

   GLOBAL (Svelte stores in app.js)
   ════════════════════════════════
   ┌─────────────────────────────────────────────────────────────┐
   │                                                             │
   │  Writable stores (can be set directly):                     │
   │  • originalContent    - The file as loaded                  │
   │  • editedContent      - Current markdown                    │
   │  • originalPlainText  - Rendered text snapshot              │
   │  • editedPlainText    - Current rendered text               │
   │  • annotations        - Map<changeId, annotation>           │
   │  • slopMatchers       - Regex patterns from WRITING.md      │
   │                                                             │
   │  Derived stores (computed automatically):                   │
   │  • diffResult         - Computed from plainText stores      │
   │  • hasChanges         - originalContent !== editedContent   │
   │  • changeSummary      - "3 deletions, 2 insertions"         │
   │  • linesWithChanges   - Set of line numbers                 │
   │  • linesWithSlop      - Lines with WRITING.md violations    │
   │                                                             │
   └─────────────────────────────────────────────────────────────┘

   LOCAL (component $state())
   ══════════════════════════
   ┌─────────────────────────────────────────────────────────────┐
   │  +page.svelte:                                              │
   │  • popoverVisible, popoverX, popoverY                       │
   │  • notesExpanded                                            │
   │  • isDark                                                   │
   │                                                             │
   │  Editor.svelte:                                             │
   │  • editor (Milkdown instance)                               │
   │  • isReady                                                  │
   │  • isInternalUpdate (prevents feedback loops)               │
   └─────────────────────────────────────────────────────────────┘
```

Why this split?

- **Global stores** for data that multiple components need (the document, the diff)
- **Local state** for UI concerns that don't need to be shared (is the popover open?)

---

## The Diff System

This is the most complex part of Marginalia. Let's break it down.

### The Challenge

We need to:
1. Compute what changed between original and edited text
2. Show those changes visually in the editor
3. Keep the visual decorations aligned as the user continues editing

The third part is the hard one.

### Step 1: Computing the Diff

```javascript
// In diff.js

export function computeDiff(original, edited) {
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(original, edited);
  dmp.diff_cleanupSemantic(diffs);  // Groups related changes

  const changes = [];
  let editedOffset = 0;  // Track position in EDITED text

  for (const [operation, text] of diffs) {
    if (operation === -1) {  // Deletion
      changes.push({
        id: generateChangeId('deletion', text, editedOffset),
        type: 'deletion',
        text,
        editedOffset,  // Where in edited doc this deletion "happened"
      });
      // Don't advance offset - deleted text isn't in edited doc
    } else if (operation === 1) {  // Insertion
      changes.push({
        id: generateChangeId('insertion', text, editedOffset),
        type: 'insertion',
        text,
        editedOffset,
      });
      editedOffset += text.length;  // Insertion IS in edited doc
    } else {  // Equal
      editedOffset += text.length;
    }
  }

  return {
    changes,
    _editedText: edited,  // Store for verification later
  };
}
```

Key insight: We track `editedOffset`, the position in the *edited* document. This is where we'll place decorations.

### Step 2: Mapping Text Offsets to Document Positions

ProseMirror (which Milkdown uses) has its own document model. A "position" in ProseMirror isn't a simple character offset - it accounts for node boundaries.

```javascript
// In prosemirror-text.js

export function buildTextMap(doc) {
  let text = '';
  const offsets = [];  // offsets[charIndex] = docPosition

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        text += node.text[i];
        offsets.push(pos + i);  // Map each char to its doc position
      }
    } else if (node.isBlock) {
      if (text.length > 0 && !text.endsWith('\n')) {
        text += '\n';
        offsets.push(pos);
      }
    }
    return true;
  });

  return { text, offsets };
}
```

This gives us:
- `text`: The plain text the user sees
- `offsets`: An array mapping each character index to its ProseMirror position

### Step 3: Creating Decorations

```javascript
// In milkdown-diff-plugin.js

function createDiffDecorations(doc, diffResult, onClickChange) {
  if (!diffResult?.changes?.length) {
    return DecorationSet.empty;
  }

  const textMap = buildTextMap(doc);

  // CRITICAL: Verify text matches what was diffed
  if (diffResult._editedText && textMap.text !== diffResult._editedText) {
    return DecorationSet.empty;  // Stale diff, skip
  }

  const decorations = [];

  for (const change of diffResult.changes) {
    const docPos = textMap.offsets[change.editedOffset];
    if (docPos === null) continue;

    if (change.type === 'deletion') {
      // Widget decoration: insert a span showing deleted text
      decorations.push(
        Decoration.widget(docPos, () => {
          const span = document.createElement('span');
          span.className = 'struck';
          span.textContent = change.text;
          return span;
        })
      );
    } else if (change.type === 'insertion') {
      // Inline decoration: highlight the inserted text
      const endPos = textMap.offsets[change.editedOffset + change.text.length];
      decorations.push(
        Decoration.inline(docPos, endPos, { class: 'added' })
      );
    }
  }

  return DecorationSet.create(doc, decorations);
}
```

### The Race Condition Problem

Here's a subtle bug we had to fix:

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE RACE CONDITION                           │
└─────────────────────────────────────────────────────────────────┘

   Time ──────────────────────────────────────────────────────►

   T1: User types 'x'
       │
       ▼
   T2: ProseMirror processes transaction
       diffPlugin.apply() runs with OLD diffResult
       │
       ▼
   T3: markdownUpdated callback fires
       Stores update
       NEW diffResult computed
       │
       ▼
   T4: requestAnimationFrame triggers diffPlugin update
       NOW it has the correct diffResult

   PROBLEM: At T2, we might create decorations using old diffResult
            but the document has already changed. Misaligned widgets!
```

**The Fix**: Text verification

Before creating decorations, we check if the current document text matches what was diffed:

```javascript
if (diffResult._editedText && textMap.text !== diffResult._editedText) {
  return DecorationSet.empty;  // Stale diff, wait for update
}
```

If they don't match, we return empty decorations. The next update cycle will have the correct data.

### Stable Change IDs

Another bug: every time we recomputed the diff, changes got new random IDs. This broke annotations.

**Before** (broken):
```javascript
function generateChangeId() {
  return 'c_' + Math.random().toString(36).substring(2, 8);
}
```

**After** (stable):
```javascript
function generateChangeId(type, text, offset) {
  const input = type + '|' + offset + '|' + text.slice(0, 50);
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return 'c_' + Math.abs(hash).toString(36);
}
```

Now the same change always gets the same ID, so annotations persist.

---

## The Bundle Format

When you press Esc, Marginalia outputs a bundle. This is the contract between you and Claude.

```
~/phoenix/.marginalia/bundles/2026-01-20T14-30-00_ic-memo/
├── original.md          # What Claude wrote
├── final.md             # What you changed it to
├── changes.json         # Structured diff
├── annotations.json     # Your rationales
└── summary_for_agent.md # Human-readable summary
```

### changes.json

```json
{
  "marginalia_version": "1.0",
  "source_file": "/path/to/ic-memo-draft.md",
  "reviewed_at": "2026-01-20T14:30:00.000Z",
  "session_duration_seconds": 180,
  "changes": [
    {
      "id": "c_a1b2c3",
      "type": "deletion",
      "text": "arguably",
      "location": { "line": 12, "col": 45 }
    },
    {
      "id": "c_d4e5f6",
      "type": "insertion",
      "text": "47%",
      "location": { "line": 18, "col": 22 }
    }
  ]
}
```

### annotations.json

```json
{
  "annotations": [
    {
      "change_ids": ["c_a1b2c3"],
      "rationale": "no hedging",
      "category": "tone",
      "writing_md_rule": "Avoid hedging language like 'arguably', 'potentially'"
    }
  ],
  "general_notes": "Overall tighten the prose, more specific numbers",
  "principle_candidates": []
}
```

### summary_for_agent.md

```markdown
# Review: ic-memo-draft.md
2026-01-20 · 3 min

## Changes
2 deletions, 1 insertion

## Feedback (by priority)
1. [IMPORTANT] no hedging
   - "arguably"
   - Matches WRITING.md: Avoid hedging language

2. quantify growth
   - "significant" → "47%"
   - Category: accuracy

## General
Overall tighten the prose, more specific numbers
```

Claude can read `summary_for_agent.md` for a quick overview, or parse the JSON for exact changes.

---

## Claude Code Integration

Marginalia integrates with Claude Code via a PostToolUse hook.

### How Hooks Work

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOOK FLOW                                    │
└─────────────────────────────────────────────────────────────────┘

   Claude Code writes a file
           │
           ▼
   PostToolUse hook triggers
           │
           ▼
   hooks/post-write.sh receives JSON:
   {
     "tool_input": {
       "file_path": "/path/to/ic-memo-draft.md",
       "content": "# Investment Memo..."
     }
   }
           │
           ▼
   Script checks patterns:
   • *-draft.md?           ──► should_review=true
   • <!-- REVIEW --> in content? ──► should_review=true
           │
           ▼
   If should_review:
     marginalia open "$file_path" &
```

### The Hook Script

```bash
#!/bin/bash
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // empty')

should_review=false

# Pattern matching
[[ "$file_path" == *-draft.md ]] && should_review=true
[[ "$content" == *"<!-- REVIEW -->"* ]] && should_review=true

if [[ "$should_review" == true ]]; then
    marginalia open "$file_path" &
fi
```

The `&` at the end is important - it runs Marginalia in the background so Claude Code doesn't wait.

---

## Evolution from Spec

We built Marginalia in 7 phases, tracked via beads (our issue tracker).

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUILD PHASES                                 │
└─────────────────────────────────────────────────────────────────┘

   Phase 1: Foundation
   ═══════════════════
   • Tauri + Svelte scaffold
   • CSS design tokens (Paper & Ink)
   • Basic window layout

   Phase 2: Editor
   ═══════════════
   • Milkdown integration
   • Custom theme
   • Gutter with line numbers

   Phase 3: Diff
   ═════════════
   • diff-match-patch integration
   • Change tracking
   • Visual decorations

   Phase 4: Comments
   ═════════════════
   • Annotation popover
   • Rationale input
   • Category chips

   Phase 5: Output
   ═══════════════
   • Bundle generation
   • Rust file I/O
   • CLI argument parsing

   Phase 6: Polish
   ═══════════════
   • Dark mode
   • Transitions
   • Edge cases

   Phase 7: Integration
   ════════════════════
   • Claude Code hook
   • Pattern matching
   • WRITING.md integration
```

### What Changed from Original Spec

Very little, actually. The main adaptations:

1. **Svelte 5 syntax**: Used new runes (`$state`, `$props`) instead of older syntax
2. **ProseMirror position mapping**: The spec didn't anticipate how complex this would be
3. **Text verification for diff stability**: Added after discovering race conditions

### What We Deferred

- Fancy animations (kept minimal)
- Perfect line height alignment (approximate is good enough)
- Some advanced WRITING.md features

---

## The Hardest Problems

### 1. ProseMirror Position Mapping

The hardest conceptual problem. ProseMirror positions aren't character offsets - they include node boundaries.

```
Document: "Hello\n\nWorld"

Character view:   H e l l o \n \n W o r l d
Char offsets:     0 1 2 3 4 5  6  7 8 9 10 11

ProseMirror view: [paragraph][text: Hello][/paragraph]
                  [paragraph][text: World][/paragraph]

PM positions:     0         1 2 3 4 5    6
                  7         8 9 10 11 12 13
```

The `buildTextMap` function bridges this gap by walking the document and recording both.

### 2. Diff Decoration Race Conditions

When the user types quickly, multiple things happen:
1. ProseMirror processes the keystroke
2. The diff plugin's `apply()` runs
3. The listener callback fires
4. Stores update
5. A new diff is computed

If step 2 runs before step 5, decorations use stale data. The text verification fix ensures we only decorate when data is consistent.

### 3. Widget vs Inline Decorations

For deletions, we can't highlight text that doesn't exist. So we use widget decorations - DOM nodes inserted at a position but not part of the document content.

For insertions, the text exists, so we use inline decorations - classes applied to existing text.

This asymmetry took time to get right.

---

## What Makes It Work

Marginalia works because it's simple where it can be, complex where it must be.

**Simple**:
- One file in, one bundle out
- Edit text, add rationale, press Esc
- No accounts, no cloud, no sync

**Complex** (but hidden):
- ProseMirror decoration system
- Diff computation and position mapping
- Race condition handling

The user sees manuscript markup on paper. The implementation is a carefully orchestrated dance of state management, document models, and timing.

---

## Conclusion

Marginalia exists because prose is a lossy format for describing edits. By capturing the actual changes and their rationales, we create a structured feedback format that Claude can understand perfectly.

The technical choices (Tauri, Svelte, Milkdown, diff-match-patch) all serve the goal: a fast, focused tool that feels like editing a manuscript, not using software.

The hardest problems were in the diff system - mapping between text offsets and document positions, handling race conditions, keeping decorations stable. These are solved through careful state management and verification.

What remains is a tool that does one thing well: bridge the gap between your edits and Claude's understanding.

---

*Document written January 2026. Code and design by Samay Dhawan with Claude.*
