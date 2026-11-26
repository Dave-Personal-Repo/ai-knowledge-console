#!/usr/bin/env node
'use strict';

// Delete superseded ai-knowledge-console images left behind by earlier builds.
// Only unused, untagged images carrying this project's title label are removed.
// Missing or failing docker is never fatal to a build.
const { spawnSync } = require('node:child_process');

const result = spawnSync('docker', ['image', 'prune', '--force', '--filter', 'label=org.opencontainers.image.title=ai-knowledge-console'], { encoding: 'utf8', windowsHide: true });
if (result.error) {
  if (result.error.code !== 'ENOENT') console.error(`Could not remove old console images (continuing): ${result.error.message}`);
  process.exit(0);
}
if (result.status !== 0) {
  console.error(`Could not remove old console images (continuing): ${(result.stderr || result.stdout || `exit ${result.status}`).trim()}`);
  process.exit(0);
}

const output = (result.stdout || '') + (result.stderr || '');
if (output.includes('Deleted Images:')) {
  const reclaimed = output.match(/Total reclaimed space:\s*(.+)/);
  console.log(`Removed old console images (reclaimed ${reclaimed ? reclaimed[1].trim() : 'some space'}).`);
}
