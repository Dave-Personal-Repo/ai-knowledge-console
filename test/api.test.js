'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kconsole-test-'));
const stub = path.join(stateDir, 'kb');
fs.writeFileSync(stub, `#!/bin/sh
if [ "$1" = "whoami" ]; then
  printf 'Identity\\n- User: %s\\n- Role: %s\\n- Privilege Level: 0 (label only)\\n' "$(cat "$TEST_STATE_DIR/login")" "$(cat "$TEST_STATE_DIR/role")"
  exit 0
fi
printf 'stub:%s\\n' "$*"
exit 0
`, { mode: 0o755 });
process.env.KB_BIN = stub;
process.env.TEST_STATE_DIR = stateDir;

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
