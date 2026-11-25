'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');
const html = read('index.html');
const app = read('app.js');
const css = read('styles.css');

test('member detail popup shell exists', () => {
  assert.match(html, /id="member-dialog"/);
  assert.match(html, /data-action="close-member"/);
  assert.match(css, /\.member-dialog/);
});

test('member detail popup and scope hooks exist', () => {
  for (const hook of ['showMemberDialog', 'closeMemberDialog', 'knownScopes', 'detail.scopes', 'scopeOptions', 'Other']) {
    assert.ok(app.includes(hook), `app.js must contain ${hook}`);
  }
});

test('member dialog refreshes after a mutation and isolates results', () => {
  for (const hook of [
    'refreshMemberAfterCommand',
    'clearTargetResults',
    'anyDialogOpen',
    "state.inventory = await api('/api/inventory')",
    "form.closest('#member-dialog')",
  ]) {
    assert.ok(app.includes(hook), `app.js must contain ${hook}`);
  }
});

test('hub operations commands open in a dialog', () => {
  assert.match(html, /id="command-dialog"/);
  assert.doesNotMatch(html, /data-open-command/);
  assert.match(css, /\.command-dialog/);
  for (const hook of ['openCommandDialog', 'data-open-command', 'bindDialog', 'commandForm(command)']) {
    assert.ok(app.includes(hook), `app.js must contain ${hook}`);
  }
});

test('documents render in a split view with section-aware navigation', () => {
  for (const hook of [
    'state.openDoc',
    'function docSection',
    'function markNav(name, id)',
    'split-view',
    'function renderLibrary(forceKind, compact = false)',
  ]) {
    assert.ok(app.includes(hook), `app.js must contain ${hook}`);
  }
  assert.doesNotMatch(app, /name === 'doc' && item\.dataset\.route === 'library'/);
});

test('role permissions open in a role-filtered dialog', () => {
  assert.match(html, /id="role-dialog"/);
  assert.match(css, /\.role-dialog/);
  for (const hook of ['openRoleDialog', 'data-role-perms', 'role-dialog-body', 'state.inventory.roleScopes?.[role]']) {
    assert.ok(app.includes(hook), `app.js must contain ${hook}`);
  }
});

test('dashboard role cards come from the filtered inventory', () => {
  assert.doesNotMatch(app, /\['SUPER_OWNER', 'CODE_OWNER'\]\.map/);
  assert.ok(app.includes('Object.keys(state.inventory.roleScopes || state.inventory.permissionCounts || {})'));
});

test('reader back navigation is distinct from dashboard browse', () => {
  assert.ok(app.includes('data-action="go-back"'));
  assert.ok(app.includes("name === 'go-back'"));
  assert.ok(app.includes("name === 'go-library') navigate('library')"));
});

test('refreshes invalidate the cached document reader', () => {
  assert.ok((app.match(/state\.openDoc = null/g) || []).length >= 2);
});

test('docSection maps document kinds to the correct menu', () => {
  const source = app.match(/function docSection\(id\) \{[\s\S]*?\n\}/)[0];
  const docSection = new Function('state', `${source}; return docSection;`)({
    inventory: {
      items: [
        { id: 'general:note', kind: 'knowledge' },
        { id: 'policy:rules', kind: 'policy' },
      ],
    },
  });
  assert.equal(docSection('policy:rules'), 'policies');
  assert.equal(docSection('general:note'), 'library');
  assert.equal(docSection('missing:doc'), 'library');
});
