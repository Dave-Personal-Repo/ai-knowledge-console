'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kconsole-test-'));
process.env.TEST_STATE_DIR = stateDir;

// The stub must run on both POSIX and Windows CI, and the hub root must exist
// before server.js resolves it; otherwise getSession() fails with ENOENT.
const hubRoot = path.join(stateDir, 'hub');
fs.mkdirSync(path.join(hubRoot, 'members'), { recursive: true });
fs.mkdirSync(path.join(hubRoot, 'config'), { recursive: true });
fs.writeFileSync(path.join(hubRoot, 'members', 'members.json'), JSON.stringify({ members: [
  { id: 'dave-bfi', github: 'dave-bfi', role: 'SUPER_OWNER', status: 'active' },
  { id: 'ayumargareth', github: 'ayumargareth', role: 'CODE_OWNER', status: 'active' },
  { id: 'erricbfi', github: 'erricbfi', role: 'COLLABORATOR', status: 'active' },
] }));
fs.writeFileSync(path.join(hubRoot, 'config', 'rbac.json'), JSON.stringify({ roles: {} }));
fs.writeFileSync(path.join(hubRoot, 'config', 'kb.json'), '{}');
process.env.KB_ROOT = hubRoot;
process.env.KB_SENSITIVE_ROOT = path.join(stateDir, 'no-sensitive-hub');

const stubJs = path.join(stateDir, 'kb.js');
fs.writeFileSync(stubJs, [
  "const fs = require('node:fs');",
  "const path = require('node:path');",
  "const dir = process.env.TEST_STATE_DIR;",
  "const args = process.argv.slice(2);",
  "if (args[0] === 'whoami') {",
  "  const login = fs.readFileSync(path.join(dir, 'login'), 'utf8').trim();",
  "  const role = fs.readFileSync(path.join(dir, 'role'), 'utf8').trim();",
  "  process.stdout.write('Identity\\n- User: ' + login + '\\n- Role: ' + role + '\\n- Privilege Level: 0 (label only)\\n');",
  "} else {",
  "  process.stdout.write('stub:' + args.join(' ') + '\\n');",
  "}",
].join('\n'));
const stub = process.platform === 'win32' ? path.join(stateDir, 'kb.cmd') : path.join(stateDir, 'kb');
fs.writeFileSync(stub, process.platform === 'win32'
  ? `@echo off\r\n"${process.execPath}" "${stubJs}" %*\r\n`
  : `#!/bin/sh\nexec "${process.execPath}" "${stubJs}" "$@"\n`, { mode: 0o755 });
process.env.KB_BIN = stub;

function setIdentity(login, role) {
  fs.writeFileSync(path.join(stateDir, 'login'), login);
  fs.writeFileSync(path.join(stateDir, 'role'), role);
}

setIdentity('tester-owner', 'SUPER_OWNER');
const { server } = require('../server.js');

let base;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(stateDir, { recursive: true, force: true });
});

function post(id, body, headers = {}) {
  return fetch(`${base}/api/commands/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-KConsole': '1', ...headers },
    body: JSON.stringify(body),
  });
}

test('command POST rejects a missing console header', async () => {
  const response = await fetch(`${base}/api/commands/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: { days: '7' } }),
  });
  assert.equal(response.status, 400);
});

test('command POST runs a validated kb command and returns its output', async () => {
  const response = await post('report', { values: { days: '7' } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.id, 'report');
  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /stub:report --days 7/);
  assert.equal(typeof result.durationMs, 'number');
});

test('session gate uses the configured kb binary', async () => {
  setIdentity('tester-code', 'CODE_OWNER');
  const response = await fetch(`${base}/api/session?fresh=1`);
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(session.login, 'tester-code');
  assert.equal(session.role, 'CODE_OWNER');
  assert.equal(session.allowed, true);
});

test('command POST blocks a CODE_OWNER from changing a SUPER_OWNER', async () => {
  setIdentity('tester-code', 'CODE_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberSetRole', { values: { login: 'dave-bfi', role: 'COLLABORATOR', confirm: true } });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /role/i);
});

test('command catalog is exposed without internal argv functions', async () => {
  const response = await fetch(`${base}/api/commands`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.commands.some((command) => command.id === 'publishVerify'));
  assert.ok(payload.commands.every((command) => !('argv' in command)));
});

test('CODE_OWNER command catalog hides higher role options', async () => {
  setIdentity('tester-code', 'CODE_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await fetch(`${base}/api/commands`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  const roleField = payload.commands.find((command) => command.id === 'memberSetRole').fields.find((field) => field.name === 'role');
  assert.deepEqual(roleField.options, ['COLLABORATOR', 'MEMBER']);
});

test('memberAdd runs the curated kb members add command', async () => {
  setIdentity('tester-owner', 'SUPER_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberAdd', { values: { login: 'new-member', role: 'MEMBER', confirm: true } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.match(result.stdout, /stub:members add new-member --role MEMBER/);
});

test('memberAdd requires confirmation', async () => {
  setIdentity('tester-owner', 'SUPER_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberAdd', { values: { login: 'new-member', role: 'MEMBER' } });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Confirm is required/);
});

test('memberAdd rejects a flag-like login before building argv', async () => {
  setIdentity('tester-owner', 'SUPER_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberAdd', { values: { login: '--evil', role: 'MEMBER', confirm: true } });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid GitHub login/);
});

test('memberAdd rejects adding the current identity', async () => {
  setIdentity('tester-code', 'CODE_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberAdd', { values: { login: 'tester-code', role: 'MEMBER', confirm: true } });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /your own account/);
});

test('memberAdd rejects an uppercase form of the current identity', async () => {
  setIdentity('tester-code', 'CODE_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberAdd', { values: { login: 'TESTER-CODE', role: 'MEMBER', confirm: true } });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /your own account/);
});

test('CODE_OWNER cannot add an owner and sees only lower role options', async () => {
  setIdentity('tester-code', 'CODE_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberAdd', { values: { login: 'new-member', role: 'CODE_OWNER', confirm: true } });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /role/i);

  const catalog = await fetch(`${base}/api/commands`).then((item) => item.json());
  const roleField = catalog.commands.find((command) => command.id === 'memberAdd').fields.find((field) => field.name === 'role');
  assert.deepEqual(roleField.options, ['COLLABORATOR', 'MEMBER']);
});

test('memberRemove runs the curated kb members remove command', async () => {
  setIdentity('tester-owner', 'SUPER_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberRemove', { values: { login: 'erricbfi', confirm: true } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.command, 'kb members remove erricbfi');
  assert.equal(result.stdout, 'stub:members remove erricbfi\n');
});

test('memberRemove requires confirmation', async () => {
  setIdentity('tester-owner', 'SUPER_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberRemove', { values: { login: 'erricbfi' } });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Confirm is required/);
});

test('memberRemove rejects a flag-like login before building argv', async () => {
  setIdentity('tester-owner', 'SUPER_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberRemove', { values: { login: '--evil', confirm: true } });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid GitHub login/);
});

test('memberRemove rejects removing the current identity', async () => {
  setIdentity('tester-code', 'CODE_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberRemove', { values: { login: 'tester-code', confirm: true } });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /your own account/);
});

test('CODE_OWNER cannot remove an owner or a peer', async () => {
  setIdentity('tester-code', 'CODE_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  for (const login of ['dave-bfi', 'ayumargareth']) {
    const response = await post('memberRemove', { values: { login, confirm: true } });
    assert.equal(response.status, 403, `${login} should be protected`);
    assert.match((await response.json()).error, /role/i);
  }
});

test('CODE_OWNER can remove a collaborator', async () => {
  setIdentity('tester-code', 'CODE_OWNER');
  await fetch(`${base}/api/session?fresh=1`);
  const response = await post('memberRemove', { values: { login: 'erricbfi', confirm: true } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.command, 'kb members remove erricbfi');
  assert.equal(result.stdout, 'stub:members remove erricbfi\n');
});
