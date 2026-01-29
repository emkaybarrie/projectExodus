// QuestHeader Part — WO-2: Quests screen header
// Shows tabs for Active/Completed quests and summary stats

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.QuestHeader', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-QuestHeader QuestHeader';

  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  let currentTab = 'active';

  // Bind tab interactions
  const tabs = root.querySelectorAll('.QuestHeader__tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      if (tabId === currentTab) return;

      currentTab = tabId;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));

      if (ctx.emitter) {
        ctx.emitter.emit('questTabChange', { tab: tabId });
      }
    });
  });

  // Initial render
  render(root, data);

  return {
    unmount() {
      root.remove();
    },
    update(newData) {
      render(root, newData);
    },
  };
}

function render(root, data) {
  const { activeCount = 0, completedCount = 0, dailyProgress = 0 } = data;

  const activeCountEl = root.querySelector('[data-bind="activeCount"]');
  const completedCountEl = root.querySelector('[data-bind="completedCount"]');
  const dailyProgressEl = root.querySelector('[data-bind="dailyProgress"]');

  if (activeCountEl) activeCountEl.textContent = activeCount;
  if (completedCountEl) completedCountEl.textContent = completedCount;
  if (dailyProgressEl) dailyProgressEl.textContent = `${dailyProgress}%`;
}
