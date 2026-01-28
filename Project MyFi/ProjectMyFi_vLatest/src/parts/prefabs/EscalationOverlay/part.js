// EscalationOverlay Part — Turn-Based Escalation Layer
// HUB-05: Turn-Based Escalation Layer

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

// Action definitions with costs and effects
const ACTIONS = {
  attack: {
    label: 'Strike',
    icon: '&#9876;',
    cost: { stamina: 15 },
    effect: { damage: 30, variance: 10 },
    description: 'A direct attack',
  },
  skill: {
    label: 'Channel',
    icon: '&#10024;',
    cost: { mana: 25 },
    effect: { damage: 50, variance: 15 },
    description: 'A powerful magical strike',
  },
  defend: {
    label: 'Brace',
    icon: '&#128737;',
    cost: { stamina: 5 },
    effect: { damageReduction: 0.5 },
    description: 'Reduce incoming damage',
  },
  retreat: {
    label: 'Retreat',
    icon: '&#128694;',
    cost: {},
    effect: { exitEscalation: true },
    description: 'Exit back to autobattler',
  },
};

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.EscalationOverlay', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-EscalationOverlay EscalationOverlay';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Internal state
  const state = {
    active: false,
    encounter: null,
    turn: 1,
    playerVitals: { mana: 200, stamina: 320 },
    encounterHealth: 100,
    isDefending: false,
    lastOutcome: null,
  };

  // Bind action buttons
  bindActions(root, state, ctx);

  // Initial render (hidden)
  render(root, state);

  return {
    unmount() {
      root.remove();
    },
    update(newData) {
      Object.assign(state, newData);
      render(root, state);
    },
    // External API for escalation
    escalate(encounter, vitals) {
      state.active = true;
      state.encounter = encounter;
      state.turn = 1;
      state.playerVitals = vitals || state.playerVitals;
      state.encounterHealth = 100 + (encounter.baseDifficulty || 1) * 30;
      state.isDefending = false;
      state.lastOutcome = null;
      render(root, state);

      // HUB-13: Notify escalation started (scoped emitter for source attribution)
      if (ctx.emitter) {
        ctx.emitter.emit('escalation:start', { encounter });
      }
    },
    deescalate() {
      state.active = false;
      state.encounter = null;
      state.lastOutcome = null;
      render(root, state);

      // HUB-13: Notify escalation ended (scoped emitter for source attribution)
      if (ctx.emitter) {
        ctx.emitter.emit('escalation:end', {});
      }
    },
    isActive() {
      return state.active;
    },
    getState() {
      return { ...state };
    },
  };
}

function render(root, state) {
  const container = root.querySelector('.EscalationOverlay__container');
  if (!container) return;

  // Set visibility state
  container.dataset.state = state.active ? 'active' : 'hidden';

  if (!state.active) return;

  // Update encounter info
  const encounterIcon = root.querySelector('[data-bind="encounterIcon"]');
  const encounterName = root.querySelector('[data-bind="encounterName"]');
  if (encounterIcon && state.encounter) {
    encounterIcon.innerHTML = state.encounter.icon || '&#128123;';
  }
  if (encounterName && state.encounter) {
    encounterName.textContent = state.encounter.label || 'Unknown Encounter';
  }

  // Update turn number
  const turnNumber = root.querySelector('[data-bind="turnNumber"]');
  if (turnNumber) {
    turnNumber.textContent = state.turn;
  }

  // Update action availability based on resources
  updateActionAvailability(root, state);

  // Update outcome display
  const outcomeEl = root.querySelector('[data-bind="outcome"]');
  if (outcomeEl && state.lastOutcome) {
    outcomeEl.innerHTML = state.lastOutcome;
  } else if (outcomeEl) {
    outcomeEl.innerHTML = '';
  }
}

function updateActionAvailability(root, state) {
  const vitals = state.playerVitals;

  Object.entries(ACTIONS).forEach(([actionId, action]) => {
    const btn = root.querySelector(`[data-action="${actionId}"]`);
    if (!btn) return;

    const canAfford = Object.entries(action.cost).every(([resource, amount]) => {
      return (vitals[resource] || 0) >= amount;
    });

    btn.disabled = !canAfford;
  });
}

function bindActions(root, state, ctx) {
  const actionBtns = root.querySelectorAll('[data-action]');

  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const actionId = btn.dataset.action;

      if (actionId === 'exit') {
        exitEscalation(root, state, ctx);
        return;
      }

      executeAction(actionId, root, state, ctx);
    });
  });
}

function executeAction(actionId, root, state, ctx) {
  const action = ACTIONS[actionId];
  if (!action) return;

  // Check if can afford
  const vitals = state.playerVitals;
  const canAfford = Object.entries(action.cost).every(([resource, amount]) => {
    return (vitals[resource] || 0) >= amount;
  });

  if (!canAfford) return;

  // Deduct costs
  Object.entries(action.cost).forEach(([resource, amount]) => {
    state.playerVitals[resource] = (vitals[resource] || 0) - amount;
  });

  // Execute effect
  let outcome = '';

  if (action.effect.exitEscalation) {
    exitEscalation(root, state, ctx);
    return;
  }

  if (action.effect.damage) {
    const variance = (Math.random() - 0.5) * 2 * (action.effect.variance || 0);
    const damage = Math.floor(action.effect.damage + variance);
    state.encounterHealth -= damage;
    outcome = `${action.label}! Dealt ${damage} damage.`;

    // Check for victory
    if (state.encounterHealth <= 0) {
      handleVictory(root, state, ctx);
      return;
    }
  }

  if (action.effect.damageReduction) {
    state.isDefending = true;
    outcome = `Bracing for impact. Damage reduced by ${Math.floor(action.effect.damageReduction * 100)}%.`;
  }

  // Enemy counter-attack
  const enemyDamage = simulateEnemyTurn(state);
  outcome += ` Enemy strikes for ${enemyDamage} damage!`;

  // Advance turn
  state.turn++;
  state.lastOutcome = outcome;
  state.isDefending = false;

  // HUB-13: Emit action event (scoped emitter for source attribution)
  if (ctx.emitter) {
    ctx.emitter.emit('escalation:action', {
      action: actionId,
      turn: state.turn,
      outcome,
      vitalsImpact: action.cost,
    });
  }

  render(root, state);
}

function simulateEnemyTurn(state) {
  const baseDamage = 10 + (state.encounter?.baseDifficulty || 1) * 5;
  const variance = Math.floor(Math.random() * 10);
  let damage = baseDamage + variance;

  // Apply defend reduction
  if (state.isDefending) {
    damage = Math.floor(damage * 0.5);
  }

  // Apply to health (via vitals impact later)
  return damage;
}

function handleVictory(root, state, ctx) {
  state.lastOutcome = `<strong>Victory!</strong> The ${state.encounter?.label || 'enemy'} has been defeated!`;

  // HUB-13: Emit victory event (scoped emitter for source attribution)
  if (ctx.emitter) {
    ctx.emitter.emit('escalation:victory', {
      encounter: state.encounter,
      turns: state.turn,
      vitalsSpent: state.playerVitals,
    });
  }

  render(root, state);

  // Auto-exit after brief delay
  setTimeout(() => {
    exitEscalation(root, state, ctx);
  }, 2000);
}

function exitEscalation(root, state, ctx) {
  state.active = false;
  state.lastOutcome = null;

  // HUB-13: Emit exit event (scoped emitter for source attribution)
  if (ctx.emitter) {
    ctx.emitter.emit('escalation:exit', {
      encounter: state.encounter,
      turn: state.turn,
      vitalsRemaining: state.playerVitals,
    });
  }

  state.encounter = null;
  render(root, state);
}
