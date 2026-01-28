// PlayerCore Part — Avatar & Status Indicators
// HUB-02: Player Core — Vitals & Avatar

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.PlayerCore', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-PlayerCore PlayerCore';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

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
  const {
    name = 'Wanderer',
    title = 'of the Badlands',
    pressure = 'balanced', // 'ahead' | 'behind' | 'balanced'
    momentum = 'steady',   // 'rising' | 'falling' | 'steady'
    effects = [],
  } = data;

  // Update name and title
  const nameEl = root.querySelector('[data-bind="name"]');
  if (nameEl) nameEl.textContent = name;

  const titleEl = root.querySelector('[data-bind="title"]');
  if (titleEl) titleEl.textContent = title;

  // Update pressure status
  const pressureItem = root.querySelector('.PlayerCore__statusItem--pressure');
  if (pressureItem) {
    pressureItem.dataset.state = pressure;
    const pressureLabel = pressureItem.querySelector('[data-bind="pressureLabel"]');
    if (pressureLabel) {
      pressureLabel.textContent = getPressureLabel(pressure);
    }
  }

  // Update momentum status
  const momentumItem = root.querySelector('.PlayerCore__statusItem--momentum');
  if (momentumItem) {
    momentumItem.dataset.state = momentum;
    const momentumLabel = momentumItem.querySelector('[data-bind="momentumLabel"]');
    if (momentumLabel) {
      momentumLabel.textContent = getMomentumLabel(momentum);
    }
  }

  // Update effects
  const effectsEl = root.querySelector('[data-bind="effects"]');
  if (effectsEl) {
    effectsEl.innerHTML = effects.map(effect => `
      <div class="PlayerCore__effect">
        <span class="PlayerCore__effectIcon">${effect.icon || '&#10024;'}</span>
        <span class="PlayerCore__effectLabel">${effect.label}</span>
      </div>
    `).join('');
  }
}

function getPressureLabel(pressure) {
  switch (pressure) {
    case 'ahead': return 'Ahead';
    case 'behind': return 'Behind';
    case 'balanced': return 'Balanced';
    default: return 'Unknown';
  }
}

function getMomentumLabel(momentum) {
  switch (momentum) {
    case 'rising': return 'Rising';
    case 'falling': return 'Falling';
    case 'steady': return 'Steady';
    default: return 'Unknown';
  }
}
