#!/usr/bin/env bash
# Start the Docker console, wait until it is authorised, then open it on the host.
#
#   ./scripts/docker-up.sh            rebuild, start detached, wait, open the UI
#   ./scripts/docker-up.sh --no-build start the existing image without rebuilding
#   ./scripts/docker-up.sh --no-open  never open a browser
#   ./scripts/docker-up.sh --help     show this help
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD=true
NO_OPEN=false

for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=false ;;
    --no-open) NO_OPEN=true ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

port="${KCONSOLE_PORT:-4310}"
bind_ip="${KCONSOLE_BIND_IP:-127.0.0.1}"
ui_ip="$bind_ip"
if [ "$ui_ip" = "0.0.0.0" ] || [ "$ui_ip" = "::" ]; then
  ui_ip="127.0.0.1"
fi
ui_url="http://${ui_ip}:${port}/"
health_url="http://${ui_ip}:${port}/api/session"

compose_up=(docker compose up -d)
if [ "$BUILD" = true ]; then
  compose_up+=(--build)
fi

echo "Starting the console at ${ui_url}"
"${compose_up[@]}"
if [ "$BUILD" = true ]; then
  ./scripts/docker-prune.sh
fi

wait_healthy() {
  local tries=0
  while [ "$tries" -lt 60 ]; do
    if curl -fsS --max-time 2 "$health_url" 2>/dev/null | grep -q '"allowed":true'; then
      return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  return 1
}

open_ui() {
  if [ "$NO_OPEN" = true ] || [ "${OPEN_BROWSER:-1}" = "0" ] || [ -n "${CI:-}" ]; then
    return 0
  fi
  if command -v open >/dev/null 2>&1; then
    open "$ui_url" >/dev/null 2>&1 && return 0
  fi
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$ui_url" >/dev/null 2>&1 && return 0
  fi
  return 0
}

if wait_healthy; then
  echo "Console is ready."
  open_ui || true
else
  echo "The console is not authorised yet; it may still be starting." >&2
  echo "Follow the logs with: make logs" >&2
fi

echo "Dashboard: ${ui_url}"
