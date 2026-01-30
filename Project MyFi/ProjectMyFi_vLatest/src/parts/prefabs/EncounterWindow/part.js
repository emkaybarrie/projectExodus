// EncounterWindow Part — Displays autobattler zone / ambient encounters
// Part of I1-Hub-Phase1-Scaffold
// Contract: /The Forge/myfi/specs/parts/contracts/ENCOUNTERWINDOW_CONTRACT.md

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.EncounterWindow', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-EncounterWindow EncounterWindow';

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
  const { emitter, actionBus } = ctx;

  // Engage button click — trigger escalation (HUB-05)
  const engageBtn = root.querySelector('.EncounterWindow__engageBtn');
  if (engageBtn) {
    engageBtn.addEventListener('click', () => {
      const encounterId = root.dataset.encounterId;
      if (encounterId) {
        // HUB-13: Emit via scoped emitter for proper source attribution
        if (emitter) {
          emitter.emit('encounter:escalate', {
            encounterId,
            encounter: root._currentEncounter || { id: encounterId },
          });
          emitter.emit('engage', { encounterId });
        }
      }
    });
  }

  // Click on encounter content to engage (alternative trigger)
  const encounterEl = root.querySelector('.EncounterWindow__encounter');
  if (encounterEl) {
    encounterEl.addEventListener('click', (e) => {
      // Don't double-trigger if button was clicked
      if (e.target.closest('.EncounterWindow__engageBtn')) return;

      const encounterId = root.dataset.encounterId;
      if (encounterId) {
        // HUB-13: Emit via scoped emitter for proper source attribution
        if (emitter) {
          emitter.emit('encounter:escalate', {
            encounterId,
            encounter: root._currentEncounter || { id: encounterId },
          });
          emitter.emit('engage', { encounterId });
        }
      }
    });
  }

  // HUB-12: DEV-only spawn trigger (visible only when __MYFI_DEBUG__ exists)
  // WO-STAGE-EPISODES-V1: Updated to use Episode system
  const devSpawnBtn = root.querySelector('.EncounterWindow__devSpawnBtn');
  if (devSpawnBtn && typeof window !== 'undefined' && window.__MYFI_DEBUG__) {
    devSpawnBtn.hidden = false;
    devSpawnBtn.addEventListener('click', () => {
      const emitDemoSignal = window.__MYFI_DEBUG__?.emitDemoSignal;
      if (emitDemoSignal) {
        emitDemoSignal();
        console.log('[EncounterWindow] DEV: Spawned episode via Episode system');
      } else {
        // Fallback to legacy
        const hubController = window.__MYFI_DEBUG__?.hubController;
        if (hubController && hubController.forceEncounter) {
          hubController.forceEncounter();
          console.log('[EncounterWindow] DEV: Spawned test encounter (legacy)');
        } else {
          console.warn('[EncounterWindow] DEV: Episode system not available');
        }
      }
    });
  }
}

function render(root, data) {
  const { displayState = 'idle', encounter = null } = data;

  // Store current encounter for escalation reference
  root._currentEncounter = encounter;

  // Update state indicator
  const stateEl = root.querySelector('.EncounterWindow__state');
  if (stateEl) {
    const stateLabels = {
      idle: 'Idle',
      available: 'Available',
      observing: 'Observing',
    };
    stateEl.textContent = stateLabels[displayState] || displayState;
    stateEl.className = `EncounterWindow__state EncounterWindow__state--${displayState}`;
  }

  // Update root class for state-based styling
  root.className = `Part-EncounterWindow EncounterWindow EncounterWindow--${displayState}`;

  // Show/hide idle vs encounter content
  const idleEl = root.querySelector('.EncounterWindow__idle');
  const encounterEl = root.querySelector('.EncounterWindow__encounter');

  if (displayState === 'idle' || !encounter) {
    if (idleEl) idleEl.hidden = false;
    if (encounterEl) encounterEl.hidden = true;
    root.dataset.encounterId = '';
  } else {
    if (idleEl) idleEl.hidden = true;
    if (encounterEl) encounterEl.hidden = false;

    // Populate encounter data
    root.dataset.encounterId = encounter.id || '';

    const typeEl = root.querySelector('.EncounterWindow__encounterType');
    if (typeEl) {
      typeEl.textContent = encounter.type || 'Encounter';
      typeEl.className = `EncounterWindow__encounterType EncounterWindow__encounterType--${encounter.severity || 'minor'}`;
    }

    const summaryEl = root.querySelector('.EncounterWindow__encounterSummary');
    if (summaryEl) {
      summaryEl.textContent = encounter.summary || 'An encounter awaits...';
    }
  }
}
