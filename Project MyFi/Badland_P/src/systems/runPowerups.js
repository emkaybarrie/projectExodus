// runPowerups.js — Run Power-up System
// Manages per-run power-ups with "choose 1 of 3" selection at milestones

// Power-up definitions - Stats, Passives, and Auto-Abilities
const POWERUP_POOL = [
  // ═══════════════════════════════════════════════════════════════════════════
  // STAT MODIFIERS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'speed_boost',
    name: 'Swift Stride',
    description: '+15% movement speed',
    icon: '⚡',
    rarity: 'common',
    color: '#22d3ee',
    effect: { type: 'stat', stat: 'speed', value: 0.15, mode: 'multiply' },
    weight: 3,
  },
  {
    id: 'momentum_gain',
    name: 'Flow State',
    description: '+40% momentum gain',
    icon: '🔥',
    rarity: 'common',
    color: '#f97316',
    effect: { type: 'stat', stat: 'momentumGain', value: 0.4, mode: 'multiply' },
    weight: 3,
  },
  {
    id: 'damage_boost',
    name: 'Power Strike',
    description: '+20% attack damage',
    icon: '⚔️',
    rarity: 'common',
    color: '#ef4444',
    effect: { type: 'stat', stat: 'damage', value: 0.2, mode: 'multiply' },
    weight: 3,
  },
  {
    id: 'acceleration',
    name: 'Rocket Boots',
    description: '+25% acceleration',
    icon: '🚀',
    rarity: 'common',
    color: '#f43f5e',
    effect: { type: 'stat', stat: 'acceleration', value: 0.25, mode: 'multiply' },
    weight: 3,
  },
  {
    id: 'floaty',
    name: 'Featherfall',
    description: 'Reduced gravity for floatier jumps',
    icon: '🪶',
    rarity: 'uncommon',
    color: '#e879f9',
    effect: { type: 'stat', stat: 'gravity', value: -0.15, mode: 'add' },
    weight: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSIVE ABILITIES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'triple_jump',
    name: 'Wind Walker',
    description: '+1 extra jump in air',
    icon: '🌬️',
    rarity: 'uncommon',
    color: '#a855f7',
    effect: { type: 'ability', ability: 'extraJump', value: 1 },
    weight: 2,
  },
  {
    id: 'slide_unlock',
    name: 'Parkour Slide',
    description: 'Unlock slide ability (hold down)',
    icon: '💨',
    rarity: 'uncommon',
    color: '#64748b',
    effect: { type: 'ability', ability: 'slide', value: 1 },
    weight: 2,
    unique: true,
  },
  {
    id: 'wall_jump',
    name: 'Wall Runner',
    description: 'Jump off walls once',
    icon: '🧗',
    rarity: 'rare',
    color: '#84cc16',
    effect: { type: 'ability', ability: 'wallJump', value: 1 },
    weight: 1,
    unique: true,
  },
  {
    id: 'magnet',
    name: 'Essence Magnet',
    description: 'Attract nearby essence',
    icon: '🧲',
    rarity: 'common',
    color: '#fbbf24',
    effect: { type: 'ability', ability: 'magnetRange', value: 150 },
    weight: 3,
  },
  {
    id: 'shield',
    name: 'Barrier',
    description: 'Block next hit',
    icon: '🛡️',
    rarity: 'uncommon',
    color: '#3b82f6',
    effect: { type: 'shield', charges: 1 },
    weight: 2,
  },
  {
    id: 'regen',
    name: 'Vitality',
    description: 'Regenerate health over time',
    icon: '💚',
    rarity: 'uncommon',
    color: '#22c55e',
    effect: { type: 'regen', value: 3, interval: 2500 },
    weight: 2,
  },
  {
    id: 'vampire',
    name: 'Life Steal',
    description: 'Heal on enemy defeat',
    icon: '🩸',
    rarity: 'rare',
    color: '#dc2626',
    effect: { type: 'ability', ability: 'lifeSteal', value: 10 },
    weight: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-ABILITIES (trigger automatically when conditions met)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'flying_kick',
    name: 'Flying Kick',
    description: 'Auto-kick enemies when airborne nearby',
    icon: '🦵',
    rarity: 'uncommon',
    color: '#f97316',
    effect: {
      type: 'autoAbility',
      ability: 'flyingKick',
      damage: 25,
      range: 80,
      cooldown: 1500,
      trigger: 'airborne_near_enemy',
    },
    weight: 2,
  },
  {
    id: 'sword_slash',
    name: 'Blade Dance',
    description: 'Auto-slash enemies in melee range',
    icon: '⚔️',
    rarity: 'uncommon',
    color: '#ef4444',
    effect: {
      type: 'autoAbility',
      ability: 'swordSlash',
      damage: 30,
      range: 60,
      cooldown: 1200,
      trigger: 'near_enemy',
    },
    weight: 2,
  },
  {
    id: 'fireball',
    name: 'Arcane Blast',
    description: 'Auto-launch fireball at distant enemies',
    icon: '🔥',
    rarity: 'rare',
    color: '#f43f5e',
    effect: {
      type: 'autoAbility',
      ability: 'fireball',
      damage: 40,
      range: 200,
      cooldown: 2000,
      trigger: 'ranged_enemy',
      projectileSpeed: 400,
    },
    weight: 1,
  },
  {
    id: 'dodge_roll',
    name: 'Danger Sense',
    description: 'Auto-dodge through enemies (iframes)',
    icon: '🌀',
    rarity: 'rare',
    color: '#6366f1',
    effect: {
      type: 'autoAbility',
      ability: 'dodgeRoll',
      iframeDuration: 400,
      range: 100,
      cooldown: 2500,
      trigger: 'enemy_collision',
    },
    weight: 1,
  },
  {
    id: 'ground_pound',
    name: 'Meteor Strike',
    description: 'Auto-slam down on enemies below',
    icon: '💥',
    rarity: 'rare',
    color: '#a855f7',
    effect: {
      type: 'autoAbility',
      ability: 'groundPound',
      damage: 50,
      range: 120,
      cooldown: 3000,
      trigger: 'enemy_below',
    },
    weight: 1,
  },
  {
    id: 'shockwave',
    name: 'Landing Impact',
    description: 'Shockwave on hard landing damages nearby',
    icon: '⚡',
    rarity: 'uncommon',
    color: '#22d3ee',
    effect: {
      type: 'autoAbility',
      ability: 'shockwave',
      damage: 20,
      range: 100,
      cooldown: 1000,
      trigger: 'hard_landing',
    },
    weight: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGENDARY POWER-UPS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'berserker',
    name: 'Berserker',
    description: '+50% damage & speed at low health',
    icon: '😤',
    rarity: 'legendary',
    color: '#fbbf24',
    effect: { type: 'ability', ability: 'berserker', value: 0.5, threshold: 30 },
    weight: 0.5,
    unique: true,
  },
  {
    id: 'ghost',
    name: 'Phase Shift',
    description: 'Brief invincibility after taking damage',
    icon: '👻',
    rarity: 'legendary',
    color: '#818cf8',
    effect: { type: 'ability', ability: 'phaseShift', iframeDuration: 1500 },
    weight: 0.5,
    unique: true,
  },
];

// Milestone distances for power-up selection (meters) - more frequent!
const MILESTONE_INTERVALS = [100, 150, 200, 250, 300, 350, 400]; // First at 100m, scaling up

// Rarity colors
const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#a855f7',
  legendary: '#fbbf24',
};

/**
 * Create the run power-up system
 */
export function createRunPowerupSystem(events) {
  // Active power-ups for this run
  const activePowerups = [];

  // Track which milestones have been reached
  let nextMilestoneIndex = 0;
  let nextMilestoneDistance = MILESTONE_INTERVALS[0];

  // Selection state
  let selectionPending = false;
  let selectionOptions = [];

  // Stat modifiers (accumulated from power-ups)
  const modifiers = {
    speed: 1.0,
    acceleration: 1.0,
    damage: 1.0,
    momentumGain: 1.0,
    gravity: 1.0,
  };

  // Ability flags
  const abilities = {
    extraJumps: 0,
    magnetRange: 0,
    lifeSteal: 0,
    shieldCharges: 0,
    slide: 0,
    wallJump: 0,
    berserker: 0,
    berserkerThreshold: 30,
    phaseShift: 0,
    phaseShiftDuration: 0,
  };

  // Auto-abilities (trigger automatically based on game context)
  const autoAbilities = [];
  const autoAbilityCooldowns = {}; // Track cooldown timers

  // Regen state
  let regenAmount = 0;
  let regenInterval = 0;
  let lastRegenTime = 0;

  /**
   * Reset for new run
   */
  function reset() {
    activePowerups.length = 0;
    nextMilestoneIndex = 0;
    nextMilestoneDistance = MILESTONE_INTERVALS[0];
    selectionPending = false;
    selectionOptions = [];

    // Reset modifiers
    modifiers.speed = 1.0;
    modifiers.acceleration = 1.0;
    modifiers.damage = 1.0;
    modifiers.momentumGain = 1.0;
    modifiers.gravity = 1.0;

    // Reset abilities
    abilities.extraJumps = 0;
    abilities.magnetRange = 0;
    abilities.lifeSteal = 0;
    abilities.shieldCharges = 0;
    abilities.slide = 0;
    abilities.wallJump = 0;
    abilities.berserker = 0;
    abilities.berserkerThreshold = 30;
    abilities.phaseShift = 0;
    abilities.phaseShiftDuration = 0;

    // Reset auto-abilities
    autoAbilities.length = 0;
    for (const key in autoAbilityCooldowns) {
      delete autoAbilityCooldowns[key];
    }

    regenAmount = 0;
    regenInterval = 0;
    lastRegenTime = 0;
  }

  /**
   * Update - check for milestone reached
   */
  function update(distance) {
    if (selectionPending) return; // Already waiting for selection

    if (distance >= nextMilestoneDistance) {
      triggerSelection();
    }

    // Handle regen
    if (regenAmount > 0 && regenInterval > 0) {
      const now = Date.now();
      if (now - lastRegenTime >= regenInterval) {
        lastRegenTime = now;
        events.emit('powerup:regen', { amount: regenAmount });
      }
    }
  }

  /**
   * Trigger power-up selection
   */
  function triggerSelection() {
    selectionPending = true;
    selectionOptions = getRandomPowerups(3);

    console.log('[RunPowerups] Milestone reached! Selecting from:', selectionOptions.map(p => p.name));

    events.emit('powerup:selection', {
      options: selectionOptions,
      milestone: nextMilestoneDistance,
    });
  }

  /**
   * Get N random power-ups weighted by rarity
   */
  function getRandomPowerups(count) {
    // Filter out already-acquired power-ups that can't stack
    const available = POWERUP_POOL.filter(p => {
      // Unique powerups can only be acquired once
      if (p.unique) {
        return !activePowerups.some(ap => ap.id === p.id);
      }
      // Auto-abilities can't stack
      if (p.effect.type === 'autoAbility') {
        return !activePowerups.some(ap => ap.id === p.id);
      }
      // Shield and some abilities can stack
      return true;
    });

    if (available.length < count) {
      return available;
    }

    // Weighted random selection
    const selected = [];
    const pool = [...available];

    for (let i = 0; i < count && pool.length > 0; i++) {
      const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
      let roll = Math.random() * totalWeight;

      for (let j = 0; j < pool.length; j++) {
        roll -= pool[j].weight;
        if (roll <= 0) {
          selected.push(pool[j]);
          pool.splice(j, 1);
          break;
        }
      }
    }

    return selected;
  }

  /**
   * Select a power-up from the current options
   */
  function selectPowerup(powerupId) {
    if (!selectionPending) return false;

    const powerup = selectionOptions.find(p => p.id === powerupId);
    if (!powerup) return false;

    // Add to active
    activePowerups.push(powerup);

    // Apply effect
    applyPowerupEffect(powerup);

    // Advance milestone
    nextMilestoneIndex++;
    if (nextMilestoneIndex < MILESTONE_INTERVALS.length) {
      nextMilestoneDistance += MILESTONE_INTERVALS[nextMilestoneIndex];
    } else {
      // Repeat last interval
      nextMilestoneDistance += MILESTONE_INTERVALS[MILESTONE_INTERVALS.length - 1];
    }

    // Clear selection state
    selectionPending = false;
    selectionOptions = [];

    console.log(`[RunPowerups] Selected: ${powerup.name}. Next milestone: ${nextMilestoneDistance}m`);

    events.emit('powerup:selected', { powerup });

    return true;
  }

  /**
   * Apply power-up effect
   */
  function applyPowerupEffect(powerup) {
    const { effect } = powerup;

    switch (effect.type) {
      case 'stat':
        if (effect.mode === 'multiply') {
          modifiers[effect.stat] *= (1 + effect.value);
        } else if (effect.mode === 'add') {
          modifiers[effect.stat] += effect.value;
        }
        break;

      case 'ability':
        if (effect.ability === 'extraJump') {
          abilities.extraJumps += effect.value;
        } else if (effect.ability === 'magnetRange') {
          abilities.magnetRange = Math.max(abilities.magnetRange, effect.value);
        } else if (effect.ability === 'lifeSteal') {
          abilities.lifeSteal += effect.value;
        } else if (effect.ability === 'slide') {
          abilities.slide = 1;
        } else if (effect.ability === 'wallJump') {
          abilities.wallJump = 1;
        } else if (effect.ability === 'berserker') {
          abilities.berserker = effect.value;
          abilities.berserkerThreshold = effect.threshold;
        } else if (effect.ability === 'phaseShift') {
          abilities.phaseShift = 1;
          abilities.phaseShiftDuration = effect.iframeDuration;
        }
        break;

      case 'shield':
        abilities.shieldCharges += effect.charges;
        break;

      case 'regen':
        regenAmount += effect.value;
        regenInterval = effect.interval;
        lastRegenTime = Date.now();
        break;

      case 'autoAbility':
        // Register the auto-ability
        autoAbilities.push({
          id: powerup.id,
          name: powerup.name,
          icon: powerup.icon,
          ability: effect.ability,
          damage: effect.damage || 0,
          range: effect.range || 100,
          cooldown: effect.cooldown || 2000,
          trigger: effect.trigger,
          projectileSpeed: effect.projectileSpeed || 0,
          iframeDuration: effect.iframeDuration || 0,
        });
        autoAbilityCooldowns[powerup.id] = 0; // Ready immediately
        console.log(`[RunPowerups] Auto-ability registered: ${powerup.name}`);
        break;
    }
  }

  /**
   * Consume a shield charge (returns true if blocked)
   */
  function consumeShield() {
    if (abilities.shieldCharges > 0) {
      abilities.shieldCharges--;
      events.emit('powerup:shieldUsed', { remaining: abilities.shieldCharges });
      return true;
    }
    return false;
  }

  /**
   * Get modifier value
   */
  function getModifier(stat) {
    return modifiers[stat] || 1.0;
  }

  /**
   * Get ability value
   */
  function getAbility(ability) {
    return abilities[ability] || 0;
  }

  /**
   * Check if selection is pending
   */
  function isSelectionPending() {
    return selectionPending;
  }

  /**
   * Get current selection options
   */
  function getSelectionOptions() {
    return selectionOptions;
  }

  /**
   * Get all active power-ups
   */
  function getActivePowerups() {
    return [...activePowerups];
  }

  /**
   * Get next milestone distance
   */
  function getNextMilestone() {
    return nextMilestoneDistance;
  }

  /**
   * Check and trigger auto-abilities based on game context
   * Returns an array of triggered abilities
   */
  function checkAutoAbilities(context) {
    const { player, enemies, dt } = context;
    const triggered = [];
    const now = Date.now();

    // Update cooldowns
    for (const ability of autoAbilities) {
      const cooldownEnd = autoAbilityCooldowns[ability.id] || 0;
      if (now < cooldownEnd) continue; // Still on cooldown

      // Check trigger conditions
      let shouldTrigger = false;
      let target = null;

      switch (ability.trigger) {
        case 'near_enemy':
          // Trigger when grounded and enemy within melee range
          if (player.isGrounded) {
            target = findNearestEnemy(enemies, player, ability.range);
            shouldTrigger = !!target;
          }
          break;

        case 'airborne_near_enemy':
          // Trigger when airborne and enemy within range
          if (!player.isGrounded) {
            target = findNearestEnemy(enemies, player, ability.range);
            shouldTrigger = !!target;
          }
          break;

        case 'ranged_enemy':
          // Trigger when enemy at medium-long range
          target = findNearestEnemy(enemies, player, ability.range, 80); // min 80px away
          shouldTrigger = !!target;
          break;

        case 'enemy_collision':
          // Trigger when about to collide with enemy
          target = findCollidingEnemy(enemies, player, ability.range);
          shouldTrigger = !!target;
          break;

        case 'enemy_below':
          // Trigger when airborne with enemy below
          if (!player.isGrounded && player.vy > 0) {
            target = findEnemyBelow(enemies, player, ability.range);
            shouldTrigger = !!target;
          }
          break;

        case 'hard_landing':
          // Trigger on landing with significant velocity
          if (player.justLanded && player.landingVelocity > 300) {
            shouldTrigger = true;
          }
          break;
      }

      if (shouldTrigger) {
        // Start cooldown
        autoAbilityCooldowns[ability.id] = now + ability.cooldown;

        triggered.push({
          ...ability,
          target,
          playerX: player.x,
          playerY: player.y,
        });

        console.log(`[AutoAbility] Triggered: ${ability.name}`);
      }
    }

    return triggered;
  }

  /**
   * Find nearest enemy within range
   */
  function findNearestEnemy(enemies, player, maxRange, minRange = 0) {
    let nearest = null;
    let nearestDist = maxRange + 1;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= minRange && dist <= maxRange && dist < nearestDist) {
        // Only target enemies ahead of player (positive X direction)
        if (dx > 0) {
          nearest = enemy;
          nearestDist = dist;
        }
      }
    }

    return nearest;
  }

  /**
   * Find enemy about to collide with player
   */
  function findCollidingEnemy(enemies, player, range) {
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.x - player.x;
      const dy = Math.abs(enemy.y - player.y);

      // Check if enemy is ahead and at similar height
      if (dx > 0 && dx < range && dy < 50) {
        return enemy;
      }
    }
    return null;
  }

  /**
   * Find enemy below player
   */
  function findEnemyBelow(enemies, player, range) {
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = Math.abs(enemy.x - player.x);
      const dy = enemy.y - player.y;

      // Check if enemy is below and roughly aligned horizontally
      if (dy > 20 && dy < range && dx < 60) {
        return enemy;
      }
    }
    return null;
  }

  /**
   * Get all auto-abilities (for display/debug)
   */
  function getAutoAbilities() {
    return [...autoAbilities];
  }

  /**
   * Check if an auto-ability is on cooldown
   */
  function isOnCooldown(abilityId) {
    const cooldownEnd = autoAbilityCooldowns[abilityId] || 0;
    return Date.now() < cooldownEnd;
  }

  /**
   * Get cooldown remaining (0-1 ratio)
   */
  function getCooldownRatio(abilityId) {
    const ability = autoAbilities.find(a => a.id === abilityId);
    if (!ability) return 0;

    const cooldownEnd = autoAbilityCooldowns[abilityId] || 0;
    const remaining = cooldownEnd - Date.now();

    if (remaining <= 0) return 0;
    return remaining / ability.cooldown;
  }

  return {
    reset,
    update,
    selectPowerup,
    consumeShield,
    getModifier,
    getAbility,
    isSelectionPending,
    getSelectionOptions,
    getActivePowerups,
    getNextMilestone,
    checkAutoAbilities,
    getAutoAbilities,
    isOnCooldown,
    getCooldownRatio,
    RARITY_COLORS,
  };
}

export default { createRunPowerupSystem };
