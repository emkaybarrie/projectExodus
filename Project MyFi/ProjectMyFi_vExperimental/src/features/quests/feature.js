/**
 * Feature Pack: quests (V1)
 *
 * Goals:
 * - Centralized demo data under src/dev/demo-data
 * - Adapter-based swap: demo vs firestore (toggleable)
 * - Stable VM slices: quests.tabs, quests.sections
 * - Stable actions: setActiveTab, claim, primary
 */

import { getFeatureDataMode } from '../../core/dataMode.js';
import { auth, db } from '../../core/firestore.js';

import { questsDemoAdapter } from './adapters/demoAdapter.js';
import { questsFirestoreAdapter } from './adapters/firestoreAdapter.js';

// --------------------
// Domain state (canonical)
// --------------------
const state = {
  activeTabId: 'tutorial',
  claimed: new Set(),
  tick: 0,

  // Loaded domain cache (from adapter)
  domain: null,
  adapterId: null
};

// --------------------
// Pure helpers (selectors)
// --------------------
function isComplete(q) {
  const p = q?.progress || { current: 0, max: 1 };
  return Number(p.current ?? 0) >= Number(p.max ?? 1);
}

function isClaimed(id) {
  return state.claimed.has(id);
}

function isClaimable(q) {
  return isComplete(q) && !isClaimed(q.id);
}

function toVMQuest(q, { isActive }) {
  const p = q?.progress || { current: 0, max: 1 };
  const claimable = isClaimable(q);

  return {
    id: q.id,
    type: q.type,
    title: q.title,
    subtitle: q.subtitle,
    isActive,
    isComplete: isComplete(q),
    isClaimable: claimable,
    autoClaim: !!(isActive && q.autoClaimIfActive && claimable),
    progress: {
      current: Number(p.current ?? 0),
      max: Number(p.max ?? 1),
      label: `${Number(p.current ?? 0)} / ${Number(p.max ?? 1)}`
    },
    rewards: Array.isArray(q.rewards) ? q.rewards : [],
    cta: claimable ? { kind: 'claim', label: 'Claim' } : null,
    isPlayerAuthored: !!q.isPlayerAuthored
  };
}

// --------------------
// Adapter selection + loading
// --------------------
function pickAdapter() {
  const mode = getFeatureDataMode('quests', { defaultMode: 'demo' });
  if (mode === 'real') return questsFirestoreAdapter;
  return questsDemoAdapter;
}

async function ensureDomainLoaded() {
  const adapter = pickAdapter();

  // Avoid re-loading if adapter stays same and domain already loaded
  if (state.domain && state.adapterId === adapter.id) return state.domain;

  // Build ctx with explicit inputs (no hidden globals)
  const ctx = { user: auth.currentUser || null, db };

  const domain = await adapter.loadDomain(ctx);

  // Visible failure fallback: domain must exist
  if (!domain || !Array.isArray(domain.quests) || !Array.isArray(domain.tabs)) {
    console.warn('[quests] adapter returned invalid domain; forcing empty domain.');
    state.domain = {
      tabs: [],
      quests: [],
      claimedIds: [],
      activeTabId: 'tutorial',
      limits: { activeCount: 1 },
      demo: { enablePassiveProgress: false }
    };
  } else {
    state.domain = domain;
  }

  state.adapterId = adapter.id;

  // Sync state from domain on first load
  state.activeTabId = state.domain.activeTabId || state.activeTabId;

  // claimedIds in domain → claimed Set
  try {
    state.claimed = new Set(state.domain.claimedIds || []);
  } catch {
    state.claimed = new Set();
  }

  return state.domain;
}

// --------------------
// Demo-only passive progress (kept feature-owned)
// --------------------
function simulateProgress(domain) {
  if (!domain?.demo?.enablePassiveProgress) return;

  state.tick++;

  for (const q of (domain.quests || [])) {
    if (!q?.progress) continue;

    if (q.type === 'repeatable') {
      if (state.tick % 3 === 0 && q.progress.current < q.progress.max) q.progress.current++;
    }
    if (q.type === 'tutorial') {
      if (state.tick % 5 === 0 && q.progress.current < q.progress.max) q.progress.current++;
    }
  }
}

function autoClaimActive(activeVMList) {
  for (const q of activeVMList) {
    if (q.autoClaim) state.claimed.add(q.id);
  }
}

// --------------------
// VM builder
// --------------------
async function buildVM() {
  const domain = await ensureDomainLoaded();

  // Demo progression simulation (no-op in real mode)
  simulateProgress(domain);

  const tabs = {
    activeTabId: state.activeTabId,
    tabs: domain.tabs || []
  };

  const allInTab = (domain.quests || []).filter(q => q.type === state.activeTabId);

  const activeCount = Number(domain?.limits?.activeCount ?? 1);

  const activeRaw = allInTab.slice(0, activeCount);
  const availableRaw = allInTab.slice(activeCount);

  const activeVM = activeRaw.map(q => toVMQuest(q, { isActive: true }));
  autoClaimActive(activeVM);

  // Recompute after auto-claim so UI reflects immediately
  const activeAfter = activeRaw.map(q => toVMQuest(q, { isActive: true }));
  const availableVM = availableRaw.map(q => toVMQuest(q, { isActive: false }));

  const sections = {
    tabId: state.activeTabId,
    active: {
      title: 'Active Quests',
      hint: 'Active quests auto-claim and grant a small XP boost.',
      items: activeAfter
    },
    available: {
      title: 'Available Quests',
      hint: 'Complete anytime. Manual claim.',
      items: availableVM
    }
  };

  return { quests: { tabs, sections } };
}

// --------------------
// Actions
// --------------------
async function setActiveTab(tabId) {
  const domain = await ensureDomainLoaded();
  const valid = (domain.tabs || []).some(t => t.id === tabId);
  if (!valid) return;
  state.activeTabId = tabId;
}

async function claim(questId) {
  const domain = await ensureDomainLoaded();
  const q = (domain.quests || []).find(x => x.id === questId);
  if (!q) return;
  if (!isClaimable(q)) return;
  state.claimed.add(questId);
  // Later: persist claim via adapter.saveDomainPatch(ctx, ...)
}

async function primary(questId) {
  console.log('[quests] primary', questId);
}

// Optional dev helper: reset demo domain without touching UI
async function __reloadDomain() {
  state.domain = null;
  state.adapterId = null;
  await ensureDomainLoaded();
}

export const questsFeature = {
  id: 'quests',
  api: {
    buildVM,
    setActiveTab,
    claim,
    primary,

    // Dev-only helper so you can flip modes and force refresh
    __reloadDomain
  }
};

export default questsFeature;
