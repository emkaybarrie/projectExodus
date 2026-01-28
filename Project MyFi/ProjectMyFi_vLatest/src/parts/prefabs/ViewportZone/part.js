// ViewportZone Part — HUB-19/HUB-20: Unified Wardwatch + Encounter viewport
// Single coherent zone: world patrol when idle, encounter when active
// Implements viewportMode ("world" | "encounter") for UX control

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

// HUB-20: Encounter duration (60 seconds)
const ENCOUNTER_DURATION_MS = 60000;

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.ViewportZone', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-ViewportZone ViewportZone';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Internal state
  const state = {
    // World simulation state (from Wardwatch)
    avatarPosition: { x: 50, y: 60 },
    worldState: 'quiet',
    timeOfDay: 'day',
    lastActivity: 'Watching the Badlands...',
    timeTicks: 0,

    // Encounter state (from hubController)
    encounterState: 'idle', // idle | active_autobattler | active_turn_based | resolved
    currentEncounter: null,

    // HUB-20: Viewport mode (UI-only)
    viewportMode: 'world', // world | encounter

    // HUB-20: Encounter timer
    encounterStartedAt: null,
    encounterRemainingMs: 0,
  };

  // Bind interactions
  bindInteractions(root, state, ctx);

  // Subscribe to ActionBus events
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    // Encounter spawn
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:spawn', (encounter) => {
        state.encounterState = 'active_autobattler';
        state.currentEncounter = encounter;
        state.encounterStartedAt = Date.now();
        state.encounterRemainingMs = ENCOUNTER_DURATION_MS;
        // Default: stay in world mode, show banner
        state.viewportMode = 'world';
        render(root, state);
        startEncounterTimer(root, state, ctx);
      })
    );

    // Encounter resolve
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:resolve', () => {
        state.encounterState = 'resolved';
        state.viewportMode = 'world';
        render(root, state);
        // Auto-transition to idle
        setTimeout(() => {
          if (state.encounterState === 'resolved') {
            state.encounterState = 'idle';
            state.currentEncounter = null;
            state.encounterStartedAt = null;
            render(root, state);
          }
        }, 1500);
      })
    );

    // Hub state changes
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:escalated', () => {
        state.encounterState = 'active_turn_based';
        render(root, state);
      })
    );

    unsubscribers.push(
      ctx.actionBus.subscribe('hub:deescalated', () => {
        if (state.currentEncounter) {
          state.encounterState = 'active_autobattler';
        } else {
          state.encounterState = 'idle';
        }
        render(root, state);
      })
    );

    unsubscribers.push(
      ctx.actionBus.subscribe('escalation:exit', () => {
        if (state.currentEncounter) {
          state.encounterState = 'active_autobattler';
          // Return to encounter view after exiting turn-based
          state.viewportMode = 'encounter';
        } else {
          state.encounterState = 'idle';
          state.viewportMode = 'world';
        }
        render(root, state);
      })
    );

    unsubscribers.push(
      ctx.actionBus.subscribe('hub:encounterCleared', () => {
        state.encounterState = 'idle';
        state.currentEncounter = null;
        state.viewportMode = 'world';
        state.encounterStartedAt = null;
        render(root, state);
      })
    );
  }

  // Initial render
  render(root, state);

  // Start world simulation
  const simulation = createWorldSimulation(root, state, ctx);
  simulation.start();

  // Encounter timer interval
  let timerIntervalId = null;

  function startEncounterTimer(root, state, ctx) {
    if (timerIntervalId) clearInterval(timerIntervalId);

    timerIntervalId = setInterval(() => {
      if (!state.encounterStartedAt || state.encounterState !== 'active_autobattler') {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
        return;
      }

      const elapsed = Date.now() - state.encounterStartedAt;
      state.encounterRemainingMs = Math.max(0, ENCOUNTER_DURATION_MS - elapsed);

      // Update timer display
      updateTimerDisplay(root, state);

      // HUB-20: Auto-resolve at 0
      if (state.encounterRemainingMs <= 0 && state.encounterState === 'active_autobattler') {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
        // Trigger auto-resolve via hubController
        if (window.__MYFI_DEBUG__?.hubController?.getAutobattler) {
          const autobattler = window.__MYFI_DEBUG__.hubController.getAutobattler();
          if (autobattler && autobattler.forceResolve) {
            autobattler.forceResolve();
          }
        }
      }
    }, 1000);
  }

  return {
    unmount() {
      simulation.stop();
      if (timerIntervalId) clearInterval(timerIntervalId);
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      root.remove();
    },
    update(newData) {
      // Merge in hub state if provided
      if (newData.encounterState) {
        state.encounterState = newData.encounterState;
      }
      if (newData.encounterWindow?.encounter) {
        state.currentEncounter = newData.encounterWindow.encounter;
      }
      render(root, state);
    },
    getSimulation() {
      return simulation;
    },
    // HUB-20: External API
    setViewportMode(mode) {
      state.viewportMode = mode;
      render(root, state);
    },
    getViewportMode() {
      return state.viewportMode;
    },
  };
}

function bindInteractions(root, state, ctx) {
  const { emitter, actionBus } = ctx;

  // "View Encounter" button
  const viewEncounterBtn = root.querySelector('[data-action="viewEncounter"]');
  if (viewEncounterBtn) {
    viewEncounterBtn.addEventListener('click', () => {
      state.viewportMode = 'encounter';
      render(root, state);
      // Log for EventLog
      if (emitter) {
        emitter.emit('viewport:modeChange', { mode: 'encounter' });
      }
    });
  }

  // "Enter Turn-Based" button
  const enterTurnBasedBtn = root.querySelector('[data-action="enterTurnBased"]');
  if (enterTurnBasedBtn) {
    enterTurnBasedBtn.addEventListener('click', () => {
      if (state.encounterState === 'active_autobattler' && state.currentEncounter) {
        // Emit escalate event
        if (emitter) {
          emitter.emit('encounter:escalate', {
            encounterId: state.currentEncounter.id,
            encounter: state.currentEncounter,
          });
        }
      }
    });
  }

  // "Exit to World" button
  const exitBtn = root.querySelector('[data-action="exitEncounterView"]');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      state.viewportMode = 'world';
      render(root, state);
      if (emitter) {
        emitter.emit('viewport:modeChange', { mode: 'world' });
      }
    });
  }
}

function render(root, state) {
  const { viewportMode, encounterState, currentEncounter } = state;

  // Determine which layers are visible
  const worldLayer = root.querySelector('[data-layer="world"]');
  const encounterLayer = root.querySelector('[data-layer="encounter"]');
  const encounterBanner = root.querySelector('.ViewportZone__encounterBanner');

  const showWorldLayer = viewportMode === 'world';
  const showEncounterLayer = viewportMode === 'encounter';
  const showBanner = viewportMode === 'world' &&
    (encounterState === 'active_autobattler' || encounterState === 'active_turn_based') &&
    currentEncounter;

  if (worldLayer) {
    worldLayer.dataset.visible = showWorldLayer ? 'true' : 'false';
    worldLayer.style.display = showWorldLayer ? 'block' : 'none';
  }

  if (encounterLayer) {
    encounterLayer.dataset.visible = showEncounterLayer ? 'true' : 'false';
  }

  if (encounterBanner) {
    encounterBanner.dataset.visible = showBanner ? 'true' : 'false';
  }

  // Update world state display
  renderWorldState(root, state);

  // Update encounter display
  if (currentEncounter) {
    renderEncounter(root, state, currentEncounter);
  }

  // Update timer
  updateTimerDisplay(root, state);
}

function renderWorldState(root, state) {
  const { avatarPosition, worldState, timeOfDay, lastActivity, currentEncounter } = state;

  // Update viewport time state
  const viewport = root.querySelector('.ViewportZone__viewport');
  if (viewport) {
    viewport.dataset.time = timeOfDay;
  }

  // Update avatar position
  const avatar = root.querySelector('.ViewportZone__avatar');
  if (avatar) {
    avatar.style.left = `${avatarPosition.x}%`;
    avatar.style.top = `${avatarPosition.y}%`;
  }

  // Update world state message
  const stateMessage = root.querySelector('[data-bind="stateMessage"]');
  if (stateMessage) {
    stateMessage.textContent = getWorldStateMessage(worldState, currentEncounter);
  }

  // Update time indicator
  const timeLabel = root.querySelector('[data-bind="timeLabel"]');
  const timeIcon = root.querySelector('.ViewportZone__timeIcon');
  if (timeLabel) {
    timeLabel.textContent = getTimeLabel(timeOfDay);
  }
  if (timeIcon) {
    timeIcon.innerHTML = getTimeIcon(timeOfDay);
  }

  // Update activity
  const activityText = root.querySelector('[data-bind="activityText"]');
  if (activityText) {
    activityText.textContent = lastActivity;
  }
}

function renderEncounter(root, state, encounter) {
  // Banner content
  const bannerIcon = root.querySelector('[data-bind="encounterIcon"]');
  const bannerSummary = root.querySelector('[data-bind="encounterSummary"]');

  if (bannerIcon) {
    bannerIcon.innerHTML = encounter.icon || '&#128123;';
  }
  if (bannerSummary) {
    bannerSummary.textContent = encounter.summary || `${encounter.label || encounter.type} appears!`;
  }

  // Encounter view content
  const encounterIconLarge = root.querySelector('[data-bind="encounterIconLarge"]');
  const encounterName = root.querySelector('[data-bind="encounterName"]');
  const encounterType = root.querySelector('[data-bind="encounterType"]');
  const encounterSprite = root.querySelector('[data-bind="encounterSprite"]');

  if (encounterIconLarge) {
    encounterIconLarge.innerHTML = encounter.icon || '&#128123;';
  }
  if (encounterName) {
    encounterName.textContent = encounter.label || encounter.type || 'Unknown Encounter';
  }
  if (encounterType) {
    encounterType.textContent = encounter.severity || encounter.type || 'Encounter';
  }
  if (encounterSprite) {
    encounterSprite.innerHTML = encounter.icon || '&#128123;';
  }
}

function updateTimerDisplay(root, state) {
  const { encounterRemainingMs, encounterState } = state;

  const remainingSec = Math.ceil(encounterRemainingMs / 1000);
  const percent = (encounterRemainingMs / ENCOUNTER_DURATION_MS) * 100;

  // Banner timer
  const timerFill = root.querySelector('[data-bind="timerFill"]');
  const timerText = root.querySelector('[data-bind="timerText"]');

  if (timerFill) {
    timerFill.style.width = `${percent}%`;
  }
  if (timerText) {
    timerText.textContent = `${remainingSec}s`;
  }

  // Encounter view timer
  const timerValue = root.querySelector('[data-bind="timerValue"]');
  if (timerValue) {
    timerValue.textContent = remainingSec;
  }

  // Update autobattler status indicator
  const statusIndicator = root.querySelector('.ViewportZone__statusIndicator');
  if (statusIndicator) {
    statusIndicator.dataset.active = encounterState === 'active_autobattler' ? 'true' : 'false';
  }
}

function getWorldStateMessage(worldState, encounter) {
  if (encounter && !encounter.resolved) {
    return `Encounter active: ${encounter.label || encounter.type || 'Unknown'}`;
  }
  switch (worldState) {
    case 'quiet': return 'All quiet...';
    case 'stirring': return 'Something stirs...';
    case 'active': return 'Activity detected!';
    case 'dangerous': return 'Danger approaches!';
    default: return 'Watching...';
  }
}

function getTimeLabel(time) {
  switch (time) {
    case 'day': return 'Day';
    case 'dusk': return 'Dusk';
    case 'night': return 'Night';
    default: return 'Day';
  }
}

function getTimeIcon(time) {
  switch (time) {
    case 'day': return '&#9788;';
    case 'dusk': return '&#127773;';
    case 'night': return '&#127769;';
    default: return '&#9788;';
  }
}

function createWorldSimulation(root, state, ctx) {
  let timerId = null;
  const TICK_MS = 2000;

  const activities = [
    'Scanning the horizon...',
    'Watching the Badlands...',
    'Patrolling the perimeter...',
    'Sensing the terrain...',
    'Moving through shadows...',
    'Observing movement...',
    'Resting briefly...',
    'Alert and ready...',
  ];

  function tick() {
    state.timeTicks++;

    // Autonomous avatar movement
    moveAvatar(state);

    // Time progression (every 10 ticks)
    if (state.timeTicks % 10 === 0) {
      progressTime(state);
    }

    // World state fluctuation
    if (Math.random() < 0.15 && !state.currentEncounter) {
      updateWorldState(state);
    }

    // Random activity update
    if (Math.random() < 0.2) {
      state.lastActivity = activities[Math.floor(Math.random() * activities.length)];
    }

    // Render
    renderWorldState(root, state);

    // Emit tick for other systems
    if (ctx.emitter) {
      ctx.emitter.emit('wardwatch:tick', {
        tick: state.timeTicks,
        worldState: state.worldState,
        timeOfDay: state.timeOfDay,
      });
    }
  }

  function moveAvatar(state) {
    const deltaX = (Math.random() - 0.5) * 15;
    const deltaY = (Math.random() - 0.5) * 8;

    state.avatarPosition.x = Math.max(15, Math.min(85, state.avatarPosition.x + deltaX));
    state.avatarPosition.y = Math.max(45, Math.min(75, state.avatarPosition.y + deltaY));

    const avatar = root.querySelector('.ViewportZone__avatar');
    if (avatar) {
      avatar.dataset.moving = 'true';
      setTimeout(() => {
        avatar.dataset.moving = 'false';
      }, 800);
    }
  }

  function progressTime(state) {
    const timeSequence = ['day', 'dusk', 'night', 'day'];
    const currentIndex = timeSequence.indexOf(state.timeOfDay);
    state.timeOfDay = timeSequence[(currentIndex + 1) % 3] || 'day';
  }

  function updateWorldState(state) {
    const states = ['quiet', 'quiet', 'quiet', 'stirring', 'active'];
    const weights = state.timeOfDay === 'night' ? ['quiet', 'stirring', 'stirring', 'active', 'dangerous'] : states;
    state.worldState = weights[Math.floor(Math.random() * weights.length)];
  }

  return {
    start() {
      if (timerId) return;
      timerId = setInterval(tick, TICK_MS);
      tick();
    },
    stop() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    },
    getState() {
      return { ...state };
    },
    spawnEncounter(encounter) {
      state.currentEncounter = encounter;
      state.worldState = 'active';
      state.lastActivity = `Encounter spawned: ${encounter.type}`;
      renderWorldState(root, state);
    },
    resolveEncounter(outcome) {
      if (state.currentEncounter) {
        state.currentEncounter.resolved = true;
        state.lastActivity = `Resolved: ${outcome.summary || 'Victory'}`;
        state.worldState = 'quiet';
        renderWorldState(root, state);
        setTimeout(() => {
          state.currentEncounter = null;
        }, 3000);
      }
    },
  };
}
