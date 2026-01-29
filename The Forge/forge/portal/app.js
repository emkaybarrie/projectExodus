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
const E2E_PLAYBOOK_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/ops/E2E_WORKFLOW_PLAYBOOK.md`;
const AGENT_ONBOARDING_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/contracts/AGENT_ONBOARDING_CONTRACT.md`;
const WO_LIFECYCLE_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/contracts/WORK_ORDER_LIFECYCLE_CONTRACT.md`;
const REPORTING_SIGNALS_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/contracts/REPORTING_SIGNALS_CONTRACT.md`;
const GENOME_CONTRACT_URL = `${REPO_BASE}/blob/main/The%20Forge/forge/contracts/GENOME_CONTRACT.md`;

// Compute Share Pack base URL relative to this script
const SHARE_PACK_BASE = new URL('../exports/share-pack/', import.meta.url).href.replace(/\/$/, '');

// P8: Compute Observations URL relative to this script
const OBSERVATIONS_BASE = new URL('../exports/observations/', import.meta.url).href.replace(/\/$/, '');
const OBSERVATIONS_LATEST_URL = `${OBSERVATIONS_BASE}/latest.json`;

// FCL-1: Forge State Pack URL relative to this script
const COGNITION_BASE = new URL('../exports/cognition/', import.meta.url).href.replace(/\/$/, '');
const FSP_URL = `${COGNITION_BASE}/forge-state-pack.json`;

// FCL-3: Chronicler URL
const CHRONICLER_URL = `${COGNITION_BASE}/chronicler.jsonl`;

// FCL v2: Intents URL
const INTENTS_URL = `${COGNITION_BASE}/intents.json`;

// FCL v2: Intents storage keys
const INTENTS_STORAGE_KEY = 'forge_intents';
const INTENTS_QUEUE_KEY = 'forge_intents_queue';

// Compute data URLs relative to this script
const ENTITIES_URL = new URL('./data/entities.json', import.meta.url).href;
const ENVIRONMENTS_URL = new URL('./data/environments.json', import.meta.url).href;
const PRODUCTS_URL = new URL('./data/products.json', import.meta.url).href;
const WORLDS_URL = new URL('./data/worlds.json', import.meta.url).href;

// M3c: Workflow dispatch URLs
const SHARE_PACK_REFRESH_WORKFLOW = 'forge-share-pack-refresh.yml';
const SHARE_PACK_REFRESH_URL = `${REPO_BASE}/actions/workflows/${SHARE_PACK_REFRESH_WORKFLOW}`;

// M3e: Agent Output Import storage key
const AGENT_OUTPUTS_STORAGE_KEY = 'forge_portal_agent_outputs';

// M3f: Deployment Status cache key
const DEPLOY_STATUS_CACHE_KEY = 'forge_portal_deploy_status_cache';

// M3g: Evolution Proposal storage key
const EVOLUTION_PROPOSALS_STORAGE_KEY = 'forge_portal_evolution_proposals';

// FCL-2: Heartbeat storage key
const HEARTBEAT_STORAGE_KEY = 'forge_portal_heartbeat_result';

// FCL-3: Chronicler queue storage key (entries awaiting flush to file)
const CHRONICLER_QUEUE_KEY = 'forge_portal_chronicler_queue';

// FCL-4: Reflex Rules Definitions
const REFLEX_RULES = [
  {
    id: 'RR-CC-MISSING',
    name: 'Continuation Contract Missing',
    description: 'Executed Work Orders without Continuation Contracts',
    trigger: { source: 'wo_index', frequency: 'on_heartbeat' },
    violation: {
      contract: 'CONTINUATION_CONTRACT.md',
      invariant: 'Executed WOs must have Continuation Contracts',
      severity: 'warning'
    },
    repair: {
      type: 'wo_draft',
      suggestion: 'Add Continuation Contract to the executed WO'
    },
    enforcement: 'hard',  // FCL v2: Escalated in WO-FCL-C2
    enabled: true
  },
  {
    id: 'RR-WO-STUCK',
    name: 'Work Order Stuck',
    description: 'Work Orders unchanged for extended period',
    trigger: { source: 'wo_index', frequency: 'on_heartbeat' },
    violation: {
      contract: 'WORK_ORDER_LIFECYCLE_CONTRACT.md',
      invariant: 'WOs should progress through lifecycle',
      severity: 'caution'
    },
    repair: {
      type: 'manual_action',
      suggestion: 'Review WO and either unblock, update status, or close'
    },
    enforcement: 'soft',  // FCL v2: Advisory only
    enabled: true
  },
  {
    id: 'RR-SMOKE-FAIL',
    name: 'Smoke Tests Failing',
    description: 'Production smoke tests not passing',
    trigger: { source: 'observations', frequency: 'on_heartbeat' },
    violation: {
      contract: 'DEPLOYMENT_CONTRACT.md',
      invariant: 'Production should pass smoke tests',
      severity: 'alert'
    },
    repair: {
      type: 'wo_draft',
      suggestion: 'Investigate and fix smoke test failures'
    },
    enforcement: 'hard',  // FCL v2: Escalated in WO-FCL-C2 — blocks prod deploy
    enabled: true
  },
  {
    id: 'RR-FSP-STALE',
    name: 'Forge State Pack Stale',
    description: 'FSP not refreshed recently',
    trigger: { source: 'fsp', frequency: 'on_load' },
    violation: {
      contract: 'FORGE_STATE_PACK_CONTRACT.md',
      invariant: 'FSP should reflect current state',
      severity: 'info'
    },
    repair: {
      type: 'manual_action',
      suggestion: 'Run generate-fsp.mjs to refresh'
    },
    enforcement: 'soft',  // FCL v2: Advisory only
    enabled: true
  },
  {
    id: 'RR-RISK-UNMITIGATED',
    name: 'High-Severity Risk Unmitigated',
    description: 'Critical or high risks without mitigation',
    trigger: { source: 'fsp', frequency: 'on_heartbeat' },
    violation: {
      contract: 'FORGE_STATE_PACK_CONTRACT.md',
      invariant: 'High-severity risks should have mitigation plans',
      severity: 'warning'
    },
    repair: {
      type: 'wo_draft',
      suggestion: 'Create mitigation plan for high-severity risk'
    },
    enforcement: 'soft',  // FCL v2: Advisory only
    enabled: true
  },
  // === FCL v2 Rules ===
  {
    id: 'RR-DISSONANCE-MISSING',
    name: 'Dissonance Scan Missing',
    description: 'WOs pending approval without dissonance scan',
    trigger: { source: 'wo_index', frequency: 'on_heartbeat' },
    violation: {
      contract: 'WORK_ORDER_LIFECYCLE_CONTRACT.md',
      invariant: 'Dissonance scan required before approval',
      severity: 'warning'
    },
    repair: {
      type: 'manual_action',
      suggestion: 'Run dissonance scan for this WO'
    },
    enforcement: 'hard',  // FCL v2: Escalated in WO-FCL-C2 — blocks approval
    enabled: true
  },
  {
    id: 'RR-PHASE-SKIP',
    name: 'Phase Skip Detected',
    description: 'Attempts to skip lifecycle phases',
    trigger: { source: 'gate_check', frequency: 'continuous' },
    violation: {
      contract: 'WORK_ORDER_LIFECYCLE_CONTRACT.md',
      invariant: 'Phase transitions must be sequential',
      severity: 'alert'
    },
    repair: {
      type: 'manual_action',
      suggestion: 'Complete current phase requirements first'
    },
    enforcement: 'hard',  // FCL v2: Escalated in WO-FCL-C2 — blocks phase skip
    enabled: true
  },
  {
    id: 'RR-GATE-BYPASS',
    name: 'Gate Bypass Attempted',
    description: 'Attempts to bypass authority gates',
    trigger: { source: 'gate_check', frequency: 'continuous' },
    violation: {
      contract: 'FORGE_KERNEL.md',
      invariant: 'Authority gates cannot be bypassed without Director override',
      severity: 'alert'
    },
    repair: {
      type: 'manual_action',
      suggestion: 'Resolve gate condition or request Director override'
    },
    enforcement: 'hard',  // FCL v2: Escalated in WO-FCL-C2 — blocks bypass
    enabled: true
  }
];

// === M4: Repo-Aware Executor Constants ===
const REPO_OWNER = 'emkaybarrie';
const REPO_NAME = 'projectExodus';
const WORKFLOW_REPO_EXECUTOR_ID = 'forge-repo-executor.yml';
const WORKFLOW_REPO_EXECUTOR_URL = `${REPO_BASE}/actions/workflows/${WORKFLOW_REPO_EXECUTOR_ID}`;
const WORKFLOW_DISPATCH_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_REPO_EXECUTOR_ID}/dispatches`;
const WORKFLOW_RUNS_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_REPO_EXECUTOR_ID}/runs`;
const REPO_EXEC_STATUS_CACHE_KEY = 'forge_portal_repo_exec_status_cache';
const USER_GUIDE_URL = new URL('./USER_GUIDE.md', import.meta.url).href;

// M4: Deploy to Prod dispatch constants
const WORKFLOW_DEPLOY_PROD_ID = 'forge-deploy-to-prod.yml';
const WORKFLOW_DEPLOY_PROD_DISPATCH_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_DEPLOY_PROD_ID}/dispatches`;

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

// State
const state = {
  sharePack: null,
  workOrders: null,
  entities: null,
  environments: null,
  products: null,
  observations: null,  // P8: Latest observations data
  observationsError: null,  // P8: Observations load error (for visible feedback)
  forgeStatePack: null,  // FCL-1: Forge State Pack data
  forgeStatePackError: null,  // FCL-1: FSP load error
  agentOutputs: {},  // M3e: Locally stored agent outputs by WO ID
  deployStatusCache: null,  // M3f: Cached deployment status for offline display
  evolutionProposals: {},  // M3g: Locally stored evolution proposals by WO ID
  repoExecStatusCache: null,  // M4: Cached repo executor run status
  heartbeat: null,  // FCL-2: Latest Heartbeat result (IntegrityReport + NextMove)
  heartbeatRunning: false,  // FCL-2: Heartbeat execution in progress
  sentinel: null,  // FCL-3: Latest Sentinel report
  navigator: null,  // FCL-3: Latest Navigator guidance
  chronicler: [],  // FCL-3: Chronicler entries (loaded from file)
  chroniclerQueue: [],  // FCL-3: Queued entries awaiting flush
  reflexWarnings: [],  // FCL-4: Active Reflex Rule warnings
  repairDrafts: [],  // FCL-4: Auto-generated repair WO drafts
  gateMode: 'enforce',  // FCL v2: Gate enforcement mode — ACTIVE (WO-FCL-C3)
  intents: [],  // FCL v2: Director Intents
  worlds: null,  // FCL v2: World registry (worlds.json)
  currentWorld: 'forante',  // FCL v2: Current world context (World Model)
  currentEntity: 'forge',  // DEPRECATED: Use currentWorld. Kept for backward compatibility.
  currentTab: 'command',  // WO-PORTAL-UX-001: Command Centre default
  currentScreen: 'command',  // WO-PORTAL-UX-001: Command Centre default
  woFilter: 'all',
  woLaneFilter: 'all',
  worldFilter: null,  // FCL v2: Filter by world (replaces entityFilter)
  entityFilter: null,  // DEPRECATED: Use worldFilter
  selectedWo: null,  // For detail modal
  selectedE2EPhase: 'executing',  // Default E2E phase
  loading: true,
  error: null,
  errorDetails: null,
  // M4: Feature flags for safe rollback
  flags: {
    m4RepoAware: true  // Enable M4 repo-aware features (set false to hide all M4 UI)
  }
};

// === M4: Environment Detection ===
function detectEnvironment() {
  const url = window.location.href;
  if (url.includes('/dev/')) {
    return { env: 'dev', label: 'Development', class: 'env-dev' };
  }
  // Check if running locally
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('file://')) {
    return { env: 'local', label: 'Local', class: 'env-local' };
  }
  return { env: 'prod', label: 'Production', class: 'env-prod' };
}

function renderEnvironmentBadge() {
  if (!state.flags.m4RepoAware) return '';
  const env = detectEnvironment();
  return `<span class="environment-badge ${env.class}">${env.label}</span>`;
}

// === M3b: PAT Management ===
// SECURITY NOTE: Personal Access Token is stored in localStorage (client-side only).
// - Token is never sent to any server except GitHub API
// - User is responsible for token security
// - Minimum required scope: `repo` (for label management)
// - Recommended: Use fine-grained PAT with only `issues:write` permission

const PAT_STORAGE_KEY = 'forge_portal_github_pat';
const PAT_CONSENT_KEY = 'forge_portal_pat_consent';

function getStoredPAT() {
  try {
    return localStorage.getItem(PAT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function storePAT(token) {
  try {
    localStorage.setItem(PAT_STORAGE_KEY, token);
    return true;
  } catch {
    return false;
  }
}

function clearPAT() {
  try {
    localStorage.removeItem(PAT_STORAGE_KEY);
    localStorage.removeItem(PAT_CONSENT_KEY);
    return true;
  } catch {
    return false;
  }
}

function hasPatConsent() {
  try {
    return localStorage.getItem(PAT_CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

function setPatConsent() {
  try {
    localStorage.setItem(PAT_CONSENT_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

function hasPAT() {
  return !!getStoredPAT();
}

// === M3b: GitHub API Helpers ===

const GITHUB_API_BASE = 'https://api.github.com';
//const REPO_OWNER = 'emkaybarrie';
//const REPO_NAME = 'projectExodus';

async function githubApiRequest(endpoint, method = 'GET', body = null) {
  const token = getStoredPAT();
  if (!token) {
    throw new Error('No GitHub PAT configured');
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${errorText}`);
  }

  // Some endpoints return empty body (204)
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function addLabelToIssue(issueNumber, label) {
  return githubApiRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/labels`,
    'POST',
    { labels: [label] }
  );
}

async function removeLabelFromIssue(issueNumber, label) {
  try {
    return await githubApiRequest(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`,
      'DELETE'
    );
  } catch (e) {
    // Label might not exist, which is fine
    if (e.message.includes('404')) {
      return null;
    }
    throw e;
  }
}

async function addCommentToIssue(issueNumber, body) {
  return githubApiRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments`,
    'POST',
    { body }
  );
}

// === M3b: Director Approval Actions ===

async function approveWorkOrder(wo) {
  // FCL v2: Gate check for approval
  const gateCheck = canApprove(wo.id);
  if (!processGateCheck(gateCheck, 'approve', wo.id)) {
    return false;
  }

  if (!wo.issueNumber) {
    showToast('Cannot approve: No GitHub Issue linked', 'error');
    return false;
  }

  try {
    // Add 'approved' label
    await addLabelToIssue(wo.issueNumber, 'approved');
    // Remove 'pending-approval' label
    await removeLabelFromIssue(wo.issueNumber, 'pending-approval');
    // Add approval comment
    await addCommentToIssue(wo.issueNumber,
      `## ✅ Work Order Approved\n\n` +
      `**Approved via:** Forge Portal\n` +
      `**Timestamp:** ${new Date().toISOString()}\n\n` +
      `This Work Order is now approved for execution.`
    );

    showToast('Work Order approved!', 'success');
    return true;
  } catch (e) {
    showToast(`Approval failed: ${e.message}`, 'error');
    return false;
  }
}

async function rejectWorkOrder(wo, reason = '') {
  if (!wo.issueNumber) {
    showToast('Cannot reject: No GitHub Issue linked', 'error');
    return false;
  }

  try {
    // Add 'rejected' label
    await addLabelToIssue(wo.issueNumber, 'rejected');
    // Remove 'pending-approval' label
    await removeLabelFromIssue(wo.issueNumber, 'pending-approval');
    // Add rejection comment
    await addCommentToIssue(wo.issueNumber,
      `## ❌ Work Order Rejected\n\n` +
      `**Rejected via:** Forge Portal\n` +
      `**Timestamp:** ${new Date().toISOString()}\n` +
      (reason ? `**Reason:** ${reason}\n` : '') +
      `\nThis Work Order has been rejected. Please revise and resubmit.`
    );

    showToast('Work Order rejected', 'success');
    return true;
  } catch (e) {
    showToast(`Rejection failed: ${e.message}`, 'error');
    return false;
  }
}

function copyApprovalCommand(wo) {
  const command = `/approve ${wo.id}`;
  copyToClipboard(command);
  showToast('Approval command copied! Paste in GitHub Issue.', 'success');
}

function copyRejectionCommand(wo) {
  const command = `/reject ${wo.id}`;
  copyToClipboard(command);
  showToast('Rejection command copied! Paste in GitHub Issue.', 'success');
}

// === M3c: Share Pack Refresh Trigger ===

async function triggerSharePackRefresh() {
  const token = getStoredPAT();
  if (!token) {
    showToast('No PAT configured. Use fallback options.', 'error');
    return false;
  }

  try {
    // Trigger forge-pages-deploy.yml which regenerates share pack
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/forge-pages-deploy.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({ ref: 'dev' })
      }
    );

    if (response.status === 204) {
      showToast('Share Pack refresh triggered! Check Actions for progress.', 'success');
      return true;
    } else {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
  } catch (e) {
    showToast(`Refresh failed: ${e.message}`, 'error');
    return false;
  }
}

function showRefreshSharePackModal() {
  const existing = document.getElementById('refresh-sharepack-modal');
  if (existing) existing.remove();

  const hasToken = hasPAT();

  const modal = document.createElement('div');
  modal.id = 'refresh-sharepack-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content refresh-modal">
      <div class="modal-header">
        <h2>Refresh Share Pack</h2>
        <button class="modal-close" onclick="closeRefreshSharePackModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="info-card warning">
          <span class="info-icon">&#9888;</span>
          <div class="info-content">
            <p><strong>This will trigger a deployment on dev branch</strong></p>
            <p>Share Pack indices are regenerated during deployment. This action triggers a dev deploy which will refresh all indices.</p>
            <p><strong>No production impact</strong> — only dev environment is affected.</p>
          </div>
        </div>

        ${hasToken ? `
          <div class="refresh-option primary-option">
            <h4>Direct Trigger (PAT configured)</h4>
            <button class="btn-primary" onclick="handleRefreshSharePack()">
              <span class="action-icon">&#128640;</span> Trigger Dev Deploy
            </button>
            <p class="option-hint">Triggers workflow dispatch for forge-pages-deploy.yml</p>
          </div>
        ` : `
          <div class="refresh-option">
            <h4>No PAT Configured</h4>
            <p>Configure a PAT in <a href="#" onclick="navigateTo('settings'); closeRefreshSharePackModal();">Settings</a> to trigger directly.</p>
          </div>
        `}

        <div class="refresh-option fallback-option">
          <h4>Manual Options</h4>
          <div class="fallback-actions">
            <button class="btn-secondary" onclick="copyRefreshCommand()">
              <span class="action-icon">&#128203;</span> Copy CLI Command
            </button>
            <a href="${REPO_BASE}/actions/workflows/forge-pages-deploy.yml" class="btn-secondary" target="_blank">
              <span class="action-icon">&#8599;</span> Open Actions
            </a>
          </div>
          <p class="option-hint">Run locally or trigger manually from GitHub Actions</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeRefreshSharePackModal();
  });
}

function closeRefreshSharePackModal() {
  const modal = document.getElementById('refresh-sharepack-modal');
  if (modal) modal.remove();
}

async function handleRefreshSharePack() {
  const success = await triggerSharePackRefresh();
  if (success) {
    closeRefreshSharePackModal();
  }
}

function copyRefreshCommand() {
  const command = 'node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"';
  copyToClipboard(command);
  showToast('CLI command copied!', 'success');
}

// === M4: Repo-Aware Executor Dispatch ===

function openRepoExecutorModal(preselectedWoId = null) {
  if (!state.flags.m4RepoAware) {
    showToast('M4 Repo-Aware features are disabled', 'error');
    return;
  }

  const existing = document.getElementById('repo-executor-modal');
  if (existing) existing.remove();

  const workOrders = state.workOrders?.workOrders || [];
  const approvedWos = workOrders.filter(wo =>
    ['approved', 'ready-for-executor', 'executing'].includes(wo.status)
  );

  const modal = document.createElement('div');
  modal.id = 'repo-executor-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content repo-executor-modal">
      <div class="modal-header">
        <h2>Run Repo-Aware Executor</h2>
        <button class="modal-close" onclick="closeRepoExecutorModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="info-card">
          <span class="info-icon">&#129302;</span>
          <p>Dispatch a repo-aware executor job. The workflow will checkout the full repository and create an execution envelope.</p>
        </div>

        <form id="repo-executor-form">
          <div class="exec-form-group">
            <label for="exec-wo-select">Work Order</label>
            <select id="exec-wo-select" required>
              <option value="">Select Work Order...</option>
              ${approvedWos.map(wo => `
                <option value="${wo.id}"
                        data-issue="${wo.issueNumber || ''}"
                        ${preselectedWoId === wo.id ? 'selected' : ''}>
                  ${wo.id} — ${wo.title.substring(0, 40)}${wo.title.length > 40 ? '...' : ''}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="exec-form-group">
            <label for="exec-mode">Mode</label>
            <select id="exec-mode" required>
              <option value="execute">Execute</option>
              <option value="recon">Recon</option>
              <option value="verify">Verify</option>
            </select>
          </div>

          <div class="exec-form-group">
            <label for="exec-branch">Target Branch</label>
            <select id="exec-branch" required>
              <option value="dev" selected>dev</option>
              <option value="main">main</option>
            </select>
          </div>

          <div class="exec-form-group">
            <label for="exec-issue">Issue Number (for status comments)</label>
            <input type="text" id="exec-issue" placeholder="e.g., 123">
            <span class="form-hint">Auto-filled if WO has linked issue</span>
          </div>

          <div class="exec-form-group exec-toggle-group">
            <input type="checkbox" id="exec-dry-run">
            <span>Dry run (no actual execution)</span>
          </div>
        </form>

        <div class="form-actions">
          ${hasPAT() ? `
            <button class="btn-primary" onclick="triggerRepoExecutorDispatch()">
              <span class="action-icon">&#128640;</span> Dispatch Executor
            </button>
          ` : `
            <button class="btn-secondary" onclick="copyRepoExecutorPayload()">
              <span class="action-icon">&#128203;</span> Copy Dispatch Payload
            </button>
          `}
          <a href="${WORKFLOW_REPO_EXECUTOR_URL}" class="btn-secondary" target="_blank">
            <span class="action-icon">&#8599;</span> Open Workflow
          </a>
        </div>

        ${!hasPAT() ? `
          <p class="form-hint center">
            <a href="#" onclick="navigateTo('settings'); closeRepoExecutorModal();">Configure PAT</a> for direct dispatch
          </p>
        ` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Auto-fill issue number when WO is selected
  const woSelect = document.getElementById('exec-wo-select');
  const issueInput = document.getElementById('exec-issue');
  woSelect?.addEventListener('change', () => {
    const selectedOption = woSelect.selectedOptions[0];
    const issueNum = selectedOption?.dataset?.issue;
    if (issueNum && issueInput) {
      issueInput.value = issueNum;
    }
  });

  // Trigger change if preselected
  if (preselectedWoId && woSelect) {
    woSelect.dispatchEvent(new Event('change'));
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeRepoExecutorModal();
  });
}

function closeRepoExecutorModal() {
  const modal = document.getElementById('repo-executor-modal');
  if (modal) modal.remove();
}

function buildDispatchInputsFromForm() {
  const woId = document.getElementById('exec-wo-select')?.value;
  const mode = document.getElementById('exec-mode')?.value;
  const branch = document.getElementById('exec-branch')?.value;
  const issueNumber = document.getElementById('exec-issue')?.value?.trim();
  const dryRun = document.getElementById('exec-dry-run')?.checked;

  if (!woId) {
    showToast('Please select a Work Order', 'error');
    return null;
  }

  return {
    wo_id: woId,
    mode: mode || 'execute',
    target_branch: branch || 'dev',
    issue_number: issueNumber || '',
    dry_run: dryRun ? 'true' : 'false'
  };
}

async function triggerRepoExecutorDispatch() {
  const inputs = buildDispatchInputsFromForm();
  if (!inputs) return;

  // FCL v2: Gate check for repo executor dispatch
  // Validate WO exists and can be executed
  const woId = inputs.wo_id;
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (!wo) {
    const gateCheck = { allowed: false, reason: `Work Order ${woId} not found in index` };
    if (!processGateCheck(gateCheck, 'repo-executor-dispatch', woId)) {
      return;
    }
  } else if (wo.status === 'approved') {
    const gateCheck = canExecute(woId);
    if (!processGateCheck(gateCheck, 'repo-executor-dispatch', woId)) {
      return;
    }
  }

  const token = getStoredPAT();
  if (!token) {
    showToast('No PAT configured. Use Copy Dispatch Payload instead.', 'error');
    return;
  }

  try {
    const response = await fetch(WORKFLOW_DISPATCH_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        ref: inputs.target_branch,
        inputs: inputs
      })
    });

    if (response.status === 204) {
      showToast(`Executor dispatched for ${inputs.wo_id}!`, 'success');
      closeRepoExecutorModal();
      // Refresh execution status after a short delay
      setTimeout(() => loadRepoExecStatus(), 2000);
    } else {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
  } catch (e) {
    console.error('[Portal] Repo executor dispatch failed:', e);
    showToast(`Dispatch failed: ${e.message}`, 'error');
  }
}

function copyRepoExecutorPayload() {
  const inputs = buildDispatchInputsFromForm();
  if (!inputs) return;

  const payload = {
    ref: inputs.target_branch,
    inputs: inputs
  };

  copyToClipboard(JSON.stringify(payload, null, 2));
  showToast('Dispatch payload copied! Use in GitHub Actions manual trigger.', 'success');
}

// M4: Load repo executor run status
async function loadRepoExecStatus() {
  if (!state.flags.m4RepoAware) return;

  const token = getStoredPAT();
  if (!token) {
    // Load from cache if no PAT
    state.repoExecStatusCache = loadRepoExecStatusCache();
    return;
  }

  try {
    const response = await fetch(`${WORKFLOW_RUNS_API_URL}?per_page=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const runs = (data.workflow_runs || []).map(run => ({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      created_at: run.created_at,
      updated_at: run.updated_at,
      html_url: run.html_url,
      head_branch: run.head_branch,
      // Extract WO ID from run name if possible
      wo_id: run.display_title?.match(/wo_id:\s*([^\s,]+)/i)?.[1] || 'Unknown'
    }));

    state.repoExecStatusCache = {
      runs,
      fetchedAt: new Date().toISOString()
    };

    saveRepoExecStatusCache(state.repoExecStatusCache);
  } catch (e) {
    console.warn('[Portal] Failed to load repo exec status:', e);
    // Fall back to cache
    state.repoExecStatusCache = loadRepoExecStatusCache();
  }
}

function loadRepoExecStatusCache() {
  try {
    const stored = localStorage.getItem(REPO_EXEC_STATUS_CACHE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveRepoExecStatusCache(data) {
  try {
    localStorage.setItem(REPO_EXEC_STATUS_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Portal] Failed to save repo exec status cache:', e);
  }
}

// === M3e: Agent Output Import ===

function parseAgentOutput(rawOutput, mode = 'minimal') {
  const output = {
    raw: rawOutput,
    parsed: null,
    parseMode: mode,
    timestamp: new Date().toISOString()
  };

  if (mode === 'structured') {
    // Attempt to extract common sections (conservative parsing)
    const sections = {};

    // Try to extract Summary
    const summaryMatch = rawOutput.match(/(?:^|\n)#+\s*Summary[:\s]*\n([\s\S]*?)(?=\n#+|$)/i);
    if (summaryMatch) sections.summary = summaryMatch[1].trim();

    // Try to extract Files Changed/Modified/Created
    const filesMatch = rawOutput.match(/(?:^|\n)#+\s*(?:Files?\s+(?:Changed|Modified|Created)|Changes)[:\s]*\n([\s\S]*?)(?=\n#+|$)/i);
    if (filesMatch) sections.filesChanged = filesMatch[1].trim();

    // Try to extract Risks/Issues
    const risksMatch = rawOutput.match(/(?:^|\n)#+\s*(?:Risks?|Issues?|Concerns?)[:\s]*\n([\s\S]*?)(?=\n#+|$)/i);
    if (risksMatch) sections.risks = risksMatch[1].trim();

    // Try to extract Next Steps/Follow-up WOs
    const nextMatch = rawOutput.match(/(?:^|\n)#+\s*(?:Next\s+(?:Steps?|WOs?)|Follow-?up)[:\s]*\n([\s\S]*?)(?=\n#+|$)/i);
    if (nextMatch) sections.nextSteps = nextMatch[1].trim();

    // Try to extract Test Results
    const testMatch = rawOutput.match(/(?:^|\n)#+\s*(?:Test\s+Results?|Testing)[:\s]*\n([\s\S]*?)(?=\n#+|$)/i);
    if (testMatch) sections.testResults = testMatch[1].trim();

    // Only set parsed if we found at least one section
    if (Object.keys(sections).length > 0) {
      output.parsed = sections;
    }
  }

  return output;
}

function saveAgentOutput(woId, agentType, output, attachments = []) {
  const entry = {
    woId,
    agentType,
    output,
    attachments,
    savedAt: new Date().toISOString()
  };

  const outputs = state.agentOutputs || {};
  if (!outputs[woId]) {
    outputs[woId] = [];
  }
  outputs[woId].push(entry);

  // Keep only last 10 outputs per WO to prevent unbounded growth
  if (outputs[woId].length > 10) {
    outputs[woId] = outputs[woId].slice(-10);
  }

  state.agentOutputs = outputs;
  saveAgentOutputs(outputs);

  return entry;
}

function getAgentOutputsForWO(woId) {
  return state.agentOutputs?.[woId] || [];
}

function formatAgentOutputForGitHub(entry) {
  const { woId, agentType, output, attachments, savedAt } = entry;

  let comment = `## Agent Execution Report\n\n`;
  comment += `**Work Order:** ${woId}\n`;
  comment += `**Agent Type:** ${agentType}\n`;
  comment += `**Timestamp:** ${savedAt}\n`;
  comment += `**Parse Mode:** ${output.parseMode}\n\n`;

  comment += `---\n\n`;

  if (output.parsed) {
    if (output.parsed.summary) {
      comment += `### Summary\n${output.parsed.summary}\n\n`;
    }
    if (output.parsed.filesChanged) {
      comment += `### Files Changed\n${output.parsed.filesChanged}\n\n`;
    }
    if (output.parsed.testResults) {
      comment += `### Test Results\n${output.parsed.testResults}\n\n`;
    }
    if (output.parsed.risks) {
      comment += `### Risks/Issues\n${output.parsed.risks}\n\n`;
    }
    if (output.parsed.nextSteps) {
      comment += `### Next Steps\n${output.parsed.nextSteps}\n\n`;
    }
  }

  comment += `### Raw Output\n\`\`\`\n${output.raw.substring(0, 5000)}${output.raw.length > 5000 ? '\n... (truncated)' : ''}\n\`\`\`\n\n`;

  if (attachments && attachments.length > 0) {
    comment += `### Attachments\n`;
    attachments.forEach(url => {
      comment += `- ${url}\n`;
    });
    comment += `\n`;
  }

  comment += `---\n*Submitted via Forge Portal*`;

  return comment;
}

async function submitAgentOutputToGitHub(woId, entry) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (!wo || !wo.issueNumber) {
    showToast('Cannot submit: No GitHub Issue linked to this WO', 'error');
    return false;
  }

  if (!hasPAT()) {
    showToast('No PAT configured. Use "Copy for GitHub" instead.', 'error');
    return false;
  }

  try {
    const comment = formatAgentOutputForGitHub(entry);
    await addCommentToIssue(wo.issueNumber, comment);
    showToast('Agent output posted to GitHub!', 'success');
    return true;
  } catch (e) {
    showToast(`Failed to post: ${e.message}`, 'error');
    return false;
  }
}

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

// FCL v2: Load worlds registry (World Model)
async function loadWorlds() {
  try {
    const res = await fetch(WORLDS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[Portal] Failed to load worlds:', e);
    return null;
  }
}

// FCL v2: Get current world object
function getCurrentWorld() {
  const worlds = state.worlds?.worlds || [];
  return worlds.find(w => w.id === state.currentWorld) || null;
}

// FCL v2: Get products for current world
function getProductsForWorld(worldId) {
  const products = state.worlds?.products || [];
  return products.filter(p => p.world === worldId);
}

// FCL v2: Get sub-worlds for a world
function getSubWorlds(worldId) {
  const worlds = state.worlds?.worlds || [];
  return worlds.filter(w => w.parentWorld === worldId);
}

// FCL v2: Check if user can travel to a world
function canTravelToWorld(targetWorldId) {
  const currentWorld = getCurrentWorld();
  const targetWorld = state.worlds?.worlds?.find(w => w.id === targetWorldId);

  if (!targetWorld) return { allowed: false, reason: 'World not found' };

  // Downward travel: always allowed (to sub-worlds)
  if (targetWorld.parentWorld === state.currentWorld) {
    return { allowed: true, direction: 'downward' };
  }

  // Upward travel: allowed if target is parent (for Directors)
  if (currentWorld?.parentWorld === targetWorldId) {
    return { allowed: true, direction: 'upward' };
  }

  // Sibling or distant travel: check if same parent
  if (currentWorld?.parentWorld && currentWorld.parentWorld === targetWorld.parentWorld) {
    return { allowed: true, direction: 'sibling' };
  }

  // Root world travel
  if (targetWorldId === 'forante') {
    return { allowed: true, direction: 'root' };
  }

  return { allowed: false, reason: 'Travel not permitted' };
}

// FCL v2: Enter a world (travel)
function enterWorld(worldId) {
  const check = canTravelToWorld(worldId);
  if (!check.allowed) {
    showToast(`Cannot enter world: ${check.reason}`, 'error');
    return false;
  }

  // Trigger world travel transition
  const portal = document.querySelector('.portal');
  const content = document.getElementById('portal-content');

  if (portal && content) {
    portal.setAttribute('data-transitioning', 'true');
    content.classList.add('world-exiting');

    // Dramatic exit timing (400ms)
    setTimeout(() => {
      state.currentWorld = worldId;
      // Sync legacy state for backward compatibility
      state.currentEntity = worldId === 'forante' ? 'forge' : worldId;
      state.worldFilter = worldId;

      // Navigate to command screen for the world
      navigateTo('command');

      content.classList.remove('world-exiting');
      content.classList.add('world-entering');

      // Dramatic enter timing (600ms)
      setTimeout(() => {
        content.classList.remove('world-entering');
        portal.removeAttribute('data-transitioning');
      }, 600);

      showToast(`Entered ${getCurrentWorld()?.name || worldId}`, 'success');
    }, 400);
  } else {
    // Fallback without animation
    state.currentWorld = worldId;
    state.currentEntity = worldId === 'forante' ? 'forge' : worldId;
    state.worldFilter = worldId;
    navigateTo('command');
    showToast(`Entered ${getCurrentWorld()?.name || worldId}`, 'success');
  }

  return true;
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

// P8: Load observations data
async function loadObservations() {
  try {
    const res = await fetch(OBSERVATIONS_LATEST_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('[Portal] Observations loaded:', data.env, data.smokePass ? 'PASS' : 'FAIL');
    return { data, error: null };
  } catch (e) {
    console.warn('[Portal] Failed to load observations:', e.message);
    // Return error info for visible feedback (not silent)
    return { data: null, error: e.message };
  }
}

// FCL-1: Load Forge State Pack
async function loadForgeStatePack() {
  try {
    const res = await fetch(FSP_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('[Portal] Forge State Pack loaded:', data.activeArc?.current, 'arc');
    return { data, error: null };
  } catch (e) {
    console.warn('[Portal] Failed to load Forge State Pack:', e.message);
    return { data: null, error: e.message };
  }
}

// === FCL-2: Heartbeat Functions ===

// Load cached Heartbeat result from localStorage
function loadHeartbeat() {
  try {
    const stored = localStorage.getItem(HEARTBEAT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('[Portal] Failed to load Heartbeat:', e);
    return null;
  }
}

// Save Heartbeat result to localStorage
function saveHeartbeat(result) {
  try {
    localStorage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify(result));
    return true;
  } catch (e) {
    console.warn('[Portal] Failed to save Heartbeat:', e);
    return false;
  }
}

// Clear Heartbeat result
function clearHeartbeat() {
  try {
    localStorage.removeItem(HEARTBEAT_STORAGE_KEY);
    state.heartbeat = null;
    render();
    return true;
  } catch (e) {
    console.warn('[Portal] Failed to clear Heartbeat:', e);
    return false;
  }
}

// Run Heartbeat: Assess FSP and produce Integrity Report + Next Move
async function runHeartbeat() {
  const fsp = state.forgeStatePack;

  // Cannot run without FSP
  if (!fsp) {
    console.warn('[Portal] Cannot run Heartbeat: FSP unavailable');
    return null;
  }

  state.heartbeatRunning = true;
  render();

  const now = new Date().toISOString();
  const arc = fsp.activeArc?.current || 'Reliability';

  // Assess health signals
  const healthSignals = [];
  let healthScore = 100;

  // 1. Work Orders assessment
  const wo = fsp.workOrders || {};
  const stuckCount = wo.stuckWOs?.length || 0;
  const missingGatesCount = wo.missingGates?.length || 0;

  if (stuckCount > 0) {
    healthSignals.push({
      domain: 'workOrders',
      status: 'at_risk',
      indicator: `${stuckCount} Work Order(s) detected as stuck`,
      details: 'WOs unchanged for extended period may indicate blockers'
    });
    healthScore -= 10;
  } else if (missingGatesCount > 0) {
    healthSignals.push({
      domain: 'workOrders',
      status: 'at_risk',
      indicator: `${missingGatesCount} executed WO(s) missing continuation gates`,
      details: 'Continuation Contracts improve traceability'
    });
    healthScore -= 5;
  } else {
    healthSignals.push({
      domain: 'workOrders',
      status: 'healthy',
      indicator: 'Work Order flow appears healthy',
      details: `${wo.total || 0} total WOs tracked`
    });
  }

  // 2. Observations assessment
  const obs = fsp.observations || {};
  const obsTimestamp = obs.timestamp ? new Date(obs.timestamp) : null;
  const obsAge = obsTimestamp ? (Date.now() - obsTimestamp.getTime()) / (1000 * 60 * 60) : null;

  if (!obs.smokePass) {
    healthSignals.push({
      domain: 'observations',
      status: 'degraded',
      indicator: 'Smoke tests not passing',
      details: 'Production stability may be at risk'
    });
    healthScore -= 20;
  } else if (obsAge && obsAge > 48) {
    healthSignals.push({
      domain: 'observations',
      status: 'at_risk',
      indicator: 'Observations data may be stale',
      details: `Last observation ${Math.round(obsAge)} hours ago`
    });
    healthScore -= 10;
  } else {
    healthSignals.push({
      domain: 'observations',
      status: 'healthy',
      indicator: 'Smoke tests passing',
      details: obs.env ? `Environment: ${obs.env}` : null
    });
  }

  // 3. Risks assessment
  const risks = fsp.risks || [];
  const risksBySeverity = {
    critical: risks.filter(r => r.severity === 'critical' && r.status !== 'resolved').length,
    high: risks.filter(r => r.severity === 'high' && r.status !== 'resolved').length,
    medium: risks.filter(r => r.severity === 'medium' && r.status !== 'resolved').length,
    low: risks.filter(r => r.severity === 'low' && r.status !== 'resolved').length
  };
  const activeRisks = risks.filter(r => r.status !== 'resolved');
  const topRisk = activeRisks.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
  })[0] || null;

  if (risksBySeverity.critical > 0) {
    healthSignals.push({
      domain: 'risks',
      status: 'degraded',
      indicator: `${risksBySeverity.critical} critical risk(s) detected`,
      details: topRisk?.description || null
    });
    healthScore -= 20;
  } else if (risksBySeverity.high > 0) {
    healthSignals.push({
      domain: 'risks',
      status: 'at_risk',
      indicator: `${risksBySeverity.high} high severity risk(s) detected`,
      details: topRisk?.description || null
    });
    healthScore -= 10;
  } else if (activeRisks.length > 0) {
    healthSignals.push({
      domain: 'risks',
      status: 'at_risk',
      indicator: `${activeRisks.length} active risk(s) acknowledged`,
      details: 'Risks are tracked and under observation'
    });
    healthScore -= 5;
  } else {
    healthSignals.push({
      domain: 'risks',
      status: 'healthy',
      indicator: 'No active risks detected',
      details: null
    });
  }

  // 4. Genome assessment
  const genome = fsp.genome || {};
  const experimentalCount = genome.experimental?.length || 0;
  const graduationCount = genome.graduationPending?.length || 0;

  if (graduationCount > 0) {
    healthSignals.push({
      domain: 'genome',
      status: 'at_risk',
      indicator: `${graduationCount} artifact(s) pending graduation`,
      details: 'Consider reviewing for promotion to stable'
    });
    healthScore -= 5;
  } else {
    healthSignals.push({
      domain: 'genome',
      status: 'healthy',
      indicator: 'Genome classification current',
      details: `${genome.stable?.length || 0} stable, ${experimentalCount} experimental`
    });
  }

  // 5. Agent binding assessment
  const agentRules = fsp.agentBindingRules || [];
  const mandatoryRules = agentRules.filter(r => r.enforcement === 'mandatory');

  if (mandatoryRules.length === 0) {
    healthSignals.push({
      domain: 'agents',
      status: 'at_risk',
      indicator: 'No mandatory agent binding rules defined',
      details: 'Agent governance may be unclear'
    });
    healthScore -= 10;
  } else {
    healthSignals.push({
      domain: 'agents',
      status: 'healthy',
      indicator: `${mandatoryRules.length} mandatory binding rules active`,
      details: null
    });
  }

  // Compute overall health
  const degradedCount = healthSignals.filter(s => s.status === 'degraded').length;
  const atRiskCount = healthSignals.filter(s => s.status === 'at_risk').length;

  let overallHealth = 'healthy';
  if (degradedCount > 0) {
    overallHealth = 'degraded';
  } else if (atRiskCount > 0) {
    overallHealth = 'at_risk';
  }

  // Clamp health score
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Generate arc-aware tone
  const arcTones = {
    'Reliability': 'Under the Reliability arc, system stability and correctness take precedence.',
    'Velocity': 'Under the Velocity arc, throughput and reduced friction are prioritized.',
    'Delight': 'Under the Delight arc, user experience and polish receive focus.'
  };

  // Build Integrity Report
  const integrityReport = {
    reportType: 'IntegrityReport',
    schemaVersion: '1.0.0',
    generatedAt: now,
    fspVersion: fsp.schemaVersion || 'unknown',
    fspGeneratedAt: fsp.generatedAt || null,

    activeArc: {
      current: arc,
      coherent: true,
      note: fsp.activeArc?.rationale || null
    },

    healthSignals,

    riskSummary: {
      total: activeRisks.length,
      bySeverity: risksBySeverity,
      topRisk: topRisk ? {
        id: topRisk.id,
        description: topRisk.description
      } : null
    },

    overallHealth,
    healthScore,
    tone: arcTones[arc] || arcTones['Reliability']
  };

  // Generate Next Move
  const nextMove = generateNextMove(fsp, healthSignals, arc, now);

  // Combine result
  const result = {
    integrityReport,
    nextMove,
    generatedAt: now
  };

  // Save and update state
  saveHeartbeat(result);
  state.heartbeat = result;
  state.heartbeatRunning = false;

  // FCL-3: Run cognitive routines as part of Heartbeat
  runSentinel();
  runNavigator();

  // FCL-3: Record Heartbeat to Chronicler
  recordHeartbeatEntry(result);

  // FCL-4: Re-evaluate Reflex Rules after Heartbeat
  evaluateReflexRules();

  console.log('[Portal] Heartbeat complete:', overallHealth, `(${healthScore}/100)`);
  render();

  return result;
}

// Generate single Next Move recommendation
function generateNextMove(_fsp, healthSignals, arc, now) {
  const candidates = [];

  // Analyze signals for potential moves
  for (const signal of healthSignals) {
    if (signal.status === 'degraded') {
      candidates.push({
        domain: signal.domain,
        severity: 3,
        action: getMoveAction(signal.domain, 'degraded'),
        rationale: signal.indicator,
        triggeredBy: signal.indicator
      });
    } else if (signal.status === 'at_risk') {
      candidates.push({
        domain: signal.domain,
        severity: 2,
        action: getMoveAction(signal.domain, 'at_risk'),
        rationale: signal.indicator,
        triggeredBy: signal.indicator
      });
    }
  }

  // If no issues, recommend maintenance
  if (candidates.length === 0) {
    return {
      moveType: 'NextMove',
      schemaVersion: '1.0.0',
      generatedAt: now,
      recommendation: {
        action: 'Continue current work',
        rationale: 'All health signals are positive. The system is operating normally.',
        arc_alignment: `Under ${arc}, maintaining current trajectory is appropriate.`,
        priority: 'when_available'
      },
      context: {
        triggeredBy: 'All signals healthy',
        alternatives_considered: 0,
        confidence: 'high'
      },
      tone: 'No immediate concerns detected. Consider reviewing the next approved Work Order.'
    };
  }

  // Sort by severity (highest first)
  candidates.sort((a, b) => b.severity - a.severity);

  // Select top candidate
  const top = candidates[0];
  const priority = top.severity === 3 ? 'immediate' : 'soon';

  // Arc-aligned framing
  const arcFraming = {
    'Reliability': `To maintain system correctness under ${arc}`,
    'Velocity': `To reduce friction under ${arc}`,
    'Delight': `To improve experience under ${arc}`
  };

  return {
    moveType: 'NextMove',
    schemaVersion: '1.0.0',
    generatedAt: now,
    recommendation: {
      action: top.action,
      rationale: top.rationale,
      arc_alignment: `${arcFraming[arc] || arcFraming['Reliability']}, addressing this is recommended.`,
      priority
    },
    context: {
      triggeredBy: top.triggeredBy,
      alternatives_considered: candidates.length - 1,
      confidence: top.severity === 3 ? 'high' : 'medium'
    },
    tone: `Detected: ${top.rationale}. Consider addressing ${priority === 'immediate' ? 'before other work' : 'during this session'}.`
  };
}

// Get recommended action for domain + status
function getMoveAction(domain, status) {
  const actions = {
    workOrders: {
      degraded: 'Review and unblock stuck Work Orders',
      at_risk: 'Add missing continuation gates to executed WOs'
    },
    observations: {
      degraded: 'Investigate smoke test failures',
      at_risk: 'Run a deployment to refresh observations'
    },
    risks: {
      degraded: 'Address critical risks immediately',
      at_risk: 'Review and mitigate high-severity risks'
    },
    genome: {
      degraded: 'Review experimental artifacts for stability',
      at_risk: 'Consider graduating pending artifacts'
    },
    agents: {
      degraded: 'Define agent binding rules',
      at_risk: 'Review agent governance configuration'
    }
  };

  return actions[domain]?.[status] || 'Review system health';
}

// === FCL-3: Cognitive Routines ===

// --- Sentinel: Health Monitoring ---

function runSentinel() {
  const fsp = state.forgeStatePack;
  if (!fsp) {
    console.warn('[Portal] Cannot run Sentinel: FSP unavailable');
    return null;
  }

  const now = new Date().toISOString();
  const arc = fsp.activeArc?.current || 'Reliability';
  const watchedDomains = [];
  const activeWarnings = [];

  // Watch Work Orders
  const wo = fsp.workOrders || {};
  const stuckCount = wo.stuckWOs?.length || 0;
  const missingGatesCount = wo.missingGates?.length || 0;

  if (stuckCount > 0) {
    watchedDomains.push({
      domain: 'workOrders',
      status: 'warning',
      indicator: `${stuckCount} stuck WO(s) detected`,
      details: 'Work Orders unchanged for extended period',
      since: null
    });
    activeWarnings.push({
      id: `warn-wo-stuck-${Date.now()}`,
      domain: 'workOrders',
      level: 'warning',
      message: `${stuckCount} Work Order(s) appear stuck`,
      suggestedAction: 'Review stuck WOs for blockers',
      detectedAt: now
    });
  } else if (missingGatesCount > 0) {
    watchedDomains.push({
      domain: 'workOrders',
      status: 'watching',
      indicator: `${missingGatesCount} WO(s) missing gates`,
      details: 'Continuation contracts recommended',
      since: null
    });
    activeWarnings.push({
      id: `warn-wo-gates-${Date.now()}`,
      domain: 'workOrders',
      level: 'caution',
      message: `${missingGatesCount} executed WO(s) lack continuation gates`,
      suggestedAction: 'Consider adding continuation contracts',
      detectedAt: now
    });
  } else {
    watchedDomains.push({
      domain: 'workOrders',
      status: 'clear',
      indicator: 'WO flow healthy',
      details: `${wo.total || 0} WOs tracked`,
      since: null
    });
  }

  // Watch Observations
  const obs = fsp.observations || {};
  if (!obs.smokePass) {
    watchedDomains.push({
      domain: 'observations',
      status: 'alert',
      indicator: 'Smoke tests not passing',
      details: 'Production stability at risk',
      since: null
    });
    activeWarnings.push({
      id: `warn-smoke-fail-${Date.now()}`,
      domain: 'observations',
      level: 'alert',
      message: 'Smoke tests not passing',
      suggestedAction: 'Investigate deployment health',
      detectedAt: now
    });
  } else {
    const obsAge = obs.timestamp ? (Date.now() - new Date(obs.timestamp).getTime()) / (1000 * 60 * 60) : null;
    if (obsAge && obsAge > 48) {
      watchedDomains.push({
        domain: 'observations',
        status: 'watching',
        indicator: 'Observations may be stale',
        details: `Last updated ${Math.round(obsAge)}h ago`,
        since: null
      });
    } else {
      watchedDomains.push({
        domain: 'observations',
        status: 'clear',
        indicator: 'Smoke tests passing',
        details: obs.env ? `Environment: ${obs.env}` : null,
        since: null
      });
    }
  }

  // Watch Risks
  const risks = fsp.risks || [];
  const activeRisks = risks.filter(r => r.status !== 'resolved');
  const criticalRisks = activeRisks.filter(r => r.severity === 'critical');
  const highRisks = activeRisks.filter(r => r.severity === 'high');

  if (criticalRisks.length > 0) {
    watchedDomains.push({
      domain: 'risks',
      status: 'alert',
      indicator: `${criticalRisks.length} critical risk(s)`,
      details: criticalRisks[0]?.description,
      since: null
    });
    activeWarnings.push({
      id: `warn-risk-critical-${Date.now()}`,
      domain: 'risks',
      level: 'alert',
      message: `Critical risk detected: ${criticalRisks[0]?.description}`,
      suggestedAction: 'Address critical risks promptly',
      detectedAt: now
    });
  } else if (highRisks.length > 0) {
    watchedDomains.push({
      domain: 'risks',
      status: 'warning',
      indicator: `${highRisks.length} high-severity risk(s)`,
      details: highRisks[0]?.description,
      since: null
    });
  } else if (activeRisks.length > 0) {
    watchedDomains.push({
      domain: 'risks',
      status: 'watching',
      indicator: `${activeRisks.length} risk(s) under observation`,
      details: 'Risks acknowledged',
      since: null
    });
  } else {
    watchedDomains.push({
      domain: 'risks',
      status: 'clear',
      indicator: 'No active risks',
      details: null,
      since: null
    });
  }

  // Watch FSP freshness
  const fspAge = fsp.generatedAt ? (Date.now() - new Date(fsp.generatedAt).getTime()) / (1000 * 60 * 60) : null;
  if (fspAge && fspAge > 24) {
    watchedDomains.push({
      domain: 'fsp',
      status: 'watching',
      indicator: 'FSP may need refresh',
      details: `Generated ${Math.round(fspAge)}h ago`,
      since: null
    });
  } else {
    watchedDomains.push({
      domain: 'fsp',
      status: 'clear',
      indicator: 'FSP current',
      details: `v${fsp.schemaVersion}`,
      since: null
    });
  }

  // Compute overall status
  const hasAlert = watchedDomains.some(d => d.status === 'alert');
  const hasWarning = watchedDomains.some(d => d.status === 'warning');
  const hasWatching = watchedDomains.some(d => d.status === 'watching');

  let overallStatus = 'clear';
  if (hasAlert) overallStatus = 'alert';
  else if (hasWarning) overallStatus = 'warning';
  else if (hasWatching) overallStatus = 'watching';

  const arcTones = {
    'Reliability': 'Under Reliability, stability signals take priority.',
    'Velocity': 'Under Velocity, flow impediments are highlighted.',
    'Delight': 'Under Delight, user-facing concerns are emphasized.'
  };

  const report = {
    reportType: 'SentinelReport',
    schemaVersion: '1.0.0',
    generatedAt: now,
    watchedDomains,
    activeWarnings,
    overallStatus,
    warningCount: activeWarnings.length,
    tone: arcTones[arc] || arcTones['Reliability']
  };

  state.sentinel = report;
  console.log('[Portal] Sentinel report:', overallStatus, `(${activeWarnings.length} warnings)`);
  return report;
}

// --- Navigator: Prioritization Guidance ---

function runNavigator() {
  const fsp = state.forgeStatePack;
  const sentinel = state.sentinel || runSentinel();

  if (!fsp) {
    console.warn('[Portal] Cannot run Navigator: FSP unavailable');
    return null;
  }

  const now = new Date().toISOString();
  const arc = fsp.activeArc?.current || 'Reliability';
  const wo = fsp.workOrders || {};
  const risks = fsp.risks || [];

  // Gather inputs
  const inputsUsed = {
    fspVersion: fsp.schemaVersion || 'unknown',
    fspGeneratedAt: fsp.generatedAt,
    activeArc: arc,
    sentinelWarnings: sentinel?.warningCount || 0,
    approvedWOs: wo.byStatus?.approved || 0,
    stuckWOs: wo.stuckWOs?.length || 0,
    activeRisks: risks.filter(r => r.status !== 'resolved').length
  };

  // Build candidates from various sources
  const candidates = [];

  // From Sentinel warnings
  if (sentinel?.activeWarnings) {
    for (const warning of sentinel.activeWarnings) {
      const priority = warning.level === 'alert' ? 3 : warning.level === 'warning' ? 2 : 1;
      candidates.push({
        action: warning.suggestedAction,
        rationale: warning.message,
        source: 'sentinel',
        priority,
        domain: warning.domain
      });
    }
  }

  // From WO queue
  if (inputsUsed.approvedWOs > 0) {
    candidates.push({
      action: 'Execute next approved Work Order',
      rationale: `${inputsUsed.approvedWOs} approved WO(s) awaiting execution`,
      source: 'workOrders',
      priority: 1,
      domain: 'workOrders'
    });
  }

  // Arc-based weighting
  const arcWeights = {
    'Reliability': { risks: 1.5, observations: 1.3, workOrders: 1.0 },
    'Velocity': { workOrders: 1.5, risks: 1.0, observations: 1.0 },
    'Delight': { workOrders: 1.2, observations: 1.0, risks: 0.8 }
  };
  const weights = arcWeights[arc] || arcWeights['Reliability'];

  // Apply weights and sort
  candidates.forEach(c => {
    c.weightedPriority = c.priority * (weights[c.domain] || 1.0);
  });
  candidates.sort((a, b) => b.weightedPriority - a.weightedPriority);

  // Select primary
  const primary = candidates[0];
  const alternatives = candidates.slice(1, 4).map(c => ({
    action: c.action,
    reason_not_primary: `Lower priority (${c.source})`
  }));

  // Build WO suggestions (structured, not drafts)
  const woSuggestions = [];
  if (sentinel?.activeWarnings?.length > 0) {
    const topWarning = sentinel.activeWarnings[0];
    woSuggestions.push({
      type: 'repair',
      title: `Address: ${topWarning.message}`,
      rationale: topWarning.suggestedAction,
      draft: false
    });
  }

  const arcFraming = {
    'Reliability': 'aligns with stability and correctness priorities',
    'Velocity': 'supports throughput and reduced friction',
    'Delight': 'contributes to improved user experience'
  };

  const guidance = {
    guidanceType: 'NavigatorGuidance',
    schemaVersion: '1.0.0',
    generatedAt: now,
    inputsUsed,
    primaryRecommendation: primary ? {
      action: primary.action,
      rationale: primary.rationale,
      arc_alignment: `This ${arcFraming[arc] || arcFraming['Reliability']}.`,
      priority: primary.priority >= 3 ? 'immediate' : primary.priority >= 2 ? 'soon' : 'when_available',
      confidence: primary.priority >= 2 ? 'high' : 'medium'
    } : {
      action: 'Continue current work',
      rationale: 'No pressing items detected',
      arc_alignment: 'Steady progress aligns with current arc.',
      priority: 'when_available',
      confidence: 'high'
    },
    alternativesConsidered: alternatives,
    workOrderSuggestions: woSuggestions,
    arcContext: {
      current: arc,
      influence: `Under ${arc}, ${arcFraming[arc] || 'balanced priorities apply'}.`
    },
    tone: primary
      ? `Consider focusing on: ${primary.action}`
      : 'No immediate attention required. Continue steady progress.'
  };

  state.navigator = guidance;
  console.log('[Portal] Navigator guidance:', guidance.primaryRecommendation?.action);
  return guidance;
}

// --- Chronicler: Institutional Memory ---

// Load Chronicler entries from file
async function loadChronicler() {
  try {
    const res = await fetch(CHRONICLER_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n').filter(line => line.trim());
    const entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    console.log('[Portal] Chronicler loaded:', entries.length, 'entries');
    return entries;
  } catch (e) {
    console.warn('[Portal] Failed to load Chronicler:', e.message);
    return [];
  }
}

// Load queued entries from localStorage
function loadChroniclerQueue() {
  try {
    const stored = localStorage.getItem(CHRONICLER_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.warn('[Portal] Failed to load Chronicler queue:', e);
    return [];
  }
}

// Save queue to localStorage
function saveChroniclerQueue(queue) {
  try {
    localStorage.setItem(CHRONICLER_QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (e) {
    console.warn('[Portal] Failed to save Chronicler queue:', e);
    return false;
  }
}

// Generate unique entry ID
function generateChroniclerEntryId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `chr-${timestamp}-${random}`;
}

// Record a Chronicler entry (queues locally)
function recordChroniclerEntry(eventType, domain, summary, details = {}, contextOverrides = {}) {
  const fsp = state.forgeStatePack;
  const entry = {
    entryType: 'ChroniclerEntry',
    schemaVersion: '2.0.0',
    id: generateChroniclerEntryId(),
    timestamp: new Date().toISOString(),
    eventType,
    domain,
    summary,
    details,
    context: {
      activeArc: fsp?.activeArc?.current || 'unknown',
      fspVersion: fsp?.schemaVersion || 'unknown',
      healthScore: state.heartbeat?.integrityReport?.healthScore || null,
      // FCL v2: Intent-aware context (additive)
      intentId: contextOverrides.intentId || null,
      woId: contextOverrides.woId || null,
      phase: contextOverrides.phase || null
    },
    source: contextOverrides.source || 'portal',
    actor: contextOverrides.actor || 'director'
  };

  // Add to local state
  state.chronicler = [...state.chronicler, entry];
  state.chroniclerQueue = [...state.chroniclerQueue, entry];

  // Persist queue
  saveChroniclerQueue(state.chroniclerQueue);

  console.log('[Portal] Chronicler entry recorded:', entry.id, eventType);
  render();
  return entry;
}

// Record Heartbeat completion
function recordHeartbeatEntry(heartbeat) {
  const ir = heartbeat.integrityReport;
  const nm = heartbeat.nextMove;
  return recordChroniclerEntry(
    'heartbeat',
    'system',
    `Heartbeat: ${ir.overallHealth} (${ir.healthScore}/100)`,
    {
      overallHealth: ir.overallHealth,
      healthScore: ir.healthScore,
      warningCount: ir.healthSignals?.filter(s => s.status !== 'healthy').length || 0,
      nextMove: nm.recommendation?.action || 'none'
    }
  );
}

// Add manual note
function addChroniclerNote(note) {
  if (!note || !note.trim()) return null;
  return recordChroniclerEntry(
    'manual_note',
    'system',
    note.trim(),
    { note: note.trim() }
  );
}

// Get recent entries (combined file + queue)
function getRecentChroniclerEntries(limit = 10) {
  const all = [...state.chronicler];
  // Sort by timestamp descending
  all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return all.slice(0, limit);
}

// Export queue as JSONL for manual flush
function exportChroniclerQueue() {
  const queue = state.chroniclerQueue || [];
  if (queue.length === 0) {
    console.log('[Portal] No entries in queue to export');
    return '';
  }
  return queue.map(entry => JSON.stringify(entry)).join('\n');
}

// === FCL v2: Chronicler Retrieval & Synthesis ===

// Query entries by Intent ID
function getEntriesByIntent(intentId, limit = null) {
  const entries = state.chronicler || [];
  const filtered = entries.filter(e => e.context?.intentId === intentId);
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return limit ? filtered.slice(0, limit) : filtered;
}

// Query entries by Work Order ID
function getEntriesByWorkOrder(woId, limit = null) {
  const entries = state.chronicler || [];
  const filtered = entries.filter(e => e.context?.woId === woId);
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return limit ? filtered.slice(0, limit) : filtered;
}

// Query entries by event type
function getEntriesByEventType(eventType, limit = null) {
  const entries = state.chronicler || [];
  const filtered = entries.filter(e => e.eventType === eventType);
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return limit ? filtered.slice(0, limit) : filtered;
}

// Query entries by domain
function getEntriesByDomain(domain, limit = null) {
  const entries = state.chronicler || [];
  const filtered = entries.filter(e => e.domain === domain);
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return limit ? filtered.slice(0, limit) : filtered;
}

// Query gate events (blocked, observed, overridden)
function getGateEvents(limit = null) {
  const entries = state.chronicler || [];
  const gateTypes = ['gate_blocked', 'gate_observed', 'gate_overridden'];
  const filtered = entries.filter(e => gateTypes.includes(e.eventType));
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return limit ? filtered.slice(0, limit) : filtered;
}

// Synthesize timeline for an Intent
function synthesizeIntentTimeline(intentId) {
  const entries = getEntriesByIntent(intentId);

  // Group by date
  const byDate = {};
  entries.forEach(entry => {
    const date = new Date(entry.timestamp).toLocaleDateString();
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(entry);
  });

  // Create timeline
  const timeline = Object.entries(byDate).map(([date, dayEntries]) => ({
    date,
    events: dayEntries.map(e => ({
      time: new Date(e.timestamp).toLocaleTimeString(),
      type: e.eventType,
      summary: e.summary,
      phase: e.context?.phase
    }))
  }));

  return {
    intentId,
    entryCount: entries.length,
    timeline,
    firstEvent: entries[entries.length - 1]?.timestamp,
    lastEvent: entries[0]?.timestamp
  };
}

// Synthesize activity summary for dashboard
function synthesizeActivitySummary(days = 7) {
  const entries = state.chronicler || [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const recent = entries.filter(e => new Date(e.timestamp) >= cutoff);

  // Count by event type
  const byType = {};
  recent.forEach(e => {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
  });

  // Count by domain
  const byDomain = {};
  recent.forEach(e => {
    byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
  });

  // Intent activity
  const intentIds = new Set(recent.filter(e => e.context?.intentId).map(e => e.context.intentId));

  // WO activity
  const woIds = new Set(recent.filter(e => e.context?.woId).map(e => e.context.woId));

  // Gate enforcement summary
  const gateBlocked = recent.filter(e => e.eventType === 'gate_blocked').length;
  const gateObserved = recent.filter(e => e.eventType === 'gate_observed').length;

  return {
    period: `Last ${days} days`,
    totalEvents: recent.length,
    byEventType: byType,
    byDomain: byDomain,
    activeIntents: intentIds.size,
    activeWOs: woIds.size,
    gateEnforcement: {
      blocked: gateBlocked,
      observed: gateObserved
    }
  };
}

// Get Intent health from Chronicler perspective
function getIntentHealth(intentId) {
  const entries = getEntriesByIntent(intentId);

  // Check for recent activity (within 7 days)
  const recent = entries.filter(e => {
    const entryDate = new Date(e.timestamp);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return entryDate >= weekAgo;
  });

  // Check for blocked gates
  const blockedGates = entries.filter(e => e.eventType === 'gate_blocked');

  // Phase changes
  const phaseChanges = entries.filter(e => e.eventType === 'intent_phase_change');

  return {
    intentId,
    totalEvents: entries.length,
    recentActivity: recent.length,
    isStale: recent.length === 0 && entries.length > 0,
    blockedGates: blockedGates.length,
    phaseChangeCount: phaseChanges.length,
    currentPhase: phaseChanges[0]?.details?.toPhase || 'ideation'
  };
}

// Render activity summary panel (for Chronicler panel enhancement)
function renderActivitySummary() {
  const summary = synthesizeActivitySummary(7);

  return `
    <div class="activity-summary">
      <div class="activity-stat">
        <span class="stat-value">${summary.totalEvents}</span>
        <span class="stat-label">Events (7d)</span>
      </div>
      <div class="activity-stat">
        <span class="stat-value">${summary.activeIntents}</span>
        <span class="stat-label">Intents</span>
      </div>
      <div class="activity-stat">
        <span class="stat-value">${summary.activeWOs}</span>
        <span class="stat-label">WOs</span>
      </div>
      ${state.gateMode === 'enforce' ? `
        <div class="activity-stat enforcement">
          <span class="stat-value">${summary.gateEnforcement.blocked}</span>
          <span class="stat-label">Blocked</span>
        </div>
      ` : ''}
    </div>
  `;
}

// === FCL-4: Reflex Rules Evaluation ===

// Generate unique warning ID
function generateWarningId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `rw-${timestamp}-${random}`;
}

// Evaluate all Reflex Rules and generate warnings
// FCL v2: Returns { warnings, drafts, hardBlocks } where hardBlocks contains enforcement violations
function evaluateReflexRules() {
  const fsp = state.forgeStatePack;
  const obs = state.observations;

  const warnings = [];
  const drafts = [];
  const hardBlocks = [];  // FCL v2: Track hard enforcement violations
  const now = new Date().toISOString();

  // RR-CC-MISSING: Check for executed WOs without Continuation Contracts
  if (fsp?.workOrders?.missingGates) {
    for (const missing of fsp.workOrders.missingGates) {
      const rule = REFLEX_RULES.find(r => r.id === 'RR-CC-MISSING');
      if (rule?.enabled) {
        const warning = {
          warningType: 'ReflexWarning',
          schemaVersion: '2.0.0',  // FCL v2
          id: generateWarningId(),
          generatedAt: now,
          rule: { id: rule.id, name: rule.name },
          trigger: {
            what: 'Executed WO missing Continuation Contract',
            where: missing.id,
            when: now
          },
          violation: rule.violation,
          enforcement: rule.enforcement || 'soft',  // FCL v2
          message: `Work Order ${missing.id} was executed but has no Continuation Contract`,
          context: 'Continuation Contracts capture outcome, follow-ups, and learnings. Without them, institutional memory is incomplete.',
          tone: 'This WO may be missing important closure metadata',
          repair: {
            suggestion: rule.repair.suggestion,
            draft: {
              title: `Add Continuation Contract to ${missing.id}`,
              type: 'repair',
              acceptance_criteria: [
                'Continuation Contract added with outcome status',
                'Follow-up items documented (if any)',
                'Learnings captured (if any)'
              ]
            }
          }
        };
        warnings.push(warning);
        drafts.push(warning.repair.draft);
        // FCL v2: Track hard enforcement blocks
        if (rule.enforcement === 'hard') {
          hardBlocks.push({ rule: rule.id, woId: missing.id, reason: warning.message });
        }
      }
    }
  }

  // RR-WO-STUCK: Check for stuck WOs
  if (fsp?.workOrders?.stuckWOs) {
    for (const stuck of fsp.workOrders.stuckWOs) {
      const rule = REFLEX_RULES.find(r => r.id === 'RR-WO-STUCK');
      if (rule?.enabled) {
        const warning = {
          warningType: 'ReflexWarning',
          schemaVersion: '2.0.0',  // FCL v2
          id: generateWarningId(),
          generatedAt: now,
          rule: { id: rule.id, name: rule.name },
          trigger: {
            what: 'WO unchanged for extended period',
            where: stuck.id,
            when: now
          },
          violation: rule.violation,
          enforcement: rule.enforcement || 'soft',  // FCL v2
          message: `Work Order ${stuck.id} has not progressed recently`,
          context: 'Stuck WOs may indicate blockers or abandoned work that needs attention.',
          tone: 'Consider reviewing this WO for blockers or closure',
          repair: {
            suggestion: rule.repair.suggestion,
            draft: null
          }
        };
        warnings.push(warning);
        // FCL v2: Track hard enforcement blocks
        if (rule.enforcement === 'hard') {
          hardBlocks.push({ rule: rule.id, woId: stuck.id, reason: warning.message });
        }
      }
    }
  }

  // RR-SMOKE-FAIL: Check smoke test status
  if (obs && obs.smokePass === false) {
    const rule = REFLEX_RULES.find(r => r.id === 'RR-SMOKE-FAIL');
    if (rule?.enabled) {
      const warning = {
        warningType: 'ReflexWarning',
        schemaVersion: '2.0.0',  // FCL v2
        id: generateWarningId(),
        generatedAt: now,
        rule: { id: rule.id, name: rule.name },
        trigger: {
          what: 'Smoke tests not passing',
          where: 'Production',
          when: obs.timestamp || now
        },
        violation: rule.violation,
        enforcement: rule.enforcement || 'soft',  // FCL v2
        message: 'Production smoke tests are not passing',
        context: 'This may indicate a deployment issue or service degradation that needs investigation.',
        tone: 'Production health may be at risk',
        repair: {
          suggestion: rule.repair.suggestion,
          draft: {
            title: 'Investigate Production Smoke Test Failures',
            type: 'repair',
            acceptance_criteria: [
              'Root cause identified',
              'Fix deployed or rollback executed',
              'Smoke tests passing'
            ]
          }
        }
      };
      warnings.push(warning);
      drafts.push(warning.repair.draft);
      // FCL v2: Track hard enforcement blocks
      if (rule.enforcement === 'hard') {
        hardBlocks.push({ rule: rule.id, woId: null, reason: warning.message });
      }
    }
  }

  // RR-FSP-STALE: Check FSP freshness
  if (fsp?.generatedAt) {
    const fspAge = (Date.now() - new Date(fsp.generatedAt).getTime()) / (1000 * 60 * 60);
    if (fspAge > 48) {
      const rule = REFLEX_RULES.find(r => r.id === 'RR-FSP-STALE');
      if (rule?.enabled) {
        const warning = {
          warningType: 'ReflexWarning',
          schemaVersion: '2.0.0',  // FCL v2
          id: generateWarningId(),
          generatedAt: now,
          rule: { id: rule.id, name: rule.name },
          trigger: {
            what: 'FSP not refreshed recently',
            where: 'Forge State Pack',
            when: fsp.generatedAt
          },
          violation: rule.violation,
          enforcement: rule.enforcement || 'soft',  // FCL v2
          message: `Forge State Pack was generated ${Math.round(fspAge)} hours ago`,
          context: 'Stale FSP may not reflect recent changes to work orders, risks, or observations.',
          tone: 'Consider refreshing FSP for accurate institutional state',
          repair: {
            suggestion: rule.repair.suggestion,
            draft: null
          }
        };
        warnings.push(warning);
        // FCL v2: Track hard enforcement blocks (unlikely for this rule)
        if (rule.enforcement === 'hard') {
          hardBlocks.push({ rule: rule.id, woId: null, reason: warning.message });
        }
      }
    }
  }

  // RR-RISK-UNMITIGATED: Check for unmitigated high-severity risks
  if (fsp?.risks) {
    const unmitigatedHighRisks = fsp.risks.filter(r =>
      (r.severity === 'critical' || r.severity === 'high') &&
      (r.status === 'detected' || r.status === 'acknowledged')
    );
    for (const risk of unmitigatedHighRisks) {
      const rule = REFLEX_RULES.find(r => r.id === 'RR-RISK-UNMITIGATED');
      if (rule?.enabled) {
        const warning = {
          warningType: 'ReflexWarning',
          schemaVersion: '2.0.0',  // FCL v2
          id: generateWarningId(),
          generatedAt: now,
          rule: { id: rule.id, name: rule.name },
          trigger: {
            what: `${risk.severity} risk not mitigated`,
            where: risk.id,
            when: risk.detectedAt || now
          },
          violation: rule.violation,
          enforcement: rule.enforcement || 'soft',  // FCL v2
          message: `Risk '${risk.id}' is ${risk.severity} but not yet mitigated`,
          context: `${risk.description}. High-severity risks may impact system stability and should have mitigation plans.`,
          tone: 'Consider creating a mitigation plan',
          repair: {
            suggestion: rule.repair.suggestion,
            draft: {
              title: `Mitigate Risk: ${risk.description.substring(0, 50)}...`,
              type: 'repair',
              acceptance_criteria: [
                'Root cause analyzed',
                'Mitigation implemented or compensating controls in place',
                'Risk status updated to mitigated'
              ]
            }
          }
        };
        warnings.push(warning);
        drafts.push(warning.repair.draft);
        // FCL v2: Track hard enforcement blocks
        if (rule.enforcement === 'hard') {
          hardBlocks.push({ rule: rule.id, woId: null, reason: warning.message });
        }
      }
    }
  }

  // Update state
  state.reflexWarnings = warnings;
  state.repairDrafts = drafts;
  state.hardBlocks = hardBlocks;  // FCL v2: Track hard enforcement blocks

  console.log('[Portal] Reflex Rules evaluated:', warnings.length, 'warnings,', drafts.length, 'repair drafts,', hardBlocks.length, 'hard blocks');
  return { warnings, drafts, hardBlocks };
}

// Get warnings by severity
function getWarningsBySeverity(severity) {
  return state.reflexWarnings.filter(w => w.violation.severity === severity);
}

// Get all repair drafts
function getRepairDrafts() {
  return state.repairDrafts || [];
}

// Copy repair draft to clipboard
function copyRepairDraft(draft) {
  if (!draft) return;

  const woTemplate = `# Work Order: ${draft.title}

**Type:** ${draft.type}
**Status:** Draft (Reflex Rule suggestion)

## Acceptance Criteria

${draft.acceptance_criteria.map(c => `- [ ] ${c}`).join('\n')}

## Notes

This Work Order was auto-drafted by Reflex Rules to address a detected issue.
Review and modify as needed before approval.

---
*Generated by Forge Portal FCL-4*
`;

  navigator.clipboard.writeText(woTemplate).then(() => {
    console.log('[Portal] Repair draft copied to clipboard');
    alert('Repair WO draft copied to clipboard');
  }).catch(err => {
    console.error('[Portal] Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}

// Check if a specific WO has a Continuation Contract
function woHasContinuationContract(woId) {
  const fsp = state.forgeStatePack;
  if (!fsp?.workOrders?.missingGates) return true;  // Assume yes if no data
  return !fsp.workOrders.missingGates.some(m => m.id === woId);
}

// Get CC status for a WO
function getWoCCStatus(woId, woStatus) {
  // Only executed WOs need CCs
  if (woStatus !== 'executed') {
    return { required: false, present: null, status: 'not_required' };
  }

  const hasCC = woHasContinuationContract(woId);
  return {
    required: true,
    present: hasCC,
    status: hasCC ? 'present' : 'missing'
  };
}

// === FCL v2: Gate Authority Functions ===

// Canonical phase order for lifecycle transitions
const PHASE_ORDER = ['draft', 'pending-approval', 'approved', 'executing', 'executed'];

// Map WO status to Intent phase for backward compatibility and phase calculation
const WO_STATUS_TO_PHASE = {
  'draft': 'ideation',
  'pending-approval': 'requirements',
  'approved': 'dissonance',
  'executing': 'execution',
  'executed': 'validation',
  'deployed-dev': 'finalisation',
  'promoted': 'finalisation',
  'deployed-prod': 'production',
  'observed': 'reflection',
  'evolved': 'reflection'
};

// Phase order for comparison (earlier = lower index)
const INTENT_PHASE_ORDER = ['ideation', 'requirements', 'dissonance', 'design', 'execution', 'validation', 'finalisation', 'production', 'reflection'];

function statusToPhase(status) {
  return WO_STATUS_TO_PHASE[status] || status;
}

/**
 * Calculate Intent phase based on spawned WO statuses (FCL v2)
 * Returns the most advanced phase based on WO progress
 * @param {object} intent - The Director Intent
 * @returns {string} - Calculated phase
 */
function calculateIntentPhase(intent) {
  if (!intent) return 'ideation';

  const spawnedWOs = intent.spawnedWOs || [];
  if (spawnedWOs.length === 0) {
    // No WOs spawned yet - stay in ideation or requirements
    return intent.phase || 'ideation';
  }

  // Get WO objects from state
  const workOrders = state.workOrders?.workOrders || [];
  const intentWOs = workOrders.filter(wo => spawnedWOs.includes(wo.id));

  if (intentWOs.length === 0) {
    // WO IDs listed but not found in index
    return intent.phase || 'ideation';
  }

  // Find the most advanced phase among all WOs
  let maxPhaseIdx = 0;
  for (const wo of intentWOs) {
    const woPhase = statusToPhase(wo.status);
    const phaseIdx = INTENT_PHASE_ORDER.indexOf(woPhase);
    if (phaseIdx > maxPhaseIdx) {
      maxPhaseIdx = phaseIdx;
    }
  }

  return INTENT_PHASE_ORDER[maxPhaseIdx] || 'ideation';
}

/**
 * Update Intent phase based on WO changes (FCL v2)
 * Called when WO status changes or WO is linked
 */
function updateIntentPhaseFromWOs(intentId) {
  const intent = state.intents?.find(i => i.id === intentId);
  if (!intent) return;

  const calculatedPhase = calculateIntentPhase(intent);
  const currentPhaseIdx = INTENT_PHASE_ORDER.indexOf(intent.phase);
  const calculatedPhaseIdx = INTENT_PHASE_ORDER.indexOf(calculatedPhase);

  // Only advance, never regress (forward-only)
  if (calculatedPhaseIdx > currentPhaseIdx) {
    const oldPhase = intent.phase;
    intent.phase = calculatedPhase;
    intent.metadata.updatedAt = new Date().toISOString();

    // Record phase change
    recordIntentPhaseChange(intent, oldPhase, calculatedPhase);
    saveIntentsToStorage();

    showToast(`Intent advanced to ${calculatedPhase}`, 'info');
  }
}

/**
 * Get Intent phase with fallback to calculated phase
 */
function getIntentPhase(intent) {
  if (!intent) return 'ideation';

  // If Intent has explicit phase and no WOs, use explicit
  if (intent.phase && (!intent.spawnedWOs || intent.spawnedWOs.length === 0)) {
    return intent.phase;
  }

  // Calculate from WOs
  const calculated = calculateIntentPhase(intent);
  const currentIdx = INTENT_PHASE_ORDER.indexOf(intent.phase || 'ideation');
  const calculatedIdx = INTENT_PHASE_ORDER.indexOf(calculated);

  // Return the more advanced of the two (forward-only)
  return calculatedIdx > currentIdx ? calculated : (intent.phase || 'ideation');
}

/**
 * Gate Authority: Check if a WO can transition between statuses
 * @param {string} woId - Work Order ID
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {{ allowed: boolean, reason: string|null }}
 */
function canTransition(woId, fromStatus, toStatus) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);

  // Gate 1: WO must exist
  if (!wo) {
    return { allowed: false, reason: 'Work Order not found' };
  }

  // Gate 2: Current status must match
  if (wo.status !== fromStatus) {
    return { allowed: false, reason: `WO status is ${wo.status}, not ${fromStatus}` };
  }

  // Gate 3: Phase order enforcement
  const currentIdx = PHASE_ORDER.indexOf(fromStatus);
  const targetIdx = PHASE_ORDER.indexOf(toStatus);

  if (currentIdx === -1 || targetIdx === -1) {
    // Allow unknown statuses (backward compatibility)
    return { allowed: true, reason: null };
  }

  if (targetIdx !== currentIdx + 1) {
    return { allowed: false, reason: `Cannot transition from ${fromStatus} to ${toStatus} — phase skip detected` };
  }

  // Gate 4: Dissonance scan required for approval
  if (toStatus === 'approved') {
    const gateChecks = wo.gateChecks || {};
    if (!gateChecks.dissonanceScan?.completed) {
      return { allowed: false, reason: 'Dissonance scan required before approval' };
    }
  }

  // Gate 5: Continuation Contract required to mark as executed (FCL v2)
  if (toStatus === 'executed') {
    const gateChecks = wo.gateChecks || {};
    // FCL v2 enforcement: CC required for WOs with gateChecks defined
    // Legacy WOs (no gateChecks) are allowed through (forward-only enforcement)
    if (gateChecks.continuationContract !== undefined) {
      if (!gateChecks.continuationContract?.present) {
        return { allowed: false, reason: 'Continuation Contract required before marking executed' };
      }
    }
    // Note: WOs without gateChecks are legacy and allowed (no backfill)
  }

  return { allowed: true, reason: null };
}

/**
 * Gate Authority: Check if deployment to an environment is allowed
 * @param {string} env - Target environment ('dev' | 'prod')
 * @returns {{ allowed: boolean, reason: string|null }}
 */
function canDeploy(env) {
  const fsp = state.forgeStatePack;
  const obs = fsp?.observations || {};

  // Gate 1: Smoke tests must pass for prod deployment
  if (env === 'prod') {
    if (obs.smokePass === false) {
      return { allowed: false, reason: 'Production smoke tests are failing — deployment blocked' };
    }
  }

  // Gate 2: Check for alert-level Reflex warnings
  const alerts = state.reflexWarnings?.filter(w => w.violation?.severity === 'alert') || [];
  if (env === 'prod' && alerts.length > 0) {
    return { allowed: false, reason: `${alerts.length} alert-level warning(s) active — deployment blocked` };
  }

  return { allowed: true, reason: null };
}

/**
 * Gate Authority: Check if a WO can be approved
 * @param {string} woId - Work Order ID
 * @returns {{ allowed: boolean, reason: string|null }}
 */
function canApprove(woId) {
  return canTransition(woId, 'pending-approval', 'approved');
}

/**
 * Gate Authority: Check if a WO can be executed
 * @param {string} woId - Work Order ID
 * @returns {{ allowed: boolean, reason: string|null }}
 */
function canExecute(woId) {
  return canTransition(woId, 'approved', 'executing');
}

/**
 * Process gate check result based on current gate mode
 * In 'observe' mode: log and record but don't block
 * In 'enforce' mode: actually block the action
 * @param {object} check - Result from canTransition/canDeploy
 * @param {string} action - Action being attempted
 * @param {string} woId - Work Order ID (if applicable)
 * @param {string} intentId - Intent ID (if known)
 * @returns {boolean} - Whether to proceed with the action
 */
function processGateCheck(check, action, woId = null, intentId = null) {
  if (check.allowed) {
    return true;
  }

  // Gate check failed
  if (state.gateMode === 'observe') {
    // Observe mode: log but don't block
    console.warn(`[Gate Observe] ${action} would be blocked: ${check.reason}`);
    showToast(`Gate Warning: ${check.reason}`, 'warning');
    recordGateObserved(action, woId, check.reason, intentId);
    return true;  // Allow action to proceed
  } else {
    // Enforce mode: actually block
    console.error(`[Gate Enforce] ${action} blocked: ${check.reason}`);
    showToast(`Gate Blocked: ${check.reason}`, 'error');
    recordGateBlocked(action, woId, check.reason, intentId);
    return false;  // Block action
  }
}

// === FCL-5: Genome Functions ===

const GRADUATION_OBSERVATION_DAYS = 14;

// Calculate eligibility for an experimental artifact
function calculateArtifactEligibility(artifact) {
  const fsp = state.forgeStatePack;
  const obs = fsp?.observations || {};
  const reflexWarnings = state.reflexWarnings || [];

  // Calculate days since introduction
  const observationStart = artifact.observationStart || artifact.introducedAt;
  const daysSinceIntroduction = observationStart
    ? Math.floor((Date.now() - new Date(observationStart).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Check eligibility criteria
  const criteria = {
    observationMet: daysSinceIntroduction >= GRADUATION_OBSERVATION_DAYS,
    smokePassing: obs.smokePass === true,
    noAlertWarnings: !reflexWarnings.some(w =>
      w.violation.severity === 'alert' &&
      (w.trigger.where === artifact.path || w.trigger.where === artifact.name)
    ),
    noCriticalRegressions: true  // v1: assumed true unless Chronicler has regression entries
  };

  // Determine eligibility
  const eligible = Object.values(criteria).every(c => c);

  // Generate reason
  let reason = 'eligible';
  if (!criteria.observationMet) {
    const remaining = GRADUATION_OBSERVATION_DAYS - daysSinceIntroduction;
    reason = `observation_pending (${remaining} days remaining)`;
  } else if (!criteria.smokePassing) {
    reason = 'smoke_failing';
  } else if (!criteria.noAlertWarnings) {
    reason = 'alert_warnings';
  } else if (!criteria.noCriticalRegressions) {
    reason = 'regression_detected';
  }

  return {
    ...artifact,
    daysSinceIntroduction,
    eligible,
    eligibilityReason: reason,
    criteria
  };
}

// Get enriched genome data with eligibility
function getEnrichedGenome() {
  const fsp = state.forgeStatePack;
  if (!fsp?.genome) return null;

  const stable = fsp.genome.stable || [];
  const experimental = (fsp.genome.experimental || []).map(calculateArtifactEligibility);
  const graduationPending = fsp.genome.graduationPending || [];

  return {
    stable,
    experimental,
    graduationPending,
    stableCount: stable.length,
    experimentalCount: experimental.length,
    eligibleCount: experimental.filter(a => a.eligible).length
  };
}

// Generate Graduation WO draft
function generateGraduationWODraft(artifact) {
  const template = `# Work Order: Graduate ${artifact.name} to Stable

**Type:** governance
**Status:** Draft

## Artifact Details

- **Path:** ${artifact.path}
- **Name:** ${artifact.name}
- **Introduced:** ${artifact.introducedAt ? new Date(artifact.introducedAt).toLocaleDateString() : 'Unknown'}
- **Observation Period:** ${artifact.daysSinceIntroduction || 0} days
- **Introducing WO:** ${artifact.woId || 'N/A'}

## Evidence Review

- [ ] Observation period ≥ 14 days: ${artifact.criteria?.observationMet ? 'Yes' : 'No'}
- [ ] Smoke tests passing throughout: ${artifact.criteria?.smokePassing ? 'Yes' : 'No'}
- [ ] No critical regressions: ${artifact.criteria?.noCriticalRegressions ? 'Yes' : 'No'}
- [ ] No open alert-level warnings: ${artifact.criteria?.noAlertWarnings ? 'Yes' : 'No'}

## Acceptance Criteria

- [ ] Artifact moved to Stable classification in FSP
- [ ] FSP genome section updated
- [ ] Chronicler graduation event recorded

## Director Sign-off

I confirm this artifact has demonstrated stability and is approved for
graduation to Stable status.

Signed: _________________
Date: _________________

---
*Generated by Forge Portal FCL-5*
`;

  return template;
}

// Copy graduation WO draft to clipboard
function copyGraduationDraft(artifact) {
  const draft = generateGraduationWODraft(artifact);

  navigator.clipboard.writeText(draft).then(() => {
    console.log('[Portal] Graduation WO draft copied to clipboard');
    alert(`Graduation WO draft for "${artifact.name}" copied to clipboard`);
  }).catch(err => {
    console.error('[Portal] Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}

// Record graduation event to Chronicler
function recordGraduationEvent(artifact) {
  return recordChroniclerEntry(
    'graduation',
    'genome',
    `Artifact ${artifact.name} graduated to Stable`,
    {
      artifactPath: artifact.path,
      artifactName: artifact.name,
      observationDays: artifact.daysSinceIntroduction || 0,
      woId: artifact.woId || null,
      graduatedBy: 'director'
    }
  );
}

// Record artifact introduction event
function recordArtifactIntroduction(artifact) {
  return recordChroniclerEntry(
    'artifact_introduced',
    'genome',
    `Artifact ${artifact.name} introduced as Experimental`,
    {
      artifactPath: artifact.path,
      artifactName: artifact.name,
      introducedBy: artifact.introducedBy || 'unknown',
      introducingWoId: artifact.woId || null
    }
  );
}

// === FCL v2: Intent Recording Functions ===

function recordIntentCreated(intent) {
  return recordChroniclerEntry(
    'intent_created',
    'intents',
    `Intent "${intent.title}" created`,
    {
      classification: intent.classification,
      successSignalCount: intent.successSignals?.length || 0
    },
    { intentId: intent.id, phase: 'ideation' }
  );
}

function recordIntentWOSpawned(intent, woId, woTitle) {
  return recordChroniclerEntry(
    'intent_wo_spawned',
    'intents',
    `WO ${woId} spawned from Intent "${intent.title}"`,
    {
      woTitle,
      intentWoCount: intent.spawnedWOs?.length || 0
    },
    { intentId: intent.id, woId, phase: intent.phase }
  );
}

function recordIntentPhaseChange(intent, fromPhase, toPhase) {
  return recordChroniclerEntry(
    'intent_phase_change',
    'intents',
    `Intent "${intent.title}" advanced: ${fromPhase} → ${toPhase}`,
    {
      fromPhase,
      toPhase,
      woCount: intent.spawnedWOs?.length || 0
    },
    { intentId: intent.id, phase: toPhase }
  );
}

function recordIntentCompleted(intent) {
  return recordChroniclerEntry(
    'intent_completed',
    'intents',
    `Intent "${intent.title}" completed`,
    {
      classification: intent.classification,
      woCount: intent.spawnedWOs?.length || 0,
      phase: intent.phase
    },
    { intentId: intent.id, phase: 'reflection' }
  );
}

function recordIntentAbandoned(intent, reason) {
  return recordChroniclerEntry(
    'intent_abandoned',
    'intents',
    `Intent "${intent.title}" abandoned: ${reason}`,
    {
      reason,
      classification: intent.classification,
      phase: intent.phase
    },
    { intentId: intent.id, phase: intent.phase }
  );
}

function recordGateBlocked(action, woId, reason, intentId = null) {
  return recordChroniclerEntry(
    'gate_blocked',
    'gates',
    `Gate blocked: ${action} on ${woId}`,
    {
      action,
      reason,
      gateMode: state.gateMode || 'observe'
    },
    { intentId, woId, source: 'gate' }
  );
}

function recordGateObserved(action, woId, reason, intentId = null) {
  return recordChroniclerEntry(
    'gate_observed',
    'gates',
    `Gate observed (would block): ${action} on ${woId}`,
    {
      action,
      reason,
      gateMode: 'observe'
    },
    { intentId, woId, source: 'gate' }
  );
}

// M3e: Load agent outputs from localStorage
function loadAgentOutputs() {
  try {
    const stored = localStorage.getItem(AGENT_OUTPUTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.warn('[Portal] Failed to load agent outputs:', e);
    return {};
  }
}

// M3e: Save agent outputs to localStorage
function saveAgentOutputs(outputs) {
  try {
    localStorage.setItem(AGENT_OUTPUTS_STORAGE_KEY, JSON.stringify(outputs));
    return true;
  } catch (e) {
    console.warn('[Portal] Failed to save agent outputs:', e);
    return false;
  }
}

// M3f: Load cached deployment status from localStorage
function loadDeployStatusCache() {
  try {
    const stored = localStorage.getItem(DEPLOY_STATUS_CACHE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('[Portal] Failed to load deploy status cache:', e);
    return null;
  }
}

// M3f: Save deployment status to localStorage cache
function saveDeployStatusCache(status) {
  try {
    localStorage.setItem(DEPLOY_STATUS_CACHE_KEY, JSON.stringify(status));
    return true;
  } catch (e) {
    console.warn('[Portal] Failed to save deploy status cache:', e);
    return false;
  }
}

// M3g: Load evolution proposals from localStorage
function loadEvolutionProposals() {
  try {
    const stored = localStorage.getItem(EVOLUTION_PROPOSALS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.warn('[Portal] Failed to load evolution proposals:', e);
    return {};
  }
}

// M3g: Save evolution proposals to localStorage
function saveEvolutionProposals(proposals) {
  try {
    localStorage.setItem(EVOLUTION_PROPOSALS_STORAGE_KEY, JSON.stringify(proposals));
    return true;
  } catch (e) {
    console.warn('[Portal] Failed to save evolution proposals:', e);
    return false;
  }
}

// M3g: Save a single evolution proposal for a WO
function saveEvolutionProposal(woId, proposal) {
  const proposals = state.evolutionProposals || {};
  if (!proposals[woId]) {
    proposals[woId] = [];
  }

  const entry = {
    ...proposal,
    savedAt: new Date().toISOString()
  };

  proposals[woId].unshift(entry);  // newest first

  // Keep only last 10 proposals per WO to prevent unbounded growth
  if (proposals[woId].length > 10) {
    proposals[woId] = proposals[woId].slice(0, 10);
  }

  state.evolutionProposals = proposals;
  saveEvolutionProposals(proposals);

  return entry;
}

// M3g: Get evolution proposals for a specific WO
function getEvolutionProposalsForWO(woId) {
  return state.evolutionProposals?.[woId] || [];
}

async function loadData() {
  state.loading = true;
  state.error = null;
  render();

  const [sharePack, workOrders, entities, environments, products, observationsResult, fspResult, chroniclerEntries, intentsResult, worldsData] = await Promise.all([
    loadSharePack(),
    loadWorkOrders(),
    loadEntities(),
    loadEnvironments(),
    loadProducts(),
    loadObservations(),
    loadForgeStatePack(),
    loadChronicler(),
    loadIntents(),  // FCL v2: Load Director Intents from file + localStorage
    loadWorlds()    // FCL v2: Load World registry
  ]);

  state.sharePack = sharePack;
  state.workOrders = workOrders;
  state.entities = entities;
  state.environments = environments;
  state.products = products;
  state.worlds = worldsData;  // FCL v2: World registry
  state.observations = observationsResult.data;
  state.observationsError = observationsResult.error;
  state.forgeStatePack = fspResult.data;
  state.forgeStatePackError = fspResult.error;
  state.agentOutputs = loadAgentOutputs();
  state.deployStatusCache = loadDeployStatusCache();
  state.evolutionProposals = loadEvolutionProposals();
  state.heartbeat = loadHeartbeat();  // FCL-2: Load cached Heartbeat
  state.chronicler = chroniclerEntries;  // FCL-3: Load Chronicler entries from file
  state.chroniclerQueue = loadChroniclerQueue();  // FCL-3: Load queued entries
  // FCL v2: Intents already loaded by loadIntents() into state.intents

  // M3f: Update deploy status cache if we have fresh observations
  if (observationsResult.data) {
    const cacheEntry = {
      ...observationsResult.data,
      cachedAt: new Date().toISOString()
    };
    saveDeployStatusCache(cacheEntry);
    state.deployStatusCache = cacheEntry;
  }

  // FCL-4: Evaluate Reflex Rules on load
  evaluateReflexRules();

  state.loading = false;

  if (!sharePack && !workOrders) {
    state.error = 'Share Pack indices not found.';
    state.errorDetails = `Run: node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"`;
  }

  render();
}

// === Navigation ===

function navigateTo(screen) {
  // Map screens to tabs for bottom nav highlighting (Command Centre model)
  const tabMap = {
    // Command tab (home/dashboard)
    'command': 'command',
    'home': 'command',  // Legacy alias
    'settings': 'command',

    // Lifecycle tab (WO lifecycle, intents, phases)
    'lifecycle': 'lifecycle',
    'forge': 'lifecycle',  // Legacy alias
    'forge-governance': 'lifecycle',
    'forge-agents': 'lifecycle',
    'forge-sharepacks': 'lifecycle',
    'forge-registry': 'lifecycle',
    'forge-intents': 'lifecycle',
    'create-intent': 'lifecycle',
    'intent-detail': 'lifecycle',
    'work-orders': 'lifecycle',
    'create-wo': 'lifecycle',
    'import-agent-output': 'lifecycle',
    'evolution-proposal': 'lifecycle',
    'deploy-status': 'lifecycle',

    // Ops tab (entities, operations)
    'ops': 'ops',
    'entities': 'ops',  // Legacy alias
    'entity-portal': 'ops',

    // Config tab (governance, settings)
    'config': 'config',
    'governance': 'config'  // Legacy alias
  };

  const previousScreen = state.currentScreen;
  state.currentScreen = screen;
  state.currentTab = tabMap[screen] || 'command';

  updateBottomNav();

  // Add subtle screen transition if changing screens
  const content = document.getElementById('portal-content');
  if (content && previousScreen !== screen) {
    content.classList.add('world-shifting');
    render();
    requestAnimationFrame(() => {
      setTimeout(() => content.classList.remove('world-shifting'), 500);
    });
  } else {
    render();
  }
}

// M4: Navigate to Import Agent Output with pre-selected WO
function navigateToImportWithWo(woId) {
  state.importPreselectedWo = woId;
  navigateTo('import-agent-output');
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
  // PORTAL-UX-HARDENING: Use in-app navigation instead of physical file navigation
  // This keeps entity context within the Command Centre model
  state.selectedEntity = entityId;
  selectEntity(entityId);  // Update header context
  navigateTo('entity-portal');
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} ${type}`;

  // Add icon based on type
  const icons = {
    success: '&#10004;',  // Checkmark
    error: '&#10006;',    // X
    warning: '&#9888;',   // Warning triangle
    info: '&#8505;'       // Info
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  // Screen flash effect for errors
  if (type === 'error') {
    const portal = document.querySelector('.portal');
    if (portal) {
      portal.style.animation = 'none';
      portal.offsetHeight; // Trigger reflow
      portal.style.animation = 'errorFlash 0.3s ease-out';
      setTimeout(() => portal.style.animation = '', 300);
    }
  }

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
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

function formatDate(isoString) {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// === Actions ===

async function handleDeploy() {
  // M4: Show confirmation modal with dispatch option
  if (state.flags.m4RepoAware) {
    showDeployConfirmModal();
  } else {
    showToast('Opening Deploy workflow...', 'info');
    window.open(DEPLOY_WORKFLOW_URL, '_blank');
  }
}

function showDeployConfirmModal() {
  const existing = document.getElementById('deploy-confirm-modal');
  if (existing) existing.remove();

  const hasToken = hasPAT();

  const modal = document.createElement('div');
  modal.id = 'deploy-confirm-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content deploy-confirm-modal">
      <div class="modal-header">
        <h2>&#128640; Deploy to Production</h2>
        <button class="modal-close" onclick="closeDeployConfirmModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="info-card warning">
          <span class="info-icon">&#9888;</span>
          <div class="info-content">
            <p><strong>This will promote dev → main</strong></p>
            <p>A pull request will be created (or existing PR used) to merge dev branch into main.</p>
            <p>This affects the <strong>production environment</strong>.</p>
          </div>
        </div>

        ${hasToken ? `
        <div class="deploy-actions">
          <button class="btn-primary deploy-dispatch-btn" onclick="triggerDeployToProd()">
            <span>&#128640;</span> Dispatch Deploy Workflow
          </button>
          <p class="form-hint">Direct dispatch via GitHub API</p>
        </div>
        ` : `
        <div class="deploy-no-pat">
          <p class="form-hint">&#128274; No PAT configured. Use manual option:</p>
        </div>
        `}

        <div class="deploy-fallback">
          <p class="fallback-label">Manual option:</p>
          <a href="${DEPLOY_WORKFLOW_URL}" class="btn-secondary" target="_blank">
            Open Actions Page &#8599;
          </a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDeployConfirmModal();
  });
}

function closeDeployConfirmModal() {
  const modal = document.getElementById('deploy-confirm-modal');
  if (modal) modal.remove();
}

async function triggerDeployToProd() {
  // FCL v2: Gate check for production deployment
  const gateCheck = canDeploy('prod');
  if (!processGateCheck(gateCheck, 'deploy-prod', null)) {
    return false;
  }

  const token = getStoredPAT();
  if (!token) {
    showToast('No PAT configured. Use manual fallback.', 'error');
    return false;
  }

  try {
    showToast('Dispatching deploy workflow...', 'info');
    const response = await fetch(WORKFLOW_DEPLOY_PROD_DISPATCH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({ ref: 'dev' })
    });

    if (response.status === 204) {
      showToast('Deploy workflow triggered! Check Actions for progress.', 'success');
      closeDeployConfirmModal();
      return true;
    } else {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
  } catch (e) {
    showToast(`Deploy failed: ${e.message}`, 'error');
    return false;
  }
}

async function handleExecute(wo) {
  // FCL v2: Gate check for execution
  const gateCheck = canExecute(wo?.id);
  if (!processGateCheck(gateCheck, 'execute', wo?.id)) {
    return;
  }

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
  // Note: GitHub Issue Forms don't support URL prefill for all fields
  // Users will need to fill remaining fields in GitHub
  return `${base}?${params.toString()}`;
}

// M3a: Build complete WO markdown for copy-to-clipboard
function buildWoMarkdown(fields) {
  const intentLine = fields.intentId ? `**Director Intent:** ${fields.intentId}\n` : '';
  const lines = [
    `## Work Order: ${fields.taskId || '[TASK ID]'}`,
    '',
    `**Task Type:** ${fields.taskType || 'Not specified'}`,
    `**Execution Mode:** ${fields.executionMode || 'code'}`,
    `**Share Pack Refresh:** ${fields.sharePackRefresh ? 'Required' : 'Not required'}`,
    intentLine,
    '---',
    '',
    '### Intent Statement',
    fields.intent || '_Not specified_',
    '',
    '### Scope of Work',
    fields.scope || '_Not specified_',
    '',
    '### Allowed Files / Artifacts',
    '```',
    fields.allowedFiles || '_Not specified_',
    '```',
    '',
    '### Forbidden Changes',
    '```',
    fields.forbidden || '_Not specified_',
    '```',
    '',
    '### Success Criteria',
    fields.successCriteria || '_Not specified_',
    '',
    '### Dependencies',
    fields.dependencies || '_None specified_',
    '',
    '### Additional Notes',
    fields.notes || '_None_',
    ''
  ];
  return lines.join('\n');
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

// M3d: Agent Pack modes
const AGENT_PACK_MODES = {
  full: {
    label: 'Full',
    description: 'Complete pack with WO details + constitutional docs'
  },
  minimal: {
    label: 'Minimal',
    description: 'WO summary + constitutional reminders only'
  },
  context: {
    label: 'Context Only',
    description: 'Governance references for repo-aware agents'
  }
};

// M3d: Build agent pack based on mode
function buildAgentPackContent(wo, mode = 'full') {
  const lane = parseLane(wo.id);
  const issueRef = wo.issueNumber ? `\n- **GitHub Issue:** #${wo.issueNumber} (${wo.issueUrl})` : '';

  const constitutionalRefs = `
## Constitutional References
- **Forge Kernel:** The Forge/forge/FORGE_KERNEL.md
- **Executor Playbook:** The Forge/forge/ops/EXECUTOR_PLAYBOOK.md
- **E2E Workflow:** The Forge/forge/ops/E2E_WORKFLOW_PLAYBOOK.md
- **Agent Onboarding:** The Forge/forge/contracts/AGENT_ONBOARDING_CONTRACT.md
- **WO Lifecycle:** The Forge/forge/contracts/WORK_ORDER_LIFECYCLE_CONTRACT.md
`;

  const constitutionalReminders = `
## Constitutional Reminders
- **Acceptance Criteria Supremacy:** Criteria are the binding definition of done
- **Non-Regression Principle:** Cannot weaken constitutional guarantees
- **Provenance Required:** Record agent type, name, mode at completion
- **Scope Discipline:** Only touch Allowed Paths, never Forbidden Paths
`;

  if (mode === 'context') {
    // Context Only: governance refs for repo-aware agents
    return `# Agent Context Pack
${constitutionalRefs}
${constitutionalReminders}
## Work Order Reference
- **ID:** ${wo.id}
- **Document:** ${wo.repoUrl}${issueRef}

_Repo-aware agent should read full WO from source._
`;
  }

  if (mode === 'minimal') {
    // Minimal: WO summary + reminders
    return `# Agent Pack (Minimal): ${wo.id}

## Work Order Summary
- **ID:** ${wo.id}
- **Title:** ${wo.title}
- **Lane:** ${lane}
- **Status:** ${wo.status}
- **Document:** ${wo.repoUrl}${issueRef}
${constitutionalReminders}
## Instructions
Read full WO at document URL for scope and acceptance criteria.
Execute per EXECUTOR_PLAYBOOK.md protocol.
`;
  }

  // Full: complete pack with all details
  return `# Agent Pack (Full): ${wo.id}

## Work Order
- **ID:** ${wo.id}
- **Title:** ${wo.title}
- **Lane:** ${lane}
- **Status:** ${wo.status}
- **Last Updated:** ${wo.lastUpdated}
- **Document:** ${wo.repoUrl}${issueRef}
${constitutionalRefs}
${constitutionalReminders}
## Closure Checklist
- [ ] All acceptance criteria addressed
- [ ] Provenance recorded (agent type, name, mode)
- [ ] Artifacts produced per WO requirements
- [ ] No regressions introduced
- [ ] Handoff ready for next phase

## Instructions
1. Read the full Work Order at the document URL above
2. Review Allowed Paths and Forbidden Paths
3. Execute scope according to EXECUTOR_PLAYBOOK.md
4. Complete closure checklist before marking done
`;
}

// M3d: Show agent pack mode selector modal
function showAgentPackModal(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (!wo) {
    showToast('Work order not found', 'error');
    return;
  }

  // Remove existing modal if any
  const existing = document.getElementById('agent-pack-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'agent-pack-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content agent-pack-modal">
      <div class="modal-header">
        <h2>Copy Agent Pack</h2>
        <button class="modal-close" onclick="closeAgentPackModal()">&times;</button>
      </div>
      <div class="modal-body">
        <p class="modal-wo-id">${wo.id}</p>
        <p class="modal-subtitle">Select pack format:</p>
        <div class="agent-pack-options">
          <button class="agent-pack-option" onclick="copyAgentPackWithMode('${wo.id}', 'full')">
            <span class="option-icon">&#128230;</span>
            <div class="option-content">
              <span class="option-label">Full Pack</span>
              <span class="option-desc">WO details + constitutional docs + checklist</span>
            </div>
          </button>
          <button class="agent-pack-option" onclick="copyAgentPackWithMode('${wo.id}', 'minimal')">
            <span class="option-icon">&#128196;</span>
            <div class="option-content">
              <span class="option-label">Minimal Pack</span>
              <span class="option-desc">WO summary + reminders only</span>
            </div>
          </button>
          <button class="agent-pack-option" onclick="copyAgentPackWithMode('${wo.id}', 'context')">
            <span class="option-icon">&#128279;</span>
            <div class="option-content">
              <span class="option-label">Context Only</span>
              <span class="option-desc">Governance refs for repo-aware agents</span>
            </div>
          </button>
        </div>

        ${state.flags.m4RepoAware ? `
        <div class="ai-handoff-section">
          <p class="ai-handoff-title">Open in AI (after copying):</p>
          <div class="ai-handoff-buttons">
            <a href="https://claude.ai/new" class="ai-handoff-btn claude" target="_blank" title="Open Claude">
              <span class="ai-icon">&#129302;</span>
              <span>Claude</span>
            </a>
            <a href="https://chat.openai.com/" class="ai-handoff-btn chatgpt" target="_blank" title="Open ChatGPT">
              <span class="ai-icon">&#128172;</span>
              <span>ChatGPT</span>
            </a>
            <a href="https://gemini.google.com/" class="ai-handoff-btn gemini" target="_blank" title="Open Gemini">
              <span class="ai-icon">&#10024;</span>
              <span>Gemini</span>
            </a>
          </div>
          <p class="ai-handoff-hint">Copy a pack first, then paste into your AI of choice</p>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAgentPackModal();
  });
}

function closeAgentPackModal() {
  const modal = document.getElementById('agent-pack-modal');
  if (modal) modal.remove();
}

async function copyAgentPackWithMode(woId, mode) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (!wo) {
    showToast('Work order not found', 'error');
    return;
  }

  const content = buildAgentPackContent(wo, mode);
  const copied = await copyToClipboard(content);
  const modeLabel = AGENT_PACK_MODES[mode]?.label || mode;
  showToast(copied ? `${modeLabel} Agent Pack copied!` : 'Copy failed', copied ? 'success' : 'error');
  closeAgentPackModal();
}

// Legacy function: defaults to showing modal for mode selection
async function copyAgentPack(woId) {
  showAgentPackModal(woId);
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

  const agentPack = `# Agent Pack — Phase: ${phase.name}
${woSection}
## Phase Requirements
- Role: ${phase.role}
- Phase: ${phase.name}

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

  // Remove existing modal if any
  const existing = document.getElementById('wo-detail-modal');
  if (existing) existing.remove();

  const lane = parseLane(wo.id);
  const laneInfo = getLaneInfo(lane);
  const statusInfo = getStatusChip(wo.status);
  const hasToken = hasPAT();
  const hasIssue = wo.issueNumber != null;
  const isPendingApproval = wo.status === 'pending-approval';

  // M3b: Build Director Approval section for pending-approval WOs
  let directorSection = '';
  if (isPendingApproval) {
    if (hasToken && hasIssue) {
      directorSection = `
        <div class="wo-detail-section director-section">
          <h4>&#128081; Director Actions</h4>
          <p class="section-hint">Approve or reject this Work Order</p>
          <div class="wo-detail-actions">
            <button class="wo-action-btn approve" onclick="handleApproveWo('${wo.id}')">
              <span class="action-icon">&#9989;</span> Approve
            </button>
            <button class="wo-action-btn reject" onclick="handleRejectWo('${wo.id}')">
              <span class="action-icon">&#10060;</span> Reject
            </button>
          </div>
        </div>
      `;
    } else if (!hasIssue) {
      directorSection = `
        <div class="wo-detail-section director-section">
          <h4>&#128081; Director Actions</h4>
          <div class="info-card warning">
            <span class="info-icon">&#9888;</span>
            <p>No GitHub Issue linked. Add "Issue: #123" to WO file and refresh Share Pack.</p>
          </div>
          <div class="wo-detail-actions">
            <button class="wo-action-btn secondary" onclick="copyApprovalCmd('${wo.id}')">
              <span class="action-icon">&#128203;</span> Copy Approval
            </button>
            <button class="wo-action-btn secondary" onclick="copyRejectionCmd('${wo.id}')">
              <span class="action-icon">&#128203;</span> Copy Rejection
            </button>
          </div>
        </div>
      `;
    } else {
      directorSection = `
        <div class="wo-detail-section director-section">
          <h4>&#128081; Director Actions</h4>
          <div class="info-card">
            <span class="info-icon">&#128274;</span>
            <p>Configure a GitHub PAT in <a href="#" onclick="navigateTo('settings'); closeWoDetail();">Settings</a> to approve directly.</p>
          </div>
          <div class="wo-detail-actions">
            <button class="wo-action-btn secondary" onclick="copyApprovalCmd('${wo.id}')">
              <span class="action-icon">&#128203;</span> Copy Approval
            </button>
            <button class="wo-action-btn secondary" onclick="copyRejectionCmd('${wo.id}')">
              <span class="action-icon">&#128203;</span> Copy Rejection
            </button>
          </div>
          <p class="section-hint">Paste command in GitHub Issue to approve/reject manually.</p>
        </div>
      `;
    }
  }

  // Issue link section
  const issueLink = hasIssue ? `
    <a href="${wo.issueUrl}" class="wo-link-btn" target="_blank">
      <span class="link-icon">&#128279;</span> GitHub Issue #${wo.issueNumber}
    </a>
  ` : '';

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
            <span class="lane-chip ${laneInfo.class}">${laneInfo.icon} ${laneInfo.label}</span>
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
            ${issueLink}
          </div>
        </div>

        ${directorSection}

        <div class="wo-detail-section">
          <h4>Agent Actions</h4>
          <div class="wo-detail-actions">
            <button class="wo-action-btn primary" onclick="copyAgentPack('${wo.id}'); closeWoDetail();">
              <span class="action-icon">&#128203;</span> Copy Agent Pack
            </button>
            ${wo.status === 'approved' ? `
              <button class="wo-action-btn execute" onclick="handleExecuteWo('${wo.id}'); closeWoDetail();">
                <span class="action-icon">&#9889;</span> Execute Work Order
              </button>
            ` : ''}
            ${state.flags.m4RepoAware && ['executing', 'executed', 'approved', 'ready-for-executor'].includes(wo.status) ? `
              <button class="wo-action-btn import-output" onclick="navigateToImportWithWo('${wo.id}'); closeWoDetail();">
                <span class="action-icon">&#128229;</span> Import Agent Output
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeWoDetail();
  });
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

// === P8: Observed Panel ===

function renderObservedPanel() {
  const obs = state.observations;
  const error = state.observationsError;

  // No data and no error means still loading or not yet fetched
  if (!obs && !error) {
    return `
      <section class="panel observed-panel">
        <h2 class="panel-title">&#128200; Observed (Latest)</h2>
        <div class="observed-loading">
          <span class="loading-icon">&#8987;</span>
          <span>Loading observations...</span>
        </div>
      </section>
    `;
  }

  // Error state - show visible card with guidance (NOT silent)
  if (error) {
    return `
      <section class="panel observed-panel observed-error">
        <h2 class="panel-title">&#128200; Observed (Latest)</h2>
        <div class="observed-error-card">
          <span class="error-icon">&#9888;</span>
          <div class="error-content">
            <p><strong>Observations not available</strong></p>
            <p class="error-detail">${error}</p>
            <p class="error-guidance">Observations are generated during deployment. Run a deploy to generate observation data.</p>
            <p class="error-path">Expected: <code>${OBSERVATIONS_LATEST_URL}</code></p>
          </div>
        </div>
      </section>
    `;
  }

  // Success state - render observation data
  const smokeClass = obs.smokePass ? 'smoke-pass' : 'smoke-fail';
  const smokeIcon = obs.smokePass ? '&#9989;' : '&#10060;';
  const smokeLabel = obs.smokePass ? 'PASS' : 'FAIL';

  const checksHtml = (obs.checks || []).map(check => `
    <div class="check-item ${check.ok ? 'check-pass' : 'check-fail'}">
      <span class="check-icon">${check.ok ? '&#9989;' : '&#10060;'}</span>
      <span class="check-name">${check.name}</span>
      <span class="check-note">${check.note || ''}</span>
    </div>
  `).join('');

  return `
    <section class="panel observed-panel">
      <h2 class="panel-title">&#128200; Observed (Latest)</h2>
      <div class="observed-content">
        <div class="observed-header">
          <div class="observed-env">
            <span class="env-badge env-${obs.env}">${obs.env.toUpperCase()}</span>
            <span class="env-branch">${obs.deployedBranch}</span>
          </div>
          <div class="observed-smoke ${smokeClass}">
            <span class="smoke-icon">${smokeIcon}</span>
            <span class="smoke-label">${smokeLabel}</span>
          </div>
        </div>
        <div class="observed-meta">
          <div class="meta-row">
            <span class="meta-label">Commit:</span>
            <code class="meta-value">${obs.commitShort || obs.commitSha?.substring(0, 7) || 'unknown'}</code>
          </div>
          <div class="meta-row">
            <span class="meta-label">Timestamp:</span>
            <span class="meta-value">${formatRelativeTime(obs.timestamp)}</span>
          </div>
          ${obs.schemaVersion ? `
          <div class="meta-row">
            <span class="meta-label">Schema:</span>
            <span class="meta-value">v${obs.schemaVersion}</span>
          </div>
          ` : ''}
        </div>
        ${checksHtml ? `
        <div class="observed-checks">
          <h4 class="checks-title">Smoke Checks</h4>
          ${checksHtml}
        </div>
        ` : ''}
        ${obs.notes ? `
        <div class="observed-notes">
          <p>${obs.notes}</p>
        </div>
        ` : ''}
      </div>
    </section>
  `;
}

// === M4: Execution Status Panel ===

function renderExecStatusPanel() {
  if (!state.flags.m4RepoAware) return '';

  const cache = state.repoExecStatusCache;
  const hasData = cache && cache.runs && cache.runs.length > 0;

  if (!hasData) {
    return `
      <section class="panel exec-status-panel">
        <h2 class="panel-title">&#129302; Repo Executor Status</h2>
        <div class="exec-status-empty">
          <span class="empty-icon">&#128260;</span>
          <p>No recent executor runs</p>
          <button class="action-btn-sm" onclick="refreshExecStatus()">Check Now</button>
        </div>
      </section>
    `;
  }

  const recentRuns = cache.runs.slice(0, 5);
  const runsHtml = recentRuns.map(run => {
    const statusIcon = run.status === 'completed'
      ? (run.conclusion === 'success' ? '&#9989;' : '&#10060;')
      : run.status === 'in_progress' ? '&#9203;' : '&#8987;';
    const statusClass = run.status === 'completed'
      ? (run.conclusion === 'success' ? 'run-success' : 'run-failure')
      : run.status === 'in_progress' ? 'run-progress' : 'run-pending';

    return `
      <div class="exec-run-item ${statusClass}">
        <span class="run-status-icon">${statusIcon}</span>
        <div class="run-info">
          <span class="run-wo">${run.woId || 'Unknown WO'}</span>
          <span class="run-time">${formatRelativeTime(run.created_at)}</span>
        </div>
        <a href="${run.html_url}" class="run-link" target="_blank">&#8599;</a>
      </div>
    `;
  }).join('');

  return `
    <section class="panel exec-status-panel">
      <h2 class="panel-title">&#129302; Repo Executor Status</h2>
      <div class="exec-status-content">
        ${runsHtml}
      </div>
      <div class="exec-status-actions">
        <button class="action-btn-sm" onclick="refreshExecStatus()">Refresh</button>
        <a href="${WORKFLOW_REPO_EXECUTOR_URL}" class="action-btn-sm" target="_blank">View All Runs</a>
      </div>
    </section>
  `;
}

async function refreshExecStatus() {
  showToast('Checking executor status...', 'info');
  await loadRepoExecStatus();
  render();
  showToast('Status updated', 'success');
}

// === FCL v2: Director Intent Panel ===

// Intent lifecycle phases with icons
const INTENT_PHASES = [
  { id: 'ideation', name: 'Ideation', icon: '&#128161;' },
  { id: 'requirements', name: 'Requirements', icon: '&#128203;' },
  { id: 'dissonance', name: 'Dissonance', icon: '&#128269;' },
  { id: 'design', name: 'Design', icon: '&#128295;' },
  { id: 'execution', name: 'Execution', icon: '&#9881;' },
  { id: 'validation', name: 'Validation', icon: '&#9989;' },
  { id: 'finalisation', name: 'Finalisation', icon: '&#128221;' },
  { id: 'production', name: 'Production', icon: '&#128640;' },
  { id: 'reflection', name: 'Reflection', icon: '&#128173;' }
];

function renderIntentPanel() {
  const fsp = state.forgeStatePack;
  const intents = fsp?.intents || state.intents || [];
  const activeIntents = intents.filter(i => i.status === 'active');

  return `
    <section class="panel intent-panel">
      <h2 class="panel-title">&#127919; Director Intents <span class="fcl-badge">FCL v2</span></h2>
      <p class="panel-subtitle-sm">Strategic lifecycle root — ideas to production</p>

      <div class="intent-summary">
        <div class="intent-stat">
          <span class="stat-value">${activeIntents.length}</span>
          <span class="stat-label">Active</span>
        </div>
        <div class="intent-stat">
          <span class="stat-value">${intents.filter(i => i.status === 'completed').length}</span>
          <span class="stat-label">Completed</span>
        </div>
        <div class="intent-stat">
          <span class="stat-value">${intents.reduce((sum, i) => sum + (i.woCount || 0), 0)}</span>
          <span class="stat-label">WOs Spawned</span>
        </div>
      </div>

      ${activeIntents.length > 0 ? `
        <div class="intent-list">
          ${activeIntents.slice(0, 3).map(intent => `
            <div class="intent-card" data-intent-id="${intent.id}" onclick="viewIntent('${intent.id}')">
              <div class="intent-card-header">
                <span class="intent-title">${escapeHtml(intent.title || intent.id)}</span>
                <span class="intent-classification badge-${intent.classification || 'feature'}">${intent.classification || 'feature'}</span>
              </div>
              <div class="intent-phase-ribbon">
                ${renderPhaseRibbon(getIntentPhase(intent))}
              </div>
              <div class="intent-card-footer">
                <span class="intent-wo-count">${intent.woCount || 0} WOs</span>
                <span class="intent-date">${intent.createdAt ? formatRelativeTime(intent.createdAt) : ''}</span>
              </div>
            </div>
          `).join('')}
        </div>
        ${activeIntents.length > 3 ? `
          <p class="intent-more">+${activeIntents.length - 3} more active intents</p>
        ` : ''}
      ` : `
        <div class="intent-empty">
          <span class="empty-icon">&#128173;</span>
          <p>No active intents</p>
          <p class="empty-hint">Intents are the root of all strategic work</p>
        </div>
      `}

      <div class="intent-actions">
        <button class="action-btn-sm primary" onclick="navigateTo('forge-intents')">
          View All Intents
        </button>
        <button class="action-btn-sm" onclick="openCreateIntentModal()">
          + New Intent
        </button>
      </div>
    </section>
  `;
}

// Render the 9-phase ribbon showing current position
function renderPhaseRibbon(currentPhase) {
  const currentIdx = INTENT_PHASES.findIndex(p => p.id === currentPhase);
  return `
    <div class="phase-ribbon">
      ${INTENT_PHASES.map((phase, idx) => {
        let status = 'future';
        if (idx < currentIdx) status = 'completed';
        else if (idx === currentIdx) status = 'current';
        return `
          <div class="phase-dot ${status}" title="${phase.name}">
            <span class="dot-inner"></span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// View a specific intent
function viewIntent(intentId) {
  state.selectedIntentId = intentId;
  navigateTo('intent-detail');
}

// Open create intent modal
function openCreateIntentModal() {
  state.intentFormMode = 'create';
  state.intentFormData = {
    title: '',
    narrative: '',
    successSignals: [],
    classification: 'feature',
    riskFlags: []
  };
  navigateTo('create-intent');
}

// === FCL-1: Forge State Pack Panel ===

function renderFSPPanel() {
  const fsp = state.forgeStatePack;
  const error = state.forgeStatePackError;

  // Loading state
  if (!fsp && !error) {
    return `
      <section class="panel fsp-panel">
        <h2 class="panel-title">&#129504; Forge State Pack</h2>
        <div class="fsp-loading">
          <span class="loading-icon">&#8987;</span>
          <span>Loading state pack...</span>
        </div>
      </section>
    `;
  }

  // Error state
  if (error) {
    return `
      <section class="panel fsp-panel fsp-error">
        <h2 class="panel-title">&#129504; Forge State Pack</h2>
        <div class="fsp-error-card">
          <span class="error-icon">&#9888;</span>
          <div class="error-content">
            <p><strong>State Pack unavailable</strong></p>
            <p class="error-detail">${error}</p>
            <p class="error-guidance">FSP provides runtime state for agent context loading. Run generate-fsp.mjs to create.</p>
            <p class="error-path">Expected: <code>${FSP_URL}</code></p>
          </div>
        </div>
      </section>
    `;
  }

  // Success state - render FSP data
  const arc = fsp.activeArc || {};
  const wo = fsp.workOrders || {};
  const risks = fsp.risks || [];
  const anchors = fsp.narrativeAnchors || [];

  // Arc badge styling
  const arcColors = {
    'Reliability': 'arc-reliability',
    'Velocity': 'arc-velocity',
    'Delight': 'arc-delight'
  };
  const arcClass = arcColors[arc.current] || 'arc-default';

  // Risk severity styling
  const riskSeverityIcons = {
    'critical': '&#128308;',
    'high': '&#128992;',
    'medium': '&#128993;',
    'low': '&#128994;'
  };

  const risksHtml = risks.slice(0, 3).map(risk => `
    <div class="fsp-risk-item risk-${risk.severity}">
      <span class="risk-icon">${riskSeverityIcons[risk.severity] || '&#9679;'}</span>
      <span class="risk-text">${risk.description}</span>
    </div>
  `).join('');

  const anchorsHtml = anchors.map(anchor => `
    <div class="fsp-anchor-item ${anchor.active ? 'anchor-active' : 'anchor-inactive'}">
      <span class="anchor-name">${anchor.name}</span>
      <span class="anchor-weight">${(anchor.weight * 100).toFixed(0)}%</span>
    </div>
  `).join('');

  return `
    <section class="panel fsp-panel">
      <h2 class="panel-title">&#129504; Forge State Pack</h2>
      <div class="fsp-content">
        <div class="fsp-arc-header">
          <div class="fsp-arc">
            <span class="arc-label">Active Arc:</span>
            <span class="arc-badge ${arcClass}">${arc.current || 'Unknown'}</span>
          </div>
          <div class="fsp-version">
            <span class="version-label">v${fsp.schemaVersion || '?'}</span>
          </div>
        </div>

        <div class="fsp-anchors">
          <h4 class="fsp-section-title">Narrative Anchors</h4>
          <div class="anchors-grid">
            ${anchorsHtml}
          </div>
        </div>

        <div class="fsp-wo-summary">
          <h4 class="fsp-section-title">Work Orders</h4>
          <div class="wo-stats-grid">
            <div class="wo-stat">
              <span class="wo-stat-value">${wo.total || 0}</span>
              <span class="wo-stat-label">Total</span>
            </div>
            <div class="wo-stat">
              <span class="wo-stat-value">${wo.byStatus?.approved || 0}</span>
              <span class="wo-stat-label">Approved</span>
            </div>
            <div class="wo-stat">
              <span class="wo-stat-value">${wo.byStatus?.executed || 0}</span>
              <span class="wo-stat-label">Executed</span>
            </div>
          </div>
          ${(wo.missingGates?.length > 0) ? `
            <div class="wo-warning">
              <span class="warning-icon">&#9888;</span>
              <span>${wo.missingGates.length} WO(s) missing gates</span>
            </div>
          ` : ''}
        </div>

        ${risks.length > 0 ? `
        <div class="fsp-risks">
          <h4 class="fsp-section-title">Active Risks (${risks.length})</h4>
          ${risksHtml}
        </div>
        ` : ''}

        <div class="fsp-meta">
          <div class="meta-row">
            <span class="meta-label">Generated:</span>
            <span class="meta-value">${formatRelativeTime(fsp.generatedAt)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">By:</span>
            <span class="meta-value">${fsp.generatedBy || 'unknown'}</span>
          </div>
        </div>
      </div>
    </section>
  `;
}

// === FCL-2: Heartbeat Panel ===

function renderHeartbeatPanel() {
  const hb = state.heartbeat;
  const running = state.heartbeatRunning;
  const fspAvailable = !!state.forgeStatePack;

  // FSP not available - can't run Heartbeat
  if (!fspAvailable) {
    return `
      <section class="panel heartbeat-panel heartbeat-unavailable">
        <h2 class="panel-title">&#128147; Heartbeat</h2>
        <div class="heartbeat-notice">
          <span class="notice-icon">&#9888;</span>
          <span>Forge State Pack required to run Heartbeat</span>
        </div>
      </section>
    `;
  }

  // Running state
  if (running) {
    return `
      <section class="panel heartbeat-panel heartbeat-running">
        <h2 class="panel-title">&#128147; Heartbeat</h2>
        <div class="heartbeat-loading">
          <span class="loading-icon pulse">&#128147;</span>
          <span>Assessing system health...</span>
        </div>
      </section>
    `;
  }

  // No result yet - show trigger
  if (!hb) {
    return `
      <section class="panel heartbeat-panel heartbeat-ready">
        <h2 class="panel-title">&#128147; Heartbeat</h2>
        <p class="heartbeat-desc">Assess institutional health and get next move recommendation.</p>
        <div class="heartbeat-actions">
          <button class="action-btn-primary" onclick="runHeartbeat()">
            <span class="btn-icon">&#128147;</span>
            <span>Run Heartbeat</span>
          </button>
        </div>
      </section>
    `;
  }

  // Render result
  const ir = hb.integrityReport;
  const nm = hb.nextMove;

  // Health status styling
  const healthColors = {
    'healthy': 'health-healthy',
    'at_risk': 'health-at-risk',
    'degraded': 'health-degraded'
  };
  const healthIcons = {
    'healthy': '&#9989;',
    'at_risk': '&#9888;',
    'degraded': '&#10060;'
  };
  const healthLabels = {
    'healthy': 'Healthy',
    'at_risk': 'At Risk',
    'degraded': 'Attention Needed'
  };

  const healthClass = healthColors[ir.overallHealth] || 'health-healthy';
  const healthIcon = healthIcons[ir.overallHealth] || '&#9679;';
  const healthLabel = healthLabels[ir.overallHealth] || ir.overallHealth;

  // Priority styling
  const priorityColors = {
    'immediate': 'priority-immediate',
    'soon': 'priority-soon',
    'when_available': 'priority-later'
  };
  const priorityLabels = {
    'immediate': 'Immediate',
    'soon': 'Soon',
    'when_available': 'When Available'
  };

  const priorityClass = priorityColors[nm.recommendation?.priority] || 'priority-later';
  const priorityLabel = priorityLabels[nm.recommendation?.priority] || nm.recommendation?.priority;

  // Signal status icons
  const signalIcons = {
    'healthy': '&#128994;',
    'at_risk': '&#128993;',
    'degraded': '&#128308;'
  };

  const signalsHtml = (ir.healthSignals || []).map(signal => `
    <div class="signal-item signal-${signal.status}">
      <span class="signal-icon">${signalIcons[signal.status] || '&#9679;'}</span>
      <span class="signal-domain">${signal.domain}</span>
      <span class="signal-indicator">${signal.indicator}</span>
    </div>
  `).join('');

  return `
    <section class="panel heartbeat-panel heartbeat-result">
      <div class="heartbeat-header">
        <h2 class="panel-title">&#128147; Heartbeat</h2>
        <div class="heartbeat-meta">
          <span class="heartbeat-time">${formatRelativeTime(hb.generatedAt)}</span>
          <button class="btn-icon-only" onclick="clearHeartbeat()" title="Clear">&#10006;</button>
        </div>
      </div>

      <div class="heartbeat-health-summary ${healthClass}">
        <div class="health-badge">
          <span class="health-icon">${healthIcon}</span>
          <span class="health-label">${healthLabel}</span>
        </div>
        <div class="health-score">
          <span class="score-value">${ir.healthScore}</span>
          <span class="score-max">/100</span>
        </div>
      </div>

      <div class="heartbeat-arc">
        <span class="arc-context">${ir.tone}</span>
      </div>

      <div class="heartbeat-next-move">
        <h3 class="next-move-title">Recommended Next Move</h3>
        <div class="next-move-card ${priorityClass}">
          <div class="move-priority">
            <span class="priority-badge">${priorityLabel}</span>
          </div>
          <div class="move-action">${nm.recommendation?.action || 'No action recommended'}</div>
          <div class="move-rationale">${nm.recommendation?.rationale || ''}</div>
          <div class="move-arc-note">${nm.recommendation?.arc_alignment || ''}</div>
        </div>
        ${nm.context?.alternatives_considered > 0 ? `
          <div class="move-alternatives">
            <span class="alt-note">${nm.context.alternatives_considered} other consideration(s) evaluated</span>
          </div>
        ` : ''}
      </div>

      <details class="heartbeat-signals-detail">
        <summary class="signals-summary">Health Signals (${ir.healthSignals?.length || 0})</summary>
        <div class="signals-list">
          ${signalsHtml}
        </div>
      </details>

      <div class="heartbeat-actions">
        <button class="action-btn-secondary" onclick="runHeartbeat()">
          <span class="btn-icon">&#128260;</span>
          <span>Re-run Heartbeat</span>
        </button>
      </div>
    </section>
  `;
}

// === FCL-3: Sentinel Panel ===

function renderSentinelPanel() {
  const sentinel = state.sentinel;
  const fspAvailable = !!state.forgeStatePack;

  if (!fspAvailable) {
    return `
      <section class="panel sentinel-panel sentinel-unavailable">
        <h2 class="panel-title"><span class="status-icon">&#9673;</span> Sentinel</h2>
        <div class="routine-notice">
          <span class="notice-icon">&#9888;</span>
          <span>FSP required for health monitoring</span>
        </div>
      </section>
    `;
  }

  if (!sentinel) {
    return `
      <section class="panel sentinel-panel sentinel-ready">
        <h2 class="panel-title"><span class="status-icon">&#9673;</span> Sentinel</h2>
        <p class="routine-desc">Health monitoring routine. Run Heartbeat to activate.</p>
      </section>
    `;
  }

  // Status icons and labels (accessible - not just color)
  const statusDisplay = {
    'clear': { icon: '&#9679;', label: 'Clear', class: 'status-clear' },
    'watching': { icon: '&#9680;', label: 'Watching', class: 'status-watching' },
    'warning': { icon: '&#9681;', label: 'Warning', class: 'status-warning' },
    'alert': { icon: '&#9675;', label: 'Alert', class: 'status-alert' }
  };

  const overall = statusDisplay[sentinel.overallStatus] || statusDisplay['clear'];

  const domainsHtml = (sentinel.watchedDomains || []).map(d => {
    const ds = statusDisplay[d.status] || statusDisplay['clear'];
    return `
      <div class="sentinel-domain ${ds.class}">
        <span class="domain-icon">${ds.icon}</span>
        <span class="domain-name">${d.domain}</span>
        <span class="domain-status">${ds.label}</span>
        <span class="domain-indicator">${d.indicator}</span>
      </div>
    `;
  }).join('');

  const warningsHtml = (sentinel.activeWarnings || []).slice(0, 3).map(w => `
    <div class="sentinel-warning warning-${w.level}">
      <span class="warning-level">${w.level}</span>
      <span class="warning-message">${w.message}</span>
    </div>
  `).join('');

  return `
    <section class="panel sentinel-panel sentinel-active">
      <div class="sentinel-header">
        <h2 class="panel-title"><span class="status-icon">${overall.icon}</span> Sentinel</h2>
        <span class="sentinel-status-badge ${overall.class}">${overall.label}</span>
      </div>
      <p class="sentinel-tone">${sentinel.tone}</p>

      <details class="sentinel-domains-detail">
        <summary class="domains-summary">Watched Domains (${sentinel.watchedDomains?.length || 0})</summary>
        <div class="domains-list">
          ${domainsHtml}
        </div>
      </details>

      ${sentinel.warningCount > 0 ? `
        <div class="sentinel-warnings">
          <h4 class="warnings-title">Active Warnings (${sentinel.warningCount})</h4>
          ${warningsHtml}
        </div>
      ` : ''}

      <div class="sentinel-meta">
        <span class="meta-time">${formatRelativeTime(sentinel.generatedAt)}</span>
      </div>
    </section>
  `;
}

// === FCL-3: Navigator Panel ===

function renderNavigatorPanel() {
  const nav = state.navigator;
  const fspAvailable = !!state.forgeStatePack;

  if (!fspAvailable) {
    return `
      <section class="panel navigator-panel navigator-unavailable">
        <h2 class="panel-title"><span class="nav-icon">&#9741;</span> Navigator</h2>
        <div class="routine-notice">
          <span class="notice-icon">&#9888;</span>
          <span>FSP required for guidance</span>
        </div>
      </section>
    `;
  }

  if (!nav) {
    return `
      <section class="panel navigator-panel navigator-ready">
        <h2 class="panel-title"><span class="nav-icon">&#9741;</span> Navigator</h2>
        <p class="routine-desc">Prioritization guidance. Run Heartbeat to activate.</p>
        <button class="action-btn-secondary" onclick="runNavigator(); render();">
          <span class="btn-icon">&#9741;</span>
          <span>Get Guidance</span>
        </button>
      </section>
    `;
  }

  const rec = nav.primaryRecommendation;
  const priorityClass = {
    'immediate': 'priority-immediate',
    'soon': 'priority-soon',
    'when_available': 'priority-later'
  }[rec?.priority] || 'priority-later';

  const inputsHtml = `
    <div class="nav-inputs">
      <span class="input-item">Arc: ${nav.inputsUsed?.activeArc}</span>
      <span class="input-item">Warnings: ${nav.inputsUsed?.sentinelWarnings}</span>
      <span class="input-item">Approved WOs: ${nav.inputsUsed?.approvedWOs}</span>
    </div>
  `;

  const alternativesHtml = (nav.alternativesConsidered || []).map(alt => `
    <div class="nav-alternative">
      <span class="alt-action">${alt.action}</span>
    </div>
  `).join('');

  return `
    <section class="panel navigator-panel navigator-active">
      <div class="navigator-header">
        <h2 class="panel-title"><span class="nav-icon">&#9741;</span> Navigator</h2>
      </div>

      <div class="nav-guidance-card ${priorityClass}">
        <div class="guidance-priority">
          <span class="priority-label">${rec?.priority || 'unknown'}</span>
          <span class="confidence-label">${rec?.confidence} confidence</span>
        </div>
        <div class="guidance-action">${rec?.action || 'No guidance'}</div>
        <div class="guidance-rationale">${rec?.rationale || ''}</div>
        <div class="guidance-arc">${rec?.arc_alignment || ''}</div>
      </div>

      <details class="nav-inputs-detail">
        <summary class="inputs-summary">Inputs Used</summary>
        ${inputsHtml}
      </details>

      ${nav.alternativesConsidered?.length > 0 ? `
        <details class="nav-alternatives-detail">
          <summary class="alternatives-summary">Alternatives (${nav.alternativesConsidered.length})</summary>
          <div class="alternatives-list">
            ${alternativesHtml}
          </div>
        </details>
      ` : ''}

      <div class="navigator-meta">
        <span class="meta-time">${formatRelativeTime(nav.generatedAt)}</span>
      </div>
    </section>
  `;
}

// === FCL-3: Chronicler Panel ===

function renderChroniclerPanel() {
  const entries = getRecentChroniclerEntries(5);
  const queueCount = state.chroniclerQueue?.length || 0;

  // FCL v2: Extended event icons including intent and gate events
  const eventIcons = {
    'heartbeat': '&#128147;',
    'sentinel_warning': '&#9888;',
    'navigator_guidance': '&#9741;',
    'wo_transition': '&#128196;',
    'arc_change': '&#127919;',
    'risk_detected': '&#9888;',
    'manual_note': '&#128221;',
    // FCL v2 Intent events
    'intent_created': '&#127919;',
    'intent_wo_spawned': '&#128196;',
    'intent_phase_change': '&#9654;',
    'intent_completed': '&#9989;',
    'intent_abandoned': '&#10060;',
    // FCL v2 Gate events
    'gate_blocked': '&#128683;',
    'gate_observed': '&#128065;',
    'gate_overridden': '&#128275;'
  };

  const entriesHtml = entries.map(entry => {
    // FCL v2: Show context badges for intent/WO
    const contextBadges = [];
    if (entry.context?.intentId) {
      contextBadges.push(`<span class="context-badge intent">${entry.context.intentId.substring(0, 12)}</span>`);
    }
    if (entry.context?.woId) {
      contextBadges.push(`<span class="context-badge wo">${entry.context.woId}</span>`);
    }

    return `
      <div class="chronicler-entry ${entry.eventType?.startsWith('gate_') ? 'gate-event' : ''}">
        <span class="entry-icon">${eventIcons[entry.eventType] || '&#9679;'}</span>
        <div class="entry-content">
          <span class="entry-summary">${entry.summary}</span>
          ${contextBadges.length > 0 ? `<div class="entry-context">${contextBadges.join('')}</div>` : ''}
          <span class="entry-time">${formatRelativeTime(entry.timestamp)}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="panel chronicler-panel">
      <div class="chronicler-header">
        <h2 class="panel-title"><span class="chr-icon">&#128218;</span> Chronicler</h2>
        ${queueCount > 0 ? `<span class="queue-badge">${queueCount} queued</span>` : ''}
      </div>
      <p class="chronicler-desc">Institutional memory. ${state.chronicler?.length || 0} entries recorded.</p>

      ${renderActivitySummary()}

      ${entries.length > 0 ? `
        <div class="chronicler-entries">
          <h4 class="entries-title">Recent Events</h4>
          ${entriesHtml}
        </div>
      ` : `
        <div class="chronicler-empty">
          <span>No entries yet. Run Heartbeat to begin recording.</span>
        </div>
      `}

      <div class="chronicler-actions">
        <button class="action-btn-secondary" onclick="promptAddNote()">
          <span class="btn-icon">&#128221;</span>
          <span>Add Note</span>
        </button>
        ${queueCount > 0 ? `
          <button class="action-btn-secondary" onclick="showQueueExport()">
            <span class="btn-icon">&#128230;</span>
            <span>Export Queue</span>
          </button>
        ` : ''}
      </div>
    </section>
  `;
}

// Prompt for manual note
function promptAddNote() {
  const note = prompt('Add a note to the Chronicler:');
  if (note && note.trim()) {
    addChroniclerNote(note);
  }
}

// Show queue export (for manual flush)
function showQueueExport() {
  const jsonl = exportChroniclerQueue();
  if (jsonl) {
    console.log('[Portal] Chronicler queue export:\n' + jsonl);
    alert(`Chronicler queue (${state.chroniclerQueue.length} entries) logged to console.\n\nTo persist, run:\nnode "The Forge/forge/ops/scripts/flush-chronicler.mjs"`);
  } else {
    alert('No entries in queue.');
  }
}

// === FCL-4: Reflex Panel ===

function renderReflexPanel() {
  const warnings = state.reflexWarnings || [];
  const drafts = state.repairDrafts || [];

  if (warnings.length === 0) {
    return `
      <section class="panel reflex-panel reflex-clear">
        <div class="reflex-header">
          <h2 class="panel-title"><span class="reflex-icon">&#9889;</span> Reflex Rules</h2>
          <span class="reflex-status-badge status-clear">Clear</span>
        </div>
        <p class="reflex-desc">No violations detected. All contracts and invariants satisfied.</p>
      </section>
    `;
  }

  // Group warnings by severity
  const alerts = warnings.filter(w => w.violation.severity === 'alert');
  const warningLevel = warnings.filter(w => w.violation.severity === 'warning');
  const cautions = warnings.filter(w => w.violation.severity === 'caution');
  const infos = warnings.filter(w => w.violation.severity === 'info');

  // Determine overall status
  let overallStatus = 'info';
  let statusLabel = 'Info';
  if (alerts.length > 0) { overallStatus = 'alert'; statusLabel = 'Alert'; }
  else if (warningLevel.length > 0) { overallStatus = 'warning'; statusLabel = 'Warning'; }
  else if (cautions.length > 0) { overallStatus = 'caution'; statusLabel = 'Caution'; }

  const severityIcons = {
    'alert': '&#9888;',
    'warning': '&#9888;',
    'caution': '&#9432;',
    'info': '&#9432;'
  };

  const warningsHtml = warnings.map(w => `
    <div class="reflex-warning severity-${w.violation.severity}">
      <div class="warning-header">
        <span class="warning-icon">${severityIcons[w.violation.severity]}</span>
        <span class="warning-rule">${w.rule.name}</span>
        <span class="warning-severity-badge">${w.violation.severity}</span>
      </div>
      <div class="warning-message">${w.message}</div>
      <div class="warning-context">${w.context}</div>
      <div class="warning-violation">
        <span class="violation-label">Violates:</span>
        <span class="violation-contract">${w.violation.contract}</span>
      </div>
      <div class="warning-tone">${w.tone}</div>
      ${w.repair.draft ? `
        <div class="warning-repair">
          <span class="repair-label">Suggested repair:</span>
          <span class="repair-action">${w.repair.suggestion}</span>
          <button class="btn-copy-draft" onclick='copyRepairDraft(${JSON.stringify(w.repair.draft).replace(/'/g, "&#39;")})'>
            Copy Draft WO
          </button>
        </div>
      ` : `
        <div class="warning-repair">
          <span class="repair-label">Suggested action:</span>
          <span class="repair-action">${w.repair.suggestion}</span>
        </div>
      `}
    </div>
  `).join('');

  return `
    <section class="panel reflex-panel reflex-active">
      <div class="reflex-header">
        <h2 class="panel-title"><span class="reflex-icon">&#9889;</span> Reflex Rules</h2>
        <span class="reflex-status-badge status-${overallStatus}">${statusLabel} (${warnings.length})</span>
      </div>
      <p class="reflex-desc">Detected ${warnings.length} violation(s) requiring attention.</p>

      <div class="reflex-summary">
        ${alerts.length > 0 ? `<span class="summary-badge badge-alert">${alerts.length} Alert</span>` : ''}
        ${warningLevel.length > 0 ? `<span class="summary-badge badge-warning">${warningLevel.length} Warning</span>` : ''}
        ${cautions.length > 0 ? `<span class="summary-badge badge-caution">${cautions.length} Caution</span>` : ''}
        ${infos.length > 0 ? `<span class="summary-badge badge-info">${infos.length} Info</span>` : ''}
      </div>

      <div class="reflex-warnings-list">
        ${warningsHtml}
      </div>

      ${drafts.length > 0 ? `
        <div class="reflex-drafts-summary">
          <span class="drafts-count">${drafts.length} repair draft(s) available</span>
        </div>
      ` : ''}
    </section>
  `;
}

// Render CC status badge for WO cards
function renderCCBadge(woId, woStatus) {
  const ccStatus = getWoCCStatus(woId, woStatus);

  if (!ccStatus.required) {
    return '';  // No badge needed for non-executed WOs
  }

  if (ccStatus.present) {
    return `<span class="cc-badge cc-present" title="Continuation Contract present">&#10003; CC</span>`;
  } else {
    return `<span class="cc-badge cc-missing" title="Missing Continuation Contract">&#9888; Missing CC</span>`;
  }
}

// === FCL-5: Genome Panel ===

function renderGenomePanel() {
  const genome = getEnrichedGenome();
  const stableCount = genome.stable?.length || 0;
  const experimentalCount = genome.experimental?.length || 0;
  const eligibleCount = genome.experimental?.filter(a => a.eligibleForGraduation).length || 0;

  // Render stable artifacts (collapsed by default)
  const stableHtml = genome.stable?.map(artifact => `
    <div class="genome-artifact stable-artifact">
      <span class="artifact-icon">&#128994;</span>
      <div class="artifact-info">
        <span class="artifact-name">${artifact.name}</span>
        <span class="artifact-path">${artifact.path}</span>
      </div>
      <span class="artifact-date">Graduated: ${formatDate(artifact.graduatedAt)}</span>
    </div>
  `).join('') || '';

  // Render experimental artifacts with eligibility
  const experimentalHtml = genome.experimental?.map(artifact => {
    const daysRemaining = GRADUATION_OBSERVATION_DAYS - (artifact.daysSinceIntroduction || 0);
    let statusClass, statusIcon, statusText;

    if (artifact.eligibleForGraduation) {
      statusClass = 'eligible';
      statusIcon = '&#128994;';  // Green circle
      statusText = 'Eligible for graduation';
    } else if (artifact.eligibilityReason === 'observation_pending') {
      statusClass = 'pending';
      statusIcon = '&#128993;';  // Yellow circle
      statusText = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
    } else {
      statusClass = 'blocked';
      statusIcon = '&#128308;';  // Red circle
      statusText = `Blocked: ${artifact.eligibilityReason?.replace(/_/g, ' ')}`;
    }

    return `
      <div class="genome-artifact experimental-artifact ${statusClass}">
        <div class="artifact-header">
          <span class="artifact-icon">&#128312;</span>
          <div class="artifact-info">
            <span class="artifact-name">${artifact.name}</span>
            <span class="artifact-path">${artifact.path}</span>
          </div>
        </div>
        <div class="artifact-status">
          <span class="status-indicator ${statusClass}">
            <span class="status-icon">${statusIcon}</span>
            <span class="status-text">${statusText}</span>
          </span>
          <span class="artifact-age">${artifact.daysSinceIntroduction || 0} days observed</span>
        </div>
        ${artifact.eligibleForGraduation ? `
          <div class="artifact-actions">
            <button class="btn-graduate" onclick="copyGraduationDraft('${artifact.path.replace(/'/g, "\\'")}')">
              <span class="btn-icon">&#128196;</span>
              <span>Draft Graduation WO</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('') || '';

  return `
    <section class="panel genome-panel">
      <div class="genome-header">
        <h2 class="panel-title"><span class="genome-icon">&#129516;</span> Genome</h2>
        <div class="genome-counts">
          <span class="count-badge stable-badge">${stableCount} Stable</span>
          <span class="count-badge experimental-badge">${experimentalCount} Experimental</span>
        </div>
      </div>
      <p class="genome-desc">Two-speed artifact classification. ${eligibleCount > 0 ? `<strong>${eligibleCount} artifact${eligibleCount !== 1 ? 's' : ''} eligible for graduation.</strong>` : 'No artifacts currently eligible for graduation.'}</p>

      ${experimentalCount > 0 ? `
        <div class="genome-section experimental-section">
          <h4 class="section-title">
            <span class="section-icon">&#128312;</span>
            Experimental
            <span class="section-count">(${experimentalCount})</span>
          </h4>
          <div class="genome-artifacts">
            ${experimentalHtml}
          </div>
        </div>
      ` : ''}

      <details class="genome-section stable-section">
        <summary class="section-title">
          <span class="section-icon">&#128994;</span>
          Stable
          <span class="section-count">(${stableCount})</span>
        </summary>
        <div class="genome-artifacts">
          ${stableHtml || '<p class="empty-section">No stable artifacts yet.</p>'}
        </div>
      </details>

      <div class="genome-footer">
        <a href="${GENOME_CONTRACT_URL}" class="genome-docs-link" target="_blank">
          <span class="link-icon">&#128214;</span>
          <span>Genome Contract</span>
        </a>
      </div>
    </section>
  `;
}

// === M3f: Deployment Status Panel ===

function renderDeploymentStatusPanel() {
  const obs = state.observations;
  const error = state.observationsError;
  const cache = state.deployStatusCache;

  // Determine data source: live observations or cache
  const hasLiveData = obs && !error;
  const hasCachedData = cache && !hasLiveData;
  const displayData = hasLiveData ? obs : (hasCachedData ? cache : null);

  // No data available at all
  if (!displayData && error) {
    return `
      <section class="panel deploy-status-panel deploy-status-error">
        <h2 class="panel-title">&#128640; Deployment Status</h2>
        <div class="deploy-status-error-card">
          <span class="error-icon">&#9888;</span>
          <div class="error-content">
            <p><strong>Status unavailable</strong></p>
            <p class="error-detail">${error}</p>
            <p class="error-guidance">Connect PAT for live GitHub Actions status, or run a deploy to generate observations.</p>
          </div>
        </div>
        <div class="deploy-actions">
          <a href="${REPO_BASE}/actions" class="btn-secondary" target="_blank">
            <span class="action-icon">&#8599;</span> View Actions
          </a>
        </div>
      </section>
    `;
  }

  // Still loading
  if (!displayData && !error) {
    return `
      <section class="panel deploy-status-panel">
        <h2 class="panel-title">&#128640; Deployment Status</h2>
        <div class="deploy-status-loading">
          <span class="loading-icon">&#8987;</span>
          <span>Loading deployment status...</span>
        </div>
      </section>
    `;
  }

  // Have data (live or cached)
  const smokeClass = displayData.smokePass ? 'smoke-pass' : 'smoke-fail';
  const smokeIcon = displayData.smokePass ? '&#9989;' : '&#10060;';
  const smokeLabel = displayData.smokePass ? 'PASS' : 'FAIL';
  const commitShort = displayData.commitShort || displayData.commitSha?.substring(0, 7) || 'unknown';
  const commitUrl = `${REPO_BASE}/commit/${displayData.commitSha || ''}`;

  return `
    <section class="panel deploy-status-panel">
      <h2 class="panel-title">&#128640; Deployment Status</h2>
      ${hasCachedData ? `
        <div class="cache-notice">
          <span class="cache-icon">&#128451;</span>
          <span>Showing cached data (offline mode)</span>
          <span class="cache-time">Cached: ${formatRelativeTime(cache.cachedAt)}</span>
        </div>
      ` : ''}
      <div class="deploy-status-cards">
        <div class="deploy-card env-${displayData.env}">
          <div class="deploy-card-header">
            <span class="env-badge env-${displayData.env}">${displayData.env.toUpperCase()}</span>
            <div class="deploy-smoke ${smokeClass}">
              <span class="smoke-icon">${smokeIcon}</span>
              <span class="smoke-label">${smokeLabel}</span>
            </div>
          </div>
          <div class="deploy-card-body">
            <div class="deploy-meta-row">
              <span class="meta-label">Branch:</span>
              <span class="meta-value">${displayData.deployedBranch}</span>
            </div>
            <div class="deploy-meta-row">
              <span class="meta-label">Commit:</span>
              <a href="${commitUrl}" class="meta-value commit-link" target="_blank">
                <code>${commitShort}</code>
                <span class="link-icon">&#8599;</span>
              </a>
            </div>
            <div class="deploy-meta-row">
              <span class="meta-label">Deployed:</span>
              <span class="meta-value">${formatRelativeTime(displayData.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="deploy-actions">
        <a href="${REPO_BASE}/actions/workflows/forge-pages-deploy.yml" class="btn-secondary" target="_blank">
          <span class="action-icon">&#8599;</span> Deploy Workflow
        </a>
        <a href="${REPO_BASE}/actions/workflows/forge-observations-commit.yml" class="btn-secondary" target="_blank">
          <span class="action-icon">&#8599;</span> Observations Workflow
        </a>
        <button class="btn-secondary" onclick="loadData()">
          <span class="action-icon">&#8635;</span> Refresh
        </button>
      </div>
    </section>
  `;
}

// === M3g: Evolution Proposal Screen ===

function renderEvolutionProposalScreen() {
  const workOrders = state.workOrders?.workOrders || [];
  const proposals = state.evolutionProposals || {};
  const totalProposals = Object.values(proposals).reduce((sum, arr) => sum + arr.length, 0);

  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Evolution Proposal</h2>
      </div>
      <div class="info-card">
        <span class="info-icon">&#128161;</span>
        <p>Draft an evolution proposal for a Work Order. Proposals can be saved locally and optionally posted to GitHub.</p>
      </div>

      <form id="evolution-proposal-form" class="proposal-form">
        <div class="form-group">
          <label for="proposal-wo-select">Select Work Order</label>
          <select id="proposal-wo-select" required>
            <option value="">-- Select a WO --</option>
            ${workOrders.map(wo => `
              <option value="${wo.id}" data-issue="${wo.issueNumber || ''}">${wo.id}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="proposal-title">Proposal Title</label>
          <input type="text" id="proposal-title" placeholder="e.g., Add caching layer for performance" required maxlength="200" />
        </div>

        <div class="form-group">
          <label for="proposal-body">Proposal Body (Markdown)</label>
          <textarea id="proposal-body" rows="10" placeholder="Describe the evolution proposal...

## Motivation
Why is this change needed?

## Proposed Change
What specifically should change?

## Impact
What areas are affected?

## Acceptance Criteria
How do we know this is complete?" required></textarea>
          <span class="char-count" id="proposal-char-count">0 / 5000</span>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-primary" onclick="handleSaveProposal()">
            <span class="action-icon">&#128190;</span> Save Locally
          </button>
          <button type="button" class="btn-secondary" onclick="handleCopyProposalMarkdown()">
            <span class="action-icon">&#128203;</span> Copy as Markdown
          </button>
          ${hasPAT() ? `
            <button type="button" class="btn-secondary" onclick="handlePostProposalToGitHub()">
              <span class="action-icon">&#128640;</span> Post to GitHub
            </button>
          ` : `
            <div class="pat-hint">
              <span>&#128274;</span>
              <span>Configure <a href="#" onclick="navigateTo('settings'); return false;">PAT</a> to post to GitHub</span>
            </div>
          `}
        </div>
      </form>

      ${totalProposals > 0 ? `
        <section class="saved-proposals">
          <h3 class="panel-title">Saved Proposals (${totalProposals})</h3>
          <div class="proposals-list">
            ${Object.entries(proposals).map(([woId, woProposals]) => `
              <div class="proposal-group">
                <h4 class="proposal-group-title">${woId} (${woProposals.length})</h4>
                ${woProposals.slice(0, 3).map((p, idx) => `
                  <div class="proposal-item">
                    <span class="proposal-title">${escapeHtml(p.title || 'Untitled')}</span>
                    <span class="proposal-time">${formatRelativeTime(p.savedAt)}</span>
                  </div>
                `).join('')}
                ${woProposals.length > 3 ? `<p class="more-hint">+${woProposals.length - 3} more</p>` : ''}
              </div>
            `).join('')}
          </div>
        </section>
      ` : ''}
    </section>
  `;
}

function bindEvolutionProposalForm() {
  const bodyTextarea = document.getElementById('proposal-body');
  const charCount = document.getElementById('proposal-char-count');

  if (bodyTextarea && charCount) {
    bodyTextarea.addEventListener('input', () => {
      const len = bodyTextarea.value.length;
      charCount.textContent = `${len} / 5000`;
      if (len > 5000) {
        charCount.classList.add('over-limit');
      } else {
        charCount.classList.remove('over-limit');
      }
    });
  }
}

function handleSaveProposal() {
  const woId = document.getElementById('proposal-wo-select')?.value;
  const title = document.getElementById('proposal-title')?.value?.trim();
  const body = document.getElementById('proposal-body')?.value?.trim();

  if (!woId) {
    showToast('Please select a Work Order', 'error');
    return;
  }
  if (!title) {
    showToast('Please enter a proposal title', 'error');
    return;
  }
  if (!body) {
    showToast('Please enter proposal body', 'error');
    return;
  }

  const proposal = { title, body };
  saveEvolutionProposal(woId, proposal);
  showToast('Proposal saved locally!', 'success');
  render();  // Re-render to show updated list
}

function buildProposalMarkdown(woId, title, body) {
  return `## Evolution Proposal

**Work Order:** ${woId}
**Title:** ${title}
**Submitted:** ${new Date().toISOString()}

---

${body}

---
_Submitted via Forge Portal_`;
}

async function handleCopyProposalMarkdown() {
  const woId = document.getElementById('proposal-wo-select')?.value;
  const title = document.getElementById('proposal-title')?.value?.trim();
  const body = document.getElementById('proposal-body')?.value?.trim();

  if (!woId || !title || !body) {
    showToast('Please fill all fields before copying', 'error');
    return;
  }

  const markdown = buildProposalMarkdown(woId, title, body);
  const copied = await copyToClipboard(markdown);
  showToast(copied ? 'Markdown copied!' : 'Copy failed', copied ? 'success' : 'error');
}

async function handlePostProposalToGitHub() {
  const select = document.getElementById('proposal-wo-select');
  const woId = select?.value;
  const issueNumber = select?.selectedOptions[0]?.dataset?.issue;
  const title = document.getElementById('proposal-title')?.value?.trim();
  const body = document.getElementById('proposal-body')?.value?.trim();

  if (!woId || !title || !body) {
    showToast('Please fill all fields before posting', 'error');
    return;
  }

  if (!issueNumber) {
    showToast('This WO has no linked GitHub Issue. Use Copy as Markdown instead.', 'error');
    return;
  }

  try {
    const markdown = buildProposalMarkdown(woId, title, body);
    await addCommentToIssue(parseInt(issueNumber, 10), markdown);
    showToast('Proposal posted to GitHub!', 'success');

    // Also save locally
    saveEvolutionProposal(woId, { title, body, postedToGitHub: true, issueNumber });
    render();
  } catch (e) {
    showToast(`Failed to post: ${e.message}`, 'error');
  }
}

// === M3f: Deployment Status Full Screen ===

function renderDeploymentStatusScreen() {
  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Deployment Status</h2>
      </div>
      <div class="info-card">
        <span class="info-icon">&#128640;</span>
        <p>View current deployment status for dev and prod environments. Data is sourced from deployment observations and cached for offline access.</p>
      </div>
    </section>
    ${renderDeploymentStatusPanel()}
  `;
}

// === COMMAND CENTRE SCREENS (WO-PORTAL-UX-001) ===

/**
 * Command Screen - Dashboard/home view for current entity context
 * Shows: World overview, health status, next best actions, activity feed
 */
function renderCommandScreen() {
  const sp = state.sharePack;
  const wo = state.workOrders;
  const fsp = state.forgeStatePack;
  const entities = state.entities?.entities || [];
  const currentEntity = state.currentEntity || 'forge';

  // Entity-specific title
  const entityTitle = currentEntity === 'forante' ? 'Forante Network' :
                      currentEntity === 'forge' ? 'Forge OS' :
                      entities.find(e => e.id === currentEntity)?.name || 'Entity';

  return `
    <section class="panel command-welcome">
      <div class="command-header-row">
        <h2 class="panel-title-large">&#127970; ${entityTitle}</h2>
        ${renderEnvironmentBadge()}
      </div>
      <p class="panel-subtitle">Command Centre &mdash; ${formatRelativeTime(new Date().toISOString())}</p>
    </section>

    ${renderWorldOverview()}

    ${renderNextBestActions()}

    ${renderActivityFeed()}

    <section class="panel quick-nav">
      <h2 class="panel-title">Quick Actions</h2>
      <div class="nav-cards">
        <button class="nav-card" onclick="navigateTo('lifecycle')">
          <span class="nav-card-icon">&#128260;</span>
          <span class="nav-card-title">Lifecycle</span>
          <span class="nav-card-desc">WOs & Intents</span>
        </button>
        <button class="nav-card" onclick="navigateTo('ops')">
          <span class="nav-card-icon">&#128736;</span>
          <span class="nav-card-title">Operations</span>
          <span class="nav-card-desc">${entities.length} entities</span>
        </button>
        <button class="nav-card" onclick="navigateTo('config')">
          <span class="nav-card-icon">&#9881;</span>
          <span class="nav-card-title">Config</span>
          <span class="nav-card-desc">Governance</span>
        </button>
        <button class="nav-card" onclick="loadData()">
          <span class="nav-card-icon">&#8635;</span>
          <span class="nav-card-title">Refresh</span>
          <span class="nav-card-desc">Reload data</span>
        </button>
      </div>
    </section>
  `;
}

/**
 * World Overview Panel - Shows entity network health at a glance
 * Clicking nodes switches entity context
 */
function renderWorldOverview() {
  const sp = state.sharePack;
  const wo = state.workOrders;
  const fsp = state.forgeStatePack;
  const entities = state.entities?.entities || [];
  const currentEntity = state.currentEntity || 'forge';

  // Calculate health metrics
  const hasAlerts = (state.reflexWarnings || []).some(w => w.violation?.severity === 'alert');
  const foranteHealth = sp ? 'healthy' : 'unknown';
  const forgeHealth = hasAlerts ? 'warning' : (wo ? 'healthy' : 'unknown');
  const entityHealth = entities.length > 0 ? 'healthy' : 'unknown';

  return `
    <section class="panel world-overview">
      <h2 class="panel-title">World Overview</h2>
      <div class="world-map">
        <div class="world-node forante-node ${foranteHealth} ${currentEntity === 'forante' ? 'selected' : ''}"
             onclick="selectEntity('forante')" title="Switch to Forante Network">
          <span class="node-icon">&#127970;</span>
          <span class="node-name">Forante</span>
          <span class="node-status">${sp ? 'Online' : 'Unknown'}</span>
        </div>
        <div class="world-connector"></div>
        <div class="world-node forge-node ${forgeHealth} ${currentEntity === 'forge' ? 'selected' : ''}"
             onclick="selectEntity('forge')" title="Switch to Forge OS">
          <span class="node-icon">&#9881;</span>
          <span class="node-name">Forge</span>
          <span class="node-status">${wo ? `${wo.counts.total} WOs` : 'Loading'}</span>
        </div>
        <div class="world-connector"></div>
        <div class="world-node entities-node ${entityHealth} ${currentEntity !== 'forante' && currentEntity !== 'forge' ? 'selected' : ''}"
             onclick="navigateTo('ops')" title="View Entities">
          <span class="node-icon">&#128736;</span>
          <span class="node-name">Entities</span>
          <span class="node-status">${entities.length} registered</span>
        </div>
      </div>
      ${sp ? `<p class="world-commit">Commit: <code>${sp.commitShort}</code></p>` : ''}
    </section>
  `;
}

/**
 * Next Best Actions Panel - Autopilot suggestions based on current state
 */
function renderNextBestActions() {
  const wo = state.workOrders;
  const fsp = state.forgeStatePack;
  const warnings = state.reflexWarnings || [];

  const actions = [];

  // Check for approved WOs needing execution
  if (wo?.counts?.approved > 0) {
    actions.push({
      icon: '&#9889;',
      title: 'Execute Approved Work Orders',
      desc: `${wo.counts.approved} WO(s) ready for execution`,
      action: "navigateTo('work-orders')"
    });
  }

  // Check for active warnings
  if (warnings.length > 0) {
    const alertCount = warnings.filter(w => w.violation?.severity === 'alert').length;
    if (alertCount > 0) {
      actions.push({
        icon: '&#9888;',
        title: 'Address Active Alerts',
        desc: `${alertCount} alert(s) require attention`,
        action: "navigateTo('lifecycle')"
      });
    }
  }

  // Check for missing continuation contracts
  if (fsp?.workOrders?.missingGates?.length > 0) {
    actions.push({
      icon: '&#128221;',
      title: 'Add Continuation Contracts',
      desc: `${fsp.workOrders.missingGates.length} WO(s) missing CC`,
      action: "navigateTo('work-orders')"
    });
  }

  // Default action if nothing urgent
  if (actions.length === 0) {
    actions.push({
      icon: '&#10004;',
      title: 'All Clear',
      desc: 'No urgent actions required',
      action: null
    });
  }

  return `
    <section class="panel next-actions">
      <h2 class="panel-title">&#128161; Next Best Actions</h2>
      <div class="action-list">
        ${actions.slice(0, 3).map(a => `
          <div class="action-item ${a.action ? 'clickable' : ''}" ${a.action ? `onclick="${a.action}"` : ''}>
            <span class="action-icon">${a.icon}</span>
            <div class="action-text">
              <span class="action-title">${a.title}</span>
              <span class="action-desc">${a.desc}</span>
            </div>
            ${a.action ? '<span class="action-chevron">&#8250;</span>' : ''}
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

/**
 * Activity Feed Panel - Recent Chronicler events
 */
function renderActivityFeed() {
  const entries = state.chronicler || [];
  const recent = entries.slice(-5).reverse();

  if (recent.length === 0) {
    return `
      <section class="panel activity-feed">
        <h2 class="panel-title">&#128240; Recent Activity</h2>
        <p class="empty-state">No recent activity recorded</p>
      </section>
    `;
  }

  return `
    <section class="panel activity-feed">
      <h2 class="panel-title">&#128240; Recent Activity</h2>
      <div class="activity-list">
        ${recent.map(entry => `
          <div class="activity-item">
            <span class="activity-icon">${getEventIcon(entry.eventType)}</span>
            <div class="activity-text">
              <span class="activity-summary">${entry.summary}</span>
              <span class="activity-time">${formatRelativeTime(entry.timestamp)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

/**
 * Get icon for Chronicler event type
 */
function getEventIcon(eventType) {
  const icons = {
    'heartbeat': '&#128147;',
    'sentinel_warning': '&#9888;',
    'navigator_guidance': '&#129517;',
    'wo_transition': '&#128260;',
    'arc_change': '&#127919;',
    'risk_detected': '&#9888;',
    'manual_note': '&#128221;',
    'intent_created': '&#127919;',
    'intent_wo_spawned': '&#128260;',
    'intent_phase_change': '&#10145;',
    'intent_completed': '&#10004;',
    'intent_abandoned': '&#10060;',
    'gate_blocked': '&#128683;'
  };
  return icons[eventType] || '&#128204;';
}

/**
 * Lifecycle Screen - WO management, Intents, phase tracking
 * Includes phase cockpit and intent ribbon before WO content
 */
function renderLifecycleScreen() {
  const intents = state.intents || [];
  const activeIntents = intents.filter(i => i.status === 'active');

  return `
    ${renderLifecycleHeader()}
    ${renderPhaseCockpit()}
    ${activeIntents.length > 0 ? renderActiveIntentRibbon(activeIntents) : ''}
    ${renderForgeTab()}
  `;
}

/**
 * Lifecycle Header - Shows current entity context and phase summary
 */
function renderLifecycleHeader() {
  const currentEntity = state.currentEntity || 'forge';
  const entityName = currentEntity === 'forante' ? 'All Entities' :
                     currentEntity === 'forge' ? 'Forge OS' :
                     state.entities?.entities?.find(e => e.id === currentEntity)?.name || currentEntity;

  return `
    <section class="panel lifecycle-header">
      <div class="lifecycle-header-row">
        <h2 class="panel-title-large">&#128260; Lifecycle</h2>
        <span class="entity-context-badge">${entityName}</span>
      </div>
      <p class="panel-subtitle">Work Orders, Intents, and Phase Management</p>
    </section>
  `;
}

/**
 * Phase Cockpit - Visual representation of the 9-phase lifecycle
 */
function renderPhaseCockpit() {
  const phases = [
    { id: 'ideation', name: 'Ideation', icon: '&#128161;', short: 'IDEA' },
    { id: 'requirements', name: 'Requirements', icon: '&#128221;', short: 'REQ' },
    { id: 'dissonance', name: 'Dissonance', icon: '&#128269;', short: 'DIS' },
    { id: 'design', name: 'Design', icon: '&#128295;', short: 'DES' },
    { id: 'execution', name: 'Execution', icon: '&#9889;', short: 'EXEC' },
    { id: 'validation', name: 'Validation', icon: '&#10004;', short: 'VAL' },
    { id: 'finalisation', name: 'Finalisation', icon: '&#128221;', short: 'FIN' },
    { id: 'production', name: 'Production', icon: '&#128640;', short: 'PROD' },
    { id: 'reflection', name: 'Reflection', icon: '&#128173;', short: 'REF' }
  ];

  // Count WOs by phase (infer from status if phase not set)
  const wo = state.workOrders?.workOrders || [];
  const phaseCounts = {};
  phases.forEach(p => phaseCounts[p.id] = 0);

  wo.forEach(w => {
    const phase = w.phase || inferPhaseFromStatus(w.status);
    if (phaseCounts[phase] !== undefined) {
      phaseCounts[phase]++;
    }
  });

  return `
    <section class="panel phase-cockpit">
      <h2 class="panel-title">Phase Pipeline</h2>
      <div class="phase-ribbon">
        ${phases.map((p, i) => `
          <div class="phase-node ${phaseCounts[p.id] > 0 ? 'active' : ''}"
               title="${p.name}: ${phaseCounts[p.id]} WO(s)">
            <span class="phase-icon">${p.icon}</span>
            <span class="phase-short">${p.short}</span>
            ${phaseCounts[p.id] > 0 ? `<span class="phase-count">${phaseCounts[p.id]}</span>` : ''}
          </div>
          ${i < phases.length - 1 ? '<span class="phase-connector">&#8594;</span>' : ''}
        `).join('')}
      </div>
    </section>
  `;
}

/**
 * Infer lifecycle phase from WO status (backward compatibility)
 */
function inferPhaseFromStatus(status) {
  const statusPhaseMap = {
    'draft': 'ideation',
    'pending-approval': 'requirements',
    'approved': 'design',
    'executing': 'execution',
    'executed': 'validation',
    'verified': 'finalisation',
    'deployed': 'production',
    'closed': 'reflection'
  };
  return statusPhaseMap[status] || 'ideation';
}

/**
 * Active Intent Ribbon - Shows currently active intents
 */
function renderActiveIntentRibbon(activeIntents) {
  return `
    <section class="panel intent-ribbon">
      <h2 class="panel-title">&#127919; Active Intents</h2>
      <div class="intent-ribbon-list">
        ${activeIntents.slice(0, 3).map(intent => `
          <div class="intent-ribbon-item" onclick="showIntentDetail('${intent.id}')">
            <span class="intent-ribbon-phase">${getIntentPhase(intent)}</span>
            <span class="intent-ribbon-title">${intent.title}</span>
            <span class="intent-ribbon-wos">${intent.woCount || 0} WOs</span>
          </div>
        `).join('')}
      </div>
      ${activeIntents.length > 3 ? `<p class="intent-ribbon-more">+${activeIntents.length - 3} more</p>` : ''}
    </section>
  `;
}

/**
 * Show intent detail (navigate to intent detail screen)
 */
function showIntentDetail(intentId) {
  state.selectedIntent = intentId;
  navigateTo('intent-detail');
}

/**
 * Ops Screen - Entity management, operational dashboards
 * Wraps existing Entities tab
 */
function renderOpsScreen() {
  return renderEntitiesTab();
}

/**
 * Config Screen - Governance, settings, constitutional layer
 * Wraps existing Governance tab
 */
function renderConfigScreen() {
  return renderGovernanceTab();
}

/**
 * Entity Portal - Deep view into specific entity (PORTAL-UX-HARDENING)
 * Shows entity-scoped work orders and relevant information
 */
function renderEntityPortal() {
  const entity = state.entities?.entities?.find(e => e.id === state.selectedEntity);
  if (!entity) {
    return `
      <section class="panel error-panel">
        <h2 class="panel-title">&#9888; Entity Not Found</h2>
        <p>The entity "${state.selectedEntity || 'unknown'}" could not be found.</p>
        <button class="btn-primary" onclick="navigateTo('ops')">&#8592; Back to Operations</button>
      </section>
    `;
  }

  // Get entity-scoped work orders
  const entityWOs = (state.workOrders?.workOrders || []).filter(wo =>
    wo.lane === entity.name || wo.entity === entity.id
  );
  const activeWOs = entityWOs.filter(wo => ['approved', 'executing'].includes(wo.status));
  const completedWOs = entityWOs.filter(wo => wo.status === 'executed');

  return `
    <section class="panel entity-header">
      <div class="panel-header-row">
        <button class="btn-back" onclick="navigateTo('ops')">&#8592; Back</button>
        <h2 class="panel-title-large">${entity.icon || '&#128736;'} ${entity.name}</h2>
      </div>
      <p class="panel-subtitle">${entity.description || 'Entity in Forante network'}</p>
    </section>

    <section class="panel entity-stats">
      <h3 class="panel-title">Entity Status</h3>
      <div class="status-cards">
        <div class="status-card ok">
          <span class="status-card-icon">&#128260;</span>
          <span class="status-card-label">Active WOs</span>
          <span class="status-card-value">${activeWOs.length}</span>
        </div>
        <div class="status-card ok">
          <span class="status-card-icon">&#10004;</span>
          <span class="status-card-label">Completed</span>
          <span class="status-card-value">${completedWOs.length}</span>
        </div>
      </div>
    </section>

    ${activeWOs.length > 0 ? `
    <section class="panel">
      <h3 class="panel-title">Active Work Orders</h3>
      <div class="wo-list compact">
        ${activeWOs.slice(0, 5).map(wo => `
          <div class="wo-item" onclick="showWoDetail('${wo.id}')">
            <span class="wo-status-badge ${wo.status}">${wo.status}</span>
            <span class="wo-title">${wo.title || wo.id}</span>
          </div>
        `).join('')}
      </div>
      ${activeWOs.length > 5 ? `<p class="see-more">+${activeWOs.length - 5} more</p>` : ''}
    </section>
    ` : `
    <section class="panel">
      <h3 class="panel-title">Work Orders</h3>
      <p class="empty-state">No active work orders for this entity</p>
    </section>
    `}

    <section class="panel">
      <h3 class="panel-title">Entity Details</h3>
      <dl class="detail-list">
        <dt>ID</dt><dd><code>${entity.id}</code></dd>
        <dt>Type</dt><dd>${entity.type || 'project'}</dd>
        <dt>Lane</dt><dd>${entity.name}</dd>
        <dt>Total WOs</dt><dd>${entityWOs.length}</dd>
      </dl>
    </section>

    <section class="panel">
      <h3 class="panel-title">Actions</h3>
      <div class="action-buttons">
        <button class="btn-primary" onclick="setEntityFilter('${entity.id}'); navigateTo('work-orders');">
          View All WOs
        </button>
        <button class="btn-secondary" onclick="navigateTo('ops')">
          Back to Operations
        </button>
      </div>
    </section>
  `;
}

// === WORLD SWITCHER (FCL v2 World Model) ===
// Note: Functions retain "Entity" names for backward compatibility with HTML onclick handlers

/**
 * Toggle the world picker dropdown
 */
function toggleEntityPicker() {
  const dropdown = document.getElementById('entity-picker-dropdown');
  const switcher = document.getElementById('entity-switcher');

  if (dropdown) {
    const isHidden = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');

    // Set aria-expanded for chevron animation
    if (switcher) {
      switcher.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    }

    if (!dropdown.classList.contains('hidden')) {
      renderEntityPickerList();
    }
  }
}

/**
 * Render the world picker list (FCL v2 World Model)
 * Shows Worlds with their Products nested
 */
function renderEntityPickerList() {
  const list = document.getElementById('entity-picker-list');
  if (!list) return;

  const worlds = state.worlds?.worlds || [];
  const products = state.worlds?.products || [];
  const currentWorld = state.currentWorld || 'forante';

  // If worlds.json not loaded, fall back to legacy entities
  if (worlds.length === 0) {
    renderLegacyEntityList(list);
    return;
  }

  // Build world list with products
  let html = '';

  // Root world first (Forante)
  const rootWorld = worlds.find(w => w.id === 'forante') || worlds.find(w => !w.parentWorld);
  if (rootWorld) {
    html += renderWorldItem(rootWorld, products, currentWorld, 0);
  }

  // Sub-worlds
  const subWorlds = worlds.filter(w => w.parentWorld === rootWorld?.id);
  for (const world of subWorlds) {
    html += renderWorldItem(world, products, currentWorld, 1);
  }

  list.innerHTML = html;
}

/**
 * Render a single world item with its products
 */
function renderWorldItem(world, products, currentWorld, depth) {
  const isActive = world.id === currentWorld;
  const worldProducts = products.filter(p => p.world === world.id);
  const indent = depth > 0 ? 'style="margin-left: 16px;"' : '';

  let html = `
    <button class="entity-picker-item world-item ${isActive ? 'active' : ''}"
            onclick="selectWorld('${world.id}')" ${indent}>
      <span class="entity-item-icon">${world.icon || '&#127760;'}</span>
      <div class="entity-item-info">
        <span class="entity-item-name">${world.name}</span>
        <span class="entity-item-type">World</span>
      </div>
      ${isActive ? '<span class="entity-item-check">&#10004;</span>' : ''}
    </button>
  `;

  // Show products under the world (collapsed style)
  if (worldProducts.length > 0 && isActive) {
    for (const product of worldProducts) {
      html += `
        <div class="product-item" style="margin-left: ${(depth + 1) * 16}px; padding: 8px 12px; opacity: 0.7;">
          <span class="product-icon">${product.icon || '&#128230;'}</span>
          <span class="product-name">${product.name}</span>
          <span class="product-badge">Product</span>
        </div>
      `;
    }
  }

  return html;
}

/**
 * Legacy entity list renderer (fallback if worlds.json not available)
 */
function renderLegacyEntityList(list) {
  const entities = state.entities?.entities || [];
  const currentEntity = state.currentEntity || 'forge';

  const allEntities = [
    { id: 'forante', name: 'Forante', icon: '&#127970;', type: 'world' },
    { id: 'myfi', name: 'MyFi', icon: '&#127918;', type: 'world' },
    ...entities.filter(e => e.id !== 'myfi').map(e => ({ ...e, icon: e.icon || '&#128736;' }))
  ];

  list.innerHTML = allEntities.map(e => `
    <button class="entity-picker-item ${e.id === currentEntity ? 'active' : ''}"
            onclick="selectEntity('${e.id}')">
      <span class="entity-item-icon">${e.icon}</span>
      <div class="entity-item-info">
        <span class="entity-item-name">${e.name}</span>
        <span class="entity-item-type">${e.type || 'world'}</span>
      </div>
      ${e.id === currentEntity ? '<span class="entity-item-check">&#10004;</span>' : ''}
    </button>
  `).join('');
}

/**
 * Select a world (FCL v2 World Model)
 */
function selectWorld(worldId) {
  const worlds = state.worlds?.worlds || [];
  const world = worlds.find(w => w.id === worldId);

  if (!world) {
    // Fall back to legacy entity selection
    selectEntity(worldId);
    return;
  }

  // Update world state
  state.currentWorld = worldId;
  // Sync legacy state for backward compatibility
  state.currentEntity = worldId;

  // Update filters based on world
  if (worldId === 'forante') {
    state.woLaneFilter = 'all';
    state.worldFilter = null;
    state.entityFilter = null;
  } else {
    // For sub-worlds, filter to that world's lane
    const lane = state.worlds?.products?.find(p => p.world === worldId)?.lane || world.name;
    state.woLaneFilter = lane;
    state.worldFilter = worldId;
    state.entityFilter = worldId;
  }

  // Update header display
  updateWorldHeader(world);

  // Close dropdown and refresh
  const dropdown = document.getElementById('entity-picker-dropdown');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    dropdown.classList.add('hidden');
  }
  render();
}

/**
 * Update header to show current world context
 */
function updateWorldHeader(world) {
  const iconEl = document.getElementById('current-entity-icon');
  const nameEl = document.getElementById('current-entity-name');

  if (iconEl) iconEl.innerHTML = world?.icon || '&#127970;';
  if (nameEl) nameEl.textContent = world?.name || 'Forante';
}

/**
 * Select an entity (legacy - for backward compatibility)
 */
function selectEntity(entityId) {
  // Map legacy entity IDs to worlds
  if (entityId === 'forge') {
    // Forge is a product, not a world - select Forante instead
    selectWorld('forante');
    return;
  }

  // Try to select as world first
  const worlds = state.worlds?.worlds || [];
  if (worlds.find(w => w.id === entityId)) {
    selectWorld(entityId);
    return;
  }

  // Legacy entity selection
  state.currentEntity = entityId;
  state.currentWorld = entityId === 'forante' ? 'forante' : entityId;

  const entities = state.entities?.entities || [];
  let entity;

  if (entityId === 'forante') {
    entity = { name: 'Forante', icon: '&#127970;' };
    state.woLaneFilter = 'all';
    state.entityFilter = null;
  } else {
    entity = entities.find(e => e.id === entityId) || { name: entityId, icon: '&#128736;' };
    state.woLaneFilter = entity.name || entityId;
    state.entityFilter = entityId;
  }

  const iconEl = document.getElementById('current-entity-icon');
  const nameEl = document.getElementById('current-entity-name');
  if (iconEl) iconEl.innerHTML = entity.icon;
  if (nameEl) nameEl.textContent = entity.name;

  const dropdown = document.getElementById('entity-picker-dropdown');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    dropdown.classList.add('hidden');
  }
  render();
}

/**
 * Update health dots based on system state
 */
function updateHealthDots() {
  const dots = document.querySelectorAll('.health-dot');
  if (dots.length < 3) return;

  const sp = state.sharePack;
  const wo = state.workOrders;
  const entities = state.entities?.entities || [];

  // Forante dot
  dots[0].className = `health-dot ${sp ? 'healthy' : 'unknown'}`;

  // Forge dot
  const hasAlerts = (state.reflexWarnings || []).some(w => w.violation?.severity === 'alert');
  dots[1].className = `health-dot ${hasAlerts ? 'warning' : (wo ? 'healthy' : 'unknown')}`;

  // Entities dot
  dots[2].className = `health-dot ${entities.length > 0 ? 'healthy' : 'unknown'}`;
}

// === HOME TAB ===

function renderHomeTab() {
  const sp = state.sharePack;
  const wo = state.workOrders;
  const entities = state.entities?.entities || [];

  return `
    <section class="panel welcome-panel">
      <div class="welcome-header">
        <h2 class="panel-title-large">&#127970; Forante OS Console</h2>
        ${renderEnvironmentBadge()}
      </div>
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
        <button class="nav-card" onclick="navigateTo('settings')">
          <span class="nav-card-icon">&#9881;</span>
          <span class="nav-card-title">Settings</span>
          <span class="nav-card-desc">${hasPAT() ? 'PAT configured' : 'Configure PAT'}</span>
        </button>
        <a href="${USER_GUIDE_URL}" class="nav-card" target="_blank">
          <span class="nav-card-icon">&#128214;</span>
          <span class="nav-card-title">User Guide</span>
          <span class="nav-card-desc">How to use Portal</span>
        </a>
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
        <button class="section-card" onclick="navigateTo('forge-intents')">
          <span class="section-icon">&#127919;</span>
          <div class="section-content">
            <span class="section-title">Director Intents</span>
            <span class="section-desc">FCL v2 lifecycle root</span>
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

    ${renderIntentPanel()}

    ${renderFSPPanel()}

    ${renderHeartbeatPanel()}

    ${renderSentinelPanel()}

    ${renderNavigatorPanel()}

    ${renderChroniclerPanel()}

    ${renderReflexPanel()}

    ${renderGenomePanel()}

    ${renderObservedPanel()}

    ${renderDeploymentStatusPanel()}

    <section class="panel forge-evolution">
      <h2 class="panel-title">&#128161; Evolution</h2>
      <p class="panel-subtitle-sm">Propose and track system evolution</p>
      <div class="evolution-actions">
        <button class="section-card" onclick="navigateTo('evolution-proposal')">
          <span class="section-icon">&#128221;</span>
          <div class="section-content">
            <span class="section-title">New Proposal</span>
            <span class="section-desc">Draft an evolution proposal</span>
          </div>
          <span class="section-arrow">&#8250;</span>
        </button>
      </div>
    </section>

    <section class="panel forge-actions">
      <h2 class="panel-title">Quick Actions</h2>
      <div class="action-grid-compact">
        ${state.flags.m4RepoAware ? `
        <button class="action-btn repo-exec-btn" onclick="openRepoExecutorModal()">
          <span class="action-icon">&#129302;</span>
          <span class="action-label">Run Repo-Aware Executor</span>
        </button>
        ` : ''}
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

    ${state.flags.m4RepoAware ? renderExecStatusPanel() : ''}
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
        <button class="doc-link" onclick="navigateTo('import-agent-output')">
          <span class="doc-icon">&#128229;</span>
          <div class="doc-content">
            <span class="doc-title">Import Agent Output</span>
            <span class="doc-desc">Paste execution results</span>
          </div>
          <span class="doc-arrow">&#8250;</span>
        </button>
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

      <div class="sharepack-actions">
        <button class="btn-primary" onclick="showRefreshSharePackModal()">
          <span class="action-icon">&#8635;</span> Refresh Share Pack
        </button>
      </div>

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

// === FCL v2: DIRECTOR INTENTS DASHBOARD ===

function renderForgeIntents() {
  const fsp = state.forgeStatePack;
  const intents = fsp?.intents || state.intents || [];
  const activeIntents = intents.filter(i => i.status === 'active');
  const completedIntents = intents.filter(i => i.status === 'completed');
  const abandonedIntents = intents.filter(i => i.status === 'abandoned');

  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">&#127919; Director Intents</h2>
        <span class="fcl-badge">FCL v2</span>
      </div>
      <div class="info-card">
        <span class="info-icon">&#128161;</span>
        <p>Intents are the root of all strategic work. Each Intent represents a Director idea that spawns Work Orders and tracks through the 9-phase lifecycle.</p>
      </div>
    </section>

    <section class="panel">
      <div class="intent-dashboard-stats">
        <div class="dash-stat">
          <span class="dash-stat-value">${activeIntents.length}</span>
          <span class="dash-stat-label">Active</span>
        </div>
        <div class="dash-stat">
          <span class="dash-stat-value">${completedIntents.length}</span>
          <span class="dash-stat-label">Completed</span>
        </div>
        <div class="dash-stat">
          <span class="dash-stat-value">${abandonedIntents.length}</span>
          <span class="dash-stat-label">Abandoned</span>
        </div>
      </div>
      <div class="intent-actions-bar">
        <button class="action-btn-sm primary" onclick="openCreateIntentModal()">
          + New Intent
        </button>
      </div>
    </section>

    ${activeIntents.length > 0 ? `
      <section class="panel">
        <h2 class="panel-title">Active Intents</h2>
        <div class="intent-full-list">
          ${activeIntents.map(intent => renderIntentCard(intent)).join('')}
        </div>
      </section>
    ` : ''}

    ${completedIntents.length > 0 ? `
      <section class="panel">
        <h2 class="panel-title">Recently Completed</h2>
        <div class="intent-full-list">
          ${completedIntents.slice(0, 5).map(intent => renderIntentCard(intent, true)).join('')}
        </div>
      </section>
    ` : ''}

    ${abandonedIntents.length > 0 ? `
      <section class="panel">
        <h2 class="panel-title">Abandoned</h2>
        <div class="intent-full-list collapsed">
          ${abandonedIntents.slice(0, 3).map(intent => renderIntentCard(intent, true)).join('')}
        </div>
      </section>
    ` : ''}

    ${intents.length === 0 ? `
      <section class="panel">
        <div class="intent-empty-dashboard">
          <span class="empty-icon">&#128173;</span>
          <h3>No Intents Yet</h3>
          <p>Director Intents are the strategic root of all work in FCL v2.</p>
          <p>Create your first Intent to begin tracking ideas through the full lifecycle.</p>
          <button class="action-btn primary" onclick="openCreateIntentModal()">
            Create First Intent
          </button>
        </div>
      </section>
    ` : ''}

    <section class="panel">
      <h2 class="panel-title">Lifecycle Phases</h2>
      <p class="panel-subtitle-sm">Every Intent progresses through these 9 phases</p>
      <div class="lifecycle-phase-grid">
        ${INTENT_PHASES.map(phase => `
          <div class="lifecycle-phase-item">
            <span class="phase-icon-lg">${phase.icon}</span>
            <span class="phase-name-sm">${phase.name}</span>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// Render a full intent card for dashboard
function renderIntentCard(intent, compact = false) {
  const calculatedPhase = getIntentPhase(intent);
  const phaseInfo = INTENT_PHASES.find(p => p.id === calculatedPhase) || INTENT_PHASES[0];
  return `
    <div class="intent-card-full ${compact ? 'compact' : ''}" data-intent-id="${intent.id}" onclick="viewIntent('${intent.id}')">
      <div class="intent-card-header">
        <span class="intent-title">${escapeHtml(intent.title || intent.id)}</span>
        <div class="intent-badges">
          <span class="intent-classification badge-${intent.classification || 'feature'}">${intent.classification || 'feature'}</span>
          <span class="intent-status-badge ${intent.status}">${intent.status}</span>
        </div>
      </div>
      <div class="intent-phase-section">
        <span class="phase-current">${phaseInfo.icon} ${phaseInfo.name}</span>
        <div class="phase-ribbon-full">
          ${renderPhaseRibbon(calculatedPhase)}
        </div>
      </div>
      <div class="intent-card-footer">
        <span class="intent-wo-count">${intent.woCount || 0} Work Orders</span>
        <span class="intent-date">${intent.createdAt ? formatRelativeTime(intent.createdAt) : ''}</span>
      </div>
    </div>
  `;
}

// Create Intent Screen
function renderCreateIntentScreen() {
  const form = state.intentFormData || {
    title: '',
    narrative: '',
    successSignals: [],
    classification: 'feature',
    riskFlags: []
  };

  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge-intents')">&#8592;</button>
        <h2 class="panel-title">&#127919; New Director Intent</h2>
      </div>
    </section>

    <section class="panel">
      <form class="intent-form" onsubmit="handleCreateIntent(event)">
        <div class="form-group">
          <label for="intent-title">Title <span class="required">*</span></label>
          <input
            type="text"
            id="intent-title"
            class="form-input"
            placeholder="Short descriptive title (max 80 chars)"
            maxlength="80"
            value="${escapeHtml(form.title)}"
            required
          />
        </div>

        <div class="form-group">
          <label for="intent-narrative">Narrative <span class="required">*</span></label>
          <textarea
            id="intent-narrative"
            class="form-textarea"
            rows="4"
            placeholder="1-3 paragraphs describing what you want to achieve and why"
            required
          >${escapeHtml(form.narrative)}</textarea>
        </div>

        <div class="form-group">
          <label for="intent-classification">Classification</label>
          <select id="intent-classification" class="form-select">
            <option value="feature" ${form.classification === 'feature' ? 'selected' : ''}>Feature — New functionality</option>
            <option value="refactor" ${form.classification === 'refactor' ? 'selected' : ''}>Refactor — Code restructuring</option>
            <option value="exploration" ${form.classification === 'exploration' ? 'selected' : ''}>Exploration — Research/investigation</option>
            <option value="governance" ${form.classification === 'governance' ? 'selected' : ''}>Governance — Process/policy change</option>
            <option value="evolution" ${form.classification === 'evolution' ? 'selected' : ''}>Evolution — Forge OS improvement</option>
          </select>
        </div>

        <div class="form-group">
          <label>Success Signals <span class="required">*</span></label>
          <p class="form-hint">What does success look like? Add at least one signal.</p>
          <div id="success-signals-list" class="signals-list">
            ${(form.successSignals || []).map((signal, idx) => `
              <div class="signal-item">
                <input type="text" class="form-input signal-input" value="${escapeHtml(signal)}" data-idx="${idx}" />
                <button type="button" class="signal-remove" onclick="removeSuccessSignal(${idx})">&#10005;</button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="action-btn-sm" onclick="addSuccessSignal()">+ Add Signal</button>
        </div>

        <div class="form-group">
          <label>Risk Flags (optional)</label>
          <p class="form-hint">Any known risks or concerns</p>
          <div id="risk-flags-list" class="signals-list">
            ${(form.riskFlags || []).map((risk, idx) => `
              <div class="signal-item">
                <input type="text" class="form-input signal-input" value="${escapeHtml(risk)}" data-idx="${idx}" />
                <button type="button" class="signal-remove" onclick="removeRiskFlag(${idx})">&#10005;</button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="action-btn-sm" onclick="addRiskFlag()">+ Add Risk</button>
        </div>

        <div class="form-actions">
          <button type="button" class="action-btn" onclick="navigateTo('forge-intents')">Cancel</button>
          <button type="submit" class="action-btn primary">Create Intent</button>
        </div>
      </form>
    </section>
  `;
}

// Intent Detail Screen
function renderIntentDetailScreen() {
  const intentId = state.selectedIntentId;
  const fsp = state.forgeStatePack;
  const intents = fsp?.intents || state.intents || [];
  const intent = intents.find(i => i.id === intentId);

  if (!intent) {
    return `
      <section class="panel">
        <div class="section-header">
          <button class="back-btn" onclick="navigateTo('forge-intents')">&#8592;</button>
          <h2 class="panel-title">Intent Not Found</h2>
        </div>
        <p>The requested intent could not be found.</p>
      </section>
    `;
  }

  const calculatedPhase = getIntentPhase(intent);
  const phaseInfo = INTENT_PHASES.find(p => p.id === calculatedPhase) || INTENT_PHASES[0];
  const currentPhaseIdx = INTENT_PHASES.findIndex(p => p.id === calculatedPhase);

  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge-intents')">&#8592;</button>
        <h2 class="panel-title">&#127919; Intent Detail</h2>
      </div>
    </section>

    <section class="panel intent-detail-panel">
      <div class="intent-detail-header">
        <h3 class="intent-detail-title">${escapeHtml(intent.title)}</h3>
        <div class="intent-detail-badges">
          <span class="intent-classification badge-${intent.classification}">${intent.classification}</span>
          <span class="intent-status-badge ${intent.status}">${intent.status}</span>
        </div>
      </div>

      <div class="intent-detail-id">
        <code>${intent.id}</code>
      </div>

      ${intent.narrative ? `
        <div class="intent-detail-section">
          <h4>Narrative</h4>
          <p class="intent-narrative-text">${escapeHtml(intent.narrative)}</p>
        </div>
      ` : ''}

      ${intent.successSignals?.length > 0 ? `
        <div class="intent-detail-section">
          <h4>Success Signals</h4>
          <ul class="success-signals-list">
            ${intent.successSignals.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${intent.riskFlags?.length > 0 ? `
        <div class="intent-detail-section">
          <h4>Risk Flags</h4>
          <ul class="risk-flags-list">
            ${intent.riskFlags.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </section>

    <section class="panel">
      <h2 class="panel-title">Phase Cockpit</h2>
      <div class="phase-cockpit">
        <div class="phase-current-display">
          <span class="phase-icon-xl">${phaseInfo.icon}</span>
          <div class="phase-current-info">
            <span class="phase-current-name">${phaseInfo.name}</span>
            <span class="phase-position">Phase ${currentPhaseIdx + 1} of ${INTENT_PHASES.length}</span>
          </div>
        </div>
        <div class="phase-ribbon-xl">
          ${INTENT_PHASES.map((phase, idx) => {
            let status = 'future';
            if (idx < currentPhaseIdx) status = 'completed';
            else if (idx === currentPhaseIdx) status = 'current';
            return `
              <div class="phase-step ${status}">
                <span class="step-icon">${phase.icon}</span>
                <span class="step-name">${phase.name}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Spawned Work Orders</h2>
      ${intent.spawnedWOs?.length > 0 ? `
        <div class="spawned-wo-list">
          ${intent.spawnedWOs.map(woId => `
            <div class="spawned-wo-item" onclick="viewWorkOrder('${woId}')">
              <span class="wo-id">${woId}</span>
              <span class="wo-arrow">&#8250;</span>
            </div>
          `).join('')}
        </div>
      ` : `
        <p class="empty-text">No Work Orders spawned yet</p>
      `}
      <div class="intent-wo-actions">
        <button class="action-btn-sm primary" onclick="spawnWOFromIntent('${intent.id}')">
          + Spawn Work Order
        </button>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Intent Timeline</h2>
      <div class="intent-timeline">
        <div class="timeline-item">
          <span class="timeline-icon">&#128197;</span>
          <span class="timeline-text">Created ${intent.createdAt ? formatRelativeTime(intent.createdAt) : 'unknown'}</span>
        </div>
        ${intent.metadata?.updatedAt ? `
          <div class="timeline-item">
            <span class="timeline-icon">&#128221;</span>
            <span class="timeline-text">Updated ${formatRelativeTime(intent.metadata.updatedAt)}</span>
          </div>
        ` : ''}
        ${intent.metadata?.completedAt ? `
          <div class="timeline-item">
            <span class="timeline-icon">&#9989;</span>
            <span class="timeline-text">Completed ${formatRelativeTime(intent.metadata.completedAt)}</span>
          </div>
        ` : ''}
        ${intent.metadata?.abandonedAt ? `
          <div class="timeline-item">
            <span class="timeline-icon">&#10060;</span>
            <span class="timeline-text">Abandoned ${formatRelativeTime(intent.metadata.abandonedAt)}: ${escapeHtml(intent.metadata.abandonReason || '')}</span>
          </div>
        ` : ''}
      </div>
    </section>

    ${intent.status === 'active' ? `
      <section class="panel">
        <h2 class="panel-title">Actions</h2>
        <div class="intent-action-buttons">
          <button class="action-btn" onclick="advanceIntentPhase('${intent.id}')">
            Advance Phase
          </button>
          <button class="action-btn success" onclick="completeIntent('${intent.id}')">
            Mark Complete
          </button>
          <button class="action-btn danger" onclick="abandonIntent('${intent.id}')">
            Abandon
          </button>
        </div>
      </section>
    ` : ''}
  `;
}

// Intent form helpers
function addSuccessSignal() {
  state.intentFormData = state.intentFormData || { successSignals: [] };
  state.intentFormData.successSignals = state.intentFormData.successSignals || [];
  state.intentFormData.successSignals.push('');
  render();
}

function removeSuccessSignal(idx) {
  if (state.intentFormData?.successSignals) {
    state.intentFormData.successSignals.splice(idx, 1);
    render();
  }
}

function addRiskFlag() {
  state.intentFormData = state.intentFormData || { riskFlags: [] };
  state.intentFormData.riskFlags = state.intentFormData.riskFlags || [];
  state.intentFormData.riskFlags.push('');
  render();
}

function removeRiskFlag(idx) {
  if (state.intentFormData?.riskFlags) {
    state.intentFormData.riskFlags.splice(idx, 1);
    render();
  }
}

// Create new Intent
function handleCreateIntent(event) {
  event.preventDefault();

  const title = document.getElementById('intent-title').value.trim();
  const narrative = document.getElementById('intent-narrative').value.trim();
  const classification = document.getElementById('intent-classification').value;

  // Gather success signals from inputs
  const signalInputs = document.querySelectorAll('#success-signals-list .signal-input');
  const successSignals = Array.from(signalInputs).map(i => i.value.trim()).filter(s => s);

  // Gather risk flags from inputs
  const riskInputs = document.querySelectorAll('#risk-flags-list .signal-input');
  const riskFlags = Array.from(riskInputs).map(i => i.value.trim()).filter(r => r);

  if (!title || !narrative) {
    showToast('Title and narrative are required', 'error');
    return;
  }

  if (successSignals.length === 0) {
    showToast('At least one success signal is required', 'error');
    return;
  }

  // Generate Intent ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  const intentId = `DI-${timestamp}-${random}`;

  const newIntent = {
    intentType: 'DirectorIntent',
    schemaVersion: '1.0.0',
    id: intentId,
    createdAt: new Date().toISOString(),
    createdBy: 'director',
    title,
    narrative,
    successSignals,
    riskFlags,
    classification,
    status: 'active',
    phase: 'ideation',
    spawnedWOs: [],
    metadata: {
      updatedAt: new Date().toISOString(),
      completedAt: null,
      abandonedAt: null,
      abandonReason: null
    }
  };

  // Add to state
  state.intents = state.intents || [];
  state.intents.push(newIntent);

  // Record in Chronicler
  recordIntentCreated(newIntent);

  // Queue for export (in v1, intents are stored in state/localStorage)
  saveIntentsToStorage();

  showToast(`Intent ${intentId} created`, 'success');
  navigateTo('forge-intents');
}

// Save intents to localStorage (FCL v2 persistence)
function saveIntentsToStorage() {
  try {
    localStorage.setItem(INTENTS_STORAGE_KEY, JSON.stringify(state.intents || []));
    // Also queue for file flush
    queueIntentsForFlush();
  } catch (e) {
    console.error('[Portal] Failed to save intents:', e);
  }
}

// Queue intents for flush to file (matches Chronicler pattern)
function queueIntentsForFlush() {
  try {
    const queueData = {
      queuedAt: new Date().toISOString(),
      intents: state.intents || [],
      counts: {
        total: state.intents?.length || 0,
        active: state.intents?.filter(i => i.status === 'active').length || 0,
        completed: state.intents?.filter(i => i.status === 'completed').length || 0,
        abandoned: state.intents?.filter(i => i.status === 'abandoned').length || 0
      }
    };
    localStorage.setItem(INTENTS_QUEUE_KEY, JSON.stringify(queueData));
  } catch (e) {
    console.error('[Portal] Failed to queue intents:', e);
  }
}

// Load intents from localStorage
function loadIntentsFromLocalStorage() {
  try {
    const stored = localStorage.getItem(INTENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('[Portal] Failed to load intents from localStorage:', e);
    return [];
  }
}

// Load intents from file (intents.json)
async function loadIntentsFromFile() {
  try {
    const res = await fetch(INTENTS_URL);
    if (!res.ok) {
      if (res.status === 404) {
        console.log('[Portal] intents.json not found, using localStorage only');
        return [];
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.intents || [];
  } catch (e) {
    console.warn('[Portal] Failed to load intents from file:', e);
    return [];
  }
}

// Merge file intents with localStorage intents (localStorage wins for conflicts)
function mergeIntents(fileIntents, localIntents) {
  const merged = new Map();

  // Add file intents first
  for (const intent of fileIntents) {
    merged.set(intent.id, intent);
  }

  // Override with localStorage intents (more recent)
  for (const intent of localIntents) {
    const existing = merged.get(intent.id);
    if (!existing || new Date(intent.metadata?.updatedAt) > new Date(existing.metadata?.updatedAt)) {
      merged.set(intent.id, intent);
    }
  }

  return Array.from(merged.values());
}

// Load intents from both file and localStorage, merge
async function loadIntents() {
  const [fileIntents, localIntents] = await Promise.all([
    loadIntentsFromFile(),
    Promise.resolve(loadIntentsFromLocalStorage())
  ]);

  state.intents = mergeIntents(fileIntents, localIntents);

  // Save merged back to localStorage
  if (state.intents.length > 0) {
    try {
      localStorage.setItem(INTENTS_STORAGE_KEY, JSON.stringify(state.intents));
    } catch (e) {
      console.warn('[Portal] Failed to save merged intents:', e);
    }
  }

  return state.intents;
}

// Legacy function name for backward compatibility
function loadIntentsFromStorage() {
  const localIntents = loadIntentsFromLocalStorage();
  state.intents = localIntents;
}

// Advance intent to next phase
function advanceIntentPhase(intentId) {
  const intent = state.intents?.find(i => i.id === intentId);
  if (!intent) return;

  const currentIdx = INTENT_PHASES.findIndex(p => p.id === intent.phase);
  if (currentIdx >= INTENT_PHASES.length - 1) {
    showToast('Intent is already at final phase', 'warning');
    return;
  }

  const oldPhase = intent.phase;
  intent.phase = INTENT_PHASES[currentIdx + 1].id;
  intent.metadata.updatedAt = new Date().toISOString();

  recordIntentPhaseChange(intent, oldPhase, intent.phase);
  saveIntentsToStorage();

  // Trigger dramatic phase advance animation
  render();
  requestAnimationFrame(() => {
    const phaseElements = document.querySelectorAll('.phase-dot.current, .phase-step.current');
    phaseElements.forEach(el => {
      el.classList.add('phase-unlocking');
      setTimeout(() => el.classList.remove('phase-unlocking'), 600);
    });

    // Flash the phase cockpit panel
    const cockpit = document.querySelector('.phase-cockpit');
    if (cockpit) {
      cockpit.classList.add('panel-active');
      setTimeout(() => cockpit.classList.remove('panel-active'), 3000);
    }
  });

  showToast(`Intent advanced to ${INTENT_PHASES[currentIdx + 1].name}`, 'success');
}

// Complete intent
function completeIntent(intentId) {
  const intent = state.intents?.find(i => i.id === intentId);
  if (!intent) return;

  // Trigger completion animation before state change
  const intentCard = document.querySelector(`[data-intent-id="${intentId}"]`);
  if (intentCard) {
    intentCard.classList.add('phase-completing');
  }

  intent.status = 'completed';
  intent.metadata.completedAt = new Date().toISOString();
  intent.metadata.updatedAt = new Date().toISOString();

  recordIntentCompleted(intent);
  saveIntentsToStorage();
  showToast('Intent marked complete', 'success');
  render();
}

// Abandon intent
function abandonIntent(intentId) {
  const reason = prompt('Please provide a reason for abandoning this intent:');
  if (!reason) return;

  const intent = state.intents?.find(i => i.id === intentId);
  if (!intent) return;

  intent.status = 'abandoned';
  intent.metadata.abandonedAt = new Date().toISOString();
  intent.metadata.abandonReason = reason;
  intent.metadata.updatedAt = new Date().toISOString();

  recordIntentAbandoned(intent, reason);
  saveIntentsToStorage();
  showToast('Intent abandoned', 'warning');
  render();
}

// Spawn WO from Intent (FCL v2)
function spawnWOFromIntent(intentId) {
  const intent = state.intents?.find(i => i.id === intentId);
  if (!intent) {
    showToast('Intent not found', 'error');
    return;
  }

  // Check if Intent is in a phase that allows WO spawning
  const spawnablePhases = ['ideation', 'requirements', 'dissonance', 'design', 'execution'];
  if (!spawnablePhases.includes(intent.phase)) {
    showToast(`Cannot spawn WO: Intent is in ${intent.phase} phase`, 'warning');
    return;
  }

  state.newWoIntentId = intentId;
  navigateTo('create-wo');
}

// Link an existing WO to an Intent (FCL v2)
function linkWOToIntent(intentId, woId) {
  const intent = state.intents?.find(i => i.id === intentId);
  if (!intent) {
    showToast('Intent not found', 'error');
    return false;
  }

  // Initialize spawnedWOs if needed
  if (!intent.spawnedWOs) {
    intent.spawnedWOs = [];
  }

  // Check if already linked
  if (intent.spawnedWOs.includes(woId)) {
    showToast('WO already linked to this Intent', 'info');
    return false;
  }

  // Add WO to Intent
  intent.spawnedWOs.push(woId);
  intent.metadata.updatedAt = new Date().toISOString();

  // Record in Chronicler (use existing function)
  recordIntentWOSpawned(intent, woId, woId);

  // Save
  saveIntentsToStorage();

  showToast(`Linked ${woId} to Intent`, 'success');
  return true;
}

// View specific work order
function viewWorkOrder(woId) {
  state.selectedWo = woId;
  navigateTo('work-orders');
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
            <div class="wo-card" onclick="showWoDetail('${wo.id}')">
              <div class="wo-card-header">
                ${renderLaneChip(lane)}
                ${renderStatusChip(wo.status)}
                <span class="wo-date">${formatRelativeTime(wo.lastUpdated)}</span>
              </div>
              <p class="wo-card-title">${wo.title}</p>
              <div class="wo-card-actions">
                <button class="wo-btn" onclick="event.stopPropagation(); showWoDetail('${wo.id}')">Details</button>
                <button class="wo-btn secondary" onclick="event.stopPropagation(); copyAgentPack('${wo.id}')">Copy Pack</button>
                ${wo.status === 'approved' ? `<button class="wo-btn primary" onclick="event.stopPropagation(); handleExecuteWo('${wo.id}')">Execute</button>` : ''}
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
  // M3a: Extended WO creation form matching GitHub issue template
  // FCL v2: Show Intent context if spawning from Intent
  const intentId = state.newWoIntentId;
  const intent = intentId ? state.intents?.find(i => i.id === intentId) : null;

  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('${intentId ? 'intent-detail' : 'lifecycle'}')">&#8592;</button>
        <h2 class="panel-title">Create Work Order</h2>
      </div>
      <p class="panel-subtitle-sm">Draft a Work Order for Director approval</p>
      ${intent ? `
        <div class="intent-context-banner">
          <span class="intent-badge">&#127919; Spawning from Intent</span>
          <span class="intent-title">${intent.title}</span>
          <input type="hidden" id="wo-intent-id" value="${intentId}">
        </div>
      ` : ''}
    </section>

    <section class="panel">
      <form id="create-wo-form" class="wo-form">
        <div class="form-group">
          <label for="wo-task-id">Task ID <span class="required">*</span></label>
          <input type="text" id="wo-task-id" placeholder="FO-MyFi-I3-Feature" required>
          <span class="form-hint">Format: FO-[Entity]-[Type][Num]-[Name]</span>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label for="wo-task-type">Task Type <span class="required">*</span></label>
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
          <div class="form-group half">
            <label for="wo-exec-mode">Execution Mode <span class="required">*</span></label>
            <select id="wo-exec-mode" required>
              <option value="code">Code</option>
              <option value="docs-only">Docs Only</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="wo-intent">Intent Statement <span class="required">*</span></label>
          <textarea id="wo-intent" placeholder="Single sentence: WHY this task exists" rows="2" required></textarea>
        </div>

        <div class="form-group">
          <label for="wo-scope">Scope of Work <span class="required">*</span></label>
          <textarea id="wo-scope" placeholder="- Create X&#10;- Modify Y&#10;- Update Z" rows="4" required></textarea>
        </div>

        <div class="form-group">
          <label for="wo-allowed">Allowed Files / Artifacts <span class="required">*</span></label>
          <textarea id="wo-allowed" placeholder="CREATE/MODIFY:&#10;- path/to/file.js&#10;- path/to/spec.md" rows="4" required></textarea>
          <span class="form-hint">Explicit list of files that may be read or modified</span>
        </div>

        <div class="form-group">
          <label for="wo-forbidden">Forbidden Changes <span class="required">*</span></label>
          <textarea id="wo-forbidden" placeholder="- No new components&#10;- No API changes" rows="3" required></textarea>
          <span class="form-hint">Things explicitly out of scope</span>
        </div>

        <div class="form-group">
          <label for="wo-success">Success Criteria <span class="required">*</span></label>
          <textarea id="wo-success" placeholder="- Spec and UI match&#10;- Tests pass&#10;- No scope creep" rows="4" required></textarea>
          <span class="form-hint">Observable conditions for completion</span>
        </div>

        <div class="form-group">
          <label for="wo-dependencies">Dependencies</label>
          <textarea id="wo-dependencies" placeholder="- Requires I1 complete&#10;- References PRODUCT_STATE.md" rows="2"></textarea>
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" id="wo-sharepack">
            <span>Share Pack refresh required after completion</span>
          </label>
        </div>

        <div class="form-group">
          <label for="wo-notes">Additional Notes</label>
          <textarea id="wo-notes" placeholder="Optional additional context..." rows="2"></textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">Open in GitHub</button>
          <button type="button" class="btn-secondary" onclick="copyWoMarkdown()">Copy Markdown</button>
        </div>
        <p class="form-hint center">Draft only — no direct GitHub writes from portal</p>
      </form>
    </section>
  `;
}

// === M3e: Import Agent Output Screen ===

function renderImportAgentOutputScreen() {
  const wos = state.workOrders?.workOrders || [];
  const executedWos = wos.filter(wo => ['executed', 'approved', 'executing', 'ready-for-executor'].includes(wo.status));
  const preselectedWo = state.importPreselectedWo || '';

  // Clear preselection after use
  if (state.importPreselectedWo) {
    state.importPreselectedWo = null;
  }

  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Import Agent Output</h2>
      </div>
      <p class="panel-subtitle-sm">Paste agent execution results to attach to a Work Order</p>
    </section>

    <section class="panel">
      <form id="import-agent-form" class="wo-form">
        <div class="form-group">
          <label for="import-wo-select">Work Order <span class="required">*</span></label>
          <select id="import-wo-select" required>
            <option value="">Select Work Order...</option>
            ${executedWos.map(wo => `
              <option value="${wo.id}" ${wo.id === preselectedWo ? 'selected' : ''}>${wo.id} — ${wo.title}</option>
            `).join('')}
          </select>
          <span class="form-hint">Select the WO this output belongs to</span>
        </div>

        <div class="form-group">
          <label for="import-agent-type">Agent Type <span class="required">*</span></label>
          <select id="import-agent-type" required>
            <option value="">Select agent type...</option>
            <option value="repo-aware">Repo-aware Executor</option>
            <option value="non-repo-aware">Non-repo-aware Executor</option>
            <option value="verifier">Verifier-Tester</option>
            <option value="architect">Architect</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="import-parse-mode">Parse Mode</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="parse-mode" value="minimal" checked>
              <span>Minimal (store raw)</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="parse-mode" value="structured">
              <span>Structured (extract sections)</span>
            </label>
          </div>
          <span class="form-hint">Structured mode attempts to extract Summary, Files Changed, Risks, etc.</span>
        </div>

        <div class="form-group">
          <label for="import-output">Agent Output <span class="required">*</span></label>
          <textarea id="import-output" placeholder="Paste the agent's output here..." rows="10" required></textarea>
        </div>

        <div class="form-group">
          <label for="import-attachments">Attachment URLs (optional)</label>
          <textarea id="import-attachments" placeholder="One URL per line (PR links, screenshots, etc.)" rows="3"></textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">Save Locally</button>
          <button type="button" class="btn-secondary" onclick="handleImportAndPostToGitHub()">
            Save & Post to GitHub
          </button>
          <button type="button" class="btn-secondary" onclick="copyImportForGitHub()">
            Copy for GitHub
          </button>
        </div>
        <p class="form-hint center">Outputs are stored locally first. Post to GitHub requires PAT + linked Issue.</p>
      </form>
    </section>

    <section class="panel">
      <h3 class="panel-title">Recently Imported</h3>
      <div id="recent-imports-list">
        ${renderRecentImports()}
      </div>
    </section>
  `;
}

function renderRecentImports() {
  const allOutputs = state.agentOutputs || {};
  const recent = [];

  // Flatten and sort by timestamp
  for (const woId of Object.keys(allOutputs)) {
    for (const entry of allOutputs[woId]) {
      recent.push({ woId, ...entry });
    }
  }

  recent.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  const display = recent.slice(0, 5);

  if (display.length === 0) {
    return '<p class="empty-text">No imported outputs yet</p>';
  }

  return display.map(entry => `
    <div class="recent-import-item">
      <div class="import-header">
        <span class="import-wo">${entry.woId}</span>
        <span class="import-agent">${entry.agentType}</span>
      </div>
      <div class="import-meta">
        <span class="import-time">${formatRelativeTime(entry.savedAt)}</span>
        <span class="import-mode">${entry.output.parseMode}</span>
      </div>
      <div class="import-preview">${entry.output.raw.substring(0, 100)}${entry.output.raw.length > 100 ? '...' : ''}</div>
    </div>
  `).join('');
}

function bindImportAgentForm() {
  const form = document.getElementById('import-agent-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleImportAgentOutput(false);
  });
}

function handleImportAgentOutput(postToGitHub = false) {
  const woId = document.getElementById('import-wo-select')?.value;
  const agentType = document.getElementById('import-agent-type')?.value;
  const rawOutput = document.getElementById('import-output')?.value;
  const attachmentsRaw = document.getElementById('import-attachments')?.value || '';
  const parseMode = document.querySelector('input[name="parse-mode"]:checked')?.value || 'minimal';

  if (!woId || !agentType || !rawOutput) {
    showToast('Please fill all required fields', 'error');
    return null;
  }

  const attachments = attachmentsRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  const output = parseAgentOutput(rawOutput, parseMode);
  const entry = saveAgentOutput(woId, agentType, output, attachments);

  showToast('Output saved locally!', 'success');

  // Clear form
  document.getElementById('import-output').value = '';
  document.getElementById('import-attachments').value = '';

  // Re-render recent imports
  const recentList = document.getElementById('recent-imports-list');
  if (recentList) {
    recentList.innerHTML = renderRecentImports();
  }

  return entry;
}

async function handleImportAndPostToGitHub() {
  const entry = handleImportAgentOutput(true);
  if (!entry) return;

  const woId = document.getElementById('import-wo-select')?.value;
  await submitAgentOutputToGitHub(woId, entry);
}

function copyImportForGitHub() {
  const woId = document.getElementById('import-wo-select')?.value;
  const agentType = document.getElementById('import-agent-type')?.value;
  const rawOutput = document.getElementById('import-output')?.value;
  const attachmentsRaw = document.getElementById('import-attachments')?.value || '';
  const parseMode = document.querySelector('input[name="parse-mode"]:checked')?.value || 'minimal';

  if (!woId || !agentType || !rawOutput) {
    showToast('Please fill required fields first', 'error');
    return;
  }

  const attachments = attachmentsRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  const output = parseAgentOutput(rawOutput, parseMode);
  const entry = {
    woId,
    agentType,
    output,
    attachments,
    savedAt: new Date().toISOString()
  };

  const comment = formatAgentOutputForGitHub(entry);
  copyToClipboard(comment);
  showToast('Formatted comment copied! Paste in GitHub Issue.', 'success');
}

// === M3b: Settings Screen ===

function renderSettingsScreen() {
  const hasToken = hasPAT();
  const hasConsent = hasPatConsent();

  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('command')">&#8592;</button>
        <h2 class="panel-title">Settings</h2>
      </div>
    </section>

    <section class="panel">
      <h3 class="panel-title">GitHub Integration</h3>
      <div class="info-card warning">
        <span class="info-icon">&#9888;</span>
        <div class="info-content">
          <p><strong>Security Notice</strong></p>
          <p>Personal Access Token (PAT) is stored in your browser's localStorage.</p>
          <ul>
            <li>Token is only sent to GitHub API</li>
            <li>Never shared with any other server</li>
            <li>You are responsible for token security</li>
            <li>Use a fine-grained PAT with minimal permissions</li>
          </ul>
        </div>
      </div>

      ${hasToken ? `
        <div class="settings-status success">
          <span class="status-icon">&#9989;</span>
          <span>GitHub PAT configured</span>
        </div>
        <div class="settings-actions">
          <button class="btn-danger" onclick="handleClearPAT()">
            Forget Token
          </button>
          <button class="btn-secondary" onclick="showPATModal()">
            Update Token
          </button>
        </div>
      ` : `
        <div class="settings-status warning">
          <span class="status-icon">&#128274;</span>
          <span>No GitHub PAT configured</span>
        </div>
        <p class="settings-hint">
          Without a PAT, approval actions will copy commands for manual GitHub use.
        </p>
        <div class="settings-actions">
          <button class="btn-primary" onclick="showPATModal()">
            Configure PAT
          </button>
        </div>
      `}
    </section>

    <section class="panel">
      <h3 class="panel-title">Required PAT Permissions</h3>
      <div class="permissions-list">
        <div class="permission-item">
          <span class="permission-scope">repo</span>
          <span class="permission-desc">Full repository access (classic PAT)</span>
        </div>
        <p class="form-hint">Or for fine-grained PAT:</p>
        <div class="permission-item">
          <span class="permission-scope">issues:write</span>
          <span class="permission-desc">Manage issues and labels</span>
        </div>
      </div>
      <p class="form-hint">
        <a href="https://github.com/settings/tokens?type=beta" target="_blank">
          Create fine-grained PAT on GitHub &#8599;
        </a>
      </p>
    </section>

    <section class="panel">
      <h3 class="panel-title">Capabilities</h3>
      <table class="capabilities-table">
        <tr>
          <th>Feature</th>
          <th>Without PAT</th>
          <th>With PAT</th>
        </tr>
        <tr>
          <td>View Work Orders</td>
          <td>&#9989;</td>
          <td>&#9989;</td>
        </tr>
        <tr>
          <td>Copy Agent Packs</td>
          <td>&#9989;</td>
          <td>&#9989;</td>
        </tr>
        <tr>
          <td>Create WO (GitHub)</td>
          <td>&#9989;</td>
          <td>&#9989;</td>
        </tr>
        <tr>
          <td>Approve/Reject WO</td>
          <td>Copy command</td>
          <td>&#9989; Direct</td>
        </tr>
      </table>
    </section>

    <section class="panel">
      <h3 class="panel-title">Feature Flags</h3>
      <div class="feature-flag-item">
        <div class="flag-header">
          <span class="flag-name">M4: Repo-Aware Executor</span>
          <span class="flag-badge ${state.flags.m4RepoAware ? 'flag-enabled' : 'flag-disabled'}">
            ${state.flags.m4RepoAware ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
        <p class="flag-desc">Enables repo-aware executor dispatch, execution status panel, and AI handoff features.</p>
      </div>
    </section>
  `;
}

function showPATModal() {
  const existing = document.getElementById('pat-modal');
  if (existing) existing.remove();

  const hasConsent = hasPatConsent();

  const modal = document.createElement('div');
  modal.id = 'pat-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content pat-modal">
      <div class="modal-header">
        <h2>Configure GitHub PAT</h2>
        <button class="modal-close" onclick="closePATModal()">&times;</button>
      </div>
      <div class="modal-body">
        ${!hasConsent ? `
          <div class="consent-section">
            <h3>Security Acknowledgment</h3>
            <p>Before storing a PAT, please acknowledge:</p>
            <ul>
              <li>Token is stored in browser localStorage (unencrypted)</li>
              <li>Anyone with access to this browser can use the token</li>
              <li>Only use on trusted devices</li>
              <li>You can remove the token anytime via Settings</li>
            </ul>
            <label class="checkbox-label consent-checkbox">
              <input type="checkbox" id="pat-consent-checkbox">
              <span>I understand and accept these risks</span>
            </label>
          </div>
        ` : ''}
        <div class="form-group">
          <label for="pat-input">Personal Access Token</label>
          <input type="password" id="pat-input" placeholder="ghp_xxxxxxxxxxxx" autocomplete="off">
          <span class="form-hint">Paste your GitHub PAT here</span>
        </div>
        <div class="form-actions">
          <button class="btn-primary" onclick="savePATFromModal()" id="save-pat-btn" ${!hasConsent ? 'disabled' : ''}>
            Save Token
          </button>
          <button class="btn-secondary" onclick="closePATModal()">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add consent checkbox handler
  if (!hasConsent) {
    const checkbox = document.getElementById('pat-consent-checkbox');
    const saveBtn = document.getElementById('save-pat-btn');
    checkbox?.addEventListener('change', (e) => {
      saveBtn.disabled = !e.target.checked;
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePATModal();
  });
}

function closePATModal() {
  const modal = document.getElementById('pat-modal');
  if (modal) modal.remove();
}

function savePATFromModal() {
  const input = document.getElementById('pat-input');
  const token = input?.value?.trim();

  if (!token) {
    showToast('Please enter a token', 'error');
    return;
  }

  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    showToast('Invalid token format. Expected ghp_... or github_pat_...', 'error');
    return;
  }

  // Set consent if not already set
  if (!hasPatConsent()) {
    const checkbox = document.getElementById('pat-consent-checkbox');
    if (!checkbox?.checked) {
      showToast('Please acknowledge the security notice', 'error');
      return;
    }
    setPatConsent();
  }

  if (storePAT(token)) {
    showToast('PAT saved successfully', 'success');
    closePATModal();
    render(); // Re-render settings page
  } else {
    showToast('Failed to save PAT', 'error');
  }
}

function handleClearPAT() {
  if (clearPAT()) {
    showToast('PAT removed', 'success');
    render();
  } else {
    showToast('Failed to remove PAT', 'error');
  }
}

// === Main Render ===

function renderScreen() {
  switch (state.currentScreen) {
    // Command Centre primary screens
    case 'command':
    case 'home':
      return renderCommandScreen();
    case 'lifecycle':
    case 'forge':
      return renderLifecycleScreen();
    case 'ops':
    case 'entities':
      return renderOpsScreen();
    case 'config':
    case 'governance':
      return renderConfigScreen();

    // Lifecycle sub-screens
    case 'forge-governance':
      return renderForgeGovernance();
    case 'forge-agents':
      return renderForgeAgents();
    case 'forge-sharepacks':
      return renderForgeSharePacks();
    case 'forge-registry':
      return renderForgeRegistry();
    case 'forge-intents':
      return renderForgeIntents();
    case 'create-intent':
      return renderCreateIntentScreen();
    case 'intent-detail':
      return renderIntentDetailScreen();
    case 'work-orders':
      return renderWorkOrdersScreen();
    case 'create-wo':
      return renderCreateWoScreen();
    case 'import-agent-output':
      return renderImportAgentOutputScreen();
    case 'evolution-proposal':
      return renderEvolutionProposalScreen();
    case 'deploy-status':
      return renderDeploymentStatusScreen();

    // Ops sub-screens
    case 'entity-portal':
      return renderEntityPortal();

    // Config sub-screens
    case 'settings':
      return renderSettingsScreen();

    default:
      return renderCommandScreen();
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
  updateHealthDots();  // WO-PORTAL-UX-001: Update Command Centre health indicators

  // Bind form handlers
  if (state.currentScreen === 'create-wo') {
    bindCreateWoForm();
  }
  if (state.currentScreen === 'import-agent-output') {
    bindImportAgentForm();
  }
  if (state.currentScreen === 'evolution-proposal') {
    bindEvolutionProposalForm();
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

// Command Centre functions (WO-PORTAL-UX-001)
window.toggleEntityPicker = toggleEntityPicker;
window.selectEntity = selectEntity;
window.updateHealthDots = updateHealthDots;
window.showIntentDetail = showIntentDetail;

// FCL v2 World Model functions (WO-PORTAL-WORLD-001)
window.selectWorld = selectWorld;
window.enterWorld = enterWorld;
window.getCurrentWorld = getCurrentWorld;
window.canTravelToWorld = canTravelToWorld;

// FCL v2 Intent functions (PORTAL-UX-HARDENING)
window.viewIntent = viewIntent;
window.openCreateIntentModal = openCreateIntentModal;
window.handleCreateIntent = handleCreateIntent;
window.spawnWOFromIntent = spawnWOFromIntent;
window.linkWOToIntent = linkWOToIntent;
window.viewWorkOrder = viewWorkOrder;
window.calculateIntentPhase = calculateIntentPhase;
window.updateIntentPhaseFromWOs = updateIntentPhaseFromWOs;
window.getIntentPhase = getIntentPhase;
window.advanceIntentPhase = advanceIntentPhase;
window.completeIntent = completeIntent;
window.abandonIntent = abandonIntent;

// Intent form helpers (PORTAL-UX-HARDENING)
window.addSuccessSignal = addSuccessSignal;
window.removeSuccessSignal = removeSuccessSignal;
window.addRiskFlag = addRiskFlag;
window.removeRiskFlag = removeRiskFlag;

// FCL Cognition functions (PORTAL-UX-HARDENING)
window.runHeartbeat = runHeartbeat;
window.clearHeartbeat = clearHeartbeat;
window.runNavigator = runNavigator;
window.promptAddNote = promptAddNote;
window.showQueueExport = showQueueExport;
window.copyRepairDraft = copyRepairDraft;
window.copyGraduationDraft = copyGraduationDraft;

window.setWoFilter = setWoFilter;
window.setWoLaneFilter = setWoLaneFilter;
window.setEntityFilter = setEntityFilter;
window.clearEntityFilter = clearEntityFilter;
window.openEntityPortal = openEntityPortal;
window.loadData = loadData;
window.handleDeploy = handleDeploy;
window.showWoDetail = showWoDetail;
window.closeWoDetail = closeWoDetail;
window.copyAgentPack = copyAgentPack;
window.setE2EPhase = setE2EPhase;
window.copyPhaseAgentPack = copyPhaseAgentPack;

// M3d: Agent pack modal functions
window.showAgentPackModal = showAgentPackModal;
window.closeAgentPackModal = closeAgentPackModal;
window.copyAgentPackWithMode = copyAgentPackWithMode;

window.handleExecuteWo = function(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (wo) handleExecute(wo);
};

// M3b: PAT management and Director approval functions
window.showPATModal = showPATModal;
window.closePATModal = closePATModal;
window.savePATFromModal = savePATFromModal;
window.handleClearPAT = handleClearPAT;

window.handleApproveWo = async function(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (!wo) return;

  // PORTAL-UX-HARDENING: Explicit confirmation dialog
  const confirmed = confirm(
    `Approve Work Order?\n\n` +
    `ID: ${wo.id}\n` +
    `Title: ${wo.title}\n\n` +
    `This will:\n` +
    `• Add 'approved' label to GitHub Issue #${wo.issueNumber || 'N/A'}\n` +
    `• Remove 'pending-approval' label\n` +
    `• Post approval comment\n\n` +
    `Continue?`
  );

  if (!confirmed) {
    showToast('Approval cancelled', 'info');
    return;
  }

  const success = await approveWorkOrder(wo);
  if (success) {
    closeWoDetail();
    loadData();
  }
};

window.handleRejectWo = async function(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (!wo) return;

  // PORTAL-UX-HARDENING: Rejection reason prompt with confirmation
  const reason = prompt(
    `Reject Work Order?\n\n` +
    `ID: ${wo.id}\n` +
    `Title: ${wo.title}\n\n` +
    `Enter rejection reason (optional):`
  );

  // User cancelled the prompt
  if (reason === null) {
    showToast('Rejection cancelled', 'info');
    return;
  }

  const success = await rejectWorkOrder(wo, reason || '');
  if (success) {
    closeWoDetail();
    loadData();
  }
};

window.copyApprovalCmd = function(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (wo) copyApprovalCommand(wo);
};

window.copyRejectionCmd = function(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (wo) copyRejectionCommand(wo);
};

// M3c: Share Pack Refresh functions
window.showRefreshSharePackModal = showRefreshSharePackModal;
window.closeRefreshSharePackModal = closeRefreshSharePackModal;
window.handleRefreshSharePack = handleRefreshSharePack;
window.copyRefreshCommand = copyRefreshCommand;

// M3e: Agent Output Import functions
window.handleImportAgentOutput = handleImportAgentOutput;
window.handleImportAndPostToGitHub = handleImportAndPostToGitHub;
window.copyImportForGitHub = copyImportForGitHub;

// M3g: Evolution Proposal functions
window.handleSaveProposal = handleSaveProposal;
window.handleCopyProposalMarkdown = handleCopyProposalMarkdown;
window.handlePostProposalToGitHub = handlePostProposalToGitHub;

// M3a: Extended WO markdown copy using buildWoMarkdown()
window.copyWoMarkdown = async function() {
  const fields = {
    taskId: document.getElementById('wo-task-id')?.value || '',
    taskType: document.getElementById('wo-task-type')?.value || '',
    executionMode: document.getElementById('wo-exec-mode')?.value || 'code',
    intent: document.getElementById('wo-intent')?.value || '',
    scope: document.getElementById('wo-scope')?.value || '',
    allowedFiles: document.getElementById('wo-allowed')?.value || '',
    forbidden: document.getElementById('wo-forbidden')?.value || '',
    successCriteria: document.getElementById('wo-success')?.value || '',
    dependencies: document.getElementById('wo-dependencies')?.value || '',
    sharePackRefresh: document.getElementById('wo-sharepack')?.checked || false,
    notes: document.getElementById('wo-notes')?.value || '',
    intentId: document.getElementById('wo-intent-id')?.value || ''
  };
  const markdown = buildWoMarkdown(fields);
  const copied = await copyToClipboard(markdown);
  showToast(copied ? 'WO Markdown copied!' : 'Copy failed', copied ? 'success' : 'error');
};

// Legacy: keep copyWoBody for backwards compatibility
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

// M4: Repo-Aware Executor functions
window.openRepoExecutorModal = openRepoExecutorModal;
window.closeRepoExecutorModal = closeRepoExecutorModal;
window.triggerRepoExecutorDispatch = triggerRepoExecutorDispatch;
window.copyRepoExecutorPayload = copyRepoExecutorPayload;
window.refreshExecStatus = refreshExecStatus;

// M4: Deploy to Prod functions
window.showDeployConfirmModal = showDeployConfirmModal;
window.closeDeployConfirmModal = closeDeployConfirmModal;
window.triggerDeployToProd = triggerDeployToProd;

// M4: Import shortcut function
window.navigateToImportWithWo = navigateToImportWithWo;

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
