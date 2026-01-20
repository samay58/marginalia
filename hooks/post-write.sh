#!/bin/bash
# Marginalia Claude Code Hook
# Triggers Marginalia for draft files matching specific patterns
#
# Install by adding to ~/.claude/settings.json:
# {
#   "hooks": {
#     "PostToolUse": [
#       {
#         "matcher": "Write|Edit",
#         "hooks": [
#           {
#             "type": "command",
#             "command": "bash ~/marginalia/hooks/post-write.sh"
#           }
#         ]
#       }
#     ]
#   }
# }

set -euo pipefail

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

# Pattern 1: Deal drafts with -draft.md suffix in NVentures deals folder
if [[ "$file_path" == */03-work/nventures/deals/*-draft.md ]]; then
    should_review=true
fi

# Pattern 2: Career exploration drafts
if [[ "$file_path" == */02-personal/career-exploration/*/draft-*.md ]]; then
    should_review=true
fi

# Pattern 3: Any file containing the <!-- REVIEW --> marker
if [[ -n "$content" && "$content" == *"<!-- REVIEW -->"* ]]; then
    should_review=true
fi

# Pattern 4: Files ending in -draft.md anywhere
if [[ "$file_path" == *-draft.md ]]; then
    should_review=true
fi

# If file matches review patterns, launch Marginalia
if [[ "$should_review" == true ]]; then
    # Check if marginalia is available
    if command -v marginalia &> /dev/null; then
        marginalia open "$file_path" &
    elif [[ -x ~/marginalia/target/release/marginalia ]]; then
        ~/marginalia/target/release/marginalia open "$file_path" &
    elif [[ -d /Applications/Marginalia.app ]]; then
        open -a Marginalia --args open "$file_path" &
    fi
fi

exit 0
