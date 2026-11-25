'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const PORT = Number(process.env.PORT || 4310);
const HOST = process.env.HOST || '127.0.0.1';
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

let sessionCache = null;
let sessionCachedAt = 0;
const SESSION_TTL = 60_000;

function getSession(force = false) {
  if (!force && sessionCache && Date.now() - sessionCachedAt < SESSION_TTL) return sessionCache;
  let next;
  try {
    const output = execFileSync('kb', ['whoami'], {
      cwd: KB_ROOT,
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
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
  const activeMembers = (membersFile?.members || [])
    .filter((member) => member.status === 'active')
    .map((member) => ({
      login: member.github || member.id,
      display: member.display || member.id || member.github,
      role: member.role,
      joined: member.joined || '',
    }));

  const permissionCounts = {};
  for (const [role, permissions] of Object.entries(rbacFile?.roles || {})) {
    permissionCounts[role] = Array.isArray(permissions) ? permissions.length : 0;
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
    members: activeMembers,
    permissionCounts,
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

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/session') {
      return json(response, 200, getSession(url.searchParams.get('fresh') === '1'));
    }
    const session = getSession();
    if (!session.allowed) return json(response, 403, { error: 'Owner role required', role: session.role });

    try {
      if (pathname === '/api/inventory') return json(response, 200, buildInventory());
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

server.listen(PORT, HOST, () => {
  console.log(`AI Knowledge Console running at http://${HOST}:${PORT}`);
  console.log(`Hub:   ${KB_ROOT}`);
  console.log(`Sensitive: ${fs.existsSync(SENSITIVE_ROOT) ? SENSITIVE_ROOT : 'not present'}`);
});
