'use strict';

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  command: '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
};

const PERMISSION_GROUPS = [
  {
    prefixes: ['agent.', 'automation.', 'command_registry.', 'system_prompts.'],
    label: 'Agent & automation',
    description: 'Discover commands, call models, tools and integrations, run workflows, and manage runtime or prompts.',
  },
  {
    prefixes: ['knowledge.'],
    label: 'Knowledge & maintenance',
    description: 'Read, use, write and delete knowledge, including sensitive content and maintenance tasks.',
  },
  {
    prefixes: ['repository.', 'sync.'],
    label: 'Repository & sync',
    description: 'Clone, read, write, publish and restore repositories, and sync content between them.',
  },
  {
    prefixes: ['contribution.'],
    label: 'Contributions',
    description: 'Submit contributions and review, approve, merge or reject exceptions.',
  },
  {
    prefixes: ['members.', 'code_owners.', 'collaborators.', 'super_owners.', 'ownership.'],
    label: 'People & ownership',
    description: 'Read and manage members, owners and collaborators, and transfer ownership.',
  },
  {
    prefixes: ['rbac.', 'security.', 'policies.', 'rules.', 'audit_logs.'],
    label: 'Governance & security',
    description: 'Read policies, rules and audit logs; manage roles, permissions and security settings.',
  },
  {
    prefixes: ['personal.'],
    label: 'Personal config',
    description: 'Use personal configuration.',
  },
  {
    prefixes: [],
    label: 'Other',
    description: 'Permissions outside the known families.',
  },
];

function groupPermissions(permissions) {
  const buckets = PERMISSION_GROUPS.map((group) => ({ ...group, permissions: [] }));
  for (const permission of [...permissions].sort()) {
    const bucket = buckets.find((candidate) => candidate.prefixes.some((prefix) => permission.startsWith(prefix))) || buckets[buckets.length - 1];
    bucket.permissions.push(permission);
  }
  return buckets.filter((bucket) => bucket.permissions.length > 0);
}

const state = {
  session: null,
  inventory: null,
  filters: { query: '', kind: 'all', status: 'all', source: 'all', category: 'all', sort: 'title' },
  showAll: false,
  commands: [],
  results: {},
  detailLogin: null,
  openDoc: null,
  paletteOpen: false,
  paletteIndex: 0,
  paletteMatches: [],
};

const view = document.getElementById('view');
const palette = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input');
const paletteResults = document.getElementById('palette-results');
const memberDialog = document.getElementById('member-dialog');
const memberDialogBody = document.getElementById('member-dialog-body');
const commandDialog = document.getElementById('command-dialog');
const commandDialogBody = document.getElementById('command-dialog-body');
const roleDialog = document.getElementById('role-dialog');
const roleDialogBody = document.getElementById('role-dialog-body');
const SCOPE_PATTERN = /^(?:(?:company|federated):[A-Za-z0-9._-]+|project:[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)$/;

function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
}

function icon(name) {
  return `<span class="nav-icon">${iconSvg(name)}</span>`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hydrateIcons(root = document) {
  root.querySelectorAll('.nav-icon').forEach((node) => {
    if (!node.dataset.hydrated) {
      node.innerHTML = iconSvg(node.dataset.icon || 'file');
      node.dataset.hydrated = '1';
    }
  });
}

async function api(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { error: `Invalid response (${response.status})` };
  }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

async function post(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-KConsole': '1', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { error: `Invalid response (${response.status})` };
  }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function toast(message, type = 'info') {
  const stack = document.getElementById('toast-stack');
  const node = document.createElement('div');
  node.className = `toast${type === 'error' ? ' error' : ''}`;
  node.innerHTML = `<i></i><span>${esc(message)}</span>`;
  stack.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateX(30px)';
    setTimeout(() => node.remove(), 300);
  }, 3200);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('kcos-theme', theme);
  const button = document.getElementById('theme-button');
  button.dataset.icon = theme === 'dark' ? 'moon' : 'sun';
  button.innerHTML = icon(button.dataset.icon);
  button.dataset.hydrated = '1';
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/');
  if (parts[0] === 'doc' && parts[1]) return { name: 'doc', id: decodeURIComponent(parts.slice(1).join('/')) };
  return { name: parts[0] || 'dashboard' };
}

function navigate(path) {
  if (location.hash === `#/${path}`) render();
  else location.hash = `#/${path}`;
}

function openDoc(id) {
  navigate(`doc/${encodeURIComponent(id)}`);
}

function docSection(id) {
  const item = (state.inventory?.items || []).find((entry) => entry.id === id);
  return item?.kind === 'policy' ? 'policies' : 'library';
}

function markNav(name, id) {
  const section = name === 'doc' ? docSection(id) : name;
  document.querySelectorAll('.nav-item[data-route]').forEach((item) => {
    item.classList.toggle('active', item.dataset.route === section);
  });
}

function badge(item) {
  const status = String(item.status || 'undeclared').toLowerCase();
  const statusClass = status === 'verified' || status === 'approved' ? 'verified' : status === 'proposed' ? 'proposed' : '';
  const sourceClass = item.source === 'sensitive' ? 'sensitive' : item.kind === 'policy' ? 'policy' : '';
  return `<span class="badge ${statusClass}">${esc(item.status)}</span>` +
    (sourceClass ? `<span class="badge ${sourceClass}">${item.source === 'sensitive' ? 'restricted' : item.kind}</span>` : '');
}

function docCard(item, index = 0) {
  return `<article class="doc-card" data-doc="${esc(item.id)}" style="animation-delay:${Math.min(index, 12) * 0.03}s">
    <div class="doc-top">${badge(item)}<span class="doc-source">${esc(item.sourceLabel)}</span></div>
    <h4>${esc(item.title)}</h4>
    <p>${esc(item.summary || 'No summary provided for this document.')}</p>
    <div class="doc-foot">
      <span class="tag">${esc(item.category)}</span>
      ${(item.tags || []).slice(0, 2).map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}
      <span class="doc-open">Open →</span>
    </div>
  </article>`;
}

function bars(entries, total) {
  const max = Math.max(1, ...entries.map((entry) => entry.value));
  return entries.map((entry) => `<div class="bar-row">
    <span>${esc(entry.label)}</span>
    <span class="bar-track"><i class="bar-fill" style="width:${Math.max(3, Math.round((entry.value / max) * 100))}%;--bar:${entry.color || ''};background:${entry.color ? `linear-gradient(90deg, ${entry.color}, ${entry.color}aa)` : ''}"></i></span>
    <span class="bar-value">${entry.value}</span>
  </div>`).join('') + `<div style="margin-top:10px;font-size:10px;color:var(--text-muted)">${total} documents indexed</div>`;
}

function renderDashboard() {
  const { counts, items } = state.inventory;
  const members = state.inventory.members.filter((member) => member.status === 'active');
  const roles = Object.keys(state.inventory.roleScopes || state.inventory.permissionCounts || {});
  const recent = [...items]
    .filter((item) => item.status === 'verified' || item.status === 'approved')
    .sort((a, b) => String(b.lastVerifiedAt || b.createdAt).localeCompare(String(a.lastVerifiedAt || a.createdAt)))
    .slice(0, 6);
  const categories = Object.entries(items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const statusCounts = {
    verified: items.filter((item) => item.status === 'verified').length,
    approved: items.filter((item) => item.status === 'approved').length,
    proposed: items.filter((item) => item.status === 'proposed').length,
    other: items.filter((item) => !['verified', 'approved', 'proposed'].includes(item.status)).length,
  };

  return `
    <section class="hero">
      <span class="hero-badge">${icon('sparkles')} ${esc(state.session.role.replace('_', ' '))} access</span>
      <h2>Your knowledge, <em>finally legible.</em></h2>
      <p>Every verified lesson, rule and policy from the canonical hub — searchable, readable and gated to owners. No command memorisation required.</p>
      <div class="hero-actions">
        <button class="primary-button" data-action="go-library">${icon('book')} Browse knowledge</button>
        <button class="ghost-button" data-action="open-palette">${icon('search')} Quick find <kbd>⌘K</kbd></button>
      </div>
    </section>

    <section class="stats-grid">
      <div class="stat-card" style="--tint:var(--accent)"><div class="stat-label">${icon('database')} Documents</div><div class="stat-value" data-count="${counts.total}">0</div><div class="stat-foot">across ${state.inventory.roots.length} authorised repositories</div></div>
      <div class="stat-card" style="--tint:var(--success)"><div class="stat-label">${icon('check')} Verified</div><div class="stat-value" data-count="${counts.verified}">0</div><div class="stat-foot">${Math.round((counts.verified / Math.max(1, counts.total)) * 100)}% of the library</div></div>
      <div class="stat-card" style="--tint:var(--accent-2)"><div class="stat-label">${icon('shield')} Rules &amp; policies</div><div class="stat-value" data-count="${counts.policy}">0</div><div class="stat-foot">governance, process and RBAC</div></div>
      <div class="stat-card" style="--tint:var(--accent-3)"><div class="stat-label">${icon('lock')} Restricted</div><div class="stat-value" data-count="${counts.sensitive}">0</div><div class="stat-foot">sensitive hub documents</div></div>
    </section>

    <section class="panel-grid">
      <div class="panel">
        <h4>Confidence profile</h4>
        ${bars([
          { label: 'Verified', value: statusCounts.verified, color: 'var(--success)' },
          { label: 'Approved', value: statusCounts.approved, color: 'var(--accent-2)' },
          { label: 'Proposed', value: statusCounts.proposed, color: 'var(--warning)' },
          { label: 'Other', value: statusCounts.other, color: 'var(--text-muted)' },
        ], counts.total)}
      </div>
      <div class="panel">
        <h4>Top categories</h4>
        ${categories.map(([label, value]) => `<div class="bar-row"><span>${esc(label)}</span><span class="bar-track"><i class="bar-fill" style="width:${Math.max(6, Math.round((value / categories[0][1]) * 100))}%"></i></span><span class="bar-value">${value}</span></div>`).join('')}
      </div>
      <div class="panel">
        <h4>Latest verified knowledge</h4>
        <div class="mini-list">
          ${recent.map((item) => `<div class="mini-item" data-doc="${esc(item.id)}"><span class="dot"></span><span>${esc(item.title)}</span><small>${esc(item.category)}</small></div>`).join('') || '<div class="palette-empty">No verified documents yet.</div>'}
        </div>
      </div>
    </section>

    <div class="section-title"><h3>Active owners</h3><span>${members.length} active members in the canonical roster</span></div>
    <section class="access-grid">
      ${roles.map((role, index) => {
        const list = members.filter((member) => member.role === role);
        return `<div class="role-card" style="animation-delay:${index * 0.08}s">
          <span class="role-number">${list.length}</span>
          <div class="role-icon">${icon(role.includes('SUPER') ? 'lock' : role.includes('CODE') ? 'shield' : 'users')}</div>
          <h4>${esc(role.replace('_', ' '))}</h4>
          <p>${list.length ? esc(list.map((member) => member.login).join(', ')) : 'No active account'}</p>
        </div>`;
      }).join('')}
    </section>`;
}

function filteredItems(forceKind) {
  const { query, kind, status, source, category, sort } = state.filters;
  const needle = query.trim().toLowerCase();
  const items = state.inventory.items.filter((item) => {
    if (forceKind && item.kind !== forceKind) return false;
    if (kind !== 'all' && item.kind !== kind) return false;
    if (status !== 'all' && item.status !== status) return false;
    if (source !== 'all' && item.source !== source) return false;
    if (category !== 'all' && item.category !== category) return false;
    if (needle) {
      const haystack = `${item.title} ${item.summary} ${item.category} ${(item.tags || []).join(' ')} ${item.path}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
  items.sort((a, b) => {
    if (sort === 'status') return a.status.localeCompare(b.status) || a.title.localeCompare(b.title);
    if (sort === 'recent') return String(b.lastVerifiedAt || b.createdAt).localeCompare(String(a.lastVerifiedAt || a.createdAt));
    if (sort === 'category') return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });
  return items;
}

function renderLibrary(forceKind, compact = false) {
  const categories = [...new Set(state.inventory.items.map((item) => item.category))].sort();
  const items = filteredItems(forceKind);
  const shown = state.showAll ? items : items.slice(0, 72);
  const title = forceKind === 'policy' ? 'Rules & policies' : 'Knowledge library';
  const subtitle = forceKind === 'policy'
    ? 'Governance documents, operating rules, permissions and process — written for humans.'
    : 'One idea per document, with status, evidence and provenance kept beside the reading.';

  return `
    ${compact ? '' : `<header class="page-head">
      <div><span class="eyebrow">Canonical hub</span><h1>${title}</h1><p>${subtitle}</p></div>
      <button class="ghost-button" data-action="open-palette">${icon('command')} Command palette</button>
    </header>`}

    <section class="toolbar">
      <label class="search-field">${icon('search')}<input id="library-search" type="search" placeholder="Search titles, summaries, tags, paths…" value="${esc(state.filters.query)}" /></label>
      <div class="filter-group" data-filter="kind">
        ${['all', 'knowledge', 'policy', 'guide'].map((value) => `<button class="filter-chip ${state.filters.kind === value ? 'active' : ''}" data-value="${value}">${value === 'all' ? 'All' : value}</button>`).join('')}
      </div>
      <div class="filter-group" data-filter="status">
        ${['all', 'verified', 'proposed'].map((value) => `<button class="filter-chip ${state.filters.status === value ? 'active' : ''}" data-value="${value}">${value === 'all' ? 'Any status' : value}</button>`).join('')}
      </div>
      <select class="select-field" id="source-filter">
        <option value="all">All sources</option>
        ${state.inventory.roots.map((root) => `<option value="${root.id}" ${state.filters.source === root.id ? 'selected' : ''}>${esc(root.label)}</option>`).join('')}
      </select>
      <select class="select-field" id="category-filter">
        <option value="all">All categories</option>
        ${categories.map((category) => `<option value="${esc(category)}" ${state.filters.category === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}
      </select>
      <select class="select-field" id="sort-filter">
        ${['title', 'recent', 'status', 'category'].map((value) => `<option value="${value}" ${state.filters.sort === value ? 'selected' : ''}>Sort: ${value}</option>`).join('')}
      </select>
    </section>

    <p class="results-meta">Showing ${shown.length} of ${items.length} matching documents · generated ${new Date(state.inventory.generatedAt).toLocaleTimeString()}</p>
    ${shown.length ? `<section class="doc-grid">${shown.map(docCard).join('')}</section>` : stateBox('search', 'Nothing matched that filter', 'Clear a filter or try a broader term. The library is indexed from the live hub every time you open the console.')}
    ${items.length > 72 ? `<div style="margin-top:22px;text-align:center"><button class="ghost-button" data-action="toggle-all">${state.showAll ? 'Show fewer' : `Show all ${items.length}`}</button></div>` : ''}`;
}

function stateBox(iconName, title, text) {
  return `<div class="state-box"><div class="state-icon">${icon(iconName)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}

function safeHref(url) {
  try {
    const parsed = new URL(url, location.href);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : '#';
  } catch {
    return '#';
  }
}

function renderMarkdown(source) {
  const lines = source.replace(/\r/g, '').split('\n');
  const headings = [];
  const output = [];
  let index = 0;

  const inline = (text) => esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => `<a href="${esc(safeHref(href))}" target="_blank" rel="noopener">${label}</a>`);

  const slug = (text) => text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

  while (index < lines.length) {
    const line = lines[index];

    if (/^```/.test(line)) {
      const language = line.slice(3).trim();
      const buffer = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        buffer.push(lines[index]);
        index += 1;
      }
      index += 1;
      output.push(`<pre><code class="language-${esc(language)}">${esc(buffer.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].replace(/[*`]/g, '').trim();
      const id = slug(text) || `section-${headings.length + 1}`;
      headings.push({ level, text, id });
      output.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      output.push('<hr/>');
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buffer = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        buffer.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      output.push(`<blockquote>${inline(buffer.join(' '))}</blockquote>`);
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? 'ol' : 'ul';
      const buffer = [];
      while (index < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[index])) {
        buffer.push(lines[index].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
        index += 1;
      }
      output.push(`<${tag}>${buffer.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[index + 1])) {
      const cells = (row) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim());
      const header = cells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      output.push(`<table><thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+\.)\s|^(---|\*\*\*|___)\s*$)/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    else index += 1;
  }

  return { html: output.join('\n'), headings };
}

async function renderDoc(id) {
  const previousScroll = view.querySelector('.split-list')?.scrollTop || 0;
  const section = docSection(id);
  try {
    if (!state.openDoc || state.openDoc.id !== id) {
      view.innerHTML = '<div class="loading-state"><div class="skeleton skeleton-hero"></div></div>';
      const separator = id.indexOf(':');
      const source = id.slice(0, separator);
      const docPath = id.slice(separator + 1);
      const document = await api(`/api/document?source=${encodeURIComponent(source)}&path=${encodeURIComponent(docPath)}`);
      const rendered = renderMarkdown(document.body);
      const meta = document.meta;
      state.openDoc = {
        id,
        html: `
          <div class="reader-layout">
            <article class="reader-main">
              <div class="breadcrumb">
                <button data-action="go-back">${section === 'policies' ? 'Rules & policies' : 'Library'}</button><span>/</span><span>${esc(document.sourceLabel)}</span><span>/</span><span>${esc(docPath)}</span>
              </div>
              <h1>${esc(document.title)}</h1>
              <p class="reader-summary">${esc(meta.summary || 'Read the full document below.')}</p>
              <div class="meta-strip">
                <span class="badge ${['verified', 'approved'].includes(meta.status) ? 'verified' : meta.status === 'proposed' ? 'proposed' : ''}">${esc(meta.status)}</span>
                <span class="meta-item"><strong>Category</strong> ${esc(meta.category || '—')}</span>
                ${document.source === 'sensitive' ? '<span class="badge sensitive">restricted</span>' : ''}
                ${meta.lastVerifiedAt ? `<span class="meta-item"><strong>Verified</strong> ${esc(meta.lastVerifiedAt)}</span>` : ''}
                ${meta.createdAt ? `<span class="meta-item"><strong>Created</strong> ${esc(meta.createdAt)}</span>` : ''}
                ${(meta.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}
              </div>
              ${meta.verifiedBy ? `<blockquote><strong>Evidence:</strong> ${esc(meta.verifiedBy)}</blockquote>` : ''}
              <div class="markdown">${rendered.html}</div>
              <div style="margin-top:34px;display:flex;gap:10px;flex-wrap:wrap">
                <button class="ghost-button" data-action="copy-link">${icon('copy')} Copy link</button>
                <button class="ghost-button" data-action="go-back">${icon('arrow-left')} Back to list</button>
              </div>
            </article>
            <aside class="toc">
              <h4>On this page</h4>
              ${rendered.headings.length ? rendered.headings.map((heading) => `<button type="button" data-toc="${esc(heading.id)}" class="${heading.level > 2 ? 'nested' : ''}">${esc(heading.text)}</button>`).join('') : '<div style="font-size:11px;color:var(--text-muted)">No headings in this document.</div>'}
              ${meta.source ? `<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border);font-size:10px;color:var(--text-muted)">Source: ${esc(meta.source)}</div>` : ''}
            </aside>
          </div>`,
      };
    }
    view.innerHTML = `<div class="split-view">
      <section class="split-list">
        <div class="split-list-head"><h3>${section === 'policies' ? 'Rules & policies' : 'Knowledge'}</h3><span>Choose another document</span></div>
        ${renderLibrary(section === 'policies' ? 'policy' : undefined, true)}
      </section>
      <section class="split-reader">${state.openDoc.html}</section>
    </div>`;
    const list = view.querySelector('.split-list');
    if (list) list.scrollTop = previousScroll;
  } catch (error) {
    state.openDoc = null;
    view.innerHTML = stateBox('x', 'Could not open that document', error.message);
  }
}

const ROLE_RANK = { SUPER_OWNER: 4, CODE_OWNER: 3, COLLABORATOR: 2, MEMBER: 1 };

function commandField(spec, fieldOptions = {}) {
  const label = esc(spec.label);
  if (spec.type === 'boolean') {
    return `<label class="field-row check"><input type="checkbox" name="${esc(spec.name)}" ${spec.default ? 'checked' : ''}/><span>${label}</span></label>`;
  }
  if (spec.name === 'scope' && Array.isArray(fieldOptions.scopeOptions)) {
    const options = fieldOptions.scopeOptions;
    return `<label class="field-row"><span>${label}</span>
      <select name="scope" data-scope-select>
        <option value="">Choose a scope…</option>
        ${options.map((option) => `<option value="${esc(option)}">${esc(option)}</option>`).join('')}
        <option value="__other">Other…</option>
      </select>
      <input class="scope-custom" data-scope-custom type="text" name="scope-custom" placeholder="${esc(spec.placeholder || 'company:my-team')}" hidden/>
    </label>`;
  }
  if (spec.type === 'enum') {
    return `<label class="field-row"><span>${label}</span><select name="${esc(spec.name)}">${(spec.options || []).map((option) => `<option value="${esc(option)}" ${option === spec.default ? 'selected' : ''}>${esc(option.replace('_', ' '))}</option>`).join('')}</select></label>`;
  }
  const type = spec.type === 'date' ? 'date' : spec.type === 'number' ? 'number' : 'text';
  const placeholder = spec.placeholder ? ` placeholder="${esc(spec.placeholder)}"` : '';
  return `<label class="field-row"><span>${label}</span><input type="${type}" name="${esc(spec.name)}" value="${esc(spec.default || '')}"${placeholder}/></label>`;
}

function commandForm(command, options = {}) {
  const fields = (command.fields || []).map((spec) => {
    if (spec.name === 'role' && state.session.role === 'CODE_OWNER') {
      return { ...spec, options: ['COLLABORATOR', 'MEMBER'], default: 'COLLABORATOR' };
    }
    return spec;
  });
  return `<form class="command-card" data-command="${esc(command.id)}">
    <div class="command-card-head"><h4>${esc(command.label)}</h4><span class="badge ${command.mutating ? 'proposed' : 'policy'}">${command.mutating ? 'changes hub' : 'read only'}</span></div>
    <p>${esc(command.description)}</p>
    <div class="field-grid">
      ${options.login ? `<input type="hidden" name="login" value="${esc(options.login)}"/>` : ''}
      ${fields.filter((spec) => spec.name !== 'login' || !options.login).map((spec) => commandField(spec, spec.name === 'scope' && Array.isArray(options.scopeOptions) ? { scopeOptions: options.scopeOptions } : {})).join('')}
    </div>
    ${command.mutating ? `<label class="confirm-row"><input type="checkbox" name="confirm"/><span>I understand this command changes the hub.</span></label>` : ''}
    <div class="command-actions"><button class="primary-button" type="submit">${icon('command')} Run ${esc(command.label)}</button></div>
    <div id="result-${esc(command.id)}">${resultPanel(command.id)}</div>
  </form>`;
}

function resultPanel(id) {
  const result = state.results[id];
  if (!result) return '';
  return `<div class="result-panel${result.ok ? '' : ' failed'}">
    <div class="result-head"><code>${esc(result.command)}</code><span>exit ${result.exitCode} · ${result.durationMs} ms</span></div>
    ${result.stdout ? `<pre>${esc(result.stdout)}</pre>` : ''}
    ${result.stderr ? `<pre class="result-error">${esc(result.stderr)}</pre>` : ''}
  </div>`;
}

function renderAccess() {
  const { members, permissionCounts, roleScopes } = state.inventory;
  const roles = Object.keys(roleScopes || permissionCounts);
  const descriptions = {
    SUPER_OWNER: 'Full control, including ownership, security settings and sensitive knowledge.',
    CODE_OWNER: 'Reviews protected paths and manages members and collaborators.',
    COLLABORATOR: 'Contributes by pull request and reads authorised knowledge.',
    MEMBER: 'Read-only access to general knowledge through the CLI.',
  };

  return `
    <header class="page-head">
      <div><span class="eyebrow">Governance</span><h1>Access &amp; roles</h1><p>Roles and scopes are read from the canonical roster. Changes run as the verified hub identity and require confirmation.</p></div>
      <span class="role-chip authorized"><i></i><span>${esc(state.session.role.replace('_', ' '))} session</span></span>
    </header>

    <section class="access-grid">
      ${roles.map((role, index) => `<div class="role-card" style="animation-delay:${index * 0.06}s">
        <span class="role-number">${permissionCounts[role] || 0}</span>
        <div class="role-icon">${icon(role.includes('SUPER') ? 'lock' : role.includes('CODE') ? 'shield' : 'users')}</div>
        <h4>${esc(role.replace('_', ' '))}</h4>
        <p>${esc(descriptions[role] || 'Custom role.')}</p>
        <button class="ghost-button" type="button" data-role-perms="${esc(role)}">View permissions</button>
      </div>`).join('')}
    </section>

    <div class="section-title"><h3>People</h3><span>${members.filter((member) => member.status === 'active').length} active · ${members.length} total visible</span></div>
    <section class="panel" style="padding:6px 18px;animation-delay:.2s">
      <table class="data-table">
        <thead><tr><th>Account</th><th>Display name</th><th>Role</th><th>Status</th><th>Scopes</th><th>Joined</th><th></th></tr></thead>
        <tbody>${members.map((member) => `<tr><td>${esc(member.login)}</td><td>${esc(member.display)}</td><td>${esc(member.role.replace('_', ' '))}</td><td><span class="badge ${member.status === 'active' ? 'verified' : ''}">${esc(member.status)}</span></td><td>${scopesCount(member, roleScopes)}</td><td>${esc(member.joined || '—')}</td><td><button class="ghost-button" type="button" data-detail="${esc(member.login)}">Details</button></td></tr>`).join('')}</tbody>
      </table>
    </section>

    <div class="section-title"><h3>Sensitive surface</h3><span>Why this console is owner-only</span></div>
    <section class="panel-grid">
      <div class="panel"><h4>Protected categories</h4><div class="mini-list">${(state.inventory.sensitiveCategories || []).map((category) => `<div class="mini-item"><span class="dot"></span><span>${esc(category)}</span></div>`).join('')}</div></div>
      <div class="panel"><h4>Protected paths</h4><div class="mini-list">${(state.inventory.sensitivePrefixes || []).map((prefix) => `<div class="mini-item"><span class="dot"></span><span>${esc(prefix)}</span></div>`).join('')}</div></div>
      <div class="panel"><h4>Enforcement</h4><p style="font-size:11.5px;color:var(--text-soft);margin:0">Every API request is checked against the role reported by <code>kb whoami</code> in the canonical clone. No knowledge is stored in this repository.</p></div>
    </section>`;
}

function scopesCount(member, roleScopes) {
  return (roleScopes[member.role] || []).length + member.scopes.length;
}

async function refreshInventory() {
  state.inventory = await api('/api/inventory');
  state.openDoc = null;
  return state.inventory;
}

async function refreshMemberAfterCommand(login) {
  await refreshInventory();
  showMemberDialog(login);
}

function clearTargetResults() {
  for (const command of state.commands) {
    if (command.targetAction) delete state.results[command.id];
  }
}

function anyDialogOpen() {
  return ['member-dialog', 'command-dialog', 'role-dialog'].some((id) => document.getElementById(id)?.open);
}

function bindDialog(dialog, closeFn) {
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-action^="close-"]') || event.target === dialog) closeFn();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeFn();
  });
  dialog.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-command]');
    if (!form) return;
    event.preventDefault();
    runCommand(form);
  });
}

function openCommandDialog(commandId) {
  const command = state.commands.find((item) => item.id === commandId);
  if (!command) return;
  commandDialogBody.innerHTML = `
    <div class="dialog-head">
      <span class="eyebrow">Hub operations</span>
      <h3 id="command-dialog-title">${esc(command.label)}</h3>
      <p>${esc(command.description)}</p>
    </div><div class="command-grid">${commandForm(command)}</div>`;
  if (!commandDialog.open) commandDialog.showModal();
}

function closeCommandDialog() {
  if (commandDialog.open) commandDialog.close();
}

function openRoleDialog(role) {
  const permissions = state.inventory.roleScopes?.[role];
  if (!Array.isArray(permissions)) return;
  const label = role.replace('_', ' ');
  const groups = groupPermissions(permissions);
  roleDialogBody.innerHTML = `
    <div class="dialog-head">
      <span class="eyebrow">Role permissions</span>
      <h3 id="role-dialog-title">${esc(label)}</h3>
      <p>${permissions.length} permission${permissions.length === 1 ? '' : 's'} visible in this session.</p>
      <p class="permission-context">Role capability = what this role can do. Scopes control which knowledge it can reach.</p>
    </div>
    <div class="permission-groups">
      ${groups.map((group) => `
        <section class="permission-group">
          <div class="permission-group-head">
            <h4>${esc(group.label)}</h4>
            <span>${group.permissions.length}</span>
          </div>
          <p>${esc(group.description)}</p>
          <div class="permission-chips">${group.permissions.map((permission) => `<code class="permission-chip">${esc(permission)}</code>`).join('')}</div>
        </section>`).join('')}
    </div>`;
  if (!roleDialog.open) roleDialog.showModal();
}

function closeRoleDialog() {
  if (roleDialog.open) roleDialog.close();
}

function showMemberDialog(login) {
  const detail = (state.inventory.members || []).find((member) => member.login === login);
  if (!detail) {
    closeMemberDialog();
    toast('That member is no longer available in this session');
    return;
  }
  if (state.detailLogin !== login) clearTargetResults();
  const scopes = state.inventory.roleScopes?.[detail.role] || [];
  const canAct = state.session.role === 'SUPER_OWNER' || (ROLE_RANK[detail.role] || 0) <= ROLE_RANK.COLLABORATOR;
  const actions = canAct
    ? state.commands.filter((command) => {
      if (!command.targetAction) return false;
      if (detail.status === 'active') return command.id !== 'memberReinstate';
      return detail.status === 'suspended' && command.id === 'memberReinstate';
    })
    : [];
  const knownScopes = (state.inventory.knownScopes || []).filter((scope) => SCOPE_PATTERN.test(scope));
  const scopeOptions = (command) => {
    if (command.id === 'memberGrant') return knownScopes.filter((scope) => !detail.scopes.includes(scope));
    if (command.id === 'memberUngrant') return [...new Set([...detail.scopes, ...knownScopes])];
    return null;
  };

  memberDialogBody.innerHTML = `
    <div class="dialog-head">
      <span class="eyebrow">Member access</span>
      <h3 id="member-dialog-title">${esc(detail.login)}</h3>
      <p>${esc(detail.display)} · ${esc(detail.role.replace('_', ' '))} · ${esc(detail.status)}${detail.joined ? ` · joined ${esc(detail.joined)}` : ''}</p>
    </div>
    <section class="panel detail-panel">
      <div class="scope-block"><h4>Role scopes (${scopes.length})</h4><div class="scope-list">${scopes.map((scope) => `<span class="tag">${esc(scope)}</span>`).join('') || '<span class="results-meta">No scopes recorded.</span>'}</div></div>
      <div class="scope-block"><h4>Extra member scopes (${detail.scopes.length})</h4><div class="scope-list">${detail.scopes.map((scope) => `<span class="tag ${scope.startsWith('company:') ? 'verified' : ''}">${esc(scope)}</span>`).join('') || '<span class="results-meta">No extra scopes.</span>'}</div></div>
      ${actions.length ? `<div class="command-grid">${actions.map((command) => commandForm(command, { login: detail.login, scopeOptions: scopeOptions(command) })).join('')}</div>` : '<p class="results-meta">No changes available for this member in the current session.</p>'}
    </section>`;
  state.detailLogin = login;
  if (!memberDialog.open) memberDialog.showModal();
}

function closeMemberDialog() {
  clearTargetResults();
  state.detailLogin = null;
  if (memberDialog.open) memberDialog.close();
}

function renderOperations() {
  const groups = [
    { key: 'read', title: 'Informative', text: 'Read-only views into the hub and this device.' },
    { key: 'change', title: 'Changes', text: 'Commands with an explicit confirmation step.' },
  ];
  return `
    <header class="page-head">
      <div><span class="eyebrow">Operator console</span><h1>Hub operations</h1><p>Run the same <code>kb</code> commands you use in a terminal, with fixed inputs and visible output.</p></div>
      <button class="ghost-button" type="button" data-action="refresh">${icon('refresh')} Refresh hub data</button>
    </header>
    ${groups.map((group) => {
      const commands = state.commands.filter((command) => command.group === group.key);
      return `<div class="section-title"><h3>${group.title}</h3><span>${group.text}</span></div>
        <section class="command-grid">${commands.map((command) => `<article class="command-card compact-command">
          <div class="command-card-head"><h4>${esc(command.label)}</h4><span class="badge ${command.mutating ? 'proposed' : 'policy'}">${command.mutating ? 'changes hub' : 'read only'}</span></div>
          <p>${esc(command.description)}</p>
          <div class="command-actions"><button class="primary-button" type="button" data-open-command="${esc(command.id)}">${icon('command')} Open</button></div>
        </article>`).join('') || stateBox('command', 'No commands available', 'The command catalog could not be loaded.')}</section>`;
    }).join('')}`;
}

function formValues(form, command) {
  const data = new FormData(form);
  const values = {};
  for (const spec of command.fields || []) {
    if (spec.type === 'boolean') values[spec.name] = data.has(spec.name);
    else if (spec.name === 'scope' && form.querySelector('[data-scope-select]')) {
      const choice = String(data.get('scope') || '');
      values.scope = choice === '__other' ? String(data.get('scope-custom') || '').trim() : choice;
    } else if (data.has(spec.name)) values[spec.name] = String(data.get(spec.name));
  }
  values.confirm = data.has('confirm');
  return values;
}

async function runCommand(form) {
  const command = state.commands.find((item) => item.id === form.dataset.command);
  if (!command) return;
  const values = formValues(form, command);
  if (command.mutating && !values.confirm) {
    toast(`Tick the confirmation box before running ${command.label}`, 'error');
    return;
  }
  if ((command.fields || []).some((spec) => spec.name === 'scope') && !values.scope) {
    toast('Choose a scope or enter a custom one', 'error');
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await post(`/api/commands/${encodeURIComponent(command.id)}`, { values });
    state.results[command.id] = result;
    toast(result.ok ? `${command.label} completed` : `${command.label} exited ${result.exitCode}`, result.ok ? 'info' : 'error');
    if (result.ok && command.mutating) {
      if (form.closest('#member-dialog')) await refreshMemberAfterCommand(values.login);
      else {
        await refreshInventory();
        render();
      }
    }
  } catch (error) {
    state.results[command.id] = {
      ok: false,
      command: `kb ${command.id}`,
      exitCode: '—',
      stdout: '',
      stderr: error.message,
      durationMs: 0,
    };
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
    const panel = document.getElementById(`result-${command.id}`);
    if (panel) panel.innerHTML = resultPanel(command.id);
  }
}

function renderAbout() {
  return `
    <header class="page-head"><div><span class="eyebrow">System</span><h1>About this console</h1><p>A thin, self-hosted view and operator console for the AI knowledge hub.</p></div></header>
    <section class="about-grid">
      <div class="about-card">
        <h4>How it works</h4>
        <p>The local server asks the canonical repository who you are, then exposes only metadata and documents from the two authorised clones. Nothing is cached to disk or copied into this repo.</p>
        <span class="code-line">npm start  →  http://127.0.0.1:4310</span>
      </div>
      <div class="about-card">
        <h4>Access model</h4>
        <ul>
          <li>Only <strong>SUPER_OWNER</strong> and <strong>CODE_OWNER</strong> sessions pass the API gate.</li>
          <li>Roles come from <code>kb whoami</code>, which reads the canonical roster on GitHub.</li>
          <li>CODE_OWNER sees CODE_OWNER peers but cannot change them; SUPER_OWNER sees all members.</li>
          <li>Every change runs as the current <code>kb</code> identity and needs explicit confirmation.</li>
          <li>Sensitive documents are never shipped with this app.</li>
        </ul>
      </div>
      <div class="about-card">
        <h4>Keyboard</h4>
        <ul>
          <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> — command palette</li>
          <li><kbd>1</kbd> — overview, <kbd>2</kbd> — knowledge, <kbd>3</kbd> — policies</li>
          <li><kbd>Esc</kbd> — close palette or sidebar</li>
        </ul>
      </div>
      <div class="about-card">
        <h4>Session</h4>
        <p>Account: <strong>${esc(state.session.login)}</strong><br/>Role: <strong>${esc(state.session.role)}</strong><br/>Privilege label: <strong>${esc(state.session.privilege)}</strong><br/>Indexed at: <strong>${new Date(state.inventory.generatedAt).toLocaleString()}</strong></p>
      </div>
    </section>`;
}

function renderDenied() {
  const role = state.session?.role || 'UNKNOWN';
  const login = state.session?.login || 'unknown account';
  return `<div class="denied">
    <div class="denied-mark">${icon('lock')}</div>
    <h1>Owner access required</h1>
    <p>This console is restricted to Super Owners and Code Owners. The current hub identity is <strong>${esc(login)}</strong> with role <strong>${esc(role)}</strong>.</p>
    <p style="font-size:12px;color:var(--text-muted)">Members and collaborators keep using the <code>kb</code> CLI for the knowledge they are authorised to read. Nothing here was exposed to this session.</p>
  </div>`;
}

function render() {
  const route = parseRoute();
  markNav(route.name, route.id);
  if (!state.session?.allowed) {
    view.innerHTML = renderDenied();
    return;
  }
  if (!state.inventory) return;

  try {
    if (route.name === 'doc') return void renderDoc(route.id);
    if (route.name === 'library') view.innerHTML = renderLibrary();
    else if (route.name === 'policies') view.innerHTML = renderLibrary('policy');
    else if (route.name === 'access') view.innerHTML = renderAccess();
    else if (route.name === 'operations') view.innerHTML = renderOperations();
    else if (route.name === 'about') view.innerHTML = renderAbout();
    else view.innerHTML = renderDashboard();
  } catch (error) {
    view.innerHTML = stateBox('x', 'Rendering failed', error.message);
  }

  if (route.name === 'dashboard') {
    view.querySelectorAll('[data-count]').forEach((node) => {
      const target = Number(node.dataset.count);
      const started = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - started) / 900);
        node.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3))).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}

function updateIdentity() {
  const session = state.session || {};
  const login = session.login || 'unknown';
  document.getElementById('avatar').textContent = login.slice(0, 2).toUpperCase();
  document.getElementById('identity-name').textContent = login;
  document.getElementById('identity-role').textContent = (session.role || 'checking role').replace('_', ' ').toLowerCase();
  const chip = document.getElementById('role-chip');
  chip.classList.toggle('authorized', Boolean(session.allowed));
  chip.querySelector('span').textContent = session.role ? session.role.replace('_', ' ') : 'Verifying';
  document.getElementById('integrity-text').textContent = session.allowed
    ? `Verified as ${login}. Knowledge indexed from ${state.inventory?.items.length || 0} documents.`
    : `Session denied (${session.role || 'unknown'}). No knowledge loaded.`;
  document.getElementById('integrity-bar').style.width = session.allowed ? '100%' : '18%';
}

async function load(force = false) {
  view.innerHTML = '<div class="loading-state"><div class="skeleton skeleton-hero"></div><div class="skeleton-grid"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div></div>';
  try {
    state.session = await api(`/api/session${force ? '?fresh=1' : ''}`);
    state.openDoc = null;
    updateIdentity();
    if (state.session.allowed) {
      const [inventory, catalog] = await Promise.all([api('/api/inventory'), api('/api/commands')]);
      state.inventory = inventory;
      state.commands = catalog.commands || [];
      document.getElementById('nav-knowledge-count').textContent = inventory.counts.knowledge;
      document.getElementById('nav-policy-count').textContent = inventory.counts.policy;
      updateIdentity();
    }
    render();
    if (memberDialog.open && state.detailLogin) showMemberDialog(state.detailLogin);
  } catch (error) {
    state.session = { login: 'offline', role: 'UNAVAILABLE', allowed: false };
    updateIdentity();
    render();
    toast(error.message, 'error');
  }
}

function openPalette() {
  if (!state.session?.allowed || !state.inventory) return;
  state.paletteOpen = true;
  state.paletteIndex = 0;
  palette.hidden = false;
  paletteInput.value = '';
  updatePalette();
  setTimeout(() => paletteInput.focus(), 20);
}

function closePalette() {
  palette.hidden = true;
  state.paletteOpen = false;
}

function updatePalette() {
  const query = paletteInput.value.trim().toLowerCase();
  const pages = [
    { id: '__dashboard', title: 'Overview', summary: 'Go to the dashboard' },
    { id: '__library', title: 'Knowledge library', summary: 'Browse every document' },
    { id: '__policies', title: 'Rules & policies', summary: 'Governance and process' },
    { id: '__access', title: 'Access & roles', summary: 'Canonical roster' },
    { id: '__operations', title: 'Hub operations', summary: 'Informative and change commands' },
  ];
  const docs = state.inventory.items
    .filter((item) => !query || `${item.title} ${item.summary} ${item.category} ${(item.tags || []).join(' ')}`.toLowerCase().includes(query))
    .slice(0, query ? 8 : 5)
    .map((item) => ({ id: item.id, title: item.title, summary: `${item.category} · ${item.sourceLabel}` }));
  state.paletteMatches = [...pages.filter((page) => !query || page.title.toLowerCase().includes(query)), ...docs].slice(0, 9);
  state.paletteIndex = Math.min(state.paletteIndex, Math.max(0, state.paletteMatches.length - 1));

  paletteResults.innerHTML = state.paletteMatches.length
    ? state.paletteMatches.map((match, index) => `<div class="palette-result ${index === state.paletteIndex ? 'selected' : ''}" data-index="${index}">
        <span class="result-icon">${icon(match.id.startsWith('__') ? 'command' : 'file')}</span>
        <span><strong>${esc(match.title)}</strong><small>${esc(match.summary)}</small></span>
      </div>`).join('')
    : '<div class="palette-empty">No matches in the authorised hub.</div>';
}

function choosePalette(index) {
  const match = state.paletteMatches[index];
  if (!match) return;
  closePalette();
  if (match.id.startsWith('__')) navigate(match.id.slice(2));
  else openDoc(match.id);
}

function toggleSidebar(force) {
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  const open = force ?? !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', open);
  scrim.hidden = !open;
}

document.addEventListener('DOMContentLoaded', () => {
  setTheme(localStorage.getItem('kcos-theme') || 'dark');
  hydrateIcons();
  load();

  document.getElementById('theme-button').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('refresh-button').addEventListener('click', async () => {
    await load(true);
    toast('Knowledge re-indexed from the hub');
  });

  document.getElementById('menu-button').addEventListener('click', () => toggleSidebar());
  document.getElementById('scrim').addEventListener('click', () => toggleSidebar(false));

  document.getElementById('identity').addEventListener('click', () => {
    toast(`${state.session?.login || 'unknown'} · ${state.session?.role || 'unknown role'}`);
  });

  document.getElementById('search-trigger').addEventListener('click', openPalette);

  window.addEventListener('hashchange', () => {
    toggleSidebar(false);
    view.scrollTop = 0;
    render();
  });

  view.addEventListener('click', async (event) => {
    const toc = event.target.closest('[data-toc]');
    if (toc) {
      event.preventDefault();
      document.getElementById(toc.dataset.toc)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const doc = event.target.closest('[data-doc]');
    if (doc) return openDoc(doc.dataset.doc);
    const detail = event.target.closest('[data-detail]');
    if (detail) {
      showMemberDialog(detail.dataset.detail);
      return;
    }
    const openCommand = event.target.closest('[data-open-command]');
    if (openCommand) {
      openCommandDialog(openCommand.dataset.openCommand);
      return;
    }
    const rolePerms = event.target.closest('[data-role-perms]');
    if (rolePerms) {
      openRoleDialog(rolePerms.dataset.rolePerms);
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action) {
      const name = action.dataset.action;
      if (name === 'go-back') navigate(docSection(state.openDoc?.id));
      else if (name === 'go-library') navigate('library');
      else if (name === 'open-palette') openPalette();
      else if (name === 'toggle-all') {
        state.showAll = !state.showAll;
        render();
      } else if (name === 'refresh') {
        await load(true);
        toast('Hub data refreshed');
      } else if (name === 'copy-link') {
        navigator.clipboard?.writeText(location.href).then(() => toast('Link copied')).catch(() => toast('Clipboard unavailable', 'error'));
      }
      return;
    }
    const chip = event.target.closest('[data-filter] .filter-chip');
    if (chip) {
      const group = chip.closest('[data-filter]').dataset.filter;
      state.filters[group] = chip.dataset.value;
      state.showAll = false;
      render();
    }
  });

  view.addEventListener('input', (event) => {
    if (event.target.id !== 'library-search') return;
    state.filters.query = event.target.value;
    const position = event.target.selectionStart;
    render();
    const next = document.getElementById('library-search');
    if (next) {
      next.focus();
      next.setSelectionRange(position, position);
    }
  });

  view.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-command]');
    if (!form) return;
    event.preventDefault();
    runCommand(form);
  });

  view.addEventListener('change', (event) => {
    const map = { 'source-filter': 'source', 'category-filter': 'category', 'sort-filter': 'sort' };
    if (map[event.target.id]) {
      state.filters[map[event.target.id]] = event.target.value;
      render();
    }
  });

  document.addEventListener('change', (event) => {
    if (!event.target.matches('[data-scope-select]')) return;
    const custom = event.target.closest('.field-row').querySelector('[data-scope-custom]');
    if (custom) custom.hidden = event.target.value !== '__other';
  });

  bindDialog(memberDialog, closeMemberDialog);
  bindDialog(commandDialog, closeCommandDialog);
  bindDialog(roleDialog, closeRoleDialog);

  document.addEventListener('keydown', (event) => {
    if (anyDialogOpen()) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      state.paletteOpen ? closePalette() : openPalette();
      return;
    }
    if (event.key === 'Escape') {
      if (state.paletteOpen) closePalette();
      else toggleSidebar(false);
      return;
    }
    if (state.paletteOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.paletteIndex = Math.min(state.paletteMatches.length - 1, state.paletteIndex + 1);
        updatePalette();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.paletteIndex = Math.max(0, state.paletteIndex - 1);
        updatePalette();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        choosePalette(state.paletteIndex);
      }
      return;
    }
    if (['1', '2', '3'].includes(event.key) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      navigate({ 1: 'dashboard', 2: 'library', 3: 'policies' }[event.key]);
    }
  });

  palette.addEventListener('click', (event) => {
    if (event.target.hasAttribute('data-close-palette')) closePalette();
    const result = event.target.closest('.palette-result');
    if (result) choosePalette(Number(result.dataset.index));
  });

  paletteInput.addEventListener('input', () => {
    state.paletteIndex = 0;
    updatePalette();
  });
});
