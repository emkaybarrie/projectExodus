// src/screens/quests/model.js
// Quests screen state model (Model A)
//
// Controller owns state + actions.
// Parts render based on state and emit actions back (via store methods).

const TYPES = [
  { key: 'income', label: 'Income' },
  { key: 'spend', label: 'Spend' },
  { key: 'habit', label: 'Habit' },
];

export function getQuestTypes(){
  return TYPES.slice();
}

export function makeDemoQuests(){
  // Deterministic demo data until feature pack/VM is wired.
  return [
    { id:'q_income_1', type:'income', title:'Log your payday', narrative:'Mark your latest income so the Wardfire can breathe.', progress:1, target:1, reward:{ xp:30, essence:5 }, state:'complete', focused:false, claimed:false },
    { id:'q_income_2', type:'income', title:'Confirm recurring income', narrative:'Prove the pattern. The world likes patterns.', progress:0, target:1, reward:{ xp:40, essence:10 }, state:'active', focused:false, claimed:false },
    { id:'q_spend_1', type:'spend', title:'Tag 3 transactions', narrative:'Name the costs and the costs lose their teeth.', progress:1, target:3, reward:{ xp:25, essence:5 }, state:'active', focused:false, claimed:false },
    { id:'q_spend_2', type:'spend', title:'No impulse buys today', narrative:'Keep Mana for spells, not snacks.', progress:0, target:1, reward:{ xp:50, essence:15 }, state:'active', focused:false, claimed:false },
    { id:'q_habit_1', type:'habit', title:'Daily check-in', narrative:'One glance a day keeps the goblins away.', progress:0, target:1, reward:{ xp:15, essence:3 }, state:'active', focused:false, claimed:false },
    { id:'q_habit_2', type:'habit', title:'Plan one expense', narrative:'A named expense is a tamed expense.', progress:0, target:1, reward:{ xp:20, essence:5 }, state:'active', focused:false, claimed:false },
  ];
}

function ensureOneFocusedPerType(list){
  const seen = new Set();
  for (const q of list) {
    if (!q.focused) continue;
    if (seen.has(q.type)) q.focused = false;
    else seen.add(q.type);
  }
}

function autoClaimFocused(list){
  // Spec: focused quests auto-claim when completed.
  for (const q of list) {
    if (q.focused && q.state === 'complete' && !q.claimed) {
      q.claimed = true;
      q.state = 'claimed';
    }
  }
}

export function createQuestsStore({ initialQuests } = {}){
  const state = {
    filterType: 'all',
    quests: Array.isArray(initialQuests) ? structuredClone(initialQuests) : makeDemoQuests(),
  };

  ensureOneFocusedPerType(state.quests);
  autoClaimFocused(state.quests);

  const listeners = new Set();

  function notify(){
    for (const fn of listeners) {
      try { fn(getSnapshot()); } catch {}
    }
  }

  function getSnapshot(){
    // Shallow clone primitives; quests is cloned to prevent accidental external mutation.
    return {
      filterType: state.filterType,
      quests: structuredClone(state.quests),
    };
  }

  function setFilter(type){
    state.filterType = type || 'all';
    notify();
  }

  function toggleFocus(qid){
    const q = state.quests.find(x => x.id === qid);
    if (!q) return;
    if (q.focused) {
      q.focused = false;
      notify();
      return;
    }
    // enforce 1 focused per type
    state.quests.forEach(x => { if (x.type === q.type) x.focused = false; });
    q.focused = true;
    // focused + complete => auto-claim
    autoClaimFocused(state.quests);
    notify();
  }

  function claim(qid){
    const q = state.quests.find(x => x.id === qid);
    if (!q) return null;
    if (q.state !== 'complete' || q.claimed) return null;
    q.claimed = true;
    q.state = 'claimed';
    notify();
    return { id: q.id, reward: q.reward };
  }

  function selectBySection(section){
    autoClaimFocused(state.quests);
    const filtered = (list) => {
      if (state.filterType === 'all') return list;
      return list.filter(q => q.type === state.filterType);
    };
    if (section === 'focused') {
      return filtered(state.quests.filter(q => q.focused && q.state !== 'claimed'));
    }
    if (section === 'available') {
      return filtered(state.quests.filter(q => !q.focused && q.state !== 'claimed'));
    }
    // completed
    return filtered(state.quests.filter(q => q.state === 'claimed' || q.claimed));
  }

  return {
    // metadata
    types: getQuestTypes,
    // state
    getSnapshot,
    subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); },
    // actions
    setFilter,
    toggleFocus,
    claim,
    // selectors
    selectBySection,
  };
}
