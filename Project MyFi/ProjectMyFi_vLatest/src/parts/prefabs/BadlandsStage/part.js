// BadlandsStage Part — HUB Refactor: 3-Tab Stage
// Tabs: Current Event | Recent Events | Loadout (tab bar at bottom)

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.BadlandsStage', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-BadlandsStage BadlandsStage';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Combat settings (can be overridden by dev config)
  const DEFAULT_ENCOUNTER_DURATION = 30; // seconds (default, can be overridden)
  const COMBAT_TICK_INTERVAL = 2500; // ms per combat round (2.5 seconds)
  const TIMER_UPDATE_INTERVAL = 100; // ms for smooth timer animation

  function getDevConfig() {
    return window.__MYFI_DEV_CONFIG__ || {};
  }

  // Internal state
  const state = {
    activeTab: 'current', // current | recent | loadout
    stageMode: data.stageMode || 'world', // world | encounter_autobattler
    stageBgUrl: data.stageBgUrl || null, // Stage background URL from VM
    currentEncounter: data.currentEncounter || null,
    recentEvents: [],
    loadout: {
      skills: [
        { slot: 1, id: 'strike', name: 'Strike', icon: '&#9876;', damage: 15, manaCost: 0, staminaCost: 8 },
        { slot: 2, id: 'guard', name: 'Guard', icon: '&#128737;', damage: 5, manaCost: 0, staminaCost: 3 },
        { slot: 3, id: null, name: 'Empty', icon: '&#10133;', damage: 0, manaCost: 0, staminaCost: 0 },
      ],
      equipment: [
        { slot: 'weapon', id: 'iron_sword', name: 'Iron Sword', icon: '&#128481;', stat: '+8 ATK', bonusDamage: 8 },
        { slot: 'armor', id: null, name: 'No Armor', icon: '&#128085;', stat: null, damageReduction: 0 },
      ],
    },
    selectedSkillSlot: null,
    // Timer state
    timerRemaining: 0,
    timerTotal: DEFAULT_ENCOUNTER_DURATION,
    timerIntervalId: null,
    combatTickIntervalId: null,
    // Enemy state (for autobattler simulation)
    enemyHpCurrent: 100,
    enemyHpMax: 100,
    enemyBaseDamage: 15,
  };

  // Combat simulation functions
  function startEncounterTimer() {
    stopEncounterTimer(); // Clear any existing timers

    // Get duration from dev config or use default
    const devConfig = getDevConfig();
    const encounterDuration = devConfig.encounterDuration || DEFAULT_ENCOUNTER_DURATION;

    state.timerRemaining = encounterDuration;
    state.timerTotal = encounterDuration;

    // Initialize enemy stats based on encounter difficulty
    const difficulty = state.currentEncounter?.baseDifficulty || 1;
    state.enemyHpMax = 80 + (difficulty * 20); // 100-160 HP based on difficulty
    state.enemyHpCurrent = state.enemyHpMax;
    state.enemyBaseDamage = 10 + (difficulty * 5); // 15-25 damage based on difficulty

    updateTimer(root, state.timerRemaining, state.timerTotal);
    updateEnemyHealth(root, state.enemyHpCurrent, state.enemyHpMax);

    // Timer countdown (visual only, smooth animation)
    state.timerIntervalId = setInterval(() => {
      state.timerRemaining -= TIMER_UPDATE_INTERVAL / 1000;
      if (state.timerRemaining <= 0) {
        state.timerRemaining = 0;
        resolveEncounter();
      }
      updateTimer(root, state.timerRemaining, state.timerTotal);
    }, TIMER_UPDATE_INTERVAL);

    // Combat ticks (discrete rounds)
    state.combatTickIntervalId = setInterval(() => {
      executeCombatRound();
    }, COMBAT_TICK_INTERVAL);

    // Execute first round immediately
    setTimeout(() => executeCombatRound(), 500);
  }

  function executeCombatRound() {
    if (state.stageMode !== 'encounter_autobattler' || !state.currentEncounter) return;

    // Get dev config for modifiers
    const devConfig = getDevConfig();
    const damageMultiplier = (devConfig.damageMultiplier || 100) / 100;
    const godMode = devConfig.godMode || false;

    // --- Avatar's Turn ---
    // Pick a random equipped skill
    const equippedSkills = state.loadout.skills.filter(s => s.id != null);
    const skill = equippedSkills.length > 0
      ? equippedSkills[Math.floor(Math.random() * equippedSkills.length)]
      : { damage: 10, manaCost: 0, staminaCost: 5 }; // Default basic attack

    // Calculate weapon bonus
    const weapon = state.loadout.equipment.find(e => e.slot === 'weapon' && e.id);
    const weaponBonus = weapon?.bonusDamage || 0;

    // Deal damage to enemy (with variance and multiplier)
    const damageVariance = Math.floor(Math.random() * 6) - 2; // -2 to +3
    const baseDamage = skill.damage + weaponBonus + damageVariance;
    const damageDealt = Math.max(1, Math.floor(baseDamage * damageMultiplier));
    state.enemyHpCurrent = Math.max(0, state.enemyHpCurrent - damageDealt);
    updateEnemyHealth(root, state.enemyHpCurrent, state.enemyHpMax);

    // --- Enemy's Turn ---
    // Calculate armor reduction
    const armor = state.loadout.equipment.find(e => e.slot === 'armor' && e.id);
    const damageReduction = armor?.damageReduction || 0;

    // Enemy attacks player (with variance) - skip if god mode
    const enemyVariance = Math.floor(Math.random() * 8) - 3; // -3 to +4
    const damageTaken = godMode ? 0 : Math.max(1, state.enemyBaseDamage + enemyVariance - damageReduction);

    // --- Emit combat tick with vitals impact ---
    if (ctx.actionBus) {
      ctx.actionBus.emit('combat:tick', {
        round: Math.ceil((state.timerTotal - state.timerRemaining) / (COMBAT_TICK_INTERVAL / 1000)),
        skillUsed: skill.id || 'basic_attack',
        damageDealt,
        damageTaken,
        vitalsImpact: {
          health: -damageTaken,
          mana: -(skill.manaCost || 0),
          stamina: -(skill.staminaCost || 0),
          essence: 0,
        },
      }, 'BadlandsStage');
    }

    // Check for victory
    if (state.enemyHpCurrent <= 0) {
      resolveEncounter();
    }
  }

  function resolveEncounter() {
    stopEncounterTimer();
    state.enemyHpCurrent = 0;
    updateEnemyHealth(root, 0, state.enemyHpMax);

    // Auto-resolve via autobattler
    const hubController = window.__MYFI_DEBUG__?.hubController;
    const autobattler = hubController?.getAutobattler?.();
    if (autobattler?.forceResolve) {
      autobattler.forceResolve();
    }
  }

  function stopEncounterTimer() {
    if (state.timerIntervalId) {
      clearInterval(state.timerIntervalId);
      state.timerIntervalId = null;
    }
    if (state.combatTickIntervalId) {
      clearInterval(state.combatTickIntervalId);
      state.combatTickIntervalId = null;
    }
  }

  // Initial render
  render(root, state);

  // Bind interactions
  bindInteractions(root, state, ctx);

  // Subscribe to events
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    // State changes (only for non-encounter properties)
    // NOTE: stageMode and currentEncounter are controlled by autobattler events,
    // not hub:stateChange, to prevent race conditions where hub state resets
    // active encounters back to 'world' mode
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:stateChange', (hubState) => {
        if (hubState?.badlandsStage) {
          // Only update stageBgUrl from hub state (visual config)
          // Do NOT update stageMode or currentEncounter here - those are
          // controlled by autobattler:spawn and autobattler:resolve events
          if (hubState.badlandsStage.stageBgUrl) {
            state.stageBgUrl = hubState.badlandsStage.stageBgUrl;
          }
          render(root, state);
        }
      })
    );

    // Encounter spawned (from autobattler)
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:spawn', (encounter) => {
        state.stageMode = 'encounter_autobattler';
        state.currentEncounter = encounter;
        state.activeTab = 'current'; // Switch to current tab
        render(root, state);
        startEncounterTimer(); // Start countdown
      })
    );

    // Encounter resolved (from autobattler)
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:resolve', (result) => {
        stopEncounterTimer(); // Stop countdown
        // Add to recent events
        if (state.currentEncounter) {
          state.recentEvents.unshift({
            id: `event-${Date.now()}`,
            name: state.currentEncounter.label || state.currentEncounter.name || 'Unknown Encounter',
            icon: state.currentEncounter.icon || '&#128058;',
            result: result?.isVictory ? 'victory' : 'defeat',
            timestamp: Date.now(),
            details: result?.summary || 'Encounter resolved.',
          });
          // Keep only last 10 events
          if (state.recentEvents.length > 10) {
            state.recentEvents.pop();
          }
        }
        state.stageMode = 'world';
        state.currentEncounter = null;
        render(root, state);
      })
    );

  }

  return {
    unmount() {
      stopEncounterTimer(); // Clean up timer
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      root.remove();
    },
    update(newData) {
      if (newData.badlandsStage) {
        Object.assign(state, newData.badlandsStage);
        render(root, state);
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Interactions
// ═══════════════════════════════════════════════════════════════════════════════

function bindInteractions(root, state, ctx) {
  const container = root.querySelector('.BadlandsStage__container');
  if (!container) return;

  // Tab switching
  container.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-action="switchTab"]');
    if (tabBtn) {
      const tab = tabBtn.dataset.tab;
      if (tab && tab !== state.activeTab) {
        state.activeTab = tab;
        render(root, state);
      }
      return;
    }

    // Aid Avatar button
    const aidBtn = e.target.closest('[data-action="aidAvatar"]');
    if (aidBtn) {
      showToast(root, 'aid');
      return;
    }

    // Recent event tap (expand in-place)
    const recentItem = e.target.closest('.BadlandsStage__recentItem:not(.BadlandsStage__recentItem--empty)');
    if (recentItem) {
      recentItem.classList.toggle('BadlandsStage__recentItem--expanded');
      return;
    }

    // Skill slot tap (open picker)
    const skillSlot = e.target.closest('[data-action="editSkill"]');
    if (skillSlot) {
      state.selectedSkillSlot = parseInt(skillSlot.dataset.slot, 10);
      showModal(root, 'skillPicker');
      return;
    }

    // Skill option selection
    const skillOption = e.target.closest('.BadlandsStage__skillOption');
    if (skillOption && state.selectedSkillSlot != null) {
      const skillId = skillOption.dataset.skill;
      // Update loadout
      const slotIndex = state.loadout.skills.findIndex(s => s.slot === state.selectedSkillSlot);
      if (slotIndex !== -1 && skillId) {
        const skillData = getSkillData(skillId);
        state.loadout.skills[slotIndex] = {
          ...state.loadout.skills[slotIndex],
          id: skillId,
          name: skillData.name,
          icon: skillData.icon,
          // Combat stats
          damage: skillData.damage,
          manaCost: skillData.manaCost,
          staminaCost: skillData.staminaCost,
        };
        render(root, state);
      }
      hideModal(root, 'skillPicker');
      state.selectedSkillSlot = null;
      return;
    }

    // Close modal
    const closeModal = e.target.closest('[data-action="closeModal"]');
    if (closeModal) {
      hideModal(root, 'skillPicker');
      state.selectedSkillSlot = null;
      return;
    }

    // Modal backdrop click
    const modal = e.target.closest('.BadlandsStage__modal');
    if (modal && e.target === modal) {
      modal.dataset.visible = 'false';
      state.selectedSkillSlot = null;
      return;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════════════════════════════════════

function render(root, state) {
  const container = root.querySelector('.BadlandsStage__container');
  if (!container) return;

  // Set stage background URL via CSS custom property
  // Switch between idle and combat backgrounds based on encounter state
  // Combat mode always uses combat background; idle mode can use VM override
  // VM paths are relative to index.html, so resolve them to absolute URLs
  // (CSS url() resolves relative to stylesheet, not document)
  let stageBgUrl;
  if (state.stageMode === 'encounter_autobattler') {
    // Combat mode: always use combat background
    stageBgUrl = new URL('../../../../assets/art/stages/wardwatch-combat.png', import.meta.url).href;
  } else if (state.stageBgUrl) {
    // World mode with VM override
    stageBgUrl = new URL(state.stageBgUrl, document.baseURI).href;
  } else {
    // World mode: use idle background
    stageBgUrl = new URL('../../../../assets/art/stages/wardwatch-idle.png', import.meta.url).href;
  }
  container.style.setProperty('--stage-bg-url', `url('${stageBgUrl}')`);

  // Set active tab
  container.dataset.activeTab = state.activeTab;
  container.dataset.stageMode = state.stageMode;

  // Update tab buttons
  const tabBtns = container.querySelectorAll('[data-action="switchTab"]');
  tabBtns.forEach(btn => {
    btn.classList.toggle('BadlandsStage__tab--active', btn.dataset.tab === state.activeTab);
  });

  // Render current event tab content
  renderCurrentEvent(root, state);

  // Render recent events
  renderRecentEvents(root, state);

  // Render loadout
  renderLoadout(root, state);
}

function renderCurrentEvent(root, state) {
  const scenic = root.querySelector('.BadlandsStage__scenic');
  const encounter = root.querySelector('.BadlandsStage__encounter');

  if (state.stageMode === 'encounter_autobattler' && state.currentEncounter) {
    // Show encounter
    if (scenic) scenic.dataset.visible = 'false';
    if (encounter) {
      encounter.dataset.visible = 'true';

      // Update encounter details
      const iconEl = root.querySelector('[data-bind="encounterIcon"]');
      const nameEl = root.querySelector('[data-bind="encounterName"]');
      const typeEl = root.querySelector('[data-bind="encounterType"]');
      const spriteEl = root.querySelector('[data-bind="enemySprite"]');

      // Use innerHTML for icons (HTML entities like &#128058;)
      if (iconEl) iconEl.innerHTML = state.currentEncounter.icon || '&#128058;';
      // Use label (from autobattler) with fallback to name
      if (nameEl) nameEl.textContent = state.currentEncounter.label || state.currentEncounter.name || 'Unknown';
      if (typeEl) typeEl.textContent = (state.currentEncounter.type || 'ENCOUNTER').toUpperCase();
      if (spriteEl) spriteEl.innerHTML = state.currentEncounter.icon || '&#128058;';
    }
  } else {
    // Show scenic
    if (scenic) scenic.dataset.visible = 'true';
    if (encounter) encounter.dataset.visible = 'false';
  }
}

function renderRecentEvents(root, state) {
  const listEl = root.querySelector('[data-bind="recentList"]');
  if (!listEl) return;

  if (state.recentEvents.length === 0) {
    listEl.innerHTML = `
      <li class="BadlandsStage__recentItem BadlandsStage__recentItem--empty">
        <span class="BadlandsStage__recentItemText">No recent encounters</span>
      </li>
    `;
  } else {
    listEl.innerHTML = state.recentEvents.map(event => `
      <li class="BadlandsStage__recentItem">
        <div class="BadlandsStage__recentItemMain">
          <span class="BadlandsStage__recentItemIcon">${event.icon}</span>
          <div class="BadlandsStage__recentItemInfo">
            <span class="BadlandsStage__recentItemName">${event.name}</span>
            <span class="BadlandsStage__recentItemTime">${formatTimeAgo(event.timestamp)}</span>
          </div>
        </div>
        <div class="BadlandsStage__recentItemDetails">
          ${event.details}
        </div>
      </li>
    `).join('');
  }
}

function renderLoadout(root, state) {
  const skillSlotsEl = root.querySelector('[data-bind="skillSlots"]');
  if (skillSlotsEl) {
    skillSlotsEl.innerHTML = state.loadout.skills.map(skill => `
      <div class="BadlandsStage__skillSlot ${skill.id ? '' : 'BadlandsStage__skillSlot--empty'}"
           data-slot="${skill.slot}"
           data-action="editSkill">
        <span class="BadlandsStage__skillIcon">${skill.icon}</span>
        <span class="BadlandsStage__skillName">${skill.name}</span>
      </div>
    `).join('');
  }

  const equipSlotsEl = root.querySelector('[data-bind="equipSlots"]');
  if (equipSlotsEl) {
    equipSlotsEl.innerHTML = state.loadout.equipment.map(equip => `
      <div class="BadlandsStage__equipSlot ${equip.id ? '' : 'BadlandsStage__equipSlot--empty'}"
           data-slot="${equip.slot}"
           data-action="editEquip">
        <span class="BadlandsStage__equipIcon">${equip.icon}</span>
        <span class="BadlandsStage__equipName">${equip.name}</span>
        ${equip.stat ? `<span class="BadlandsStage__equipStat">${equip.stat}</span>` : ''}
      </div>
    `).join('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function updateTimer(root, remaining, total) {
  const timerValue = root.querySelector('[data-bind="timerValue"]');
  const timerFill = root.querySelector('[data-bind="timerFill"]');

  if (timerValue) {
    timerValue.textContent = Math.ceil(remaining);
  }
  if (timerFill && total > 0) {
    const percent = (remaining / total) * 100;
    timerFill.style.width = `${percent}%`;
  }
}

function updateEnemyHealth(root, current, max) {
  const healthFill = root.querySelector('[data-bind="enemyHealthFill"]');
  if (healthFill && max > 0) {
    const percent = Math.max(0, Math.min(100, (current / max) * 100));
    healthFill.style.width = `${percent}%`;
  }
}

function showToast(root, toastId) {
  const toast = root.querySelector(`[data-toast="${toastId}"]`);
  if (toast) {
    toast.dataset.visible = 'true';
    setTimeout(() => {
      toast.dataset.visible = 'false';
    }, 4000);
  }
}

function showModal(root, modalId) {
  const modal = root.querySelector(`[data-modal="${modalId}"]`);
  if (modal) {
    modal.dataset.visible = 'true';
  }
}

function hideModal(root, modalId) {
  const modal = root.querySelector(`[data-modal="${modalId}"]`);
  if (modal) {
    modal.dataset.visible = 'false';
  }
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getSkillData(skillId) {
  const skills = {
    strike: { name: 'Strike', icon: '&#9876;', cost: '8 ST', damage: 15, manaCost: 0, staminaCost: 8 },
    guard: { name: 'Guard', icon: '&#128737;', cost: '3 ST', damage: 5, manaCost: 0, staminaCost: 3 },
    heal: { name: 'Heal', icon: '&#10024;', cost: '10 MP', damage: 0, manaCost: 10, staminaCost: 0 },
  };
  return skills[skillId] || { name: 'Unknown', icon: '&#10067;', cost: '?', damage: 5, manaCost: 0, staminaCost: 5 };
}
