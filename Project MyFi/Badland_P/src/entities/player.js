// player.js — Player Entity
// Two-layer speed system: Input Speed (throttle) × Momentum Multiplier = Effective Speed

// Player constants
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 48;

// ═══════════════════════════════════════════════════════════════════════════
// SPEED SYSTEM: Input Speed × Momentum Multiplier
//
// INPUT SPEED (player-controlled via throttle/brake):
//   - Range: 10% to 100% (MIN_INPUT to MAX_INPUT)
//   - Baseline: 25% (coasts here when no input)
//   - Right arrow = gas pedal → accelerate toward 100%
//   - Left arrow = brake → decelerate toward 10%
//
// MOMENTUM (earned multiplier):
//   - Range: 0.75x to 1.5x (low momentum = sluggish, high = flow state)
//   - Gained: running, downhill, good landings
//   - Lost: hits, falls, uphill
//   - Decays based on state (air=slow, ground=fast, high speed=slow)
//
// EFFECTIVE SPEED = Input% × MomentumMult × BASE_SPEED
// ═══════════════════════════════════════════════════════════════════════════

// Base speed definition (what 100% input + 1.0x momentum means)
const BASE_SPEED = 500;       // pixels/s at 100% input, 1.0x momentum

// Input speed range (as ratios)
const MIN_INPUT = 0.10;       // 10% - minimum speed (hard brake)
const MAX_INPUT = 1.00;       // 100% - full throttle
const BASELINE_INPUT = 0.25;  // 25% - coasts here when no input

// Momentum multiplier range
const MIN_MOMENTUM_MULT = 0.75;   // 0.75x at 0 momentum (sluggish)
const MAX_MOMENTUM_MULT = 1.50;   // 1.5x at 100 momentum (flow state)
const DEFAULT_MAX_MULT = 1.50;    // Default cap (progression can increase)

// Throttle (acceleration) - always noticeable
const THROTTLE_RATE = 0.8;        // Input% per second when holding right
const THROTTLE_AIR_MULT = 0.4;    // 40% effectiveness in air

// Brake (deceleration) - always noticeable
const BRAKE_RATE = 1.0;           // Input% per second when holding left
const BRAKE_AIR_MULT = 0.15;      // 15% effectiveness in air (commit to jumps)

// Coast (no input - drift toward baseline)
const COAST_RATE = 0.3;           // Input% per second toward baseline

// Momentum system
const MOMENTUM_GAIN_RUN = 0.20;   // Per frame when grounded and running
const MOMENTUM_GAIN_DOWNHILL = 0.35; // Bonus for downhill sections
const MOMENTUM_DRAIN_HIT = 30;    // Lost on taking damage
const MOMENTUM_DRAIN_FALL = 45;   // Lost on bad landing
const MOMENTUM_DRAIN_UPHILL = 0.15; // Lost per frame going uphill
const STARTING_MOMENTUM = 35;     // Start with some momentum

// Momentum decay (friction simulation)
// Decay rate = BASE × stateMult × speedMult
const MOMENTUM_DECAY_BASE = 0.08;     // Base decay per frame
const MOMENTUM_DECAY_AIR_MULT = 0.3;  // 30% decay in air (less friction)
const MOMENTUM_DECAY_GROUND_MULT = 1.0; // 100% decay on ground
// High speed = slower decay (momentum protects itself)
// speedMult = 1.0 - (inputSpeed - BASELINE) * SPEED_PROTECTION
const MOMENTUM_SPEED_PROTECTION = 0.6; // Up to 60% decay reduction at max speed

// Jump physics - effective speed affects jump distance
const BASE_JUMP_FORCE = -520;        // pixels/s - base jump impulse
const HIGH_SPEED_JUMP_FORCE = -600;  // pixels/s - stronger at high effective speed
const DOUBLE_JUMP_MULTIPLIER = 0.8;  // double jump is weaker
const MAX_JUMPS = 2;

// Gravity scaling - higher effective speed = floatier jumps
const BASE_GRAVITY = 1400;     // gravity at low effective speed
const HIGH_SPEED_GRAVITY = 800; // gravity at high effective speed (floaty)

// Invulnerability after taking damage
const INVULN_DURATION = 1000; // ms

// Fall tracking
const FALL_START_THRESHOLD = 50; // Start tracking fall after this Y movement

/**
 * Create the player entity
 * @param {object} events - Event bus
 * @param {object} physics - Physics system
 * @param {object} loadout - Loadout from roguelike system
 * @param {object} runPowerups - Run power-up system for modifiers (optional)
 */
export function createPlayer(events, physics, loadout = {}, runPowerups = null) {
  // Position and velocity
  let x = 100;
  let y = 350; // Start lower to be closer to ground
  let vx = 0;
  let vy = 0;

  // Two-layer speed system
  let inputSpeed = BASELINE_INPUT;  // Player-controlled: 0.1 to 1.0
  let momentum = loadout.startMomentum || STARTING_MOMENTUM; // 0-100, maps to multiplier

  // State
  let isGrounded = false;
  let jumpsRemaining = MAX_JUMPS;
  let health = loadout.maxHealth || 100;
  let maxHealth = loadout.maxHealth || 100;
  let score = 0;
  let distance = 0;
  let invulnerableUntil = 0;

  // Animation state
  let animFrame = 0;
  let animTimer = 0;

  // Projectiles
  const projectiles = [];
  const ATTACK_COOLDOWN = 300;
  let lastAttackTime = 0;

  // Fall tracking for fall damage
  let fallStartY = y;
  let isFalling = false;
  let lastLandingVelocity = 0;
  let justLandedFlag = false;

  // Current terrain slope
  let currentSlope = 0;

  /**
   * Get modifier from run power-ups (defaults to 1.0 if not available)
   */
  function getModifier(stat) {
    return runPowerups?.getModifier?.(stat) ?? 1.0;
  }

  /**
   * Get ability value from run power-ups (defaults to 0 if not available)
   */
  function getAbility(ability) {
    return runPowerups?.getAbility?.(ability) ?? 0;
  }

  /**
   * Get max jumps including power-up bonuses
   */
  function getMaxJumps() {
    return MAX_JUMPS + getAbility('extraJumps');
  }

  /**
   * Get input speed ratio (0 at MIN_INPUT, 1 at MAX_INPUT)
   * This is the player-controlled throttle position
   */
  function getInputRatio() {
    return Math.max(0, Math.min(1, (inputSpeed - MIN_INPUT) / (MAX_INPUT - MIN_INPUT)));
  }

  /**
   * Get momentum multiplier (0.75x at 0 momentum, 1.5x at 100 momentum)
   */
  function getMomentumMultiplier() {
    const maxMult = DEFAULT_MAX_MULT * getModifier('speed'); // Power-ups can increase max
    return MIN_MOMENTUM_MULT + (momentum / 100) * (maxMult - MIN_MOMENTUM_MULT);
  }

  /**
   * Get effective speed ratio (0-1 based on actual traversal speed)
   * This combines input speed and momentum multiplier
   */
  function getSpeedRatio() {
    const effectiveSpeed = getEffectiveSpeed();
    const maxEffective = BASE_SPEED * MAX_INPUT * (DEFAULT_MAX_MULT * getModifier('speed'));
    const minEffective = BASE_SPEED * MIN_INPUT * MIN_MOMENTUM_MULT;
    return Math.max(0, Math.min(1, (effectiveSpeed - minEffective) / (maxEffective - minEffective)));
  }

  /**
   * Get effective traversal speed in pixels/s
   * Effective Speed = Input% × MomentumMult × BASE_SPEED
   */
  function getEffectiveSpeed() {
    return inputSpeed * getMomentumMultiplier() * BASE_SPEED;
  }

  /**
   * Get current gravity based on effective speed (slower = snappier, faster = floatier)
   */
  function getCurrentGravity() {
    const ratio = getSpeedRatio();
    const baseGravity = BASE_GRAVITY - (BASE_GRAVITY - HIGH_SPEED_GRAVITY) * ratio;
    return baseGravity * getModifier('gravity');
  }

  /**
   * Get current jump force based on effective speed
   */
  function getCurrentJumpForce() {
    const ratio = getSpeedRatio();
    return BASE_JUMP_FORCE + (HIGH_SPEED_JUMP_FORCE - BASE_JUMP_FORCE) * ratio;
  }

  /**
   * Update player state
   */
  function update(dt, input, platforms, terrainManager = null) {
    // Reset just landed flag
    justLandedFlag = false;

    // Get power-up modifiers
    const accelMod = getModifier('acceleration');
    const momentumMod = getModifier('momentumGain');
    const maxJumps = getMaxJumps();

    // Get terrain slope at player position (if terrain manager provided)
    if (terrainManager && terrainManager.getSlopeAt) {
      currentSlope = terrainManager.getSlopeAt(x);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INPUT SPEED SYSTEM (Layer 1: Player Control)
    // Right arrow = throttle toward 100%
    // Left arrow = brake toward 10%
    // No input = coast toward 25% baseline
    // ═══════════════════════════════════════════════════════════════════════

    const inputRatio = getInputRatio(); // Current input position (0-1)
    const airMult = isGrounded ? 1.0 : (input.speedUp ? THROTTLE_AIR_MULT : BRAKE_AIR_MULT);

    if (input.speedUp) {
      // THROTTLE: Accelerate toward 100%
      // Always noticeable - even at high speed you feel the push
      const throttleAmount = THROTTLE_RATE * accelMod * airMult * dt;
      inputSpeed = Math.min(MAX_INPUT, inputSpeed + throttleAmount);

    } else if (input.slowDown) {
      // BRAKE: Decelerate toward 10%
      // Always noticeable - even at low speed you feel the slowdown
      const brakeAmount = BRAKE_RATE * accelMod * airMult * dt;
      inputSpeed = Math.max(MIN_INPUT, inputSpeed - brakeAmount);

    } else {
      // COAST: Drift toward 25% baseline
      const coastMult = isGrounded ? 1.0 : 0.3; // Coast slower in air
      if (inputSpeed > BASELINE_INPUT) {
        const coastAmount = COAST_RATE * coastMult * dt;
        inputSpeed = Math.max(BASELINE_INPUT, inputSpeed - coastAmount);
      } else if (inputSpeed < BASELINE_INPUT) {
        const coastAmount = COAST_RATE * coastMult * dt;
        inputSpeed = Math.min(BASELINE_INPUT, inputSpeed + coastAmount);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MOMENTUM SYSTEM (Layer 2: Earned Multiplier)
    // Slopes affect MOMENTUM, not direct input speed
    // Momentum decays based on state (air=slow, ground=fast, high speed=slow)
    // ═══════════════════════════════════════════════════════════════════════

    // Momentum gain from running
    if (isGrounded && inputSpeed > BASELINE_INPUT) {
      // Gain momentum when actively running above baseline
      const gainRate = MOMENTUM_GAIN_RUN * momentumMod;
      momentum = Math.min(100, momentum + gainRate);
    }

    // Slope effects on MOMENTUM (not speed)
    if (isGrounded && currentSlope !== 0) {
      const slopeEffect = physics.getSlopeSpeedAdjustment(currentSlope);

      if (slopeEffect > 0) {
        // DOWNHILL: Momentum harvest!
        // This is where you build up your multiplier
        const downhillGain = MOMENTUM_GAIN_DOWNHILL * (slopeEffect / 100) * momentumMod;
        momentum = Math.min(100, momentum + downhillGain);

      } else {
        // UPHILL: Drains momentum
        // High momentum helps "power through" - it protects itself
        const momentumProtection = (momentum / 100) * 0.5; // Up to 50% protection
        const uphillDrain = MOMENTUM_DRAIN_UPHILL * (1 - momentumProtection) * (Math.abs(slopeEffect) / 50);
        momentum = Math.max(0, momentum - uphillDrain);
      }
    }

    // Momentum decay (friction simulation)
    // Base decay modified by: air/ground state, current input speed
    const stateMult = isGrounded ? MOMENTUM_DECAY_GROUND_MULT : MOMENTUM_DECAY_AIR_MULT;
    // High speed = slower decay (momentum protects itself at high speed)
    const speedAboveBaseline = Math.max(0, inputSpeed - BASELINE_INPUT) / (MAX_INPUT - BASELINE_INPUT);
    const speedProtection = speedAboveBaseline * MOMENTUM_SPEED_PROTECTION;
    const decayRate = MOMENTUM_DECAY_BASE * stateMult * (1 - speedProtection);
    momentum = Math.max(0, momentum - decayRate);

    // ═══════════════════════════════════════════════════════════════════════
    // EFFECTIVE SPEED = Input% × MomentumMult × BASE_SPEED
    // This is what actually moves the player
    // ═══════════════════════════════════════════════════════════════════════
    vx = getEffectiveSpeed();

    // SPEED-DEPENDENT JUMP PHYSICS
    // Handle jump input (use jumpPressed for initial press, not held state)
    if (input.jumpPressed && jumpsRemaining > 0) {
      const baseForce = getCurrentJumpForce();
      const jumpForce = jumpsRemaining === maxJumps ? baseForce : baseForce * DOUBLE_JUMP_MULTIPLIER;
      vy = jumpForce;
      jumpsRemaining--;
      isGrounded = false;

      // Start fall tracking when jumping
      isFalling = true;
      fallStartY = y;

      events.emit('player:jump', {
        doubleJump: jumpsRemaining < maxJumps - 1,
        speed: getEffectiveSpeed(),
        inputSpeed,
        momentum,
        speedRatio: getSpeedRatio(),
      });
    }

    // Fast fall (reduced effect at high speed for floatier feel)
    if (input.fastFall && !isGrounded) {
      const fastFallStrength = 300 - 100 * getSpeedRatio(); // 300 at slow, 200 at fast
      vy += fastFallStrength * dt;
    }

    // Apply speed-dependent gravity (slower = snappier, faster = floatier)
    if (!isGrounded) {
      const gravity = getCurrentGravity();
      const terminalVelocity = 700 + 200 * getSpeedRatio(); // Faster terminal at high speed
      vy = Math.min(vy + gravity * dt, terminalVelocity);

      // Track fall - start tracking when falling downward
      if (vy > FALL_START_THRESHOLD && !isFalling) {
        isFalling = true;
        fallStartY = y;
      }
    }

    // Update position
    x += vx * dt;
    y += vy * dt;

    // Update distance (used for score)
    distance = x / 50; // Convert to meters

    // Check terrain collision (new system for curved terrain)
    let collision = null;
    if (terrainManager && terrainManager.getHeightAt) {
      const terrainY = terrainManager.getHeightAt(x + PLAYER_WIDTH / 2);
      const playerBottom = y + PLAYER_HEIGHT;

      if (playerBottom >= terrainY && vy >= 0) {
        collision = {
          landingY: terrainY,
        };
      }
    }

    // Fallback to platform collision for floating platforms
    if (!collision) {
      collision = physics.checkPlatformCollision(
        { getBounds: () => getBounds(), velocity: { y: vy }, height: PLAYER_HEIGHT, position: { y } },
        platforms
      );
    }

    if (collision) {
      // Calculate fall distance
      const fallDistance = y + PLAYER_HEIGHT - fallStartY;
      lastLandingVelocity = vy;

      // Check for fall damage - momentum and slope aware
      // High speed + downhill = safe parkour landing
      // Low speed + flat/uphill = damage
      if (isFalling && fallDistance > 0) {
        const speedRatio = getSpeedRatio();
        const fallDamage = physics.calculateFallDamage(fallDistance, speedRatio, currentSlope);
        if (fallDamage > 0) {
          takeDamage(fallDamage, true);
          events.emit('player:fallDamage', {
            distance: fallDistance,
            damage: fallDamage,
            speedRatio,
            landingSlope: currentSlope,
          });
        } else if (fallDistance > 100) {
          // Successful parkour landing - emit event for feedback
          events.emit('player:parkourLanding', {
            distance: fallDistance,
            speedRatio,
            landingSlope: currentSlope,
          });
        }
      }

      y = collision.landingY - PLAYER_HEIGHT;
      vy = 0;
      isGrounded = true;
      isFalling = false;
      justLandedFlag = true;
      jumpsRemaining = maxJumps; // Reset to max jumps (including power-up bonuses)
    } else {
      isGrounded = false;
    }

    // Check for falling into bottomless pit
    const bottomlessThreshold = terrainManager?.getBottomlessThreshold?.() || 250;
    if (y > 600) {
      // Check if over a gap (bottomless pit)
      const overGap = terrainManager?.isOverGap?.(x + PLAYER_WIDTH / 2) || false;
      if (overGap || y > 800) {
        // Bottomless pit - instant death
        health = 0;
        events.emit('player:death', { cause: 'bottomless' });
      } else {
        // Just fell too far - take damage and respawn
        takeDamage(40, true);
        respawn(platforms);
      }
    }

    // Update score
    // Score scales with effective speed (input × momentum)
    // High effective speed = major score bonus
    const effectiveRatio = getSpeedRatio(); // 0-1 based on effective speed
    const speedBonus = effectiveRatio * 1.0; // Up to 100% bonus at max effective speed
    score = Math.floor(distance * 10 * (1 + speedBonus));

    // Handle attack input
    if (input.attack) {
      performAttack();
    }

    // Update projectiles
    updateProjectiles(dt);

    // Update animation
    updateAnimation(dt);
  }

  // Momentum is now updated inline in the main update function
  // (see MOMENTUM SYSTEM section)

  /**
   * Perform ranged attack
   */
  function performAttack() {
    const now = Date.now();
    if (now - lastAttackTime < ATTACK_COOLDOWN) return;

    lastAttackTime = now;

    projectiles.push({
      x: x + PLAYER_WIDTH,
      y: y + PLAYER_HEIGHT / 2 - 4,
      vx: 800,
      width: 16,
      height: 8,
      damage: 25,
      createdAt: now,
    });

    events.emit('player:attack');
  }

  /**
   * Update projectiles
   */
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx * dt;

      // Remove if too old or off screen
      if (Date.now() - p.createdAt > 2000 || p.x > x + 1000) {
        projectiles.splice(i, 1);
      }
    }
  }

  // Animation state tracking
  let animState = 'run'; // run, sprint, slide, jump, fall, stumble, land
  let animStateTimer = 0;
  let landingTimer = 0;
  let stumbleTimer = 0;
  let wasGrounded = true;

  /**
   * Update animation frame and state
   */
  function updateAnimation(dt) {
    // Use input speed for animation state decisions
    // (player controls animation, not momentum)

    // Determine animation state based on context
    const prevState = animState;

    if (stumbleTimer > 0) {
      animState = 'stumble';
      stumbleTimer -= dt * 1000;
    } else if (landingTimer > 0) {
      animState = 'land';
      landingTimer -= dt * 1000;
    } else if (!isGrounded && vy < -50) {
      animState = 'jump';
    } else if (!isGrounded && vy > 50) {
      animState = 'fall';
    } else if (isGrounded && inputSpeed > 0.7) {
      // Sprint when throttle is above 70%
      animState = 'sprint';
    } else if (isGrounded) {
      animState = 'run';
    }

    // Detect landing
    if (isGrounded && !wasGrounded) {
      landingTimer = 150; // Brief landing pose
      if (vy > 400) {
        stumbleTimer = 300; // Stumble on hard landing
      }
    }
    wasGrounded = isGrounded;

    // Reset timer on state change
    if (animState !== prevState) {
      animStateTimer = 0;
    }

    // Update animation timer
    animStateTimer += dt * 1000;

    // Frame rate varies by state
    const frameRate = animState === 'sprint' ? 60 : (animState === 'run' ? 80 : 100);
    animTimer += dt * 1000;
    if (animTimer > frameRate) {
      animTimer = 0;
      animFrame = (animFrame + 1) % 8;
    }
  }

  /**
   * Trigger stumble animation (called on damage)
   */
  function triggerStumble() {
    stumbleTimer = 400;
  }

  /**
   * Take damage (or heal if amount is negative)
   */
  function takeDamage(amount, isFall = false) {
    // Handle healing (negative damage)
    if (amount < 0) {
      health = Math.min(maxHealth, health - amount);
      events.emit('player:heal', { amount: -amount, health });
      return;
    }

    const now = Date.now();
    if (now < invulnerableUntil) return;

    // Check for shield from power-ups
    if (amount > 0 && !isFall && runPowerups?.consumeShield?.()) {
      events.emit('player:shieldBlock', { amount });
      invulnerableUntil = now + 500; // Brief invuln after shield
      return;
    }

    health -= amount;
    invulnerableUntil = now + INVULN_DURATION;

    // Lose momentum on hit (significant penalty)
    const momentumLoss = isFall ? MOMENTUM_DRAIN_FALL : MOMENTUM_DRAIN_HIT;
    momentum = Math.max(0, momentum - momentumLoss);

    // Trigger stumble animation
    triggerStumble();

    events.emit('player:damage', { amount, health, isFall });

    if (health <= 0) {
      events.emit('player:death');
    }
  }

  /**
   * Respawn after falling
   */
  function respawn(platforms) {
    // Find a safe platform to spawn on
    const safePlatform = platforms.find(p => p.x < x + 200 && p.x + p.width > x - 100);
    if (safePlatform) {
      x = safePlatform.x + safePlatform.width / 2;
      y = safePlatform.y - PLAYER_HEIGHT - 50;
    } else {
      y = 200;
    }
    vy = 0;
    isGrounded = false;
  }

  /**
   * Render the player as an animated stickman
   */
  function render(ctx) {
    // Flash when invulnerable
    const isInvuln = Date.now() < invulnerableUntil;
    if (isInvuln && Math.floor(Date.now() / 80) % 2 === 0) return;

    // Stickman dimensions
    const centerX = x + PLAYER_WIDTH / 2;
    const headY = y + 10;
    const shoulderY = y + 22;
    const hipY = y + 34;
    const footY = y + PLAYER_HEIGHT;

    // Animation parameters based on state
    const t = animStateTimer / 1000;
    const frame = animFrame;

    // Color based on speed/state (use effective speed for visual feedback)
    const effectiveSpeedRatio = getSpeedRatio();
    const bodyColor = isInvuln ? '#ff6b35' :
      (animState === 'sprint' ? '#fbbf24' :
        (animState === 'stumble' ? '#ef4444' : '#ffffff'));
    const headColor = effectiveSpeedRatio > 0.7 ? '#fbbf24' : '#e2e8f0';

    ctx.strokeStyle = bodyColor;
    ctx.fillStyle = headColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Calculate limb positions based on animation state
    let pose = getStickmanPose(animState, frame, t, effectiveSpeedRatio);

    // Apply stumble shake
    let shakeX = 0, shakeY = 0;
    if (animState === 'stumble') {
      shakeX = Math.sin(t * 50) * 3;
      shakeY = Math.abs(Math.sin(t * 30)) * 2;
    }

    const cx = centerX + shakeX;
    const sy = shoulderY + shakeY;
    const hy = hipY + shakeY;

    // Draw head
    ctx.beginPath();
    ctx.arc(cx + pose.headTilt, headY + shakeY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw body (spine)
    ctx.beginPath();
    ctx.moveTo(cx + pose.shoulderTilt, sy);
    ctx.lineTo(cx + pose.hipTilt, hy);
    ctx.stroke();

    // Draw arms
    const armLength = 14;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(cx + pose.shoulderTilt, sy);
    const lArmX = cx - 8 + pose.leftArm.x;
    const lArmY = sy + pose.leftArm.y;
    ctx.lineTo(lArmX, lArmY);
    ctx.lineTo(lArmX + pose.leftArm.handX, lArmY + pose.leftArm.handY);
    ctx.stroke();

    // Right arm
    ctx.beginPath();
    ctx.moveTo(cx + pose.shoulderTilt, sy);
    const rArmX = cx + 8 + pose.rightArm.x;
    const rArmY = sy + pose.rightArm.y;
    ctx.lineTo(rArmX, rArmY);
    ctx.lineTo(rArmX + pose.rightArm.handX, rArmY + pose.rightArm.handY);
    ctx.stroke();

    // Draw legs
    const legLength = 12;
    // Left leg
    ctx.beginPath();
    ctx.moveTo(cx + pose.hipTilt, hy);
    const lLegX = cx - 5 + pose.leftLeg.x;
    const lLegY = hy + pose.leftLeg.y;
    ctx.lineTo(lLegX, lLegY);
    ctx.lineTo(lLegX + pose.leftLeg.footX, footY + pose.leftLeg.footY);
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx + pose.hipTilt, hy);
    const rLegX = cx + 5 + pose.rightLeg.x;
    const rLegY = hy + pose.rightLeg.y;
    ctx.lineTo(rLegX, rLegY);
    ctx.lineTo(rLegX + pose.rightLeg.footX, footY + pose.rightLeg.footY);
    ctx.stroke();

    // Speed lines when sprinting (based on effective speed for visual feedback)
    const effectiveRatio = getSpeedRatio();
    if (animState === 'sprint' && effectiveRatio > 0.5) {
      ctx.strokeStyle = `rgba(251, 191, 36, ${effectiveRatio * 0.5})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const lineY = y + 15 + i * 12;
        const lineLen = 15 + effectiveRatio * 25;
        ctx.beginPath();
        ctx.moveTo(x - 5 - i * 3, lineY + Math.sin(t * 10 + i) * 3);
        ctx.lineTo(x - 5 - lineLen, lineY + Math.sin(t * 10 + i) * 3);
        ctx.stroke();
      }
    }

    // Draw projectiles
    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2;
    for (const p of projectiles) {
      // Energy ball with trail
      const trailLength = 20;
      ctx.fillStyle = 'rgba(34, 211, 238, 0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x - trailLength / 2, p.y + p.height / 2, trailLength, p.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  /**
   * Get stickman pose based on animation state
   */
  function getStickmanPose(state, frame, t, speedRatio) {
    const pose = {
      headTilt: 0,
      shoulderTilt: 0,
      hipTilt: 0,
      leftArm: { x: 0, y: 8, handX: -4, handY: 6 },
      rightArm: { x: 0, y: 8, handX: 4, handY: 6 },
      leftLeg: { x: 0, y: 6, footX: -3, footY: 0 },
      rightLeg: { x: 0, y: 6, footX: 3, footY: 0 },
    };

    const cycle = Math.sin(frame * Math.PI / 4);
    const fastCycle = Math.sin(frame * Math.PI / 2);

    switch (state) {
      case 'run':
        // Running animation - arms and legs swing opposite
        pose.headTilt = cycle * 1;
        pose.shoulderTilt = cycle * 2;
        pose.leftArm = { x: -cycle * 6, y: 6 + Math.abs(cycle) * 3, handX: -cycle * 4, handY: 5 };
        pose.rightArm = { x: cycle * 6, y: 6 + Math.abs(cycle) * 3, handX: cycle * 4, handY: 5 };
        pose.leftLeg = { x: cycle * 8, y: 5, footX: cycle * 4 - 2, footY: Math.abs(cycle) * -4 };
        pose.rightLeg = { x: -cycle * 8, y: 5, footX: -cycle * 4 + 2, footY: Math.abs(-cycle) * -4 };
        break;

      case 'sprint':
        // Faster, more exaggerated motion, leaning forward
        pose.headTilt = fastCycle * 2 + 3;
        pose.shoulderTilt = 4 + fastCycle * 3;
        pose.hipTilt = 2;
        pose.leftArm = { x: -fastCycle * 10, y: 4 + Math.abs(fastCycle) * 4, handX: -fastCycle * 6, handY: 4 };
        pose.rightArm = { x: fastCycle * 10, y: 4 + Math.abs(fastCycle) * 4, handX: fastCycle * 6, handY: 4 };
        pose.leftLeg = { x: fastCycle * 12, y: 4, footX: fastCycle * 6 - 2, footY: Math.abs(fastCycle) * -6 };
        pose.rightLeg = { x: -fastCycle * 12, y: 4, footX: -fastCycle * 6 + 2, footY: Math.abs(-fastCycle) * -6 };
        break;

      case 'jump':
        // Arms up, legs tucked
        pose.headTilt = -2;
        pose.shoulderTilt = -2;
        pose.leftArm = { x: -6, y: -4, handX: -4, handY: -6 };
        pose.rightArm = { x: 6, y: -4, handX: 4, handY: -6 };
        pose.leftLeg = { x: -4, y: 4, footX: 2, footY: -6 };
        pose.rightLeg = { x: 4, y: 4, footX: -2, footY: -6 };
        break;

      case 'fall':
        // Arms flailing, legs spread
        const flail = Math.sin(t * 15);
        pose.headTilt = flail * 3;
        pose.shoulderTilt = flail * 2;
        pose.leftArm = { x: -8 + flail * 4, y: -2 + Math.abs(flail) * 4, handX: -6, handY: flail * 4 };
        pose.rightArm = { x: 8 - flail * 4, y: -2 + Math.abs(flail) * 4, handX: 6, handY: -flail * 4 };
        pose.leftLeg = { x: -6, y: 8, footX: -4 + flail * 2, footY: 2 };
        pose.rightLeg = { x: 6, y: 8, footX: 4 - flail * 2, footY: 2 };
        break;

      case 'land':
        // Crouch pose
        pose.headTilt = 0;
        pose.shoulderTilt = 0;
        pose.hipTilt = 3;
        pose.leftArm = { x: -8, y: 6, handX: -2, handY: 8 };
        pose.rightArm = { x: 8, y: 6, handX: 2, handY: 8 };
        pose.leftLeg = { x: -8, y: 2, footX: -4, footY: -2 };
        pose.rightLeg = { x: 8, y: 2, footX: 4, footY: -2 };
        break;

      case 'stumble':
        // Off-balance, arms windmilling
        const wobble = Math.sin(t * 20);
        pose.headTilt = wobble * 6;
        pose.shoulderTilt = wobble * 8;
        pose.hipTilt = -wobble * 4;
        pose.leftArm = { x: -4 + wobble * 8, y: wobble * 6, handX: wobble * 6, handY: Math.abs(wobble) * 4 };
        pose.rightArm = { x: 4 - wobble * 8, y: -wobble * 6, handX: -wobble * 6, handY: Math.abs(wobble) * 4 };
        pose.leftLeg = { x: wobble * 6, y: 6, footX: wobble * 4, footY: Math.abs(wobble) * -3 };
        pose.rightLeg = { x: -wobble * 6, y: 6, footX: -wobble * 4, footY: Math.abs(wobble) * -3 };
        break;
    }

    return pose;
  }

  /**
   * Get player bounds for collision
   */
  function getBounds() {
    return { x, y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };
  }

  /**
   * Get full player state for auto-ability checks
   */
  function getState() {
    return {
      x,
      y,
      vx,
      vy,
      isGrounded,
      justLanded: justLandedFlag,
      landingVelocity: lastLandingVelocity,
      animState,
      health,
      // Speed info
      inputSpeed,
      inputRatio: getInputRatio(),
      momentum,
      momentumMult: getMomentumMultiplier(),
      effectiveSpeed: getEffectiveSpeed(),
      speedRatio: getSpeedRatio(),
      currentSlope,
    };
  }

  /**
   * Grant invincibility frames (for dodge abilities)
   */
  function grantIframes(duration) {
    invulnerableUntil = Math.max(invulnerableUntil, Date.now() + duration);
  }

  return {
    update,
    render,
    getBounds,
    getPosition: () => ({ x, y }),
    getVelocity: () => ({ x: vx, y: vy }),
    // Momentum (0-100, maps to 0.75x-1.5x multiplier)
    getMomentum: () => momentum,
    getMomentumMultiplier,
    // Input speed (0.1-1.0, player throttle position)
    getInputSpeed: () => inputSpeed,
    getInputRatio,
    // Effective speed (input × momentum × base)
    getSpeed: getEffectiveSpeed,
    getSpeedRatio,
    // Speed bounds for HUD display
    getMaxEffectiveSpeed: () => BASE_SPEED * MAX_INPUT * (DEFAULT_MAX_MULT * getModifier('speed')),
    getMinEffectiveSpeed: () => BASE_SPEED * MIN_INPUT * MIN_MOMENTUM_MULT,
    getHealth: () => (health / maxHealth) * 100,
    getScore: () => score,
    getDistance: () => distance,
    getAnimState: () => animState,
    getState,
    takeDamage,
    triggerStumble,
    grantIframes,
    isDead: () => health <= 0,
    isGrounded: () => isGrounded,
    isInvulnerable: () => Date.now() < invulnerableUntil,
    setGrounded: (grounded) => { isGrounded = grounded; },
    getProjectiles: () => projectiles,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  };
}

export default { createPlayer };
