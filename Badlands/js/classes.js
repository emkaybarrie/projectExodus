/**
 * BADLANDS: Character Classes
 *
 * Three archetypes with distinct mechanics:
 *
 * WARRIOR
 * - Heavy, high momentum retention
 * - Melee-focused with shield bash
 * - Slower to accelerate, harder to stop
 * - Ability: Shield Dash (invincible charge)
 *
 * MAGE
 * - Timing-sensitive abilities
 * - Ranged blasts with beat-sync bonus
 * - Medium speed, floaty jumps
 * - Ability: Time Warp (slow enemies on perfect beat)
 *
 * ROGUE
 * - Lightning fast, low momentum
 * - Dash strikes with precision bonus
 * - Quick acceleration, quick stop
 * - Ability: Shadow Step (teleport through enemies)
 *
 * Each class interacts with momentum and rhythm differently.
 */

const CharacterClasses = {
  warrior: {
    name: 'Warrior',
    color: '#d62828',
    colorSecondary: '#8b0000',

    // Movement physics
    physics: {
      maxSpeed: 8,           // Lower max speed
      acceleration: 0.3,     // Slow to accelerate
      deceleration: 0.1,     // Slow to stop (momentum retention)
      jumpForce: -14,        // Strong jump
      gravity: 0.6,          // Normal gravity
      airControl: 0.3        // Limited air control
    },

    // Combat stats
    combat: {
      attackDamage: 3,       // High base damage
      attackRange: 60,       // Melee range
      attackSpeed: 0.8,      // Slower attacks
      attackCooldown: 400    // ms between attacks
    },

    // Ability: Shield Dash
    ability: {
      name: 'Shield Dash',
      cooldown: 3000,        // 3 seconds
      duration: 500,         // 0.5 seconds of invincibility
      description: 'Charge forward, invincible and destroying enemies'
    },

    // Rhythm interaction
    rhythmBonus: {
      perfectDamage: 2.0,    // 2x damage on perfect beat
      goodDamage: 1.5,
      momentumGain: 1.5      // Gains more momentum from beat hits
    },

    // Visual
    size: { width: 40, height: 50 },
    sprite: {
      idle: '🛡️',
      run: '🏃',
      jump: '⬆️',
      attack: '⚔️',
      ability: '💥'
    }
  },

  mage: {
    name: 'Mage',
    color: '#7b2cbf',
    colorSecondary: '#4a0080',

    physics: {
      maxSpeed: 10,          // Medium speed
      acceleration: 0.5,     // Medium acceleration
      deceleration: 0.3,     // Medium deceleration
      jumpForce: -12,        // Floaty jump
      gravity: 0.45,         // Lower gravity (floaty)
      airControl: 0.6        // Good air control
    },

    combat: {
      attackDamage: 2,       // Medium damage
      attackRange: 200,      // Long range
      attackSpeed: 1.0,      // Normal speed
      attackCooldown: 300
    },

    ability: {
      name: 'Time Warp',
      cooldown: 4000,
      duration: 2000,        // 2 seconds of slow
      description: 'Slow all enemies (bonus effect on perfect beat)'
    },

    rhythmBonus: {
      perfectDamage: 3.0,    // Massive damage on perfect beat
      goodDamage: 1.8,
      momentumGain: 1.0,
      perfectAbilityBonus: true // Ability enhanced on perfect beat
    },

    size: { width: 35, height: 48 },
    sprite: {
      idle: '🔮',
      run: '🏃',
      jump: '✨',
      attack: '💫',
      ability: '⏰'
    }
  },

  rogue: {
    name: 'Rogue',
    color: '#2ec4b6',
    colorSecondary: '#1a7a6f',

    physics: {
      maxSpeed: 14,          // Very fast
      acceleration: 0.8,     // Quick acceleration
      deceleration: 0.6,     // Quick stop
      jumpForce: -11,        // Lower jump
      gravity: 0.55,         // Normal-ish gravity
      airControl: 0.8        // Excellent air control
    },

    combat: {
      attackDamage: 1.5,     // Lower damage
      attackRange: 50,       // Close range
      attackSpeed: 1.5,      // Fast attacks
      attackCooldown: 200    // Quick combos
    },

    ability: {
      name: 'Shadow Step',
      cooldown: 2000,
      distance: 150,         // Teleport distance
      description: 'Teleport through enemies, damaging them'
    },

    rhythmBonus: {
      perfectDamage: 2.5,
      goodDamage: 1.5,
      momentumGain: 0.8,     // Less momentum gain (already fast)
      perfectCritChance: 0.5 // 50% crit chance on perfect
    },

    size: { width: 30, height: 45 },
    sprite: {
      idle: '🗡️',
      run: '💨',
      jump: '🌀',
      attack: '⚡',
      ability: '👤'
    }
  }
};

/**
 * Get class by ID
 */
function getClass(classId) {
  return CharacterClasses[classId] || CharacterClasses.warrior;
}

/**
 * Get all class IDs
 */
function getClassIds() {
  return Object.keys(CharacterClasses);
}

/**
 * Calculate damage with rhythm and class bonuses
 */
function calculateDamage(classId, baseDamage, rhythmRating, combo) {
  const charClass = getClass(classId);
  let damage = baseDamage;

  // Apply rhythm bonus
  switch (rhythmRating) {
    case 'PERFECT':
      damage *= charClass.rhythmBonus.perfectDamage;
      break;
    case 'GOOD':
      damage *= charClass.rhythmBonus.goodDamage;
      break;
  }

  // Rogue crit on perfect
  if (classId === 'rogue' && rhythmRating === 'PERFECT') {
    if (Math.random() < charClass.rhythmBonus.perfectCritChance) {
      damage *= 2;
    }
  }

  // Combo bonus (small)
  damage *= 1 + (combo * 0.05);

  return Math.round(damage);
}

/**
 * Get momentum gain multiplier for class
 */
function getMomentumGain(classId, rhythmRating) {
  const charClass = getClass(classId);
  let gain = charClass.rhythmBonus.momentumGain;

  if (rhythmRating === 'PERFECT') {
    gain *= 1.5;
  } else if (rhythmRating === 'GOOD') {
    gain *= 1.2;
  }

  return gain;
}
