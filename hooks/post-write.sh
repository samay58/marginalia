#!/bin/bash
# Marginalia Claude Code Hook
# Supports sync and async review modes with single-instance queueing.
#
# Review mode:
# - sync (default): hook blocks until review completes.
# - async: intended for Claude hook entries with "async": true.
#          Claude can continue while this hook finishes in background.
#
# Queue behavior:
# - Every matching request is enqueued.
# - Exactly one Marginalia review app instance runs at a time.
# - Requests are processed in queue order.
#
# Optional env vars:
# - MARGINALIA_REVIEW_MODE=sync|async
# - MARGINALIA_REVIEW_REGEX='/(docs|drafts)/.*\\.md$'
# - MARGINALIA_QUEUE_DIR=/tmp/marginalia-review-queue
# - MARGINALIA_QUEUE_POLL_SECONDS=0.25
# - MARGINALIA_QUEUE_MAX_WAIT_SECONDS=7200
# - MARGINALIA_BIN_OVERRIDE=/path/to/test/binary

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

REVIEW_MODE="${MARGINALIA_REVIEW_MODE:-sync}"
QUEUE_DIR="${MARGINALIA_QUEUE_DIR:-/tmp/marginalia-review-queue}"
REQUESTS_DIR="${QUEUE_DIR}/requests"
RUN_LOCK_DIR="${QUEUE_DIR}/run.lock"
COUNTER_LOCK_DIR="${QUEUE_DIR}/counter.lock"
COUNTER_FILE="${QUEUE_DIR}/counter.txt"
QUEUE_POLL_SECONDS="${MARGINALIA_QUEUE_POLL_SECONDS:-0.25}"
QUEUE_MAX_WAIT_SECONDS="${MARGINALIA_QUEUE_MAX_WAIT_SECONDS:-7200}"

REQUEST_FILE=""
LOCK_ACQUIRED=false
QUEUE_WAIT_SECONDS=0
status_file=""

case "${REVIEW_MODE}" in
  sync|async) ;;
  *)
    REVIEW_MODE="sync"
    ;;
esac

output_hook_response() {
  local message="$1"
  jq -Rn --arg msg "$message" \
    '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
}

read_lock_owner_pid() {
  if [[ -f "${RUN_LOCK_DIR}/pid" ]]; then
    cat "${RUN_LOCK_DIR}/pid" 2>/dev/null || true
  fi
}

clear_stale_run_lock() {
  if [[ ! -d "${RUN_LOCK_DIR}" ]]; then
    return
  fi
  local owner_pid
  owner_pid="$(read_lock_owner_pid)"
  if [[ -z "${owner_pid}" ]]; then
    rm -rf "${RUN_LOCK_DIR}" 2>/dev/null || true
    return
  fi
  if ! kill -0 "${owner_pid}" 2>/dev/null; then
    rm -rf "${RUN_LOCK_DIR}" 2>/dev/null || true
  fi
}

release_run_lock() {
  if [[ "${LOCK_ACQUIRED}" != "true" ]]; then
    return
  fi
  if [[ -d "${RUN_LOCK_DIR}" ]]; then
    local owner_pid
    owner_pid="$(read_lock_owner_pid)"
    if [[ -z "${owner_pid}" || "${owner_pid}" == "$$" ]]; then
      rm -rf "${RUN_LOCK_DIR}" 2>/dev/null || true
    fi
  fi
  LOCK_ACQUIRED=false
}

cleanup() {
  if [[ -n "${status_file}" ]]; then
    rm -f "${status_file}"
  fi
  if [[ -n "${REQUEST_FILE}" ]]; then
    rm -f "${REQUEST_FILE}" 2>/dev/null || true
  fi
  release_run_lock
}
trap cleanup EXIT

queue_token() {
  local sequence
  sequence="$(next_queue_sequence)"
  printf '%s-%s' "${sequence}" "$$"
}

read_counter_lock_owner_pid() {
  if [[ -f "${COUNTER_LOCK_DIR}/pid" ]]; then
    cat "${COUNTER_LOCK_DIR}/pid" 2>/dev/null || true
  fi
}

acquire_counter_lock() {
  while true; do
    if mkdir "${COUNTER_LOCK_DIR}" 2>/dev/null; then
      printf '%s\n' "$$" > "${COUNTER_LOCK_DIR}/pid"
      return 0
    fi

    local owner_pid
    owner_pid="$(read_counter_lock_owner_pid)"
    if [[ -z "${owner_pid}" ]] || ! kill -0 "${owner_pid}" 2>/dev/null; then
      rm -rf "${COUNTER_LOCK_DIR}" 2>/dev/null || true
      continue
    fi
    sleep "${QUEUE_POLL_SECONDS}"
  done
}

release_counter_lock() {
  if [[ ! -d "${COUNTER_LOCK_DIR}" ]]; then
    return
  fi
  local owner_pid
  owner_pid="$(read_counter_lock_owner_pid)"
  if [[ -z "${owner_pid}" || "${owner_pid}" == "$$" ]]; then
    rm -rf "${COUNTER_LOCK_DIR}" 2>/dev/null || true
  fi
}

next_queue_sequence() {
  mkdir -p "${QUEUE_DIR}"
  acquire_counter_lock

  local current=0
  if [[ -f "${COUNTER_FILE}" ]]; then
    current="$(cat "${COUNTER_FILE}" 2>/dev/null || echo 0)"
  fi
  if ! [[ "${current}" =~ ^[0-9]+$ ]]; then
    current=0
  fi

  local next=$((current + 1))
  printf '%s\n' "${next}" > "${COUNTER_FILE}"
  release_counter_lock

  printf '%012d' "${next}"
}

enqueue_request() {
  mkdir -p "${REQUESTS_DIR}"
  REQUEST_FILE="${REQUESTS_DIR}/$(queue_token).req"
  printf '%s\n' "${file_path}" > "${REQUEST_FILE}"
}

is_request_head() {
  local head=""
  head="$(
    find "${REQUESTS_DIR}" -maxdepth 1 -type f -name '*.req' -print 2>/dev/null \
      | LC_ALL=C sort \
      | head -n 1
  )"
  [[ -n "${head}" && "${head}" == "${REQUEST_FILE}" ]]
}

acquire_queue_slot() {
  local start_ts now_ts
  start_ts="$(date +%s)"

  while true; do
    clear_stale_run_lock
    if is_request_head; then
      if mkdir "${RUN_LOCK_DIR}" 2>/dev/null; then
        printf '%s\n' "$$" > "${RUN_LOCK_DIR}/pid"
        LOCK_ACQUIRED=true

        # Ensure queue head didn't change between checks.
        if ! is_request_head; then
          release_run_lock
        else
          rm -f "${REQUEST_FILE}"
          REQUEST_FILE=""
          now_ts="$(date +%s)"
          QUEUE_WAIT_SECONDS=$((now_ts - start_ts))
          return 0
        fi
      fi
    fi

    now_ts="$(date +%s)"
    if (( now_ts - start_ts > QUEUE_MAX_WAIT_SECONDS )); then
      return 1
    fi
    sleep "${QUEUE_POLL_SECONDS}"
  done
}

launch_and_wait() {
  local local_release="${REPO_DIR}/src-tauri/target/release/marginalia"
  local local_debug="${REPO_DIR}/src-tauri/target/debug/marginalia"
  local local_app="${REPO_DIR}/src-tauri/target/release/bundle/macos/Marginalia.app"
  local configured_app="${MARGINALIA_APP_PATH:-/Applications/Marginalia.app}"

  if [[ -n "${MARGINALIA_BIN_OVERRIDE:-}" ]]; then
    if [[ ! -x "${MARGINALIA_BIN_OVERRIDE}" ]]; then
      output_hook_response "Marginalia hook matched, but MARGINALIA_BIN_OVERRIDE is not executable: ${MARGINALIA_BIN_OVERRIDE}."
      exit 0
    fi
    "${MARGINALIA_BIN_OVERRIDE}" open "${file_path}" --out "${status_file}"
    return
  fi

  if [[ -d "${configured_app}" ]]; then
    open -W "${configured_app}" --args open "${file_path}" --out "${status_file}"
    return
  fi

  if [[ -d "${local_app}" ]]; then
    open -W "${local_app}" --args open "${file_path}" --out "${status_file}"
    return
  fi
  if [[ -d /Applications/Marginalia.app ]]; then
    open -W -a Marginalia --args open "${file_path}" --out "${status_file}"
    return
  fi

  if [[ -x "${local_release}" ]]; then
    "${local_release}" open "${file_path}" --out "${status_file}"
    return
  fi

  if command -v marginalia >/dev/null 2>&1; then
    marginalia open "${file_path}" --out "${status_file}"
    return
  fi

  if [[ -x "${local_debug}" ]] && curl -fsS "http://localhost:1420" >/dev/null 2>&1; then
    "${local_debug}" open "${file_path}" --out "${status_file}"
    return
  fi

  output_hook_response "Marginalia hook matched, but no runnable app was found. Install/build Marginalia, then retry (from source: `pnpm tauri build`)."
  exit 0
}

# Read input from stdin (Claude Code provides JSON with tool_input)
input="$(cat)"
file_path="$(echo "${input}" | jq -r '.tool_input.file_path // empty')"
content="$(echo "${input}" | jq -r '.tool_input.content // empty')"

if [[ -z "${file_path}" ]]; then
  exit 0
fi

should_review=false
if [[ -n "${MARGINALIA_REVIEW_REGEX:-}" ]]; then
  if [[ "${file_path}" =~ ${MARGINALIA_REVIEW_REGEX} ]]; then
    should_review=true
  fi
fi
if [[ -n "${content}" && "${content}" == *"<!-- REVIEW -->"* ]]; then
  should_review=true
fi
if [[ "${file_path}" == *-draft.md ]]; then
  should_review=true
fi
if [[ "${should_review}" != true ]]; then
  exit 0
fi

status_file="/tmp/marginalia-$$-${RANDOM}.json"

enqueue_request
if ! acquire_queue_slot; then
  output_hook_response "Marginalia review queue timed out after ${QUEUE_MAX_WAIT_SECONDS}s. Ask the user whether to retry review."
  exit 0
fi

launch_and_wait

if [[ ! -f "${status_file}" ]]; then
  output_hook_response "User review was interrupted (app terminated unexpectedly). Ask the user how they would like to proceed."
  exit 0
fi

status="$(jq -r '.status // "unknown"' "${status_file}" 2>/dev/null || echo "unknown")"
bundle_path="$(jq -r '.bundle_path // ""' "${status_file}" 2>/dev/null || echo "")"

mode_prefix=""
if [[ "${REVIEW_MODE}" == "async" ]]; then
  mode_prefix="Async review completed. "
fi
queue_note=""
if (( QUEUE_WAIT_SECONDS > 0 )); then
  queue_note="(queued ${QUEUE_WAIT_SECONDS}s) "
fi

case "${status}" in
  reviewed)
    if [[ -n "${bundle_path}" ]]; then
      summary_path="${bundle_path}/summary_for_agent.md"
      output_hook_response "${mode_prefix}${queue_note}User reviewed and provided feedback. Read ${summary_path} for revision guidance, then revise the draft accordingly."
    else
      output_hook_response "${mode_prefix}${queue_note}User reviewed and approved the draft without changes. No revisions needed."
    fi
    ;;
  cancelled)
    output_hook_response "${mode_prefix}${queue_note}User cancelled the review. Ask if they want to continue with the draft as-is or make changes."
    ;;
  error)
    error_msg="$(jq -r '.error // "unknown error"' "${status_file}" 2>/dev/null || echo "unknown error")"
    output_hook_response "${mode_prefix}${queue_note}Review encountered an error: ${error_msg}. Ask the user how to proceed."
    ;;
  *)
    output_hook_response "${mode_prefix}${queue_note}Review completed with unexpected status. Ask the user for feedback."
    ;;
esac

exit 0
