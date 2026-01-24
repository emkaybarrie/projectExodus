/**
 * BADLANDS: Level Generation
 *
 * Procedural level generation coupled to rhythm.
 *
 * Rhythm Coupling:
 * - Platforms spawn on beats
 * - Gaps are timed to beat intervals
 * - Enemies spawn on downbeats
 * - Obstacles follow musical patterns (every 2, 4, 8 beats)
 *
 * Difficulty Escalation:
 * - Speed increases over distance
 * - Gaps get wider
 * - More enemies per downbeat
 * - Tighter timing required
 */

const Level = (() => {
  // Level elements
  let platforms = [];
  let enemies = [];
  let obstacles = [];
  let powerUps = [];
  let particles = [];

  // Generation state
  let lastPlatformX = 0;
  let lastEnemyBeat = -4;
  let lastObstacleBeat = -4;
  let difficulty = 1;
  let distanceTraveled = 0;

  // Config - Ground Y is computed dynamically based on screen size
  let GROUND_Y = 400;
  const PLATFORM_MIN_WIDTH = 120;
  const PLATFORM_MAX_WIDTH = 350;
  const GAP_MIN = 100;           // Minimum gap (easy jump)
  const GAP_MAX = 280;           // Maximum gap (requires good timing)
  const VIEW_AHEAD = 1000;
  const CLEANUP_BEHIND = 300;

  // Platform pattern types for variety
  const PLATFORM_PATTERNS = ['flat', 'stairs_up', 'stairs_down', 'gap_challenge', 'floating'];
  let currentPattern = 'flat';
  let patternProgress = 0;

  // Enemy types
  const ENEMY_TYPES = {
    crawler: {
      width: 40,
      height: 30,
      speed: 0,
      health: 1,
      damage: 1,
      color: '#d62828',
      pattern: 'stationary'
    },
    jumper: {
      width: 35,
      height: 40,
      speed: 0,
      health: 1,
      damage: 1,
      color: '#f77f00',
      pattern: 'jumping',
      jumpInterval: 1000,
      jumpForce: -10
    },
    shooter: {
      width: 45,
      height: 35,
      speed: 0,
      health: 2,
      damage: 1,
      color: '#7b2cbf',
      pattern: 'shooting',
      shootInterval: 2000
    }
  };

  // Obstacle types
  const OBSTACLE_TYPES = {
    spike: {
      width: 30,
      height: 40,
      damage: 1,
      color: '#8b0000'
    },
    pit: {
      width: 60,
      height: 100,
      damage: 999, // Instant death
      color: '#1a0f0a'
    },
    barrel: {
      width: 40,
      height: 50,
      damage: 1,
      color: '#8b4513',
      destructible: true,
      health: 1
    }
  };

  /**
   * Initialize level
   */
  function init() {
    platforms = [];
    enemies = [];
    obstacles = [];
    powerUps = [];
    particles = [];

    lastPlatformX = 0;
    lastEnemyBeat = -4;
    lastObstacleBeat = -4;
    difficulty = 1;
    distanceTraveled = 0;
    currentPattern = 'flat';
    patternProgress = 0;

    // Compute ground Y based on screen height (80% down the screen)
    // Use fallback if window dimensions aren't available yet
    const screenHeight = window.innerHeight || 600;
    GROUND_Y = Math.floor(screenHeight * 0.8);

    // Ensure GROUND_Y is reasonable (between 200 and 800)
    if (GROUND_Y < 200) GROUND_Y = 400;
    if (GROUND_Y > 800) GROUND_Y = 500;

    // Generate initial ground
    generateInitialGround();

    console.log(`[Level] Ground Y set to ${GROUND_Y} (screen height: ${screenHeight})`);

    // Subscribe to rhythm events
    RhythmSystem.onBeat(handleBeat);
    RhythmSystem.onDownbeat(handleDownbeat);

    console.log(`[Level] Initialized with groundY=${GROUND_Y}`);
  }

  /**
   * Generate starting platforms
   */
  function generateInitialGround() {
    // Start with solid ground
    platforms.push({
      x: -100,
      y: GROUND_Y,
      width: 600,
      height: 50,
      type: 'ground'
    });

    lastPlatformX = 500;
  }

  /**
   * Update level (called every frame)
   */
  function update(deltaTime, playerX) {
    distanceTraveled = playerX;

    // Update difficulty based on distance
    difficulty = 1 + Math.floor(playerX / 1000) * 0.2;
    difficulty = Math.min(difficulty, 3);

    // Generate new content ahead
    generateAhead(playerX);

    // Update enemies
    updateEnemies(deltaTime, playerX);

    // Update obstacles
    updateObstacles(deltaTime);

    // Update particles
    updateParticles(deltaTime);

    // Cleanup behind player
    cleanup(playerX);
  }

  /**
   * Handle beat event - generate platforms
   */
  function handleBeat(beatNum) {
    // Platform generation is handled in generateAhead
    // based on beat timing
  }

  /**
   * Handle downbeat - spawn enemies
   */
  function handleDownbeat(beatNum) {
    if (beatNum - lastEnemyBeat < 4) return;
    if (distanceTraveled < 200) return; // No enemies at start

    lastEnemyBeat = beatNum;

    // Spawn enemy at a platform ahead
    const aheadPlatforms = platforms.filter(p =>
      p.x > distanceTraveled + 300 && p.x < distanceTraveled + 600
    );

    if (aheadPlatforms.length > 0) {
      const platform = aheadPlatforms[Math.floor(Math.random() * aheadPlatforms.length)];
      spawnEnemy(platform);
    }
  }

  /**
   * Generate content ahead of player
   */
  function generateAhead(playerX) {
    const generateTo = playerX + VIEW_AHEAD;

    while (lastPlatformX < generateTo) {
      generatePlatformSegment();
    }
  }

  /**
   * Generate a platform segment with varied patterns
   * Emphasis on verticality and fast-paced gameplay
   */
  function generatePlatformSegment() {
    // Switch patterns more frequently for dynamic gameplay
    patternProgress++;
    if (patternProgress > 3 + Math.random() * 4) {
      patternProgress = 0;
      currentPattern = PLATFORM_PATTERNS[Math.floor(Math.random() * PLATFORM_PATTERNS.length)];

      // Early game is more forgiving
      if (difficulty < 1.2) {
        const easyPatterns = ['flat', 'stairs_up', 'floating'];
        currentPattern = easyPatterns[Math.floor(Math.random() * easyPatterns.length)];
      }
    }

    // Calculate gap based on rhythm and pattern
    const beatInterval = AudioSystem.getBeatInterval?.() || 400;
    const playerSpeed = 14; // Faster pace
    const beatDistance = (playerSpeed * beatInterval) / 1000;

    // Base gap calculation - tighter gaps for fast action
    let gap, width, heightOffset;

    switch (currentPattern) {
      case 'flat':
        gap = GAP_MIN * 0.9 + Math.random() * 40;
        width = PLATFORM_MIN_WIDTH + Math.random() * (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH);
        heightOffset = (Math.random() - 0.5) * 30; // Slight variation
        break;

      case 'stairs_up':
        // Ascending platforms - requires good momentum
        gap = GAP_MIN * 0.85 + Math.random() * 25;
        width = PLATFORM_MIN_WIDTH * 0.7 + Math.random() * 60;
        heightOffset = -50 - patternProgress * 30; // Steeper climb
        break;

      case 'stairs_down':
        // Descending - fast and fun
        gap = GAP_MIN * 0.8 + Math.random() * 30;
        width = PLATFORM_MIN_WIDTH * 0.8 + Math.random() * 80;
        heightOffset = 40 + patternProgress * 25;
        break;

      case 'gap_challenge':
        // Wider gaps - requires precise timing
        gap = GAP_MIN * 1.6 + Math.random() * (GAP_MAX - GAP_MIN) * difficulty * 0.7;
        width = PLATFORM_MIN_WIDTH * 0.6 + Math.random() * 50;
        heightOffset = (Math.random() - 0.5) * 120; // More vertical variety
        break;

      case 'floating':
        // High platforms - verticality focus
        gap = GAP_MIN * 0.9 + Math.random() * 50;
        width = PLATFORM_MIN_WIDTH * 0.65 + Math.random() * 70;
        heightOffset = -100 - Math.random() * 80; // Higher jumps
        break;

      default:
        gap = GAP_MIN + Math.random() * 40;
        width = PLATFORM_MIN_WIDTH + Math.random() * (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH);
        heightOffset = (Math.random() - 0.5) * 80;
    }

    // Apply difficulty scaling
    gap = gap * (0.85 + difficulty * 0.15);
    gap = Math.min(Math.max(gap, GAP_MIN * 0.8), GAP_MAX * Math.min(difficulty, 1.8));

    // Calculate platform Y position with more vertical range
    const lastPlatform = platforms[platforms.length - 1];
    const lastY = lastPlatform?.y || GROUND_Y;
    let y = lastY + heightOffset;

    // Wider vertical bounds for more verticality
    const minY = GROUND_Y - 220;
    const maxY = GROUND_Y + 40;
    y = Math.min(Math.max(y, minY), maxY);

    // If we're too high for too long, bring back down
    if (y < GROUND_Y - 150 && patternProgress > 3) {
      y = GROUND_Y - 80 - Math.random() * 60;
    }

    // Create platform
    const platform = {
      x: lastPlatformX + gap,
      y: y,
      width: width,
      height: 22,
      type: 'platform',
      pattern: currentPattern
    };

    platforms.push(platform);
    lastPlatformX = platform.x + width;

    // Add danger indicator for large gaps
    if (gap > GAP_MIN * 1.8) {
      // Visual danger zone beneath the gap
      obstacles.push({
        x: platform.x - gap,
        y: GROUND_Y + 20,
        width: gap,
        height: 200,
        typeName: 'pit',
        damage: 999,
        color: '#0a0505',
        alive: true,
        destructible: false
      });
    }

    // Chance to add obstacle on platform
    if (Math.random() < 0.15 * difficulty && distanceTraveled > 400) {
      spawnObstacle(platform);
    }

    // Chance for power-up (higher on challenging platforms)
    const powerUpChance = currentPattern === 'gap_challenge' ? 0.12 : 0.05;
    if (Math.random() < powerUpChance) {
      spawnPowerUp(platform);
    }
  }

  /**
   * Spawn an enemy on a platform
   */
  function spawnEnemy(platform) {
    const types = Object.keys(ENEMY_TYPES);
    const typeWeights = [0.5, 0.3, 0.2]; // crawler, jumper, shooter

    let roll = Math.random();
    let typeIndex = 0;
    for (let i = 0; i < typeWeights.length; i++) {
      roll -= typeWeights[i];
      if (roll <= 0) {
        typeIndex = i;
        break;
      }
    }

    // Higher difficulty = more variety
    if (difficulty < 1.5 && typeIndex > 0) {
      typeIndex = 0; // Only crawlers early on
    }

    const typeName = types[typeIndex];
    const type = ENEMY_TYPES[typeName];

    const enemy = {
      ...type,
      typeName,
      x: platform.x + platform.width / 2 - type.width / 2,
      y: platform.y - type.height,
      baseY: platform.y - type.height,
      velocityY: 0,
      alive: true,
      timer: 0,
      projectiles: []
    };

    enemies.push(enemy);
  }

  /**
   * Spawn an obstacle on a platform
   */
  function spawnObstacle(platform) {
    const types = ['spike', 'barrel'];
    const typeName = types[Math.floor(Math.random() * types.length)];
    const type = OBSTACLE_TYPES[typeName];

    const obstacle = {
      ...type,
      typeName,
      x: platform.x + Math.random() * (platform.width - type.width),
      y: platform.y - type.height,
      alive: true
    };

    obstacles.push(obstacle);
  }

  /**
   * Spawn a power-up
   */
  function spawnPowerUp(platform) {
    powerUps.push({
      x: platform.x + platform.width / 2 - 15,
      y: platform.y - 60,
      width: 30,
      height: 30,
      type: 'momentum', // Restores momentum
      collected: false
    });
  }

  /**
   * Update enemy states
   */
  function updateEnemies(deltaTime, playerX) {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      enemy.timer += deltaTime;

      switch (enemy.pattern) {
        case 'jumping':
          if (enemy.timer >= enemy.jumpInterval) {
            enemy.timer = 0;
            enemy.velocityY = enemy.jumpForce;
          }
          enemy.velocityY += 0.5; // Gravity
          enemy.y += enemy.velocityY * (deltaTime / 16.67);
          if (enemy.y >= enemy.baseY) {
            enemy.y = enemy.baseY;
            enemy.velocityY = 0;
          }
          break;

        case 'shooting':
          if (enemy.timer >= enemy.shootInterval && enemy.x < playerX + 400) {
            enemy.timer = 0;
            enemy.projectiles.push({
              x: enemy.x,
              y: enemy.y + enemy.height / 2,
              velocityX: -8,
              width: 15,
              height: 8
            });
          }
          // Update projectiles
          for (let i = enemy.projectiles.length - 1; i >= 0; i--) {
            const proj = enemy.projectiles[i];
            proj.x += proj.velocityX * (deltaTime / 16.67);
            if (proj.x < playerX - 100) {
              enemy.projectiles.splice(i, 1);
            }
          }
          break;
      }
    }
  }

  /**
   * Update obstacles
   */
  function updateObstacles(deltaTime) {
    // Static obstacles don't need much updating
  }

  /**
   * Update particles
   */
  function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.velocityX * (deltaTime / 16.67);
      p.y += p.velocityY * (deltaTime / 16.67);
      p.velocityY += 0.2; // Gravity
      p.life -= deltaTime;
      p.alpha = p.life / p.maxLife;

      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  /**
   * Cleanup elements behind player
   */
  function cleanup(playerX) {
    const cleanupX = playerX - CLEANUP_BEHIND;

    platforms = platforms.filter(p => p.x + p.width > cleanupX);
    enemies = enemies.filter(e => e.x + e.width > cleanupX);
    obstacles = obstacles.filter(o => o.x + o.width > cleanupX);
    powerUps = powerUps.filter(p => p.x + p.width > cleanupX);
  }

  /**
   * Destroy enemy and create particles
   */
  function destroyEnemy(enemy) {
    enemy.alive = false;

    // Create death particles
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: enemy.x + enemy.width / 2,
        y: enemy.y + enemy.height / 2,
        velocityX: (Math.random() - 0.5) * 8,
        velocityY: (Math.random() - 1) * 6,
        size: 4 + Math.random() * 4,
        color: enemy.color,
        life: 500,
        maxLife: 500,
        alpha: 1
      });
    }
  }

  /**
   * Destroy obstacle
   */
  function destroyObstacle(obstacle) {
    if (!obstacle.destructible) return false;
    obstacle.alive = false;

    // Particles
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: obstacle.x + obstacle.width / 2,
        y: obstacle.y + obstacle.height / 2,
        velocityX: (Math.random() - 0.5) * 5,
        velocityY: (Math.random() - 1) * 4,
        size: 3 + Math.random() * 3,
        color: obstacle.color,
        life: 400,
        maxLife: 400,
        alpha: 1
      });
    }

    return true;
  }

  /**
   * Collect power-up
   */
  function collectPowerUp(powerUp) {
    powerUp.collected = true;
    return powerUp.type;
  }

  /**
   * Get current level state
   */
  function getState() {
    return {
      platforms,
      enemies: enemies.filter(e => e.alive),
      obstacles: obstacles.filter(o => o.alive),
      powerUps: powerUps.filter(p => !p.collected),
      particles,
      difficulty,
      groundY: GROUND_Y
    };
  }

  /**
   * Check time warp active (from mage)
   */
  let timeWarpActive = false;
  let timeWarpMultiplier = 1;

  function setTimeWarp(active, multiplier = 0.3) {
    timeWarpActive = active;
    timeWarpMultiplier = active ? multiplier : 1;
  }

  function isTimeWarped() {
    return timeWarpActive;
  }

  /**
   * Stop and cleanup
   */
  function stop() {
    RhythmSystem.offBeat(handleBeat);
    // Note: No offDownbeat in rhythm system, would need to add
  }

  /**
   * Get ground Y position
   */
  function getGroundY() {
    return GROUND_Y;
  }

  // Public API
  return {
    init,
    update,
    getState,
    destroyEnemy,
    destroyObstacle,
    collectPowerUp,
    setTimeWarp,
    isTimeWarped,
    stop,
    getGroundY
  };
})();
