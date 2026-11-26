# Permission explanations in the role dialog — short design

## Intent

The **View permissions** popup currently shows raw permission names such as `knowledge.sensitive.read`. The operator wants the popup to explain what those permissions are for without turning it into a long document or adding another page.

## Goals

- Keep one dialog for one role, reusing the existing native `<dialog>` pattern.
- Add a one-line explanation of what a role permission means versus a member scope.
- Group permissions under short headings, each with one plain sentence, while keeping the raw names visible.
- Keep the popup scannable at 74 permissions (`SUPER_OWNER`) and touch/keyboard friendly.

## Non-goals / anti-goals

- No per-permission paragraphs, accordions, search box or second dialog.
- No change to the server-side role filter, command allowlist or permission enforcement.
- No new frontend dependency.
- No change to Docker mounts or mutation behavior.

## Constraints

- `openRoleDialog(role)` in `public/app.js` currently renders a flat sorted list from `state.inventory.roleScopes[role]`.
- Permission names follow `area.action` and live in the hub's `config/rbac.json`; the console only displays them.
- A `CODE_OWNER` inventory excludes `SUPER_OWNER`; the dialog must continue to return early when a role is absent.
- Every interpolated value must continue to use `esc()`.

## Approaches

1. **Grouped summary + compact names (chosen).** A single context line, then 7–8 groups with one-line meanings and wrapped raw names. Best scanability for large roles; no hidden content or extra interaction.
2. **Tooltip per permission.** Least visual weight, but explanations are hidden, unreliable on touch and poor for keyboard users. Rejected.
3. **Group summaries with “show all” expander.** Cleanest default, but adds a click and hides the authoritative names. Rejected.

## Implementation outline

- Add a small `PERMISSION_GROUPS` table in `public/app.js` with `{ prefixes, label, description }` entries for: agent/automation, knowledge/maintenance, repository/sync, contributions, people/ownership, governance/security and personal config. Unknown names fall into an **Other** group.
- In `openRoleDialog(role)`, keep the early return, then bucket the sorted permissions by first matching prefix. Render:
  - the existing role title and count;
  - one muted line: “Role capability = what this role can do. Scopes control which knowledge it can reach.”;
  - each group as a compact block: heading, one-line description, count, then the raw names as wrapped chips.
- In `public/styles.css`, restyle `.permission-list` into grouped blocks with small muted descriptions and compact name chips. No new layout mode.
- In `test/ui.test.js`, pin the group table, the context line and the grouped rendering path. Add a small behavioral test that evaluates the extracted grouping helper against representative permissions and checks every group is assigned.
- Update the **Access & roles** bullet in `README.md` to say permission popups show grouped plain-English explanations.
- Verify with `npm test`, `npm run check`, `git diff --check`, `make restart` and a short CDP check that the dialog still opens for `CODE_OWNER` with grouped descriptions and no `SUPER_OWNER` data.
- Leave the change uncommitted unless the operator asks for a push.

## What is left to the builder

- Follow TDD for the grouping helper and UI hooks, then implement.
- Rebuild the served assets before the live proof.
