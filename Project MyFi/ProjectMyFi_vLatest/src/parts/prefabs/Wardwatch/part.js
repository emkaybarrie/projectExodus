// Wardwatch Part — Badlands Viewport & Autonomous Simulation
// HUB-03: Wardwatch — Badlands Viewport & Simulation

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.Wardwatch', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-Wardwatch Wardwatch';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Initialize simulation state
  const simState = {
    avatarPosition: { x: 50, y: 60 },
    worldState: 'quiet',
    timeOfDay: 'day',
    lastActivity: 'Watching the Badlands...',
    timeTicks: 0,
    encounter: null,
  };

  // Initial render
  render(root, { ...data, ...simState });

  // Start autonomous simulation
  const simulation = createSimulation(root, simState, ctx);
  simulation.start();

  return {
    unmount() {
      simulation.stop();
      root.remove();
    },
    update(newData) {
      Object.assign(simState, newData);
      render(root, simState);
    },
    getSimulation() {
      return simulation;
    },
  };
}

function render(root, data) {
  const {
    avatarPosition = { x: 50, y: 60 },
    worldState = 'quiet',
    timeOfDay = 'day',
    lastActivity = 'Watching the Badlands...',
    encounter = null,
  } = data;

  // Update viewport time state
  const viewport = root.querySelector('.Wardwatch__viewport');
  if (viewport) {
    viewport.dataset.time = timeOfDay;
  }

  // Update avatar position
  const avatar = root.querySelector('.Wardwatch__avatar');
  if (avatar) {
    avatar.style.left = `${avatarPosition.x}%`;
    avatar.style.top = `${avatarPosition.y}%`;
  }

  // Update world state message
  const stateMessage = root.querySelector('[data-bind="stateMessage"]');
  if (stateMessage) {
    stateMessage.textContent = getWorldStateMessage(worldState, encounter);
  }

  // Update time indicator
  const timeLabel = root.querySelector('[data-bind="timeLabel"]');
  const timeIcon = root.querySelector('.Wardwatch__timeIcon');
  if (timeLabel) {
    timeLabel.textContent = getTimeLabel(timeOfDay);
  }
  if (timeIcon) {
    timeIcon.innerHTML = getTimeIcon(timeOfDay);
  }

  // Update activity
  const activityText = root.querySelector('.Wardwatch__activityText');
  if (activityText) {
    activityText.textContent = lastActivity;
  }
}

function getWorldStateMessage(state, encounter) {
  if (encounter && !encounter.resolved) {
    return `Encounter: ${encounter.type || 'Unknown'}`;
  }
  switch (state) {
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
    case 'day': return '&#9788;';    // Sun
    case 'dusk': return '&#127773;'; // Sunset
    case 'night': return '&#127769;'; // Moon
    default: return '&#9788;';
  }
}

function createSimulation(root, state, ctx) {
  let timerId = null;
  const TICK_MS = 2000; // Simulation tick every 2 seconds

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

    // Autonomous avatar movement (wander)
    moveAvatar(root, state);

    // Time progression (every 10 ticks = time change)
    if (state.timeTicks % 10 === 0) {
      progressTime(state);
    }

    // World state fluctuation (random)
    if (Math.random() < 0.15) {
      updateWorldState(state);
    }

    // Random activity update
    if (Math.random() < 0.2) {
      state.lastActivity = activities[Math.floor(Math.random() * activities.length)];
    }

    // Render updates
    render(root, state);

    // HUB-13: Emit via scoped emitter for proper source attribution
    if (ctx.emitter) {
      ctx.emitter.emit('wardwatch:tick', {
        tick: state.timeTicks,
        worldState: state.worldState,
        timeOfDay: state.timeOfDay,
      });
    }
  }

  function moveAvatar(root, state) {
    const avatar = root.querySelector('.Wardwatch__avatar');

    // Random wander within bounds
    const deltaX = (Math.random() - 0.5) * 15;
    const deltaY = (Math.random() - 0.5) * 8;

    state.avatarPosition.x = Math.max(15, Math.min(85, state.avatarPosition.x + deltaX));
    state.avatarPosition.y = Math.max(45, Math.min(75, state.avatarPosition.y + deltaY));

    // Set moving animation
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
      tick(); // Initial tick
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
    // Allow external encounter injection (for HUB-04)
    spawnEncounter(encounter) {
      state.encounter = encounter;
      state.worldState = 'active';
      state.lastActivity = `Encounter spawned: ${encounter.type}`;
      render(root, state);
      // HUB-13: Use scoped emitter for proper source attribution
      if (ctx.emitter) {
        ctx.emitter.emit('wardwatch:encounterSpawn', encounter);
      }
    },
    resolveEncounter(outcome) {
      if (state.encounter) {
        state.encounter.resolved = true;
        state.lastActivity = `Resolved: ${outcome.summary || 'Victory'}`;
        state.worldState = 'quiet';
        render(root, state);
        // HUB-13: Use scoped emitter for proper source attribution
        if (ctx.emitter) {
          ctx.emitter.emit('wardwatch:encounterResolve', outcome);
        }
        setTimeout(() => {
          state.encounter = null;
        }, 3000);
      }
    },
  };
}
