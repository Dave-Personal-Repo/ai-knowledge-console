'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const compose = fs.readFileSync(path.join(__dirname, '..', 'docker-compose.yml'), 'utf8');
const dockerfile = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');
const entrypoint = fs.readFileSync(path.join(__dirname, '..', 'docker-entrypoint.sh'), 'utf8');

test('knowledge clone mounts are writable while auth and state stay read-only', () => {
  const writableKnowledge = compose.match(/^\s*- .*:\/knowledge\/ai-knowledge(?:-sensitive)?:rw\s*$/gm) || [];
  assert.equal(writableKnowledge.length, 2);
  assert.doesNotMatch(compose, /\/knowledge\/ai-knowledge(?:-sensitive)?:ro\b/);
  for (const mount of ['/run/gh:ro', '/run/kb-state:ro', '/run/agent-auth:ro']) {
    assert.ok(compose.includes(mount), `docker-compose.yml must keep ${mount}`);
  }
});

test('host tool shims come before kb scripts on PATH', () => {
  const pathLine = dockerfile.split('\n').find((line) => /^\s+PATH=/.test(line));
  assert.ok(pathLine, 'Dockerfile must set PATH');
  assert.match(pathLine.trim(), /^PATH=\/home\/console\/\.local\/bin:\/knowledge\/ai-knowledge\/scripts:\$\{PATH\}(?: \\)?$/);
});

test('entrypoint installs shims and configures git identity and token-backed push', () => {
  for (const needle of [
    'host-tools',
    'git-identity-name',
    'git-identity-email',
    'HOME="$console_home" gh auth setup-git',
    'insteadOf git@github.com:',
    'engineering-ai/policy/ENGINEERING_POLICY.md',
  ]) {
    assert.ok(entrypoint.includes(needle), `entrypoint must contain ${needle}`);
  }

  const mkdirIndex = entrypoint.indexOf('mkdir -p "$console_home/engineering-ai/policy"');
  const copyIndex = entrypoint.indexOf('if [ -s "$agent_root/engineering-ai/policy/ENGINEERING_POLICY.md" ]');
  assert.ok(mkdirIndex >= 0 && mkdirIndex < copyIndex, 'engineering-ai directory must exist before chown even when the policy copy is skipped');
});
