# Permission Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show short plain-English explanations for role permissions in the existing View permissions dialog without adding noise or interaction.

**Architecture:** The console remains a vanilla Node/HTTP app with a native `<dialog>`. A small prefix table in `public/app.js` buckets the raw permission names into labelled groups; the dialog renders each group with one line of meaning and compact raw names. Server-side role filtering and permission enforcement are unchanged.

**Tech Stack:** Node.js 22, vanilla browser JS/CSS, `node:test`, native `<dialog>`, headless Chrome/CDP for live proof.

**Spec:** `docs/superpowers/specs/2026-11-26-permission-explanations-design.md`

## Global Constraints

- One dialog only: `role-dialog`. No accordion, search, second dialog or new frontend dependency.
- `openRoleDialog(role)` must keep the early return when `state.inventory.roleScopes[role]` is absent.
- `CODE_OWNER` must never receive or render `SUPER_OWNER` roles or permissions.
- All rendered values continue through `esc()`.
- Mutating behavior, command allowlist and Docker mounts are unchanged.
- Leave changes uncommitted unless the operator asks for a push.

## Review Focus

- A `SUPER_OWNER` role has 74 permissions; none may be dropped or duplicated by grouping. Task 1 pins a round-trip count on representative names and all group labels.
- An unknown permission must not disappear. Task 1 pins the **Other** fallback.
- The dialog must stay compact: raw names remain visible as chips, with one sentence per group. Task 1 pins the absence of `<details>` in the role dialog markup.
- `CODE_OWNER` must still see no `SUPER_OWNER` data. Task 2 checks the live dialog after applying the server-equivalent inventory filter.
- Every rendered name and description must be escaped. Task 1 pins `esc(...)` in the group rendering expressions.

---

### Task 1: Grouped permission explanations

**Files:**
- Modify: `public/app.js` (`PERMISSION_GROUPS`, `groupPermissions`, `openRoleDialog`)
- Modify: `public/styles.css`
- Modify: `test/ui.test.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: `state.inventory.roleScopes[role]`, `esc()`, `bindDialog()`.
- Produces: `PERMISSION_GROUPS`, `groupPermissions(permissions)`, grouped markup in `role-dialog`.

- [x] **Step 1: Write the failing tests**

Add to `test/ui.test.js`:
- assertions that `app.js` contains `PERMISSION_GROUPS`, `groupPermissions`, the exact context line `Role capability = what this role can do. Scopes control which knowledge it can reach.`, `.permission-group`, and `esc(permission)`;
- an assertion that the role dialog rendering does not contain `<details>`;
- a behavioral test that extracts `PERMISSION_GROUPS` and `groupPermissions()` from `app.js`, evaluates them, and asserts:
  - `knowledge.sensitive.read` lands in **Knowledge & maintenance**;
  - `repository.publish` lands in **Repository & sync**;
  - `rbac.permissions.manage` lands in **Governance & security**;
  - `future.custom.permission` lands in **Other**;
  - the flattened result keeps all five input names exactly once.

- [x] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the new assertions fail because the helper and markup do not exist yet.

- [x] **Step 3: Add the grouping table and helper**

In `public/app.js`, add `PERMISSION_GROUPS`, an ordered array of `{ prefixes, label, description }` with these exact labels: **Agent & automation**, **Knowledge & maintenance**, **Repository & sync**, **Contributions**, **People & ownership**, **Governance & security**, **Personal config**, **Other**. Use prefixes matching the permission families already in `config/rbac.json` (`agent.`, `automation.`, `command_registry.`, `system_prompts.`, `knowledge.*.`, `repository.`, `sync.`, `contribution.`, `members.`, `code_owners.`, `collaborators.`, `super_owners.`, `ownership.`, `rbac.`, `security.`, `policies.`, `rules.`, `audit_logs.`, `personal.`). Add `groupPermissions(permissions)` returning only non-empty groups, each with sorted permissions, preserving table order and placing unmatched names in **Other**.

- [x] **Step 4: Render grouped explanations in the role dialog**

In `openRoleDialog(role)`, keep the early return, then render the existing title/count, the exact context line, and one `.permission-group` per bucket: heading, one-line description, count, and permission names as compact chips. Use `esc()` for role labels, group text and permission names. Do not add `<details>`, a search field or another dialog.

- [x] **Step 5: Style compact groups**

In `public/styles.css`, replace the flat `.permission-list` layout with `.permission-group`, `.permission-group-head`, `.permission-group p` and `.permission-chip` rules. Keep muted small text and wrapped chips; no new page-level layout.

- [x] **Step 6: Document the change**

In `README.md`, update the **Access & roles** bullet to say **View permissions** shows grouped plain-English explanations while keeping the raw permission names.

- [x] **Step 7: Run the tests to verify they pass**

Run: `npm test && npm run check && git diff --check`
Expected: all tests pass and JS syntax is clean.

### Task 2: Rebuild and live proof

**Files:**
- Test: live CDP DOM check

**Interfaces:**
- Consumes: rebuilt container from `make restart`.
- Produces: verified grouped role dialog with no higher-role data for `CODE_OWNER`.

- [x] **Step 1: Rebuild the served assets**

Run: `make restart`
Expected: image rebuilt, container healthy and dashboard opened.

- [x] **Step 2: Verify the live dialog**

Using headless Chrome/CDP, open `#/access`, click **View permissions** for `CODE_OWNER`, and assert: the dialog opens; the context line is present; at least five `.permission-group` blocks render; raw names such as `knowledge.general.read` appear; no `<details>` is present. Apply the server-equivalent `CODE_OWNER` inventory filter in the browser and assert no `SUPER_OWNER` text or permission remains.

- [x] **Step 3: Final checks**

Run: `npm test && npm run check && git diff --check`
Expected: clean.

- [x] **Step 4: No commit**

Leave the change uncommitted unless the operator asks for a push.
