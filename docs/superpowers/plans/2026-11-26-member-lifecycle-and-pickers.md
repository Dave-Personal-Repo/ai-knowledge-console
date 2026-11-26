# Member lifecycle GitHub cleanup and status-scoped pickers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `kb` fully clean up GitHub access and pending invitations on suspend/remove, and make the console offer server-enforced, status-scoped member pickers with safe role defaults.

**Architecture:** The hub CLI remains authoritative for GitHub access; the console server generates eligible member options from the canonical roster and re-validates every target, while the browser renders the provided selects. Both repositories must be edited because the lifecycle gap is in `kb` and the picker gap is in the console.

**Tech Stack:** Python 3 stdlib `kb` CLI, `gh` CLI, `unittest` with fake-`gh`; Node.js 22 `node:http`, vanilla browser JS, `node:test`, live CDP check.

**Spec:** `docs/superpowers/specs/2026-11-26-member-lifecycle-and-pickers-design.md`

## Global Constraints

- Preserve all pre-existing uncommitted work in `~/knowledge/ai-knowledge` and the console repo; do not reset, clean, stash, or overwrite.
- Do not commit or push unless the operator explicitly asks.
- Do not execute a real suspend, remove, reinstate, add, or role change against the live hub.
- Status map: `active` for `set-role`, `grant`, `ungrant`, `suspend`, `remove`; `suspended` for `reinstate`; `invited`, `removed`, `revoked` appear in no picker.
- Self-target is denied for every member command, case-insensitively.
- `SUPER_OWNER` may assign any role; `CODE_OWNER` may assign only `COLLABORATOR` or `MEMBER`.
- Role selects default to `MEMBER` for both session roles; `SUPER_OWNER` is never preselected.
- Hub tests require `KB_TEST_NO_LICENSE=1`.
- Console commands keep fixed argv, `spawnSync(..., shell: false)`, and mandatory `confirm: true` for mutations.

## Review Focus

- A removed/invited/revoked login submitted directly to **Change role** must be denied server-side, not merely hidden in the UI — pinned in Task 2.
- A suspended login must appear only in **Reinstate**, and an active login must be rejected there — pinned in Task 2.
- A crafted `CODE_OWNER` request assigning `CODE_OWNER` or `SUPER_OWNER` must be denied, while `SUPER_OWNER` may assign any role — pinned in Task 2.
- Suspend and remove must cancel pending invitations in every integrated repository including the console; reinstate must restore full role-based access — pinned in Task 1.
- Role selects must default to `MEMBER` in both session roles, with no `SUPER_OWNER` preselection — pinned in Tasks 2 and 3.

---

### Task 1: Full GitHub lifecycle in `kb`

**Files:**
- Modify: `/Users/davidhenry/knowledge/ai-knowledge/scripts/kb:2102-2149,2228-2235`
- Modify: `/Users/davidhenry/knowledge/ai-knowledge/tests/test_members_github.py:107-118,137-145`
- Modify: `/Users/davidhenry/knowledge/ai-knowledge/docs/PERMISSIONS.md:90`

**Interfaces:**
- Consumes: `gh_drop_access(repo, login)`, `gh_cancel_pending_invites(repo, login)`, `integrated_repos(role)`, `gh_sync_access(login, role, drop=False)`, `rbac.GITHUB_PERMISSION`.
- Produces: `cmd_members()` handles `suspend`/`revoke`/`remove` with `drop=True` and `reinstate` with `drop=False`; no `sync_console_repo_access()` call site remains.

- [ ] **Step 1: Write the failing tests**

In `tests/test_members_github.py`:
- Replace `test_suspending_a_code_owner_drops_only_console_access` with `test_suspending_a_code_owner_drops_every_repository`: add one pending invitation id in each of hub, intake, sensitive and console; run `kb("suspend", "cod")`; assert `deletes("cod")` is exactly that repo set, `puts("cod") == {}`, and each pending id was cancelled.
- Replace `test_reinstating_a_code_owner_restores_only_console_access` with `test_reinstating_a_code_owner_restores_every_repository`: suspend then reinstate `cod`; assert `puts("cod")` contains all four repos with `push`, and `deletes("cod") == []` for the reinstate call (clear the log after suspend).
- Replace `test_suspending_a_collaborator_drops_console_read` with `test_suspending_a_collaborator_drops_every_repository`: run `kb("suspend", "col")`; assert `deletes("col")` is all four repos and `puts("col") == {}`.
- Extend `test_revoke_and_remove_cancel_pending_invitations_in_every_repo` to include `("suspend", "col")` alongside revoke and remove.

- [ ] **Step 2: Run tests to verify they fail**

Run: `KB_TEST_NO_LICENSE=1 python3 -m unittest tests.test_members_github -v`

Expected: only the three replaced/extended suspend/reinstate tests fail, with missing deletes or missing PUTs.

- [ ] **Step 3: Implement the lifecycle rule**

In `scripts/kb`:
- In `gh_cancel_pending_invites()`, add `--paginate` to the `gh api repos/{repo}/invitations --jq ...` call.
- In `cmd_members()`, replace the two separate GitHub branches with one: for `act in ("set-role", "remove", "revoke", "suspend", "reinstate")`, call `gh_sync_access(target, t["role"], drop=act in ("suspend", "revoke", "remove"))`.
- Delete the now-unused `sync_console_repo_access()` function. Keep `console_repo()` because `integrated_repos()` uses it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `KB_TEST_NO_LICENSE=1 python3 -m unittest tests.test_members_github -v`

Expected: all tests in the file pass.

- [ ] **Step 5: Update documentation**

In `docs/PERMISSIONS.md`, change the lifecycle sentence so it states that active roles get role-based access in every integrated repository, and `suspend`, `revoke` and `remove` drop collaborators and pending invitations everywhere; `reinstate` restores full role-based access.

- [ ] **Step 6: Check the full hub suite**

Run: `KB_TEST_NO_LICENSE=1 python3 -m unittest discover -s tests`

Expected: 0 failures caused by this change. If unrelated failures exist, report them by name with a base comparison; do not fix unrelated code.

### Task 2: Server-side pickers, status enforcement and safe role defaults

**Files:**
- Modify: `/Users/davidhenry/Desktop/Repositories/ai-knowledge-console/server.js:123-130,150-230,266-276,556-570,585`
- Create: `/Users/davidhenry/Desktop/Repositories/ai-knowledge-console/test/member-pickers.test.js`
- Modify: `/Users/davidhenry/Desktop/Repositories/ai-knowledge-console/test/server.test.js:83-137`

**Interfaces:**
- Consumes: `visibleMembers(members, role)`, `readJson()`, `CODE_OWNER_TARGET_ROLES`, `ROLE_RANK`.
- Produces: exported `publicCommand(command, session, members)` adding `login.options` and `login.optionLabels`; `assertTargetAllowed()` gains status enforcement via `values.targetStatuses` supplied by the caller.

- [ ] **Step 1: Write the failing unit tests**

In `test/server.test.js`, export `publicCommand` from `server.js` and add tests:
- `publicCommand(command('memberSetRole'), { login: 'owner', role: 'SUPER_OWNER' }, roster).fields.find(...) .options` equals the active, non-self logins and excludes removed/suspended/invited/revoked; `optionLabels` include role and status.
- `publicCommand` for `memberReinstate` with a `SUPER_OWNER` session returns only suspended logins.
- `publicCommand` for `memberAdd` with a `SUPER_OWNER` session keeps `login.type === 'text'`, role options are all four roles, and role `default === 'MEMBER'`.
- `publicCommand` for `memberAdd` with a `CODE_OWNER` session has role options `['COLLABORATOR','MEMBER']` and default `MEMBER`.
- `assertTargetAllowed(session, { login: 'gone', action: 'set-role', targetStatuses: ['active'] }, { role: 'MEMBER', status: 'removed' })` matches `/active/i`; `action: 'reinstate'` on an active member matches `/suspended/i`.

- [ ] **Step 2: Write the failing API test file**

Create `test/member-pickers.test.js` following `test/api.test.js` but with `KB_ROOT` pointed at a temp fixture whose `members/members.json` contains: `owner` (SUPER_OWNER active), `peer` (CODE_OWNER active), `working` (COLLABORATOR active), `resting` (MEMBER suspended), `gone` (COLLABORATOR removed), `waiting` (MEMBER invited), `sealed` (MEMBER revoked). Use the same `whoami` stub pattern driven by `TEST_STATE_DIR`.

Add tests:
- `/api/commands` for `owner` shows `working` and `peer` in `memberSetRole`, excludes `gone`/`resting`/`waiting`/`sealed`/`owner`, and `memberReinstate` shows only `resting`.
- A `CODE_OWNER` session shows only `working` in `memberSetRole` and only `resting` in `memberReinstate`.
- `POST /api/commands/memberSetRole` with `login: 'gone'` returns 403 `/active/i`; `POST /api/commands/memberReinstate` with `login: 'working'` returns 403 `/suspended/i`.
- A `CODE_OWNER` POST assigning `CODE_OWNER` or `SUPER_OWNER` returns 403 `/role/i`; a `SUPER_OWNER` POST assigning `SUPER_OWNER` returns 200 with exact stdout `stub:members set-role peer SUPER_OWNER\n`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test test/server.test.js test/member-pickers.test.js`

Expected: the new tests fail because `publicCommand` is not exported and no status options exist yet.

- [ ] **Step 4: Implement the server rule**

In `server.js`:
- Add `roleField()` returning `field('role', 'enum', 'Role', { options: ROLES, required: true, default: 'MEMBER' })` and use it for `memberAdd` and `memberSetRole`.
- Add `targetStatuses` to the five active-member commands (`['active']`) and `memberReinstate` (`['suspended']`).
- Implement `memberOptions(session, members, statuses)` using `visibleMembers(members, session.role)`, `statuses`, and case-insensitive self-exclusion; return `{ options: [...logins], optionLabels: [...'login — ROLE · status'] }`.
- Change `publicCommand(command, session, members)` to use the passed session object, inject the login options for commands with `targetStatuses`, and keep the role-option restriction for `CODE_OWNER` with `default: 'MEMBER'`.
- Update the `/api/commands` handler to pass `session` and the canonical roster from `readJson(path.join(KB_ROOT, 'members/members.json'))?.members || []`.
- In the POST handler, pass `targetStatuses: command.targetStatuses` into `assertTargetAllowed()`.
- In `assertTargetAllowed()`, after the `member` check and before reinstate-specific logic, deny when `values.targetStatuses` is a non-empty array that does not include `member.status`.
- Export `publicCommand`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`

Expected: all tests pass, including the new deterministic picker tests.

### Task 3: Browser selects, copy and live proof

**Files:**
- Modify: `/Users/davidhenry/Desktop/Repositories/ai-knowledge-console/public/app.js:551-593,814-825`
- Modify: `/Users/davidhenry/Desktop/Repositories/ai-knowledge-console/test/ui.test.js:19-44`
- Modify: `/Users/davidhenry/Desktop/Repositories/ai-knowledge-console/README.md:56-63`

**Interfaces:**
- Consumes: `spec.options`, `spec.optionLabels`, `spec.default`, `spec.required` from `/api/commands`.
- Produces: `<select name="login">` for target-member commands; role selects default to `MEMBER`.

- [ ] **Step 1: Write the failing UI tests**

In `test/ui.test.js`:
- Add a test requiring hooks `optionLabels`, `Choose a member…`, and `spec.required` inside `app.js`.
- Extend the command-dialog test to require `commandForm(command)` and the role default hook `default: 'MEMBER'` in the server source via `fs.readFileSync` of `server.js`, so the default is pinned from both sides.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: only the new UI hook tests fail.

- [ ] **Step 3: Implement the renderer**

In `public/app.js`:
- In `commandField()` enum branch, use `spec.optionLabels` for option text when present, add `<option value="">${spec.placeholder || 'Choose…'}</option>` when `spec.placeholder` is present, and keep `spec.default` selection.
- In `commandForm()`, remove the `CODE_OWNER` override that forces `COLLABORATOR` as the role default; role options and default come from the server.
- In `runCommand()`, reject a missing required field with `toast(\`${spec.label} is required\`, 'error')` before POSTing.

- [ ] **Step 4: Update documentation**

In `README.md`:
- State that member-action dialogs use status-scoped selects from the canonical roster: removed/invited/revoked members are hidden, reinstate shows suspended members only, and self is excluded.
- State that role choices default to `MEMBER`; `SUPER_OWNER` may assign any role and `CODE_OWNER` may assign only `COLLABORATOR` or `MEMBER`.
- State that suspend and remove drop GitHub collaborator access and pending invitations in every integrated repository, and reinstate restores role-based access.
- Remove `member removal/revoke` from the non-goals sentence because **Remove member** is now a real operation.

- [ ] **Step 5: Run full checks**

Run: `npm test && npm run check && git diff --check`

Expected: clean in the console repo.

- [ ] **Step 6: Live proof**

Run `make restart`, then use CDP to confirm:
- **Change role**, **Grant scope**, **Ungrant scope**, **Suspend member** and **Remove member** show `<select name="login">` with only active members and no removed member.
- **Reinstate member** shows only suspended members.
- **Add member** and **Change role** role selects default to `MEMBER`; `CODE_OWNER` view shows only `COLLABORATOR`/`MEMBER`.
- Zero browser exceptions and no real mutation submitted.

- [ ] **Step 7: Final status check**

Run `git status --short --branch` in both repositories. Report uncommitted changes; do not commit or push.
