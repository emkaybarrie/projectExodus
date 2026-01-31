// BadlandsStage Part — HUB Refactor: 3-Tab Stage
// Tabs: Current Event | Recent Events | Loadout (tab bar at bottom)
// WO-STAGE-EPISODES-V1: Added Episode system integration with slow-time overlay
//
// ═══════════════════════════════════════════════════════════════════════════════
// WO-S1: SPECTATOR-MODE SIMULATION MODEL
// ═══════════════════════════════════════════════════════════════════════════════
//
// The Stage is a REAL-TIME NARRATIVE RENDERER, not a UI component.
// It simulates the Badlands game loop in spectator mode.
//
// DERIVED MODES (see stageSchemas.STAGE_MODES):
// ┌─────────────────┐     ┌───────────────────┐     ┌───────────────┐
// │  IDLE_TRAVEL    │────►│ INCIDENT_OVERLAY  │────►│ COMBAT_ACTIVE │
// │                 │     │   (or choice tag) │     │               │
// │ World cycling:  │     │                   │     │ Autobattler   │
// │ rest→patrol→    │◄────│ Slow-time, player │◄────│ ticks, enemy  │
// │ explore→return→ │     │ can tag or skip   │     │ HP, damage    │
// │ city (loop)     │     │                   │     │               │
// └─────────────────┘     └───────────────────┘     └───────────────┘
//        ▲                                                  │
//        └────────────────── RESOLUTION ◄───────────────────┘
//
// KEY PRINCIPLE: Stage SHOWS mode, it does NOT control behavior.
// Combat logic is in autobattler.js, episode logic is in episodeRunner.js.
// ═══════════════════════════════════════════════════════════════════════════════

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchJSON failed ${res.status} for ${url}`);
  return await res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// World State Background System
// ═══════════════════════════════════════════════════════════════════════════════

// World state cycle order (loop)
const WORLD_STATE_CYCLE = ['rest', 'patrol', 'explore', 'return', 'city'];

// WO-WATCH-EPISODE-ROUTING: Visual pool to world state bias mapping
// Each activity visual pool biases which world states are more likely
const VISUAL_POOL_STATE_BIAS = {
  morning: ['rest', 'patrol', 'city'],           // Calm, safe states
  active: ['patrol', 'explore', 'return'],       // Movement states
  intense: ['explore', 'patrol'],                // High-energy states
  evening: ['return', 'city', 'rest'],           // Winding down states
  night: ['rest', 'city'],                       // Calm, shelter states
  default: WORLD_STATE_CYCLE,                    // Full cycle
};

// Background folders for each state
const BG_FOLDER_BASE = '../../../../assets/art/stages/';
const STATE_FOLDERS = {
  combat: 'combat/',
  rest: 'rest/',
  patrol: 'patrol/',
  explore: 'explore/',
  return: 'return/',
  city: 'city/',
};

// Fallback images for each state
const STATE_FALLBACKS = {
  combat: 'wardwatch-combat-01.png',
  rest: 'wardwatch-rest-01.png',
  patrol: 'wardwatch-patrol-01.png',
  explore: 'wardwatch-explore-01.png',
  return: 'wardwatch-return-01.png',
  city: 'wardwatch-city-01.png',
};

// Background manifests cache (loaded once per state)
const backgroundsCache = {};

async function loadStateBackgrounds(stateName, baseUrl) {
  if (backgroundsCache[stateName]) return backgroundsCache[stateName];

  const folder = STATE_FOLDERS[stateName];
  if (!folder) {
    console.warn(`[BadlandsStage] Unknown state: ${stateName}`);
    backgroundsCache[stateName] = [];
    return [];
  }

  try {
    const manifestUrl = new URL(BG_FOLDER_BASE + folder + 'manifest.json', baseUrl).href;
    const manifest = await fetchJSON(manifestUrl);
    backgroundsCache[stateName] = manifest.backgrounds || [];
    console.log(`[BadlandsStage] Loaded ${backgroundsCache[stateName].length} backgrounds for state: ${stateName}`);
  } catch (err) {
    console.warn(`[BadlandsStage] Failed to load ${stateName} backgrounds manifest, using fallback`, err);
    backgroundsCache[stateName] = [STATE_FALLBACKS[stateName]];
  }

  return backgroundsCache[stateName];
}

async function loadAllStateBackgrounds(baseUrl) {
  const allStates = [...WORLD_STATE_CYCLE, 'combat'];
  await Promise.all(allStates.map(state => loadStateBackgrounds(state, baseUrl)));
}

function getRandomBackground(stateName, baseUrl) {
  const backgrounds = backgroundsCache[stateName] || [];
  const folder = STATE_FOLDERS[stateName] || 'patrol/';
  const fallback = STATE_FALLBACKS[stateName] || 'wardwatch-patrol-01.png';

  if (backgrounds.length === 0) {
    return new URL(BG_FOLDER_BASE + folder + fallback, baseUrl).href;
  }

  const randomIndex = Math.floor(Math.random() * backgrounds.length);
  const filename = backgrounds[randomIndex];
  return new URL(BG_FOLDER_BASE + folder + filename, baseUrl).href;
}

/**
 * WO-HUB-04: Preload image and resolve when loaded
 * Returns a promise that resolves with the URL when the image is ready
 */
function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => {
      console.warn(`[BadlandsStage] Failed to preload image: ${url}`);
      resolve(url); // Still resolve to allow fallback behavior
    };
    img.src = url;
  });
}

// WO-HUB-04: Track preloaded images to avoid re-preloading
const preloadedImages = new Set();

function getNextWorldState(currentState, visualPool = 'default') {
  // WO-WATCH-EPISODE-ROUTING: Use visual pool bias if available
  const biasedStates = VISUAL_POOL_STATE_BIAS[visualPool] || WORLD_STATE_CYCLE;

  // If current state is in biased list, cycle within that list
  const currentIndex = biasedStates.indexOf(currentState);
  if (currentIndex !== -1) {
    const nextIndex = (currentIndex + 1) % biasedStates.length;
    return biasedStates[nextIndex];
  }

  // If current state not in bias list, pick a random biased state
  return biasedStates[Math.floor(Math.random() * biasedStates.length)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// WO-UX-4: Evocative World State Captions
// ═══════════════════════════════════════════════════════════════════════════════

const WORLD_STATE_CAPTIONS = {
  rest: {
    titles: ['Sanctuary', 'Respite', 'Haven', 'Refuge'],
    subtitles: [
      '— The fire crackles softly',
      '— A moment of peace',
      '— Wounds mend, strength returns',
      '— Safe, for now',
    ],
  },
  patrol: {
    titles: ['Wardwatch', 'The Perimeter', 'Vigil', 'Outer Guard'],
    subtitles: [
      '— All quiet on the frontier',
      '— Eyes on the horizon',
      '— The ward holds steady',
      '— Shadows stir, but hold',
    ],
  },
  explore: {
    titles: ['The Unknown', 'Uncharted', 'Beyond the Ward', 'Terra Incognita'],
    subtitles: [
      '— What lies ahead?',
      '— Fortune favors the bold',
      '— New ground, old dangers',
      '— Every step writes history',
    ],
  },
  return: {
    titles: ['Homeward', 'The Long Road', 'Journey\'s End', 'Back Trail'],
    subtitles: [
      '— The familiar beckons',
      '— Each step toward safety',
      '— Weary but wiser',
      '— Almost there',
    ],
  },
  city: {
    titles: ['The Hub', 'Hearth & Home', 'Civilization', 'The Ward'],
    subtitles: [
      '— Markets hum with life',
      '— Among kin and coin',
      '— A world behind walls',
      '— Trade and tidings',
    ],
  },
};

function getWorldStateCaption(stateName) {
  const stateData = WORLD_STATE_CAPTIONS[stateName] || WORLD_STATE_CAPTIONS.patrol;
  const titleIndex = Math.floor(Math.random() * stateData.titles.length);
  const subtitleIndex = Math.floor(Math.random() * stateData.subtitles.length);
  return {
    title: stateData.titles[titleIndex],
    subtitle: stateData.subtitles[subtitleIndex],
  };
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

  // Pre-load all state backgrounds manifests
  await loadAllStateBackgrounds(import.meta.url);

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
    // World state system
    worldState: 'patrol', // rest | patrol | explore | return | city
    worldStateTimerId: null,
    currentBgUrl: null, // Current background URL (for any state)
    // WO-UX-4: Evocative captions
    scenicTitle: 'Wardwatch',
    scenicSubtitle: '— All quiet on the frontier',
    // WO-STAGE-EPISODES-V1: Episode system state
    episodeActive: false,
    currentEpisode: null,
    currentIncident: null,
    episodePhase: null, // setup | active | resolving | after
    slowTimeTimerRemaining: 0,
    slowTimeTimerTotal: 30,
    queueLength: 0, // Number of pending signals in queue
    // WO-S3: Unified overlay state
    awaitingEngagement: false, // True when showing Engage/Skip buttons
    isPlayerEngaged: false, // True after player engages
    overlayConfig: null, // Mode-specific overlay configuration
    // WO-WATCH-EPISODE-ROUTING: Activity state visual pool
    currentVisualPool: 'default',
    currentActivityState: null, // Activity state from episodeRouter
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // World State Transition System
  // ═══════════════════════════════════════════════════════════════════════════

  function getWorldStateConfig() {
    const devConfig = getDevConfig();
    return {
      minTransitionTime: devConfig.worldStateMinTime || 30, // seconds
      maxTransitionTime: devConfig.worldStateMaxTime || 90, // seconds
      randomizeOnStateChange: devConfig.worldStateRandomizeBg !== false, // default true
    };
  }

  function getRandomTransitionTime() {
    const config = getWorldStateConfig();
    const range = config.maxTransitionTime - config.minTransitionTime;
    return (config.minTransitionTime + Math.random() * range) * 1000; // ms
  }

  function selectBackgroundForState(stateName) {
    const config = getWorldStateConfig();
    if (config.randomizeOnStateChange) {
      return getRandomBackground(stateName, import.meta.url);
    }
    // If not randomizing, keep current if same state type, else pick random
    if (state.currentBgUrl && state.worldState === stateName) {
      return state.currentBgUrl;
    }
    return getRandomBackground(stateName, import.meta.url);
  }

  async function transitionToNextWorldState() {
    if (state.stageMode === 'encounter_autobattler') {
      // Don't transition during combat, timer will restart after combat
      return;
    }

    // WO-WATCH-EPISODE-ROUTING: Use visual pool bias for state selection
    const nextState = getNextWorldState(state.worldState, state.currentVisualPool);
    const nextBgUrl = selectBackgroundForState(nextState);

    // WO-HUB-04: Preload next background before transition
    if (!preloadedImages.has(nextBgUrl)) {
      await preloadImage(nextBgUrl);
      preloadedImages.add(nextBgUrl);
    }

    // WO-UX-4: Update evocative captions
    const caption = getWorldStateCaption(nextState);
    state.scenicTitle = caption.title;
    state.scenicSubtitle = caption.subtitle;

    state.worldState = nextState;
    state.currentBgUrl = nextBgUrl;
    render(root, state);
    console.log(`[BadlandsStage] World state transitioned to: ${nextState}`);

    // Schedule next transition
    scheduleWorldStateTransition();
  }

  function scheduleWorldStateTransition() {
    stopWorldStateTimer();
    const delay = getRandomTransitionTime();
    state.worldStateTimerId = setTimeout(transitionToNextWorldState, delay);
    console.log(`[BadlandsStage] Next world state transition in ${(delay / 1000).toFixed(1)}s`);
  }

  function stopWorldStateTimer() {
    if (state.worldStateTimerId) {
      clearTimeout(state.worldStateTimerId);
      state.worldStateTimerId = null;
    }
  }

  // WO-HUB-04: Initialize world state background with preload and start transition timer
  const initialBgUrl = selectBackgroundForState(state.worldState);
  await preloadImage(initialBgUrl);
  preloadedImages.add(initialBgUrl);
  state.currentBgUrl = initialBgUrl;

  // WO-UX-4: Initialize evocative caption for initial state
  const initialCaption = getWorldStateCaption(state.worldState);
  state.scenicTitle = initialCaption.title;
  state.scenicSubtitle = initialCaption.subtitle;

  scheduleWorldStateTransition();

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

    // --- WO-HUB-01: Emit combat tick with explicit vitals impact ---
    if (ctx.actionBus) {
      ctx.actionBus.emit('combat:tick', {
        atMs: Date.now(),
        round: Math.ceil((state.timerTotal - state.timerRemaining) / (COMBAT_TICK_INTERVAL / 1000)),
        actor: 'enemy', // Enemy dealing damage to player
        reason: state.currentEncounter?.type ? `${state.currentEncounter.type}_attack` : 'enemy_attack',
        skillUsed: skill.id || 'basic_attack',
        damageDealt, // Damage to enemy
        damageTaken, // Damage to player
        // Explicit delta format for VitalsLedger
        healthDelta: -damageTaken,
        manaDelta: -(skill.manaCost || 0),
        staminaDelta: -(skill.staminaCost || 0),
        essenceDelta: 0,
        // Legacy format for backwards compatibility
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
      ctx.actionBus.subscribe('autobattler:spawn', async (encounter) => {
        // Pause world state transitions during combat
        stopWorldStateTimer();

        const combatBgUrl = getRandomBackground('combat', import.meta.url);

        // WO-HUB-04: Preload combat background before showing
        if (!preloadedImages.has(combatBgUrl)) {
          await preloadImage(combatBgUrl);
          preloadedImages.add(combatBgUrl);
        }

        state.stageMode = 'encounter_autobattler';
        state.currentEncounter = encounter;
        state.currentBgUrl = combatBgUrl;
        state.activeTab = 'current'; // Switch to current tab
        render(root, state);
        startEncounterTimer(); // Start countdown
      })
    );

    // Encounter resolved (from autobattler)
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:resolve', async (result) => {
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

        // WO-HUB-04: Preload world state background before showing
        const worldBgUrl = selectBackgroundForState(state.worldState);
        if (!preloadedImages.has(worldBgUrl)) {
          await preloadImage(worldBgUrl);
          preloadedImages.add(worldBgUrl);
        }

        state.stageMode = 'world';
        state.currentEncounter = null;
        state.currentBgUrl = worldBgUrl;
        render(root, state);

        // Resume world state transitions
        scheduleWorldStateTransition();
      })
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // WO-STAGE-EPISODES-V1: Episode System Subscriptions
    // ═══════════════════════════════════════════════════════════════════════════

    // Episode started
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:started', (data) => {
        state.episodeActive = true;
        state.currentEpisode = data.episode;
        state.currentIncident = data.incident;
        state.episodePhase = 'setup';
        console.log(`[BadlandsStage] Episode started: ${data.episode.id}`);
      })
    );

    // Episode phase change
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:phaseChange', (data) => {
        state.episodePhase = data.newPhase;
        state.currentIncident = data.incident; // Update incident reference
        console.log(`[BadlandsStage] Episode phase: ${data.newPhase}`);

        // WO-S3: Show unified overlay for ALL incident types when active
        if (data.newPhase === 'active') {
          // Overlay rendering is handled by episode:active event
        } else if (data.newPhase === 'resolving' || data.newPhase === 'after') {
          // Hide slow-time overlay
          state.awaitingEngagement = false;
          state.isPlayerEngaged = false;
          hideSlowTimeOverlay(root);
        }
      })
    );

    // Episode setup (show caption)
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:setup', (data) => {
        if (data.narrative?.captionIn) {
          showEpisodeCaption(root, data.narrative.captionIn);
        }
      })
    );

    // WO-S3: Episode active - show unified overlay for ALL incident types
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:active', (data) => {
        state.slowTimeTimerTotal = data.incident?.mechanics?.durationS || 30;
        state.slowTimeTimerRemaining = state.slowTimeTimerTotal;
        state.currentIncident = data.incident;
        state.overlayConfig = data.overlayConfig || data.incident?._overlayConfig;
        state.awaitingEngagement = data.awaitingEngagement !== false;
        state.isPlayerEngaged = false;

        const mechanicsMode = data.mechanicsMode || data.incident?.mechanics?.mode;
        console.log(`[BadlandsStage] Episode active - showing unified overlay (mode: ${mechanicsMode}, awaiting: ${state.awaitingEngagement})`);

        // WO-S3: Show unified overlay for ALL incidents
        renderSlowTimeOverlay(root, state);
      })
    );

    // WO-S3: Episode engaged - player chose to engage
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:engaged', (data) => {
        state.isPlayerEngaged = true;
        state.awaitingEngagement = false;
        state.currentIncident = data.incident;
        console.log('[BadlandsStage] Player engaged - updating overlay');

        // Update overlay to show tagging options (hide Engage/Skip buttons)
        renderSlowTimeOverlay(root, state);
      })
    );

    // Episode timer tick
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:timerTick', (data) => {
        state.slowTimeTimerRemaining = data.remainingMs / 1000;
        updateSlowTimeTimer(root, data.remainingMs, data.totalMs);
      })
    );

    // Episode resolved
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:resolved', (data) => {
        state.episodeActive = false;
        state.currentEpisode = null;
        state.currentIncident = null;
        state.episodePhase = null;
        hideSlowTimeOverlay(root);

        // Add to recent events (from episode)
        if (data.incident) {
          state.recentEvents.unshift({
            id: `event-${Date.now()}`,
            name: data.incident.narrative?.captionIn || 'Episode',
            icon: data.incident._enemy?.icon || '&#128176;',
            result: data.resolution?.mode === 'player' ? 'tagged' : 'auto',
            timestamp: Date.now(),
            details: `Tagged as: ${data.resolution?.choiceId || 'auto'}`,
          });
          if (state.recentEvents.length > 10) {
            state.recentEvents.pop();
          }
          render(root, state);
        }

        console.log(`[BadlandsStage] Episode resolved: ${data.episode.id}`);
      })
    );

    // WO-STAGE-EPISODES-V1: Queue status indicator
    unsubscribers.push(
      ctx.actionBus.subscribe('stageSignals:queueStatus', (data) => {
        state.queueLength = data.queueLength;
        updateQueueIndicator(root, data.queueLength);
      })
    );

    // WO-S5: Scene Beat added - update Recent Events
    unsubscribers.push(
      ctx.actionBus.subscribe('sceneBeat:added', (data) => {
        const beat = data.beat;
        if (beat && beat.display) {
          // WO-UX-NEXT: Show Resolution Echo for cause→effect visibility
          showResolutionEcho(root, beat);

          // Convert scene beat to recent event format
          state.recentEvents.unshift({
            id: beat.id,
            name: beat.display.title,
            icon: beat.display.icon,
            result: beat.resolvedBy,
            timestamp: beat.time,
            details: beat.display.choiceLabel
              ? `Tagged as: ${beat.display.choiceLabel}`
              : beat.display.subtitle,
            // WO-S5: Enhanced data from scene beat
            location: beat.display.locationLabel,
            vitalsImpact: beat.display.vitalsImpact,
            resultBadge: beat.display.resultBadge,
          });

          // Keep only last 10 events
          if (state.recentEvents.length > 10) {
            state.recentEvents.pop();
          }

          render(root, state);
        }
      })
    );

    // WO-WATCH-EPISODE-ROUTING: Activity state changed - update visual pool and caption
    unsubscribers.push(
      ctx.actionBus.subscribe('activityState:changed', (data) => {
        const newState = data.to;
        if (newState) {
          state.currentActivityState = newState;
          state.currentVisualPool = newState.visualPool || 'default';
          console.log(`[BadlandsStage] Activity state: ${newState.label}, visual pool: ${state.currentVisualPool}`);

          // Update segment caption
          updateSegmentCaption(root, newState.label);

          // Optionally trigger immediate world state transition to align with new activity
          // Only if not in combat and enough time has passed since last transition
          if (state.stageMode !== 'encounter_autobattler' && data.reason !== 'init') {
            // Check if current world state aligns with new visual pool
            const biasedStates = VISUAL_POOL_STATE_BIAS[state.currentVisualPool] || WORLD_STATE_CYCLE;
            if (!biasedStates.includes(state.worldState)) {
              // Current world state doesn't fit new activity, transition soon
              stopWorldStateTimer();
              state.worldStateTimerId = setTimeout(transitionToNextWorldState, 2000);
              console.log(`[BadlandsStage] World state doesn't fit activity, transitioning in 2s`);
            }
          }
        }
      })
    );

    // WO-WATCH-EPISODE-ROUTING: Clock tick - update time display
    unsubscribers.push(
      ctx.actionBus.subscribe('activityState:progress', (data) => {
        // Get clock state from debug (or could be passed in progress event)
        const clock = window.__MYFI_DEBUG__?.episodeClock;
        if (clock) {
          const clockState = clock.getState();
          updateSegmentCaptionTime(root, clockState.timeString, clockState.segmentLabel);
        }
      })
    );

  }

  return {
    unmount() {
      stopEncounterTimer(); // Clean up combat timer
      stopWorldStateTimer(); // Clean up world state timer
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

  // WO-HUB-02: Tab toast timeout tracker (closure reference)
  let tabToastTimeoutId = null;

  // WO-S10: Swipe navigation for tab switching
  const TABS = ['current', 'recent', 'loadout'];
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeTracking = false;

  const content = container.querySelector('.BadlandsStage__content');
  if (content) {
    content.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      swipeStartX = touch.clientX;
      swipeStartY = touch.clientY;
      swipeTracking = true;
    }, { passive: true });

    content.addEventListener('touchend', (e) => {
      if (!swipeTracking) return;
      swipeTracking = false;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - swipeStartX;
      const deltaY = touch.clientY - swipeStartY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Only horizontal swipes, minimum 50px, horizontal > vertical
      if (absDeltaX > 50 && absDeltaX > absDeltaY * 1.5) {
        const currentIndex = TABS.indexOf(state.activeTab);
        let newIndex = currentIndex;

        if (deltaX < 0 && currentIndex < TABS.length - 1) {
          // Swipe left → next tab
          newIndex = currentIndex + 1;
        } else if (deltaX > 0 && currentIndex > 0) {
          // Swipe right → previous tab
          newIndex = currentIndex - 1;
        }

        if (newIndex !== currentIndex) {
          state.activeTab = TABS[newIndex];
          render(root, state);

          // Show tab toast
          const dot = container.querySelector(`[data-tab="${TABS[newIndex]}"]`);
          if (dot) {
            const icon = dot.dataset.icon || '';
            const label = dot.dataset.label || TABS[newIndex];
            showTabToast(root, icon, label, tabToastTimeoutId, (newTimeoutId) => {
              tabToastTimeoutId = newTimeoutId;
            });
          }
        }
      }
    }, { passive: true });

    content.addEventListener('touchcancel', () => {
      swipeTracking = false;
    }, { passive: true });
  }

  // Tab/Dot switching
  container.addEventListener('click', (e) => {
    const dotBtn = e.target.closest('[data-action="switchTab"]');
    if (dotBtn) {
      const tab = dotBtn.dataset.tab;
      if (tab && tab !== state.activeTab) {
        state.activeTab = tab;
        render(root, state);

        // WO-HUB-02: Show tab toast with icon and label from dot data attributes
        const icon = dotBtn.dataset.icon || '';
        const label = dotBtn.dataset.label || tab;
        showTabToast(root, icon, label, tabToastTimeoutId, (newTimeoutId) => {
          tabToastTimeoutId = newTimeoutId;
        });
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

    // WO-STAGE-EPISODES-V1: Tagging option selection
    const taggingOption = e.target.closest('[data-action="submitTagChoice"]');
    if (taggingOption && ctx.actionBus) {
      const choiceId = taggingOption.dataset.choice;
      console.log(`[BadlandsStage] Tagging choice: ${choiceId}`);
      ctx.actionBus.emit('episode:submitChoice', { choiceId });
      return;
    }

    // WO-STAGE-EPISODES-V1: Skip tagging (let autopilot handle)
    const skipBtn = e.target.closest('[data-action="skipTagging"]');
    if (skipBtn && ctx.actionBus) {
      console.log('[BadlandsStage] Skip tagging - letting autopilot handle');
      // Emit with unknown choice to trigger auto-resolution
      ctx.actionBus.emit('episode:submitChoice', { choiceId: 'unknown' });
      return;
    }

    // WO-S3: Engage button - player chooses to engage with incident
    const engageBtn = e.target.closest('[data-action="engage"]');
    if (engageBtn && ctx.actionBus) {
      console.log('[BadlandsStage] Player engaging with incident');
      ctx.actionBus.emit('episode:engage');
      return;
    }

    // WO-S3: Skip button - player skips incident (autopilot)
    const skipIncidentBtn = e.target.closest('[data-action="skip"]');
    if (skipIncidentBtn && ctx.actionBus) {
      console.log('[BadlandsStage] Player skipping incident');
      ctx.actionBus.emit('episode:skip');
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
  // Background is managed by world state system (combat or world states: rest, patrol, explore, return, city)
  // state.currentBgUrl is set by world state transitions or combat spawn
  let stageBgUrl = state.currentBgUrl;
  if (!stageBgUrl && state.stageBgUrl) {
    // VM override (legacy support)
    stageBgUrl = new URL(state.stageBgUrl, document.baseURI).href;
  }
  if (!stageBgUrl) {
    // Fallback to current world state
    stageBgUrl = getRandomBackground(state.worldState, import.meta.url);
  }
  container.style.setProperty('--stage-bg-url', `url('${stageBgUrl}')`);

  // Set active tab
  container.dataset.activeTab = state.activeTab;
  container.dataset.stageMode = state.stageMode;

  // WO-HUB-02: Update dot navigation active state
  const dots = container.querySelectorAll('.BadlandsStage__dot');
  dots.forEach(dot => {
    dot.classList.toggle('BadlandsStage__dot--active', dot.dataset.tab === state.activeTab);
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

    // WO-UX-4: Update evocative captions
    const titleEl = root.querySelector('[data-bind="scenicTitle"]');
    const subtitleEl = root.querySelector('[data-bind="scenicSubtitle"]');
    if (titleEl) titleEl.textContent = state.scenicTitle;
    if (subtitleEl) subtitleEl.textContent = state.scenicSubtitle;
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
      <li class="BadlandsStage__recentItem" data-result="${event.result || 'auto'}">
        <div class="BadlandsStage__recentItemMain">
          <span class="BadlandsStage__recentItemIcon">${event.icon}</span>
          <div class="BadlandsStage__recentItemInfo">
            <span class="BadlandsStage__recentItemName">${event.name}</span>
            <span class="BadlandsStage__recentItemTime">${formatTimeAgo(event.timestamp)}</span>
          </div>
          ${event.resultBadge ? `
            <span class="BadlandsStage__recentItemBadge BadlandsStage__recentItemBadge--${event.resultBadge.class}">
              ${event.resultBadge.label}
            </span>
          ` : ''}
        </div>
        <div class="BadlandsStage__recentItemDetails">
          ${event.details}
          ${event.location ? `<span class="BadlandsStage__recentItemLocation">${event.location}</span>` : ''}
        </div>
        ${event.vitalsImpact ? `
          <div class="BadlandsStage__recentItemVitals">
            ${event.vitalsImpact.map(v => `
              <span class="BadlandsStage__recentItemVital BadlandsStage__recentItemVital--${v.isPositive ? 'positive' : 'negative'}">
                ${v.label}
              </span>
            `).join('')}
          </div>
        ` : ''}
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
  const timerContainer = root.querySelector('.BadlandsStage__encounterTimer');

  if (timerValue) {
    timerValue.textContent = Math.ceil(remaining);
  }
  if (timerFill && total > 0) {
    const percent = (remaining / total) * 100;
    timerFill.style.width = `${percent}%`;

    // WO-UX-2: Set urgency level for timer gradient
    const urgency = percent > 50 ? 'normal' : percent > 25 ? 'warning' : 'critical';
    timerFill.dataset.urgency = urgency;
    if (timerContainer) timerContainer.dataset.urgency = urgency;
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

/**
 * WO-HUB-02: Show tab toast with icon and label
 * Displays for 900ms then fades out (400ms CSS transition)
 */
function showTabToast(root, icon, label, currentTimeoutId, setTimeoutId) {
  const toast = root.querySelector('.BadlandsStage__tabToast');
  if (!toast) return;

  // Clear any existing timeout
  if (currentTimeoutId) {
    clearTimeout(currentTimeoutId);
  }

  // Update toast content
  const iconEl = toast.querySelector('[data-bind="tabToastIcon"]');
  const labelEl = toast.querySelector('[data-bind="tabToastLabel"]');
  if (iconEl) iconEl.innerHTML = icon;
  if (labelEl) labelEl.textContent = label;

  // Show toast
  toast.dataset.visible = 'true';

  // Hide after 900ms (CSS handles the 400ms fade out transition)
  const newTimeoutId = setTimeout(() => {
    toast.dataset.visible = 'false';
  }, 900);

  setTimeoutId(newTimeoutId);
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

// ═══════════════════════════════════════════════════════════════════════════════
// WO-STAGE-EPISODES-V1: Slow-Time Overlay Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * WO-S3: Render the unified incident overlay
 * Shows for ALL incident types with mode-specific visuals
 * - awaitingEngagement: shows Engage/Skip buttons
 * - isPlayerEngaged: shows tagging options
 */
function renderSlowTimeOverlay(root, state) {
  const overlay = root.querySelector('.BadlandsStage__slowTime');
  if (!overlay) return;

  const incident = state.currentIncident;
  if (!incident) {
    overlay.dataset.visible = 'false';
    return;
  }

  // Get overlay config (mode-specific visuals)
  const config = state.overlayConfig || incident._overlayConfig || {
    theme: 'combat',
    icon: '&#9876;',
    title: 'Incident',
    subtitle: 'Something approaches',
    engageLabel: 'Engage',
    engageHint: 'Take action',
    skipLabel: 'Skip',
    skipHint: 'Let autopilot handle',
  };

  // Set overlay theme
  overlay.dataset.theme = config.theme;

  // Update caption (narrative)
  const captionEl = root.querySelector('[data-bind="episodeCaption"]');
  if (captionEl) {
    captionEl.textContent = incident.narrative?.captionIn || config.subtitle;
  }

  // WO-S3: Show incident icon and title
  const incidentIconEl = root.querySelector('[data-bind="incidentIcon"]');
  if (incidentIconEl) {
    // For combat, show enemy icon; otherwise show overlay config icon
    const displayIcon = incident._enemy?.icon || config.icon;
    incidentIconEl.innerHTML = displayIcon;
  }

  const incidentTitleEl = root.querySelector('[data-bind="incidentTitle"]');
  if (incidentTitleEl) {
    // For combat, show enemy label; otherwise show config title
    const displayTitle = incident._enemy?.label || config.title;
    incidentTitleEl.textContent = displayTitle;
  }

  // WO-S3: Render Engage/Skip buttons OR tagging options based on state
  const actionsEl = root.querySelector('[data-bind="overlayActions"]');
  if (actionsEl) {
    if (state.awaitingEngagement && !state.isPlayerEngaged) {
      // Show Engage/Skip buttons
      actionsEl.innerHTML = `
        <button class="BadlandsStage__overlayBtn BadlandsStage__overlayBtn--engage" data-action="engage">
          <span class="BadlandsStage__overlayBtnLabel">${config.engageLabel}</span>
          <span class="BadlandsStage__overlayBtnHint">${config.engageHint}</span>
        </button>
        <button class="BadlandsStage__overlayBtn BadlandsStage__overlayBtn--skip" data-action="skip">
          <span class="BadlandsStage__overlayBtnLabel">${config.skipLabel}</span>
          <span class="BadlandsStage__overlayBtnHint">${config.skipHint}</span>
        </button>
      `;
    } else if (state.isPlayerEngaged && incident.taggingPrompt?.options) {
      // Show tagging options
      const iconMap = {
        health: '&#10084;',
        mana: '&#10024;',
        stamina: '&#9889;',
        wardfire: '&#128293;',
        unknown: '&#10067;',
      };

      actionsEl.innerHTML = `
        <div class="BadlandsStage__taggingQuestion">${incident.taggingPrompt.question}</div>
        <div class="BadlandsStage__taggingOptionsGrid">
          ${incident.taggingPrompt.options.map(opt => `
            <div class="BadlandsStage__taggingOption" data-choice="${opt.id}" data-action="submitTagChoice">
              <div class="BadlandsStage__taggingOptionIcon">${iconMap[opt.id] || '&#10067;'}</div>
              <div class="BadlandsStage__taggingOptionContent">
                <span class="BadlandsStage__taggingOptionLabel">${opt.label}</span>
                ${opt.hint ? `<span class="BadlandsStage__taggingOptionHint">${opt.hint}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <button class="BadlandsStage__overlayBtn BadlandsStage__overlayBtn--skipTag" data-action="skipTagging">
          Skip &rarr; Autopilot
        </button>
      `;
    }
  }

  // Legacy: Update tagging question element if it exists separately
  const questionEl = root.querySelector('[data-bind="taggingQuestion"]');
  if (questionEl && incident.taggingPrompt?.question && state.isPlayerEngaged) {
    questionEl.textContent = incident.taggingPrompt.question;
  }

  // Legacy: Render tagging options if separate element exists
  const optionsEl = root.querySelector('[data-bind="taggingOptions"]');
  if (optionsEl && incident.taggingPrompt?.options && state.isPlayerEngaged) {
    const iconMap = {
      health: '&#10084;',
      mana: '&#10024;',
      stamina: '&#9889;',
      wardfire: '&#128293;',
      unknown: '&#10067;',
    };

    optionsEl.innerHTML = incident.taggingPrompt.options.map(opt => `
      <div class="BadlandsStage__taggingOption" data-choice="${opt.id}" data-action="submitTagChoice">
        <div class="BadlandsStage__taggingOptionIcon">${iconMap[opt.id] || '&#10067;'}</div>
        <div class="BadlandsStage__taggingOptionContent">
          <span class="BadlandsStage__taggingOptionLabel">${opt.label}</span>
          ${opt.hint ? `<span class="BadlandsStage__taggingOptionHint">${opt.hint}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Show overlay
  overlay.dataset.visible = 'true';
}

/**
 * Hide the slow-time overlay
 */
function hideSlowTimeOverlay(root) {
  const overlay = root.querySelector('.BadlandsStage__slowTime');
  if (overlay) {
    overlay.dataset.visible = 'false';
  }
}

/**
 * Update slow-time timer display
 */
function updateSlowTimeTimer(root, remainingMs, totalMs) {
  const timerFill = root.querySelector('[data-bind="slowTimeTimerFill"]');
  const timerValue = root.querySelector('[data-bind="slowTimeTimerValue"]');
  const timerBar = root.querySelector('.BadlandsStage__slowTimeTimerBar');

  if (timerFill && totalMs > 0) {
    const percent = (remainingMs / totalMs) * 100;
    timerFill.style.width = `${percent}%`;

    // WO-UX-2: Set urgency level for timer gradient
    const urgency = percent > 50 ? 'normal' : percent > 25 ? 'warning' : 'critical';
    timerFill.dataset.urgency = urgency;
    if (timerBar) timerBar.dataset.urgency = urgency;
  }

  if (timerValue) {
    timerValue.textContent = Math.ceil(remainingMs / 1000);
  }
}

/**
 * Show episode caption (brief display)
 */
function showEpisodeCaption(root, text) {
  const captionEl = root.querySelector('[data-bind="episodeCaption"]');
  if (captionEl) {
    captionEl.textContent = text;
  }
}

/**
 * WO-UX-NEXT: Show Resolution Echo - cause→effect visibility
 * Displays a brief overlay showing what happened and its impact
 */
function showResolutionEcho(root, beat) {
  const echo = root.querySelector('.BadlandsStage__resolutionEcho');
  if (!echo || !beat?.display) return;

  // Update echo content
  const iconEl = echo.querySelector('[data-bind="echoIcon"]');
  const titleEl = echo.querySelector('[data-bind="echoTitle"]');
  const closureEl = echo.querySelector('[data-bind="echoClosure"]');
  const vitalsEl = echo.querySelector('[data-bind="echoVitals"]');

  if (iconEl) iconEl.innerHTML = beat.display.icon;
  if (titleEl) titleEl.textContent = beat.display.title;

  // Closure narrative based on resolution
  const closureLines = {
    player: ['The choice is made.', 'You decided.', 'Action taken.'],
    auto: ['The moment passes.', 'Autopilot handled it.', 'Resolved automatically.'],
    skip: ['Left behind.', 'Skipped.', 'Dismissed.'],
  };
  const lines = closureLines[beat.resolvedBy] || closureLines.auto;
  const closureLine = beat.display.subtitle || lines[Math.floor(Math.random() * lines.length)];
  if (closureEl) closureEl.textContent = closureLine;

  // Render vitals impact
  if (vitalsEl) {
    if (beat.display.vitalsImpact && beat.display.vitalsImpact.length > 0) {
      vitalsEl.innerHTML = beat.display.vitalsImpact.map(v => `
        <span class="BadlandsStage__echoVital BadlandsStage__echoVital--${v.isPositive ? 'positive' : 'negative'}">
          ${v.label}
        </span>
      `).join('');
    } else {
      vitalsEl.innerHTML = '';
    }
  }

  // Reset animation by removing and re-adding visible state
  echo.dataset.visible = 'false';
  // Force reflow to restart animation
  void echo.offsetWidth;
  echo.dataset.visible = 'true';

  // Auto-hide after animation completes (3s)
  setTimeout(() => {
    echo.dataset.visible = 'false';
  }, 3000);
}

/**
 * WO-WATCH-EPISODE-ROUTING: Update segment caption activity label
 */
function updateSegmentCaption(root, activityLabel) {
  const labelEl = root.querySelector('[data-bind="activityLabel"]');
  if (labelEl) {
    labelEl.textContent = activityLabel || 'Idle';
  }
}

/**
 * WO-WATCH-EPISODE-ROUTING: Update segment caption time and segment label
 */
function updateSegmentCaptionTime(root, timeString, segmentLabel) {
  const timeEl = root.querySelector('[data-bind="segmentTime"]');
  const segmentEl = root.querySelector('[data-bind="segmentLabel"]');
  if (timeEl) {
    timeEl.textContent = timeString || '--:--';
  }
  if (segmentEl) {
    segmentEl.textContent = segmentLabel || '--';
  }
}

/**
 * WO-STAGE-EPISODES-V1: Update queue indicator with visual dots
 * Shows 1-5 dots for queued items, then "+" for more
 */
function updateQueueIndicator(root, queueLength) {
  const indicator = root.querySelector('[data-bind="queueIndicator"]');
  const dotsContainer = root.querySelector('[data-bind="queueDots"]');

  if (!indicator || !dotsContainer) return;

  if (queueLength <= 0) {
    indicator.dataset.visible = 'false';
    return;
  }

  // Show indicator
  indicator.dataset.visible = 'true';

  // Build dots HTML (max 5 dots, then show +N)
  const maxDots = 5;
  const dotsToShow = Math.min(queueLength, maxDots);
  let dotsHtml = '';

  for (let i = 0; i < dotsToShow; i++) {
    dotsHtml += '<span class="BadlandsStage__queueDot"></span>';
  }

  // Add "+N" if more than maxDots
  if (queueLength > maxDots) {
    dotsHtml += `<span class="BadlandsStage__queueDot BadlandsStage__queueDot--plus">+${queueLength - maxDots}</span>`;
  }

  dotsContainer.innerHTML = dotsHtml;
}
