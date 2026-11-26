#!/usr/bin/env node
'use strict';

// Start the Docker console, wait until it is authorised, then open it on the host.
// Node standard library only: no bash, curl, grep or sleep is needed on Windows.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function parseEnv(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const index = text.indexOf('=');
    if (index < 1) continue;
    const value = text.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    values[text.slice(0, index).trim()] = value;
  }
  return values;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function healthy(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.text();
      if (response.ok && body.includes('"allowed":true')) return true;
    } catch { /* the container may still be starting */ } finally {
      clearTimeout(timer);
    }
    await delay(1000);
  }
  return false;
}

function which(name) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const file = path.join(dir, name);
    try { if (fs.statSync(file).isFile()) return file; } catch { /* keep scanning */ }
  }
  return null;
}

function openUi(url) {
  for (const opener of ['open', 'xdg-open']) {
    const exe = which(opener);
    if (!exe) continue;
    const result = spawnSync(exe, [url], { stdio: 'ignore', windowsHide: true });
    if (!result.error && result.status === 0) return;
  }
  if (process.platform === 'win32' || process.env.OS === 'Windows_NT') {
    spawnSync('cmd.exe', ['/d', '/c', 'start', '""', url], { stdio: 'ignore', windowsHide: true });
  }
}

async function main() {
  let build = true;
  let noOpen = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === '--no-build') build = false;
    else if (arg === '--no-open') noOpen = true;
    else if (arg === '-h' || arg === '--help') {
      console.log('Usage: node scripts/docker-up.js [--no-build] [--no-open]');
      return;
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exitCode = 2;
      return;
    }
  }

  const values = { ...process.env, ...parseEnv(path.join(root, '.env')) };
  const port = values.KCONSOLE_PORT || '4310';
  const bindIp = values.KCONSOLE_BIND_IP || '127.0.0.1';
  const uiIp = bindIp === '0.0.0.0' || bindIp === '::' ? '127.0.0.1' : bindIp;
  const uiUrl = `http://${uiIp}:${port}/`;
  const healthUrl = `${uiUrl}api/session`;

  const compose = ['compose', 'up', '-d'];
  if (build) compose.push('--build');
  console.log(`Starting the console at ${uiUrl}`);
  const up = spawnSync('docker', compose, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (up.error || up.status !== 0) {
    console.error(`docker compose up failed: ${up.error ? up.error.message : `exit ${up.status}`}`);
    process.exitCode = up.status || 1;
    return;
  }
  if (build) spawnSync(process.execPath, [path.join(root, 'scripts/docker-prune.js')], { cwd: root, stdio: 'inherit' });

  if (await healthy(healthUrl)) {
    console.log('Console is ready.');
    if (!noOpen && values.OPEN_BROWSER !== '0' && !values.CI) openUi(uiUrl);
  } else {
    console.error('The console is not authorised yet; it may still be starting.');
    console.error('Follow the logs with: make logs');
  }
  console.log(`Dashboard: ${uiUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
