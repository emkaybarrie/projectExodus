// QuestList Part — WO-2: Main quests display
// Shows quest cards with progress, rewards, and tag spend hooks

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.QuestList', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-QuestList QuestList';

  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  let currentTab = 'active';

  // Subscribe to tab changes from QuestHeader
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    unsubscribers.push(
      ctx.actionBus.subscribe('questTabChange', ({ tab }) => {
        currentTab = tab;
        render(root, data, currentTab);
      })
    );
  }

  // Bind card interactions
  bindInteractions(root, ctx);

  // Initial render with demo data
  const renderData = data.quests ? data : getDemoData();
  render(root, renderData, currentTab);

  return {
    unmount() {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      root.remove();
    },
    update(newData) {
      render(root, newData, currentTab);
    },
  };
}

function bindInteractions(root, ctx) {
  // Delegate click handling to container
  root.addEventListener('click', (e) => {
    const card = e.target.closest('.QuestCard');
    if (!card) return;

    const questId = card.dataset.questId;
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'tagSpend' && ctx.emitter) {
      ctx.emitter.emit('questTagSpend', { questId });
      return;
    }

    if (ctx.emitter) {
      ctx.emitter.emit('questDetail', { questId });
    }
  });
}

function render(root, data, tab = 'active') {
  const listEl = root.querySelector('.QuestList__cards');
  const emptyEl = root.querySelector('.QuestList__empty');
  if (!listEl || !emptyEl) return;

  const allQuests = data.quests || [];
  const quests = allQuests.filter(q => {
    if (tab === 'active') return q.status === 'active' || q.status === 'available';
    if (tab === 'completed') return q.status === 'completed';
    return true;
  });

  if (quests.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    emptyEl.textContent = tab === 'completed'
      ? 'No completed quests yet. Keep adventuring!'
      : 'No active quests. Check the board for new opportunities!';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.innerHTML = quests.map(renderQuestCard).join('');
}

function renderQuestCard(quest) {
  const {
    id,
    title = 'Unknown Quest',
    narrative = '',
    type = 'side',
    progress = 0,
    target = 100,
    rewards = {},
    status = 'active',
    canTagSpend = false,
  } = quest;

  const progressPercent = target > 0 ? Math.min(100, (progress / target) * 100) : 0;
  const typeIcon = getTypeIcon(type);
  const rewardChips = formatRewards(rewards);

  return `
    <div class="QuestCard" data-quest-id="${id}" data-type="${type}" data-status="${status}">
      <div class="QuestCard__header">
        <span class="QuestCard__typeIcon">${typeIcon}</span>
        <span class="QuestCard__title">${escapeHtml(title)}</span>
        ${status === 'completed' ? '<span class="QuestCard__checkmark">&#10003;</span>' : ''}
      </div>

      ${narrative ? `<p class="QuestCard__narrative">${escapeHtml(narrative)}</p>` : ''}

      <div class="QuestCard__progressRow">
        <div class="QuestCard__progressBar">
          <div class="QuestCard__progressFill" style="width: ${progressPercent}%"></div>
        </div>
        <span class="QuestCard__progressText">${progress}/${target}</span>
      </div>

      <div class="QuestCard__footer">
        <div class="QuestCard__rewards">
          ${rewardChips}
        </div>
        ${canTagSpend && status !== 'completed' ? `
          <button class="QuestCard__tagBtn" data-action="tagSpend">
            Tag Spend
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function getTypeIcon(type) {
  switch (type) {
    case 'main': return '&#9733;'; // Star
    case 'daily': return '&#9788;'; // Sun
    case 'weekly': return '&#128197;'; // Calendar
    case 'challenge': return '&#9889;'; // Lightning
    case 'side':
    default:
      return '&#128220;'; // Scroll
  }
}

function formatRewards(rewards) {
  const chips = [];

  if (rewards.xp) {
    chips.push(`<span class="QuestCard__rewardChip QuestCard__rewardChip--xp">+${rewards.xp} XP</span>`);
  }
  if (rewards.essence) {
    chips.push(`<span class="QuestCard__rewardChip QuestCard__rewardChip--essence">+${rewards.essence} ESS</span>`);
  }
  if (rewards.gold) {
    chips.push(`<span class="QuestCard__rewardChip QuestCard__rewardChip--gold">+${rewards.gold} Gold</span>`);
  }
  if (rewards.item) {
    chips.push(`<span class="QuestCard__rewardChip QuestCard__rewardChip--item">${escapeHtml(rewards.item)}</span>`);
  }

  return chips.join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDemoData() {
  return {
    quests: [
      {
        id: 'q1',
        title: 'First Steps',
        narrative: 'Complete your first budget cycle without overspending.',
        type: 'main',
        progress: 12,
        target: 30,
        rewards: { xp: 100, essence: 50 },
        status: 'active',
        canTagSpend: true,
      },
      {
        id: 'q2',
        title: 'Daily Discipline',
        narrative: 'Log all expenses for today.',
        type: 'daily',
        progress: 3,
        target: 5,
        rewards: { xp: 25 },
        status: 'active',
        canTagSpend: true,
      },
      {
        id: 'q3',
        title: 'Emergency Buffer',
        narrative: 'Build an emergency fund of 1000 essence.',
        type: 'side',
        progress: 450,
        target: 1000,
        rewards: { xp: 200, item: 'Shield Charm' },
        status: 'active',
        canTagSpend: false,
      },
      {
        id: 'q4',
        title: 'Coffee Conscious',
        narrative: 'Skip buying coffee out for one week.',
        type: 'challenge',
        progress: 7,
        target: 7,
        rewards: { xp: 75, essence: 35 },
        status: 'completed',
      },
      {
        id: 'q5',
        title: 'Weekly Warrior',
        narrative: 'Stay under budget for an entire week.',
        type: 'weekly',
        progress: 5,
        target: 7,
        rewards: { xp: 150, gold: 100 },
        status: 'active',
        canTagSpend: false,
      },
    ],
  };
}
