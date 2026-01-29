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

// Compute Share Pack base URL relative to this script
const SHARE_PACK_BASE = new URL('../exports/share-pack/', import.meta.url).href.replace(/\/$/, '');

// P8: Compute Observations URL relative to this script
const OBSERVATIONS_BASE = new URL('../exports/observations/', import.meta.url).href.replace(/\/$/, '');
const OBSERVATIONS_LATEST_URL = `${OBSERVATIONS_BASE}/latest.json`;

// Compute data URLs relative to this script
const ENTITIES_URL = new URL('./data/entities.json', import.meta.url).href;
const ENVIRONMENTS_URL = new URL('./data/environments.json', import.meta.url).href;
const PRODUCTS_URL = new URL('./data/products.json', import.meta.url).href;

// M3c: Workflow dispatch URLs
const SHARE_PACK_REFRESH_WORKFLOW = 'forge-share-pack-refresh.yml';
const SHARE_PACK_REFRESH_URL = `${REPO_BASE}/actions/workflows/${SHARE_PACK_REFRESH_WORKFLOW}`;

// M3e: Agent Output Import storage key
const AGENT_OUTPUTS_STORAGE_KEY = 'forge_portal_agent_outputs';

// M3f: Deployment Status cache key
const DEPLOY_STATUS_CACHE_KEY = 'forge_portal_deploy_status_cache';

// M3g: Evolution Proposal storage key
const EVOLUTION_PROPOSALS_STORAGE_KEY = 'forge_portal_evolution_proposals';

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
  agentOutputs: {},  // M3e: Locally stored agent outputs by WO ID
  deployStatusCache: null,  // M3f: Cached deployment status for offline display
  evolutionProposals: {},  // M3g: Locally stored evolution proposals by WO ID
  currentTab: 'home',
  currentScreen: 'home',
  woFilter: 'all',
  woLaneFilter: 'all',
  entityFilter: null,
  selectedWo: null,  // For detail modal
  selectedE2EPhase: 'executing',  // Default E2E phase
  loading: true,
  error: null,
  errorDetails: null
};

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
const REPO_OWNER = 'emkaybarrie';
const REPO_NAME = 'projectExodus';

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

  const [sharePack, workOrders, entities, environments, products, observationsResult] = await Promise.all([
    loadSharePack(),
    loadWorkOrders(),
    loadEntities(),
    loadEnvironments(),
    loadProducts(),
    loadObservations()
  ]);

  state.sharePack = sharePack;
  state.workOrders = workOrders;
  state.entities = entities;
  state.environments = environments;
  state.products = products;
  state.observations = observationsResult.data;
  state.observationsError = observationsResult.error;
  state.agentOutputs = loadAgentOutputs();
  state.deployStatusCache = loadDeployStatusCache();
  state.evolutionProposals = loadEvolutionProposals();

  // M3f: Update deploy status cache if we have fresh observations
  if (observationsResult.data) {
    const cacheEntry = {
      ...observationsResult.data,
      cachedAt: new Date().toISOString()
    };
    saveDeployStatusCache(cacheEntry);
    state.deployStatusCache = cacheEntry;
  }

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
    'create-wo': 'forge',
    'import-agent-output': 'forge',
    'evolution-proposal': 'forge',
    'deploy-status': 'forge',
    'settings': 'home'
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
  // Note: GitHub Issue Forms don't support URL prefill for all fields
  // Users will need to fill remaining fields in GitHub
  return `${base}?${params.toString()}`;
}

// M3a: Build complete WO markdown for copy-to-clipboard
function buildWoMarkdown(fields) {
  const lines = [
    `## Work Order: ${fields.taskId || '[TASK ID]'}`,
    '',
    `**Task Type:** ${fields.taskType || 'Not specified'}`,
    `**Execution Mode:** ${fields.executionMode || 'code'}`,
    `**Share Pack Refresh:** ${fields.sharePackRefresh ? 'Required' : 'Not required'}`,
    '',
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
        <button class="nav-card" onclick="navigateTo('settings')">
          <span class="nav-card-icon">&#9881;</span>
          <span class="nav-card-title">Settings</span>
          <span class="nav-card-desc">${hasPAT() ? 'PAT configured' : 'Configure PAT'}</span>
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
  return `
    <section class="panel">
      <div class="section-header">
        <button class="back-btn" onclick="navigateTo('forge')">&#8592;</button>
        <h2 class="panel-title">Create Work Order</h2>
      </div>
      <p class="panel-subtitle-sm">Draft a Work Order for Director approval</p>
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
  const executedWos = wos.filter(wo => ['executed', 'approved', 'executing'].includes(wo.status));

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
              <option value="${wo.id}">${wo.id} — ${wo.title}</option>
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
        <button class="back-btn" onclick="navigateTo('home')">&#8592;</button>
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
    case 'import-agent-output':
      return renderImportAgentOutputScreen();
    case 'evolution-proposal':
      return renderEvolutionProposalScreen();
    case 'deploy-status':
      return renderDeploymentStatusScreen();
    case 'settings':
      return renderSettingsScreen();
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
  if (wo) {
    const success = await approveWorkOrder(wo);
    if (success) {
      closeWoDetail();
      // Refresh data to reflect new status
      loadData();
    }
  }
};

window.handleRejectWo = async function(woId) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (wo) {
    // Prompt for reason (optional)
    const reason = prompt('Rejection reason (optional):');
    const success = await rejectWorkOrder(wo, reason || '');
    if (success) {
      closeWoDetail();
      // Refresh data to reflect new status
      loadData();
    }
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
    notes: document.getElementById('wo-notes')?.value || ''
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
