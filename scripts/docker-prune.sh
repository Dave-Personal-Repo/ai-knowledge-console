#!/usr/bin/env bash
# Delete superseded ai-knowledge-console images left behind by earlier builds.
# Only unused, untagged images carrying this project's title label are removed.
set -uo pipefail

if ! command -v docker >/dev/null 2>&1; then
  exit 0
fi

out="$(docker image prune --force \
  --filter "label=org.opencontainers.image.title=ai-knowledge-console" 2>&1)" || {
  echo "Could not remove old console images (continuing): ${out}" >&2
  exit 0
}

reclaimed="$(printf '%s\n' "${out}" | sed -n 's/^Total reclaimed space: //p')"
if printf '%s\n' "${out}" | grep -q '^Deleted Images:'; then
  echo "Removed old console images (reclaimed ${reclaimed:-some space})."
fi
