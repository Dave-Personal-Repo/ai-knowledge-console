'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  ROLE_RANK,
  visibleRoles,
  visibleMembers,
  filterInventoryForRole,
  runKb,
  quoteCmdArg,
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

test('windows cmd kb binary runs through cmd.exe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kconsole-kb-'));
  const bin = path.join(dir, 'kb.cmd');
  fs.writeFileSync(bin, '@echo off\r\necho %*\r\n');
  const calls = [];
  const stub = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0, stdout: `${args.join(' ')}\n`, stderr: '', error: null };
  };

  const result = runKb(['whoami'], stub, 'win32', bin);

  assert.equal(calls[0].command, 'cmd.exe');
  assert.deepEqual(calls[0].args.slice(0, 3), ['/d', '/c', quoteCmdArg(bin)]);
  assert.equal(calls[0].args[3], quoteCmdArg('whoami'));
  assert.match(result.stdout, /whoami/);
  assert.doesNotMatch(result.stderr, /EINVAL/);
  assert.equal(result.ok, true);
});

test('cmd argument quoting rejects shell metacharacters', () => {
  assert.equal(quoteCmdArg('C:\\Program Files\\kb.cmd'), '"C:\\Program Files\\kb.cmd"');
  for (const value of ['a%b', 'a!b', 'a"b', 'a&b', 'a|b', 'a<b', 'a>b', 'a^b', 'a\nb']) {
    assert.throws(() => quoteCmdArg(value), TypeError, value);
  }
});

test('compose defaults are overridable on every host', () => {
  const compose = fs.readFileSync(path.join(__dirname, '..', 'docker-compose.yml'), 'utf8');
  assert.match(compose, /\$\{KCONSOLE_HOST_HOME:-\$\{HOME\}\}/);
  assert.match(compose, /\$\{KCONSOLE_GH_CONFIG:-\$\{HOME\}\/\.config\/gh\}/);
  assert.match(compose, /\$\{KCONSOLE_KB_STATE:-\$\{HOME\}\/\.local\/state\/kb\}/);
});

test('ui shows both shortcut labels', () => {
  const root = path.join(__dirname, '..', 'public');
  for (const file of ['index.html', 'app.js']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(text, /⌘\/Ctrl K/, file);
    assert.doesNotMatch(text, /⌘K(?!\/)/, file);
  }
});
