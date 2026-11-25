# AI Knowledge Console

A self-hosted, owner-only reading console for the private AI knowledge hub. It turns the hub's Markdown documents, statuses, evidence and role model into a searchable, readable interface — without copying any knowledge into this repository.

## Run it

Requires Node.js 18+ and a local canonical clone at `~/knowledge/ai-knowledge` (plus `~/knowledge/ai-knowledge-sensitive` for restricted documents).

```bash
npm start
# open http://127.0.0.1:4310
```

Environment overrides: `PORT`, `HOST`, `KB_ROOT`, `KB_SENSITIVE_ROOT`.

## Access model

- Every API request calls `kb whoami` in the canonical clone and accepts only `SUPER_OWNER` or `CODE_OWNER`.
- The session result is cached for 60 seconds. The refresh button forces a fresh check.
- Roles come from the canonical GitHub roster, never from files in this app.
- No document content is stored here. The server reads the two authorised clones directly and returns metadata or the requested Markdown only after the gate passes.
- Path traversal is rejected; only `knowledge/`, `docs/`, `workflows/`, `agents/shared/engineering-ai/policy/` and the three root guides are exposed.

## What is in the UI

- **Overview** — live counts, confidence profile, category mix and the latest verified notes.
- **Knowledge** — search, status/source/category filters, sorting and a reader that renders front matter, evidence and Markdown.
- **Rules & policies** — governance, process and RBAC documents from the hub.
- **Access & roles** — active roster and permission counts from `members/members.json` and `config/rbac.json`.
- **Command palette** — `⌘/Ctrl + K` to jump to any document or page.
- Dark/light themes, keyboard shortcuts (`1`, `2`, `3`), responsive layout and reduced-motion support.

## Non-goals

No editing, no write API, no billing, no public signup, no multi-tenancy and no deployment automation. This is a read-only view over one authorised hub; the knowledge remains owned by its existing pull-request workflow.

## Layout

```
server.js          zero-dependency HTTP server, auth gate, inventory API
public/index.html  application shell
public/styles.css  design system, layout, animation, responsive rules
public/app.js      hash router, views, Markdown renderer, command palette
```
