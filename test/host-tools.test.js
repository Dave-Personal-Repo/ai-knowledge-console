'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('agent-auth captures host tools, config markers and git identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kconsole-agent-auth-'));
  const source = path.join(root, 'home');
  const target = path.join(root, 'agent-auth');
  const bin = path.join(root, 'bin');

  fs.mkdirSync(path.join(source, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(source, '.codex'), { recursive: true });
  fs.mkdirSync(path.join(source, '.config/opencode'), { recursive: true });
  fs.mkdirSync(path.join(source, 'engineering-ai/policy'), { recursive: true });
  fs.mkdirSync(bin, { recursive: true });

  fs.writeFileSync(path.join(source, '.gitconfig'), '[user]\n\tname = Test Owner\n\temail = owner@example.test\n');
  fs.writeFileSync(path.join(source, '.claude/CLAUDE.md'), 'kb retrieve\n');
  fs.writeFileSync(path.join(source, '.config/opencode/AGENTS.md'), 'kb retrieve\n');
  fs.writeFileSync(path.join(source, 'engineering-ai/policy/ENGINEERING_POLICY.md'), 'kb retrieve\n');
  for (const name of ['claude', 'opencode']) {
    fs.writeFileSync(path.join(bin, name), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  }

  execFileSync(path.join(__dirname, '..', 'scripts', 'agent-auth.sh'), {
    env: { ...process.env, AGENT_AUTH_SOURCE_HOME: source, AGENT_AUTH_DIR: target, PATH: `${bin}:/usr/bin:/bin` },
    stdio: 'pipe',
  });

  const tools = path.join(target, 'host-tools');
  for (const name of ['claude', 'opencode']) {
    const shim = path.join(tools, name);
    assert.ok(fs.existsSync(shim), `${name} shim missing`);
    assert.equal(fs.statSync(shim).mode & 0o111, 0o111);
    assert.match(fs.readFileSync(shim, 'utf8'), /cannot run inside this Linux container/);
    assert.throws(() => execFileSync(shim, { stdio: 'pipe' }), (error) => {
      assert.equal(error.status, 64);
      assert.equal(error.stderr.toString().trim(), `${name}: installed on the host, but cannot run inside this Linux container.`);
      return true;
    });
  }
  assert.ok(!fs.existsSync(path.join(tools, 'codex')), 'undetected codex shim should not exist');

  assert.equal(fs.readFileSync(path.join(target, 'git-identity-name'), 'utf8').trim(), 'Test Owner');
  assert.equal(fs.readFileSync(path.join(target, 'git-identity-email'), 'utf8').trim(), 'owner@example.test');
  assert.match(fs.readFileSync(path.join(target, 'opencode-agents.md'), 'utf8'), /kb retrieve/);
  assert.match(fs.readFileSync(path.join(target, 'engineering-ai/policy/ENGINEERING_POLICY.md'), 'utf8'), /kb retrieve/);
});
