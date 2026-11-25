# Knowledge Console: member administration and hub operations — design

**Date:** 2026-11-25
**Status:** Approved by delegation from the owner ("I left the decision to you").

## Intent

The console is currently a read-only viewer. The owner wants it to become the place where hub work happens: open it automatically at startup, inspect members and their role scopes with role-aware visibility, change member roles and capabilities, and run the informative and maintenance `kb` commands from the UI (`status`, `doctor`, `report`, `publish --verify`, `sync`, `triage`, `cleanup`, `promote`, `publish`).

## Goals

- `npm start` opens `http://127.0.0.1:4310` in the default browser after the server listens.
- Access & roles shows every member the current role may see: login, display name, role, status, joined date, per-member scopes, and the full scope list granted by that member's role.
- SUPER_OWNER sees all members and all role scope lists; CODE_OWNER sees CODE_OWNER, COLLABORATOR and MEMBER members and their scope lists only.
- Only SUPER_OWNER and CODE_OWNER sessions can open the UI (existing gate, unchanged).
- SUPER_OWNER may change any visible other member. CODE_OWNER may read CODE_OWNER peers but may only change COLLABORATOR and MEMBER targets, and may only assign COLLABORATOR or MEMBER roles — matching `kb`'s `code_owners.create/update` requirement. Nobody may change their own account through the UI.
- A Hub operations page runs a curated set of `kb` commands with fixed, validated arguments, shows captured stdout/stderr/exit code, and requires explicit confirmation for changing commands.

## Non-goals

- Per-person sign-in. The console keeps using the single hub identity reported by `kb whoami`. Two people on one machine cannot get different UI roles; the UI's role is the role of the identity that runs the server.
- A generic "run any `kb` command" text box. `uninstall`, `push`, `cleanup delete`, `gate allow`, `bootstrap --apply`, `mirror revoke`, `members remove/revoke` and hook commands that read stdin are deliberately not exposed.
- Editing knowledge documents or arbitrary files.
- Making the Docker hub mounts writable. Mutating commands need a writable hub clone; the Docker deployment keeps its read-only mounts and such commands return `kb`'s own error.

## Constraints

- Node 18+, zero runtime dependencies. No new npm packages.
- Existing auth gate: every `/api/*` request except `/api/session` re-checks `kb whoami` and requires SUPER_OWNER or CODE_OWNER.
- `kb` is the only hub interface for commands; all calls run with `cwd: KB_ROOT` and without a shell.
- Role order for filtering: `SUPER_OWNER > CODE_OWNER > COLLABORATOR > MEMBER`.
- Role scopes come from `config/rbac.json:roles`; member detail comes from `members/members.json`.
- Commands never receive free-form shell text. Every field is validated against a server-side schema and passed as a separate argv element.
- Output is capped at 64 KiB and redacts token-like patterns before reaching the browser.
- The existing working-tree edits in `.gitignore`, `Dockerfile`, `README.md`, `docker-compose.yml` and `docker-entrypoint.sh` are user work and must be preserved, not overwritten.

## Approaches considered

1. **Single hub identity + curated operator actions (chosen).** Reuses the existing gate; `kb` enforces its own permissions for every call. Smallest new surface. Cost: no per-browser-user identity.
2. **Single hub identity + generic command runner.** Complete command coverage, but one typo can push, revoke a member, or uninstall local config. Rejected: the trust-boundary cost outweighs coverage.
3. **Add GitHub sign-in per browser user.** Real per-person roles, but new secrets, a new auth flow, and `kb` still executes as the host identity. Rejected as out of scope.

## UI contract

### Access & roles

- Header shows the current role and a refresh button.
- Table columns: Account, Display name, Role, Status, Scopes (count), Joined, Detail button. All statuses are shown (`active`, `invited`, `suspended`, `revoked`, `removed`); the dashboard's "active owners" count still counts only `active`.
- Detail panel: full role scope list (alphabetical), per-member extra scopes, and action controls. Actions are `set-role`, `grant`, `ungrant`, `suspend`, `reinstate` only. Each requires a confirmation checkbox. `grant`/`ungrant` take one scope matching `^(company|federated):[A-Za-z0-9._-]+$|^project:[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`; `set-role` takes one of the four roles. `reinstate` is offered only for `suspended` members; revoked/removed accounts stay visible but are not reversible from the UI.
- CODE_OWNER cannot see SUPER_OWNER members, and cannot act on CODE_OWNER peers even though they are visible. The server filters data and rejects unauthorized targets; client filtering is cosmetic only.

### Hub operations

Two groups, rendered from a server-provided catalog:

| Group | Commands |
| --- | --- |
| Read | `status`, `doctor`, `report` (days / compare date), `publish --verify`, `triage` (bucket view; and by source), `validate`, `capabilities`, `members list`, `roles list`, `features list`, `audit`, `logs`, `cleanup status`, `cleanup report`, `cleanup intent` |
| Change | `sync`, `publish`, `cleanup run` (scope), `promote` (note/folder, reviewer, evidence, optional judgement), `members set-role`, `members grant`, `members ungrant`, `members suspend`, `members reinstate` |

Result panel shows the exact `kb` command, exit code, duration, stdout and stderr. A failing `kb` call is shown as a failed result, not a thrown page error.

`promote` is two-step: run without `--apply` to preview, then the same form with "Apply" + reviewer + evidence (at least 10 characters) to run with `--apply`. `cleanup run` is also two-step: default dry run, then "Apply" + confirmation to run with `--apply`. Every mutating command requires `confirm: true` server-side, including `sync` and plain `publish`. `cleanup delete` is not exposed.

## API contract

- `GET /api/session` — unchanged.
- `GET /api/inventory` — adds `members` (all visible members with `status`, `scopes`, `joined`, `display`) and `roleScopes` (full permission arrays for visible roles only). Existing `permissionCounts` retained for the dashboard.
- `GET /api/commands` — `{ commands: [{ id, label, group, description, mutating, fields: [{ name, type, label, required, options? }] }] }`.
- `POST /api/commands/:id` — body `{ values: { ... }, confirm?: boolean }`. Requires `Content-Type: application/json` and `X-KConsole: 1`. Returns
  `{ id, command, ok, exitCode, stdout, stderr, durationMs }`. Errors: `400` invalid/missing field or body, `403` role not allowed or target above role, `404` unknown command, `500` execution failure. No other endpoints.

## Implementation shape

- `server.js`: add browser opener, command catalog, field validation, fixed argv builders, `spawnSync` runner with output cap/redaction, role-aware inventory filtering, and the two new routes. Keep one file, matching the existing zero-dependency server.
- `public/index.html`, `public/app.js`, `public/styles.css`: add the Hub operations route and upgrade Access & roles. Forms are generated from `/api/commands`, so the browser holds no command definitions.
- `test/server.test.js` with Node's built-in `node:test`: unit tests for role visibility, field validation/argv building, redaction and the inventory shape. `npm test` runs them.
- `README.md`: document auto-open, the new pages, who can run what, and the writable-clone requirement for changes.
- No lockfile, no dependencies, no generated files.

## Verification

- `npm run check` and `npm test` pass.
- Start the server locally and verify in a real browser: auto-open, read-only command results (`status`, `report --compare`, `publish --verify`), member detail and scope lists, confirmation gating, and that a CODE_OWNER session cannot see SUPER_OWNER members (tested via the role-filter unit and a stubbed session where a real second identity is unavailable).
- Mutating commands are verified only up to validation/confirmation and dry-run preview; no real member, hub, or knowledge mutation is performed during implementation.
