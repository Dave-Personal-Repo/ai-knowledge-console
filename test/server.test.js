'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ROLE_RANK,
  visibleRoles,
  visibleMembers,
  filterInventoryForRole,
  runKb,
  redactOutput,
  COMMANDS,
  validateValues,
  buildArgv,
  assertTargetAllowed,
  publicCommand,
  browserCommand,
  shouldOpenBrowser,
  handleServerError,
} = require('../server.js');

function command(id) {
  const found = COMMANDS.find((item) => item.id === id);
  assert.ok(found, `command ${id} must exist`);
  return found;
}

const member = (login, role, status) => ({ id: login, github: login, display: login, role, status, scopes: [], joined: '' });
const pickerRoster = [
  member('owner', 'SUPER_OWNER', 'active'),
  member('peer', 'CODE_OWNER', 'active'),
  member('working', 'COLLABORATOR', 'active'),
  member('resting', 'MEMBER', 'suspended'),
  member('gone', 'COLLABORATOR', 'removed'),
  member('waiting', 'MEMBER', 'invited'),
  member('sealed', 'MEMBER', 'revoked'),
];

test('role rank orders SUPER_OWNER above CODE_OWNER', () => {
  assert.ok(ROLE_RANK.SUPER_OWNER > ROLE_RANK.CODE_OWNER);
});

test('CODE_OWNER sees only peer and lower roles', () => {
  assert.deepEqual(visibleRoles('SUPER_OWNER'), ['SUPER_OWNER', 'CODE_OWNER', 'COLLABORATOR', 'MEMBER']);
  assert.deepEqual(visibleRoles('CODE_OWNER'), ['CODE_OWNER', 'COLLABORATOR', 'MEMBER']);
});

test('member list excludes SUPER_OWNER for CODE_OWNER', () => {
  const members = [
    { login: 'a', role: 'SUPER_OWNER' },
    { login: 'b', role: 'CODE_OWNER' },
    { login: 'c', role: 'MEMBER' },
  ];
  assert.deepEqual(visibleMembers(members, 'CODE_OWNER').map((member) => member.login), ['b', 'c']);
});

test('inventory scope lists exclude roles above the session', () => {
  const inventory = {
    members: [{ login: 'a', role: 'SUPER_OWNER' }, { login: 'c', role: 'MEMBER' }],
    roleScopes: { SUPER_OWNER: ['a'], CODE_OWNER: ['b'], MEMBER: ['c'] },
    permissionCounts: { SUPER_OWNER: 12, CODE_OWNER: 8, MEMBER: 2 },
  };
  const filtered = filterInventoryForRole(inventory, 'CODE_OWNER');
  assert.deepEqual(filtered.members.map((member) => member.login), ['c']);
  assert.deepEqual(Object.keys(filtered.roleScopes), ['CODE_OWNER', 'MEMBER']);
  assert.deepEqual(Object.keys(filtered.permissionCounts), ['CODE_OWNER', 'MEMBER']);
});

test('runKb returns the command and captured output for a successful call', () => {
  const stub = () => ({ status: 0, stdout: 'ok\n', stderr: '', error: null });
  const result = runKb(['status'], stub);
  assert.equal(result.command, 'kb status');
  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'ok\n');
  assert.equal(result.stderr, '');
  assert.equal(typeof result.durationMs, 'number');
});

test('runKb reports a failed exit code without throwing', () => {
  const stub = () => ({ status: 2, stdout: '', stderr: 'denied', error: null });
  const result = runKb(['members', 'list'], stub);
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.equal(result.stderr, 'denied');
});

test('redactOutput masks token-like values', () => {
  const output = redactOutput('token ghp_abcdefghijklmnopqrstuvwxyz Bearer abcdefghijklmnopqrstuvwxyz');
  assert.ok(!output.includes('ghp_'));
  assert.ok(!output.includes('Bearer abc'));
});

test('command catalog covers the informative and maintenance commands', () => {
  const ids = [
    'status', 'doctor', 'report', 'publishVerify', 'publish', 'sync', 'triage', 'validate',
    'capabilities', 'membersList', 'memberAdd', 'rolesList', 'featuresList', 'audit', 'logs', 'cleanupStatus',
    'cleanupReport', 'cleanupIntent', 'cleanupRun', 'promote', 'memberSetRole', 'memberGrant',
    'memberUngrant', 'memberSuspend', 'memberRemove', 'memberReinstate',
  ];
  assert.deepEqual(COMMANDS.map((item) => item.id), ids);
});

test('member commands expose only active, visible, non-self login options', () => {
  const publicCommandFor = publicCommand(command('memberSetRole'), { login: 'owner', role: 'SUPER_OWNER' }, pickerRoster);
  const loginField = publicCommandFor.fields.find((field) => field.name === 'login');
  assert.deepEqual(loginField.options, ['peer', 'working']);
  assert.deepEqual(loginField.optionLabels, ['peer — CODE OWNER · active', 'working — COLLABORATOR · active']);
});

test('reinstate exposes only suspended member options', () => {
  const publicCommandFor = publicCommand(command('memberReinstate'), { login: 'owner', role: 'SUPER_OWNER' }, pickerRoster);
  const loginField = publicCommandFor.fields.find((field) => field.name === 'login');
  assert.deepEqual(loginField.options, ['resting']);
});

test('role fields default to MEMBER and follow session authority', () => {
  const superField = publicCommand(command('memberAdd'), { login: 'owner', role: 'SUPER_OWNER' }, pickerRoster).fields.find((field) => field.name === 'role');
  assert.equal(superField.type, 'enum');
  assert.deepEqual(superField.options, ['SUPER_OWNER', 'CODE_OWNER', 'COLLABORATOR', 'MEMBER']);
  assert.equal(superField.default, 'MEMBER');

  const loginField = publicCommand(command('memberAdd'), { login: 'owner', role: 'SUPER_OWNER' }, pickerRoster).fields.find((field) => field.name === 'login');
  assert.equal(loginField.type, 'text');

  const codeField = publicCommand(command('memberAdd'), { login: 'peer', role: 'CODE_OWNER' }, pickerRoster).fields.find((field) => field.name === 'role');
  assert.deepEqual(codeField.options, ['COLLABORATOR', 'MEMBER']);
  assert.equal(codeField.default, 'MEMBER');
});

test('target status is enforced independently of the rendered options', () => {
  const session = { login: 'owner', role: 'SUPER_OWNER' };
  assert.match(assertTargetAllowed(session, { login: 'gone', action: 'set-role', targetStatuses: ['active'] }, member('gone', 'COLLABORATOR', 'removed')) || '', /active/i);
  assert.match(assertTargetAllowed(session, { login: 'working', action: 'reinstate', targetStatuses: ['suspended'] }, member('working', 'COLLABORATOR', 'active')) || '', /suspended/i);
});

test('report argv uses either days or compare, never both', () => {
  const report = command('report');
  assert.deepEqual(buildArgv(report, { days: '7', compare: '' }), ['report', '--days', '7']);
  assert.deepEqual(buildArgv(report, { days: '7', compare: '2026-11-01' }), ['report', '--compare', '2026-11-01']);
});

test('promote argv stays a dry run until apply is requested', () => {
  const promote = command('promote');
  const preview = buildArgv(promote, { target: 'note', value: 'Decisions/x', reviewer: '', evidence: '', apply: false });
  assert.deepEqual(preview, ['promote', '--note', 'Decisions/x']);
  const applied = buildArgv(promote, { target: 'note', value: 'Decisions/x', reviewer: 'Dave', evidence: 'checked the code and tests', apply: true });
  assert.deepEqual(applied, ['promote', '--note', 'Decisions/x', '--reviewer', 'Dave', '--evidence', 'checked the code and tests', '--apply']);
  const judged = buildArgv(promote, { target: 'note', value: 'Decisions/x', reviewer: 'Dave', evidence: 'checked the code and tests', judgement: true, apply: true });
  assert.deepEqual(judged, ['promote', '--note', 'Decisions/x', '--reviewer', 'Dave', '--evidence', 'checked the code and tests', '--judgement', '--apply']);
});

test('member set-role passes the role as a positional argument', () => {
  assert.deepEqual(buildArgv(command('memberSetRole'), { login: 'alice', role: 'COLLABORATOR' }), ['members', 'set-role', 'alice', 'COLLABORATOR']);
});

test('invalid dates, flag-like logins and weak promote evidence are rejected', () => {
  assert.match(validateValues(command('report'), { compare: '2026-13-01' }) || '', /date/i);
  assert.match(validateValues(command('memberGrant'), { login: '--apply', scope: 'company:x', confirm: true }) || '', /login/i);
  assert.match(validateValues(command('promote'), { target: 'note', value: 'Decisions/x', apply: true, reviewer: '', evidence: 'short', confirm: true }) || '', /evidence|reviewer/i);
  assert.match(validateValues(command('promote'), { target: 'note', value: 'Decisions/x', apply: true, reviewer: '', evidence: 'checked the code and tests', confirm: true }) || '', /reviewer/i);
});

test('mutating commands require explicit confirmation', () => {
  assert.match(validateValues(command('sync'), {}) || '', /confirm/i);
  assert.equal(validateValues(command('sync'), { confirm: true }), null);
});

test('CODE_OWNER cannot act on self, peers or revoked members', () => {
  const session = { login: 'dave', role: 'CODE_OWNER' };
  assert.match(assertTargetAllowed(session, { login: 'dave' }, { role: 'SUPER_OWNER' }) || '', /own/i);
  assert.match(assertTargetAllowed(session, { login: 'bob' }, { role: 'CODE_OWNER', status: 'active' }) || '', /role/i);
  assert.equal(assertTargetAllowed(session, { login: 'bob' }, { role: 'COLLABORATOR', status: 'active' }), null);
  assert.match(assertTargetAllowed(session, { login: 'bob', action: 'reinstate' }, { role: 'MEMBER', status: 'revoked' }) || '', /suspended/i);
  assert.equal(assertTargetAllowed({ login: 'root', role: 'SUPER_OWNER' }, { login: 'bob' }, { role: 'CODE_OWNER', status: 'active' }), null);
});

test('CODE_OWNER cannot assign or target roles above COLLABORATOR', () => {
  const session = { login: 'dave', role: 'CODE_OWNER' };
  assert.match(assertTargetAllowed(session, { login: 'bob', role: 'CODE_OWNER' }, { role: 'COLLABORATOR', status: 'active' }) || '', /role/i);
  assert.match(assertTargetAllowed(session, { login: 'bob' }, { role: 'SRE', status: 'active' }) || '', /role/i);
});

test('browser opener picks a platform command', () => {
  assert.equal(browserCommand('darwin').cmd, 'open');
  assert.equal(browserCommand('linux').cmd, 'xdg-open');
  assert.deepEqual(browserCommand('win32'), { cmd: 'cmd', args: ['/c', 'start'] });
});

test('browser opener is skipped in CI, Docker and on request', () => {
  assert.equal(shouldOpenBrowser({}, false), true);
  assert.equal(shouldOpenBrowser({ OPEN_BROWSER: '0' }, false), false);
  assert.equal(shouldOpenBrowser({ CI: 'true' }, false), false);
  assert.equal(shouldOpenBrowser({}, true), false);
});

test('an already-used port opens the running UI instead of failing', () => {
  const opened = [];
  const url = 'http://127.0.0.1:4310';
  assert.equal(handleServerError({ code: 'EADDRINUSE', message: 'port in use' }, url, (target) => opened.push(target)), true);
  assert.deepEqual(opened, [url]);
});

test('other server errors do not open a browser', () => {
  const opened = [];
  assert.equal(handleServerError({ code: 'EACCES' }, 'http://127.0.0.1:4310', (target) => opened.push(target)), false);
  assert.deepEqual(opened, []);
});
