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
