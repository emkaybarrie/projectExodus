/**
 * Central demo dataset for Quests.
 * - Returns CANONICAL domain state (NOT VM)
 * - Easy to tweak for demos without touching feature logic
 */
export function makeQuestsDemoDomain({ variant = 'default' } = {}) {
  // Domain state shape: { tabs, quests, claimedIds, activeTabId, limits }
  const tabs = [
    { id: 'tutorial',   label: 'Tutorial' },
    { id: 'repeatable', label: 'Repeatable' },
    { id: 'narrative',  label: 'Badlands' },
    { id: 'goals',      label: 'Goals' }
  ];

  // Important: keep quest objects in a stable shape you can map later from Firestore
  const quests = [
    {
      id: 'q_tut_1',
      type: 'tutorial',
      title: 'Stoke the Wardfire',
      subtitle: 'Log your core expenses',
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

    // Repeatables (enough items so Available isn't empty if activeCount=1)
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
      id: 'q_rep_w_2',
      type: 'repeatable',
      title: 'Weekly Ward',
      subtitle: 'Log 1 core expense this week',
      autoClaimIfActive: false, // manual claim path
      rewards: [{ kind: 'xp', amount: 30 }, { kind: 'essence', amount: 3 }],
      progress: { current: 1, max: 1 } // claimable immediately
    },
    {
      id: 'q_rep_d_2',
      type: 'repeatable',
      title: 'Daily Spark',
      subtitle: 'Tag 1 transaction today',
      autoClaimIfActive: true,
      rewards: [{ kind: 'xp', amount: 10 }],
      progress: { current: 1, max: 1 }
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
      rewards: [], // Player-authored goals: no XP
      progress: { current: 10, max: 50 }
    }
  ];

  const domain = {
    tabs,
    quests,
    claimedIds: [],
    activeTabId: 'tutorial',

    // This respects your change: only 1 active quest per type
    limits: { activeCount: 1 },

    // Demo-only ticking behavior flags (feature can use these)
    demo: { enablePassiveProgress: true }
  };

  if (variant === 'empty') {
    domain.quests = [];
  }

  return domain;
}
