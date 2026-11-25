# Member detail popup and scope picker — short design

## Intent

The operator wants member details to open as a popped-up window, not as an inline block under the roster. They also want to see which scopes can be granted instead of memorising `company:`/`project:`/`federated:` values. Grant/ungrant/suspend must keep doing the right thing in the AI knowledge hub.

## Goals

- Clicking **Details** opens a modal dialog with the member's role, status, role scopes, extra scopes and allowed actions.
- Grant/ungrant forms use a dropdown of curated scopes; suspend stays in the same popup with the existing confirmation gate.
- The curated list is owned by the hub, not hardcoded in the console UI.
- Preserve current role visibility and server-side command validation.

## Non-goals / anti-goals

- No new `kb` commands, no arbitrary scope creation inside the console.
- No automatic push for grant/ungrant; changing GitHub collaborator access remains a separate revoke/remove action.
- No change to suspend's access semantics: it still pushes `members.json` and drops console-repo access for owners, but does not drop hub/sensitive GitHub collaborator access.
- No new frontend dependency.

## Constraints

- The console already reads `members/members.json` and `config/rbac.json` from `KB_ROOT`; it can read `config/kb.json` the same way.
- `rbac.json` contains permission names, not grantable scopes. Current roster has no extra scopes, so the hub needs an explicit list.
- Command execution remains the fixed allowlist with `spawnSync(..., shell: false)` and `confirm: true` for mutations.

## Approaches

1. **Native `<dialog>` + hub-configured scope list (chosen).** Browser handles focus, Esc and stacking; the console reads `known_scopes` from hub config and renders it as a select. A free-text “Other…” option keeps unusual scopes possible.
2. **In-page overlay drawer.** Fewer browser API concerns, but not a real popup and weaker focus/keyboard behaviour. Rejected: the operator explicitly asked for a popped-up window.
3. **Modal with format examples only.** Smallest change, but leaves the operator guessing values. Rejected: does not solve the stated problem.

## Implementation outline

- Hub: add `known_scopes` to `config/kb.json`, seeded with editable examples: `company:ai-knowledge`, `project:bfidigital/ai-knowledge`, `federated:bfidigital`.
- Console server: include `knownScopes` in `/api/inventory` from `config/kb.json`.
- Console UI: render the member detail into a `<dialog>`; override grant/ungrant `scope` fields with dropdowns sourced from `knownScopes`, and for ungrant prioritise scopes currently granted to the member. Keep “Other…” as a text input.
- Keep the existing close-on-Esc/backdrop behaviour and clear the selected member on close.
- Tests: server inventory exposes `knownScopes`; UI proof shows the dialog, dropdown options, confirmation boxes and a successful read command after rebuild.

## What is left to the builder

- Follow TDD for server and UI-facing helpers, then implement.
- Rebuild the Docker image so the served assets include the popup.
- Leave any new commits to the operator's explicit push instruction.
