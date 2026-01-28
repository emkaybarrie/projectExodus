// EventLog Part — Recent History & Temporal Memory
// HUB-06: Event Log & Temporal Memory

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

// Narrative framing templates for positive outcomes
const POSITIVE_NARRATIVES = [
  'Victory secured against {encounter}',
  'Successfully overcame {encounter}',
  '{encounter} defeated — you grow stronger',
  'Triumph! {encounter} falls before you',
  'Well done defeating {encounter}',
];

// Narrative framing templates for survived outcomes
const SURVIVED_NARRATIVES = [
  'Endured the {encounter}',
  'Weathered the {encounter} storm',
  'Survived {encounter} encounter',
  '{encounter} passes — you remain',
];

// Narrative framing for escalation events
const ESCALATION_NARRATIVES = [
  'Engaged {encounter} in direct combat',
  'Faced {encounter} head-on',
  'Took control against {encounter}',
];

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.EventLog', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-EventLog EventLog';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Internal state
  const state = {
    events: data.events || [],
    maxEvents: data.maxEvents || 5,
  };

  // Subscribe to events from actionBus (uses 'subscribe' not 'on')
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:resolve', (outcome) => {
        addEvent(state, root, createEncounterEvent(outcome));
      })
    );
    unsubscribers.push(
      ctx.actionBus.subscribe('escalation:victory', (data) => {
        addEvent(state, root, createEscalationEvent(data, 'victory'));
      })
    );
    unsubscribers.push(
      ctx.actionBus.subscribe('escalation:exit', (data) => {
        addEvent(state, root, createEscalationEvent(data, 'retreat'));
      })
    );
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:stateChange', (hubState) => {
        // Could add events for significant state changes
      })
    );
  }

  // Initial render
  render(root, state);

  return {
    unmount() {
      // Unsubscribe from events
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      root.remove();
    },
    update(newData) {
      if (newData.events) {
        state.events = newData.events.slice(0, state.maxEvents);
      }
      render(root, state);
    },
    addEvent(event) {
      addEvent(state, root, event);
    },
    getEvents() {
      return [...state.events];
    },
    clearEvents() {
      state.events = [];
      render(root, state);
    },
  };
}

function addEvent(state, root, event) {
  // Add to front of list
  state.events.unshift(event);

  // Trim to max events
  if (state.events.length > state.maxEvents) {
    state.events = state.events.slice(0, state.maxEvents);
  }

  render(root, state);
}

function createEncounterEvent(outcome) {
  const isVictory = outcome.isVictory;
  const encounterLabel = outcome.encounterLabel || 'Unknown';
  const templates = isVictory ? POSITIVE_NARRATIVES : SURVIVED_NARRATIVES;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const text = template.replace('{encounter}', encounterLabel);

  return {
    id: `event-${Date.now()}`,
    type: 'encounter',
    text,
    icon: isVictory ? '&#9989;' : '&#128260;',
    sentiment: isVictory ? 'positive' : 'neutral',
    timestamp: Date.now(),
  };
}

function createEscalationEvent(data, type) {
  const encounterLabel = data.encounter?.label || 'enemy';

  if (type === 'victory') {
    const templates = ESCALATION_NARRATIVES;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const text = template.replace('{encounter}', encounterLabel);

    return {
      id: `event-${Date.now()}`,
      type: 'escalation',
      text: text + ' — Decisive victory!',
      icon: '&#127942;',
      sentiment: 'positive',
      timestamp: Date.now(),
    };
  } else {
    return {
      id: `event-${Date.now()}`,
      type: 'escalation',
      text: `Tactical retreat from ${encounterLabel}`,
      icon: '&#128694;',
      sentiment: 'neutral',
      timestamp: Date.now(),
    };
  }
}

function render(root, state) {
  const { events } = state;

  // Update event count
  const countEl = root.querySelector('[data-bind="eventCount"]');
  if (countEl) {
    countEl.textContent = events.length;
    countEl.dataset.count = events.length;
  }

  // Update event list
  const listEl = root.querySelector('[data-bind="eventList"]');
  if (listEl) {
    if (events.length === 0) {
      listEl.innerHTML = '';
    } else {
      listEl.innerHTML = events.map((event, index) => `
        <div class="EventLog__event EventLog__event--${event.sentiment || 'neutral'} ${index >= 3 ? 'EventLog__event--fading' : ''}">
          <span class="EventLog__eventIcon">${event.icon || '&#128196;'}</span>
          <div class="EventLog__eventContent">
            <div class="EventLog__eventText">${event.text}</div>
            <div class="EventLog__eventTime">${formatTime(event.timestamp)}</div>
          </div>
        </div>
      `).join('');
    }
  }

  // Update empty state visibility
  const emptyEl = root.querySelector('[data-bind="emptyState"]');
  if (emptyEl) {
    emptyEl.style.display = events.length === 0 ? 'flex' : 'none';
  }

  // Update summary
  const summaryEl = root.querySelector('[data-bind="summary"]');
  if (summaryEl) {
    summaryEl.style.display = events.length === 0 ? 'block' : 'none';
  }
}

function formatTime(timestamp) {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return 'Just now';
  } else if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  } else {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
}
