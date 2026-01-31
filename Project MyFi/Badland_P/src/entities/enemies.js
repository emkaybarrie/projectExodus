// enemies.js — Enemy Manager
// Enemy spawning, AI, projectiles, and behaviors

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
    projectileSpeed: 300,
    projectileDamage: 15,
    shootCooldown: 1800,
    score: 100,
  },
  sniper: {
    width: 32,
    height: 56,
    speed: 0,
    damage: 25,
    health: 50,
    color: '#dc2626',
    behavior: 'snipe',
    projectileSpeed: 450,
    projectileDamage: 20,
    shootCooldown: 2500,
    score: 150,
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
    projectileSpeed: 200,
    projectileDamage: 12,
    shootCooldown: 2000,
    score: 125,
  },
};

// Projectile types
const PROJECTILE_TYPES = {
  basic: {
    width: 10,
    height: 10,
    color: '#ff6b35',
    trailColor: '#ff9500',
  },
  sniper: {
    width: 16,
    height: 6,
    color: '#dc2626',
    trailColor: '#ff4444',
  },
  bomb: {
    width: 14,
    height: 14,
    color: '#ec4899',
    trailColor: '#f472b6',
  },
};

// Spawn settings
const SPAWN_INTERVAL_BASE = 3000; // ms
const SPAWN_DISTANCE = 800; // pixels ahead of player
const MAX_ENEMIES = 8;
const MAX_PROJECTILES = 20;

/**
 * Create the enemy manager
 */
export function createEnemyManager(region, events) {
  const enemies = [];
  const projectiles = []; // Enemy projectiles
  let lastSpawnTime = 0;
  let spawnInterval = SPAWN_INTERVAL_BASE;
  let difficulty = 1;
  let terrainManager = null;

  // Region-specific enemy pools - all regions now include ranged enemies
  const regionEnemies = {
    frontier: ['charger', 'jumper', 'shooter'],
    badlands: ['charger', 'jumper', 'shooter', 'sniper'],
    void: ['charger', 'jumper', 'shooter', 'sniper', 'bomber'],
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
        // Stationary, shoot periodically toward player
        const shootNow = Date.now();
        const shootCooldown = type.shootCooldown || 2000;
        if (shootNow - enemy.lastShot > shootCooldown) {
          enemy.lastShot = shootNow;
          spawnProjectile(enemy, playerPos, 'basic');
          events.emit('enemy:shoot', { enemy, targetX: playerPos.x, targetY: playerPos.y });
        }
        break;

      case 'snipe':
        // Stationary sniper - accurate, slower fire rate
        const snipeNow = Date.now();
        const snipeCooldown = type.shootCooldown || 2500;
        if (snipeNow - enemy.lastShot > snipeCooldown) {
          enemy.lastShot = snipeNow;
          spawnProjectile(enemy, playerPos, 'sniper');
          events.emit('enemy:shoot', { enemy, targetX: playerPos.x, targetY: playerPos.y });
        }
        break;

      case 'fly':
        // Fly in sine wave pattern and occasionally drop bombs
        enemy.x -= type.speed * dt;
        enemy.y = (480 - type.height - type.flyHeight) + Math.sin(Date.now() / 500) * 30;

        // Drop bombs periodically
        const flyNow = Date.now();
        const flyCooldown = type.shootCooldown || 2000;
        if (flyNow - enemy.lastShot > flyCooldown) {
          enemy.lastShot = flyNow;
          spawnProjectile(enemy, { x: enemy.x, y: 600 }, 'bomb'); // Bomb drops down
          events.emit('enemy:shoot', { enemy, targetX: enemy.x, targetY: 600 });
        }
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
   * Spawn an enemy projectile
   */
  function spawnProjectile(enemy, targetPos, projectileType = 'basic') {
    if (projectiles.length >= MAX_PROJECTILES) {
      projectiles.shift(); // Remove oldest
    }

    const type = enemy.type;
    const projType = PROJECTILE_TYPES[projectileType] || PROJECTILE_TYPES.basic;

    // Calculate direction toward target
    const startX = enemy.x + type.width / 2;
    const startY = enemy.y + type.height / 2;
    const dx = targetPos.x - startX;
    const dy = targetPos.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Normalize and apply speed
    const speed = type.projectileSpeed || 300;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    projectiles.push({
      x: startX,
      y: startY,
      vx,
      vy,
      width: projType.width,
      height: projType.height,
      color: projType.color,
      trailColor: projType.trailColor,
      damage: type.projectileDamage || 15,
      type: projectileType,
      trail: [], // For visual trail effect
      age: 0,
    });
  }

  /**
   * Update enemy projectiles
   */
  function updateProjectiles(dt, player, visibleRange) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];

      // Add trail point
      if (proj.trail.length < 8) {
        proj.trail.push({ x: proj.x, y: proj.y, age: 0 });
      }

      // Age trail points
      for (let j = proj.trail.length - 1; j >= 0; j--) {
        proj.trail[j].age += dt * 1000;
        if (proj.trail[j].age > 100) {
          proj.trail.splice(j, 1);
        }
      }

      // Move projectile
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.age += dt * 1000;

      // Bomb type has gravity
      if (proj.type === 'bomb') {
        proj.vy += 400 * dt;
      }

      // Check if off screen
      if (proj.x < visibleRange.minX - 100 ||
          proj.x > visibleRange.maxX + 100 ||
          proj.y > 700 ||
          proj.y < -100 ||
          proj.age > 5000) {
        projectiles.splice(i, 1);
        continue;
      }

      // Check collision with player
      const playerBounds = player.getBounds();
      if (rectIntersects(
        { x: proj.x - proj.width / 2, y: proj.y - proj.height / 2, width: proj.width, height: proj.height },
        playerBounds
      )) {
        // Hit player!
        if (!player.hasIframes || !player.hasIframes()) {
          player.takeDamage(proj.damage);
          events.emit('player:hit', { damage: proj.damage, source: 'projectile' });
        }
        projectiles.splice(i, 1);
      }
    }
  }

  /**
   * Render enemy projectiles
   */
  function renderProjectiles(ctx) {
    for (const proj of projectiles) {
      // Draw trail
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < proj.trail.length; i++) {
        const t = proj.trail[i];
        const alpha = 1 - (t.age / 100);
        const size = (proj.width * 0.5) * alpha;
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = proj.trailColor;
        ctx.beginPath();
        ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw projectile
      ctx.globalAlpha = 1;

      if (proj.type === 'sniper') {
        // Sniper bullet - elongated
        ctx.save();
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = proj.color;
        ctx.fillRect(-proj.width / 2, -proj.height / 2, proj.width, proj.height);
        // Core
        ctx.fillStyle = '#fff';
        ctx.fillRect(-proj.width / 4, -proj.height / 4, proj.width / 2, proj.height / 2);
        ctx.restore();
      } else if (proj.type === 'bomb') {
        // Bomb - round with fuse
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.width / 2, 0, Math.PI * 2);
        ctx.fill();
        // Fuse spark
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y - proj.width / 2 - 3, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Basic projectile - fireball style
        const gradient = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, proj.width);
        gradient.addColorStop(0, '#ffff00');
        gradient.addColorStop(0.4, proj.color);
        gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.width, 0, Math.PI * 2);
        ctx.fill();
        // Core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.width * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
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

  /**
   * Get enemy projectiles
   */
  function getProjectiles() {
    return projectiles;
  }

  return {
    update,
    render,
    getEnemies,
    getProjectiles,
    updateProjectiles,
    renderProjectiles,
    setTerrainManager,
  };
}

export default { createEnemyManager };
