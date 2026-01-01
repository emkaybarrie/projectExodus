// src/ui/parts/QuestBoard.js
// A "board" part that renders focused + available quests.
//
// NOTE: This is intentionally written as a generic, data-driven list part
// rather than a bespoke "QuestCard" widget. The JSON surface decides WHERE
// it sits; this part decides HOW to render and wire events.

const TYPES = [
  { key: 'income', label: 'Income' },
  { key: 'spend', label: 'Spend' },
  { key: 'habit', label: 'Habit' },
];

function clamp01(n){ return Math.max(0, Math.min(1, n)); }

function fmtReward(r){
  if (!r) return '';
  const bits = [];
  if (r.xp) bits.push(`+${r.xp} XP`);
  if (r.essence) bits.push(`+${r.essence} Essence`);
  if (r.gold) bits.push(`+${r.gold} Gold`);
  return bits.join(' · ');
}

function makeDemoQuests(){
  // In the real build, this will come from a Quests Feature Pack + VM.
  // For now we keep it deterministic and small.
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
  // If multiple focused somehow, keep first.
  const seen = new Set();
  for (const q of list) {
    if (!q.focused) continue;
    if (seen.has(q.type)) q.focused = false;
    else seen.add(q.type);
  }
}

function autoClaimFocused(list){
  // Spec: focused quests are auto-claimed when completed.
  for (const q of list) {
    if (q.focused && q.state === 'complete' && !q.claimed) {
      q.claimed = true;
      q.state = 'claimed';
    }
  }
}

function build(){
  const wrap = document.createElement('div');
  wrap.className = 'qb';
  wrap.innerHTML = `
    <div class="qb__top myfiCard myfiCardPad">
      <div class="qb__title myfiTitle">Quests</div>
      <div class="qb__hint myfiHint">Focus up to <b>one</b> quest per type. Focused quests auto-claim on completion.</div>
    </div>
    <div class="qb__types" role="tablist" aria-label="Quest types"></div>
    <div class="qb__sections">
      <div class="qb__section myfiCard myfiCardPad" data-sec="focused">
        <div class="qb__secHead myfiSectionTitle">Focused</div>
        <div class="qb__list" data-list="focused"></div>
      </div>
      <div class="qb__section myfiCard myfiCardPad" data-sec="available">
        <div class="qb__secHead myfiSectionTitle">Available</div>
        <div class="qb__list" data-list="available"></div>
      </div>
      <div class="qb__section myfiCard myfiCardPad" data-sec="completed">
        <div class="qb__secHead myfiSectionTitle">Completed</div>
        <div class="qb__list" data-list="completed"></div>
      </div>
    </div>
  `;
  return wrap;
}

function renderQuestCard(q){
  const pct = q.target ? clamp01((q.progress || 0) / q.target) : 0;
  const card = document.createElement('div');
  card.className = `qbCard ${q.focused ? 'is-focused' : ''} ${q.state ? `is-${q.state}` : ''}`;
  card.dataset.qid = q.id;
  card.innerHTML = `
    <div class="qbCard__row">
      <div class="qbCard__meta">
        <div class="qbCard__type">${q.type.toUpperCase()}</div>
        <div class="qbCard__name">${q.title}</div>
      </div>
      <div class="qbCard__actions">
        <button class="qbBtn" data-act="focus">${q.focused ? 'Unfocus' : 'Focus'}</button>
        <button class="qbBtn" data-act="claim" ${q.state !== 'complete' || q.claimed ? 'disabled' : ''}>Claim</button>
      </div>
    </div>
    <div class="qbCard__nar">${q.narrative || ''}</div>
    <div class="qbCard__bar">
      <div class="qbCard__fill" style="width:${Math.round(pct*100)}%"></div>
    </div>
    <div class="qbCard__foot">
      <div class="qbCard__prog">${q.progress || 0}/${q.target || 0}</div>
      <div class="qbCard__reward">${fmtReward(q.reward)}</div>
    </div>
  `;
  return card;
}

export function QuestBoardPart(host, { props = {}, ctx = {} } = {}) {
  const state = {
    filterType: 'all',
    quests: Array.isArray(props.quests) ? structuredClone(props.quests) : makeDemoQuests(),
  };

  ensureOneFocusedPerType(state.quests);
  autoClaimFocused(state.quests);

  const root = build();
  host.appendChild(root);

  const typesEl = root.querySelector('.qb__types');
  const focusedListEl = root.querySelector('[data-list="focused"]');
  const availListEl = root.querySelector('[data-list="available"]');
  const doneListEl = root.querySelector('[data-list="completed"]');

  function setFilter(type){
    state.filterType = type;
    [...typesEl.querySelectorAll('button')].forEach(b => b.classList.toggle('is-active', b.dataset.type === type));
    paint();
  }

  function buildTypeTabs(){
    const btnAll = document.createElement('button');
    btnAll.className = 'qbTab is-active';
    btnAll.dataset.type = 'all';
    btnAll.textContent = 'All';
    btnAll.addEventListener('click', () => setFilter('all'));
    typesEl.appendChild(btnAll);

    for (const t of TYPES) {
      const b = document.createElement('button');
      b.className = 'qbTab';
      b.dataset.type = t.key;
      b.textContent = t.label;
      b.addEventListener('click', () => setFilter(t.key));
      typesEl.appendChild(b);
    }
  }

  function filtered(list){
    if (state.filterType === 'all') return list;
    return list.filter(q => q.type === state.filterType);
  }

  function paint(){
    autoClaimFocused(state.quests);

    const focused = filtered(state.quests.filter(q => q.focused && q.state !== 'claimed'));
    const available = filtered(state.quests.filter(q => !q.focused && q.state !== 'claimed'));
    const completed = filtered(state.quests.filter(q => q.state === 'claimed' || q.claimed));

    focusedListEl.innerHTML = '';
    availListEl.innerHTML = '';
    doneListEl.innerHTML = '';

    focused.forEach(q => focusedListEl.appendChild(renderQuestCard(q)));
    available.forEach(q => availListEl.appendChild(renderQuestCard(q)));
    completed.forEach(q => doneListEl.appendChild(renderQuestCard(q)));

    if (focused.length === 0) focusedListEl.innerHTML = `<div class="qbEmpty">No focused quests yet.</div>`;
    if (available.length === 0) availListEl.innerHTML = `<div class="qbEmpty">No available quests in this filter.</div>`;
    if (completed.length === 0) doneListEl.innerHTML = `<div class="qbEmpty">Nothing claimed yet.</div>`;
  }

  function toggleFocus(qid){
    const q = state.quests.find(x => x.id === qid);
    if (!q) return;
    if (q.focused) {
      q.focused = false;
      paint();
      return;
    }
    // enforce 1 focused per type
    state.quests.forEach(x => { if (x.type === q.type) x.focused = false; });
    q.focused = true;
    paint();
  }

  function claim(qid){
    const q = state.quests.find(x => x.id === qid);
    if (!q) return;
    if (q.state !== 'complete' || q.claimed) return;
    q.claimed = true;
    q.state = 'claimed';
    // In the real build, this will call feature API to apply rewards.
    root.dispatchEvent(new CustomEvent('quests:claimed', { bubbles:true, detail:{ id: q.id, reward: q.reward } }));
    paint();
  }

  function onClick(e){
    const btn = e.target?.closest?.('button[data-act]');
    if (!btn) return;
    const card = btn.closest?.('.qbCard');
    const qid = card?.dataset?.qid;
    if (!qid) return;

    const act = btn.dataset.act;
    if (act === 'focus') toggleFocus(qid);
    if (act === 'claim') claim(qid);
  }

  // Init
  buildTypeTabs();
  root.addEventListener('click', onClick);
  paint();

  return {
    unmount(){
      try { root.removeEventListener('click', onClick); } catch {}
      try { host.innerHTML = ''; } catch {}
    }
  };
}
