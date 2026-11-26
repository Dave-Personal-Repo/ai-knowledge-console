'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawn, spawnSync } = require('node:child_process');

const PORT = Number(process.env.PORT || 4310);
const HOST = process.env.HOST || '127.0.0.1';
const KB_BIN = process.env.KB_BIN || 'kb';
const PUBLIC_ROOT = path.join(__dirname, 'public');
const KB_ROOT = path.resolve(process.env.KB_ROOT || path.join(os.homedir(), 'knowledge/ai-knowledge'));
const SENSITIVE_ROOT = path.resolve(
  process.env.KB_SENSITIVE_ROOT || path.join(os.homedir(), 'knowledge/ai-knowledge-sensitive'),
);
const ALLOWED_ROLES = new Set(['SUPER_OWNER', 'CODE_OWNER']);
const INCLUDE_DIRS = ['knowledge', 'docs', 'workflows', 'agents/shared/engineering-ai/policy'];
const INCLUDE_ROOT_FILES = ['README.md', 'CONTRIBUTING.md', 'BOOTSTRAP.md'];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function unquote(value) {
  const v = String(value || '').trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  let listKey = null;
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.replace(/\r$/, '');
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item) {
      if (listKey) meta[listKey].push(unquote(item[1]));
      continue;
    }
    const pair = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const key = pair[1];
    const value = pair[2].trim();
    if (!value) {
      meta[key] = [];
      listKey = key;
    } else {
      meta[key] = unquote(value);
      listKey = null;
    }
  }
  return { meta, body: text.slice(match[0].length) };
}

const ROLE_RANK = { SUPER_OWNER: 4, CODE_OWNER: 3, COLLABORATOR: 2, MEMBER: 1 };
const OUTPUT_LIMIT = 64 * 1024;

function visibleRoles(role) {
  const rank = ROLE_RANK[role];
  if (!rank) return [];
  return Object.keys(ROLE_RANK).filter((candidate) => ROLE_RANK[candidate] <= rank);
}

function visibleMembers(members, role) {
  const allowed = new Set(visibleRoles(role));
  return (members || []).filter((member) => allowed.has(member.role));
}

function filterInventoryForRole(inventory, role) {
  const allowed = new Set(visibleRoles(role));
  const scoped = (entries) => Object.fromEntries(Object.entries(entries || {}).filter(([name]) => allowed.has(name)));
  return {
    ...inventory,
    members: visibleMembers(inventory.members, role),
    roleScopes: scoped(inventory.roleScopes),
    permissionCounts: scoped(inventory.permissionCounts),
  };
}

function redactOutput(text) {
  const capped = String(text ?? '').slice(0, OUTPUT_LIMIT);
  return capped
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]{10,}/gi, '$1[REDACTED]')
    .replace(/(token[=:\s]+)[A-Za-z0-9._-]{10,}/gi, '$1[REDACTED]');
}

function cmdText(value) {
  const text = String(value ?? '');
  // Quotes and control characters cannot be represented in a cmd.exe command
  // line. cmd.exe expands %VAR% even inside quotes, so double literal percent.
  if (/["\r\n\0]/.test(text)) throw new TypeError(`unsafe cmd.exe argument: ${text}`);
  return text.replace(/%/g, '%%');
}

function quoteCmdArg(value) {
  return `"${cmdText(value)}"`;
}

// Both the session gate and the command runner must launch the same `kb`.
// cmd.exe /s /c strips one outer quote pair, so the quoted shim and arguments
// need one more pair around the whole line. Plain /c would strip the shim's
// own quotes instead and the launcher would never run.
function kbInvocation(argv, platform = process.platform, bin = KB_BIN) {
  let resolved = bin;
  if (platform === 'win32' && !path.extname(resolved)) {
    const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';');
    outer: for (const dir of (process.env.PATH || '').split(path.delimiter)) {
      for (const ext of exts) {
        const candidate = path.join(dir, resolved + ext);
        try {
          if (fs.statSync(candidate).isFile()) {
            resolved = candidate;
            break outer;
          }
        } catch { /* keep looking */ }
      }
    }
  }
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
    const line = [quoteCmdArg(resolved), ...argv.map(quoteCmdArg)].join(' ');
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], verbatim: true };
  }
  return { command: resolved, args: argv, verbatim: false };
}

function runKb(argv, runner = spawnSync, platform = process.platform, bin = KB_BIN) {
  const started = Date.now();
  const invocation = kbInvocation(argv, platform, bin);
  const result = runner(invocation.command, invocation.args, {
    cwd: KB_ROOT,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: OUTPUT_LIMIT * 4,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsVerbatimArguments: invocation.verbatim,
  });
  const exitCode = result.status ?? 1;
  return {
    command: `kb ${argv.join(' ')}`,
    ok: exitCode === 0 && !result.error,
    exitCode,
    stdout: redactOutput(result.stdout),
    stderr: redactOutput(result.stderr),
    durationMs: Date.now() - started,
  };
}

const ROLES = Object.keys(ROLE_RANK);
const CODE_OWNER_TARGET_ROLES = new Set(['COLLABORATOR', 'MEMBER']);
const CLEANUP_SCOPES = ['archive', 'duplicates', 'full', 'integrity', 'metadata', 'outdated', 'temp'];
const LOGIN_RE = /^[A-Za-z0-9-]{1,39}$/;
const SCOPE_RE = /^(?:(?:company|federated):[A-Za-z0-9._-]+|project:[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)$/;

function field(name, type, label, extra = {}) {
  return { name, type, label, ...extra };
}

const loginField = () => field('login', 'text', 'GitHub login', { required: true });
const roleField = () => field('role', 'enum', 'Role', { options: ROLES, required: true, default: 'MEMBER' });
const scopeField = () => field('scope', 'text', 'Scope', { required: true, placeholder: 'company:my-team' });
const applyField = () => field('apply', 'boolean', 'Apply changes');

const COMMANDS = [
  { id: 'status', label: 'Hub status', group: 'read', description: 'Sync state, documents and queue.', argv: () => ['status'] },
  { id: 'doctor', label: 'Doctor', group: 'read', description: 'Agent integration health.', argv: () => ['doctor'] },
  {
    id: 'report', label: 'Usage report', group: 'read', description: 'Usage and knowledge report, with before/after comparison.',
    fields: [field('days', 'number', 'Days', { default: '30' }), field('compare', 'date', 'Compare since')],
    argv: (v) => (v.compare ? ['report', '--compare', v.compare] : ['report', '--days', String(v.days || 30)]),
  },
  { id: 'publishVerify', label: 'Publish verify', group: 'read', description: 'Check queued knowledge reached the main branch.', argv: () => ['publish', '--verify'] },
  { id: 'publish', label: 'Publish proposals', group: 'change', mutating: true, description: 'Open pull requests for queued contributions.', argv: () => ['publish'] },
  { id: 'sync', label: 'Sync to local', group: 'change', mutating: true, description: 'Fast-forward the local hub clone.', argv: () => ['sync'] },
  {
    id: 'triage', label: 'Triage', group: 'read', description: 'Review buckets for knowledge verification.',
    fields: [field('mode', 'enum', 'View', { options: ['buckets', 'source', 'repo'], default: 'buckets' })],
    argv: (v) => (v.mode === 'source' ? ['triage', '--by-source'] : v.mode === 'repo' ? ['triage', '--by-repo'] : ['triage']),
  },
  { id: 'validate', label: 'Validate knowledge', group: 'read', description: 'Check metadata, links, duplicates and secrets.', argv: () => ['validate'] },
  { id: 'capabilities', label: 'Capabilities', group: 'read', description: 'Commands available to the current hub identity.', argv: () => ['capabilities'] },
  { id: 'membersList', label: 'Member roster', group: 'read', description: 'Full roster from kb.', argv: () => ['members', 'list'] },
  {
    id: 'memberAdd',
    label: 'Add member',
    group: 'change',
    mutating: true,
    description: 'Add a member and invite them on GitHub.',
    fields: [loginField(), roleField()],
    argv: (v) => ['members', 'add', v.login, '--role', v.role],
  },
  { id: 'rolesList', label: 'AI roles', group: 'read', description: 'Sub-agent roles and their switches.', argv: () => ['roles', 'list'] },
  { id: 'featuresList', label: 'Feature switches', group: 'read', description: 'Features kb runs on this device.', argv: () => ['features', 'list'] },
  { id: 'audit', label: 'Audit events', group: 'read', description: 'Recent authorization audit events.', argv: () => ['audit'] },
  { id: 'logs', label: 'Usage events', group: 'read', description: 'Retrieval and capture observability events.', argv: () => ['logs'] },
  { id: 'cleanupStatus', label: 'Cleanup status', group: 'read', description: 'Active and last maintenance run.', argv: () => ['cleanup', 'status'] },
  { id: 'cleanupReport', label: 'Cleanup report', group: 'read', description: 'Last maintenance report.', argv: () => ['cleanup', 'report'] },
  {
    id: 'cleanupIntent', label: 'Check cleanup intent', group: 'read', description: 'Resolve a tidy-up request into a maintenance scope.',
    fields: [field('intent', 'text', 'What should be tidied?', { required: true, min: 3, max: 200 })],
    argv: (v) => ['cleanup', 'intent', v.intent],
  },
  {
    id: 'cleanupRun', label: 'Run cleanup', group: 'change', mutating: true, description: 'Dry-run or apply knowledge maintenance.',
    fields: [field('scope', 'enum', 'Scope', { options: CLEANUP_SCOPES, default: 'full' }), applyField()],
    argv: (v) => ['cleanup', 'run', '--scope', v.scope || 'full', ...(v.apply ? ['--apply'] : [])],
  },
  {
    id: 'promote', label: 'Verify knowledge', group: 'change', mutating: true, description: 'Preview or promote reviewed notes to verified.',
    fields: [
      field('target', 'enum', 'Match by', { options: ['note', 'folder'], default: 'note' }),
      field('value', 'text', 'Source note or folder', { required: true, min: 1, max: 200 }),
      field('reviewer', 'text', 'Reviewer', { max: 100 }),
      field('evidence', 'text', 'What was checked', { max: 500 }),
      field('judgement', 'boolean', 'Approve by judgement, not code review'),
      applyField(),
    ],
    argv: (v) => [
      'promote', v.target === 'folder' ? '--folder' : '--note', v.value,
      ...(v.apply ? [
        '--reviewer', v.reviewer,
        '--evidence', v.evidence,
        ...(v.judgement ? ['--judgement'] : []),
        '--apply',
      ] : []),
    ],
  },
  {
    id: 'memberSetRole', label: 'Change role', group: 'change', mutating: true, targetAction: 'set-role', targetStatuses: ['active'], description: 'Set a member role.',
    fields: [loginField(), field('role', 'enum', 'New role', { options: ROLES, required: true })],
    argv: (v) => ['members', 'set-role', v.login, v.role],
  },
  {
    id: 'memberGrant', label: 'Grant scope', group: 'change', mutating: true, targetAction: 'grant', targetStatuses: ['active'], description: 'Grant a member an extra scope.',
    fields: [loginField(), scopeField()],
    argv: (v) => ['members', 'grant', v.login, v.scope],
  },
  {
    id: 'memberUngrant', label: 'Ungrant scope', group: 'change', mutating: true, targetAction: 'ungrant', targetStatuses: ['active'], description: 'Remove an extra scope.',
    fields: [loginField(), scopeField()],
    argv: (v) => ['members', 'ungrant', v.login, v.scope],
  },
  {
    id: 'memberSuspend', label: 'Suspend member', group: 'change', mutating: true, targetAction: 'suspend', targetStatuses: ['active'], description: 'Suspend an active member.',
    fields: [loginField()],
    argv: (v) => ['members', 'suspend', v.login],
  },
  {
    id: 'memberRemove',
    label: 'Remove member',
    group: 'change',
    mutating: true,
    targetAction: 'remove',
    targetStatuses: ['active'],
    description: 'Remove a member and revoke their access.',
    fields: [loginField()],
    argv: (v) => ['members', 'remove', v.login],
  },
  {
    id: 'memberReinstate', label: 'Reinstate member', group: 'change', mutating: true, targetAction: 'reinstate', targetStatuses: ['suspended'], description: 'Reinstate a suspended member.',
    fields: [loginField()],
    argv: (v) => ['members', 'reinstate', v.login],
  },
];

function buildArgv(command, values) {
  return command.argv(values || {});
}

function validateValues(command, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return 'Values must be an object';
  for (const spec of command.fields || []) {
    const value = values[spec.name];
    if (spec.required && (value === undefined || value === null || String(value).trim() === '')) return `${spec.label} is required`;
    if (value === undefined || value === null || value === '') continue;
    if (spec.type === 'enum' && !spec.options.includes(value)) return `Invalid ${spec.label}`;
    if (spec.type === 'number' && (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 365)) return `Invalid ${spec.label}`;
    if (spec.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) return `Invalid ${spec.label} date`;
    if (spec.type === 'boolean' && typeof value !== 'boolean') return `Invalid ${spec.label}`;
    if (spec.type === 'text') {
      const text = String(value);
      if (/[\u0000-\u001f]/.test(text) || text.startsWith('-')) return `Invalid ${spec.label}`;
      if (text.length > (spec.max || 200)) return `${spec.label} is too long`;
      if (spec.min && text.trim().length < spec.min) return `${spec.label} is too short`;
      if (spec.name === 'login') {
        if (!LOGIN_RE.test(text)) return 'Invalid login';
        values[spec.name] = text.toLowerCase();
      }
      if (spec.name === 'scope' && !SCOPE_RE.test(text)) return 'Invalid scope';
    }
  }
  if (command.mutating && values.confirm !== true) return 'Confirm is required';
  if (command.id === 'promote' && values.apply === true) {
    if (!String(values.reviewer || '').trim()) return 'Reviewer is required';
    if (String(values.evidence || '').trim().length < 10) return 'Evidence must be at least 10 characters';
  }
  return null;
}

function assertTargetAllowed(session, values, member) {
  if (!['SUPER_OWNER', 'CODE_OWNER'].includes(session?.role)) return 'Owner role required';
  if (!values?.login || String(values.login).toLowerCase() === String(session.login).toLowerCase()) return 'Cannot change your own account';
  if (!member) return 'Member not found';
  if (Array.isArray(values.targetStatuses) && values.targetStatuses.length && !values.targetStatuses.includes(member.status)) {
    return `Only ${values.targetStatuses.join(' or ')} members can be changed here`;
  }
  if (values.action === 'reinstate' && member.status !== 'suspended') return 'Only suspended members can be reinstated here';
  if (session.role === 'CODE_OWNER') {
    if (!CODE_OWNER_TARGET_ROLES.has(member.role)) return 'Role not allowed';
    if (values.role && !CODE_OWNER_TARGET_ROLES.has(values.role)) return 'Role not allowed';
  }
  return null;
}

function browserCommand(platform) {
  if (platform === 'darwin') return { cmd: 'open', args: [] };
  if (platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start'] };
  return { cmd: 'xdg-open', args: [] };
}

function shouldOpenBrowser(env, isDocker) {
  return env.OPEN_BROWSER !== '0' && !env.CI && !isDocker;
}

function openBrowser(url) {
  if (!shouldOpenBrowser(process.env, fs.existsSync('/.dockerenv'))) return;
  const { cmd, args } = browserCommand(process.platform);
  const child = spawn(cmd, [...args, url], { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}

function handleServerError(error, url, open = openBrowser) {
  if (error && error.code === 'EADDRINUSE') {
    console.log(`AI Knowledge Console already running at ${url}; opening it.`);
    open(url);
    return true;
  }
  console.error(`AI Knowledge Console could not start: ${error?.message || error}`);
  return false;
}

let sessionCache = null;
let sessionCachedAt = 0;
const SESSION_TTL = 60_000;

function getSession(force = false, runner = execFileSync, platform = process.platform, bin = KB_BIN) {
  if (!force && sessionCache && Date.now() - sessionCachedAt < SESSION_TTL) return sessionCache;
  let next;
  try {
    const invocation = kbInvocation(['whoami'], platform, bin);
    const output = runner(invocation.command, invocation.args, {
      cwd: KB_ROOT,
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsVerbatimArguments: invocation.verbatim,
    });
    const user = /-\s*User:\s*(\S+)/.exec(output)?.[1] || 'unknown';
    const role = /-\s*Role:\s*(\S+)/.exec(output)?.[1] || 'UNKNOWN';
    const privilege = /-\s*Privilege Level:\s*(\S+)/.exec(output)?.[1] || '-';
    next = { login: user, role, privilege, allowed: ALLOWED_ROLES.has(role) };
  } catch (error) {
    // A transient GitHub/licence failure must not lock the console out for the whole TTL.
    sessionCache = null;
    sessionCachedAt = 0;
    return {
      login: 'unknown',
      role: 'UNAVAILABLE',
      privilege: '-',
      allowed: false,
      error: String(error.message || error).slice(0, 200),
    };
  }
  sessionCache = next;
  sessionCachedAt = Date.now();
  return next;
}

function roots() {
  const list = [{ id: 'general', label: 'General hub', root: KB_ROOT }];
  if (fs.existsSync(SENSITIVE_ROOT)) list.push({ id: 'sensitive', label: 'Sensitive hub', root: SENSITIVE_ROOT });
  return list;
}

function isIncludedPath(relative) {
  const normalized = relative.split(path.sep).join('/');
  return (
    INCLUDE_ROOT_FILES.includes(normalized) ||
    INCLUDE_DIRS.some((dir) => normalized.startsWith(`${dir}/`))
  );
}

function collectDocs(source, root) {
  const items = [];
  const walk = (directory, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        walk(absolute, relative);
      } else if (entry.isFile() && entry.name.endsWith('.md') && isIncludedPath(relative)) {
        let text;
        try {
          text = fs.readFileSync(absolute, 'utf8');
        } catch {
          continue;
        }
        if (text.length > 400_000) continue;
        const { meta } = parseFrontMatter(text);
        const title =
          (typeof meta.title === 'string' && meta.title) ||
          String(meta.title || '') ||
          entry.name.replace(/\.md$/, '').replace(/-/g, ' ');
        items.push({
          id: `${source}:${relative}`,
          source,
          sourceLabel: source === 'general' ? 'General hub' : 'Sensitive hub',
          path: relative,
          kind:
            relative.startsWith('docs/') || relative.startsWith('workflows/') || relative.startsWith('agents/')
              ? 'policy'
              : INCLUDE_ROOT_FILES.includes(relative)
                ? 'guide'
                : 'knowledge',
          title: unquote(title),
          summary: unquote(meta.summary || ''),
          category: unquote(meta.category || (source === 'sensitive' ? 'sensitive' : 'hub')),
          tags: Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : [],
          status: unquote(meta.status || 'undeclared'),
          sourceRef: unquote(meta.source || ''),
          verifiedBy: unquote(meta.verified_by || ''),
          createdAt: unquote(meta.created_at || ''),
          lastVerifiedAt: unquote(meta.last_verified_at || ''),
          capturedBy: unquote(meta.captured_by || ''),
          size: text.length,
        });
      }
    }
  };
  walk(root, '');
  return items;
}

function buildInventory() {
  const items = [];
  for (const source of roots()) items.push(...collectDocs(source.id, source.root));

  const membersFile = readJson(path.join(KB_ROOT, 'members/members.json'));
  const rbacFile = readJson(path.join(KB_ROOT, 'config/rbac.json'));
  const hubConfig = readJson(path.join(KB_ROOT, 'config/kb.json'));
  const members = (membersFile?.members || []).map((member) => ({
    login: member.github || member.id,
    display: member.display || member.id || member.github,
    role: member.role,
    status: member.status || 'unknown',
    scopes: Array.isArray(member.scopes) ? member.scopes : [],
    joined: member.joined || '',
  }));

  const permissionCounts = {};
  const roleScopes = {};
  for (const [role, permissions] of Object.entries(rbacFile?.roles || {})) {
    const list = Array.isArray(permissions) ? permissions : [];
    permissionCounts[role] = list.length;
    roleScopes[role] = list;
  }

  const counts = {
    total: items.length,
    knowledge: items.filter((item) => item.kind === 'knowledge').length,
    policy: items.filter((item) => item.kind === 'policy').length,
    guide: items.filter((item) => item.kind === 'guide').length,
    verified: items.filter((item) => item.status === 'verified' || item.status === 'approved').length,
    proposed: items.filter((item) => item.status === 'proposed').length,
    general: items.filter((item) => item.source === 'general').length,
    sensitive: items.filter((item) => item.source === 'sensitive').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    roots: roots().map(({ id, label }) => ({ id, label })),
    items,
    counts,
    members,
    permissionCounts,
    roleScopes,
    knownScopes: Array.isArray(hubConfig?.known_scopes) ? hubConfig.known_scopes : [],
    sensitiveCategories: rbacFile?.sensitive_categories || [],
    sensitivePrefixes: rbacFile?.sensitive_path_prefixes || [],
  };
}

function resolveDocument(source, relative) {
  const rootEntry = roots().find((item) => item.id === source);
  if (!rootEntry || typeof relative !== 'string') return null;
  const normalized = relative.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.endsWith('.md') || !isIncludedPath(normalized)) return null;
  const absolute = path.resolve(rootEntry.root, normalized);
  const boundary = rootEntry.root.endsWith(path.sep) ? rootEntry.root : `${rootEntry.root}${path.sep}`;
  if (!absolute.startsWith(boundary) || !fs.existsSync(absolute)) return null;
  const text = fs.readFileSync(absolute, 'utf8');
  const { meta, body } = parseFrontMatter(text);
  return {
    id: `${source}:${normalized}`,
    source,
    sourceLabel: rootEntry.label,
    path: normalized,
    title: unquote(meta.title || normalized.replace(/\.md$/, '')),
    meta: {
      summary: unquote(meta.summary || ''),
      category: unquote(meta.category || ''),
      tags: Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : [],
      status: unquote(meta.status || 'undeclared'),
      source: unquote(meta.source || ''),
      verifiedBy: unquote(meta.verified_by || ''),
      createdAt: unquote(meta.created_at || ''),
      lastVerifiedAt: unquote(meta.last_verified_at || ''),
      capturedBy: unquote(meta.captured_by || ''),
    },
    body,
  };
}

function json(response, status, payload) {
  const data = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(data);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(request, response, pathname) {
  const relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname).replace(/^\/+/, '');
  const absolute = path.resolve(PUBLIC_ROOT, relative);
  const boundary = PUBLIC_ROOT.endsWith(path.sep) ? PUBLIC_ROOT : `${PUBLIC_ROOT}${path.sep}`;
  if (!absolute.startsWith(boundary) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  const body = fs.readFileSync(absolute);
  response.writeHead(200, {
    'Content-Type': MIME[path.extname(absolute)] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'",
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16 * 1024) {
        reject(new Error('Request body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

function memberOptions(session, members, statuses) {
  const eligible = visibleMembers(members, session.role)
    .map((member) => ({ login: member.github || member.id, role: member.role, status: member.status || 'unknown' }))
    .filter((member) => member.login && statuses.includes(member.status));
  const records = eligible.filter((member) => member.login.toLowerCase() !== String(session.login).toLowerCase());
  return {
    options: records.map((member) => member.login),
    optionLabels: records.map((member) => `${member.login} — ${member.role.replace('_', ' ')} · ${member.status}`),
  };
}

function publicCommand(command, session, members) {
  const roleOptions = session.role === 'CODE_OWNER' ? [...CODE_OWNER_TARGET_ROLES] : ROLES;
  const fields = (command.fields || []).map((entry) => {
    if (entry.name === 'role') return { ...entry, options: roleOptions, default: 'MEMBER' };
    if (entry.name === 'login' && command.targetStatuses) {
      return { ...entry, type: 'enum', ...memberOptions(session, members, command.targetStatuses), placeholder: 'Choose a member…' };
    }
    return entry;
  });
  return {
    id: command.id,
    label: command.label,
    group: command.group,
    description: command.description,
    mutating: Boolean(command.mutating),
    targetAction: command.targetAction || null,
    fields,
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/session') {
      return json(response, 200, getSession(url.searchParams.get('fresh') === '1'));
    }
    const session = getSession();
    if (!session.allowed) return json(response, 403, { error: 'Owner role required', role: session.role });

    try {
      if (pathname === '/api/inventory') return json(response, 200, filterInventoryForRole(buildInventory(), session.role));
      if (pathname === '/api/commands') {
        const members = readJson(path.join(KB_ROOT, 'members/members.json'))?.members || [];
        return json(response, 200, { commands: COMMANDS.map((command) => publicCommand(command, session, members)) });
      }
      if (request.method === 'POST' && pathname.startsWith('/api/commands/')) {
        const id = decodeURIComponent(pathname.slice('/api/commands/'.length));
        const command = COMMANDS.find((item) => item.id === id);
        if (!command) return json(response, 404, { error: 'Unknown command' });
        if (request.headers['x-kconsole'] !== '1') return json(response, 400, { error: 'Console header required' });
        if (!String(request.headers['content-type'] || '').startsWith('application/json')) {
          return json(response, 400, { error: 'JSON body required' });
        }
        const body = await readJsonBody(request);
        const invalid = validateValues(command, body.values);
        if (invalid) return json(response, 400, { error: invalid });
        if (command.id === 'memberAdd') {
          const denied = assertTargetAllowed(session, { ...body.values, action: 'add' }, { role: body.values.role });
          if (denied) return json(response, 403, { error: denied });
        }
        if (command.targetAction) {
          const members = readJson(path.join(KB_ROOT, 'members/members.json'))?.members || [];
          const member = members.find((item) => (item.github || item.id) === body.values.login);
          const denied = assertTargetAllowed(session, { ...body.values, action: command.targetAction, targetStatuses: command.targetStatuses }, member);
          if (denied) return json(response, 403, { error: denied });
        }
        const result = runKb(buildArgv(command, body.values));
        return json(response, 200, { id, ...result });
      }
      if (pathname === '/api/document') {
        const document = resolveDocument(url.searchParams.get('source'), url.searchParams.get('path'));
        return document ? json(response, 200, document) : json(response, 404, { error: 'Document not found' });
      }
      return json(response, 404, { error: 'Unknown endpoint' });
    } catch (error) {
      return json(response, 500, { error: String(error.message || error).slice(0, 200) });
    }
  }

  return serveStatic(request, response, pathname);
});

module.exports = {
  ROLE_RANK,
  visibleRoles,
  visibleMembers,
  filterInventoryForRole,
  runKb,
  getSession,
  kbInvocation,
  cmdText,
  quoteCmdArg,
  redactOutput,
  COMMANDS,
  buildArgv,
  validateValues,
  assertTargetAllowed,
  publicCommand,
  buildInventory,
  browserCommand,
  shouldOpenBrowser,
  handleServerError,
  server,
};

if (require.main === module) {
  const url = `http://${HOST}:${PORT}`;
  server.on('error', (error) => {
    if (!handleServerError(error, url)) process.exitCode = 1;
  });
  server.listen(PORT, HOST, () => {
    console.log(`AI Knowledge Console running at ${url}`);
    console.log(`Hub:   ${KB_ROOT}`);
    console.log(`Sensitive: ${fs.existsSync(SENSITIVE_ROOT) ? SENSITIVE_ROOT : 'not present'}`);
    openBrowser(url);
  });
}
