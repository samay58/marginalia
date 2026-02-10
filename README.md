# Marginalia

Editing longform drafts with an agent is still weirdly lossy.

The agent writes a draft. You move it to a real editor, mark it up, then translate those edits back into instructions. Somewhere in that translation, nuance dies: what you changed, why you changed it, and what pattern you want repeated next time.

Marginalia is an experiment in a different interaction:
launch a small, disposable review app *from inside the agentic CLI loop* the moment a draft hits disk, capture feedback as structured edits + short rationales, then hand the agent a clean summary it can apply immediately.

The core idea is not “build a better editor.” It’s “make feedback frictionless.” Disposable software should be light: open fast, do one job, get out of the way.

## What it does

- Opens a markdown file in a native macOS window.
- You edit inline and optionally attach a short rationale to a change (`⌘ /`), or leave session-level notes (`⌘ G`).
- Switch between `Review` and `Manuscript` density modes to optimize for fast scanning vs comfortable reading.
- Tone lint is explainable and configurable: toggle it on/off and ignore noisy rules for the current session.
- Close with `Esc` / `⌘ Enter`.
- Marginalia writes a “bundle” directory with:
  - the original + final text
  - a structured diff (`changes.json`)
  - your rationales (`annotations.json`)
  - an apply-ready patch (`changes.patch`)
  - provenance + artifact hashes (`provenance.json`)
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

Async hook mode (non-blocking):

```bash
marginalia init --async
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
            "command": "MARGINALIA_REVIEW_MODE=async bash ~/.marginalia/hooks/post-write.sh",
            "async": true,
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

### Sync vs async behavior

- `marginalia init` configures **sync mode** (default): Claude waits for review completion.
- `marginalia init --async` configures **async mode**: Claude continues immediately, and review output arrives on a later turn when finished.
- Marginalia hook requests are always queued to one active review window at a time, so rapid write bursts do not spawn window storms.

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
- `changes.patch`
- `provenance.json`
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

Output: `src-tauri/target/release/bundle/macos/Marginalia.app`

## Local App QA (Replace `/Applications` Copy)

1. Build and verify:

```bash
pnpm install
pnpm run check
pnpm run build
pnpm run tauri:build:app
```

2. Replace installed app (keeps a timestamped backup):

```bash
APP_SRC="src-tauri/target/release/bundle/macos/Marginalia.app"
APP_DST="/Applications/Marginalia.app"
BACKUP="/Applications/Marginalia.app.bak.$(date +%Y%m%d%H%M%S)"

if [ -d "$APP_DST" ]; then
  sudo mv "$APP_DST" "$BACKUP"
fi
sudo ditto "$APP_SRC" "$APP_DST"
```

3. Launch and test from installed app path:

```bash
open -a /Applications/Marginalia.app
```

4. Hook/CLI smoke test against installed app:

```bash
MARGINALIA_APP_PATH=/Applications/Marginalia.app ./scripts/marginalia smoke-test
```

5. Icon/logo verification:
- Launch Marginalia from Applications (or `open -a /Applications/Marginalia.app`) so LaunchServices applies the app icon in Dock.
- If macOS shows a stale icon cache after replacement, run:

```bash
touch /Applications/Marginalia.app
killall Dock
```

## License

MIT
