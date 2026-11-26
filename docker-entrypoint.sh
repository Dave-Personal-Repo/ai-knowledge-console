#!/bin/sh
# Container entrypoint.
#
# The hub's `kb` CLI verifies identity with `gh api user`. On the host that login lives in
# ~/.config/gh/hosts.yml (mode 600), which the container user cannot read through a bind mount.
# Root copies it once into the container home with the right ownership, then drops privileges.
# A GH_TOKEN supplied through env_file makes this copy unnecessary.
set -e

auth_source="${GH_AUTH_SOURCE:-/run/gh/hosts.yml}"
auth_dir="${GH_CONFIG_DIR:-/home/console/.config/gh}"
auth_dest="$auth_dir/hosts.yml"

state_dir="${KB_STATE:-/home/console/.local/state/kb}"
seed_root="${KB_STATE_SEED:-/run/kb-state}"

mkdir -p "$auth_dir" "$state_dir" "$state_dir/canonical"
chown console:console "$auth_dir" /home/console/.local/state

if [ ! -s "$auth_dest" ] && [ -s "$auth_source" ]; then
  cp "$auth_source" "$auth_dest"
  chmod 600 "$auth_dest"
  chown console:console "$auth_dest"
fi

# OpenCode login/config and the Codex/Claude home state are refreshed on the host by
# scripts/agent-auth.sh. Copy them into the container user's home so any agent tooling has the
# same providers and logins as the host; the mount stays read-only and the copy is disposable.
console_home=/home/console
agent_root="${AGENT_AUTH_ROOT:-/run/agent-auth}"

if [ -s "$agent_root/opencode-auth.json" ]; then
  mkdir -p "$console_home/.local/share/opencode"
  cp "$agent_root/opencode-auth.json" "$console_home/.local/share/opencode/auth.json"
  chmod 600 "$console_home/.local/share/opencode/auth.json"
fi
if [ -s "$agent_root/opencode.jsonc" ]; then
  mkdir -p "$console_home/.config/opencode"
  cp "$agent_root/opencode.jsonc" "$console_home/.config/opencode/opencode.jsonc"
fi
for name in codex claude; do
  if [ -d "$agent_root/$name" ]; then
    mkdir -p "$console_home/.$name"
    cp -R "$agent_root/$name/." "$console_home/.$name/"
  fi
done
chown -R console:console "$console_home/.codex" "$console_home/.claude" \
  "$console_home/.config/opencode" "$console_home/.local/share/opencode"

# Host-detected agent binaries are copied as detection-only shims. They make `kb doctor`
# report the operator's installed tools without trying to run macOS binaries in Linux.
tool_bin="$console_home/.local/bin"
mkdir -p "$tool_bin"
if [ -d "$agent_root/host-tools" ]; then
  cp -R "$agent_root/host-tools/." "$tool_bin/"
fi
if [ -s "$agent_root/opencode-agents.md" ]; then
  mkdir -p "$console_home/.config/opencode"
  cp "$agent_root/opencode-agents.md" "$console_home/.config/opencode/AGENTS.md"
fi
mkdir -p "$console_home/engineering-ai/policy"
if [ -s "$agent_root/engineering-ai/policy/ENGINEERING_POLICY.md" ]; then
  cp "$agent_root/engineering-ai/policy/ENGINEERING_POLICY.md" "$console_home/engineering-ai/policy/ENGINEERING_POLICY.md"
fi

# `kb members add` commits and pushes with plain git. Give the console user the captured host
# identity and a GH_TOKEN-backed HTTPS path for the hub's SSH-style origin remote.
git_config="$console_home/.gitconfig"
if [ -s "$agent_root/git-identity-name" ] && [ -s "$agent_root/git-identity-email" ]; then
  git config --file "$git_config" user.name "$(cat "$agent_root/git-identity-name")"
  git config --file "$git_config" user.email "$(cat "$agent_root/git-identity-email")"
fi
if [ -n "${GH_TOKEN:-}" ]; then
  HOME="$console_home" gh auth setup-git >/dev/null 2>&1 || true
  git config --file "$git_config" url."https://github.com/".insteadOf git@github.com:
fi
chown -R console:console "$tool_bin" "$console_home/.config/opencode" "$console_home/engineering-ai"
if [ -f "$git_config" ]; then chown console:console "$git_config"; fi

# kb reads roles and licence status from a canonical-file cache in STATE. Seed it from the
# host's proven login and cache, then let kb own a writable copy: a stale host gh token still
# works, and a working GH_TOKEN can refresh it without writing through the read-only mount.
if [ -d "$seed_root/canonical" ]; then
  cp -R "$seed_root/canonical/." "$state_dir/canonical/"
fi
for f in gh-login.json license.json identity.json membership.json gate.jsonl; do
  if [ -s "$seed_root/$f" ]; then
    cp "$seed_root/$f" "$state_dir/$f"
  fi
done
chown -R console:console /home/console/.local/state

exec gosu console "$@"
