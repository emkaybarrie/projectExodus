// pickups.js — Pickup Manager
// Power-ups, collectibles, and health orbs

// Pickup types
const PICKUP_TYPES = {
  health: {
    width: 24,
    height: 24,
    color: '#ef4444',
    icon: '❤️',
    effect: 'heal',
    value: 25,
  },
  momentum: {
    width: 24,
    height: 24,
    color: '#22d3ee',
    icon: '⚡',
    effect: 'momentum',
    value: 20,
  },
  essence: {
    width: 20,
    height: 20,
    color: '#a855f7',
    icon: '✨',
    effect: 'essence',
    value: 10,
  },
  shield: {
    width: 28,
    height: 28,
    color: '#3b82f6',
    icon: '🛡️',
    effect: 'shield',
    value: 5, // seconds
  },
  magnet: {
    width: 28,
    height: 28,
    color: '#fbbf24',
    icon: '🧲',
    effect: 'magnet',
    value: 10, // seconds
  },
};

// Spawn settings
const SPAWN_INTERVAL = 2000; // ms
const SPAWN_DISTANCE = 600; // pixels ahead
const MAX_PICKUPS = 10;

/**
 * Create the pickup manager
 */
export function createPickupManager(events) {
  const pickups = [];
  let lastSpawnTime = 0;
  let magnetActive = false;

  /**
   * Update all pickups
   */
  function update(dt, player, visibleRange) {
    const playerPos = player.getPosition();
    const playerBounds = player.getBounds();

    // Try to spawn new pickup
    trySpawn(playerPos.x);

    // Update each pickup
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pickup = pickups[i];

      // Float animation
      pickup.floatOffset = Math.sin(Date.now() / 300 + pickup.id) * 5;

      // Magnet effect - attract to player
      if (magnetActive && pickup.type.effect !== 'magnet') {
        const dx = playerPos.x - pickup.x;
        const dy = playerPos.y - pickup.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          pickup.x += (dx / dist) * 300 * dt;
          pickup.y += (dy / dist) * 300 * dt;
        }
      }

      // Check collection
      const pickupBounds = {
        x: pickup.x - pickup.type.width / 2,
        y: pickup.y - pickup.type.height / 2 + pickup.floatOffset,
        width: pickup.type.width,
        height: pickup.type.height,
      };

      if (rectIntersects(playerBounds, pickupBounds)) {
        collectPickup(pickup, player);
        pickups.splice(i, 1);
        continue;
      }

      // Remove if too far behind
      if (pickup.x < visibleRange.minX - 100) {
        pickups.splice(i, 1);
      }
    }
  }

  /**
   * Try to spawn a new pickup
   */
  function trySpawn(playerX) {
    const now = Date.now();
    if (now - lastSpawnTime < SPAWN_INTERVAL) return;
    if (pickups.length >= MAX_PICKUPS) return;

    lastSpawnTime = now;

    // Weighted random type selection
    const roll = Math.random();
    let typeKey;
    if (roll < 0.4) {
      typeKey = 'essence';
    } else if (roll < 0.6) {
      typeKey = 'momentum';
    } else if (roll < 0.75) {
      typeKey = 'health';
    } else if (roll < 0.9) {
      typeKey = 'shield';
    } else {
      typeKey = 'magnet';
    }

    const type = PICKUP_TYPES[typeKey];

    pickups.push({
      id: Math.random(),
      x: playerX + SPAWN_DISTANCE + Math.random() * 200,
      y: 300 + Math.random() * 100, // Adjusted for new ground level
      type,
      floatOffset: 0,
    });
  }

  /**
   * Collect a pickup and apply effect
   */
  function collectPickup(pickup, player) {
    const { effect, value } = pickup.type;

    switch (effect) {
      case 'heal':
        // Heal player (handled externally)
        events.emit('pickup:health', { value });
        break;

      case 'momentum':
        // Boost momentum
        events.emit('pickup:momentum', { value });
        break;

      case 'essence':
        // Add essence
        events.emit('pickup:essence', { value });
        break;

      case 'shield':
        // Temporary invulnerability
        events.emit('pickup:shield', { duration: value * 1000 });
        break;

      case 'magnet':
        // Attract nearby pickups
        magnetActive = true;
        setTimeout(() => { magnetActive = false; }, value * 1000);
        events.emit('pickup:magnet', { duration: value * 1000 });
        break;
    }

    events.emit('pickup:collected', { type: effect, value });
  }

  /**
   * Render all pickups
   */
  function render(ctx) {
    for (const pickup of pickups) {
      const { type, x, y, floatOffset } = pickup;
      const drawY = y + floatOffset;

      // Glow effect
      ctx.fillStyle = type.color + '40';
      ctx.beginPath();
      ctx.arc(x, drawY, type.width, 0, Math.PI * 2);
      ctx.fill();

      // Main body
      ctx.fillStyle = type.color;
      ctx.beginPath();
      ctx.arc(x, drawY, type.width / 2, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x - type.width * 0.15, drawY - type.width * 0.15, type.width * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
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

  return {
    update,
    render,
  };
}

export default { createPickupManager };
