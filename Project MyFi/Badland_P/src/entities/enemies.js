// enemies.js — Enemy Manager
// Enemy spawning, AI, and behaviors

// Enemy types
const ENEMY_TYPES = {
  charger: {
    width: 40,
    height: 40,
    speed: 150,
    damage: 15,
    health: 30,
    color: '#ef4444',
    behavior: 'charge',
    score: 50,
  },
  jumper: {
    width: 32,
    height: 32,
    speed: 100,
    damage: 10,
    health: 20,
    color: '#f97316',
    behavior: 'jump',
    score: 75,
  },
  shooter: {
    width: 36,
    height: 48,
    speed: 0,
    damage: 20,
    health: 40,
    color: '#a855f7',
    behavior: 'shoot',
    score: 100,
  },
  bomber: {
    width: 28,
    height: 28,
    speed: 80,
    damage: 25,
    health: 15,
    color: '#ec4899',
    behavior: 'fly',
    flyHeight: 100,
    score: 125,
  },
};

// Spawn settings
const SPAWN_INTERVAL_BASE = 3000; // ms
const SPAWN_DISTANCE = 800; // pixels ahead of player
const MAX_ENEMIES = 8;

/**
 * Create the enemy manager
 */
export function createEnemyManager(region, events) {
  const enemies = [];
  let lastSpawnTime = 0;
  let spawnInterval = SPAWN_INTERVAL_BASE;
  let difficulty = 1;
  let terrainManager = null;

  // Region-specific enemy pools
  const regionEnemies = {
    frontier: ['charger', 'jumper'],
    badlands: ['charger', 'jumper', 'shooter'],
    void: ['charger', 'jumper', 'shooter', 'bomber'],
  };
  const enemyPool = regionEnemies[region.id] || regionEnemies.frontier;

  /**
   * Set terrain manager for height-aware spawning
   */
  function setTerrainManager(tm) {
    terrainManager = tm;
  }

  /**
   * Update all enemies
   */
  function update(dt, player, visibleRange) {
    const playerPos = player.getPosition();

    // Try to spawn new enemy
    trySpawn(playerPos.x);

    // Update difficulty
    difficulty = 1 + (playerPos.x / 5000) * 0.5;
    spawnInterval = Math.max(1000, SPAWN_INTERVAL_BASE - difficulty * 300);

    // Update each enemy
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];

      // Update based on behavior
      updateEnemy(enemy, dt, playerPos);

      // Skip dead enemies
      if (enemy.isDead) {
        enemies.splice(i, 1);
        continue;
      }

      // Check if hit by player projectile
      const projectiles = player.getProjectiles();
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const p = projectiles[j];
        if (rectIntersects(
          { x: p.x, y: p.y, width: p.width, height: p.height },
          enemy.getBounds()
        )) {
          enemy.takeDamage(p.damage);
          projectiles.splice(j, 1);

          if (enemy.isDead) {
            enemies.splice(i, 1);
          }
          break;
        }
      }

      // Remove if too far behind
      if (enemy.x < visibleRange.minX - 200) {
        enemies.splice(i, 1);
      }
    }
  }

  /**
   * Try to spawn a new enemy
   */
  function trySpawn(playerX) {
    const now = Date.now();
    if (now - lastSpawnTime < spawnInterval) return;
    if (enemies.length >= MAX_ENEMIES) return;

    lastSpawnTime = now;

    // Pick random enemy type
    const typeKey = enemyPool[Math.floor(Math.random() * enemyPool.length)];
    const type = ENEMY_TYPES[typeKey];

    const spawnX = playerX + SPAWN_DISTANCE + Math.random() * 200;

    // Get terrain height at spawn position if terrain manager is available
    let groundY = 480;
    if (terrainManager && terrainManager.getHeightAt) {
      groundY = terrainManager.getHeightAt(spawnX);
    }

    const enemy = {
      x: spawnX,
      y: groundY - type.height - (type.flyHeight || 0),
      vx: 0,
      vy: 0,
      type,
      health: type.health,
      maxHealth: type.health,
      isAlive: true,
      isDead: false,
      damage: type.damage,
      lastShot: 0,
      jumpCooldown: 0,
      getBounds() {
        return { x: this.x, y: this.y, width: type.width, height: type.height };
      },
      takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
          this.health = 0;
          this.isDead = true;
          this.isAlive = false;
          events.emit('enemy:killed', { enemy: this, score: this.type.score });
        } else {
          events.emit('enemy:hit', { enemy: this });
        }
      },
    };

    enemies.push(enemy);
  }

  /**
   * Update single enemy based on behavior
   */
  function updateEnemy(enemy, dt, playerPos) {
    const type = enemy.type;

    switch (type.behavior) {
      case 'charge':
        // Move toward player
        if (enemy.x > playerPos.x) {
          enemy.vx = -type.speed;
        } else {
          enemy.vx = type.speed * 0.5;
        }
        enemy.x += enemy.vx * dt;
        break;

      case 'jump':
        // Jump periodically
        enemy.jumpCooldown -= dt * 1000;
        if (enemy.jumpCooldown <= 0 && enemy.y >= 480 - type.height) {
          enemy.vy = -350;
          enemy.jumpCooldown = 2000;
        }
        enemy.vy += 600 * dt; // Gravity (reduced to match player)
        enemy.y = Math.min(480 - type.height, enemy.y + enemy.vy * dt);
        // Move toward player
        if (enemy.x > playerPos.x) {
          enemy.x -= type.speed * dt;
        }
        break;

      case 'shoot':
        // Stationary, shoot periodically
        const now = Date.now();
        if (now - enemy.lastShot > 2000) {
          enemy.lastShot = now;
          events.emit('enemy:shoot', {
            x: enemy.x,
            y: enemy.y + type.height / 2,
            targetX: playerPos.x,
            targetY: playerPos.y,
          });
        }
        break;

      case 'fly':
        // Fly in sine wave pattern
        enemy.x -= type.speed * dt;
        enemy.y = (480 - type.height - type.flyHeight) + Math.sin(Date.now() / 500) * 30;
        break;
    }
  }

  /**
   * Render all enemies
   */
  function render(ctx) {
    for (const enemy of enemies) {
      const type = enemy.type;

      // Draw body
      ctx.fillStyle = type.color;
      ctx.fillRect(enemy.x, enemy.y, type.width, type.height);

      // Draw eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(enemy.x + type.width * 0.3, enemy.y + type.height * 0.3, 4, 0, Math.PI * 2);
      ctx.arc(enemy.x + type.width * 0.7, enemy.y + type.height * 0.3, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw pupils
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(enemy.x + type.width * 0.3, enemy.y + type.height * 0.3, 2, 0, Math.PI * 2);
      ctx.arc(enemy.x + type.width * 0.7, enemy.y + type.height * 0.3, 2, 0, Math.PI * 2);
      ctx.fill();

      // Health bar
      const healthPercent = enemy.health / type.health;
      ctx.fillStyle = '#333';
      ctx.fillRect(enemy.x, enemy.y - 8, type.width, 4);
      ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(enemy.x, enemy.y - 8, type.width * healthPercent, 4);
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
   * Get all enemies
   */
  function getEnemies() {
    return enemies;
  }

  return {
    update,
    render,
    getEnemies,
    setTerrainManager,
  };
}

export default { createEnemyManager };
