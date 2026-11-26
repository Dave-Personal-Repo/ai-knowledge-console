# Remove Member Operation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Add a curated **Remove member** hub operation alongside Suspend, running `kb members remove <login>` with the existing confirmation and role gates.

**Architecture:** The console already has a fixed command catalog, a generic command dialog, and `targetAction` authorization against `members/members.json`. A single new command entry wires `memberRemove` into those existing paths; no frontend change is needed.

**Tech Stack:** Node.js `node:test`, vanilla browser JS, live CDP proof.

**Spec:** `docs/superpowers/specs/2026-11-26-remove-member-operation-design.md`

## Global Constraints

- Keep Suspend and Reinstate unchanged.
- `mutating: true` so confirmation remains mandatory.
- `targetAction: 'remove'` so `assertTargetAllowed()` handles self-target and `CODE_OWNER` lower-role-only rules.
- No arbitrary `kb` runner; `spawnSync(..., shell: false)` and fixed argv unchanged.
- Do not execute a real member removal during verification.
- Leave changes uncommitted unless the operator asks for a push.

---

### Task 1: Command catalog and API tests

**Files:**
- Modify: `server.js`
- Modify: `test/api.test.js`
- Modify: `test/server.test.js`

**Interfaces:**
- Produces: `memberRemove` with `fields: [loginField()]`, `argv: (v) => ['members', 'remove', v.login]`, `targetAction: 'remove'`, `mutating: true`.

- [x] **Step 1: Write failing tests**

Add to `test/api.test.js`:
- SUPER_OWNER POST `memberRemove` for existing collaborator `erricbfi` with `confirm: true` → 200 and stdout contains `stub:members remove erricbfi`;
- missing `confirm` → 400 `/Confirm is required/`;
- flag-like login `--evil` → 400 `/Invalid GitHub login/`;
- self-target → 403 `/your own account/`;
- CODE_OWNER POST for `dave-bfi` and `ayumargareth` → 403 `/role/i`;
- CODE_OWNER POST for `erricbfi` → 200 with the same stub stdout.

Add `memberRemove` to the expected command-id list in `test/server.test.js`.

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test test/api.test.js test/server.test.js`
Expected: new tests fail because `memberRemove` is unknown.

- [x] **Step 3: Add the command**

In `server.js`, add after `memberSuspend`:
```js
{
  id: 'memberRemove',
  label: 'Remove member',
  group: 'change',
  mutating: true,
  targetAction: 'remove',
  description: 'Remove a member and revoke their access.',
  fields: [loginField()],
  argv: (v) => ['members', 'remove', v.login],
},
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

### Task 2: Docs and live proof

**Files:**
- Modify: `README.md`
- Test: live CDP DOM check

- [x] **Step 1: Update documentation**

In `README.md`, add **Remove member** to the `change` command list and state that it revokes GitHub/console access, pushes the roster, and is high impact. Keep Suspend and Reinstate listed.

- [x] **Step 2: Run full checks**

Run: `npm test && npm run check && git diff --check`
Expected: clean.

- [x] **Step 3: Rebuild and prove**

Run `make restart`, then use CDP to confirm:
- the **Remove member** card opens in the existing command dialog;
- the login field and confirmation checkbox are present;
- zero browser exceptions.

Do not submit a real Remove command.

- [x] **Step 4: Final checks**

Run `npm test && npm run check && git diff --check`.
Leave changes uncommitted unless the operator asks for a push.
