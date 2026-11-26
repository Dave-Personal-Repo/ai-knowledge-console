# Host Tool Detection and Git Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the operator chose Native execution).

**Goal:** Make the Dockerized console report host-installed agents accurately and make Add member genuinely push to hub `main`.

**Architecture:** `scripts/agent-auth.sh` runs on the host and writes a gitignored `.agent-auth/` bundle: existing auth copies plus host-tool shims, config markers, and git identity files. The container entrypoint copies those into the disposable console home, adds the shim directory to PATH, and configures git identity/token-backed HTTPS access before dropping to UID 1001. The fixed command catalog and owner gate are unchanged.

**Tech Stack:** bash/sh, Docker Compose, Dockerfile, Node `node:test`, live container/CDP proof.

**Spec:** `docs/superpowers/specs/2026-11-26-host-tool-detection-and-git-push-design.md`

## Global Constraints

- Detection only: shims must not execute host binaries; they must fail with a clear message if invoked.
- No host daemon, proxy, arbitrary `kb` runner, new frontend dependency, or change to the owner gate.
- Container git config must target `/home/console/.gitconfig`, never root’s home.
- `GH_TOKEN` is already present; do not mount SSH keys.
- Only `.agent-auth/` is refreshed by `make restart`; do not commit it.
- Do not execute a real `kb members add`.
- Leave changes uncommitted unless the operator asks for a push.

---

### Task 1: Host bundle generation

**Files:**
- Modify: `scripts/agent-auth.sh`
- Create: `test/host-tools.test.js`

**Interfaces:**
- Consumes: `AGENT_AUTH_SOURCE_HOME`, `AGENT_AUTH_DIR`, host `command -v`, host `~/.gitconfig`.
- Produces: `.agent-auth/host-tools/<binary>` shims, `.agent-auth/opencode-agents.md`, `.agent-auth/engineering-ai/policy/ENGINEERING_POLICY.md`, `.agent-auth/git-identity-name`, `.agent-auth/git-identity-email`.

- [x] **Step 1: Write the failing integration test**

Create `test/host-tools.test.js`. It must:
- create temp source home, target dir and fake bin dir;
- put executable fake `claude` and `opencode` in fake bin, leave `codex` absent;
- write source `.gitconfig` with `name = Test Owner`, `email = owner@example.test`;
- write source `.claude/CLAUDE.md`, `.config/opencode/AGENTS.md` and `engineering-ai/policy/ENGINEERING_POLICY.md` containing `kb retrieve`;
- run `scripts/agent-auth.sh` with `AGENT_AUTH_SOURCE_HOME`, `AGENT_AUTH_DIR` and `PATH` overridden;
- assert `host-tools/claude` and `host-tools/opencode` exist, are executable and contain `/cannot run inside this Linux container/`;
- assert `host-tools/codex` does not exist;
- assert both git identity files have the expected trimmed values;
- assert the two copied config markers contain `kb retrieve`.

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test test/host-tools.test.js`
Expected: FAIL because the script does not produce the new files.

- [x] **Step 3: Implement the host bundle**

In `scripts/agent-auth.sh`:
- after the existing copies, add `copy_file "$source_home/.config/opencode/AGENTS.md" "$target_dir/opencode-agents.md"`;
- create `$target_dir/engineering-ai/policy` and copy `$source_home/engineering-ai/policy/ENGINEERING_POLICY.md` to the same relative path;
- loop over `claude opencode codex gemini copilot junie`, use `command -v "$bin"` and, when found, write an executable POSIX sh shim into `$target_dir/host-tools/$bin` that prints `<bin> is installed on the host, but cannot run inside this Linux container.` to stderr and exits 64;
- read `git config --file "$source_home/.gitconfig" user.name` and `user.email`; if either is empty, fall back to `kb` / `kb@users.noreply.github.com`; write the values to `git-identity-name` and `git-identity-email`;
- print one line per detected host tool and one line for the git identity source.

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all tests pass.

### Task 2: Container wiring and static proof

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-entrypoint.sh`
- Modify: `test/docker.test.js`

**Interfaces:**
- Consumes: `.agent-auth/host-tools`, `git-identity-*`, `opencode-agents.md`, `engineering-ai/policy/ENGINEERING_POLICY.md`, `GH_TOKEN`.
- Produces: `/home/console/.local/bin` on PATH for the console user; working git author identity and HTTPS push path.

- [x] **Step 1: Write the failing tests**

Add to `test/docker.test.js`:
- a test that the `PATH=` line in `Dockerfile` starts with `/home/console/.local/bin:` and still contains `/knowledge/ai-knowledge/scripts:${PATH}`;
- a test that `docker-entrypoint.sh` contains `host-tools`, `git-identity-name`, `git-identity-email`, `HOME=$console_home gh auth setup-git`, and `insteadOf git@github.com:`.

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --test test/docker.test.js`
Expected: FAIL because Dockerfile PATH and entrypoint lack the new wiring.

- [x] **Step 3: Wire the container**

In `Dockerfile`, change the PATH entry to `/home/console/.local/bin:/knowledge/ai-knowledge/scripts:${PATH}`.

In `docker-entrypoint.sh`, after the existing agent auth copies and before the kb state seeding:
- create `$console_home/.local/bin` and copy `$agent_root/host-tools/.` into it;
- copy `$agent_root/opencode-agents.md` to `$console_home/.config/opencode/AGENTS.md`;
- copy `$agent_root/engineering-ai/policy/ENGINEERING_POLICY.md` to `$console_home/engineering-ai/policy/ENGINEERING_POLICY.md`;
- if both git identity files are non-empty, set `user.name` and `user.email` in `$console_home/.gitconfig` using `git config --file`;
- when `GH_TOKEN` is set, run `HOME=$console_home gh auth setup-git` and set `url."https://github.com/".insteadOf git@github.com:` in the same git config file;
- chown all newly written console-home paths to `console:console`.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run check && git diff --check`
Expected: all pass.

### Task 3: Documentation, earlier-plan ledger, and live proof

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-11-26-writable-docker-add-member.md`
- Test: live container and CDP

- [x] **Step 1: Update documentation**

In `README.md`:
- state that Doctor reflects host-installed agents through generated detection-only shims, and that live agent runs still use the host;
- state that OpenCode `AGENTS.md` and `engineering-ai/policy/ENGINEERING_POLICY.md` are copied so `configured` status is accurate;
- state that Add member uses the `GH_TOKEN`-backed HTTPS credential helper and the captured host git identity, so it pushes to hub `main`;
- update the `docker-compose.yml` / `scripts/agent-auth.sh` file-summary lines if needed.

- [x] **Step 2: Mark the earlier plan complete**

Replace every `- [x]` in `docs/superpowers/plans/2026-11-26-writable-docker-add-member.md` with `- [x]`.

- [x] **Step 3: Rebuild and prove**

Run `make restart`. Then, as UID 1001 inside the container:
- `git var GIT_AUTHOR_IDENT` succeeds;
- `git -C /knowledge/ai-knowledge ls-remote origin HEAD` succeeds;
- `kb doctor --json` reports `claude` and `opencode` with `installed: true` and `configured: true`.

Run a live CDP check that the console Doctor card opens and shows the updated health output. Do not execute Add member.

- [x] **Step 4: Final checks**

Run `npm test && npm run check && git diff --check`.
Expected: clean. Leave changes uncommitted unless the operator asks for a push.
