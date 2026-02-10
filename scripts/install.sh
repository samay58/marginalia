#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Marginalia"
REPO="${MARGINALIA_REPO:-samay58/marginalia}"
REF="${MARGINALIA_REF:-}"
DMG_URL="${MARGINALIA_DMG_URL:-}"
APP_DIR="${MARGINALIA_APP_DIR:-/Applications}"
BIN_DIR="${MARGINALIA_BIN_DIR:-}"
HOOK_MATCHER="${MARGINALIA_HOOK_MATCHER:-Write|Edit}"
HOOK_MODE="${MARGINALIA_HOOK_MODE:-sync}"

WITH_CLAUDE=false
CLAUDE_SCOPE="project"

usage() {
  cat <<'EOF'
Marginalia installer (macOS)

Usage:
  ./scripts/install.sh [options]

Options:
  --with-claude          Write Claude Code hook config after install
  --global               Use ~/.claude/settings.json (default: per-project)
  --project              Use ./.claude/settings.json
  --async                Configure Claude hook in async mode (non-blocking)
  --sync                 Configure Claude hook in sync mode (blocking; default)
  --repo <owner/name>    GitHub repo (default: samay58/marginalia)
  --ref <tag>            Release tag or ref (default: latest release)
  --dmg-url <url>        Direct DMG download URL
  --app-dir <path>       Install directory for Marginalia.app
  --bin-dir <path>       Install directory for marginalia CLI
  -h, --help             Show help
EOF
}

log() {
  printf '%s\n' "$*" >&2
}

die() {
  log "$*"
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    die "Missing dependency: $1"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-claude)
      WITH_CLAUDE=true
      shift
      ;;
    --global)
      CLAUDE_SCOPE="global"
      shift
      ;;
    --project)
      CLAUDE_SCOPE="project"
      shift
      ;;
    --async)
      HOOK_MODE="async"
      shift
      ;;
    --sync)
      HOOK_MODE="sync"
      shift
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --ref)
      REF="${2:-}"
      shift 2
      ;;
    --dmg-url)
      DMG_URL="${2:-}"
      shift 2
      ;;
    --app-dir)
      APP_DIR="${2:-}"
      shift 2
      ;;
    --bin-dir)
      BIN_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  die "This installer currently supports macOS only."
fi

require_cmd curl
require_cmd hdiutil
require_cmd python3

tmp_dir="$(mktemp -d)"
mount_dir=""

cleanup() {
  if [[ -n "${mount_dir}" && -d "${mount_dir}" ]]; then
    hdiutil detach "${mount_dir}" -quiet || true
  fi
  if [[ -d "${tmp_dir}" ]]; then
    rm -rf "${tmp_dir}"
  fi
}
trap cleanup EXIT

fetch_release_json() {
  local api_url="https://api.github.com/repos/${REPO}/releases/latest"
  if [[ -n "${REF}" ]]; then
    api_url="https://api.github.com/repos/${REPO}/releases/tags/${REF}"
  fi
  curl -fsSL "${api_url}"
}

release_json=""
if [[ -z "${DMG_URL}" || -z "${REF}" ]]; then
  release_json="$(fetch_release_json)"
fi

if [[ -z "${REF}" ]]; then
  REF="$(
    printf '%s' "${release_json}" | python3 - <<'PY'
import json
import sys

data = json.load(sys.stdin)
print(data.get("tag_name", ""))
PY
  )"
fi

if [[ -z "${DMG_URL}" ]]; then
  DMG_URL="$(
    printf '%s' "${release_json}" | python3 - <<'PY' || true
import json
import sys

data = json.load(sys.stdin)
for asset in data.get("assets", []):
    name = asset.get("name", "")
    url = asset.get("browser_download_url", "")
    if name.lower().endswith(".dmg"):
        print(url)
        raise SystemExit(0)
raise SystemExit(1)
PY
  )"
fi

if [[ -z "${REF}" ]]; then
  die "Could not determine release tag. Set MARGINALIA_REF."
fi

if [[ -z "${DMG_URL}" ]]; then
  die "Could not find a DMG asset. Set MARGINALIA_DMG_URL."
fi

dmg_path="${tmp_dir}/${APP_NAME}.dmg"
log "Downloading DMG..."
curl -fsSL "${DMG_URL}" -o "${dmg_path}"

mount_dir="${tmp_dir}/mount"
mkdir -p "${mount_dir}"
hdiutil attach "${dmg_path}" -nobrowse -quiet -mountpoint "${mount_dir}"

app_source="$(find "${mount_dir}" -maxdepth 1 -name "*.app" -type d -print -quit)"
if [[ -z "${app_source}" ]]; then
  die "No .app found inside the DMG."
fi

install_app() {
  local source_app="$1"
  local target_app="${APP_DIR}/$(basename "${source_app}")"
  local target_parent
  target_parent="$(dirname "${target_app}")"

  if [[ ! -d "${target_parent}" ]]; then
    if [[ -w "$(dirname "${target_parent}")" ]]; then
      mkdir -p "${target_parent}"
    else
      sudo mkdir -p "${target_parent}"
    fi
  fi

  if [[ -d "${target_app}" ]]; then
    local backup="${target_app}.bak.$(date +%Y%m%d%H%M%S)"
    log "Existing app found, moving to ${backup}"
    if [[ -w "${target_parent}" ]]; then
      mv "${target_app}" "${backup}"
    else
      sudo mv "${target_app}" "${backup}"
    fi
  fi

  log "Installing ${APP_NAME}.app to ${APP_DIR}"
  if [[ -w "${target_parent}" ]]; then
    ditto "${source_app}" "${target_app}"
  else
    sudo ditto "${source_app}" "${target_app}"
  fi
}

install_cli() {
  local cli_url="https://raw.githubusercontent.com/${REPO}/${REF}/scripts/marginalia"
  local target_dir="${BIN_DIR}"
  if [[ -z "${target_dir}" ]]; then
    if [[ -w "/usr/local/bin" ]]; then
      target_dir="/usr/local/bin"
    else
      target_dir="${HOME}/.local/bin"
    fi
  fi

  if [[ ! -d "${target_dir}" ]]; then
    if [[ -w "$(dirname "${target_dir}")" ]]; then
      mkdir -p "${target_dir}"
    else
      sudo mkdir -p "${target_dir}"
    fi
  fi

  local target_cli="${target_dir}/marginalia"
  log "Installing CLI to ${target_cli}"
  if [[ -w "${target_dir}" ]]; then
    curl -fsSL "${cli_url}" -o "${target_cli}"
    chmod +x "${target_cli}"
  else
    local tmp_cli="${tmp_dir}/marginalia"
    curl -fsSL "${cli_url}" -o "${tmp_cli}"
    chmod +x "${tmp_cli}"
    sudo mv "${tmp_cli}" "${target_cli}"
  fi

  if [[ ":${PATH}:" != *":${target_dir}:"* ]]; then
    log "Add ${target_dir} to PATH to use the CLI:"
    log "  export PATH=\"${target_dir}:\$PATH\""
  fi
}

install_hook() {
  local hook_dir="${HOME}/.marginalia/hooks"
  local hook_path="${hook_dir}/post-write.sh"
  local hook_url="https://raw.githubusercontent.com/${REPO}/${REF}/hooks/post-write.sh"

  mkdir -p "${hook_dir}"
  log "Installing hook to ${hook_path}"
  curl -fsSL "${hook_url}" -o "${hook_path}"
  chmod +x "${hook_path}"
}

configure_claude_settings() {
  local settings_path="$1"
  local hook_path="$2"
  local hook_mode="$3"

  python3 - "${settings_path}" "${hook_path}" "${HOOK_MATCHER}" "${hook_mode}" <<'PY'
import json
import os
import sys

settings_path, hook_path, matcher, hook_mode = sys.argv[1:]
if hook_mode not in {"sync", "async"}:
    hook_mode = "sync"

data = {}
if os.path.exists(settings_path):
    with open(settings_path, "r") as handle:
        try:
            data = json.load(handle)
        except json.JSONDecodeError as exc:
            sys.stderr.write(f"Invalid JSON in {settings_path}: {exc}\n")
            sys.exit(1)

hooks = data.get("hooks") or {}
post_tool_use = hooks.get("PostToolUse") or []
if not isinstance(post_tool_use, list):
    post_tool_use = [post_tool_use]

if hook_mode == "async":
    command = f"MARGINALIA_REVIEW_MODE=async bash {hook_path}"
else:
    command = f"bash {hook_path}"

hook_entry = {
    "type": "command",
    "command": command,
    "timeout": 1800000,
}
if hook_mode == "async":
    hook_entry["async"] = True

entry = {
    "matcher": matcher,
    "hooks": [hook_entry],
}

def references_marginalia_hook(existing):
    if not isinstance(existing, dict):
        return False
    hooks_list = existing.get("hooks")
    if not isinstance(hooks_list, list):
        return False
    for hook in hooks_list:
        if not isinstance(hook, dict):
            continue
        if hook.get("type") != "command":
            continue
        command_text = hook.get("command", "")
        if f"bash {hook_path}" in command_text:
            return True
    return False

post_tool_use = [existing for existing in post_tool_use if not references_marginalia_hook(existing)]
post_tool_use.append(entry)

hooks["PostToolUse"] = post_tool_use
data["hooks"] = hooks

parent_dir = os.path.dirname(settings_path)
if parent_dir:
    os.makedirs(parent_dir, exist_ok=True)
with open(settings_path, "w") as handle:
    json.dump(data, handle, indent=2)
    handle.write("\n")

print(f"Wrote {settings_path}")
PY
}

install_app "${app_source}"
install_cli
install_hook

claude_settings_path=""
if [[ "${WITH_CLAUDE}" == "true" ]]; then
  if [[ "${CLAUDE_SCOPE}" == "global" ]]; then
    claude_settings_path="${HOME}/.claude/settings.json"
  else
    claude_settings_path="$(pwd)/.claude/settings.json"
  fi
  configure_claude_settings "${claude_settings_path}" "${HOME}/.marginalia/hooks/post-write.sh" "${HOOK_MODE}"
fi

log "Install complete."
if [[ -n "${claude_settings_path}" ]]; then
  log "Claude hook configured at ${claude_settings_path}."
else
  log "Next: run 'marginalia init' in your project to install the Claude hook."
fi
log "Optional: run 'marginalia smoke-test' to verify end-to-end."
