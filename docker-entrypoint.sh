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

mkdir -p "$auth_dir" /home/console/.local/state
chown console:console "$auth_dir" /home/console/.local/state

if [ ! -s "$auth_dest" ] && [ -s "$auth_source" ]; then
  cp "$auth_source" "$auth_dest"
  chmod 600 "$auth_dest"
  chown console:console "$auth_dest"
fi

exec gosu console "$@"
