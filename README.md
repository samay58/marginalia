# Marginalia

Editing longform drafts with an agent is still weirdly lossy.

The agent writes a draft. You move it to a real editor, mark it up, then translate those edits back into instructions. Somewhere in that translation, nuance dies: what you changed, why you changed it, and what pattern you want repeated next time.

Marginalia is an experiment in a different interaction:
launch a small, disposable review app *from inside the agentic CLI loop* the moment a draft hits disk, capture feedback as structured edits + short rationales, then hand the agent a clean summary it can apply immediately.

The core idea is not “build a better editor.” It’s “make feedback frictionless.” Disposable software should be light: open fast, do one job, get out of the way.

## What it does

- Opens a markdown file in a native macOS window.
- You edit inline and optionally attach a short rationale to a change (`⌘ /`), or leave session-level notes (`⌘ G`).
- Close with `Esc` / `⌘ Enter`.
- Marginalia writes a “bundle” directory with:
  - the original + final text
  - a structured diff (`changes.json`)
  - your rationales (`annotations.json`)
  - a single file the agent should read (`summary_for_agent.md`)

## Install (macOS)

Requires `jq` (`brew install jq`).

```bash
curl -fsSL https://raw.githubusercontent.com/samay58/marginalia/main/scripts/install.sh | bash
```

If `marginalia` isn’t on your `PATH` after install, add `~/.local/bin` to `PATH` (the installer prints the exact line).

## Install inside an agentic CLI session

Marginalia works best when it’s launched automatically after the agent writes a draft file.

### Claude Code (recommended)

Global hook:

```bash
marginalia init --global
```

Or per-project:

```bash
marginalia init
```

Manual config (`~/.claude/settings.json`):

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

Default trigger rules (in the hook):
- any file ending in `-draft.md`
- any file containing `<!-- REVIEW -->`

### Other agentic CLIs

If your agentic CLI supports “post write” hooks, do the same thing:
run `marginalia open <file> --out <status-json-path>` as a blocking step, then feed `summary_for_agent.md` back into the agent.

## Usage

Open a file:

```bash
marginalia open ./draft.md
```

Custom bundle output dir + status path (useful for hooks):

```bash
marginalia open ./draft.md \
  --bundle-dir ~/.marginalia/bundles \
  --out /tmp/marginalia.status.json
```

Optional: pass a principles file (your writing rules). If present, Marginalia will highlight violations and try to match rationales to rules.

```bash
marginalia open ./draft.md --principles ~/WRITING.md
```

## Where the bundle goes

By default:

`~/.marginalia/bundles/[timestamp]_[filename]/`

Bundle contents:
- `original.md`
- `final.md`
- `changes.json`
- `annotations.json`
- `summary_for_agent.md`

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

## Development

```bash
pnpm install
pnpm tauri dev   # development
pnpm tauri build # production app bundle
pnpm tauri:build:dmg # DMG (requires GUI)
```

Output: `target/release/bundle/macos/Marginalia.app`

## License

MIT
