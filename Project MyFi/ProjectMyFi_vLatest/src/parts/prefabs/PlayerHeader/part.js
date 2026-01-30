// PlayerHeader Part — HUB-18: Compact merged header
// Combines: StatusBar + PlayerCore + VitalsHUD into a single compact row
// Does NOT duplicate logic; uses same VM fields as original parts

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.PlayerHeader', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-PlayerHeader PlayerHeader';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Bind interactions
  bindInteractions(root, ctx);

  // Initial render
  render(root, data);

  // HUB-25: Subscribe to real-time state changes for vitals binding
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:stateChange', (hubState) => {
        render(root, hubState);
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
      render(root, newData);
    },
  };
}

function bindInteractions(root, ctx) {
  const { emitter } = ctx;

  // Mode info button
  const modeBtn = root.querySelector('[data-action="modeInfo"]');
  if (modeBtn && emitter) {
    modeBtn.addEventListener('click', () => {
      emitter.emit('openModeInfo', {});
    });
  }

  // Vital bar clicks
  const vitalEls = root.querySelectorAll('.PlayerHeader__vital');
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
  // Extract data from combined VM sources
  // StatusBar fields
  const { mode = 'unverified', payCycle = {} } = data;
  // PlayerCore fields
  const {
    name = 'Wanderer',
    title = 'of the Badlands',
    pressure = 'balanced',
    momentum = 'steady',
    portraitUrl = null,
  } = data.playerCore || data;
  // VitalsHUD fields
  const { vitals = {} } = data.vitalsHud || data;

  // Render portrait (illustrated avatar)
  renderPortrait(root, portraitUrl);

  // Render status line
  renderStatusLine(root, mode, payCycle);

  // Render identity
  renderIdentity(root, name, title, pressure, momentum);

  // Render vitals
  renderVitals(root, vitals);

  // Render essence (now in PlayerHeader)
  renderEssence(root, vitals.essence);
}

function renderPortrait(root, portraitUrl) {
  const portraitEl = root.querySelector('.PlayerHeader__portrait');
  if (!portraitEl) return;

  // Default fallback path (relative to part location)
  const defaultUrl = new URL('../../../../assets/art/portraits/default.svg', import.meta.url).href;
  const targetUrl = portraitUrl || defaultUrl;

  // Only update if changed
  if (portraitEl.src !== targetUrl) {
    portraitEl.src = targetUrl;

    // Handle load errors with fallback + console warning
    portraitEl.onerror = () => {
      console.warn(`[PlayerHeader] Portrait asset not found: ${targetUrl}, using fallback`);
      if (portraitEl.src !== defaultUrl) {
        portraitEl.src = defaultUrl;
      }
    };
  }
}

function renderStatusLine(root, mode, payCycle) {
  const modeLabel = root.querySelector('[data-bind="modeLabel"]');
  const modeIndicator = root.querySelector('.PlayerHeader__modeIndicator');
  const cycleInfo = root.querySelector('[data-bind="cycleInfo"]');

  if (modeLabel) {
    modeLabel.textContent = mode === 'verified' ? 'Connected' : 'Demo Mode';
  }
  if (modeIndicator) {
    modeIndicator.dataset.verified = mode === 'verified' ? 'true' : 'false';
  }

  if (cycleInfo) {
    let cycleText = '';
    if (payCycle.dayOfCycle != null || payCycle.daysRemaining != null) {
      const dayText = payCycle.dayOfCycle != null ? `Day ${payCycle.dayOfCycle}` : '';
      const remainText = payCycle.daysRemaining != null ? `${payCycle.daysRemaining}d left` : '';
      const separator = dayText && remainText ? ' · ' : '';
      cycleText = `${payCycle.label || ''}${dayText}${separator}${remainText}`;
    }
    cycleInfo.textContent = cycleText;
  }
}

function renderIdentity(root, name, title, pressure, momentum) {
  const nameEl = root.querySelector('[data-bind="name"]');
  const titleEl = root.querySelector('[data-bind="title"]');

  if (nameEl) nameEl.textContent = name;
  if (titleEl) titleEl.textContent = title;

  // Pressure chip
  const pressureChip = root.querySelector('.PlayerHeader__chip--pressure');
  const pressureLabel = root.querySelector('[data-bind="pressureLabel"]');
  if (pressureChip) {
    pressureChip.dataset.state = pressure;
  }
  if (pressureLabel) {
    pressureLabel.textContent = getPressureLabel(pressure);
  }

  // Momentum chip
  const momentumChip = root.querySelector('.PlayerHeader__chip--momentum');
  const momentumLabel = root.querySelector('[data-bind="momentumLabel"]');
  if (momentumChip) {
    momentumChip.dataset.state = momentum;
  }
  if (momentumLabel) {
    momentumLabel.textContent = getMomentumLabel(momentum);
  }
}

function renderVitals(root, vitals) {
  // HUB-E3: Essence moved to bottom EssenceBar card
  renderVitalBar(root, 'health', vitals.health);
  renderVitalBar(root, 'mana', vitals.mana);
  renderVitalBar(root, 'stamina', vitals.stamina);
}

function renderVitalBar(root, vitalName, pool) {
  const el = root.querySelector(`.PlayerHeader__vital--${vitalName}`);
  if (!el) return;

  const { current = 0, max = 100 } = pool || {};
  const percent = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;

  const fill = el.querySelector('.PlayerHeader__barFill');
  if (fill) {
    fill.style.width = `${percent}%`;
  }

  const valueEl = el.querySelector('.PlayerHeader__vitalValue');
  if (valueEl) {
    // Full display: current / max (like reference UI)
    valueEl.textContent = `${formatCompact(current)} / ${formatCompact(max)}`;
  }
}

function renderEssence(root, pool) {
  const { current = 0, softCap = 5000, accrual = 0 } = pool || {};
  const displayMax = softCap || Math.max(current, 1000);
  const percent = Math.min(100, Math.max(0, (current / displayMax) * 100));

  // Update fill bar
  const fill = root.querySelector('.PlayerHeader__essenceBarFill');
  if (fill) {
    fill.style.width = `${percent}%`;
  }

  // Update value display
  const valueEl = root.querySelector('[data-bind="essenceValue"]');
  if (valueEl) {
    valueEl.textContent = formatCompact(current);
  }

  // Update accrual display
  const accrualEl = root.querySelector('[data-bind="essenceAccrual"]');
  if (accrualEl) {
    if (accrual > 0) {
      accrualEl.textContent = `+${accrual.toFixed(1)}/tick`;
    } else {
      accrualEl.textContent = '';
    }
  }
}

function formatCompact(n) {
  if (n == null) return '—';
  if (typeof n !== 'number') return String(n);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Number.isInteger(n) ? n.toString() : n.toFixed(0);
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
