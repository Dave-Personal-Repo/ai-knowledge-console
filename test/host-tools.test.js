'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const { execFile, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');

const root = path.join(__dirname, '..');
const run = (script, args = [], options = {}) => execFileSync(process.execPath, [path.join(root, 'scripts', script), ...args], { stdio: 'pipe', ...options });
const runAsync = promisify(execFile);

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kconsole-host-tools-'));
  return dir;
}

test('agent-auth copies config, detects host tools and captures git identity', () => {
  const dir = tempDir();
  const source = path.join(dir, 'home');
  const target = path.join(dir, 'agent-auth');
  const bin = path.join(dir, 'bin');

  fs.mkdirSync(path.join(source, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(source, '.codex'), { recursive: true });
  fs.mkdirSync(path.join(source, '.config/opencode'), { recursive: true });
  fs.mkdirSync(path.join(source, 'engineering-ai/policy'), { recursive: true });
  fs.mkdirSync(bin, { recursive: true });

  fs.writeFileSync(path.join(source, '.gitconfig'), '[user]\n\tname = Test Owner\n\temail = owner@example.test\n');
  fs.writeFileSync(path.join(source, '.claude/CLAUDE.md'), 'kb retrieve\n');
  fs.writeFileSync(path.join(source, '.config/opencode/AGENTS.md'), 'kb retrieve\n');
  fs.writeFileSync(path.join(source, 'engineering-ai/policy/ENGINEERING_POLICY.md'), 'kb retrieve\n');
  for (const name of ['claude.cmd', 'opencode.exe']) {
    fs.writeFileSync(path.join(bin, name), 'host tool\n', { mode: 0o755 });
  }

  run('agent-auth.js', [], {
    env: {
      ...process.env,
      AGENT_AUTH_SOURCE_HOME: source,
      AGENT_AUTH_DIR: target,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      PATHEXT: '.CMD;.EXE',
    },
  });

  assert.equal(fs.readFileSync(path.join(target, 'opencode-agents.md'), 'utf8'), 'kb retrieve\n');
  assert.equal(fs.readFileSync(path.join(target, 'engineering-ai/policy/ENGINEERING_POLICY.md'), 'utf8'), 'kb retrieve\n');
  assert.equal(fs.readFileSync(path.join(target, 'git-identity-name'), 'utf8').trim(), 'Test Owner');
  assert.equal(fs.readFileSync(path.join(target, 'git-identity-email'), 'utf8').trim(), 'owner@example.test');

  const tools = path.join(target, 'host-tools');
  const detected = fs.readdirSync(tools).sort();
  assert.deepEqual(detected, ['claude', 'opencode']);
  for (const name of detected) {
    assert.equal(fs.statSync(path.join(tools, name)).mode & 0o111, 0o111);
    assert.match(fs.readFileSync(path.join(tools, name), 'utf8'), /cannot run inside this Linux container/);
  }
});

test('agent-auth creates empty placeholders for missing sources', () => {
  const dir = tempDir();
  const source = path.join(dir, 'empty-home');
  const target = path.join(dir, 'agent-auth');
  const emptyBin = path.join(dir, 'empty-bin');
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(emptyBin, { recursive: true });

  run('agent-auth.js', [], { env: { ...process.env, AGENT_AUTH_SOURCE_HOME: source, AGENT_AUTH_DIR: target, PATH: emptyBin } });

  for (const name of ['opencode-auth.json', 'opencode.jsonc', 'opencode-agents.md', 'engineering-ai/policy/ENGINEERING_POLICY.md']) {
    const file = path.join(target, name);
    assert.ok(fs.existsSync(file), `${name} missing`);
    assert.equal(fs.statSync(file).size, 0, `${name} should be empty`);
  }
  assert.equal(fs.readFileSync(path.join(target, 'git-identity-name'), 'utf8').trim(), 'kb');
  assert.deepEqual(fs.readdirSync(path.join(target, 'host-tools')), []);
});

test('docker-up uses the existing image and skips the browser', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"allowed":true}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const dir = tempDir();
  const bin = path.join(dir, 'bin');
  const log = path.join(dir, 'docker.log');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'docker'), `#!/bin/sh\nprintf '%s\\n' "$*" >> "${log}"\n`, { mode: 0o755 });

  try {
    const { stdout } = await runAsync(process.execPath, [path.join(root, 'scripts', 'docker-up.js'), '--no-build', '--no-open'], {
      env: {
        ...process.env,
        AGENT_AUTH_DIR: path.join(dir, 'auth'),
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        KCONSOLE_PORT: String(port),
        KCONSOLE_BIND_IP: '127.0.0.1',
        OPEN_BROWSER: '0',
        CI: '',
        DOCKER_LOG: log,
      },
      timeout: 20000,
    });
    assert.match(stdout, /Console is ready/);
    const calls = fs.readFileSync(log, 'utf8');
    assert.match(calls, /compose up -d/);
    assert.doesNotMatch(calls, /--build/);
    assert.doesNotMatch(calls, /open|xdg-open|cmd\.exe/);
  } finally {
    server.close();
  }
});

test('docker-prune is nonfatal without docker', () => {
  const out = run('docker-prune.js', [], { env: { ...process.env, PATH: '' } });
  assert.equal(out.toString().trim(), '');
});

test('npm test discovers tests without a shell glob', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'node --test');
});
