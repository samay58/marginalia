#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOOK_PATH="${REPO_DIR}/hooks/post-write.sh"
CLI_PATH="${REPO_DIR}/scripts/marginalia"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

require_cmd jq
require_cmd python3

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

fake_log="${tmp_dir}/fake-app.log"
fake_bin="${tmp_dir}/fake-marginalia"

cat >"${fake_bin}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${MARGINALIA_FAKE_LOG:-}" ]]; then
  echo "MARGINALIA_FAKE_LOG is required for fake binary" >&2
  exit 1
fi

if [[ "${1:-}" != "open" ]]; then
  echo "Expected first arg to be 'open'" >&2
  exit 1
fi
shift

file_path="${1:-}"
if [[ -z "${file_path}" ]]; then
  echo "Missing file path" >&2
  exit 1
fi
shift

out_path=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      out_path="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "${out_path}" ]]; then
  echo "Missing --out path" >&2
  exit 1
fi

timestamp() {
  python3 - <<'PY'
import time
print(f"{time.time():.6f}")
PY
}

start_ts="$(timestamp)"
printf 'start|%s|%s\n' "${file_path}" "${start_ts}" >> "${MARGINALIA_FAKE_LOG}"

sleep 0.6

bundle_dir="${TMPDIR:-/tmp}/marginalia-fake-bundle-$$-${RANDOM}"
mkdir -p "${bundle_dir}"
printf '# fake summary\n' > "${bundle_dir}/summary_for_agent.md"

cat > "${out_path}" <<JSON
{
  "status": "reviewed",
  "changes_made": true,
  "bundle_path": "${bundle_dir}",
  "session_duration_seconds": 1
}
JSON

end_ts="$(timestamp)"
printf 'end|%s|%s\n' "${file_path}" "${end_ts}" >> "${MARGINALIA_FAKE_LOG}"
EOF

chmod +x "${fake_bin}"

draft_one="${tmp_dir}/alpha-draft.md"
draft_two="${tmp_dir}/beta-draft.md"
cat >"${draft_one}" <<'EOF'
<!-- REVIEW -->
# Alpha Draft
EOF
cat >"${draft_two}" <<'EOF'
<!-- REVIEW -->
# Beta Draft
EOF

payload_one="$(
  jq -n --arg file_path "${draft_one}" --rawfile content "${draft_one}" \
    '{tool_input:{file_path:$file_path,content:$content}}'
)"
payload_two="$(
  jq -n --arg file_path "${draft_two}" --rawfile content "${draft_two}" \
    '{tool_input:{file_path:$file_path,content:$content}}'
)"

queue_dir="${tmp_dir}/queue"
out_one="${tmp_dir}/hook-output-1.json"
out_two="${tmp_dir}/hook-output-2.json"

(
  printf '%s' "${payload_one}" \
    | MARGINALIA_REVIEW_MODE=async \
      MARGINALIA_QUEUE_DIR="${queue_dir}" \
      MARGINALIA_BIN_OVERRIDE="${fake_bin}" \
      MARGINALIA_FAKE_LOG="${fake_log}" \
      bash "${HOOK_PATH}" > "${out_one}"
) &
pid_one=$!

sleep 0.1

(
  printf '%s' "${payload_two}" \
    | MARGINALIA_REVIEW_MODE=async \
      MARGINALIA_QUEUE_DIR="${queue_dir}" \
      MARGINALIA_BIN_OVERRIDE="${fake_bin}" \
      MARGINALIA_FAKE_LOG="${fake_log}" \
      bash "${HOOK_PATH}" > "${out_two}"
) &
pid_two=$!

wait "${pid_one}"
wait "${pid_two}"

jq -e '.hookSpecificOutput.hookEventName == "PostToolUse"' "${out_one}" >/dev/null
jq -e '.hookSpecificOutput.additionalContext | length > 0' "${out_one}" >/dev/null
jq -e '.hookSpecificOutput.hookEventName == "PostToolUse"' "${out_two}" >/dev/null
jq -e '.hookSpecificOutput.additionalContext | length > 0' "${out_two}" >/dev/null

python3 - "${fake_log}" <<'PY'
import sys

log_path = sys.argv[1]
active = 0
events = []

with open(log_path, "r", encoding="utf-8") as handle:
    for raw in handle:
        kind, file_path, timestamp = raw.strip().split("|", 2)
        events.append((kind, file_path, float(timestamp)))
        if kind == "start":
            if active != 0:
                raise SystemExit("queue violation: overlapping fake app starts detected")
            active = 1
        elif kind == "end":
            if active != 1:
                raise SystemExit("queue violation: end event without active run")
            active = 0
        else:
            raise SystemExit(f"unexpected log event kind: {kind}")

if active != 0:
    raise SystemExit("queue violation: run lock not released by end of log")

if len([event for event in events if event[0] == "start"]) != 2:
    raise SystemExit("expected two start events in fake app log")
if len([event for event in events if event[0] == "end"]) != 2:
    raise SystemExit("expected two end events in fake app log")
PY

# Validate CLI init async/sync config writes expected hook shape without duplicates.
hook_dir="${tmp_dir}/hooks"
mkdir -p "${hook_dir}"
cp "${HOOK_PATH}" "${hook_dir}/post-write.sh"
chmod +x "${hook_dir}/post-write.sh"
settings_path="${tmp_dir}/settings.json"

MARGINALIA_HOOK_DIR="${hook_dir}" bash "${CLI_PATH}" init --settings "${settings_path}" --async >/dev/null

jq -e --arg hook_path "${hook_dir}/post-write.sh" '
  [
    .hooks.PostToolUse[] |
    .hooks[] |
    select((.command | contains("bash " + $hook_path)))
  ] | length == 1
' "${settings_path}" >/dev/null

jq -e --arg hook_path "${hook_dir}/post-write.sh" '
  [
    .hooks.PostToolUse[] |
    .hooks[] |
    select(.command == ("MARGINALIA_REVIEW_MODE=async bash " + $hook_path) and .async == true)
  ] | length == 1
' "${settings_path}" >/dev/null

MARGINALIA_HOOK_DIR="${hook_dir}" bash "${CLI_PATH}" init --settings "${settings_path}" --sync >/dev/null

jq -e --arg hook_path "${hook_dir}/post-write.sh" '
  [
    .hooks.PostToolUse[] |
    .hooks[] |
    select(.command == ("bash " + $hook_path) and ((has("async") | not) or .async == false))
  ] | length == 1
' "${settings_path}" >/dev/null

jq -e --arg hook_path "${hook_dir}/post-write.sh" '
  [
    .hooks.PostToolUse[] |
    .hooks[] |
    select((.command | contains("bash " + $hook_path)))
  ] | length == 1
' "${settings_path}" >/dev/null

echo "hook-async-queue: all checks passed"
