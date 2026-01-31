// combat.js — Combat System
// Handles attacks, damage, and hit detection

/**
 * Create the combat system
 */
export function createCombatSystem(events) {
  // Attack cooldowns
  const ATTACK_COOLDOWN = 300; // ms
  let lastAttackTime = 0;

  /**
   * Perform a ranged attack
   */
  function attack(player) {
    const now = Date.now();
    if (now - lastAttackTime < ATTACK_COOLDOWN) return null;

    lastAttackTime = now;

    // Create projectile
    const pos = player.getPosition();
    const projectile = {
      x: pos.x + player.width,
      y: pos.y + player.height / 2,
      vx: 800, // Projectile speed
      vy: 0,
      width: 20,
      height: 8,
      damage: 25,
      lifetime: 2000, // ms
      createdAt: now,
    };

    events.emit('combat:attack', { projectile });
    return projectile;
  }

  /**
   * Update combat state
   */
  function update(player, enemies) {
    // Check for player-enemy collisions
    const playerBounds = player.getBounds();

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      // Check if player hit by enemy
      if (rectIntersects(playerBounds, enemy.getBounds())) {
        if (!player.isInvulnerable()) {
          player.takeDamage(enemy.damage);
          events.emit('combat:playerHit', { enemy, damage: enemy.damage });
        }
      }

      // Check if player's attack projectile hits enemy
      // (Handled in player's projectile update)
    }
  }

  /**
   * Check rectangle intersection
   */
  function rectIntersects(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Calculate damage with modifiers
   */
  function calculateDamage(baseDamage, attacker, defender) {
    let damage = baseDamage;

    // Apply attacker buffs
    if (attacker.damageMultiplier) {
      damage *= attacker.damageMultiplier;
    }

    // Apply defender defense
    if (defender.defense) {
      damage = Math.max(1, damage - defender.defense);
    }

    return Math.floor(damage);
  }

  return {
    attack,
    update,
    calculateDamage,
  };
}

export default { createCombatSystem };
