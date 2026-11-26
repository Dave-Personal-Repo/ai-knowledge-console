# Member lifecycle GitHub cleanup and status-scoped pickers — design

## Intent

Owners need two things when managing the AI knowledge hub from the console:

1. Suspending or removing a member must end their GitHub access as completely as `kb` already does for remove/revoke: collaborators must be deleted and pending invitations sent to that GitHub login must be cancelled in every integrated repository, including the console repository.
2. Member commands that target an existing person must offer a selection list of eligible GitHub accounts instead of a free-text login. A removed member must not appear in **Change role** (or any other active-member action).

The authoritative behavior belongs in the hub CLI; the console is a thin operator UI over that CLI.

## Goals

- Make `suspend` drop every integrated repo's collaborator access and pending invitations.
- Make `reinstate` restore the member's full role-based GitHub access in every integrated repo.
- Keep remove/revoke/add/set-role on the same full-lifecycle path already introduced in the hub worktree.
- Replace free-text login inputs for target-member commands with server-generated, status-scoped selects.
- Default every role selection to `MEMBER`, never `SUPER_OWNER`.
- Keep role assignment authority explicit: `SUPER_OWNER` may assign any role; `CODE_OWNER` may assign only `COLLABORATOR` or `MEMBER`.
- Enforce the same status and role rules on the server, not only in the browser.
- Preserve all pre-existing uncommitted work in both repositories.

## Non-goals / anti-goals

- No direct GitHub API calls from the console server.
- No new dependency, new endpoint for member mutation, or arbitrary `kb` runner.
- No change to GitHub repository settings, branch protection, or organization settings.
- No real suspend, remove, reinstate, or role change during verification.
- No commit or push unless the operator asks.

## Constraints and current state

- `~/knowledge/ai-knowledge` has uncommitted work (role-based console access and pending-invitation cancellation) on `main`, two commits behind `origin/main`. It must be built on, not overwritten.
- `scripts/kb` already has `gh_cancel_pending_invites()`, `gh_drop_access()`, `integrated_repos()`, and `gh_sync_access(..., drop=True)`. Those helpers are the right seam.
- The console reads the canonical `members/members.json` through `server.js`; roles and statuses there are authoritative for the session's visible roster.
- `CODE_OWNER` may see `CODE_OWNER` and lower but may act only on `COLLABORATOR`/`MEMBER`. `SUPER_OWNER` may act on all roles. Self-target is always denied.
- Current command target actions are `set-role`, `grant`, `ungrant`, `suspend`, `remove`, `reinstate`. Only `reinstate` has a status rule today.
- Status values in use: `active`, `invited`, `suspended`, `removed`, `revoked`.

## Approaches considered

1. **Fix the hub CLI lifecycle and generate pickers server-side (chosen).** One authoritative implementation of GitHub access; the console asks its own API for eligible logins and the server re-checks every submission. Costs edits in both repositories but avoids duplicated policy and keeps `kb` audit/push behavior intact.
2. **Add GitHub cleanup to the console API.** Rejected: it would duplicate `kb` authorization, auditing, roster push and token handling, and would make the CLI and UI disagree.
3. **Filter pickers only in browser JavaScript.** Rejected: a stale or hand-crafted request could still target a removed member; server-side authorization must own eligibility.

## Decisions

### Hub CLI (`~/knowledge/ai-knowledge`)

- Extend the existing lifecycle call in `cmd_members()` so every non-active transition (`suspend`, `revoke`, `remove`) uses `gh_sync_access(target, role, drop=True)`, and `reinstate` uses `gh_sync_access(target, role)`.
- Remove `sync_console_repo_access()` once its call sites are replaced; `gh_sync_access()` already includes the console repo through `integrated_repos()`.
- Keep `gh_drop_access()` as the single delete path: it removes an accepted collaborator, tolerates a 404 when no collaborator exists, and cancels pending invitations by id.
- Keep `set-role` on `gh_sync_access(..., drop=False)`: roles that still grant access receive a `PUT`, updating a pending invitation in place; roles that lose access receive the full drop.
- Do not weaken `rbac.manage_permission()`: assigning `SUPER_OWNER` requires `super_owners.manage`, and assigning `CODE_OWNER` requires `code_owners.create`; the current `CODE_OWNER` role has neither, so hub-level authorization already matches the console rule.
- Update `tests/test_members_github.py` so suspend and reinstate assert full-repo behavior and pending-invitation cancellation, and update `docs/PERMISSIONS.md` to state the lifecycle.
- Add `--paginate` to the pending-invitation listing so repos with more than one page of invitations are all cleaned up.

### Console (`~/Desktop/Repositories/ai-knowledge-console`)

- Add a `targetStatuses` list to target-action commands:
  - `active`: `memberSetRole`, `memberGrant`, `memberUngrant`, `memberSuspend`, `memberRemove`
  - `suspended`: `memberReinstate`
- `publicCommand()` injects `options` and `optionLabels` for the `login` field from the canonical roster, filtered by the session's visible roles, target status, and self-exclusion. `memberAdd` stays a text field because the person is not in the roster yet.
- `assertTargetAllowed()` checks the member's status against `command.targetStatuses` before running `kb`; this preserves existing role and self gates.
- `commandField()` renders a `select` when `spec.options` and `spec.optionLabels` are present, with a `Choose a member…` placeholder. `commandForm()` no longer emits a hidden login for these commands when a select is present.
- Role selects default to `MEMBER` in both **Add member** and **Change role**. `SUPER_OWNER` remains selectable by a `SUPER_OWNER` session, but is never preselected. For a `CODE_OWNER` session the visible options are `COLLABORATOR`/`MEMBER` and the default is still `MEMBER`.
- Role authority is enforced server-side as well as in the options: a `CODE_OWNER` request with `role: CODE_OWNER` or `role: SUPER_OWNER` is denied even if crafted directly. A `SUPER_OWNER` request may use any of the four roles.
- The member-detail dialog continues to pass `options.login` for its fixed member, so its forms remain unchanged in behavior.
- Update the test suites to pin option filtering, role defaults, role authority, exact argv, confirmation, and server-side status denial.

## Verification

- Hub: `KB_TEST_NO_LICENSE=1 python3 -m unittest tests.test_members_github -v`, then `python3 -m unittest discover -s tests` with the same license flag if supported.
- Console: `npm test`, `npm run check`, `git diff --check`.
- Live CDP: verify every member-action dialog shows a select, active-only lists exclude `martinus-bfi` (removed) and `martinus-bfi`'s stale role, reinstate shows only suspended members, no browser exceptions, and no real mutation is submitted.
- Report both repositories' uncommitted status; do not commit or push.
