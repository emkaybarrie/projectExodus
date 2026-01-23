// StatusBar Part — Displays mode indicator (Verified/Unverified)
// Part of I1-Hub-Phase1-Scaffold
// Contract: /The Forge/myfi/specs/parts/contracts/STATUSBAR_CONTRACT.md

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.StatusBar', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-StatusBar StatusBar';
  host.appendChild(root);

  // Initial render
  render(root, data, ctx);

  return {
    unmount() {
      root.remove();
    },
    // Allow re-render on data change
    update(newData) {
      render(root, newData, ctx);
    },
  };
}

function render(root, data, ctx) {
  const { mode = 'unverified', payCycle = {} } = data;
  const { emitter } = ctx;

  // Non-shaming labels per contract §3.3
  const modeLabel = mode === 'verified' ? 'Connected' : 'Demo Mode';
  const modeClass = mode === 'verified' ? 'StatusBar--verified' : 'StatusBar--unverified';

  // Pay cycle display (optional)
  let cycleDisplay = '';
  if (payCycle.dayOfCycle != null || payCycle.daysRemaining != null) {
    const dayText = payCycle.dayOfCycle != null ? `Day ${payCycle.dayOfCycle}` : '';
    const remainText = payCycle.daysRemaining != null ? `${payCycle.daysRemaining} days left` : '';
    const separator = dayText && remainText ? ' · ' : '';
    cycleDisplay = `<span class="StatusBar__cycle">${payCycle.label || ''}${dayText}${separator}${remainText}</span>`;
  }

  root.className = `Part-StatusBar StatusBar ${modeClass}`;
  root.innerHTML = `
    <button class="StatusBar__mode" type="button" aria-label="Mode info">
      <span class="StatusBar__indicator"></span>
      <span class="StatusBar__label">${modeLabel}</span>
    </button>
    ${cycleDisplay}
  `;

  // Bind action: openModeInfo (optional per contract §4)
  const modeBtn = root.querySelector('.StatusBar__mode');
  if (modeBtn && emitter) {
    modeBtn.addEventListener('click', () => {
      emitter.emit('openModeInfo', { currentMode: mode });
    });
  }
}
