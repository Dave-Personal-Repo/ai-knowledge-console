'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kconsole-pickers-'));
const root = path.join(stateDir, 'hub');
const membersDir = path.join(root, 'members');
fs.mkdirSync(membersDir, { recursive: true });

const member = (login, role, status) => ({
  id: login,
  github: login,
  display: login,
  role,
  status,
  scopes: [],
  joined: '2026-11-26',
});
fs.writeFileSync(path.join(membersDir, 'members.json'), JSON.stringify({
  members: [
    member('owner', 'SUPER_OWNER', 'active'),
    member('peer', 'CODE_OWNER', 'active'),
    member('working', 'COLLABORATOR', 'active'),
    member('resting', 'MEMBER', 'suspended'),
    member('gone', 'COLLABORATOR', 'removed'),
    member('waiting', 'MEMBER', 'invited'),
    member('sealed', 'MEMBER', 'revoked'),
  ],
}));

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
process.env.KB_ROOT = root;
process.env.KB_SENSITIVE_ROOT = path.join(stateDir, 'sensitive');
process.env.TEST_STATE_DIR = stateDir;

function setIdentity(login, role) {
  fs.writeFileSync(path.join(stateDir, 'login'), login);
  fs.writeFileSync(path.join(stateDir, 'role'), role);
}

setIdentity('owner', 'SUPER_OWNER');
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

async function session(login, role) {
  setIdentity(login, role);
  await fetch(`${base}/api/session?fresh=1`);
}

function field(commands, id, name) {
  return commands.find((command) => command.id === id).fields.find((entry) => entry.name === name);
}

function post(id, values) {
  return fetch(`${base}/api/commands/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-KConsole': '1' },
    body: JSON.stringify({ values }),
  });
}

test('SUPER_OWNER catalog scopes member pickers by status and self', async () => {
  await session('owner', 'SUPER_OWNER');
  const { commands } = await fetch(`${base}/api/commands`).then((response) => response.json());
  const roleField = field(commands, 'memberSetRole', 'login');
  assert.deepEqual(roleField.options, ['peer', 'working']);
  assert.ok(!roleField.options.some((login) => ['owner', 'gone', 'resting', 'waiting', 'sealed'].includes(login)));
  assert.deepEqual(roleField.optionLabels, ['peer — CODE OWNER · active', 'working — COLLABORATOR · active']);
  assert.deepEqual(field(commands, 'memberReinstate', 'login').options, ['resting']);
});

test('CODE_OWNER catalog hides peers and non-active members', async () => {
  await session('peer', 'CODE_OWNER');
  const { commands } = await fetch(`${base}/api/commands`).then((response) => response.json());
  assert.deepEqual(field(commands, 'memberSetRole', 'login').options, ['working']);
  assert.deepEqual(field(commands, 'memberReinstate', 'login').options, ['resting']);
  assert.deepEqual(field(commands, 'memberSetRole', 'role').options, ['COLLABORATOR', 'MEMBER']);
  assert.equal(field(commands, 'memberSetRole', 'role').default, 'MEMBER');
});

test('removed login is rejected by the server even when posted directly', async () => {
  await session('owner', 'SUPER_OWNER');
  const response = await post('memberSetRole', { login: 'gone', role: 'MEMBER', confirm: true });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /active/i);
});

test('active login is rejected by reinstate even when posted directly', async () => {
  await session('owner', 'SUPER_OWNER');
  const response = await post('memberReinstate', { login: 'working', confirm: true });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /suspended/i);
});

test('CODE_OWNER cannot assign owner roles directly', async () => {
  await session('peer', 'CODE_OWNER');
  for (const role of ['CODE_OWNER', 'SUPER_OWNER']) {
    const response = await post('memberSetRole', { login: 'working', role, confirm: true });
    assert.equal(response.status, 403, `${role} should be denied`);
    assert.match((await response.json()).error, /role/i);
  }
});

test('SUPER_OWNER can assign SUPER_OWNER and gets the exact argv', async () => {
  await session('owner', 'SUPER_OWNER');
  const response = await post('memberSetRole', { login: 'peer', role: 'SUPER_OWNER', confirm: true });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.command, 'kb members set-role peer SUPER_OWNER');
  assert.equal(result.stdout, 'stub:members set-role peer SUPER_OWNER\n');
});
