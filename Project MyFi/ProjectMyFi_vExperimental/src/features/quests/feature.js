/**
 * Feature Pack: quests (V1)
 * Responsibility:
 * - Own quest data (demo-ready in-memory for now)
 * - Provide stable VM slices for UI (quests.tabs, quests.sections)
 * - Provide actions (setActiveTab, claim, primary)
 *
 * Notes:
 * - This is intentionally minimal to validate the UI DSL workflow.
 * - Later you can swap the data source without changing UI.
 */

const TAB_DEFS = [
  { id: 'tutorial',   label: 'Tutorial' },
  { id: 'repeatable', label: 'Repeatable' },
  { id: 'narrative',  label: 'Badlands' },
  { id: 'goals',      label: 'Goals' }
];

const state = {
  activeTabId: 'tutorial',
  // claimed rewards store
  claimed: new Set(),
  // demo progression ticks (passive progress simulation)
  tick: 0
};

// Demo quest catalog (replace with Firestore later)
const QUESTS = [
  {
    id: 'q_tut_1',
    type: 'tutorial',
    title: 'Stoke the Wardfire',
    subtitle: 'Log your core expenses',
    isPlayerAuthored: false,
    isRepeatable: false,
    isNarrative: false,
    autoClaimIfActive: true,
    rewards: [{ kind: 'xp', amount: 50 }, { kind: 'essence', amount: 5 }],
    progress: { current: 0, max: 1 }
  },
  {
    id: 'q_tut_2',
    type: 'tutorial',
    title: 'Name Your Flame',
    subtitle: 'Set your profile alias',
    autoClaimIfActive: true,
    rewards: [{ kind: 'xp', amount: 25 }],
    progress: { current: 0, max: 1 }
  },
  {
    id: 'q_rep_d_1',
    type: 'repeatable',
    title: 'Daily Tidy',
    subtitle: 'Tag 3 transactions today',
    autoClaimIfActive: true,
    rewards: [{ kind: 'xp', amount: 20 }],
    progress: { current: 0, max: 3 }
  },
  {
    id: 'q_rep_w_1',
    type: 'repeatable',
    title: 'Weekly Calm',
    subtitle: 'Stay under Stamina budget this week',
    autoClaimIfActive: false,
    rewards: [{ kind: 'xp', amount: 60 }, { kind: 'essence', amount: 10 }],
    progress: { current: 0, max: 7 }
  },
  {
    id: 'q_bad_1',
    type: 'narrative',
    title: 'Cross the Ashline',
    subtitle: 'Reach Badlands Node 1',
    autoClaimIfActive: false,
    rewards: [{ kind: 'xp', amount: 100 }],
    progress: { current: 1, max: 5 }
  },
  {
    id: 'q_goal_1',
    type: 'goals',
    title: 'My First Goal',
    subtitle: 'Save £50 this month',
    isPlayerAuthored: true,
    // Player-authored goals: no XP by default
    rewards: [],
    progress: { current: 10, max: 50 }
  },

];

function isClaimed(id) {
  return state.claimed.has(id);
}

function isComplete(q) {
  const p = q.progress || { current: 0, max: 1 };
  return (p.current >= p.max);
}

function isClaimable(q) {
  return isComplete(q) && !isClaimed(q.id);
}

function cloneQuestForVM(q, { isActive }) {
  const p = q.progress || { current: 0, max: 1 };
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
    progress: { current: p.current, max: p.max, label: `${p.current} / ${p.max}` },
    rewards: Array.isArray(q.rewards) ? q.rewards : [],
    // Simple CTA model for the UI:
    cta: claimable ? { kind: 'claim', label: 'Claim' } : null,
    // For player-authored goals:
    isPlayerAuthored: !!q.isPlayerAuthored
  };
}

/**
 * Passive progress simulation:
 * - Each VM build increments "tick"
 * - Some quests advance gradually for demo
 */
function simulateProgress() {
  state.tick++;
  // tiny, deterministic pseudo-progress for demo
  for (const q of QUESTS) {
    if (q.type === 'repeatable') {
      if (state.tick % 3 === 0 && q.progress.current < q.progress.max) q.progress.current++;
    }
    if (q.type === 'tutorial') {
      if (state.tick % 5 === 0 && q.progress.current < q.progress.max) q.progress.current++;
    }
  }
}

/**
 * Auto-claim for ACTIVE quests (feature-owned business logic)
 */
function autoClaimActive(activeList) {
  for (const q of activeList) {
    if (q.autoClaim) {
      state.claimed.add(q.id);
    }
  }
}

async function buildVM() {
  // Simulate passive progress
  simulateProgress();

  const tabs = {
    activeTabId: state.activeTabId,
    tabs: TAB_DEFS
  };

  // Pick 1–3 active quests for this tab (demo rule)
  const allInTab = QUESTS.filter(q => q.type === state.activeTabId);
  const activeRaw = allInTab.slice(0, 1);
  const availableRaw = allInTab.slice(1);

  const active = activeRaw.map(q => cloneQuestForVM(q, { isActive: true }))
    .slice(0, 3);

  // Auto-claim behaviour for active quests
  autoClaimActive(active);

  // Recompute active after auto-claim so UI reflects it immediately
  const activeAfter = activeRaw.map(q => cloneQuestForVM(q, { isActive: true }))
    .slice(0, 3);

  const available = availableRaw.map(q => cloneQuestForVM(q, { isActive: false }));

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
      items: available
    }
  };

  return { quests: { tabs, sections } };
}

async function setActiveTab(tabId) {
  if (!TAB_DEFS.some(t => t.id === tabId)) return;
  state.activeTabId = tabId;
}

async function claim(questId) {
  const q = QUESTS.find(x => x.id === questId);
  if (!q) return;
  if (!isClaimable(q)) return;

  state.claimed.add(questId);
}

async function primary(questId) {
  // Placeholder action (e.g., open quest details modal later)
  // Keep as a no-op for now.
  console.log('[quests] primary', questId);
}

export const questsFeature = {
  id: 'quests',
  api: {
    buildVM,
    setActiveTab,
    claim,
    primary
  }
};

export default questsFeature;
