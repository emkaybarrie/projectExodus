// Forge Portal - App Module
// M2c: Live truth + Work Orders UX
// M2c1: Fixed to use relative URLs for local + Pages compatibility
// S3: Execute loop with status chips and executor queue
// M2c2: Deploy to Production integration
// A1: Forante/Entity Registry integration
// O2: Dev/Prod Environments integration

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

// Compute Share Pack base URL relative to this script (works with spaces in paths)
const SHARE_PACK_BASE = new URL('../exports/share-pack/', import.meta.url).href.replace(/\/$/, '');

// Compute data URLs relative to this script
const ENTITIES_URL = new URL('./data/entities.json', import.meta.url).href;
const ENVIRONMENTS_URL = new URL('./data/environments.json', import.meta.url).href;

// State
const state = {
  sharePack: null,
  workOrders: null,
  entities: null,
  environments: null,
  currentScreen: 'dashboard',
  woFilter: 'all',
  loading: true,
  error: null,
  errorDetails: null
};

// DOM Elements (populated on init)
let elements = {};

// === Data Loading ===

async function loadSharePack() {
  const url = `${SHARE_PACK_BASE}/share-pack.index.json`;
  try {
    console.log('[Portal] Fetching:', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load share-pack.index.json:', e);
    return null;
  }
}

async function loadWorkOrders() {
  const url = `${SHARE_PACK_BASE}/work-orders.index.json`;
  try {
    console.log('[Portal] Fetching:', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load work-orders.index.json:', e);
    return null;
  }
}

async function loadEntities() {
  try {
    console.log('[Portal] Fetching:', ENTITIES_URL);
    const res = await fetch(ENTITIES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load entities.json:', e);
    return null;
  }
}

async function loadEnvironments() {
  try {
    console.log('[Portal] Fetching:', ENVIRONMENTS_URL);
    const res = await fetch(ENVIRONMENTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load environments.json:', e);
    return null;
  }
}

async function loadData() {
  state.loading = true;
  state.error = null;
  state.errorDetails = null;
  render();

  const [sharePack, workOrders, entities, environments] = await Promise.all([
    loadSharePack(),
    loadWorkOrders(),
    loadEntities(),
    loadEnvironments()
  ]);

  state.sharePack = sharePack;
  state.workOrders = workOrders;
  state.entities = entities;
  state.environments = environments;
  state.loading = false;

  if (!sharePack && !workOrders) {
    state.error = 'Share Pack indices not found.';
    state.errorDetails = `Looking for JSON at: ${SHARE_PACK_BASE}/

To generate indices, run from repo root:
  node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"

Then refresh this page.`;
  }

  render();
}

// === Screen Navigation ===

function navigateTo(screen) {
  state.currentScreen = screen;
  render();
}

// === Work Orders Filtering ===

function setWoFilter(filter) {
  state.woFilter = filter;
  render();
}

function getFilteredWorkOrders() {
  if (!state.workOrders?.workOrders) return [];
  const wos = state.workOrders.workOrders;

  if (state.woFilter === 'all') return wos;
  return wos.filter(wo => wo.status === state.woFilter);
}

// === Create WO Wizard ===

function buildIssueUrl(fields) {
  const base = `${REPO_BASE}/issues/new`;
  const params = new URLSearchParams({
    template: 'forge_work_order.yml',
    title: `[WO] ${fields.taskId || ''}`
  });

  // Add form fields as URL params (GitHub supports this for issue forms)
  if (fields.taskId) params.set('task-id', fields.taskId);
  if (fields.taskType) params.set('task-type', fields.taskType);
  if (fields.intent) params.set('intent', fields.intent);
  if (fields.scope) params.set('scope', fields.scope);

  return `${base}?${params.toString()}`;
}

function buildIssueBody(fields) {
  return `## Work Order

**Task ID:** ${fields.taskId || '[Enter Task ID]'}
**Task Type:** ${fields.taskType || '[Select Type]'}

### Intent Statement
${fields.intent || '[Describe WHY this task exists]'}

### Scope of Work
${fields.scope || '[What is to change or be produced]'}

### Allowed Files
[List files that may be modified]

### Forbidden Changes
[List things explicitly out of scope]

### Success Criteria
[Observable conditions for completion]

---
_Generated by Forge Portal_`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.warn('[Portal] Clipboard write failed:', e);
    return false;
  }
}

async function handleCreateWo(fields) {
  const issueUrl = buildIssueUrl(fields);
  const issueBody = buildIssueBody(fields);

  // Try to open the prefilled URL
  const newWindow = window.open(issueUrl, '_blank');

  // If popup blocked or prefill might not work, offer clipboard fallback
  if (!newWindow) {
    const copied = await copyToClipboard(issueBody);
    if (copied) {
      showToast('Issue body copied to clipboard. Open GitHub Issues manually.');
    } else {
      showToast('Could not open GitHub. Please copy manually.', 'error');
    }
  }
}

// === Execute Affordance ===

function getIssueCommentUrl(issueNumber) {
  return `${REPO_BASE}/issues/${issueNumber}#issuecomment-new`;
}

async function handleExecute(wo) {
  const executeComment = '/execute';
  const copied = await copyToClipboard(executeComment);

  if (copied) {
    showToast('"/execute" copied! Opening issue...');
    // If we have an issue number from the WO, go directly to that issue
    if (wo?.issueNumber) {
      window.open(getIssueCommentUrl(wo.issueNumber), '_blank');
    } else if (wo?.repoUrl) {
      window.open(wo.repoUrl, '_blank');
    } else {
      // Fallback to approved WOs list
      window.open(APPROVED_WO_URL, '_blank');
    }
  } else {
    showToast('Copy "/execute" and comment on the approved issue.', 'info');
  }
}

// === Deploy to Production ===

async function handleDeploy() {
  // Open the workflow dispatch page
  const workflowUrl = `${DEPLOY_WORKFLOW_URL}`;
  showToast('Opening Deploy workflow...', 'info');
  window.open(workflowUrl, '_blank');
}

// === Toast Notifications ===

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));

  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// === Rendering ===

function formatDate(isoString) {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
  return formatDate(isoString);
}

function renderStatusPanel() {
  const sp = state.sharePack;
  const wo = state.workOrders;

  const kernelStatus = sp?.headlines?.kernelVersion ? 'ok' : 'pending';
  const myfiStatus = sp?.headlines?.myfiLastUpdated ? 'ok' : 'pending';
  const packStatus = sp ? 'ok' : 'error';
  const woStatus = wo ? 'ok' : 'pending';

  return `
    <section class="panel status-panel">
      <h2 class="panel-title">System Status</h2>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-icon ${kernelStatus}">${kernelStatus === 'ok' ? '&#10003;' : '&#8987;'}</span>
          <span class="status-name">Forge Kernel</span>
          <span class="status-value">${sp?.headlines?.kernelVersion || 'Loading...'}</span>
        </div>
        <div class="status-item">
          <span class="status-icon ${myfiStatus}">${myfiStatus === 'ok' ? '&#10003;' : '&#8987;'}</span>
          <span class="status-name">MyFi Runtime</span>
          <span class="status-value">${sp?.headlines?.myfiWorkOrders || 'Loading...'}</span>
        </div>
        <div class="status-item">
          <span class="status-icon ${packStatus}">${packStatus === 'ok' ? '&#10003;' : '&#10007;'}</span>
          <span class="status-name">Share Pack</span>
          <span class="status-value">${sp ? formatRelativeTime(sp.generated) : 'Failed'}</span>
        </div>
        <div class="status-item">
          <span class="status-icon ${woStatus}">${woStatus === 'ok' ? '&#10003;' : '&#8987;'}</span>
          <span class="status-name">Work Orders</span>
          <span class="status-value">${wo ? `${wo.counts.total} total` : 'Loading...'}</span>
        </div>
      </div>
      ${sp ? `<div class="status-commit">Commit: <code>${sp.commitShort}</code></div>` : ''}
    </section>
  `;
}

// === Status Chip Helper ===

function getStatusChip(status) {
  const statusMap = {
    'draft': { icon: '📝', label: 'Draft', class: 'status-draft' },
    'pending-approval': { icon: '🟡', label: 'Pending', class: 'status-pending' },
    'approved': { icon: '🟢', label: 'Approved', class: 'status-approved' },
    'ready-for-executor': { icon: '🔵', label: 'Queued', class: 'status-queued' },
    'executing': { icon: '🟣', label: 'Executing', class: 'status-executing' },
    'executed': { icon: '✅', label: 'Executed', class: 'status-executed' },
    'blocked': { icon: '🔴', label: 'Blocked', class: 'status-blocked' }
  };
  return statusMap[status] || { icon: '❓', label: status, class: 'status-unknown' };
}

function renderStatusChip(status) {
  const chip = getStatusChip(status);
  return `<span class="status-chip ${chip.class}">${chip.icon} ${chip.label}</span>`;
}

function renderQuickActions() {
  const queueCount = state.workOrders?.counts?.readyForExecutor || 0;

  return `
    <section class="panel actions-panel">
      <h2 class="panel-title">Quick Actions</h2>
      <div class="action-grid">
        <button class="action-btn primary" onclick="navigateTo('create-wo')">
          <span class="action-icon">+</span>
          <span class="action-label">Create Work Order</span>
        </button>
        <button class="action-btn deploy-btn" onclick="handleDeploy()">
          <span class="action-icon">&#128640;</span>
          <span class="action-label">Deploy to Prod</span>
        </button>
        <button class="action-btn" onclick="navigateTo('work-orders')">
          <span class="action-icon">&#9776;</span>
          <span class="action-label">Work Orders</span>
        </button>
        <a href="${EXECUTOR_QUEUE_URL}" class="action-btn executor-queue" target="_blank" rel="noopener">
          <span class="action-icon">&#9881;</span>
          <span class="action-label">Executor Queue${queueCount > 0 ? ` (${queueCount})` : ''}</span>
        </a>
        <a href="${REPO_BASE}/pulls" class="action-btn" target="_blank" rel="noopener">
          <span class="action-icon">&#8644;</span>
          <span class="action-label">Pull Requests</span>
        </a>
        <a href="${COMPARE_URL}" class="action-btn" target="_blank" rel="noopener">
          <span class="action-icon">&#8800;</span>
          <span class="action-label">Compare Branches</span>
        </a>
        <button class="action-btn" onclick="loadData()">
          <span class="action-icon">&#8635;</span>
          <span class="action-label">Refresh</span>
        </button>
      </div>
    </section>
  `;
}

function renderWorkOrdersList() {
  const wos = getFilteredWorkOrders();
  const counts = state.workOrders?.counts || {};

  return `
    <section class="panel wo-panel">
      <div class="wo-header">
        <h2 class="panel-title">Work Orders</h2>
        <button class="back-btn" onclick="navigateTo('dashboard')">&#8592; Back</button>
      </div>

      <div class="wo-filters">
        <button class="filter-chip ${state.woFilter === 'all' ? 'active' : ''}" onclick="setWoFilter('all')">
          All (${counts.total || 0})
        </button>
        <button class="filter-chip ${state.woFilter === 'pending-approval' ? 'active' : ''}" onclick="setWoFilter('pending-approval')">
          🟡 Pending (${counts.pendingApproval || 0})
        </button>
        <button class="filter-chip ${state.woFilter === 'approved' ? 'active' : ''}" onclick="setWoFilter('approved')">
          🟢 Approved (${counts.approved || 0})
        </button>
        <button class="filter-chip ${state.woFilter === 'ready-for-executor' ? 'active' : ''}" onclick="setWoFilter('ready-for-executor')">
          🔵 Queued (${counts.readyForExecutor || 0})
        </button>
        <button class="filter-chip ${state.woFilter === 'executing' ? 'active' : ''}" onclick="setWoFilter('executing')">
          🟣 Executing (${counts.executing || 0})
        </button>
        <button class="filter-chip ${state.woFilter === 'executed' ? 'active' : ''}" onclick="setWoFilter('executed')">
          ✅ Executed (${counts.executed || 0})
        </button>
      </div>

      <div class="wo-list">
        ${wos.length === 0 ? '<p class="wo-empty">No work orders found.</p>' : ''}
        ${wos.map(wo => `
          <div class="wo-item">
            <div class="wo-item-header">
              ${renderStatusChip(wo.status)}
              <span class="wo-date">${formatRelativeTime(wo.lastUpdated)}</span>
            </div>
            <div class="wo-title">${wo.title}</div>
            <div class="wo-actions">
              <a href="${wo.repoUrl}" class="wo-action-btn" target="_blank" rel="noopener">View</a>
              ${wo.status === 'approved' ? `
                <button class="wo-action-btn execute" onclick="handleExecuteWo('${wo.id}')">Execute</button>
              ` : ''}
              ${wo.status === 'ready-for-executor' ? `
                <a href="${EXECUTOR_QUEUE_URL}" class="wo-action-btn queued" target="_blank" rel="noopener">In Queue</a>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="wo-queue-link">
        <a href="${EXECUTOR_QUEUE_URL}" class="btn-executor-queue" target="_blank" rel="noopener">
          &#9881; Open Executor Queue on GitHub
        </a>
      </div>
    </section>
  `;
}

function renderCreateWoWizard() {
  return `
    <section class="panel create-wo-panel">
      <div class="wo-header">
        <h2 class="panel-title">Create Work Order</h2>
        <button class="back-btn" onclick="navigateTo('dashboard')">&#8592; Back</button>
      </div>

      <form id="create-wo-form" class="wo-form">
        <div class="form-group">
          <label for="wo-task-id">Task ID</label>
          <input type="text" id="wo-task-id" placeholder="FO-MyFi-I3-Feature" required>
          <span class="form-hint">e.g., FO-[Product]-[Type][Number]-[Name]</span>
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
            <option value="research">Research</option>
            <option value="docs-only">Docs Only</option>
            <option value="meta">Meta</option>
          </select>
        </div>

        <div class="form-group">
          <label for="wo-intent">Intent Statement</label>
          <textarea id="wo-intent" placeholder="Single sentence: WHY this task exists" rows="2" required></textarea>
        </div>

        <div class="form-group">
          <label for="wo-scope">Scope of Work</label>
          <textarea id="wo-scope" placeholder="What is to change or be produced" rows="3"></textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">Create Issue</button>
          <button type="button" class="btn-secondary" onclick="copyWoBody()">Copy to Clipboard</button>
        </div>

        <p class="form-note">
          Opens GitHub with prefilled form. If that fails, use "Copy to Clipboard" and paste manually.
        </p>
      </form>
    </section>
  `;
}

function renderEntitiesPanel() {
  const entities = state.entities?.entities || [];

  if (entities.length === 0) {
    return `
      <section class="panel entities-panel">
        <h2 class="panel-title">Entities</h2>
        <p class="panel-empty">No entities registered. Check data/entities.json</p>
      </section>
    `;
  }

  const tierLabels = state.entities?.tiers || {};

  return `
    <section class="panel entities-panel">
      <h2 class="panel-title">Registered Entities</h2>
      <div class="entities-list">
        ${entities.map(entity => `
          <div class="entity-item ${entity.flagship ? 'flagship' : ''}">
            <div class="entity-header">
              <span class="entity-name">${entity.name}</span>
              ${entity.flagship ? '<span class="flagship-badge">Flagship</span>' : ''}
              <span class="entity-tier">Tier ${entity.integrationTier}</span>
            </div>
            <div class="entity-desc">${entity.description || 'No description'}</div>
            <div class="entity-meta">
              <span class="entity-status ${entity.status}">${entity.status}</span>
              <span class="entity-tier-name">${tierLabels[entity.integrationTier]?.name || ''}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderGovernancePanel() {
  return `
    <section class="panel governance-panel">
      <h2 class="panel-title">Forante Governance</h2>
      <p class="panel-subtitle">Constitutional Layer (Model 3)</p>
      <nav class="nav-list">
        <a href="${FORANTE_KERNEL_URL}" class="nav-link" target="_blank" rel="noopener">
          <span class="nav-icon">&#128220;</span>
          <span class="nav-text">Forante Kernel</span>
          <span class="nav-arrow">&#8250;</span>
        </a>
        <a href="${FORANTE_INDEX_URL}" class="nav-link" target="_blank" rel="noopener">
          <span class="nav-icon">&#128269;</span>
          <span class="nav-text">Forante Index</span>
          <span class="nav-arrow">&#8250;</span>
        </a>
        <a href="${OPERATING_LANES_URL}" class="nav-link" target="_blank" rel="noopener">
          <span class="nav-icon">&#128739;</span>
          <span class="nav-text">Operating Model Lanes</span>
          <span class="nav-arrow">&#8250;</span>
        </a>
      </nav>
    </section>
  `;
}

function renderEnvironmentsPanel() {
  const envs = state.environments?.environments || {};
  const prod = envs.prod;
  const dev = envs.dev;

  // Detect current environment by checking URL path
  const currentPath = window.location.pathname;
  const isDevEnv = currentPath.includes('/dev/');
  const currentEnv = isDevEnv ? 'dev' : 'prod';

  return `
    <section class="panel environments-panel">
      <h2 class="panel-title">Environments</h2>
      <p class="panel-subtitle">You are on: <strong>${isDevEnv ? 'DEV' : 'PROD'}</strong></p>
      <div class="env-grid">
        <div class="env-card ${currentEnv === 'prod' ? 'current' : ''}">
          <div class="env-header">
            <span class="env-name">Production</span>
            <span class="env-branch">main</span>
          </div>
          <div class="env-links">
            <a href="${prod?.urls?.portal || '#'}" class="env-link" ${currentEnv === 'prod' ? '' : 'target="_blank" rel="noopener"'}>
              Portal
            </a>
            <a href="${prod?.urls?.myfi || '#'}" class="env-link" target="_blank" rel="noopener">
              MyFi
            </a>
          </div>
        </div>
        <div class="env-card ${currentEnv === 'dev' ? 'current' : ''}">
          <div class="env-header">
            <span class="env-name">Development</span>
            <span class="env-branch">dev</span>
          </div>
          <div class="env-links">
            <a href="${dev?.urls?.portal || '#'}" class="env-link" ${currentEnv === 'dev' ? '' : 'target="_blank" rel="noopener"'}>
              Portal
            </a>
            <a href="${dev?.urls?.myfi || '#'}" class="env-link" target="_blank" rel="noopener">
              MyFi
            </a>
          </div>
        </div>
      </div>
      <div class="env-actions">
        <a href="${DEPLOYMENT_CONTRACT_URL}" class="env-doc-link" target="_blank" rel="noopener">
          Deployment Contract
        </a>
      </div>
    </section>
  `;
}

function renderNavigation() {
  return `
    <section class="panel nav-panel">
      <h2 class="panel-title">Navigation</h2>
      <nav class="nav-list">
        <a href="${REPO_BASE}/blob/main/The%20Forge/myfi/PRODUCT_STATE.md" class="nav-link" target="_blank" rel="noopener">
          <span class="nav-icon">&#128196;</span>
          <span class="nav-text">MyFi Product State</span>
          <span class="nav-arrow">&#8250;</span>
        </a>
        <a href="${REPO_BASE}/blob/main/The%20Forge/myfi/MIGRATION_PARITY_MATRIX.md" class="nav-link" target="_blank" rel="noopener">
          <span class="nav-icon">&#128202;</span>
          <span class="nav-text">Parity Matrix</span>
          <span class="nav-arrow">&#8250;</span>
        </a>
        <a href="${REPO_BASE}/blob/main/The%20Forge/forge/FORGE_KERNEL.md" class="nav-link" target="_blank" rel="noopener">
          <span class="nav-icon">&#9881;</span>
          <span class="nav-text">Forge Kernel</span>
          <span class="nav-arrow">&#8250;</span>
        </a>
        <a href="${REPO_BASE}/tree/main/Project%20MyFi/ProjectMyFi_vLatest" class="nav-link" target="_blank" rel="noopener">
          <span class="nav-icon">&#128187;</span>
          <span class="nav-text">Canonical Codebase</span>
          <span class="nav-arrow">&#8250;</span>
        </a>
      </nav>
    </section>
  `;
}

function renderDashboard() {
  return `
    ${renderStatusPanel()}
    ${renderQuickActions()}
    ${renderEnvironmentsPanel()}
    ${renderEntitiesPanel()}
    ${renderGovernancePanel()}
    ${renderNavigation()}
  `;
}

function renderScreen() {
  switch (state.currentScreen) {
    case 'work-orders':
      return renderWorkOrdersList();
    case 'create-wo':
      return renderCreateWoWizard();
    default:
      return renderDashboard();
  }
}

function render() {
  const content = elements.content;
  if (!content) return;

  if (state.loading) {
    content.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading Forge data...</p>
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

  // Bind form if on create-wo screen
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
    handleCreateWo(fields);
  });
}

// === Global Functions (called from HTML) ===

window.navigateTo = navigateTo;
window.setWoFilter = setWoFilter;
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
  const body = buildIssueBody(fields);
  const copied = await copyToClipboard(body);
  showToast(copied ? 'Work Order copied to clipboard!' : 'Copy failed. Select and copy manually.', copied ? 'success' : 'error');
};

// === Init ===

function init() {
  elements.content = document.getElementById('portal-content');

  // Update timestamp
  const timestamp = document.getElementById('timestamp');
  if (timestamp) {
    timestamp.textContent = 'Last loaded: ' + new Date().toLocaleString();
  }

  // Load data
  loadData();
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
