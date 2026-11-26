# Writable Docker hub access + Add member — short design

## Intent

The operator wants the Dockerized console to use the live local hub data, including the ability to add a member. Today the container reads both host clones correctly (`/api/inventory` shows 1053 documents and 5 members), but the mounts are read-only and the curated command catalog has no `members add`.

## Goals

- Let the container write to the two host hub clones so `kb` mutations work inside Docker.
- Add an **Add member** operation to Hub operations → change group.
- Keep the owner gate, loopback binding, fixed command allowlist, validation and explicit confirmation.
- Match hub permissions: `SUPER_OWNER` may add any role; `CODE_OWNER` may add `COLLABORATOR` or `MEMBER` only.

## Non-goals / anti-goals

- No new sign-in system, proxy service, frontend dependency or arbitrary `kb` runner.
- No change to role enforcement in the authoritative `kb` CLI.
- No automatic add-member execution by the assistant; this only exposes the operator-controlled UI action.

## Constraints

- `kb members add <login> --role <role>` validates the GitHub login, checks the caller's `members.<action>` permission, writes `members/members.json`, sends GitHub invitations, syncs console-repo access, and pushes to hub `main` unless flags say otherwise.
- Console command values are already validated by `validateValues()` and converted to argv by fixed `argv()` functions with `spawnSync(..., shell: false)`.
- `CODE_OWNER` cannot assign roles above `COLLABORATOR` anywhere in the console.
- Docker Compose currently mounts both clones with `:ro`.
- Changing access permissions and pushing hub data are high-impact; the operator explicitly chose writable Docker access and asked for Add member.

## Approaches

1. **Writable mounts + curated `memberAdd` (chosen).** Directly fits the existing command catalog and the hub CLI. Tradeoff: the container can modify hub data, mitigated by loopback binding and the owner gate.
2. **Read-only mounts + host-only mutations.** Rejected by the operator's explicit choice; Add member would fail in Docker.
3. **Host proxy service.** Rejected as unnecessary complexity and a new trust boundary.

## Implementation outline

- `docker-compose.yml`: change both knowledge clone mounts from `:ro` to `:rw`.
- `server.js`: add a `memberAdd` command with `login` and `role` fields; validate the login against the same GitHub-login shape used by `kb`; restrict role options in `publicCommand()` so `CODE_OWNER` only sees `COLLABORATOR`/`MEMBER`; keep `mutating: true` so confirmation remains mandatory.
- `test/api.test.js`: pin the exact argv, login validation, confirmation requirement, and `CODE_OWNER` role filtering for `memberAdd`.
- `test/ui.test.js`: if the command form needs a new field hint, pin only the existing generic field rendering; no new UI mode.
- `README.md`: state that Docker mounts are writable, mutations work in the container, and Add member sends GitHub invitations/pushes hub `main`.

## Verification

- `npm test`, `npm run check`, `git diff --check`.
- `make restart`, then confirm `/api/commands` exposes `memberAdd` with the correct role options for the live `SUPER_OWNER` session.
- Read-only proof of the underlying hub behavior via `kb members add --help`; do not execute a real add.
- Live CDP check that the command card opens in the existing dialog with confirmation required.

## What is left to the builder

- Follow TDD for the command catalog changes, then implement.
- Leave the change uncommitted unless the operator asks for a push.
