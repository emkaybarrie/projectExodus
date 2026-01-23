// VitalsHUD Part — Displays H/M/S/Essence bars with view mode toggle
// Part of I1-Hub-Phase1-Scaffold
// Contract: /The Forge/myfi/specs/parts/contracts/VITALSHUD_CONTRACT.md

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.VitalsHUD', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-VitalsHUD VitalsHUD';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Bind interactions
  bindInteractions(root, data, ctx);

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

function bindInteractions(root, data, ctx) {
  const { emitter } = ctx;

  // View mode toggle buttons
  const toggleBtns = root.querySelectorAll('.VitalsHUD__toggleBtn');
  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (emitter && mode) {
        emitter.emit('setViewMode', { mode });
      }
    });
  });

  // Vital bar clicks — emit openVitalDetail (optional per contract §4)
  const vitalEls = root.querySelectorAll('.VitalsHUD__vital');
  vitalEls.forEach((el) => {
    el.addEventListener('click', () => {
      const vital = el.dataset.vital;
      if (emitter && vital) {
        emitter.emit('openVitalDetail', { vital });
      }
    });
  });
}

function render(root, data) {
  const { vitals = {}, viewMode = 'daily' } = data;

  // Update view mode toggle active state
  const toggleBtns = root.querySelectorAll('.VitalsHUD__toggleBtn');
  toggleBtns.forEach((btn) => {
    const isActive = btn.dataset.mode === viewMode;
    btn.classList.toggle('VitalsHUD__toggleBtn--active', isActive);
  });

  // Render each vital bar
  renderVital(root, 'health', vitals.health);
  renderVital(root, 'mana', vitals.mana);
  renderVital(root, 'stamina', vitals.stamina);
  renderEssence(root, vitals.essence);
}

function renderVital(root, vitalName, pool) {
  const el = root.querySelector(`.VitalsHUD__vital--${vitalName}`);
  if (!el) return;

  const { current = 0, max = 100 } = pool || {};
  const percent = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;

  const fill = el.querySelector('.VitalsHUD__barFill');
  if (fill) {
    fill.style.width = `${percent}%`;
  }

  const valueEl = el.querySelector('.VitalsHUD__vitalValue');
  if (valueEl) {
    valueEl.textContent = `${formatNumber(current)} / ${formatNumber(max)}`;
  }
}

function renderEssence(root, pool) {
  const el = root.querySelector('.VitalsHUD__vital--essence');
  if (!el) return;

  const { current = 0, softCap } = pool || {};
  // Essence doesn't have a hard max; display current (and softCap if present)
  const fill = el.querySelector('.VitalsHUD__barFill');
  if (fill) {
    // For essence, show relative to softCap if available, else use a reasonable default
    const displayMax = softCap || Math.max(current, 1000);
    const percent = Math.min(100, Math.max(0, (current / displayMax) * 100));
    fill.style.width = `${percent}%`;
  }

  const valueEl = el.querySelector('.VitalsHUD__vitalValue');
  if (valueEl) {
    if (softCap != null) {
      valueEl.textContent = `${formatNumber(current)} / ${formatNumber(softCap)}`;
    } else {
      valueEl.textContent = formatNumber(current);
    }
  }
}

function formatNumber(n) {
  if (n == null) return '—';
  if (typeof n !== 'number') return String(n);
  // Round to 1 decimal if non-integer
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}
