# Hook Adapter Contract

Marginalia integrates with agentic CLIs through one stable command:

```bash
marginalia open <file> --out <status-path>
```

The caller owns hook detection. Marginalia owns review capture and bundle writing.

## Status File

Marginalia writes JSON to `--out`:

```json
{
  "status": "reviewed",
  "changes_made": true,
  "bundle_path": "/Users/me/.marginalia/bundles/...",
  "session_duration_seconds": 92
}
```

If `bundle_path` is present, feed this file back into the agent:

```text
<bundle_path>/summary_for_agent.md
```

## Claude Code

The bundled `hooks/post-write.sh` is a Claude Code `PostToolUse` adapter. It:

- matches `*-draft.md` files or files containing `<!-- REVIEW -->`,
- queues concurrent review requests,
- launches exactly one Marginalia window at a time,
- emits hook context telling Claude to read `summary_for_agent.md`.

Install with:

```bash
marginalia init --global
```

## Codex

OpenAI's public Codex help pages describe Codex as available in terminal, IDE, app, and cloud workflows. They do not currently provide a stable hook configuration shape in the pages reviewed on April 27, 2026, so Marginalia documents the runtime-neutral adapter contract rather than inventing a Codex-specific config.

For any Codex lifecycle script that runs after an agent writes a file:

```bash
status_path="$(mktemp -t marginalia-status.XXXXXX.json)"
marginalia open "$WRITTEN_FILE" --out "$status_path"
bundle_path="$(jq -r '.bundle_path // empty' "$status_path")"
if [ -n "$bundle_path" ]; then
  printf 'Read %s/summary_for_agent.md before revising.\n' "$bundle_path"
fi
```

Keep the adapter thin. Do not put Claude-only or Codex-only assumptions into Marginalia's bundle schema.

Reference checked: [OpenAI Codex help](https://help.openai.com/en/articles/11369540-codex-in-chatgpt), April 27, 2026.
