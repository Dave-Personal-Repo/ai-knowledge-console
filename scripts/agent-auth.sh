#!/usr/bin/env bash
# Copy this machine's agent logins and provider config into .agent-auth/ so Docker can use them.
#
#   ./scripts/agent-auth.sh
#
# Sources: OpenCode auth.json, OpenCode config (openai/anthropic provider entries),
# ~/.codex, and ~/.claude. Missing sources become empty placeholders so Compose still starts.
# The target is gitignored and readable by the container user (UID 1001).
set -euo pipefail
cd "$(dirname "$0")/.."

source_home="${AGENT_AUTH_SOURCE_HOME:-$HOME}"
target_dir="${AGENT_AUTH_DIR:-.agent-auth}"

rm -rf "$target_dir"
mkdir -p "$target_dir"

copy_file() {
  local source="$1" dest="$2"
  if [ -f "$source" ]; then
    install -m 644 "$source" "$dest"
    echo "Copied $source -> $dest"
  else
    : > "$dest"
    chmod 644 "$dest"
    echo "Missing $source; created empty $dest"
  fi
}

copy_dir() {
  local source="$1" dest="$2"
  mkdir -p "$dest"
  if [ -d "$source" ]; then
    cp -R "$source/." "$dest/"
    chmod -R a+rX "$dest"
    echo "Copied $source -> $dest"
  else
    echo "Missing $source; created empty $dest"
  fi
}

copy_file "$source_home/.local/share/opencode/auth.json" "$target_dir/opencode-auth.json"
copy_file "$source_home/.config/opencode/opencode.jsonc" "$target_dir/opencode.jsonc"
copy_dir "$source_home/.codex" "$target_dir/codex"
copy_dir "$source_home/.claude" "$target_dir/claude"

echo "Recreate the container to load it:  make restart"
