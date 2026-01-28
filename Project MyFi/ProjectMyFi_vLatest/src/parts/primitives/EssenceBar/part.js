// EssenceBar Part — HUB-E3: Bottom Essence Continuation Card
// Shows essence vital as a slim bar at the bottom of the viewport

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.EssenceBar', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-EssenceBar EssenceBar';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Internal state
  const state = {
    essence: { current: 0, softCap: 5000, accrual: 0 },
  };

  // Initial render with data
  if (data.vitalsHud?.vitals?.essence) {
    state.essence = { ...state.essence, ...data.vitalsHud.vitals.essence };
  }
  render(root, state);

  // Subscribe to real-time state changes
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:stateChange', (hubState) => {
        if (hubState?.vitalsHud?.vitals?.essence) {
          state.essence = { ...state.essence, ...hubState.vitalsHud.vitals.essence };
          render(root, state);
        }
      })
    );
  }

  return {
    unmount() {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      root.remove();
    },
    update(newData) {
      if (newData.vitalsHud?.vitals?.essence) {
        state.essence = { ...state.essence, ...newData.vitalsHud.vitals.essence };
        render(root, state);
      }
    },
  };
}

function render(root, state) {
  const { essence } = state;
  const { current = 0, softCap = 5000, accrual = 0 } = essence;

  // Calculate fill percentage
  const displayMax = softCap || Math.max(current, 1000);
  const percent = Math.min(100, Math.max(0, (current / displayMax) * 100));

  // Update bar fill
  const fill = root.querySelector('.EssenceBar__fill');
  if (fill) {
    fill.style.width = `${percent}%`;
  }

  // Update value display
  const valueEl = root.querySelector('.EssenceBar__value');
  if (valueEl) {
    valueEl.textContent = formatCompact(current);
  }

  // Update accrual indicator
  const accrualEl = root.querySelector('.EssenceBar__accrual');
  if (accrualEl) {
    if (accrual > 0) {
      accrualEl.textContent = `+${accrual.toFixed(1)}/tick`;
      accrualEl.dataset.trend = 'positive';
    } else {
      accrualEl.textContent = '';
      accrualEl.dataset.trend = 'neutral';
    }
  }
}

function formatCompact(n) {
  if (n == null) return '—';
  if (typeof n !== 'number') return String(n);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Number.isInteger(n) ? n.toString() : n.toFixed(0);
}
