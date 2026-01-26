# Codex CLI Handoff: Marginalia Product Improvement

**Created**: 2026-01-25
**Project Age**: 6 days (Jan 19-25, 2026)
**Mission**: Make Marginalia worth sharing on GitHub

---

## What is Marginalia?

A native macOS app for reviewing AI-generated drafts. The core loop:

```
Claude writes draft → Marginalia opens → User edits inline + adds rationales
                                      ↓
                               Bundle outputs → Claude reads → Claude revises
```

The key insight: your edits ARE the instructions. No lossy prose translation.

---

## Why This Handoff?

Marginalia has been **used 16 times for real work** (IC memos, career emails) but:
1. **Adoption dropped off** after 4 days
2. **Core agentic loop is broken** (hook doesn't block)
3. **Users still catching "AI slop"** manually (the anti-thesis of this app)

The goal isn't just "fix bugs" but "make this genuinely useful."

---

## Session Packet

**Full analysis at**: `~/phoenix/01-active/current-personal-projects/marginalia/session-packet-2026-01-25/`

Read the README there for executive summary. Key files:
- `signals-by-category/bugs.md` - All 11 bugs with context
- `raw-extracts/real-world-usage-sessions.md` - 16 usage sessions analyzed
- `beads-issues.md` - 23 tracked issues (10 open)

---

## Critical Findings

### P0 Blockers (Core Use Case Broken)

| Issue | Problem | Impact |
|-------|---------|--------|
| **marg-4hg** | Hook doesn't block | Claude moves on before user reviews |
| **marg-jac** | Blocking architecture missing | Spec exists but not implemented |
| **marg-0ca** | Debug binary shows blank | Hooks can't reliably launch app |

**Until these are fixed, Marginalia can only be used manually.**

### Real-World Usage Failures

From 16 actual usage sessions (not test runs):

| Finding | User Quote |
|---------|------------|
| **Tone detection failing** | "It's way too direct and way too short. And also reads like AI." |
| **"Make it human" appears 6+ times** | "make it human, clear and crisp" |
| **Accuracy errors** | "I've never worked with Albert Gu" (hallucination) |
| **Missing undo** | "We need to add an undo button to this app" |
| **Context switching** | "copy paragraph from other email" (single-file limitation) |

### Technical Bugs (Diff Component)

The diff visualization has the most complaints:

1. **marg-2um**: Insertion highlights missing last character ("would" → "woul" highlighted)
2. **marg-451**: "Diff visualization feels buggy" - race conditions, wrong positions
3. Line formatting corruption after deletion
4. **marg-95g**: Spacing around deletion widgets

### The Adoption Drop-off

```
Jan 19: v0.1 complete
Jan 20: First real use - "Core functionality isn't really there"
Jan 21: Bug fixes - "Holy crap! It works right! Huzzah!"
        ...then "doesn't feel smooth and snappy"
Jan 22-25: NO DEVELOPMENT
        Usage continues but drops off by Jan 24 evening
```

5 bugs fixed in 2 days, then velocity stopped while friction remained.

---

## What Success Looks Like

1. **Agentic loop works end-to-end**: Claude writes → Review → Revise automatically
2. **Diff visualization is rock-solid**: No missing characters, no corruption
3. **Basic editing features work**: Undo/redo (currently missing)
4. **Anti-slop detection actually catches AI patterns**: User shouldn't have to say "reads like AI"
5. **Worth sharing**: Solves a real problem, introduces new interaction paradigm

---

## Deliverables

1. **Investigate each failure** from the session packet
2. **Create beads issues** for any new bugs found during investigation
3. **Spec a prioritized fix plan** that addresses both bugs AND product-market fit
4. **Consider architecture questions**:
   - Is the diff visualization approach fixable or fundamentally flawed?
   - Should we pivot to Typora-style WYSIWYG rendering?
   - Is single-file paradigm the right scope?

---

## Key Files

### Architecture Understanding
- `WALKTHROUGH.md` - Complete technical deep-dive (1186 lines)
- `CLAUDE.md` - Development commands and architecture summary
- `CHANGELOG.md` - What was built and when

### Source Code
- `src/lib/utils/diff.js` - Diff computation
- `src/lib/utils/milkdown-diff-plugin.js` - ProseMirror decoration system
- `src/lib/utils/prosemirror-text.js` - Position mapping (the hard part)
- `src/lib/components/Editor.svelte` - Milkdown wrapper

### Issue Tracking
- `.beads/issues.jsonl` - 23 tracked issues (run `bd list` to see)
- `.beads/` - Full beads setup for issue tracking

### Session Packet (External)
- `~/phoenix/01-active/current-personal-projects/marginalia/session-packet-2026-01-25/`

---

## Beads Workflow

This project uses beads for issue tracking:

```bash
bd ready              # Find issues ready to work
bd list               # All issues
bd show <id>          # Issue details
bd create --title="..." --type=bug --priority=2
bd close <id>
bd sync               # Sync at session end
```

When you find new issues during investigation, create them with `bd create`.

---

## The Fundamental Question

**User wants**: Typora-level WYSIWYG markdown that catches AI patterns automatically
**Built**: Raw CodeMirror-style editor with syntax highlighting + diff overlay

This isn't a bug to fix. It's a design decision that may need revisiting.

Options:
1. Accept raw editor aesthetic (functional, not beautiful)
2. Add preview pane (side-by-side)
3. Switch to WYSIWYG mode (major rewrite)
4. Custom render overlay (complex)

Your investigation should inform which path makes sense.

---

## Getting Started

```bash
cd ~/marginalia
pnpm install
pnpm tauri dev        # Development server (first run compiles Rust, ~2min)
bd ready              # See open issues
```

Then:
1. Read the session packet README
2. Run the app with a test file
3. Try to reproduce the P0 blockers
4. Investigate why diff visualization "feels buggy"

---

*This handoff was created to transfer context from a Claude Code session to Codex CLI. The goal is autonomous investigation and planning, not just bug fixes.*
