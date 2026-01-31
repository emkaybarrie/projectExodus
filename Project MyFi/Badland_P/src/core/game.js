// game.js — Main Game Controller
// Badlands Runner - Endless Parkour Adventure

import { createGameLoop } from './loop.js';
import { createEventBus } from './events.js';
import { createStorage } from './storage.js';
import { createPhysics } from '../systems/physics.js';
import { createPlayer } from '../entities/player.js';
import { createPlatformManager } from '../entities/platforms.js';
import { createEnemyManager } from '../entities/enemies.js';
import { createPickupManager } from '../entities/pickups.js';
import { createRenderer } from '../rendering/renderer.js';
import { createCamera } from '../rendering/camera.js';
import { createParticles } from '../rendering/particles.js';
import { createParallax } from '../rendering/parallax.js';
import { createInputManager } from '../input/input.js';
import { createCombatSystem } from '../systems/combat.js';
import { createRoguelikeSystem } from '../systems/roguelike.js';
import { createRunPowerupSystem } from '../systems/runPowerups.js';

// Game states
const STATES = {
  TITLE: 'title',
  CLASS: 'class',
  SELECT: 'select',
  LOADOUT: 'loadout',
  PLAYING: 'playing',
  PAUSED: 'paused',
  RESULTS: 'results',
};

// Class definitions
const CLASSES = [
  {
    id: 'drifter',
    name: 'Drifter',
    title: 'The Wanderer',
    icon: '🏃',
    description: 'A balanced runner who excels at maintaining momentum across any terrain.',
    unlocked: true,
    stats: { speed: 5, health: 5, power: 5 },
    modifiers: { speedMult: 1.0, healthMult: 1.0, damageMult: 1.0, momentumGain: 1.0 },
  },
  {
    id: 'warden',
    name: 'Warden',
    title: 'The Protector',
    icon: '🛡️',
    description: 'Heavy armor reduces damage but slows momentum gain. Survives longer falls.',
    unlocked: true,
    stats: { speed: 3, health: 8, power: 4 },
    modifiers: { speedMult: 0.85, healthMult: 1.6, damageMult: 0.9, momentumGain: 0.7, fallDamageReduction: 0.4 },
  },
  {
    id: 'striker',
    name: 'Striker',
    title: 'The Blade',
    icon: '⚔️',
    description: 'Swift attacks and high damage, but fragile. Momentum builds faster.',
    unlocked: true,
    stats: { speed: 7, health: 3, power: 7 },
    modifiers: { speedMult: 1.2, healthMult: 0.6, damageMult: 1.4, momentumGain: 1.3 },
  },
  {
    id: 'mystic',
    name: 'Mystic',
    title: 'The Enigma',
    icon: '✨',
    description: 'Harness arcane energy for powerful abilities. Reach the Void to unlock.',
    unlocked: false,
    stats: { speed: 4, health: 4, power: 9 },
    modifiers: { speedMult: 0.95, healthMult: 0.8, damageMult: 1.8, momentumGain: 1.1, abilityPower: 1.5 },
  },
];

// Region definitions
const REGIONS = [
  { id: 'frontier', name: 'Frontier', icon: '🏜️', difficulty: 'Easy', unlocked: true, color: '#fb923c' },
  { id: 'badlands', name: 'Badlands', icon: '🌋', difficulty: 'Medium', unlocked: false, color: '#ef4444' },
  { id: 'void', name: 'The Void', icon: '🌌', difficulty: 'Hard', unlocked: false, color: '#a855f7' },
];

/**
 * Create the main game instance
 */
function createGame() {
  // Core systems
  const events = createEventBus();
  const storage = createStorage();
  const physics = createPhysics();

  // Get canvas
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // Create subsystems
  const renderer = createRenderer(canvas, ctx);
  const camera = createCamera(canvas.width, canvas.height);
  const particles = createParticles();
  const parallax = createParallax();
  const input = createInputManager(canvas, events);
  const combat = createCombatSystem(events);
  const roguelike = createRoguelikeSystem(storage);
  const runPowerups = createRunPowerupSystem(events);

  // Create entities
  let player = null;
  let platforms = null;
  let enemies = null;
  let pickups = null;

  // Game state
  let state = STATES.TITLE;
  let selectedClass = CLASSES[0];
  let selectedRegion = REGIONS[0];
  let runStats = { distance: 0, score: 0, essence: 0, week: 0, day: 0, isWeekend: false };
  let isPaused = false;
  let isPowerupSelectionActive = false;
  let currentZone = 0;
  let currentWeek = 0;

  // Game loop
  const loop = createGameLoop({
    update: (dt) => update(dt),
    render: () => render(),
  });

  /**
   * Initialize the game
   */
  function init() {
    // Resize canvas to fill container
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize input
    input.init();

    // Bind UI buttons
    bindUI();

    // Load save data
    roguelike.load();

    // Update region unlock status
    updateRegionUnlocks();

    // Show title screen
    showScreen('title');

    console.log('[Game] Initialized');
  }

  /**
   * Resize canvas to fill container
   */
  function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    camera.resize(canvas.width, canvas.height);
    parallax.resize(canvas.width, canvas.height);
  }

  /**
   * Bind UI button handlers
   */
  function bindUI() {
    // Title screen -> Class selection
    document.getElementById('btn-start')?.addEventListener('click', () => {
      showScreen('class');
    });

    // Class selection - back to title
    document.getElementById('btn-back-title')?.addEventListener('click', () => {
      showScreen('title');
    });
    document.getElementById('btn-confirm-class')?.addEventListener('click', () => {
      showScreen('select');
    });

    // Region selection - back to class
    document.getElementById('btn-back-class')?.addEventListener('click', () => {
      showScreen('class');
    });

    // Loadout
    document.getElementById('btn-back-select')?.addEventListener('click', () => {
      showScreen('select');
    });
    document.getElementById('btn-run')?.addEventListener('click', () => {
      startRun();
    });

    // Pause
    document.getElementById('btn-pause-hud')?.addEventListener('click', () => {
      pauseGame();
    });
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      resumeGame();
    });
    document.getElementById('btn-quit')?.addEventListener('click', () => {
      endRun(false);
    });

    // Results
    document.getElementById('btn-retry')?.addEventListener('click', () => {
      startRun();
    });
    document.getElementById('btn-menu')?.addEventListener('click', () => {
      showScreen('title');
    });

    // Pause on escape
    events.on('input:pause', () => {
      if (state === STATES.PLAYING && !isPowerupSelectionActive) {
        pauseGame();
      } else if (state === STATES.PAUSED) {
        resumeGame();
      }
    });

    // Power-up selection events
    events.on('powerup:selection', ({ options }) => {
      showPowerupSelection(options);
    });

    events.on('powerup:selected', ({ powerup }) => {
      hidePowerupSelection();
    });

    // Power-up regen effect
    events.on('powerup:regen', ({ amount }) => {
      if (player) {
        // Heal the player (negative damage)
        player.takeDamage(-amount);
      }
    });
  }

  /**
   * Show power-up selection UI
   */
  function showPowerupSelection(options) {
    isPowerupSelectionActive = true;
    loop.stop(); // Pause the game during selection

    const overlay = document.getElementById('powerup-selection');
    const optionsContainer = document.getElementById('powerup-options');

    if (!overlay || !optionsContainer) return;

    // Render power-up cards
    optionsContainer.innerHTML = options.map(powerup => `
      <div class="powerup-card" data-rarity="${powerup.rarity}" data-id="${powerup.id}">
        <div class="powerup-icon">${powerup.icon}</div>
        <div class="powerup-name">${powerup.name}</div>
        <div class="powerup-desc">${powerup.description}</div>
        <div class="powerup-rarity">${powerup.rarity}</div>
      </div>
    `).join('');

    // Bind click handlers
    optionsContainer.querySelectorAll('.powerup-card').forEach(card => {
      card.addEventListener('click', () => {
        const powerupId = card.dataset.id;
        runPowerups.selectPowerup(powerupId);
      });
    });

    overlay.classList.remove('hidden');
  }

  /**
   * Hide power-up selection UI
   */
  function hidePowerupSelection() {
    isPowerupSelectionActive = false;
    const overlay = document.getElementById('powerup-selection');
    if (overlay) {
      overlay.classList.add('hidden');
    }
    loop.start(); // Resume the game
  }

  /**
   * Show a specific screen
   */
  function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

    // Show target screen
    const screen = document.getElementById(`screen-${screenId}`);
    if (screen) {
      screen.classList.remove('hidden');
    }

    // Update state
    switch (screenId) {
      case 'title':
        state = STATES.TITLE;
        loop.stop();
        break;
      case 'class':
        state = STATES.CLASS;
        populateClasses();
        break;
      case 'select':
        state = STATES.SELECT;
        populateRegions();
        break;
      case 'loadout':
        state = STATES.LOADOUT;
        populateLoadout();
        break;
      case 'pause':
        state = STATES.PAUSED;
        break;
      case 'results':
        state = STATES.RESULTS;
        populateResults();
        break;
    }

    // Hide/show HUD
    const hud = document.getElementById('hud');
    const touchZones = document.getElementById('touch-zones');
    if (screenId === 'playing') {
      hud?.classList.remove('hidden');
      touchZones?.classList.remove('hidden');
    } else {
      hud?.classList.add('hidden');
      touchZones?.classList.add('hidden');
    }
  }

  /**
   * Populate class selection grid
   */
  function populateClasses() {
    const grid = document.getElementById('class-grid');
    if (!grid) return;

    // Update unlock status from progress
    updateClassUnlocks();

    grid.innerHTML = CLASSES.map(cls => `
      <div class="class-card ${cls.unlocked ? '' : 'locked'} ${selectedClass.id === cls.id ? 'selected' : ''}" data-class="${cls.id}">
        ${!cls.unlocked ? '<span class="class-lock-icon">🔒</span>' : ''}
        <div class="class-avatar">${cls.icon}</div>
        <div class="class-name">${cls.name}</div>
        <div class="class-title">${cls.title}</div>
        <div class="class-desc">${cls.description}</div>
        <div class="class-stats">
          <div class="class-stat">
            <span class="class-stat-value">${cls.unlocked ? cls.stats.speed : '?'}</span>
            <span class="class-stat-label">Speed</span>
          </div>
          <div class="class-stat">
            <span class="class-stat-value">${cls.unlocked ? cls.stats.health : '?'}</span>
            <span class="class-stat-label">Health</span>
          </div>
          <div class="class-stat">
            <span class="class-stat-value">${cls.unlocked ? cls.stats.power : '?'}</span>
            <span class="class-stat-label">Power</span>
          </div>
        </div>
      </div>
    `).join('');

    // Bind click handlers
    grid.querySelectorAll('.class-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        const classId = card.dataset.class;
        selectedClass = CLASSES.find(c => c.id === classId) || CLASSES[0];

        // Update visual selection
        grid.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  }

  /**
   * Update class unlock status based on progression
   */
  function updateClassUnlocks() {
    const progress = roguelike.getProgress();
    // Mystic unlocks when player has reached the Void region
    CLASSES[3].unlocked = progress.regionsUnlocked >= 2;
  }

  /**
   * Populate region selection grid
   */
  function populateRegions() {
    const grid = document.getElementById('region-grid');
    if (!grid) return;

    grid.innerHTML = REGIONS.map(region => `
      <div class="region-card ${region.unlocked ? '' : 'locked'}" data-region="${region.id}">
        <div class="region-icon">${region.icon}</div>
        <div class="region-name">${region.name}</div>
        <div class="region-difficulty">${region.difficulty}</div>
      </div>
    `).join('');

    // Bind click handlers
    grid.querySelectorAll('.region-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        const regionId = card.dataset.region;
        selectedRegion = REGIONS.find(r => r.id === regionId) || REGIONS[0];
        showScreen('loadout');
      });
    });
  }

  /**
   * Populate loadout screen
   */
  function populateLoadout() {
    const grid = document.getElementById('loadout-grid');
    if (!grid) return;

    const loadout = roguelike.getLoadout();
    grid.innerHTML = `
      <div class="loadout-slot ${loadout.weapon ? 'active' : ''}">
        <div class="slot-icon">⚔️</div>
        <div class="slot-name">${loadout.weapon || 'No Weapon'}</div>
      </div>
      <div class="loadout-slot ${loadout.armor ? 'active' : ''}">
        <div class="slot-icon">🛡️</div>
        <div class="slot-name">${loadout.armor || 'No Armor'}</div>
      </div>
      <div class="loadout-slot ${loadout.charm ? 'active' : ''}">
        <div class="slot-icon">💎</div>
        <div class="slot-name">${loadout.charm || 'No Charm'}</div>
      </div>
    `;
  }

  /**
   * Populate results screen
   */
  function populateResults() {
    document.getElementById('result-distance').textContent = `${Math.floor(runStats.distance)}m`;
    document.getElementById('result-score').textContent = runStats.score.toLocaleString();
    document.getElementById('result-essence').textContent = `+${runStats.essence}`;
  }

  /**
   * Update region unlock status based on progression
   */
  function updateRegionUnlocks() {
    const progress = roguelike.getProgress();
    REGIONS[1].unlocked = progress.regionsUnlocked >= 1;
    REGIONS[2].unlocked = progress.regionsUnlocked >= 2;
  }

  /**
   * Start a new run
   */
  function startRun() {
    // Reset run stats
    runStats = { distance: 0, score: 0, essence: 0 };
    currentZone = 0;

    // Reset run power-ups for new run
    runPowerups.reset();
    isPowerupSelectionActive = false;

    // Initialize entities for this run (pass class modifiers and runPowerups for modifier queries)
    const loadoutWithClass = {
      ...roguelike.getLoadout(),
      classId: selectedClass.id,
      classModifiers: selectedClass.modifiers,
    };
    player = createPlayer(events, physics, loadoutWithClass, runPowerups);
    platforms = createPlatformManager(selectedRegion);
    enemies = createEnemyManager(selectedRegion, events);
    enemies.setTerrainManager(platforms); // Pass terrain manager for height-aware spawning
    pickups = createPickupManager(events);

    // Initialize parallax for region
    parallax.setRegion(selectedRegion);

    // Reset camera
    camera.reset();

    // Hide screens, show HUD
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud')?.classList.remove('hidden');

    // Show touch zones with visible hints initially
    const touchZonesEl = document.getElementById('touch-zones');
    if (touchZonesEl) {
      touchZonesEl.classList.remove('hidden', 'touch-hints-hidden');
      // Fade out hints after 5 seconds for cleaner gameplay
      setTimeout(() => {
        touchZonesEl.classList.add('touch-hints-hidden');
      }, 5000);
    }

    document.getElementById('powerup-selection')?.classList.add('hidden');

    // Start game loop
    state = STATES.PLAYING;
    isPaused = false;
    loop.start();

    console.log(`[Game] Starting run in ${selectedRegion.name}`);
  }

  /**
   * Pause the game
   */
  function pauseGame() {
    if (state !== STATES.PLAYING) return;
    isPaused = true;
    loop.stop();
    showScreen('pause');
  }

  /**
   * Resume the game
   */
  function resumeGame() {
    if (state !== STATES.PAUSED) return;
    isPaused = false;
    state = STATES.PLAYING;
    document.getElementById('screen-pause')?.classList.add('hidden');
    document.getElementById('hud')?.classList.remove('hidden');
    document.getElementById('touch-zones')?.classList.remove('hidden');
    loop.start();
  }

  /**
   * End the current run
   */
  function endRun(completed = true) {
    loop.stop();

    // Calculate final essence reward
    runStats.essence = Math.floor(runStats.distance * 0.1 + runStats.score * 0.01);

    // Save progress
    if (completed) {
      roguelike.addEssence(runStats.essence);
      roguelike.recordRun(runStats);
      roguelike.save();
    }

    // Show results
    showScreen('results');

    console.log(`[Game] Run ended. Distance: ${runStats.distance}m, Score: ${runStats.score}`);
  }

  /**
   * Execute an auto-ability
   */
  function executeAutoAbility(ability, enemyManager) {
    const damageMultiplier = runPowerups.getModifier('damage');

    switch (ability.ability) {
      case 'flyingKick':
      case 'swordSlash':
      case 'groundPound':
        // Direct damage to target enemy
        if (ability.target) {
          const damage = Math.round(ability.damage * damageMultiplier);
          ability.target.takeDamage(damage);
          particles.spawn(ability.target.x, ability.target.y, 'hit', { color: '#ff6b35' });
          events.emit('ability:hit', { ability: ability.name, damage });
        }
        break;

      case 'fireball':
        // Spawn a projectile (handled by combat system)
        if (ability.target) {
          events.emit('ability:projectile', {
            type: 'fireball',
            x: ability.playerX + 30,
            y: ability.playerY,
            targetX: ability.target.x,
            targetY: ability.target.y,
            damage: Math.round(ability.damage * damageMultiplier),
            speed: ability.projectileSpeed,
          });
        }
        break;

      case 'dodgeRoll':
        // Grant iframes to player
        if (player) {
          player.grantIframes(ability.iframeDuration);
          particles.spawn(ability.playerX, ability.playerY, 'dodge', { color: '#6366f1' });
          events.emit('ability:dodge', { duration: ability.iframeDuration });
        }
        break;

      case 'shockwave':
        // Damage all enemies in range
        const enemies = enemyManager.getEnemies();
        const shockDamage = Math.round(ability.damage * damageMultiplier);
        for (const enemy of enemies) {
          if (enemy.isDead) continue;
          const dx = enemy.x - ability.playerX;
          const dy = enemy.y - ability.playerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= ability.range) {
            enemy.takeDamage(shockDamage);
          }
        }
        particles.spawn(ability.playerX, ability.playerY + 20, 'shockwave', { color: '#22d3ee', radius: ability.range });
        events.emit('ability:shockwave', { damage: shockDamage, range: ability.range });
        break;
    }
  }

  /**
   * Main update loop
   */
  function update(dt) {
    if (state !== STATES.PLAYING || isPaused || isPowerupSelectionActive) return;

    // Update and get input state
    input.update();
    const inputState = input.getState();

    // Update player (pass terrain manager for slope physics and fall detection)
    player.update(dt, inputState, platforms.getPlatforms(), platforms);

    // Check player death
    if (player.isDead()) {
      endRun(true);
      return;
    }

    // Update camera to follow player
    camera.follow(player.getPosition(), dt);

    // Update platforms (procedural generation)
    platforms.update(camera.getVisibleRange());

    // Update enemies
    enemies.update(dt, player, camera.getVisibleRange());

    // Update pickups
    pickups.update(dt, player, camera.getVisibleRange());

    // Update particles
    particles.update(dt);

    // Update combat (check for hits)
    combat.update(player, enemies.getEnemies());

    // Check auto-abilities (flying kick, sword slash, fireball, etc.)
    const playerState = player.getState();
    const triggeredAbilities = runPowerups.checkAutoAbilities({
      player: {
        x: playerState.x,
        y: playerState.y,
        vx: playerState.vx,
        vy: playerState.vy,
        isGrounded: playerState.isGrounded,
        justLanded: playerState.justLanded,
        landingVelocity: playerState.landingVelocity || 0,
      },
      enemies: enemies.getEnemies(),
      dt,
    });

    // Execute triggered auto-abilities
    for (const ability of triggeredAbilities) {
      executeAutoAbility(ability, enemies);
    }

    // Update run stats
    runStats.distance = player.getDistance();
    runStats.score = player.getScore();

    // Check for zone changes (background transitions)
    const newZone = platforms.getZoneIndex();
    if (newZone !== currentZone) {
      currentZone = newZone;
      parallax.setZone(newZone);
      console.log(`[Game] Entering zone ${newZone + 1}`);
    }

    // Track weekly progress (for roguelike cycle)
    const newWeek = platforms.getWeekIndex();
    if (newWeek !== currentWeek) {
      currentWeek = newWeek;
      console.log(`[Game] Starting week ${newWeek + 1}`);
      // Trigger weekly roguelike event
      events.emit('week:start', { week: newWeek + 1 });
    }

    // Update run stats with weekly info
    const playerX = player.getPosition().x;
    const isWeekend = platforms.isWeekendSection(playerX);
    const dayInWeek = Math.floor((playerX % (800 * 7)) / 800) + 1; // 1-7
    runStats.week = currentWeek + 1;
    runStats.day = dayInWeek;
    runStats.isWeekend = isWeekend;

    // Update parallax transitions
    parallax.update(dt);

    // Check for power-up milestones
    runPowerups.update(runStats.distance);

    // Update HUD
    updateHUD();
  }

  /**
   * Update HUD display
   */
  function updateHUD() {
    const scoreEl = document.getElementById('hud-score');
    const distanceEl = document.getElementById('hud-distance');
    const healthEl = document.getElementById('health-fill');
    const momentumEl = document.getElementById('momentum-fill');
    const speedEl = document.getElementById('speed-fill');
    const powerupsEl = document.getElementById('hud-powerups');
    const weekEl = document.getElementById('hud-week');

    if (scoreEl) scoreEl.textContent = runStats.score.toLocaleString();
    if (distanceEl) distanceEl.textContent = `${Math.floor(runStats.distance)}m`;
    if (healthEl) healthEl.style.width = `${player.getHealth()}%`;
    if (momentumEl) momentumEl.style.width = `${player.getMomentum()}%`;

    // Speed bar shows INPUT speed (throttle position: 10-100%)
    // This lets the player see their direct control
    if (speedEl && player.getInputRatio) {
      const inputPercent = player.getInputRatio() * 100;
      speedEl.style.width = `${inputPercent}%`;
    }

    // Week/day indicator
    if (weekEl) {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dayName = dayNames[(runStats.day - 1) % 7] || 'Mon';
      const sectionType = runStats.isWeekend ? 'BRIDGE' : 'TERRAIN';
      weekEl.innerHTML = `
        <span class="week-number">W${runStats.week}</span>
        <span class="day-indicator ${runStats.isWeekend ? 'weekend' : ''}">${dayName}</span>
        <span class="section-type">${sectionType}</span>
      `;
    }

    // Update active power-ups display (only update when changed)
    if (powerupsEl) {
      const activePowerups = runPowerups.getActivePowerups();
      const currentHtml = powerupsEl.innerHTML;
      const newHtml = activePowerups.map(p => `
        <div class="hud-powerup-badge" style="--badge-color: ${p.color}">
          <span class="hud-powerup-icon">${p.icon}</span>
          <span class="hud-powerup-name">${p.name}</span>
        </div>
      `).join('');

      if (currentHtml !== newHtml) {
        powerupsEl.innerHTML = newHtml;
      }
    }
  }

  /**
   * Main render loop
   */
  function render() {
    // Clear canvas
    renderer.clear();

    // Get camera transform
    const cameraOffset = camera.getOffset();

    // Render parallax background
    parallax.render(ctx, cameraOffset.x);

    // Begin camera transform
    ctx.save();
    ctx.translate(-cameraOffset.x, -cameraOffset.y);

    // Render platforms
    platforms.render(ctx);

    // Render pickups
    pickups.render(ctx);

    // Render enemies
    enemies.render(ctx);

    // Render player
    player.render(ctx);

    // Render particles
    particles.render(ctx);

    // End camera transform
    ctx.restore();
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Return public API
  return {
    getState: () => state,
    getEvents: () => events,
    pause: pauseGame,
    resume: resumeGame,
  };
}

// Create and start the game
const game = createGame();

// Expose for debugging
window.__BADLANDS_GAME__ = game;

export default game;
