// physics.js — Custom Physics System
// Momentum-based movement and collision detection with slope physics

// Physics constants - tuned for floaty, parkour feel
const GRAVITY = 1100; // pixels/s² (reduced for floatier jumps)
const TERMINAL_VELOCITY = 800; // max fall speed (reduced)
const FRICTION_GROUND = 0.92;
const FRICTION_AIR = 0.98;

// Slope physics constants
const SLOPE_SPEED_FACTOR = 200; // How much slope affects speed (pixels/s per slope unit)
const MAX_SLOPE_BONUS = 100; // Max speed bonus from downhill
const MAX_SLOPE_PENALTY = 80; // Max speed penalty from uphill

// Fall damage constants - momentum and slope aware
const FALL_DAMAGE_BASE_THRESHOLD = 100; // Base fall distance before damage
const FALL_DAMAGE_MOMENTUM_BONUS = 150; // Extra threshold at max speed (total 250 at full speed)
const FALL_DAMAGE_PER_PIXEL = 0.35; // Damage per pixel fallen beyond threshold
const FALL_DAMAGE_MAX = 60; // Maximum fall damage (won't insta-kill)
const FALL_DAMAGE_SLOPE_FORGIVENESS = 0.3; // Slopes steeper than this (downhill) = no damage
const FALL_DAMAGE_MOMENTUM_REDUCTION = 0.6; // Max damage reduction from momentum (60%)

/**
 * Create the physics system
 */
export function createPhysics() {
  /**
   * Apply gravity to velocity
   */
  function applyGravity(vy, dt) {
    return Math.min(vy + GRAVITY * dt, TERMINAL_VELOCITY);
  }

  /**
   * Apply friction to velocity
   */
  function applyFriction(vx, isGrounded) {
    const friction = isGrounded ? FRICTION_GROUND : FRICTION_AIR;
    return vx * friction;
  }

  /**
   * Check collision between two rectangles
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
   * Check if point is inside rectangle
   */
  function pointInRect(px, py, rect) {
    return (
      px >= rect.x &&
      px <= rect.x + rect.width &&
      py >= rect.y &&
      py <= rect.y + rect.height
    );
  }

  /**
   * Check collision between player and platforms
   * Returns collision info or null
   */
  function checkPlatformCollision(player, platforms) {
    const playerRect = player.getBounds();
    const playerBottom = playerRect.y + playerRect.height;
    const playerFeet = {
      x: playerRect.x + playerRect.width / 2,
      y: playerBottom,
    };

    for (const platform of platforms) {
      // Only check platforms below or at player level
      if (platform.y > playerRect.y + playerRect.height + 10) continue;

      // Check if player feet are within platform bounds
      if (
        playerFeet.x >= platform.x &&
        playerFeet.x <= platform.x + platform.width &&
        playerBottom >= platform.y &&
        playerBottom <= platform.y + 20 && // Tolerance for landing
        player.velocity.y >= 0 // Only when falling
      ) {
        return {
          platform,
          landingY: platform.y,
        };
      }
    }

    return null;
  }

  /**
   * Check if player is over a gap (no platform below)
   */
  function checkGap(playerX, platforms, lookAhead = 100) {
    for (const platform of platforms) {
      if (
        playerX >= platform.x - lookAhead &&
        playerX <= platform.x + platform.width + lookAhead
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Resolve collision with platform (snap to top)
   */
  function resolvePlatformCollision(player, collision) {
    player.position.y = collision.landingY - player.height;
    player.velocity.y = 0;
    player.setGrounded(true);
  }

  /**
   * Get momentum-scaled speed multiplier
   * Momentum 0 = 0.7x, Momentum 100 = 1.8x (more noticeable range)
   */
  function getMomentumMultiplier(momentum) {
    return 0.7 + (momentum / 100) * 1.1;
  }

  /**
   * Calculate speed adjustment from terrain slope
   * Negative slope = uphill = slower
   * Positive slope = downhill = faster
   * @param {number} slope - Terrain slope (rise/run)
   * @returns {number} Speed adjustment in pixels/s
   */
  function getSlopeSpeedAdjustment(slope) {
    // Clamp slope effect to reasonable bounds
    const adjustment = slope * SLOPE_SPEED_FACTOR;
    if (adjustment > 0) {
      // Downhill - bonus speed
      return Math.min(adjustment, MAX_SLOPE_BONUS);
    } else {
      // Uphill - penalty
      return Math.max(adjustment, -MAX_SLOPE_PENALTY);
    }
  }

  /**
   * Check if slope is too steep to run up
   * @param {number} slope - Terrain slope
   * @returns {boolean} True if too steep
   */
  function isSlopeTooSteep(slope) {
    return slope < -0.6; // ~31 degree incline is max runnable
  }

  /**
   * Calculate fall damage based on fall distance, momentum, and landing slope
   * - High momentum = bigger safe fall distance + damage reduction
   * - Downhill landing = no damage (parkour style)
   * - Flat/uphill landing with low momentum = full damage
   *
   * @param {number} fallDistance - Distance fallen in pixels
   * @param {number} speedRatio - Player's speed ratio (0-1, 0=min speed, 1=max speed)
   * @param {number} landingSlope - Terrain slope at landing point (positive=downhill, negative=uphill)
   * @returns {number} Damage to apply (0 if below threshold or safe landing)
   */
  function calculateFallDamage(fallDistance, speedRatio = 0, landingSlope = 0) {
    // Downhill landing (positive slope) = safe parkour landing
    // The steeper the downhill, the more forgiving
    if (landingSlope >= FALL_DAMAGE_SLOPE_FORGIVENESS) {
      // Steep enough downhill = no fall damage at all
      return 0;
    }

    // Moderate downhill provides partial protection
    let slopeProtection = 0;
    if (landingSlope > 0) {
      // Scale from 0 protection at slope=0 to full protection at slope=FORGIVENESS
      slopeProtection = landingSlope / FALL_DAMAGE_SLOPE_FORGIVENESS;
    }

    // Uphill landing (negative slope) = worse landing, reduce threshold
    let slopePenalty = 0;
    if (landingSlope < 0) {
      // Uphill makes it harder - reduce safe fall distance
      slopePenalty = Math.min(Math.abs(landingSlope) * 50, 40); // Up to 40px less safe distance
    }

    // Calculate dynamic threshold based on momentum
    // High speed = can handle bigger drops (like a parkour roll)
    const momentumBonus = speedRatio * FALL_DAMAGE_MOMENTUM_BONUS;
    const effectiveThreshold = FALL_DAMAGE_BASE_THRESHOLD + momentumBonus - slopePenalty;

    // No damage if below threshold
    if (fallDistance < effectiveThreshold) {
      return 0;
    }

    // Calculate base damage from excess fall
    const excessFall = fallDistance - effectiveThreshold;
    let damage = excessFall * FALL_DAMAGE_PER_PIXEL;

    // Apply momentum-based damage reduction (moving fast = absorb impact better)
    const momentumReduction = speedRatio * FALL_DAMAGE_MOMENTUM_REDUCTION;
    damage *= (1 - momentumReduction);

    // Apply slope protection
    damage *= (1 - slopeProtection);

    return Math.min(Math.round(damage), FALL_DAMAGE_MAX);
  }

  /**
   * Check if fall is into bottomless pit
   * @param {number} fallDistance - Distance fallen
   * @param {number} threshold - Bottomless threshold from terrain
   * @returns {boolean} True if bottomless pit
   */
  function isBottomlessFall(fallDistance, threshold) {
    return fallDistance > threshold;
  }

  /**
   * Check collision with sloped terrain
   * Uses terrain height function for smooth collision
   * @param {object} player - Player object with getBounds()
   * @param {function} getHeightAt - Function to get terrain height at x
   * @param {number} vy - Player's vertical velocity
   * @returns {object|null} Collision info or null
   */
  function checkTerrainCollision(player, getHeightAt, vy) {
    const playerRect = player.getBounds();
    const playerBottom = playerRect.y + playerRect.height;
    const playerCenterX = playerRect.x + playerRect.width / 2;

    // Get terrain height at player's center
    const terrainY = getHeightAt(playerCenterX);

    // Check if player is at or below terrain
    if (playerBottom >= terrainY && vy >= 0) {
      return {
        landingY: terrainY,
        terrainHeight: terrainY,
      };
    }

    return null;
  }

  return {
    GRAVITY,
    TERMINAL_VELOCITY,
    FALL_DAMAGE_BASE_THRESHOLD,
    FALL_DAMAGE_MOMENTUM_BONUS,
    applyGravity,
    applyFriction,
    rectIntersects,
    pointInRect,
    checkPlatformCollision,
    checkTerrainCollision,
    checkGap,
    resolvePlatformCollision,
    getMomentumMultiplier,
    getSlopeSpeedAdjustment,
    isSlopeTooSteep,
    calculateFallDamage,
    isBottomlessFall,
  };
}

export default { createPhysics };
