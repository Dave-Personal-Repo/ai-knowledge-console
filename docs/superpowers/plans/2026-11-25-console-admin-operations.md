# Knowledge Console: member administration and hub operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the console automatically, show role-aware member detail and scopes, allow owner-gated member and hub operations through fixed `kb` commands, and expose the informative/maintenance commands in a new UI page.

**Architecture:** Extend the single zero-dependency Node server with pure, testable helpers for role visibility, command validation/argv building, output redaction and `spawnSync` execution; add two JSON routes (`GET /api/commands`, `POST /api/commands/:id`) plus an extended inventory; generate UI forms from the server catalog. No new dependencies and no browser-side command definitions.

**Tech Stack:** Node 18+ (running 24.15.0), built-in `node:test`, plain HTML/CSS/JS, `kb` CLI.

**Spec:** `docs/superpowers/specs/2026-11-25-console-admin-operations-design.md`

## Global Constraints

- Node 18+, zero runtime dependencies, no lockfile, no generated files.
- Keep `kb whoami` gate: all `/api/*` except `/api/session` require SUPER_OWNER or CODE_OWNER.
- Commands run via `spawnSync(KB_BIN, argv, { cwd: KB_ROOT, shell: false })`; `KB_BIN` defaults to `'kb'` and exists as a test seam.
- Role order: `SUPER_OWNER > CODE_OWNER > COLLABORATOR > MEMBER`.
- Field values never become shell text; validate every value before use.
- Output cap 64 KiB; redact token-like patterns.
- Preserve the user's existing uncommitted edits to `.gitignore`, `Dockerfile`, `README.md`, `docker-compose.yml`, `docker-entrypoint.sh`.
- Docker hub mounts stay read-only; changing commands may fail there by design.

## Review Focus

- A CODE_OWNER session receiving SUPER_OWNER member rows or SUPER_OWNER scope lists — `test/server.test.js` asserts `filterInventoryForRole` drops both.
- A crafted field value beginning with `--` becoming a new flag — tests assert `buildArgv` rejects it and command catalog uses argv arrays.
- `promote` accidentally applying without explicit reviewer/evidence — tests assert dry-run argv and `--apply` argv, and that applying requires both fields.
- Secret-like text in command output reaching the browser — `redactOutput` tests assert masking.
- A member action against the signed-in account or a role above the session — tests assert `assertTargetAllowed` rejects both.

---

### Task 1: Testable server core and role-aware inventory

**Files:**
- Modify: `server.js`
- Modify: `package.json`
- Test: `test/server.test.js`

**Interfaces:**
- Consumes: existing `buildInventory()` shape.
- Produces: exported `ROLE_RANK`, `visibleRoles(role)`, `visibleMembers(members, role)`, `filterInventoryForRole(inventory, role)`, `runKb(argv)`, `redactOutput(text)`, `COMMANDS`, `validateValues(command, values)`, `buildArgv(command, values)`, `assertTargetAllowed(session, values, member)`, `browserCommand(platform)`, `shouldOpenBrowser(env, isDocker)`; `require.main === module` guard so tests can import without listening.

- [ ] **Step 1: Write failing tests for role visibility and inventory shape**

In `test/server.test.js`, import the exports above and assert:
- `visibleRoles('SUPER_OWNER')` equals all four roles in rank order; `visibleRoles('CODE_OWNER')` equals `['CODE_OWNER','COLLABORATOR','MEMBER']`.
- `visibleMembers([{login:'a',role:'SUPER_OWNER'},{login:'b',role:'CODE_OWNER'},{login:'c',role:'MEMBER'}], 'CODE_OWNER')` returns only `b` and `c`.
- `filterInventoryForRole({members:[...], roleScopes:{SUPER_OWNER:['a'],CODE_OWNER:['b'],MEMBER:['c']}}, 'CODE_OWNER')` keeps only `CODE_OWNER` and `MEMBER` scope keys.
- `runKb` with an injected stub runner returns `{ command, ok: true, exitCode: 0, stdout, stderr, durationMs }` for `['status']`, and `ok: false` for exit code 2.
- `redactOutput('token ghp_abcdefghijklmnopqrstuvwxyz Bearer abcdefghijklmnopqrstuvwxyz')` contains no `ghp_` and no `Bearer abc`.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../server.js'` or exported functions undefined.

- [ ] **Step 3: Implement the helpers and module guard**

In `server.js`: add the constants and exported pure helpers; add `module.exports = { ... }`; wrap the final `server.listen(...)` in `if (require.main === module) { ... }`. Keep `getSession`, `buildInventory` and static serving unchanged. Make `runKb(argv, runner = spawnSync)` call `KB_BIN`, cap output, redact, and return the result shape. Add `"test": "node --test test/*.test.js"` to `package.json`.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test && npm run check`
Expected: both pass, no warnings.

- [ ] **Step 5: Commit**

```bash
git add server.js package.json test/server.test.js
git commit -m "test: add role visibility and command execution tests"
```

### Task 2: Command catalog, validation and argv builders

**Files:**
- Modify: `server.js`
- Test: `test/server.test.js`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `COMMANDS` entries with `{ id, label, group, description, mutating, fields }`; `validateValues(command, values)` returns `null` or an error string; `buildArgv(command, values)` returns an argv array; `assertTargetAllowed(session, values, member)` returns `null` or an error string.

- [ ] **Step 1: Write failing tests for catalog behavior**

In `test/server.test.js`, assert:
- `COMMANDS` contains ids `status`, `doctor`, `report`, `publishVerify`, `publish`, `sync`, `triage`, `validate`, `capabilities`, `membersList`, `rolesList`, `featuresList`, `audit`, `logs`, `cleanupStatus`, `cleanupReport`, `cleanupIntent`, `cleanupRun`, `promote`, `memberSetRole`, `memberGrant`, `memberUngrant`, `memberSuspend`, `memberReinstate`.
- `buildArgv(report, { days:'7', compare:'' })` equals `['report','--days','7']`; with `compare:'2026-11-01'` equals `['report','--compare','2026-11-01']`.
- `buildArgv(promote, { target:'note', value:'Decisions/x', reviewer:'', evidence:'', apply:false })` has no `--apply`; with `apply:true`, reviewer `'Dave'` and evidence `'checked the code and tests'` includes `--apply`, `--reviewer`, `Dave` and the evidence in that order.
- `buildArgv(memberSetRole, { login:'alice', role:'COLLABORATOR' })` equals `['members','set-role','alice','COLLABORATOR']`.
- `validateValues(report, { compare:'2026-13-01' })` is an error; `validateValues(memberGrant, { login:'--apply', scope:'company:x' })` is an error; `validateValues(promote, { apply:true, reviewer:'', evidence:'short' })` is an error.
- `assertTargetAllowed({ login:'dave', role:'CODE_OWNER' }, { login:'dave' }, { role:'SUPER_OWNER' })` is an error; same session with `{ login:'bob' }` and member `{ role:'CODE_OWNER' }` is also an error; with member `{ role:'COLLABORATOR', status:'active' }` it is `null`; with `{ role:'MEMBER', status:'revoked' }` and action `reinstate` it is an error. For a SUPER_OWNER session, a CODE_OWNER target is `null`.
- `validateValues(sync, {})` with `confirm !== true` is an error (mutation confirmation is server-side for every mutating command).

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL — missing `COMMANDS` / functions.

- [ ] **Step 3: Implement the catalog and validation**

In `server.js`, define `COMMANDS` with field schemas (`enum`, `text`, `number`, `date`, `boolean`), a fixed argv builder per command, shared validators (login `^[A-Za-z0-9-]{1,39}$`, scope `^(company|federated):[A-Za-z0-9._-]+$|^project:[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`, date `YYYY-MM-DD`, text length/control-character checks), and `assertTargetAllowed` using `ROLE_RANK`, the session login and the member status. CODE_OWNER may act only on COLLABORATOR/MEMBER targets and only assign COLLABORATOR/MEMBER; `reinstate` is allowed only for `suspended` members. Reject any value starting with `-`. Require `confirm === true` for every catalog entry with `mutating: true`. `cleanupRun` and `promote` add `--apply` only when `values.apply === true`; `cleanupIntent` accepts a 3–200 character free-text intent as one argv element; no other free-form command input.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test && npm run check`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server.js test/server.test.js
git commit -m "feat: add validated kb command catalog"
```

### Task 3: HTTP routes and browser auto-open

**Files:**
- Modify: `server.js`
- Test: `test/server.test.js`

**Interfaces:**
- Consumes: Task 2 catalog and Task 1 `runKb`, `filterInventoryForRole`.
- Produces: `GET /api/commands` and `POST /api/commands/:id`; `browserCommand(platform)` and `shouldOpenBrowser(env, isDocker)`; `openBrowser(url)`.

- [ ] **Step 1: Write failing tests for route helpers and browser policy**

In `test/server.test.js`, assert:
- `browserCommand('darwin')` calls `open`; `browserCommand('linux')` calls `xdg-open`; `browserCommand('win32')` calls `cmd` with `/c start`.
- `shouldOpenBrowser({}, false)` is `true`; with `{ OPEN_BROWSER:'0' }` or `{ CI:'true' }` or `isDocker:true` is `false`.
- A POST to `/api/commands/report` with a missing `X-KConsole` header returns 400; with a valid header and `{ values:{ days:'7' } }` returns `{ id:'report', ok, exitCode, stdout, stderr, durationMs }` (use `KB_BIN` stub script or stub `runKb` if needed).
- A POST to `/api/commands/memberSetRole` with a CODE_OWNER session and a SUPER_OWNER target returns 403.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement the routes and opener**

In `server.js`: extend `buildInventory` with all members (including `status` and `scopes`) and `roleScopes` from `config/rbac.json`; apply `filterInventoryForRole` in the `/api/inventory` handler; add `/api/commands` returning the catalog; add `/api/commands/:id` that checks JSON content type and `X-KConsole: 1`, validates body size (16 KiB), reuses the existing session gate, checks command role and target, calls `runKb`, and returns the result shape with proper 400/403/404/500 errors. Add `openBrowser` in the listen callback, guarded by `shouldOpenBrowser(process.env, fs.existsSync('/.dockerenv'))` and swallowing spawn errors.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test && npm run check`
Expected: all pass; no browser is opened during tests because the server is not listening on import.

- [ ] **Step 5: Commit**

```bash
git add server.js test/server.test.js
git commit -m "feat: add command API and startup browser launch"
```

### Task 4: UI — member detail and Hub operations

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Verify with browser automation (no committed UI test framework exists).

**Interfaces:**
- Consumes: `/api/inventory` extended fields and `/api/commands` catalog.
- Produces: route `#/operations`, `renderAccess()` upgrade, command forms and result panel.

- [ ] **Step 1: Write the failing browser assertions**

Create a local check script (not committed) that starts the server with a stub `KB_BIN`, opens the app, and asserts: nav contains "Hub operations"; Access & roles shows a scope-count column and a detail button; opening a detail shows the role's scope list; the operations page shows command groups and a run button; a mutating command shows a confirmation control. Run it before implementation and record the failure.

- [ ] **Step 2: Implement the UI**

In `public/index.html`, add a nav item `href="#/operations" data-route="operations"` under Workspace.
In `public/app.js`: add `state.commands`, load `/api/commands` alongside the inventory; upgrade `renderAccess()` to use all returned members, show status/scope count/joined, and render a detail panel with the full scope list plus action buttons; add `renderOperations()` that renders read/change groups from the catalog, generates fields from `command.fields`, posts `{ values, confirm }` with the `X-KConsole` header, and renders results as `<pre>` blocks with command, exit code and duration; add route handling, nav marking and palette entry for `operations`; show a confirmation checkbox for `mutating` commands and require explicit Apply for `promote`. Escape all interpolated values.
In `public/styles.css`, add styles for detail panels, command cards, field rows, confirmation blocks and result panels, reusing existing tokens and responsive rules.

- [ ] **Step 3: Verify in a real browser**

Run the script from Step 1 again, plus browser checks of `publishVerify`, `report --compare` and `status` results, empty/error states, mobile width, and confirmation gating. Record command output and screenshots.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/app.js public/styles.css
git commit -m "feat: add member detail and hub operations UI"
```

### Task 5: Documentation and final verification

**Files:**
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: Update documentation without overwriting the user's edits**

Use targeted edits to `README.md`: replace the read-only non-goal with the new operator capabilities; document auto-open and `OPEN_BROWSER=0`; document role visibility and the writable-clone requirement for changing commands; add the new nav page to "What is in the UI".

- [ ] **Step 2: Run full verification**

Run: `npm test && npm run check && make check`
Expected: tests pass, syntax checks pass, docker compose config validates. Record exact output. Re-read the diff against the spec as a checklist; report any unmet requirement.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe console administration and hub operations"
```
