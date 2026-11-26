# Host tool detection + git push correctness — short design

## Intent

The operator clarified that “Docker can access my local device” means the containerized console should reflect tools installed on the Mac. Concretely, `kb doctor` inside Docker currently reports `claude`, `opencode`, `codex`, etc. as `installed: false` because it only runs `shutil.which()` against the container PATH. The operator chose **detection only**: no attempt to execute macOS binaries inside the Linux container.

A final review also found that the newly added **Add member** command can write `members.json` but cannot publish it: `kb members add` invokes `git commit`/`git push` directly, while the container has no git identity and no git credential rewrite from the SSH remote to the `GH_TOKEN`-backed HTTPS credential helper. `kb` still exits 0 after printing “members.json NOT pushed”, so the console currently reports a misleading success.

## Goals

- Make `kb doctor` report `installed: true` for agents detected on the host at container start.
- Make the copied agent configuration markers accurate too, so `configured` is not misleading: copy `~/.config/opencode/AGENTS.md` and `~/engineering-ai/policy/ENGINEERING_POLICY.md` alongside the existing Claude/Codex/OpenCode auth copies.
- Give the container a git author identity and a working push path so Add member really pushes to hub `main`.
- Keep the change small, deterministic, and refreshable via `make restart`.

## Non-goals / anti-goals

- No execution of host binaries inside the container. macOS Mach-O executables cannot run in a Linux container.
- No host-side daemon, proxy, or reverse-exec service.
- No installing agent CLIs into the image; that would detect container-local installs, not the operator’s host installs.
- No change to authoritative `kb` role/permission logic.

## Constraints

- `kb doctor` uses `kbplat.which(binary)` → `shutil.which(binary)`, so detection requires an executable file on the container PATH named after each agent binary.
- The console Doctor command runs `kb doctor` without `--live`; no agent binary is executed by it.
- `scripts/agent-auth.sh` already runs on the host during `make up`/`make restart` and writes gitignored `.agent-auth/`.
- The container entrypoint runs as root, then `exec gosu console "$@"`; git config must target `/home/console/.gitconfig`, not root’s home.
- `origin` in the hub clone is SSH, but `gh auth status` in the container already reports token-backed HTTPS git access. `gh auth setup-git` plus an `insteadOf` rewrite is sufficient; no SSH key needs to be mounted.
- Add member is a high-impact mutation; a partial success must not be reported as complete.

## Approaches

1. **Host manifest + safe shims (chosen).** `scripts/agent-auth.sh` detects host binaries with `command -v`, writes executable no-op shims into `.agent-auth/host-tools/`, and captures host git identity into two small files. The entrypoint copies shims to `/home/console/.local/bin` (on PATH) and configures git identity/credentials. Tradeoff: shims are detection-only and fail clearly if executed; live agent runs still require host `npm start` or a separate proxy, which was explicitly rejected.
2. **Mount `/opt/homebrew/bin` into the container.** Rejected: `which` would pass but execution would fail with an incompatible-binary error, making Doctor misleading.
3. **Host execution proxy.** Rejected by the operator; unnecessary for detection-only and adds a new trust boundary.
4. **Install Linux agent CLIs in the image.** Rejected; detects container installs, not host installs.

## Implementation outline

- `test/host-tools.test.js`: run `scripts/agent-auth.sh` against a temporary source home/target with fake `claude`/`opencode` binaries on PATH; assert shims exist for detected tools, are not created for undetected tools, git identity is captured, and optional config markers are copied.
- `test/docker.test.js`: pin that `Dockerfile` puts `/home/console/.local/bin` before the `kb` scripts on PATH.
- `scripts/agent-auth.sh`: generate host-tool shims, copy `~/.config/opencode/AGENTS.md` and `~/engineering-ai/policy/ENGINEERING_POLICY.md`, and capture `git config --file ~/.gitconfig user.name/user.email` with neutral fallbacks.
- `docker-entrypoint.sh`: copy shims into the console user’s `.local/bin`; set git identity from the captured files; run `gh auth setup-git` with `HOME=/home/console` when `GH_TOKEN` is set; add `url."https://github.com/".insteadOf git@github.com:`; chown the written files.
- `Dockerfile`: prepend `/home/console/.local/bin` to PATH.
- `README.md`: document that Doctor reflects host-installed agents via detection-only shims, that live runs still use the host, and that git push uses the token-backed HTTPS credential helper.
- Mark the earlier plan’s completed steps `[x]`.

## Verification

- `npm test`, `npm run check`, `git diff --check`.
- `make restart`.
- As UID 1001 in the container: `git var GIT_AUTHOR_IDENT` succeeds, `git -C /knowledge/ai-knowledge ls-remote origin HEAD` succeeds, and `kb doctor --json` reports `claude` and `opencode` as `installed: true`.
- Live CDP check that the console Doctor card opens and shows the updated output; do not run a real Add member.
- Leave the aggregate change uncommitted unless the operator asks for a push.
