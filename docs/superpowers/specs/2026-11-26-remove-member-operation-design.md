# Remove member operation — short design

## Intent

The operator wants a **Remove member** hub operation alongside the existing **Suspend member** action. It should run the curated `kb members remove <login>` command so the host roster, GitHub access and console-repo access are all updated by the authoritative hub CLI.

## Goals

- Add `memberRemove` to the fixed Hub operations catalog as a changing command.
- Reuse the existing login field, confirmation checkbox, role filtering and self-target denial.
- Show it automatically in the existing member-detail action grid for active members, because that grid already renders every `targetAction` command except `reinstate`.
- Keep **Suspend member** and **Reinstate member** unchanged.

## Non-goals / anti-goals

- No change to `kb`’s removal semantics.
- No arbitrary `kb` runner or new frontend dependency.
- No real member removal during verification.

## Constraints

- `kb members remove` sets status `removed`, pushes `members.json` to hub `main`, drops the person’s GitHub access (including console-repo access), and tells their local `kb` to clean up on its next check. This is high impact and irreversible from the console’s point of view.
- Hub permission check uses `manage_permission("delete", role)`. In the current `config/rbac.json`, `CODE_OWNER` may delete `COLLABORATOR`/`MEMBER`, `SUPER_OWNER` may delete all roles.
- The console already enforces `CODE_OWNER` target-role filtering and self-target denial in `assertTargetAllowed()`; `targetAction: 'remove'` plugs into that path.
- Mutation confirmation is mandatory for all `mutating: true` commands.

## Approach

Add one command entry with `argv: (v) => ['members', 'remove', v.login]`, `targetAction: 'remove'`, `mutating: true`, and `loginField()`. No frontend change is needed: `public/app.js` already renders target-action commands for active members and the generic command dialog handles the form and confirmation.

## Verification

- Failing tests first: exact argv, confirmation requirement, self-target denial, `CODE_OWNER` lower-role-only enforcement, and catalog-id registration.
- `npm test`, `npm run check`, `git diff --check`.
- Live CDP check that **Remove member** opens in the existing dialog with a confirmation checkbox and no browser exceptions. Do not execute a real removal.
- Leave changes uncommitted unless the operator asks for a push.
