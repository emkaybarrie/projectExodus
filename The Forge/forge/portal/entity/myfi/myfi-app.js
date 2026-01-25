// MyFi Entity Portal - App Module
// P0: Phone-native entity portal for MyFi

const REPO_BASE = 'https://github.com/emkaybarrie/projectExodus';
const ENTITY_ID = 'myfi';
const ENTITY_NAME = 'MyFi';

// URLs
const MYFI_PRODUCT_STATE_URL = `${REPO_BASE}/blob/main/The%20Forge/myfi/PRODUCT_STATE.md`;
const MYFI_PARITY_MATRIX_URL = `${REPO_BASE}/blob/main/The%20Forge/myfi/MIGRATION_PARITY_MATRIX.md`;
const FORGE_WO_URL = `${REPO_BASE}/issues/new?template=forge_work_order.yml&title=[WO]+FO-Forge-`;
const MYFI_WO_URL = `${REPO_BASE}/issues/new?template=forge_work_order.yml&title=[WO]+FO-MyFi-`;
const E2E_PLAYBOOK_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/ops/E2E_WORKFLOW_PLAYBOOK.md`;

// E2E Workflow Phases
const E2E_PHASES = [
  { id: 'draft', name: 'Draft', role: 'Director / Architect', icon: '&#128221;' },
  { id: 'approved', name: 'Approved', role: 'Director → Forge', icon: '&#128994;' },
  { id: 'executing', name: 'Executing', role: 'Executor', icon: '&#9881;' },
  { id: 'verified', name: 'Verified', role: 'Verifier–Tester', icon: '&#128270;' },
  { id: 'deployed-dev', name: 'Deployed Dev', role: 'Executor / Automation', icon: '&#128187;' },
  { id: 'promoted', name: 'Promoted', role: 'Director', icon: '&#128640;' },
  { id: 'deployed-prod', name: 'Deployed Prod', role: 'Executor / Automation', icon: '&#127919;' },
  { id: 'observed', name: 'Observed', role: 'Reporter', icon: '&#128200;' },
  { id: 'evolved', name: 'Evolved', role: 'Evolution Agent', icon: '&#128161;' }
];

// Compute data URLs relative to portal root
const SHARE_PACK_BASE = new URL('../../../exports/share-pack/', import.meta.url).href.replace(/\/$/, '');
const PRODUCTS_URL = new URL('../../data/products.json', import.meta.url).href;
const ENVIRONMENTS_URL = new URL('../../data/environments.json', import.meta.url).href;

// State
const state = {
  workOrders: null,
  products: null,
  environments: null,
  currentTab: 'home',
  currentScreen: 'home',
  productFilter: 'all',
  selectedWo: null,
  selectedE2EPhase: 'executing',
  loading: true,
  error: null
};

// DOM
let elements = {};

// === Data Loading ===

async function loadWorkOrders() {
  const url = `${SHARE_PACK_BASE}/work-orders.index.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Filter to MyFi only
    data.workOrders = data.workOrders.filter(wo => wo.id.includes('-MyFi-'));
    return data;
  } catch (e) {
    console.warn('[MyFi Portal] Failed to load work-orders:', e);
    return null;
  }
}

async function loadProducts() {
  try {
    const res = await fetch(PRODUCTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.products?.myfi || [];
  } catch (e) {
    console.warn('[MyFi Portal] Failed to load products:', e);
    return [];
  }
}

async function loadEnvironments() {
  try {
    const res = await fetch(ENVIRONMENTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[MyFi Portal] Failed to load environments:', e);
    return null;
  }
}

async function loadData() {
  state.loading = true;
  render();

  const [workOrders, products, environments] = await Promise.all([
    loadWorkOrders(),
    loadProducts(),
    loadEnvironments()
  ]);

  state.workOrders = workOrders;
  state.products = products;
  state.environments = environments;
  state.loading = false;

  render();
}

// === Navigation ===

function navigateTo(screen) {
  const tabMap = {
    'home': 'home',
    'work': 'work',
    'work-orders': 'work',
    'products': 'products',
    'envs': 'envs',
    'escalate': 'home'
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

function goToForante() {
  window.location.href = '../../';
}

// === Utilities ===

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

function getStatusChip(status) {
  const map = {
    'draft': { icon: '&#128221;', label: 'Draft', class: 'status-draft' },
    'pending-approval': { icon: '&#128993;', label: 'Pending', class: 'status-pending' },
    'approved': { icon: '&#128994;', label: 'Approved', class: 'status-approved' },
    'executed': { icon: '&#9989;', label: 'Executed', class: 'status-executed' }
  };
  return map[status] || { icon: '&#10067;', label: status, class: 'status-unknown' };
}

function renderStatusChip(status) {
  const chip = getStatusChip(status);
  return `<span class="status-chip ${chip.class}">${chip.icon} ${chip.label}</span>`;
}

// === Clipboard ===

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

// === Work Order Detail & Agent Pack ===

function showWoDetail(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (!wo) return;
  state.selectedWo = wo;
  renderWoModal();
}

function closeWoDetail() {
  state.selectedWo = null;
  const modal = document.getElementById('wo-detail-modal');
  if (modal) modal.remove();
}

async function copyAgentPack(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (!wo) {
    showToast('Work order not found', 'error');
    return;
  }

  const agentPack = `# Agent Pack: ${wo.id}

## Work Order
- **ID:** ${wo.id}
- **Title:** ${wo.title}
- **Lane:** MyFi
- **Status:** ${wo.status}
- **Last Updated:** ${wo.lastUpdated}

## Source
- **Document:** ${wo.repoUrl}

## Instructions
Read the full Work Order at the source URL above for:
- Purpose / Intent
- Scope
- Acceptance Criteria
- Technical Notes

Execute according to EXECUTOR_PLAYBOOK.md protocol.
`;

  const copied = await copyToClipboard(agentPack);
  showToast(copied ? 'Agent Pack copied!' : 'Copy failed', copied ? 'success' : 'error');
}

// === E2E Workflow Functions ===

function setE2EPhase(phaseId) {
  state.selectedE2EPhase = phaseId;
  render();
}

async function copyPhaseAgentPack(phaseId, woId = null) {
  const phase = E2E_PHASES.find(p => p.id === phaseId);
  if (!phase) {
    showToast('Phase not found', 'error');
    return;
  }

  const wo = woId ? state.workOrders?.workOrders?.find(w => w.id === woId) : null;
  const woSection = wo ? `
## Work Order
- ID: ${wo.id}
- Title: ${wo.title}
- Status: ${wo.status}
` : `
## Work Order
- ID: [SELECT A WORK ORDER]
- Title: [WO TITLE]
- Status: [STATUS]
`;

  const agentPack = `# Agent Pack — Phase: ${phase.name} (MyFi)
${woSection}
## Phase Requirements
- Role: ${phase.role}
- Phase: ${phase.name}
- Lane: MyFi

## Constitutional Reminders
- **Acceptance Criteria Supremacy:** Criteria are the binding definition of done
- **Non-Regression Principle:** Cannot weaken constitutional guarantees
- **Provenance Required:** Record agent type, name, mode at completion

## Canonical References
- Forge Kernel: The Forge/forge/FORGE_KERNEL.md
- Agent Onboarding: The Forge/forge/contracts/AGENT_ONBOARDING_CONTRACT.md
- WO Lifecycle: The Forge/forge/contracts/WORK_ORDER_LIFECYCLE_CONTRACT.md
- Reporting Signals: The Forge/forge/contracts/REPORTING_SIGNALS_CONTRACT.md
- E2E Playbook: The Forge/forge/ops/E2E_WORKFLOW_PLAYBOOK.md

## Closure Checklist
- [ ] All acceptance criteria addressed
- [ ] Provenance recorded
- [ ] Artifacts produced per phase requirements
- [ ] No regressions introduced
- [ ] Handoff ready for next phase
`;

  const copied = await copyToClipboard(agentPack);
  showToast(copied ? `${phase.name} Agent Pack copied!` : 'Copy failed', copied ? 'success' : 'error');
}

function renderWoModal() {
  const wo = state.selectedWo;
  if (!wo) return;

  const existing = document.getElementById('wo-detail-modal');
  if (existing) existing.remove();

  const statusInfo = getStatusChip(wo.status);

  const modal = document.createElement('div');
  modal.id = 'wo-detail-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content wo-detail-modal">
      <div class="modal-header">
        <h2>Work Order Details</h2>
        <button class="modal-close" onclick="closeWoDetail()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="wo-detail-id">${wo.id}</div>
        <h3 class="wo-detail-title">${wo.title}</h3>

        <div class="wo-detail-meta">
          <div class="wo-detail-chip">
            <span class="lane-chip lane-myfi">&#128241; MyFi</span>
          </div>
          <div class="wo-detail-chip">
            <span class="status-chip ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>
          </div>
          <div class="wo-detail-date">
            Updated: ${formatRelativeTime(wo.lastUpdated)}
          </div>
        </div>

        <div class="wo-detail-section">
          <h4>Links</h4>
          <div class="wo-detail-links">
            <a href="${wo.repoUrl}" class="wo-link-btn" target="_blank">
              <span class="link-icon">&#128196;</span> Open WO Document
            </a>
          </div>
        </div>

        <div class="wo-detail-section">
          <h4>Agent Actions</h4>
          <div class="wo-detail-actions">
            <button class="wo-action-btn primary" onclick="copyAgentPack('${wo.id}'); closeWoDetail();">
              <span class="action-icon">&#128203;</span> Copy Agent Pack
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeWoDetail();
  });
}

// === Render: Home Tab ===

function renderHomeTab() {
  const wo = state.workOrders;
  const products = state.products || [];
  const woCount = wo?.workOrders?.length || 0;
  const approvedCount = wo?.workOrders?.filter(w => w.status === 'approved').length || 0;

  return `
    <section class="panel entity-welcome">
      <div class="entity-badge myfi">
        <span class="entity-badge-icon">&#128241;</span>
        <span class="entity-badge-name">MyFi</span>
        <span class="flagship-badge">Flagship</span>
      </div>
      <p class="entity-tagline">Personal finance management platform</p>
    </section>

    <section class="panel status-overview">
      <h2 class="panel-title">Status</h2>
      <div class="status-cards">
        <div class="status-card">
          <span class="status-card-value">${woCount}</span>
          <span class="status-card-label">Work Orders</span>
        </div>
        <div class="status-card ${approvedCount > 0 ? 'highlight' : ''}">
          <span class="status-card-value">${approvedCount}</span>
          <span class="status-card-label">Ready to Execute</span>
        </div>
      </div>
    </section>

    <section class="panel quick-nav">
      <h2 class="panel-title">Quick Actions</h2>
      <div class="nav-cards">
        <button class="nav-card" onclick="navigateTo('work')">
          <span class="nav-card-icon">&#128203;</span>
          <span class="nav-card-title">Work Orders</span>
          <span class="nav-card-desc">${woCount} total</span>
        </button>
        <button class="nav-card" onclick="navigateTo('products')">
          <span class="nav-card-icon">&#128230;</span>
          <span class="nav-card-title">Products</span>
          <span class="nav-card-desc">${products.length} products</span>
        </button>
        <button class="nav-card" onclick="navigateTo('envs')">
          <span class="nav-card-icon">&#127760;</span>
          <span class="nav-card-title">Environments</span>
          <span class="nav-card-desc">Dev / Prod</span>
        </button>
        <button class="nav-card" onclick="navigateTo('escalate')">
          <span class="nav-card-icon">&#128640;</span>
          <span class="nav-card-title">Escalate</span>
          <span class="nav-card-desc">Propose to Forge</span>
        </button>
      </div>
    </section>

    <section class="panel">
      <button class="back-to-forante" onclick="goToForante()">
        &#8592; Back to Forante Portal
      </button>
    </section>
  `;
}

// === Render: Work Tab ===

function renderWorkTab() {
  const wo = state.workOrders;
  const wos = wo?.workOrders || [];
  const approvedCount = wos.filter(w => w.status === 'approved').length;

  return `
    <section class="panel">
      <h2 class="panel-title-large">&#128203; MyFi Work Orders</h2>
      <p class="panel-subtitle">Scoped to MyFi entity only</p>
    </section>

    <section class="panel trigger-panel">
      <h2 class="panel-title">Propose Work</h2>
      <div class="trigger-buttons">
        <a href="${MYFI_WO_URL}" class="trigger-btn myfi" target="_blank">
          <span class="trigger-icon">&#128241;</span>
          <div class="trigger-content">
            <span class="trigger-title">Propose MyFi Work</span>
            <span class="trigger-desc">New feature, fix, or enhancement</span>
          </div>
          <span class="trigger-arrow">&#8594;</span>
        </a>
        <a href="${FORGE_WO_URL}" class="trigger-btn forge" target="_blank">
          <span class="trigger-icon">&#128640;</span>
          <div class="trigger-content">
            <span class="trigger-title">Propose Forge Evolution</span>
            <span class="trigger-desc">Request Forge capability or governance change</span>
          </div>
          <span class="trigger-arrow">&#8594;</span>
        </a>
      </div>
    </section>

    <section class="panel wo-status-summary">
      <div class="status-row">
        <span class="status-label">Total Work Orders</span>
        <span class="status-value">${wos.length}</span>
      </div>
      <div class="status-row ${approvedCount > 0 ? 'highlight' : ''}">
        <span class="status-label">Ready to Execute</span>
        <span class="status-value">${approvedCount}</span>
      </div>
    </section>

    <section class="panel forge-e2e-panel">
      <h2 class="panel-title">E2E Workflow</h2>
      <p class="panel-subtitle-sm">Director-triggered workflow phases</p>
      <div class="e2e-phase-list">
        ${E2E_PHASES.map(phase => `
          <button class="e2e-phase-chip ${state.selectedE2EPhase === phase.id ? 'active' : ''}" onclick="setE2EPhase('${phase.id}')">
            <span class="phase-icon">${phase.icon}</span>
            <span class="phase-name">${phase.name}</span>
          </button>
        `).join('')}
      </div>
      <div class="e2e-phase-detail">
        ${(() => {
          const phase = E2E_PHASES.find(p => p.id === state.selectedE2EPhase);
          return phase ? `
            <div class="phase-info">
              <span class="phase-role">Role: <strong>${phase.role}</strong></span>
            </div>
          ` : '';
        })()}
      </div>
      <div class="e2e-actions">
        <button class="action-btn-sm primary" onclick="copyPhaseAgentPack('${state.selectedE2EPhase}')">
          Copy Phase Agent Pack
        </button>
        <a href="${E2E_PLAYBOOK_URL}" class="action-btn-sm" target="_blank">
          Open Playbook
        </a>
      </div>
    </section>

    <section class="panel wo-list-panel">
      ${wos.length === 0 ? '<p class="empty-text">No MyFi work orders found</p>' : ''}
      <div class="wo-list">
        ${wos.map(w => `
          <div class="wo-card" onclick="showWoDetail('${w.id}')">
            <div class="wo-card-header">
              ${renderStatusChip(w.status)}
              <span class="wo-date">${formatRelativeTime(w.lastUpdated)}</span>
            </div>
            <p class="wo-card-title">${w.title}</p>
            <div class="wo-card-actions">
              <button class="wo-btn" onclick="event.stopPropagation(); showWoDetail('${w.id}')">Details</button>
              <button class="wo-btn secondary" onclick="event.stopPropagation(); copyAgentPack('${w.id}')">Copy Pack</button>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// === Render: Products Tab ===

function renderProductsTab() {
  const products = state.products || [];

  return `
    <section class="panel">
      <h2 class="panel-title-large">&#128230; Products</h2>
      <p class="panel-subtitle">Product visibility filters</p>
    </section>

    <section class="panel">
      <div class="info-card">
        <span class="info-icon">&#128161;</span>
        <p>Products are visibility filters within MyFi. Use them to scope your view to specific product areas.</p>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Available Products</h2>
      ${products.length === 0 ? '<p class="empty-text">No products configured</p>' : ''}
      <div class="product-list">
        ${products.map(p => `
          <div class="product-card ${p.default ? 'default' : ''} ${p.status}">
            <div class="product-header">
              <span class="product-name">${p.name}</span>
              ${p.default ? '<span class="default-badge">Default</span>' : ''}
              <span class="product-status ${p.status}">${p.status}</span>
            </div>
            <p class="product-desc">${p.description || 'No description'}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// === Render: Environments Tab ===

function renderEnvsTab() {
  const envs = state.environments?.environments || {};
  const prod = envs.prod;
  const dev = envs.dev;

  return `
    <section class="panel">
      <h2 class="panel-title-large">&#127760; Environments</h2>
      <p class="panel-subtitle">MyFi deployment environments</p>
    </section>

    <section class="panel">
      <div class="env-cards">
        <div class="env-card-large">
          <div class="env-card-header">
            <span class="env-icon">&#128994;</span>
            <div class="env-info">
              <span class="env-name">Production</span>
              <span class="env-branch">main</span>
            </div>
          </div>
          <a href="${prod?.urls?.myfi || '#'}" class="env-open-btn" target="_blank">
            Open MyFi Prod &#8594;
          </a>
        </div>

        <div class="env-card-large dev">
          <div class="env-card-header">
            <span class="env-icon">&#128309;</span>
            <div class="env-info">
              <span class="env-name">Development</span>
              <span class="env-branch">dev</span>
            </div>
          </div>
          <a href="${dev?.urls?.myfi || '#'}" class="env-open-btn" target="_blank">
            Open MyFi Dev &#8594;
          </a>
        </div>
      </div>
    </section>
  `;
}

// === Render: Escalate Screen ===

function renderEscalateScreen() {
  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('home')">&#8592;</button>
        <h2 class="panel-title">Escalate to Forge</h2>
      </div>
    </section>

    <section class="panel">
      <div class="info-card">
        <span class="info-icon">&#128640;</span>
        <p>When MyFi needs something from Forge (new capability, governance change, etc.), propose it via a Forge Work Order.</p>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Propose Forge Evolution</h2>
      <p class="panel-subtitle">This creates a Work Order in the Forge lane</p>
      <div class="escalate-actions">
        <a href="${FORGE_WO_URL}" class="escalate-btn" target="_blank">
          &#128640; Create Forge Work Order
        </a>
        <p class="escalate-note">
          Use this when MyFi needs:
        </p>
        <ul class="escalate-list">
          <li>New Forge capability</li>
          <li>Change to governance</li>
          <li>Infrastructure support</li>
          <li>Entity-level policy change</li>
        </ul>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">MyFi Documentation</h2>
      <nav class="doc-list">
        <a href="${MYFI_PRODUCT_STATE_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#128196;</span>
          <div class="doc-content">
            <span class="doc-title">Product State</span>
            <span class="doc-desc">Current MyFi status</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
        <a href="${MYFI_PARITY_MATRIX_URL}" class="doc-link" target="_blank">
          <span class="doc-icon">&#128202;</span>
          <div class="doc-content">
            <span class="doc-title">Parity Matrix</span>
            <span class="doc-desc">Migration tracking</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </a>
      </nav>
    </section>
  `;
}

// === Main Render ===

function renderScreen() {
  switch (state.currentScreen) {
    case 'home':
      return renderHomeTab();
    case 'work':
    case 'work-orders':
      return renderWorkTab();
    case 'products':
      return renderProductsTab();
    case 'envs':
      return renderEnvsTab();
    case 'escalate':
      return renderEscalateScreen();
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
        <p>Loading MyFi data...</p>
      </div>
    `;
    return;
  }

  content.innerHTML = renderScreen();
  updateBottomNav();
}

// === Global Functions ===

window.navigateTo = navigateTo;
window.goToForante = goToForante;
window.loadData = loadData;
window.showWoDetail = showWoDetail;
window.closeWoDetail = closeWoDetail;
window.copyAgentPack = copyAgentPack;
window.setE2EPhase = setE2EPhase;
window.copyPhaseAgentPack = copyPhaseAgentPack;

// === Init ===

function init() {
  elements.content = document.getElementById('portal-content');
  loadData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
