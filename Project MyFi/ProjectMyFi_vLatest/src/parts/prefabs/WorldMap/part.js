// WorldMap Part — HUB Refactor: Dartboard radial map with meandering avatar
// Avatar moves between zones when no encounter active

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

// Region names for each quadrant
const REGIONS = {
  north: ['Frostwind Peaks', 'Northern Reaches', 'The Frozen Wastes'],
  south: ['Sunscorch Plains', 'Southern Expanse', 'The Arid Flats'],
  east: ['Twilight Marshes', 'Eastern Glades', 'The Misty Fens'],
  west: ['Crimson Dunes', 'Western Badlands', 'The Scarred Lands'],
  center: ['Haven Outskirts', 'City Gates', 'Merchant Quarter'],
};

// Subtitles based on state
const SUBTITLES = {
  idle: ['— All quiet', '— Shadows lengthen', '— The wind whispers', '— Distant echoes'],
  encounter: ['— Something stirs...', '— Danger approaches', '— Stay alert'],
};

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
    avatarX: 40,
    avatarY: -25,
    currentRegion: 'east',
    isEncounterActive: false,
    meanderInterval: null,
  };

  // Initial render
  render(root, state);

  // Start meandering
  startMeandering(root, state);

  // Subscribe to state changes
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:stateChange', (hubState) => {
        // Update encounter state
        if (hubState?.badlandsStage?.stageMode) {
          const wasEncounter = state.isEncounterActive;
          state.isEncounterActive = hubState.badlandsStage.stageMode === 'encounter_autobattler';

          // Update avatar idle state
          const avatar = root.querySelector('.WorldMap__avatar');
          if (avatar) {
            avatar.dataset.idle = state.isEncounterActive ? 'false' : 'true';
          }

          // Update subtitle for encounter
          if (state.isEncounterActive && !wasEncounter) {
            updateSubtitle(root, 'encounter');
          } else if (!state.isEncounterActive && wasEncounter) {
            updateSubtitle(root, 'idle');
          }
        }

        // Update region name if provided
        if (hubState?.worldMap?.regionName) {
          const regionEl = root.querySelector('[data-bind="regionName"]');
          if (regionEl) regionEl.textContent = hubState.worldMap.regionName;
        }
      })
    );

    // Subscribe to encounter events (from autobattler)
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:spawn', () => {
        state.isEncounterActive = true;
        const avatar = root.querySelector('.WorldMap__avatar');
        if (avatar) avatar.dataset.idle = 'false';
        updateSubtitle(root, 'encounter');
      })
    );

    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:resolve', () => {
        state.isEncounterActive = false;
        const avatar = root.querySelector('.WorldMap__avatar');
        if (avatar) avatar.dataset.idle = 'true';
        updateSubtitle(root, 'idle');
      })
    );
  }

  return {
    unmount() {
      // Stop meandering
      if (state.meanderInterval) {
        clearInterval(state.meanderInterval);
        state.meanderInterval = null;
      }
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      root.remove();
    },
    update(newData) {
      if (newData.worldMap?.regionName) {
        const regionEl = root.querySelector('[data-bind="regionName"]');
        if (regionEl) regionEl.textContent = newData.worldMap.regionName;
      }
    },
  };
}

function render(root, state) {
  updateAvatarPosition(root, state);
  updateRegionInfo(root, state);
}

function updateAvatarPosition(root, state) {
  const avatar = root.querySelector('.WorldMap__avatar');
  if (avatar) {
    avatar.style.setProperty('--avatar-x', `${state.avatarX}px`);
    avatar.style.setProperty('--avatar-y', `${state.avatarY}px`);
  }
}

function updateRegionInfo(root, state) {
  const regionEl = root.querySelector('[data-bind="regionName"]');
  if (regionEl) {
    const regions = REGIONS[state.currentRegion] || REGIONS.center;
    regionEl.textContent = regions[Math.floor(Math.random() * regions.length)];
  }
  updateSubtitle(root, 'idle');
}

function updateSubtitle(root, mode) {
  const subtitleEl = root.querySelector('[data-bind="subtitle"]');
  if (subtitleEl) {
    const subtitles = SUBTITLES[mode] || SUBTITLES.idle;
    subtitleEl.textContent = subtitles[Math.floor(Math.random() * subtitles.length)];
  }
}

function startMeandering(root, state) {
  // Move avatar every 3-5 seconds
  state.meanderInterval = setInterval(() => {
    if (state.isEncounterActive) return; // Don't move during encounter

    // Pick a new position within bounds
    const angle = Math.random() * 2 * Math.PI;
    const radius = 20 + Math.random() * 50; // 20-70px from center

    state.avatarX = Math.cos(angle) * radius;
    state.avatarY = Math.sin(angle) * radius;

    // Determine current region based on position
    if (Math.abs(state.avatarX) < 15 && Math.abs(state.avatarY) < 15) {
      state.currentRegion = 'center';
    } else if (state.avatarY < -10 && Math.abs(state.avatarX) < Math.abs(state.avatarY)) {
      state.currentRegion = 'north';
    } else if (state.avatarY > 10 && Math.abs(state.avatarX) < Math.abs(state.avatarY)) {
      state.currentRegion = 'south';
    } else if (state.avatarX > 10) {
      state.currentRegion = 'east';
    } else if (state.avatarX < -10) {
      state.currentRegion = 'west';
    }

    updateAvatarPosition(root, state);

    // Occasionally update region name (not every move)
    if (Math.random() > 0.6) {
      updateRegionInfo(root, state);
    }
  }, 3000 + Math.random() * 2000);
}
