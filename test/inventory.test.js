'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kconsole-inventory-'));
fs.mkdirSync(path.join(root, 'config'), { recursive: true });
fs.mkdirSync(path.join(root, 'members'), { recursive: true });
fs.writeFileSync(path.join(root, 'members/members.json'), JSON.stringify({ members: [] }));
fs.writeFileSync(path.join(root, 'config/rbac.json'), JSON.stringify({ roles: {} }));
fs.writeFileSync(path.join(root, 'config/kb.json'), JSON.stringify({
  known_scopes: ['company:ai-knowledge', 'federated:bfidigital'],
}));

process.env.KB_ROOT = root;
const { buildInventory } = require('../server.js');

test.after(() => fs.rmSync(root, { recursive: true, force: true }));

test('inventory exposes curated scopes from the hub config', () => {
  assert.deepEqual(buildInventory().knownScopes, ['company:ai-knowledge', 'federated:bfidigital']);
});
