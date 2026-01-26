#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

HOOK="${REPO_DIR}/hooks/post-write.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/smoke-hook.sh

What it does:
  - Creates a temporary *-draft.md file (so the hook matches)
  - Runs the PostToolUse hook locally (this will open Marginalia and block)
  - Validates the hook output is well-formed JSON
  - If a bundle is produced, verifies summary_for_agent.md exists

Notes:
  - To force a bundle: make at least one text edit OR add General Notes (Cmd+G) OR add an annotation, then press Esc.
  - Annotations are attached to a diff change. If you make no edits, use General Notes.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

if [[ ! -x "${HOOK}" ]]; then
  echo "Hook not found/executable: ${HOOK}" >&2
  exit 1
fi

tmp_file="/tmp/marginalia-smoke-$$_draft.md"
cat >"${tmp_file}" <<'EOF'
<!-- REVIEW -->
# Marginalia Smoke Test

Change one word and/or add a General Note, then press Esc.
EOF

payload="$(
  jq -n --arg file_path "${tmp_file}" --rawfile content "${tmp_file}" \
    '{tool_input:{file_path:$file_path,content:$content}}'
)"

echo "Launching Marginalia via hook for: ${tmp_file}" >&2
hook_output="$(printf '%s' "${payload}" | bash "${HOOK}")"

echo "${hook_output}"

event_name="$(printf '%s' "${hook_output}" | jq -r '.hookSpecificOutput.hookEventName // empty')"
if [[ "${event_name}" != "PostToolUse" ]]; then
  echo "Unexpected hook output (missing hookSpecificOutput.hookEventName=PostToolUse)" >&2
  exit 1
fi

message="$(printf '%s' "${hook_output}" | jq -r '.hookSpecificOutput.additionalContext // empty')"
if [[ -z "${message}" ]]; then
  echo "Unexpected hook output (missing hookSpecificOutput.additionalContext)" >&2
  exit 1
fi

summary_path="$(
  printf '%s' "${message}" | sed -nE 's/.*Read ([^ ]+summary_for_agent\.md).*/\1/p'
)"

if [[ -n "${summary_path}" ]]; then
  if [[ ! -f "${summary_path}" ]]; then
    echo "Bundle summary not found: ${summary_path}" >&2
    exit 1
  fi
  echo "OK: bundle summary exists at ${summary_path}" >&2
else
  echo "OK: no bundle produced (likely no edits/notes/annotations)" >&2
fi
