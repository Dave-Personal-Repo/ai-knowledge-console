# Member Detail Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open member details in a popup with a hub-owned list of grantable scopes, without changing grant/ungrant/suspend access semantics.

**Architecture:** The hub's `config/kb.json` owns `known_scopes`; the console server reads it into `/api/inventory`; the browser renders a native `<dialog>` and uses those values for grant/ungrant dropdowns. Server-side allowlists and confirmation gates remain authoritative.

**Tech Stack:** Node.js 22 HTTP server, vanilla browser JS/CSS, `node:test`, native `<dialog>`.

**Spec:** `docs/superpowers/specs/2026-11-26-member-detail-popup-design.md`

## Global Constraints

- Hub config path is `config/kb.json`; seeded values are `company:ai-knowledge`, `project:bfidigital/ai-knowledge`, `federated:bfidigital`.
- Scope pattern stays `/^(?:(?:company|federated):[A-Za-z0-9._-]+|project:[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)$/`.
- Every mutating command still requires `confirm: true`.
- `CODE_OWNER` visibility and target rules are unchanged.
- No frontend dependency and no new `kb` command.

## Review Focus

- An active `SUPER_OWNER` detail must never be visible or actionable to a `CODE_OWNER` — Task 2 checks the existing `visibleMembers` filter still drives the table and dialog.
- Ungrant must offer the scopes the member actually has, not only curated examples — Task 2 pins the option set to `detail.scopes ∪ knownScopes`.
- “Other…” must preserve free-text entry and server validation — Task 2 includes a custom-value field and Task 1 keeps `SCOPE_RE` validation.
- Suspend must still run with confirmation from inside the dialog — Task 2 includes a confirmation checkbox assertion.
- Closing the dialog by close button, Esc or backdrop must clear the selected member — Task 2 checks `state.detailLogin` is cleared on close.
- Docker serves built assets, so the popup must be verified after rebuild — Task 3 runs `make restart` and a live DOM check.

---

### Task 1: Hub scope list and inventory API

**Files:**
- Modify: `/Users/davidhenry/Desktop/Repositories/ai-knowledge-owner-console-access/config/kb.json`
- Modify: `server.js`
- Test: `test/inventory.test.js`

**Interfaces:**
- Consumes: `buildInventory()` reading `KB_ROOT` at module load.
- Produces: `buildInventory().knownScopes`, an array of strings; `/api/inventory` exposes the same key.

- [ ] **Step 1: Write the failing test**

Create `test/inventory.test.js`. Before requiring `server.js`, set `process.env.KB_ROOT` to a temp fixture containing `members/members.json`, `config/rbac.json`, and `config/kb.json` with `known_scopes: ["company:ai-knowledge", "federated:bfidigital"]`. Assert `buildInventory().knownScopes` equals those two values. Add `buildInventory` to the exports from `server.js` only in the implementation step.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: fails because `buildInventory` is not exported.

- [ ] **Step 3: Add the hub config values**

In the hub worktree `config/kb.json`, add a `known_scopes` array with the three seeded examples from the design. Keep JSON valid.

- [ ] **Step 4: Implement the server change**

In `server.js`, read `config/kb.json` in `buildInventory()`, return `knownScopes` as a string array, and export `buildInventory`. Do not filter by role; scopes are not role-scoped.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: all tests pass, including the new inventory test.

- [ ] **Step 6: No commit**

Leave changes uncommitted unless the operator asks to push.

### Task 2: Native dialog and scope picker

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: `state.inventory.knownScopes` from Task 1, `commandForm(command, options)`, `state.detailLogin`, `state.results`.
- Produces: `<dialog id="member-dialog">`; click handler on `[data-detail]` opens it; `closeMemberDialog()` clears `state.detailLogin`.

- [ ] **Step 1: Write the failing static UI test**

Create `test/ui.test.js` reading `index.html`, `app.js`, and `styles.css`. Assert: `id="member-dialog"` exists; `app.js` contains `showMemberDialog`, `closeMemberDialog`, `knownScopes`, and `detail.scopes`; `styles.css` contains `.member-dialog`. These pin the hooks without a DOM dependency.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: fails on the first missing hook.

- [ ] **Step 3: Add the dialog shell**

In `index.html`, add `<dialog id="member-dialog" class="member-dialog"><button data-action="close-member">×</button><div id="member-dialog-body"></div></dialog>` before the palette. In `styles.css`, style it as a centred, scrollable panel above the page using the existing palette z-index scale.

- [ ] **Step 4: Render details into the dialog**

In `app.js`, replace the inline detail block in `renderAccess()` with the dialog body rendered by `showMemberDialog(login)`. Keep the roster row button as `[data-detail]`. On click, set `state.detailLogin` and call `showMemberDialog`. On close button, `cancel` and backdrop click, call `closeMemberDialog()` and clear `state.detailLogin`.

- [ ] **Step 5: Add scope dropdowns**

Extend `commandForm(command, options)` so `scope` fields accept `options.scopeOptions`. For `memberGrant`, pass `knownScopes` minus scopes already granted when any remain. For `memberUngrant`, pass `detail.scopes ∪ knownScopes`. Add an `Other…` choice that reveals a text input, and teach `formValues` to use that text when chosen. Keep `SCOPE_RE` validation server-side.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npm run check`
Expected: all tests pass and JS syntax is clean.

- [ ] **Step 7: No commit**

Leave changes uncommitted unless the operator asks to push.

### Task 3: Rebuild and live popup proof

**Files:**
- Modify: `README.md`
- Test: live browser DOM check

**Interfaces:**
- Consumes: rebuilt container from `make restart`.
- Produces: verified popup, dropdown options and confirmation controls.

- [x] **Step 1: Document the popup and scope source**

In `README.md`, change the Access & roles bullet to say details open in a popup and the scope dropdown comes from the hub's `known_scopes`. Mention the `Other…` fallback.

- [x] **Step 2: Rebuild the served assets**

Run: `make restart`
Expected: image rebuilt, container healthy, dashboard opened.

- [x] **Step 3: Verify the live DOM**

Using the existing CDP/headless browser method, open `#/access`, click `dave-bfi`'s Details, and assert: dialog is open; scope dropdown exists with `company:ai-knowledge`; grant/ungrant confirm boxes exist; close returns `detailLogin` to null. Then close and confirm no inline detail panel remains.

- [x] **Step 4: Final checks**

Run: `npm test && npm run check && git diff --check`
Expected: clean.

- [x] **Step 5: No commit**

Leave changes uncommitted unless the operator asks to push.
