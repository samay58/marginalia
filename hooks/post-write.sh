#!/bin/bash
# Marginalia Claude Code Hook (Blocking Mode)
# Triggers Marginalia for draft files and BLOCKS until user completes review.
# Returns structured feedback to Claude for revision guidance.
#
# Install via `marginalia init` (recommended), or add to ~/.claude/settings.json:
# {
#   "hooks": {
#     "PostToolUse": [
#       {
#         "matcher": "Write|Edit",
#         "hooks": [
#           {
#             "type": "command",
#             "command": "bash ~/.marginalia/hooks/post-write.sh",
#             "timeout": 1800000
#           }
#         ]
#       }
#     ]
#   }
# }

set -euo pipefail

# Optional override:
# - If MARGINALIA_REVIEW_REGEX is set, any file_path matching the bash regex triggers review.
# - Otherwise, default triggers are:
#   - file name ends with "-draft.md"
#   - file content contains "<!-- REVIEW -->"
#
# Example:
#   export MARGINALIA_REVIEW_REGEX='/(docs|drafts)/.*\\.md$'

# Resolve repo root (don’t assume location on disk)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read input from stdin (Claude Code provides JSON with tool_input)
input=$(cat)

# Extract file path and content from the JSON input
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // empty')

# Skip if no file path provided
if [[ -z "$file_path" ]]; then
    exit 0
fi

# Determine if this file should be reviewed
should_review=false

# Optional override: explicit regex match against the file path
if [[ -n "${MARGINALIA_REVIEW_REGEX:-}" ]]; then
    if [[ "$file_path" =~ ${MARGINALIA_REVIEW_REGEX} ]]; then
        should_review=true
    fi
fi

# Default trigger: any file containing the <!-- REVIEW --> marker
if [[ -n "$content" && "$content" == *"<!-- REVIEW -->"* ]]; then
    should_review=true
fi

# Default trigger: files ending in -draft.md anywhere
if [[ "$file_path" == *-draft.md ]]; then
    should_review=true
fi

# If file doesn't match review patterns, exit silently
if [[ "$should_review" != true ]]; then
    exit 0
fi

# Create unique status file path for this invocation
status_file="/tmp/marginalia-$$.json"

# Clean up status file on exit
cleanup() {
    rm -f "$status_file"
}
trap cleanup EXIT

# Function to output hook response for Claude
output_hook_response() {
    local message="$1"
    jq -Rn --arg msg "$message" \
      '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
}

# Launch Marginalia and WAIT for it to exit (blocking)
launch_and_wait() {
    local local_release="${REPO_DIR}/src-tauri/target/release/marginalia"
    local local_debug="${REPO_DIR}/src-tauri/target/debug/marginalia"
    local local_app="${REPO_DIR}/src-tauri/target/release/bundle/macos/Marginalia.app"

    # Prefer local release binary: doesn’t require Vite dev server.
    if [[ -x "$local_release" ]]; then
        "$local_release" open "$file_path" --out "$status_file"
        return
    fi

    # Fallback: installed CLI (if user set one up).
    if command -v marginalia &> /dev/null; then
        marginalia open "$file_path" --out "$status_file"
        return
    fi

    # Fallback: app bundle (if built/installed).
    if [[ -d "$local_app" ]]; then
        open -W "$local_app" --args open "$file_path" --out "$status_file"
        return
    fi
    if [[ -d /Applications/Marginalia.app ]]; then
        open -W -a Marginalia --args open "$file_path" --out "$status_file"
        return
    fi

    # Last resort: debug binary ONLY if dev server is available (otherwise blank window).
    if [[ -x "$local_debug" ]] && curl -fsS "http://localhost:1420" >/dev/null 2>&1; then
        "$local_debug" open "$file_path" --out "$status_file"
        return
    fi

    output_hook_response "Marginalia hook matched, but no runnable app was found. Install/build Marginalia, then retry (from source: `pnpm tauri build`)."
    exit 0
}

# Launch Marginalia and wait for user to finish
launch_and_wait

# After app exits, read and parse status file
if [[ ! -f "$status_file" ]]; then
    # No status file - app was force-killed (SIGKILL) or crashed
    output_hook_response "User review was interrupted (app terminated unexpectedly). Ask the user how they would like to proceed."
    exit 0
fi

# Parse the status JSON
status=$(jq -r '.status // "unknown"' "$status_file" 2>/dev/null || echo "unknown")
changes_made=$(jq -r '.changes_made // false' "$status_file" 2>/dev/null || echo "false")
bundle_path=$(jq -r '.bundle_path // ""' "$status_file" 2>/dev/null || echo "")

case "$status" in
    "reviewed")
        if [[ -n "$bundle_path" ]]; then
            summary_path="${bundle_path}/summary_for_agent.md"
            output_hook_response "User reviewed and provided feedback. Read ${summary_path} for revision guidance, then revise the draft accordingly."
        else
            output_hook_response "User reviewed and approved the draft without changes. No revisions needed."
        fi
        ;;
    "cancelled")
        # User force-quit (Cmd+Q or red button)
        output_hook_response "User cancelled the review. Ask if they want to continue with the draft as-is or make changes."
        ;;
    "error")
        error_msg=$(jq -r '.error // "unknown error"' "$status_file" 2>/dev/null || echo "unknown error")
        output_hook_response "Review encountered an error: ${error_msg}. Ask the user how to proceed."
        ;;
    *)
        output_hook_response "Review completed with unexpected status. Ask the user for feedback."
        ;;
esac

exit 0
