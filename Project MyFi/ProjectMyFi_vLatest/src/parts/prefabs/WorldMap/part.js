// WorldMap Part — Compact Status Bar HUD
// Icon-driven panels: Location | Loadout
// Tap panels to open detail modals (stubbed)

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.WorldMap', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-WorldMap WorldMap';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Internal state
  const state = {
    distance01: 0,
    distanceBand: { id: 'city', label: 'City' },
    loadout: {
      skills: [
        { slot: 1, id: 'strike', name: 'Strike', icon: '&#9876;' },
        { slot: 2, id: 'guard', name: 'Guard', icon: '&#128737;' },
        { slot: 3, id: null, name: 'Empty', icon: '&#10133;' },
      ],
    },
  };

  // Initial render
  render(root, state);

  // Bind click handlers
  bindInteractions(root, state, ctx);

  // Subscribe to state changes
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    // Subscribe to distance updates
    unsubscribers.push(
      ctx.actionBus.subscribe('distance:updated', (data) => {
        state.distance01 = data.distance01;
        state.distanceBand = data.distanceBand || { id: 'city', label: 'City' };
        render(root, state);
      }, 'worldMap')
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
      if (newData.worldMap) {
        Object.assign(state, newData.worldMap);
        render(root, state);
      }
    },
  };
}

function render(root, state) {
  // Update zone label
  const zoneLabelEl = root.querySelector('[data-bind="zoneLabel"]');
  if (zoneLabelEl) {
    const bandLabel = state.distanceBand?.label || state.distanceBand || 'City';
    zoneLabelEl.textContent = bandLabel;
  }

  // Update distance label
  const distanceLabelEl = root.querySelector('[data-bind="distanceLabel"]');
  if (distanceLabelEl) {
    const leagues = Math.round(state.distance01 * 10);
    distanceLabelEl.textContent = leagues === 0 ? 'Home' : `${leagues} leagues`;
  }

  // Update location icon based on zone
  const panelIconEl = root.querySelector('.WorldMap__panelIcon');
  if (panelIconEl) {
    const icon = state.distance01 < 0.2 ? '&#127984;' : '&#129517;'; // Castle or compass
    panelIconEl.innerHTML = icon;
  }

  // Update loadout icons
  const loadoutIconsEl = root.querySelector('[data-bind="loadoutIcons"]');
  if (loadoutIconsEl) {
    loadoutIconsEl.innerHTML = state.loadout.skills.map(skill => `
      <span class="WorldMap__loadoutIcon ${skill.id ? '' : 'WorldMap__loadoutIcon--empty'}">${skill.icon}</span>
    `).join('');
  }
}

function bindInteractions(root, state, ctx) {
  const container = root.querySelector('.WorldMap__container');
  if (!container) return;

  container.addEventListener('click', (e) => {
    // Location panel tap
    const locationPanel = e.target.closest('[data-action="openLocationModal"]');
    if (locationPanel) {
      console.log('[WorldMap] Location panel tapped - modal stub');
      // TODO: Emit event to open location modal
      if (ctx.actionBus) {
        ctx.actionBus.emit('ui:requestModal', { type: 'location' });
      }
      return;
    }

    // Loadout panel tap
    const loadoutPanel = e.target.closest('[data-action="openLoadoutModal"]');
    if (loadoutPanel) {
      console.log('[WorldMap] Loadout panel tapped - modal stub');
      // TODO: Emit event to open loadout modal
      if (ctx.actionBus) {
        ctx.actionBus.emit('ui:requestModal', { type: 'loadout' });
      }
      return;
    }
  });
}
