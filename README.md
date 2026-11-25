# AI Knowledge Console

A self-hosted, owner-only console for the private AI knowledge hub. It turns the hub's Markdown documents, statuses, evidence and role model into a searchable, readable interface, and exposes a curated set of `kb` member and maintenance commands — without copying any knowledge into this repository.

## Run it

Requires Node.js 18+ and a local canonical clone at `~/knowledge/ai-knowledge` (plus `~/knowledge/ai-knowledge-sensitive` for restricted documents).

```bash
npm start
# opens http://127.0.0.1:4310 in your browser
```

The browser opens automatically on macOS, Linux and Windows. Set `OPEN_BROWSER=0` to keep the server headless; opening is also skipped in CI and Docker.

Environment overrides: `PORT`, `HOST`, `KB_ROOT`, `KB_SENSITIVE_ROOT`, `OPEN_BROWSER`. Changing commands need a writable local `kb` clone; the read-only Docker mounts described below are suitable for browsing and read-only commands only.

## Docker

Follows the same shape as `auto-review-pr-bot`: non-root runtime, `env_file`, read-only mounts, healthcheck.

```bash
mkdir -p .secret && chmod 700 .secret
printf 'GH_TOKEN=%s\n' "$(gh auth token)" > .secret/credentials.env && chmod 600 .secret/credentials.env
make build
make up
# http://127.0.0.1:4310
```

`kb` re-verifies with GitHub every 5 minutes and reads roles from the canonical repository. A container cannot use your macOS keyring, so `GH_TOKEN` in `.secret/credentials.env` (gitignored) is required for durable access: a copied `hosts.yml` alone works only until the cache expires. The entrypoint (root only, then drops to UID 1001) copies the login into the container home because `hosts.yml` is mode 600, and seeds a writable container `kb` state from the host's proven login and canonical role cache so startup works before the first GitHub refresh. `KB_IDENTITY` is a claimed login only; it grants nothing without verification.

Compose mounts the two hub clones read-only at `/knowledge/ai-knowledge` and `/knowledge/ai-knowledge-sensitive`, and the host's `kb` state read-only at `/run/kb-state`. The healthcheck fails when `/api/session` is not authorized. `make health` checks the same endpoint, `make logs` follows the container, `make down` stops it. Copy `.env.example` to `.env` to change the host port or bind address. The container never writes to the knowledge or host-state mounts; only its own `kb` state is writable, so changing commands such as `sync`, `publish`, `cleanup run` and member updates must be run through a local `npm start` against a writable clone.

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
- **Knowledge** — search, status/source/category filters, sorting and a reader that renders front matter, evidence and Markdown.
- **Rules & policies** — governance, process and RBAC documents from the hub.
- **Access & roles** — roster with status, scope counts and a detail panel showing the role's full scope list. Owners can change role, grant/ungrant a scope and suspend/reinstate eligible members.
- **Hub operations** — read-only views (`status`, `doctor`, `report`, `publish --verify`, triage, validate, capabilities, roster, roles, features, audit, logs, cleanup status/report/intent) and confirmed changes (`sync`, `publish`, `cleanup run`, `promote` with optional judgement).
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
docker-entrypoint.sh host gh login overlay, then drops to UID 1001
docker-compose.yml   read-only hub mounts, loopback port, state volume
Makefile             build/up/down/logs/health/check
```
