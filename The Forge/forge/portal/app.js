// Forante Portal - App Module
// P0: Phone-native portal scaffolding
// Forge is an Institutional OS, not a product
// Forante Portal is the OS console

const REPO_BASE = 'https://github.com/emkaybarrie/projectExodus';
const EXECUTOR_QUEUE_URL = `${REPO_BASE}/issues?q=is%3Aissue+is%3Aopen+label%3Aready-for-executor`;
const APPROVED_WO_URL = `${REPO_BASE}/issues?q=is%3Aissue+is%3Aopen+label%3Awork-order+label%3Aapproved`;
const DEPLOY_WORKFLOW_URL = `${REPO_BASE}/actions/workflows/forge-deploy-to-prod.yml`;
const COMPARE_URL = `${REPO_BASE}/compare/main...dev`;

// Forante governance links
const FORANTE_KERNEL_URL = `${REPO_BASE}/blob/main/Forante/FORANTE_KERNEL.md`;
const FORANTE_INDEX_URL = `${REPO_BASE}/blob/main/Forante/FORANTE_INDEX.md`;
const OPERATING_LANES_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/ops/OPERATING_MODEL_LANES.md`;
const DEPLOYMENT_CONTRACT_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/ops/DEPLOYMENT_CONTRACT.md`;
const FORGE_KERNEL_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/FORGE_KERNEL.md`;
const SHARE_PACK_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/exports/share-pack/SHARE_PACK.md`;

// Compute Share Pack base URL relative to this script
const SHARE_PACK_BASE = new URL('../exports/share-pack/', import.meta.url).href.replace(/\/$/, '');

// Compute data URLs relative to this script
const ENTITIES_URL = new URL('./data/entities.json', import.meta.url).href;
const ENVIRONMENTS_URL = new URL('./data/environments.json', import.meta.url).href;
const PRODUCTS_URL = new URL('./data/products.json', import.meta.url).href;

// State
const state = {
  sharePack: null,
  workOrders: null,
  entities: null,
  environments: null,
  products: null,
  currentTab: 'home',
  currentScreen: 'home',
  woFilter: 'all',
  woLaneFilter: 'all',
  entityFilter: null,
  loading: true,
  error: null,
  errorDetails: null
};

// === Lane Detection ===

function parseLane(woId) {
  if (!woId) return 'unknown';
  const match = woId.match(/^FO-([A-Za-z]+)-/);
  if (match) return match[1];
  return 'unknown';
}

function getLaneInfo(lane) {
  const lanes = {
    'Forge': { icon: '&#9881;', label: 'Forge', class: 'lane-forge', color: '#6366f1' },
    'MyFi': { icon: '&#128241;', label: 'MyFi', class: 'lane-myfi', color: '#10b981' },
    'Forante': { icon: '&#127970;', label: 'Forante', class: 'lane-forante', color: '#f59e0b' },
    'unknown': { icon: '&#10067;', label: 'Other', class: 'lane-unknown', color: '#6b7280' }
  };
  return lanes[lane] || lanes['unknown'];
}

function getUniqueLanes() {
  if (!state.workOrders?.workOrders) return [];
  const lanes = new Set();
  state.workOrders.workOrders.forEach(wo => lanes.add(parseLane(wo.id)));
  return Array.from(lanes).sort();
}

function countByLane() {
  if (!state.workOrders?.workOrders) return {};
  const counts = {};
  state.workOrders.workOrders.forEach(wo => {
    const lane = parseLane(wo.id);
    counts[lane] = (counts[lane] || 0) + 1;
  });
  return counts;
}

// DOM Elements
let elements = {};

// === Data Loading ===

async function loadSharePack() {
  const url = `${SHARE_PACK_BASE}/share-pack.index.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load share-pack:', e);
    return null;
  }
}

async function loadWorkOrders() {
  const url = `${SHARE_PACK_BASE}/work-orders.index.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load work-orders:', e);
    return null;
  }
}

async function loadEntities() {
  try {
    const res = await fetch(ENTITIES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load entities:', e);
    return null;
  }
}

async function loadEnvironments() {
  try {
    const res = await fetch(ENVIRONMENTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load environments:', e);
    return null;
  }
}

async function loadProducts() {
  try {
    const res = await fetch(PRODUCTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load products:', e);
    return null;
  }
}

async function loadData() {
  state.loading = true;
  state.error = null;
  render();

  const [sharePack, workOrders, entities, environments, products] = await Promise.all([
    loadSharePack(),
    loadWorkOrders(),
    loadEntities(),
    loadEnvironments(),
    loadProducts()
  ]);

  state.sharePack = sharePack;
  state.workOrders = workOrders;
  state.entities = entities;
  state.environments = environments;
  state.products = products;
  state.loading = false;

  if (!sharePack && !workOrders) {
    state.error = 'Share Pack indices not found.';
    state.errorDetails = `Run: node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"`;
  }

  render();
}

// === Navigation ===

function navigateTo(screen) {
  // Map screens to tabs for bottom nav highlighting
  const tabMap = {
    'home': 'home',
    'forge': 'forge',
    'forge-governance': 'forge',
    'forge-agents': 'forge',
    'forge-sharepacks': 'forge',
    'forge-registry': 'forge',
    'entities': 'entities',
    'entity-portal': 'entities',
    'governance': 'governance',
    'work-orders': 'forge',
    'create-wo': 'forge'
  };

  state.currentScreen = screen;
  state.currentTab = tabMap[screen] || 'home';

  updateBottomNav();
  render();
}

function updateBottomNav() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    const tabName = tab.dataset.tab;
    tab.classList.toggle('active', tabName === state.currentTab);
  });
}

// === Filtering ===

function setWoFilter(filter) {
  state.woFilter = filter;
  render();
}

function setWoLaneFilter(lane) {
  state.woLaneFilter = lane;
  render();
}

function setEntityFilter(entityId) {
  state.entityFilter = entityId;
  if (entityId) {
    const entity = state.entities?.entities?.find(e => e.id === entityId);
    if (entity) state.woLaneFilter = entity.name;
  } else {
    state.woLaneFilter = 'all';
  }
  state.currentScreen = 'work-orders';
  render();
}

function clearEntityFilter() {
  state.entityFilter = null;
  state.woLaneFilter = 'all';
  render();
}

function getFilteredWorkOrders(laneOverride = null) {
  if (!state.workOrders?.workOrders) return [];
  let wos = state.workOrders.workOrders;

  if (state.woFilter !== 'all') {
    wos = wos.filter(wo => wo.status === state.woFilter);
  }

  const lane = laneOverride || state.woLaneFilter;
  if (lane !== 'all') {
    wos = wos.filter(wo => parseLane(wo.id) === lane);
  }

  return wos;
}

// === Entity Portal Navigation ===

function openEntityPortal(entityId) {
  // Navigate to entity-specific portal
  // Explicit index.html for local dev compatibility (directory listing prevention)
  const portalUrl = `./entity/${entityId}/index.html`;
  window.location.href = portalUrl;
}

// === Utilities ===

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatRelativeTime(isoString) {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// === Actions ===

async function handleDeploy() {
  showToast('Opening Deploy workflow...', 'info');
  window.open(DEPLOY_WORKFLOW_URL, '_blank');
}

async function handleExecute(wo) {
  const copied = await copyToClipboard('/execute');
  if (copied) {
    showToast('"/execute" copied! Opening issue...');
    window.open(wo?.repoUrl || APPROVED_WO_URL, '_blank');
  }
}

function buildIssueUrl(fields) {
  const base = `${REPO_BASE}/issues/new`;
  const params = new URLSearchParams({
    template: 'forge_work_order.yml',
    title: `[WO] ${fields.taskId || ''}`
  });
  return `${base}?${params.toString()}`;
}

// === Render Helpers ===

function getStatusChip(status) {
  const map = {
    'draft': { icon: '&#128221;', label: 'Draft', class: 'status-draft' },
    'pending-approval': { icon: '&#128993;', label: 'Pending', class: 'status-pending' },
    'approved': { icon: '&#128994;', label: 'Approved', class: 'status-approved' },
    'ready-for-executor': { icon: '&#128309;', label: 'Queued', class: 'status-queued' },
    'executing': { icon: '&#128995;', label: 'Executing', class: 'status-executing' },
    'executed': { icon: '&#9989;', label: 'Executed', class: 'status-executed' },
    'blocked': { icon: '&#128308;', label: 'Blocked', class: 'status-blocked' }
  };
  return map[status] || { icon: '&#10067;', label: status, class: 'status-unknown' };
}

function renderStatusChip(status) {
  const chip = getStatusChip(status);
  return `<span class="status-chip ${chip.class}">${chip.icon} ${chip.label}</span>`;
}

function renderLaneChip(lane) {
  const info = getLaneInfo(lane);
  return `<span class="lane-chip ${info.class}">${info.icon} ${info.label}</span>`;
}

// === HOME TAB ===

function renderHomeTab() {
  const sp = state.sharePack;
  const wo = state.workOrders;
  const entities = state.entities?.entities || [];

  return `
    <section class="panel welcome-panel">
      <h2 class="panel-title-large">&#127970; Forante OS Console</h2>
      <p class="panel-subtitle">Institutional governance for the Forante network</p>
    </section>

    <section class="panel status-overview">
      <h2 class="panel-title">System Status</h2>
      <div class="status-cards">
        <div class="status-card ${sp ? 'ok' : 'error'}">
          <span class="status-card-icon">${sp ? '&#9989;' : '&#10060;'}</span>
          <span class="status-card-label">Share Pack</span>
          <span class="status-card-value">${sp ? formatRelativeTime(sp.generated) : 'Failed'}</span>
        </div>
        <div class="status-card ${wo ? 'ok' : 'pending'}">
          <span class="status-card-icon">${wo ? '&#9989;' : '&#8987;'}</span>
          <span class="status-card-label">Work Orders</span>
          <span class="status-card-value">${wo ? `${wo.counts.total} total` : 'Loading'}</span>
        </div>
      </div>
      ${sp ? `<p class="status-commit">Commit: <code>${sp.commitShort}</code></p>` : ''}
    </section>

    <section class="panel quick-nav">
      <h2 class="panel-title">Quick Navigation</h2>
      <div class="nav-cards">
        <button class="nav-card" onclick="navigateTo('forge')">
          <span class="nav-card-icon">&#9881;</span>
          <span class="nav-card-title">Forge OS</span>
          <span class="nav-card-desc">Institutional operations</span>
        </button>
        <button class="nav-card" onclick="navigateTo('entities')">
          <span class="nav-card-icon">&#128736;</span>
          <span class="nav-card-title">Entities</span>
          <span class="nav-card-desc">${entities.length} registered</span>
        </button>
        <button class="nav-card" onclick="navigateTo('governance')">
          <span class="nav-card-icon">&#128220;</span>
          <span class="nav-card-title">Governance</span>
          <span class="nav-card-desc">Constitutional layer</span>
        </button>
        <button class="nav-card" onclick="loadData()">
          <span class="nav-card-icon">&#8635;</span>
          <span class="nav-card-title">Refresh</span>
          <span class="nav-card-desc">Reload all data</span>
        </button>
      </div>
    </section>
  `;
}

// === FORGE OS TAB ===

function renderForgeTab() {
  const wo = state.workOrders;
  const counts = wo?.counts || {};
  const laneCounts = countByLane();
  const forgeWoCount = laneCounts['Forge'] || 0;

  return `
    <section class="panel forge-header-panel">
      <div class="forge-os-badge">
        <span class="forge-os-icon">&#9881;</span>
        <span class="forge-os-text">FORGE</span>
      </div>
      <p class="forge-os-subtitle">Institutional Operating System</p>
      <p class="forge-os-note">Forge is not a product. It is the SDLC that governs all entities.</p>
    </section>

    <section class="panel forge-sections">
      <h2 class="panel-title">OS Sections</h2>
      <div class="section-cards">
        <button class="section-card" onclick="navigateTo('forge-governance')">
          <span class="section-icon">&#128220;</span>
          <div class="section-content">
            <span class="section-title">Governance</span>
            <span class="section-desc">Kernel, Manifest, Playbooks</span>
          </div>
          <span class="section-arrow">&#8250;</span>
        </button>
        <button class="section-card" onclick="navigateTo('forge-agents')">
          <span class="section-icon">&#129302;</span>
          <div class="section-content">
            <span class="section-title">Agents</span>
            <span class="section-desc">AI executor configuration</span>
          </div>
          <span class="section-arrow">&#8250;</span>
        </button>
        <button class="section-card" onclick="navigateTo('forge-sharepacks')">
          <span class="section-icon">&#128230;</span>
          <div class="section-content">
            <span class="section-title">Share Packs</span>
            <span class="section-desc">Truth exports</span>
          </div>
          <span class="section-arrow">&#8250;</span>
        </button>
        <button class="section-card" onclick="navigateTo('forge-registry')">
          <span class="section-icon">&#128203;</span>
          <div class="section-content">
            <span class="section-title">Entity Registry</span>
            <span class="section-desc">Managed entities</span>
          </div>
          <span class="section-arrow">&#8250;</span>
        </button>
      </div>
    </section>

    <section class="panel forge-wo-panel">
      <h2 class="panel-title">Forge Work Orders</h2>
      <div class="wo-summary">
        <span class="wo-count">${forgeWoCount}</span>
        <span class="wo-label">Forge WOs</span>
      </div>
      <div class="action-row">
        <button class="action-btn-sm primary" onclick="navigateTo('work-orders'); setWoLaneFilter('Forge');">
          View Forge WOs
        </button>
        <button class="action-btn-sm" onclick="navigateTo('create-wo')">
          + Create WO
        </button>
      </div>
    </section>

    <section class="panel forge-actions">
      <h2 class="panel-title">Quick Actions</h2>
      <div class="action-grid-compact">
        <button class="action-btn deploy-btn" onclick="handleDeploy()">
          <span class="action-icon">&#128640;</span>
          <span class="action-label">Deploy to Prod</span>
        </button>
        <a href="${EXECUTOR_QUEUE_URL}" class="action-btn executor-queue" target="_blank">
          <span class="action-icon">&#9881;</span>
          <span class="action-label">Executor Queue</span>
        </a>
        <a href="${COMPARE_URL}" class="action-btn" target="_blank">
          <span class="action-icon">&#8800;</span>
          <span class="action-label">Compare Branches</span>
        </a>
        <a href="${REPO_BASE}/pulls" class="action-btn" target="_blank">
          <span class="action-icon">&#8644;</span>
          <span class="action-label">Pull Requests</span>
        </a>
      </div>
    </section>
  `;
}

function renderForgeGovernance() {
  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Forge Governance</h2>
      </div>
      <nav class="doc-list">
        <a href="${FORGE_KERNEL_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#128220;</span>
          <div class="doc-content">
            <span class="doc-title">Forge Kernel</span>
            <span class="doc-desc">Operational law and authority</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
        <a href="${OPERATING_LANES_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#128739;</span>
          <div class="doc-content">
            <span class="doc-title">Operating Model Lanes</span>
            <span class="doc-desc">Parallel development governance</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
        <a href="${DEPLOYMENT_CONTRACT_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#128196;</span>
          <div class="doc-content">
            <span class="doc-title">Deployment Contract</span>
            <span class="doc-desc">Dev/Prod deployment rules</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
        <a href="${REPO_BASE}/blob/main/The%20Forge/forge/ops/EXECUTOR_PLAYBOOK.md" class="doc-link" target="_blank">
          <span class="doc-icon">&#129302;</span>
          <div class="doc-content">
            <span class="doc-title">Executor Playbook</span>
            <span class="doc-desc">AI agent protocol</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
      </nav>
    </section>
  `;
}

function renderForgeAgents() {
  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Agents</h2>
      </div>
      <div class="info-card">
        <span class="info-icon">&#129302;</span>
        <p>AI Executors operate under the Forge Executor Playbook. They can only act within approved Work Order scope.</p>
      </div>
      <nav class="doc-list">
        <a href="${REPO_BASE}/blob/main/The%20Forge/forge/ops/EXECUTOR_PLAYBOOK.md" class="doc-link" target="_blank">
          <span class="doc-icon">&#128220;</span>
          <div class="doc-content">
            <span class="doc-title">Executor Playbook</span>
            <span class="doc-desc">AI agent protocol</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
        <a href="${EXECUTOR_QUEUE_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#9881;</span>
          <div class="doc-content">
            <span class="doc-title">Executor Queue</span>
            <span class="doc-desc">Ready-for-executor issues</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
      </nav>
    </section>
  `;
}

function renderForgeSharePacks() {
  const sp = state.sharePack;
  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Share Packs</h2>
      </div>
      <div class="info-card">
        <span class="info-icon">&#128230;</span>
        <p>Share Packs are constitutional truth exports. They contain the authoritative state that agents load before operating.</p>
      </div>
      ${sp ? `
        <div class="sharepack-status">
          <div class="sharepack-row">
            <span class="sharepack-label">Generated:</span>
            <span class="sharepack-value">${formatRelativeTime(sp.generated)}</span>
          </div>
          <div class="sharepack-row">
            <span class="sharepack-label">Commit:</span>
            <code class="sharepack-value">${sp.commitShort}</code>
          </div>
        </div>
      ` : '<p class="error-text">Share Pack not loaded</p>'}
      <nav class="doc-list">
        <a href="${SHARE_PACK_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#128220;</span>
          <div class="doc-content">
            <span class="doc-title">SHARE_PACK.md</span>
            <span class="doc-desc">Main share pack document</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
      </nav>
    </section>
  `;
}

function renderForgeRegistry() {
  const entities = state.entities?.entities || [];
  const tierLabels = state.entities?.tiers || {};

  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Entity Registry</h2>
      </div>
      <div class="info-card">
        <span class="info-icon">&#128203;</span>
        <p>Entities are products or systems managed under Forge governance. Each entity has an integration tier defining its relationship to Forge.</p>
      </div>
      <div class="entities-list">
        ${entities.map(entity => `
          <div class="entity-card">
            <div class="entity-card-header">
              <span class="entity-name">${entity.name}</span>
              ${entity.flagship ? '<span class="flagship-badge">Flagship</span>' : ''}
              <span class="entity-tier">Tier ${entity.integrationTier}</span>
            </div>
            <p class="entity-desc">${entity.description || 'No description'}</p>
            <div class="entity-meta">
              <span class="entity-status ${entity.status}">${entity.status}</span>
              <span class="entity-tier-label">${tierLabels[entity.integrationTier]?.name || ''}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// === ENTITIES TAB ===

function renderEntitiesTab() {
  const entities = state.entities?.entities || [];
  const laneCounts = countByLane();
  const tierLabels = state.entities?.tiers || {};

  return `
    <section class="panel">
      <h2 class="panel-title-large">&#128736; Entities</h2>
      <p class="panel-subtitle">Products and systems under Forge governance</p>
    </section>

    <section class="panel">
      <h2 class="panel-title">Registered Entities</h2>
      ${entities.length === 0 ? '<p class="empty-text">No entities registered</p>' : ''}
      <div class="entity-portal-list">
        ${entities.map(entity => {
          const woCount = laneCounts[entity.name] || 0;
          return `
            <div class="entity-portal-card ${entity.flagship ? 'flagship' : ''}">
              <div class="entity-portal-header">
                <span class="entity-portal-name">${getLaneInfo(entity.name).icon} ${entity.name}</span>
                ${entity.flagship ? '<span class="flagship-badge">Flagship</span>' : ''}
              </div>
              <p class="entity-portal-desc">${entity.description || 'No description'}</p>
              <div class="entity-portal-meta">
                <span class="entity-status ${entity.status}">${entity.status}</span>
                <span class="entity-tier">Tier ${entity.integrationTier}</span>
                <span class="entity-wo-count">${woCount} WOs</span>
              </div>
              <div class="entity-portal-actions">
                <button class="entity-action-btn primary" onclick="openEntityPortal('${entity.id}')">
                  Open ${entity.name} Portal
                </button>
                <button class="entity-action-btn" onclick="setEntityFilter('${entity.id}')">
                  View Work Orders
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

// === GOVERNANCE TAB ===

function renderGovernanceTab() {
  return `
    <section class="panel">
      <h2 class="panel-title-large">&#128220; Forante Governance</h2>
      <p class="panel-subtitle">Constitutional Layer (Model 3)</p>
    </section>

    <section class="panel">
      <div class="info-card governance">
        <span class="info-icon">&#127970;</span>
        <p>Forante is the steward company. It governs via constitutional documents that define authority, entities, and operational boundaries.</p>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Constitutional Documents</h2>
      <nav class="doc-list">
        <a href="${FORANTE_KERNEL_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#128220;</span>
          <div class="doc-content">
            <span class="doc-title">Forante Kernel</span>
            <span class="doc-desc">Constitutional foundation</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
        <a href="${FORANTE_INDEX_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#128269;</span>
          <div class="doc-content">
            <span class="doc-title">Forante Index</span>
            <span class="doc-desc">Navigation by role</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
        <a href="${OPERATING_LANES_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#128739;</span>
          <div class="doc-content">
            <span class="doc-title">Operating Model Lanes</span>
            <span class="doc-desc">Development governance</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
      </nav>
    </section>

    <section class="panel">
      <h2 class="panel-title">Model 3 Architecture</h2>
      <div class="model3-diagram">
        <div class="model3-layer forante">
          <span class="layer-icon">&#127970;</span>
          <span class="layer-name">Forante</span>
          <span class="layer-desc">Constitutional governance</span>
        </div>
        <div class="model3-arrow">&#8595;</div>
        <div class="model3-layer forge">
          <span class="layer-icon">&#9881;</span>
          <span class="layer-name">Forge</span>
          <span class="layer-desc">Institutional OS</span>
        </div>
        <div class="model3-arrow">&#8595;</div>
        <div class="model3-layer entities">
          <span class="layer-icon">&#128736;</span>
          <span class="layer-name">Entities</span>
          <span class="layer-desc">Products & systems</span>
        </div>
      </div>
    </section>
  `;
}

// === WORK ORDERS (sub-screen) ===

function renderWorkOrdersScreen() {
  const wos = getFilteredWorkOrders();
  const counts = state.workOrders?.counts || {};
  const laneCounts = countByLane();
  const uniqueLanes = getUniqueLanes();

  const filterNotice = state.entityFilter ? `
    <div class="filter-notice">
      Showing: <strong>${state.woLaneFilter}</strong>
      <button class="clear-btn" onclick="clearEntityFilter()">&#10005;</button>
    </div>
  ` : '';

  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Work Orders</h2>
      </div>
      ${filterNotice}
    </section>

    <section class="panel filter-panel">
      <div class="filter-group">
        <span class="filter-label">Lane:</span>
        <div class="filter-chips">
          <button class="filter-chip ${state.woLaneFilter === 'all' ? 'active' : ''}" onclick="setWoLaneFilter('all')">All</button>
          ${uniqueLanes.map(lane => `
            <button class="filter-chip ${state.woLaneFilter === lane ? 'active' : ''}" onclick="setWoLaneFilter('${lane}')">
              ${getLaneInfo(lane).icon} ${lane} (${laneCounts[lane] || 0})
            </button>
          `).join('')}
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-label">Status:</span>
        <div class="filter-chips">
          <button class="filter-chip ${state.woFilter === 'all' ? 'active' : ''}" onclick="setWoFilter('all')">All</button>
          <button class="filter-chip ${state.woFilter === 'approved' ? 'active' : ''}" onclick="setWoFilter('approved')">&#128994; Approved</button>
          <button class="filter-chip ${state.woFilter === 'executed' ? 'active' : ''}" onclick="setWoFilter('executed')">&#9989; Executed</button>
        </div>
      </div>
      <p class="results-count">Showing ${wos.length} work orders</p>
    </section>

    <section class="panel wo-list-panel">
      ${wos.length === 0 ? '<p class="empty-text">No work orders match filters</p>' : ''}
      <div class="wo-list">
        ${wos.map(wo => {
          const lane = parseLane(wo.id);
          return `
            <div class="wo-card">
              <div class="wo-card-header">
                ${renderLaneChip(lane)}
                ${renderStatusChip(wo.status)}
                <span class="wo-date">${formatRelativeTime(wo.lastUpdated)}</span>
              </div>
              <p class="wo-card-title">${wo.title}</p>
              <div class="wo-card-actions">
                <a href="${wo.repoUrl}" class="wo-btn" target="_blank">View</a>
                ${wo.status === 'approved' ? `<button class="wo-btn primary" onclick="handleExecuteWo('${wo.id}')">Execute</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

// === CREATE WO (sub-screen) ===

function renderCreateWoScreen() {
  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Create Work Order</h2>
      </div>
    </section>

    <section class="panel">
      <form id="create-wo-form" class="wo-form">
        <div class="form-group">
          <label for="wo-task-id">Task ID</label>
          <input type="text" id="wo-task-id" placeholder="FO-MyFi-I3-Feature" required>
          <span class="form-hint">Format: FO-[Entity]-[Type][Num]-[Name]</span>
        </div>
        <div class="form-group">
          <label for="wo-task-type">Task Type</label>
          <select id="wo-task-type" required>
            <option value="">Select type...</option>
            <option value="implementation">Implementation</option>
            <option value="spec-sync">Spec Sync</option>
            <option value="uplift">Uplift</option>
            <option value="refactor">Refactor</option>
            <option value="audit">Audit</option>
            <option value="meta">Meta</option>
          </select>
        </div>
        <div class="form-group">
          <label for="wo-intent">Intent Statement</label>
          <textarea id="wo-intent" placeholder="WHY this task exists" rows="2" required></textarea>
        </div>
        <div class="form-group">
          <label for="wo-scope">Scope of Work</label>
          <textarea id="wo-scope" placeholder="What is to change" rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary">Create Issue</button>
          <button type="button" class="btn-secondary" onclick="copyWoBody()">Copy</button>
        </div>
      </form>
    </section>
  `;
}

// === Main Render ===

function renderScreen() {
  switch (state.currentScreen) {
    case 'home':
      return renderHomeTab();
    case 'forge':
      return renderForgeTab();
    case 'forge-governance':
      return renderForgeGovernance();
    case 'forge-agents':
      return renderForgeAgents();
    case 'forge-sharepacks':
      return renderForgeSharePacks();
    case 'forge-registry':
      return renderForgeRegistry();
    case 'entities':
      return renderEntitiesTab();
    case 'governance':
      return renderGovernanceTab();
    case 'work-orders':
      return renderWorkOrdersScreen();
    case 'create-wo':
      return renderCreateWoScreen();
    default:
      return renderHomeTab();
  }
}

function render() {
  const content = elements.content;
  if (!content) return;

  if (state.loading) {
    content.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading Forante data...</p>
      </div>
    `;
    return;
  }

  if (state.error) {
    content.innerHTML = `
      <div class="error-state">
        <p><strong>${state.error}</strong></p>
        ${state.errorDetails ? `<pre class="error-details">${state.errorDetails}</pre>` : ''}
        <button class="btn-primary" onclick="loadData()">Retry</button>
      </div>
    `;
    return;
  }

  content.innerHTML = renderScreen();
  updateBottomNav();

  // Bind form handlers
  if (state.currentScreen === 'create-wo') {
    bindCreateWoForm();
  }
}

function bindCreateWoForm() {
  const form = document.getElementById('create-wo-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fields = {
      taskId: document.getElementById('wo-task-id').value,
      taskType: document.getElementById('wo-task-type').value,
      intent: document.getElementById('wo-intent').value,
      scope: document.getElementById('wo-scope').value
    };
    window.open(buildIssueUrl(fields), '_blank');
  });
}

// === Global Functions ===

window.navigateTo = navigateTo;
window.setWoFilter = setWoFilter;
window.setWoLaneFilter = setWoLaneFilter;
window.setEntityFilter = setEntityFilter;
window.clearEntityFilter = clearEntityFilter;
window.openEntityPortal = openEntityPortal;
window.loadData = loadData;
window.handleDeploy = handleDeploy;

window.handleExecuteWo = function(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (wo) handleExecute(wo);
};

window.copyWoBody = async function() {
  const fields = {
    taskId: document.getElementById('wo-task-id')?.value || '',
    taskType: document.getElementById('wo-task-type')?.value || '',
    intent: document.getElementById('wo-intent')?.value || '',
    scope: document.getElementById('wo-scope')?.value || ''
  };
  const body = `## Work Order\n\n**Task ID:** ${fields.taskId}\n**Type:** ${fields.taskType}\n\n### Intent\n${fields.intent}\n\n### Scope\n${fields.scope}`;
  const copied = await copyToClipboard(body);
  showToast(copied ? 'Copied!' : 'Copy failed', copied ? 'success' : 'error');
};

// === Init ===

function init() {
  elements.content = document.getElementById('portal-content');

  const timestamp = document.getElementById('timestamp');
  if (timestamp) {
    timestamp.textContent = 'Loaded: ' + new Date().toLocaleString();
  }

  loadData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
