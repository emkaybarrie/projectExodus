/**
 * BADLANDS: Player Module
 *
 * Streamlined mechanics - Vampire Survivors inspired auto-runner.
 *
 * Controls:
 * - Jump (tap/hold for height)
 * - Skill activation (manual trigger)
 * - Auto-attack (passive, no input needed)
 *
 * Momentum System:
 * - Builds while running smoothly
 * - Lost on hits or falls
 * - High momentum = speed + score multiplier
 *
 * Fall Mechanic:
 * - Falling off screen = respawn at last safe point
 * - Costs 1 health + 40 momentum
 * - Brief invulnerability after respawn
 */

const Player = (() => {
  // Player state
  let x = 0;
  let y = 0;
  let velocityX = 0;
  let velocityY = 0;
  let momentum = 50;         // 0-100 flow meter
  let health = 3;            // Hits before death
  let energy = 100;          // Energy/stamina for jumps
  let isGrounded = false;
  let isJumping = false;
  let jumpHoldTime = 0;
  let isDead = false;
  let isInvulnerable = false;
  let invulnerableTime = 0;

  // Respawn tracking
  let lastSafeX = 0;
  let lastSafeY = 0;
  let safeCheckTimer = 0;
  let isFalling = false;

  // Class info
  let currentClass = null;
  let classId = 'warrior';

  // Ability state (manual skill)
  let abilityActive = false;
  let abilityCooldown = 0;
  let abilityTimer = 0;

  // Auto-attack state (Vampire Survivors style)
  let autoAttackTimer = 0;
  let autoAttackCooldown = 0;
  let isAttacking = false;
  let attackTimer = 0;

  // Combat
  let activeProjectiles = [];

  // Animation state
  let animationState = 'run';

  // Constants
  const MAX_MOMENTUM = 100;
  const MIN_MOMENTUM = 0;
  const MOMENTUM_DECAY = 0.03;    // Per frame when not gaining
  const MOMENTUM_GAIN_RUN = 0.15; // Per frame while running
  const MOMENTUM_LOSS_HIT = 25;   // Lost when hit
  const MOMENTUM_LOSS_FALL = 40;  // Lost on fall respawn
  const INVULN_TIME = 1500;       // ms of invulnerability after hit/respawn
  const MAX_JUMP_HOLD = 250;      // ms for variable jump

  // Energy constants
  const MAX_ENERGY = 100;
  const ENERGY_REGEN = 1.0;       // Per frame regeneration
  const ENERGY_REGEN_AIR = 0.4;   // Slower regen in air
  const ENERGY_JUMP_BASE = 10;    // Base energy cost for jump
  const ENERGY_JUMP_HOLD = 0.06;  // Additional energy per ms of hold
  const ENERGY_ABILITY = 25;      // Energy cost for ability

  // Auto-attack constants
  const AUTO_ATTACK_INTERVAL = 400; // ms between auto-attacks
  const AUTO_ATTACK_RANGE = 150;    // Range to hit enemies

  // Jump buffer and coyote time for responsive controls
  const COYOTE_TIME = 120;        // ms after leaving ground where jump still works
  const JUMP_BUFFER = 120;        // ms before landing where jump input is remembered
  let coyoteTimer = 0;
  let jumpBufferTimer = 0;
  let wasGrounded = false;

  // Ground level (will be set by level)
  let groundY = 400;

  /**
   * Initialize player with class
   */
  function init(selectedClassId, startX, startY, ground) {
    classId = selectedClassId;
    currentClass = getClass(classId);

    x = startX;
    y = startY;
    groundY = ground;

    // Save initial spawn point
    lastSafeX = startX;
    lastSafeY = startY;
    safeCheckTimer = 0;
    isFalling = false;

    velocityX = currentClass.physics.maxSpeed * 0.6;
    velocityY = 0;
    momentum = 50;
    health = 3;
    energy = MAX_ENERGY;

    isGrounded = true;
    isJumping = false;
    isDead = false;
    isInvulnerable = false;
    coyoteTimer = 0;
    jumpBufferTimer = 0;
    wasGrounded = true;

    abilityActive = false;
    abilityCooldown = 0;
    isAttacking = false;
    autoAttackTimer = 0;
    autoAttackCooldown = 0;

    activeProjectiles = [];
    animationState = 'run';

    console.log(`[Player] Initialized as ${currentClass.name} at (${x}, ${y}), groundY=${groundY}, size=${currentClass.size.width}x${currentClass.size.height}`);
  }

  /**
   * Update player state
   */
  function update(deltaTime, platforms) {
    if (isDead) return;

    // Update timers
    if (invulnerableTime > 0) {
      invulnerableTime -= deltaTime;
      if (invulnerableTime <= 0) {
        isInvulnerable = false;
      }
    }

    if (abilityCooldown > 0) {
      abilityCooldown -= deltaTime;
    }

    if (abilityTimer > 0) {
      abilityTimer -= deltaTime;
      if (abilityTimer <= 0) {
        abilityActive = false;
      }
    }

    if (attackTimer > 0) {
      attackTimer -= deltaTime;
      if (attackTimer <= 0) {
        isAttacking = false;
      }
    }

    // Handle input (just jump hold now)
    handleInput(deltaTime);

    // Apply physics
    applyPhysics(deltaTime);

    // Check platform collisions
    checkPlatformCollisions(platforms);

    // Update safe point (when grounded and stable)
    updateSafePoint(deltaTime);

    // Auto-attack system
    updateAutoAttack(deltaTime);

    // Update momentum
    updateMomentum(deltaTime);

    // Update projectiles
    updateProjectiles(deltaTime);

    // Update animation
    updateAnimation();
  }

  /**
   * Handle player input
   * Note: Jump/attack triggers come from game.js callbacks
   * This only handles continuous input like variable jump hold
   */
  function handleInput(deltaTime) {
    const input = InputSystem.getState();
    const physics = currentClass.physics;

    // Variable jump height (hold to jump higher, costs more energy)
    if (input.jumpHeld && isJumping && jumpHoldTime < MAX_JUMP_HOLD) {
      const energyCost = ENERGY_JUMP_HOLD * deltaTime;
      if (energy >= energyCost) {
        jumpHoldTime += deltaTime;
        velocityY += physics.jumpForce * 0.02;
        energy -= energyCost;
      }
    }

    if (input.jumpReleased) {
      isJumping = false;
    }
  }

  /**
   * Start a jump
   * @returns {boolean} true if jump started, false if not enough energy
   */
  function startJump() {
    // Can jump if grounded OR within coyote time
    const canJump = isGrounded || coyoteTimer > 0;

    if (!canJump) {
      // Buffer the jump input for when we land
      jumpBufferTimer = JUMP_BUFFER;
      return false;
    }
    if (energy < ENERGY_JUMP_BASE) return false; // Not enough energy

    const physics = currentClass.physics;
    velocityY = physics.jumpForce;
    isGrounded = false;
    isJumping = true;
    jumpHoldTime = 0;
    coyoteTimer = 0; // Consume coyote time

    // Consume base energy for jump
    energy -= ENERGY_JUMP_BASE;

    // Check rhythm timing for bonus
    const timing = RhythmSystem.registerAction();
    if (timing.rating === 'PERFECT') {
      velocityY *= 1.1; // Slightly higher jump on perfect
      momentum = Math.min(MAX_MOMENTUM, momentum + 5);
    }

    AudioSystem.playSFX('jump', 0.4);
    animationState = 'jump';
    return true;
  }

  // Double jump removed - using standard jump mechanics for simplicity

  // Manual attack removed - auto-attack handles all combat

  /**
   * Activate class ability
   * @returns {boolean} true if activated, false if not enough energy
   */
  function activateAbility() {
    if (energy < ENERGY_ABILITY) return false; // Not enough energy

    const ability = currentClass.ability;
    abilityCooldown = ability.cooldown;
    abilityActive = true;
    abilityTimer = ability.duration || 500;

    // Consume energy
    energy -= ENERGY_ABILITY;

    // Check if on beat for bonus
    const timing = RhythmSystem.checkTiming();
    const onBeat = timing.rating === 'PERFECT' || timing.rating === 'GOOD';

    switch (classId) {
      case 'warrior':
        // Shield Dash - invincible charge
        isInvulnerable = true;
        invulnerableTime = ability.duration;
        velocityX = currentClass.physics.maxSpeed * 2;
        momentum = Math.min(MAX_MOMENTUM, momentum + 20);
        break;

      case 'mage':
        // Time Warp - slow enemies (effect applied in game.js)
        if (onBeat) {
          abilityTimer *= 1.5; // Longer duration on beat
        }
        break;

      case 'rogue':
        // Shadow Step - teleport
        const distance = ability.distance;
        x += distance;
        if (onBeat) {
          // Damage enemies we pass through (handled in collision)
          isInvulnerable = true;
          invulnerableTime = 200;
        }
        break;
    }

    AudioSystem.playSFX('attack', 0.5);
  }

  /**
   * Apply physics (gravity, velocity)
   */
  function applyPhysics(deltaTime) {
    const physics = currentClass.physics;

    // Track if we were grounded last frame for coyote time
    wasGrounded = isGrounded;

    // Auto-run: always moving forward
    // Velocity affected by momentum
    const speedMultiplier = 0.5 + (momentum / MAX_MOMENTUM) * 0.5;
    velocityX = physics.maxSpeed * speedMultiplier;

    // Apply gravity
    if (!isGrounded) {
      velocityY += physics.gravity;

      // Update coyote timer (only when falling, not jumping)
      if (wasGrounded && velocityY >= 0) {
        coyoteTimer = COYOTE_TIME;
      } else if (coyoteTimer > 0) {
        coyoteTimer -= deltaTime;
      }
    }

    // Update jump buffer timer
    if (jumpBufferTimer > 0) {
      jumpBufferTimer -= deltaTime;
    }

    // Apply movement
    x += velocityX * (deltaTime / 16.67);
    y += velocityY * (deltaTime / 16.67);

    // Ground check (basic)
    if (y >= groundY - currentClass.size.height) {
      y = groundY - currentClass.size.height;
      velocityY = 0;
      if (!isGrounded) {
        isGrounded = true;
        isJumping = false;
        coyoteTimer = 0;
        animationState = 'run';

        // Execute buffered jump
        if (jumpBufferTimer > 0) {
          jumpBufferTimer = 0;
          startJump();
        }
      }
    }

    // Keep on screen (y axis)
    if (y < 0) {
      y = 0;
      velocityY = 0;
    }
  }

  /**
   * Check collisions with platforms
   */
  function checkPlatformCollisions(platforms) {
    if (!platforms) return;

    const playerRect = getRect();
    let onPlatform = false;

    for (const platform of platforms) {
      // Only check platforms in range
      if (platform.x > x + 100 || platform.x + platform.width < x - 50) continue;

      // Landing on top of platform
      if (velocityY > 0 &&
          playerRect.bottom >= platform.y &&
          playerRect.bottom <= platform.y + 20 &&
          playerRect.right > platform.x &&
          playerRect.left < platform.x + platform.width) {

        y = platform.y - currentClass.size.height;
        velocityY = 0;
        const wasInAir = !isGrounded;
        isGrounded = true;
        isJumping = false;
        coyoteTimer = 0;
        onPlatform = true;
        animationState = 'run';

        // Execute buffered jump on landing
        if (wasInAir && jumpBufferTimer > 0) {
          jumpBufferTimer = 0;
          startJump();
        }
      }
    }

    // Check if walked off platform - set coyote time instead of instant fall
    if (!onPlatform && y < groundY - currentClass.size.height - 5) {
      if (isGrounded) {
        // Just left platform, start coyote time
        coyoteTimer = COYOTE_TIME;
      }
      isGrounded = false;
    }
  }

  /**
   * Update momentum (flow meter)
   */
  function updateMomentum(deltaTime) {
    // Gain momentum while running
    if (isGrounded && velocityX > 0) {
      const gain = MOMENTUM_GAIN_RUN * getMomentumGain(classId, 'OK');
      momentum = Math.min(MAX_MOMENTUM, momentum + gain);
    }

    // Decay momentum slowly
    momentum = Math.max(MIN_MOMENTUM, momentum - MOMENTUM_DECAY);

    // Regenerate energy (faster when grounded for responsive jumping)
    const regenRate = isGrounded ? ENERGY_REGEN : ENERGY_REGEN_AIR;
    energy = Math.min(MAX_ENERGY, energy + regenRate);
  }

  /**
   * Update safe respawn point
   */
  function updateSafePoint(deltaTime) {
    if (isGrounded && !isInvulnerable) {
      safeCheckTimer += deltaTime;
      // Update safe point every 200ms while grounded
      if (safeCheckTimer > 200) {
        lastSafeX = x;
        lastSafeY = y;
        safeCheckTimer = 0;
        isFalling = false;
      }
    }
  }

  /**
   * Auto-attack system (Vampire Survivors style)
   */
  function updateAutoAttack(deltaTime) {
    autoAttackTimer += deltaTime;

    if (autoAttackTimer >= AUTO_ATTACK_INTERVAL) {
      autoAttackTimer = 0;
      performAutoAttack();
    }
  }

  /**
   * Perform auto-attack
   */
  function performAutoAttack() {
    const combat = currentClass.combat;
    isAttacking = true;
    attackTimer = 120;

    // Create projectile for ranged classes or attack hitbox for melee
    const damage = combat.attackDamage * (1 + momentum / 200);

    activeProjectiles.push({
      x: x + currentClass.size.width,
      y: y + currentClass.size.height / 2,
      velocityX: 18,
      damage: damage,
      width: 25,
      height: 15,
      lifetime: 600,
      isAutoAttack: true
    });

    animationState = 'attack';
  }

  /**
   * Check if player has fallen off screen
   * @returns {boolean} true if fallen
   */
  function checkFallDeath(screenHeight) {
    return y > screenHeight + 100;
  }

  /**
   * Respawn player at last safe point
   * @returns {boolean} true if still alive after respawn
   */
  function respawn() {
    if (isDead) return false;

    // Take damage
    health -= 1;
    momentum = Math.max(MIN_MOMENTUM, momentum - MOMENTUM_LOSS_FALL);

    if (health <= 0) {
      die();
      return false;
    }

    // Respawn at last safe position
    x = lastSafeX;
    y = lastSafeY;
    velocityY = 0;
    isGrounded = true;
    isJumping = false;
    isFalling = false;

    // Brief invulnerability
    isInvulnerable = true;
    invulnerableTime = INVULN_TIME;

    AudioSystem.playSFX('hit', 0.4);
    animationState = 'run';

    console.log(`[Player] Respawned at (${x.toFixed(0)}, ${y.toFixed(0)}) - Health: ${health}`);
    return true;
  }

  /**
   * Update projectiles
   */
  function updateProjectiles(deltaTime) {
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
      const proj = activeProjectiles[i];
      proj.x += proj.velocityX * (deltaTime / 16.67);
      proj.lifetime -= deltaTime;

      if (proj.lifetime <= 0 || proj.x > x + 500) {
        activeProjectiles.splice(i, 1);
      }
    }
  }

  /**
   * Update animation state
   */
  function updateAnimation() {
    if (isDead) {
      animationState = 'dead';
      return;
    }

    if (abilityActive) {
      animationState = 'ability';
      return;
    }

    if (isAttacking) {
      animationState = 'attack';
      return;
    }

    if (!isGrounded) {
      animationState = 'jump';
      return;
    }

    animationState = 'run';
  }

  /**
   * Take damage
   * @returns {boolean} true if still alive, false if dead
   */
  function takeDamage(amount = 1) {
    if (isInvulnerable || isDead) return true; // Still alive (didn't take damage)

    health -= amount;
    momentum = Math.max(MIN_MOMENTUM, momentum - MOMENTUM_LOSS_HIT);
    RhythmSystem.breakCombo();

    // Invulnerability frames
    isInvulnerable = true;
    invulnerableTime = INVULN_TIME;

    AudioSystem.playSFX('hit', 0.5);

    if (health <= 0) {
      die();
      return false; // Dead
    }

    return true; // Still alive
  }

  /**
   * Player death
   */
  function die() {
    isDead = true;
    animationState = 'dead';
    AudioSystem.playSFX('death', 0.6);
  }

  /**
   * Get player bounding rect
   */
  function getRect() {
    return {
      x: x,
      y: y,
      width: currentClass.size.width,
      height: currentClass.size.height,
      left: x,
      right: x + currentClass.size.width,
      top: y,
      bottom: y + currentClass.size.height
    };
  }

  /**
   * Get attack hitbox (for melee)
   */
  function getAttackRect() {
    if (!isAttacking || classId === 'mage') return null;

    return {
      x: x + currentClass.size.width,
      y: y,
      width: currentClass.combat.attackRange,
      height: currentClass.size.height
    };
  }

  /**
   * Get player state for rendering/debugging
   */
  function getState() {
    return {
      x, y,
      velocityX, velocityY,
      momentum,
      health,
      maxHealth: 3,
      energy,
      maxEnergy: MAX_ENERGY,
      isGrounded,
      isJumping,
      isDead,
      invincible: isInvulnerable,
      isAttacking,
      abilityActive,
      abilityCooldown,
      state: animationState,
      animationState,
      classId,
      className: currentClass?.name,
      classData: currentClass,
      color: currentClass?.color,
      width: currentClass?.size?.width || 40,
      height: currentClass?.size?.height || 50,
      size: currentClass?.size,
      facingRight: true, // Always facing right in auto-runner
      projectiles: activeProjectiles
    };
  }

  /**
   * Get distance traveled (x position)
   */
  function getDistance() {
    return Math.floor(x);
  }

  /**
   * Get momentum percentage (0-1)
   */
  function getMomentumPercent() {
    return momentum / MAX_MOMENTUM;
  }

  /**
   * Check if ability is ready
   */
  function isAbilityReady() {
    return abilityCooldown <= 0;
  }

  /**
   * Boost momentum (e.g., from power-ups)
   */
  function boostMomentum(amount) {
    momentum = Math.min(MAX_MOMENTUM, momentum + amount);
  }

  /**
   * Add momentum (alias for boostMomentum)
   */
  function addMomentum(amount) {
    boostMomentum(amount);
  }

  /**
   * Heal player
   */
  function heal(amount) {
    health = Math.min(3, health + amount);
  }

  /**
   * External jump trigger
   */
  function jump() {
    startJump();
  }

  /**
   * Release jump (stop variable jump)
   */
  function releaseJump() {
    isJumping = false;
  }

  /**
   * Fast fall trigger
   */
  function fastFall() {
    if (!isGrounded) {
      velocityY = Math.max(velocityY, 10);
    }
  }

  /**
   * Use ability trigger
   */
  function useAbility() {
    if (abilityCooldown <= 0) {
      activateAbility();
    }
  }

  // Public API
  return {
    init,
    update,
    jump,
    releaseJump,
    useAbility,
    fastFall,
    takeDamage,
    heal,
    respawn,
    checkFallDeath,
    getRect,
    getAttackRect,
    getState,
    getDistance,
    getMomentumPercent,
    isAbilityReady,
    boostMomentum,
    addMomentum
  };
})();
