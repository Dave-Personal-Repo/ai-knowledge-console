# Console Navigation, Dialogs and Role Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open each Hub operation in a popup, keep the document list beside the reader with the correct menu highlighted, and expose each visible role's permissions without leaking higher roles.

**Architecture:** The console stays a vanilla Node/HTTP app with server-side role filtering as the authority. Browser state gains a cached open document; native `<dialog>` elements host member, command and role views; a shared dialog binder handles close, cancel, backdrop, submit and keyboard guards.

**Tech Stack:** Node.js 22 HTTP server, vanilla browser JS/CSS, `node:test`, native `<dialog>`, headless Chrome/CDP for live proof.

**Spec:** `docs/superpowers/specs/2026-11-26-console-navigation-dialogs-design.md`

## Global Constraints

- Routes: `#/library`, `#/policies`, `#/doc/<source:path>`. A document's section is `policies` when `item.kind === 'policy'`, otherwise `library`.
- `server.js` `filterInventoryForRole()` must remain the sole authority for role visibility: `CODE_OWNER` receives only `CODE_OWNER`, `COLLABORATOR` and `MEMBER` in `roleScopes`, `permissionCounts` and `members`.
- Fixed command allowlist, validated argv and `confirm: true` for every mutating command are unchanged.
- No frontend dependency, no new `kb` command, no Docker mount changes.
- Mutating commands still require `npm start` against a writable clone; Docker remains read-only.
- Reused dialog ids: `member-dialog`, `command-dialog`, `role-dialog`.

## Review Focus

- A just-granted/ungranted/suspended member must show updated scopes and actions immediately — Task 1 pins the post-mutation inventory refresh and dialog rebuild.
- Results from member A must not appear when member B is opened — Task 1 clears target-action results on selection change and close.
- `Cmd/Ctrl+K` or number shortcuts must not open the palette or navigate behind any open dialog — Task 1 and Task 3 pin the `anyDialogOpen()` guard.
- A document opened from Rules & policies must highlight Rules & policies, including from a direct link — Task 2 pins `docSection()` and `markNav()`.
- A `CODE_OWNER` session must never receive or render `SUPER_OWNER` role cards, permissions or member data — Task 3 pins the server filter assertion and the role dialog source.

---

### Task 1: Close the member-dialog review findings

**Files:**
- Modify: `public/app.js` (`showMemberDialog`, `closeMemberDialog`, `runCommand`, keydown handler)
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: `state.detailLogin`, `state.results`, `showMemberDialog(login)`, `runCommand(form)`.
- Produces: `refreshMemberAfterCommand(login)`, `clearTargetResults()`, `anyDialogOpen()` used by Tasks 2 and 3.

- [ ] **Step 1: Write the failing test**

Add to `test/ui.test.js` an assertion that `public/app.js` contains `refreshMemberAfterCommand`, `clearTargetResults`, `anyDialogOpen`, and `state.inventory = await api('/api/inventory')`. These hooks pin the refresh, result isolation, keyboard guard and fresh inventory source.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: fails on the first missing hook.

- [ ] **Step 3: Rebuild the member dialog after a successful mutation**

In `runCommand()`, after `post()` resolves with `result.ok`, if the form is inside `#member-dialog`, call `refreshMemberAfterCommand(values.login)`: fetch `/api/inventory`, assign `state.inventory`, then call `showMemberDialog(login)` without clearing `state.results`. In `showMemberDialog()`, if the member is no longer present, call `closeMemberDialog()` and toast that the member is unavailable.

- [ ] **Step 4: Isolate results and guard keyboard shortcuts**

Add `clearTargetResults()` that deletes `state.results` entries for commands with `targetAction`; call it from `showMemberDialog()` when `state.detailLogin !== login` and from `closeMemberDialog()`. Add `anyDialogOpen()` covering `member-dialog`, `command-dialog` and `role-dialog`; return early from the global keydown handler when true (native `cancel` still closes the dialog on Esc).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run check`
Expected: all tests pass and JS syntax is clean.

- [ ] **Step 6: Record the previous plan's live proof**

Tick the Task 3 checkboxes in `docs/superpowers/plans/2026-11-26-member-detail-popup.md` and note in `.superpowers/sdd/2026-11-26-member-detail-popup/progress.md` that the CDP proof ran after `make restart`. No code change.

### Task 2: Command dialog for Hub operations

**Files:**
- Modify: `public/index.html`, `public/app.js`, `public/styles.css`
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: `anyDialogOpen()`, `commandForm(command)`, `runCommand(form)`, `state.commands`.
- Produces: `<dialog id="command-dialog">`, `openCommandDialog(commandId)`, `[data-open-command]` cards.

- [ ] **Step 1: Write the failing test**

Add to `test/ui.test.js` assertions that `index.html` contains `id="command-dialog"` and `data-open-command` is absent from HTML but present in `app.js`, and that `styles.css` contains `.command-dialog`. Also assert `app.js` contains `openCommandDialog`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: fails on the first missing hook.

- [ ] **Step 3: Add the dialog shell and open action**

In `index.html`, add `<dialog id="command-dialog" class="command-dialog"><button data-action="close-command">×</button><div id="command-dialog-body"></div></dialog>`. In `app.js`, add `openCommandDialog(commandId)` that looks up the command, renders `commandForm(command)` into the body and calls `showModal()`. Add `bindDialog(dialog, closeFn)` wiring click on close/backdrop and `cancel`; bind the command dialog and reuse it for the member dialog.

- [ ] **Step 4: Replace inline command cards with open buttons**

In `renderOperations()`, render each command as a compact card with its label, description, read/change badge and `<button data-open-command="<id>">Open</button>`; remove inline `commandForm()` calls. Handle `[data-open-command]` in the `view` click handler. Add a `submit` listener on the command dialog that calls `runCommand(form)`.

- [ ] **Step 5: Refresh inventory after any successful mutating command**

Extend `runCommand()` so a successful mutating command fetches `/api/inventory`, assigns `state.inventory` and calls `render()` before updating its result panel. Keep the member-dialog rebuild from Task 1.

- [ ] **Step 6: Style the dialog**

In `styles.css`, style `.command-dialog` like `.member-dialog` and ensure `.command-dialog .command-grid { grid-template-columns: 1fr; }`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test && npm run check`
Expected: all tests pass and JS syntax is clean.

### Task 3: Split reader and correct active menu

**Files:**
- Modify: `public/app.js`, `public/styles.css`
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: `filteredItems(forceKind)`, `docCard(item)`, `renderMarkdown(source)`, `anyDialogOpen()`.
- Produces: `state.openDoc`, `docSection(id)`, `markNav(name, id)`, `renderLibrary(forceKind, compact)`.

- [ ] **Step 1: Write the failing test**

Add to `test/ui.test.js` assertions that `app.js` contains `state.openDoc`, `function docSection`, `function markNav(name, id)`, `split-view`, and `compact` in the `renderLibrary` signature. Add a static assertion that `markNav()` no longer hardcodes `name === 'doc' && item.dataset.route === 'library'`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: fails on the first missing hook.

- [ ] **Step 3: Derive the document section and fix active nav**

Add `docSection(id)` returning `'policies'` when the matching inventory item has `kind === 'policy'`, else `'library'`. Change `markNav(name, id)` so `doc` routes are mapped through `docSection(id)`; pass `route.id` from `render()`. Change the `go-library` action to navigate to `docSection(state.openDoc?.id)`.

- [ ] **Step 4: Render the split view with a cached reader**

Change `renderLibrary(forceKind, compact = false)` so `compact = true` omits the page header and returns toolbar, result count and the card grid only. Change `renderDoc(id)` to: use `state.openDoc` when its `id` matches, otherwise fetch `/api/document`, call `renderMarkdown()`, and cache `{ id, html }`; then render `<div class="split-view"><section class="split-list">${renderLibrary(sectionKind, true)}</section><section class="split-reader">${cachedHtml}</section></div>`. Preserve and restore `.split-list` scrollTop across re-renders.

- [ ] **Step 5: Style stacked-on-narrow split panes**

In `styles.css`, add `.split-view` as a two-column grid with independently scrolling panes, `.split-list .doc-grid` as one column, `.split-reader .reader-layout` as one column, and a media query that stacks the panes below 1000px.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npm run check`
Expected: all tests pass and JS syntax is clean.

### Task 4: Role permission dialog with role-filtered data

**Files:**
- Modify: `public/index.html`, `public/app.js`, `public/styles.css`, `test/ui.test.js`, `test/server.test.js`
- Test: `test/ui.test.js`, `test/server.test.js`

**Interfaces:**
- Consumes: `state.inventory.roleScopes`, `bindDialog()`, `anyDialogOpen()`.
- Produces: `<dialog id="role-dialog">`, `openRoleDialog(role)`, `[data-role-perms]` buttons.

- [x] **Step 1: Write the failing tests**

In `test/server.test.js`, extend the existing CODE_OWNER inventory test to assert `Object.keys(filtered.roleScopes)` and `Object.keys(filtered.permissionCounts)` exclude `SUPER_OWNER`. In `test/ui.test.js`, assert `index.html` contains `id="role-dialog"`, `app.js` contains `openRoleDialog` and `data-role-perms`, and `styles.css` contains `.role-dialog`.

- [x] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: fails on the new assertions.

- [x] **Step 3: Add the role dialog**

In `index.html`, add `<dialog id="role-dialog" class="role-dialog"><button data-action="close-role">×</button><div id="role-dialog-body"></div></dialog>`. In `app.js`, add `openRoleDialog(role)` that returns early when `state.inventory.roleScopes[role]` is absent, renders the role name and its sorted permissions into the body, and calls `showModal()`. Bind it with `bindDialog()`. Handle `[data-role-perms]` in the `view` click handler.

- [x] **Step 4: Add buttons to role cards and style the dialog**

In `renderAccess()`, add `<button class="ghost-button" data-role-perms="<role>">View permissions</button>` to each role card. In `styles.css`, style `.role-dialog` like `.member-dialog` with a compact permission list.

- [x] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run check`
Expected: all tests pass and JS syntax is clean.

### Task 5: Rebuild, live proof and documentation

**Files:**
- Modify: `README.md`
- Test: live CDP DOM check

**Interfaces:**
- Consumes: rebuilt container from `make restart`.
- Produces: verified command popup, split reader, nav highlight and role dialog.

- [x] **Step 1: Document the new UI**

In `README.md`, update the **Hub operations**, **Knowledge/Rules & policies** and **Access & roles** bullets to mention command popups, the split reader with retained section highlight, and role permission dialogs with `SUPER_OWNER` hidden for `CODE_OWNER`.

- [x] **Step 2: Rebuild the served assets**

Run: `make restart`
Expected: image rebuilt, container healthy, dashboard opened.

- [x] **Step 3: Verify the live DOM**

Using headless Chrome/CDP, assert: clicking a Hub operation card opens `#command-dialog` with a form and `kb status` exits 0; clicking a policy from `#/policies` renders `.split-view`, keeps `.doc-grid` in the left pane and highlights the Rules & policies nav item; a direct `#/doc/<policy-id>` link highlights Rules & policies; clicking **View permissions** opens `#role-dialog` with permission names; with `state.session.role` temporarily set to `CODE_OWNER` and `render()` called, no `SUPER_OWNER` role card or permission option exists.

- [x] **Step 4: Final checks**

Run: `npm test && npm run check && git diff --check`
Expected: clean.

- [x] **Step 5: No commit**

Leave console changes uncommitted unless the operator asks to push.
