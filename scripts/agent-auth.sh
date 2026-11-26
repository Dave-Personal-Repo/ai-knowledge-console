#!/usr/bin/env bash
# Copy this machine's agent logins and provider config into .agent-auth/ so Docker can use them.
#
#   ./scripts/agent-auth.sh
#
# Sources: OpenCode auth.json/config/AGENTS.md, ~/.codex, ~/.claude, the engineering policy,
# the host git identity, and which agent CLIs are installed on the host. Missing sources become
# empty placeholders so Compose still starts. The target is gitignored and readable by UID 1001.
# Host CLI presence is copied as detection-only shims: macOS binaries cannot run in the container.
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
copy_file "$source_home/.config/opencode/AGENTS.md" "$target_dir/opencode-agents.md"
copy_dir "$source_home/.codex" "$target_dir/codex"
copy_dir "$source_home/.claude" "$target_dir/claude"

mkdir -p "$target_dir/engineering-ai/policy"
copy_file "$source_home/engineering-ai/policy/ENGINEERING_POLICY.md" "$target_dir/engineering-ai/policy/ENGINEERING_POLICY.md"

# Doctor checks agent CLIs with shutil.which(). Record host presence as executable shims so the
# container can report installed agents without trying to run macOS binaries inside Linux.
tools_dir="$target_dir/host-tools"
rm -rf "$tools_dir"
mkdir -p "$tools_dir"
for binary in claude opencode codex gemini copilot junie; do
  if command -v "$binary" >/dev/null 2>&1; then
    cat > "$tools_dir/$binary" <<EOF
#!/bin/sh
printf '%s: installed on the host, but cannot run inside this Linux container.\n' '$binary' >&2
exit 64
EOF
    chmod 755 "$tools_dir/$binary"
    echo "Detected host tool: $binary"
  fi
done

# kb members add commits and pushes with plain git, so the container needs a real author identity.
git_config="$source_home/.gitconfig"
git_name=$(git config --file "$git_config" user.name 2>/dev/null || true)
git_email=$(git config --file "$git_config" user.email 2>/dev/null || true)
if [ -z "$git_name" ] || [ -z "$git_email" ]; then
  git_name="kb"
  git_email="kb@users.noreply.github.com"
fi
printf '%s\n' "$git_name" > "$target_dir/git-identity-name"
printf '%s\n' "$git_email" > "$target_dir/git-identity-email"
echo "Captured git identity: $git_name <$git_email>"

echo "Recreate the container to load it:  make restart"
