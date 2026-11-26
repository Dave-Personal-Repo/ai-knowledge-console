# AI Knowledge Console

A self-hosted, owner-only console for the private AI knowledge hub. It turns the hub's Markdown documents, statuses, evidence and role model into a searchable, readable interface, and exposes a curated set of `kb` member and maintenance commands — without copying any knowledge into this repository.

## Run it

Requires Node.js 18+ and a local canonical clone at `~/knowledge/ai-knowledge` (plus `~/knowledge/ai-knowledge-sensitive` for restricted documents).

```bash
npm start
# opens http://127.0.0.1:4310 in your browser
```

The browser opens automatically on macOS, Linux and Windows. Running `npm start` again while the console is already running opens the existing UI instead of failing. Set `OPEN_BROWSER=0` to keep the server headless; opening is also skipped in CI and inside the container.

Environment overrides: `PORT`, `HOST`, `KB_ROOT`, `KB_SENSITIVE_ROOT`, `OPEN_BROWSER`. Changing commands need a writable local `kb` clone; the Docker mounts below are writable for the two hub clones, and `npm start` remains available for local runs.

## Docker

Follows the same shape as `auto-review-pr-bot`: non-root runtime, `env_file`, writable hub mounts with read-only auth/state mounts, healthcheck.

```bash
mkdir -p .secret && chmod 700 .secret
printf 'GH_TOKEN=%s\n' "$(gh auth token)" > .secret/credentials.env && chmod 600 .secret/credentials.env
make
# prints every target
make up
# copies host agent auth, rebuilds, waits until authorised, opens http://127.0.0.1:4310
make restart
# same thing after a clean container down
```

`make up` and `make restart` both run `scripts/agent-auth.sh`, then `scripts/docker-up.sh`. The latter rebuilds the image, waits for an authorised `/api/session`, prunes superseded images, and opens the dashboard on the host — including when the container was already running. Use `./scripts/docker-up.sh --no-build` to reuse the current image, `--no-open` or `OPEN_BROWSER=0` to stay headless, and `make auth` to refresh only the copied state.

`make auth` copies host state into gitignored `.agent-auth/`: `~/.local/share/opencode/auth.json`, `~/.config/opencode/opencode.jsonc` (including the `openai` and `anthropic` provider entries), `~/.config/opencode/AGENTS.md`, `~/.codex`, `~/.claude`, and `~/engineering-ai/policy/ENGINEERING_POLICY.md`. It also records the host git identity and writes detection-only shims for the agent CLIs found on the host (`claude`, `opencode`, `codex`, `gemini`, `copilot`, `junie`). The container entrypoint installs them into its own disposable home. Missing sources become empty placeholders so the console still starts. The copies are made readable by the container user (UID 1001); do not commit `.agent-auth/`. Override the source root with `AGENT_AUTH_SOURCE_HOME` or the target with `AGENT_AUTH_DIR`. `kb doctor` therefore reports host-installed Claude, Codex and OpenCode agents and their configured markers without executing macOS binaries in the Linux container; Gemini, Copilot and Junie detection is installation-only, and live agent runs still need `npm start` on the host.

`kb` re-verifies with GitHub every 5 minutes and reads roles from the canonical repository. A container cannot use your macOS keyring, so `GH_TOKEN` in `.secret/credentials.env` (gitignored) is required for durable access: a copied `hosts.yml` alone works only until the cache expires. The entrypoint (root only, then drops to UID 1001) copies the login into the container home because `hosts.yml` is mode 600, and seeds a writable container `kb` state from the host's proven login and canonical role cache so startup works before the first GitHub refresh. `KB_IDENTITY` is a claimed login only; it grants nothing without verification.

Compose mounts the two hub clones writable at `/knowledge/ai-knowledge` and `/knowledge/ai-knowledge-sensitive`, the host's `kb` state read-only at `/run/kb-state`, and `.agent-auth` read-only at `/run/agent-auth`. The healthcheck fails when `/api/session` is not authorized. `make status` shows container state and health, `make health` prints the gate JSON, `make logs` follows the container, `make logs-tail` prints the last 200 lines, `make ui` opens the dashboard, `make shell` opens a container shell, `make down` stops it, and `make clean` asks before deleting the state volume. Copy `.env.example` to `.env` to change the host port or bind address. Changing commands such as `sync`, `publish`, `cleanup run`, member updates and **Add member** run inside the container against the live clones; **Add member** sends GitHub invitations, updates `members/members.json` and is configured to push to hub `main` using the captured host git identity and the `GH_TOKEN`-backed HTTPS credential helper (verified with git identity and `ls-remote`; no real add was executed). Host-state and agent-auth mounts remain read-only; the container's own `kb` state and the two hub clones are writable.

## Access model

- Every API request calls `kb whoami` in the canonical clone and accepts only `SUPER_OWNER` or `CODE_OWNER`.
- The session result is cached for 60 seconds. The refresh button forces a fresh check.
- Roles come from the canonical GitHub roster, never from files in this app.
- `SUPER_OWNER` sees every member and their full scope list. `CODE_OWNER` sees `CODE_OWNER` peers and lower, but can only change `COLLABORATOR` and `MEMBER` members; it cannot see or act on `SUPER_OWNER` accounts.
- Command runs use a fixed allowlist with validated arguments and `spawnSync(..., shell: false)`. Every changing command needs explicit confirmation; `promote` and `cleanup run` also need a separate Apply step. Output is capped and token-like values are redacted.
- No document content is stored here. The server reads the two authorised clones directly and returns metadata or the requested Markdown only after the gate passes.
- Path traversal is rejected; only `knowledge/`, `docs/`, `workflows/`, `agents/shared/engineering-ai/policy/` and the three root guides are exposed.

## What is in the UI

- **Overview** — live counts, confidence profile, category mix and the latest verified notes.
- **Knowledge** — search, status/source/category filters, sorting and a reader that renders front matter, evidence and Markdown. Opening a document keeps the filtered list beside the reader in a split view, with **Knowledge** still highlighted in the menu.
- **Rules & policies** — governance, process and RBAC documents from the hub, using the same split reader. **Rules & policies** stays highlighted, including for direct document links.
- **Access & roles** — roster with status and scope counts; **Details** opens a popup showing the role's full scope list and member scopes. **View permissions** opens a popup with grouped plain-English explanations and the selected role's raw permission names. A `CODE_OWNER` session sees only `CODE_OWNER` and lower roles; `SUPER_OWNER` data is filtered server-side. Owners can change role, grant/ungrant a scope and suspend/reinstate eligible members. Grant/ungrant offer the hub's curated `known_scopes` from `config/kb.json`, plus **Other…** for a custom scope; every change still needs confirmation.
- **Hub operations** — read-only views (`status`, `doctor`, `report`, `publish --verify`, triage, validate, capabilities, roster, roles, features, audit, logs, cleanup status/report/intent) and confirmed changes (`sync`, `publish`, `cleanup run`, `promote` with optional judgement, **Add member**). Each command opens in a popup with its form and output; mutations still require explicit confirmation. **Doctor** reflects the agent CLIs installed on your Mac via detection-only shims; it does not execute them inside Docker. **Add member** sends GitHub invitations, updates the roster and pushes to hub `main`.
- **Command palette** — `⌘/Ctrl + K` to jump to any document or page.
- Dark/light themes, keyboard shortcuts (`1`, `2`, `3`), responsive layout and reduced-motion support.

## Non-goals

No arbitrary shell or `kb` runner, no billing, no public signup, no multi-tenancy and no deployment automation. Commands are limited to the catalog in `server.js`; high-risk actions such as `uninstall`, `push`, `cleanup delete`, `gate allow`, `bootstrap --apply`, `mirror revoke` and member removal/revoke are intentionally absent. Knowledge changes still flow through the hub's reviewed pull-request workflow.

## Layout

```
server.js            zero-dependency HTTP server, auth gate, inventory API and command catalog
public/              application shell, design system, router and renderer
test/                node:test unit and API coverage
Dockerfile           node:22 runtime with git, gh, python3, curl and gosu
docker-entrypoint.sh host gh/agent overlay, tool shims, git/token push setup, drops to UID 1001
docker-compose.yml   writable hub and read-only agent-auth mounts, loopback port, state volume
scripts/             auth/tool/git-identity copy, Docker up, image prune
Makefile             bot-style help/build/up/restart/logs/status/health/ui/check
```
