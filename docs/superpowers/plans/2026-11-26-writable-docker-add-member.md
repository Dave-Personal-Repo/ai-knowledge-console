# Writable Docker Add Member Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let the Dockerized console mutate the live local hub clones and expose a role-filtered, confirmation-gated Add member command.

**Architecture:** The console remains a vanilla Node/HTTP app with a fixed command catalog. A new `memberAdd` entry reuses the existing field form, validation, confirmation and `runKb()` path; POST authorization reuses `assertTargetAllowed()` against a synthetic new-member role. Docker Compose changes only the two knowledge clone mounts to read/write; auth and host-state mounts stay read-only.

**Tech Stack:** Node.js 22, vanilla browser JS, Docker Compose, `node:test`, headless Chrome/CDP for live proof.

**Spec:** `docs/superpowers/specs/2026-11-26-writable-docker-add-member-design.md`

## Global Constraints

- No new frontend dependency, sign-in system, proxy service or arbitrary `kb` runner.
- `runKb()` continues to use `spawnSync(..., shell: false)` and the fixed `argv()` mapping.
- Every mutating command requires `values.confirm === true`.
- `CODE_OWNER` may target only `COLLABORATOR` and `MEMBER`; `SUPER_OWNER` may target all roles.
- Login values must pass the existing `LOGIN_RE` and must not equal the current identity.
- Do not execute a real `kb members add` during verification.
- Host `gh`, `kb` state and agent-auth mounts stay read-only; only the two knowledge clones become writable.
- Loopback binding and owner gate are unchanged.
- Leave changes uncommitted unless the operator asks for a push.

## Review Focus

- `CODE_OWNER` forging `role: SUPER_OWNER` directly in POST must return 403. Task 1 pins this.
- A flag-like or invalid login must return 400 before argv construction. Task 1 pins this.
- Adding the current identity must return 403. Task 1 pins this.
- Missing `confirm` must return 400. Task 1 pins this.
- Docker must mount both clones `rw` while auth/state remain `ro`. Task 2 pins this.

---

### Task 1: Add member command

**Files:**
- Modify: `server.js` (`COMMANDS`, POST authorization branch)
- Modify: `test/api.test.js`
- Test: `test/api.test.js`

**Interfaces:**
- Consumes: `COMMANDS`, `validateValues()`, `assertTargetAllowed()`, `publicCommand()`, `runKb()`.
- Produces: `memberAdd` command with `id`, `fields: [login, role]`, `mutating: true`, and `argv: (v) => ['members', 'add', v.login, '--role', v.role]`.

- [x] **Step 1: Write the failing tests**

Add to `test/api.test.js`:
- a test that `POST /api/commands/memberAdd` with `{ login: 'new-member', role: 'MEMBER', confirm: true }` returns 200 and the stub stdout contains `stub:members add new-member --role MEMBER`;
- a test that the same POST without `confirm` returns 400 with `/Confirm is required/`;
- a test that `{ login: '--evil', role: 'MEMBER', confirm: true }` returns 400 with `/Invalid login/`;
- a test that `POST /api/commands/memberAdd` with `login: 'tester-code'` and `role: 'MEMBER'` returns 403 with `/your own account/`;
- set identity to `CODE_OWNER`, refresh `/api/session?fresh=1`, then assert POST with `role: 'CODE_OWNER'` returns 403 and that `/api/commands` exposes `memberAdd` role options `['COLLABORATOR', 'MEMBER']`.

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --test test/api.test.js`
Expected: all new tests fail because `memberAdd` is unknown.

- [x] **Step 3: Add the command and authorization**

In `server.js`:
- add `memberAdd` to `COMMANDS` after `membersList` with `group: 'change'`, `mutating: true`, `description: 'Add a member and invite them on GitHub.'`, fields `loginField()` and `field('role', 'enum', 'Role', { options: ROLES, required: true })`, and the exact argv above;
- in the POST handler, after `validateValues()` and before `command.targetAction`, handle `command.id === 'memberAdd'` by calling `assertTargetAllowed(session, { ...body.values, action: 'add' }, { role: body.values.role })` and returning 403 when it denies.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

### Task 2: Writable Docker mounts and docs

**Files:**
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Create: `test/docker.test.js`
- Test: `test/docker.test.js`, live CDP DOM check

**Interfaces:**
- Consumes: rebuilt container from `make restart`, `/api/commands` for the live session.
- Produces: verified writable knowledge mounts and live `memberAdd` command card.

- [x] **Step 1: Write the failing test**

Create `test/docker.test.js` with assertions that `docker-compose.yml` contains exactly two knowledge clone mount lines ending in `:rw` and that the `gh`, `kb` state and `.agent-auth` mount lines still end in `:ro`.

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test test/docker.test.js`
Expected: FAIL because the knowledge mounts still end in `:ro`.

- [x] **Step 3: Change the mounts**

In `docker-compose.yml`, change both `/knowledge/ai-knowledge` and `/knowledge/ai-knowledge-sensitive` bind mounts from `:ro` to `:rw` and update the comment to say the console can write these hubs. Do not change auth/state mounts.

- [x] **Step 4: Update documentation**

In `README.md`, replace the read-only Docker claims so they say:
- the two hub clones are writable in Docker and mutations run there;
- `gh`, `kb` state and agent auth remain read-only;
- Add member sends GitHub invitations, updates `members/members.json` and pushes to hub `main`;
- `npm start` remains available for local runs.

Also update the file-summary line for `docker-compose.yml`.

- [x] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run check && git diff --check`
Expected: all tests pass and checks are clean.

- [x] **Step 6: Rebuild and live proof**

Run: `make restart`, then assert `/api/commands` exposes `memberAdd` for the live `SUPER_OWNER` session and that the live browser command card opens in the existing dialog with a confirmation control. Do not execute Add member.

- [x] **Step 7: Final checks**

Run: `npm test && npm run check && git diff --check`
Expected: clean.

- [x] **Step 8: No commit**

Leave the change uncommitted unless the operator asks for a push.
