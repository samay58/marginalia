# Marginalia

Marginalia is a native macOS app that opens inside your Claude Code session when Claude writes a draft. You edit inline, add short rationales ("no hedging," "quantify the miss"), and press Esc. Claude reads the structured output and revises without you ever leaving the CLI.

No more describing your edits in prose. No more Claude misinterpreting half of them.

## Before and after

### Without Marginalia

1. Claude drafts an IC memo
2. You copy it to Obsidian, mark it up
3. You describe your changes back to Claude
4. Claude misinterprets half of them
5. You repeat

### With Marginalia

1. Claude writes to `ic-memo-draft.md`
2. Marginalia opens automatically
3. You edit inline, add 3-word rationales
4. Press Esc. Claude reads structured output. Revises correctly.
5. Patterns that stick get promoted to `WRITING.md` via `/reflect`.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/samay58/marginalia/main/scripts/install.sh | bash
```

With Claude Code hooks:

```bash
curl -fsSL https://raw.githubusercontent.com/samay58/marginalia/main/scripts/install.sh | bash -s -- --with-claude --global
```

Needs jq (`brew install jq`).

## Setup

```bash
marginalia init          # per-project
marginalia init --global # global
marginalia smoke-test    # verify it works
```

## How to use it

### Open a file

```bash
marginalia open ./draft.md
```

### With options

```bash
marginalia open ./draft.md \
  --bundle-dir ~/phoenix/.marginalia/bundles \
  --out /tmp/marginalia.bundle-path.txt \
  --principles ~/phoenix/WRITING.md
```

### Leave feedback without editing

Press `⌘ G` for General Notes. Type what you want changed. Press Esc.

This still creates a bundle. Claude reads `summary_for_agent.md`.

`⌘ Q` cancels -- no bundle created.

### Add rationales to edits

Annotations anchor to edits. Make a change, then press `⌘ /` to explain why.

## Shortcuts

| Key | Action |
|-----|--------|
| Esc | Close and output bundle |
| ⌘ Enter | Same as Esc |
| ⌘ O | Open file |
| ⌘ / | Comment on current edit |
| ⌘ G | General notes |
| ⌘ Z | Undo |
| ⌘ ⇧ Z | Redo |

## Anti-slop

Marginalia highlights AI-ish writing. If you have a `WRITING.md` file, it flags banned words and em-dashes. The built-in tone lint catches phrases like "I hope this finds you well" and "cutting-edge."

## What gets output

When you close Marginalia, it writes a bundle to:

`~/phoenix/.marginalia/bundles/[timestamp]_[filename]/`

- `original.md` -- What you started with
- `final.md` -- What you changed it to
- `changes.json` -- Structured diff
- `annotations.json` -- Your rationales
- `summary_for_agent.md` -- For Claude to read

If you set a principles file, annotations auto-match your rules and show up in the summary.

## Claude Code integration

The hook setup:

```bash
marginalia init --global
```

Or manually in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.marginalia/hooks/post-write.sh",
            "timeout": 1800000
          }
        ]
      }
    ]
  }
}
```

Auto-opens for:

- `*-draft.md` in deal folders
- `draft-*.md` in career exploration
- Any file with `<!-- REVIEW -->` marker

## Design philosophy

Paper & Ink. A manuscript marked up with a fountain pen -- not an app with colored badges.

Warm off-white backgrounds. Deep ink (not pure black). Struck text in muted brick. Additions in verdigris. Charter for body text.

## Stack

| Component | Choice |
|-----------|--------|
| Shell | Tauri 2.0 |
| Frontend | Svelte 5 |
| Editor | Milkdown (ProseMirror) |
| Diff | diff-match-patch |
| Styling | Vanilla CSS |

## Development

```bash
pnpm install
pnpm tauri dev   # development
pnpm tauri build # production
```

Output: `target/release/bundle/macos/Marginalia.app`

## Testing

```bash
marginalia smoke-test

# or
./scripts/smoke-hook.sh
```

Tone lint check:

```bash
./scripts/make-slop-fixture.sh
./src-tauri/target/debug/marginalia open /tmp/marginalia-slop.md
```

## Structure

```
marginalia/
├── src/                      # Svelte frontend
│   ├── lib/
│   │   ├── components/
│   │   ├── stores/
│   │   └── utils/
│   └── routes/
├── src-tauri/                # Rust backend
├── hooks/                    # Claude Code hooks
└── README.md
```

## License

MIT
