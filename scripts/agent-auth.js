#!/usr/bin/env node
'use strict';

// Copy this machine's agent logins and provider config into .agent-auth/ so Docker can use them.
// Node standard library only: no POSIX shell, GNU install or cp is needed on Windows.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceHome = process.env.AGENT_AUTH_SOURCE_HOME || os.homedir();
const targetDir = path.resolve(root, process.env.AGENT_AUTH_DIR || '.agent-auth');
const tools = ['claude', 'opencode', 'codex', 'gemini', 'copilot', 'junie'];

function bestEffortChmod(file, mode) {
  try { fs.chmodSync(file, mode); } catch { /* Windows may not expose POSIX modes */ }
}

function copyFile(source, dest) {
  if (fs.existsSync(source) && fs.statSync(source).isFile()) {
    fs.copyFileSync(source, dest);
    bestEffortChmod(dest, 0o644);
    console.log(`Copied ${source} -> ${dest}`);
  } else {
    fs.writeFileSync(dest, '');
    bestEffortChmod(dest, 0o644);
    console.log(`Missing ${source}; created empty ${dest}`);
  }
}

function copyDir(source, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
    fs.cpSync(source, dest, { recursive: true, force: true });
    console.log(`Copied ${source} -> ${dest}`);
  } else {
    console.log(`Missing ${source}; created empty ${dest}`);
  }
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { bestEffortChmod(file, 0o755); walk(file); }
      else bestEffortChmod(file, 0o644);
    }
  };
  walk(dest);
}

function candidateNames(binary) {
  const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(/[;:]/).filter(Boolean);
  return [...new Set([binary, ...exts.flatMap((ext) => [binary + ext, binary + ext.toUpperCase(), binary + ext.toLowerCase()])])];
}

function onPath(binary) {
  const names = candidateNames(binary);
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const file = path.join(dir, name);
      try { if (fs.statSync(file).isFile()) return true; } catch { /* keep scanning */ }
    }
  }
  return false;
}

function gitValue(key) {
  const config = path.join(sourceHome, '.gitconfig');
  try {
    return execFileSync('git', ['config', '--file', config, `user.${key}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

copyFile(path.join(sourceHome, '.local/share/opencode/auth.json'), path.join(targetDir, 'opencode-auth.json'));
copyFile(path.join(sourceHome, '.config/opencode/opencode.jsonc'), path.join(targetDir, 'opencode.jsonc'));
copyFile(path.join(sourceHome, '.config/opencode/AGENTS.md'), path.join(targetDir, 'opencode-agents.md'));
copyDir(path.join(sourceHome, '.codex'), path.join(targetDir, 'codex'));
copyDir(path.join(sourceHome, '.claude'), path.join(targetDir, 'claude'));

fs.mkdirSync(path.join(targetDir, 'engineering-ai/policy'), { recursive: true });
copyFile(path.join(sourceHome, 'engineering-ai/policy/ENGINEERING_POLICY.md'), path.join(targetDir, 'engineering-ai/policy/ENGINEERING_POLICY.md'));

// Doctor checks agent CLIs with shutil.which(). Record host presence as executable shims so the
// container can report installed agents without trying to run host binaries inside Linux.
const toolsDir = path.join(targetDir, 'host-tools');
fs.rmSync(toolsDir, { recursive: true, force: true });
fs.mkdirSync(toolsDir, { recursive: true });
for (const name of tools) {
  if (!onPath(name)) continue;
  fs.writeFileSync(path.join(toolsDir, name), `#!/bin/sh\nprintf '%s: installed on the host, but cannot run inside this Linux container.\\n' '${name}' >&2\nexit 64\n`);
  bestEffortChmod(path.join(toolsDir, name), 0o755);
  console.log(`Detected host tool: ${name}`);
}

// kb members add commits and pushes with plain git, so the container needs a real author identity.
const name = gitValue('name') || 'kb';
const email = gitValue('email') || 'kb@users.noreply.github.com';
fs.writeFileSync(path.join(targetDir, 'git-identity-name'), name + '\n');
fs.writeFileSync(path.join(targetDir, 'git-identity-email'), email + '\n');
console.log(`Captured git identity: ${name} <${email}>`);
console.log('Recreate the container to load it:  make restart');
