# Marginalia

A native macOS app for reviewing AI-generated drafts. Make edits, explain why, and output structured feedback for Claude to process.

## Philosophy

Your edits teach the AI. The AI applies the revisions. Marginalia is the bridge.

**Your workflow today:**
1. Claude drafts an IC memo
2. You copy to Obsidian or editor, mark it up
3. You describe changes in prose to Claude
4. Claude misinterprets half of them
5. You repeat

**With Marginalia:**
1. Claude writes draft to `03-work/nventures/deals/elevenlabs/ic-memo-draft.md`
2. Marginalia opens automatically (PostToolUse hook)
3. You edit inline, add 3-word rationales ("no hedging", "quantify the miss")
4. Press Esc. Bundle outputs. Claude reads it, revises correctly.
5. Stable patterns promote to WRITING.md via `/reflect`

## Quick Start

```bash
# Install dependencies
pnpm install

# Development
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Usage

### Manual Launch

```bash
# Open a file for review
marginalia open ./ic-memo-draft.md

# Custom bundle directory + scripting output
marginalia open ./draft.md \
  --bundle-dir ~/phoenix/.marginalia/bundles \
  --out /tmp/marginalia.bundle-path.txt \
  --principles ~/phoenix/WRITING.md
```

### Leaving Feedback Without Editing Text

Sometimes you don’t want to touch the draft — you just want to tell the model what to change.

1. Open **General notes** (click the bar at the bottom, or press `⌘ G`)
2. Type your feedback
3. Press `Esc` (or click **Done**) to save

That still creates a bundle and the hook will point Claude at `summary_for_agent.md`.

**Important**: `⌘ Q` cancels the session (no bundle).

### Annotations (Rationales)

Annotations are attached to a specific edit (a diff change). If there are no changes, there’s nothing to anchor an annotation to.

- Make a small edit on a line
- Press `⌘ /` (or click the highlighted change / gutter marker) to add a rationale

### Claude Code Hook Integration

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/marginalia/hooks/post-write.sh"
          }
        ]
      }
    ]
  }
}
```

Files matching these patterns will automatically open in Marginalia:
- `*-draft.md` in deal folders
- `draft-*.md` in career exploration
- Any file with `<!-- REVIEW -->` marker

## Testing

Run the interactive smoke test:

```bash
./scripts/smoke-hook.sh
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close, output bundle |
| `⌘ Enter` | Same as Esc |
| `⌘ O` | Open file picker |
| `⌘ /` | Add comment to current edit |
| `⌘ G` | Toggle general notes |
| `⌘ Z` | Undo |
| `⌘ ⇧ Z` | Redo |

## Anti-Slop Highlights

If a WRITING.md principles file is available, banned words and em-dashes are highlighted in the editor and flagged in the gutter before you start editing.

## Bundle Output

When you close Marginalia, it generates a bundle at:
`~/phoenix/.marginalia/bundles/[timestamp]_[filename]/`

**Files generated:**
- `original.md` - Original content
- `final.md` - Your edited version
- `changes.json` - Structured diff data
- `annotations.json` - Your rationales and categories
- `summary_for_agent.md` - Human-readable summary for Claude

**CLI flags:**
- `--bundle-dir` overrides the bundle output directory
- `--out` writes the saved bundle path to a file (for scripting)
- `--principles` records a WRITING.md path in `changes.json`

When a principles file is available, annotations auto-match rules and surface them in `summary_for_agent.md`.

## Technical Stack

| Component | Choice |
|-----------|--------|
| **Shell** | Tauri 2.0 |
| **Frontend** | Svelte 5 |
| **Editor** | Milkdown (ProseMirror) |
| **Diff** | diff-match-patch |
| **Styling** | Vanilla CSS (no Tailwind) |

## Design Aesthetic

Paper & Ink - editorial markup on quality paper. A manuscript annotated with a fountain pen, not an app with colored badges.

- Warm, off-white paper backgrounds
- Deep, warm ink colors (not pure black)
- Struck text in muted brick (old correction marks)
- Added text in deep verdigris (editorial insertions)
- Serif body text (Charter) for manuscript feel

## Project Structure

```
marginalia/
├── src/                      # Svelte frontend
│   ├── lib/
│   │   ├── components/       # Editor, Gutter, Popover, Header
│   │   ├── stores/           # Svelte stores for state
│   │   └── utils/            # diff, bundle generator
│   └── routes/               # SvelteKit pages
├── src-tauri/                # Rust backend
├── hooks/                    # Claude Code hook scripts
└── README.md
```

## Development

```bash
# Run development server
pnpm tauri dev

# Build frontend only
pnpm build

# Build full app
pnpm tauri build

# The built app will be at:
# target/release/bundle/macos/Marginalia.app
```

## License

MIT
