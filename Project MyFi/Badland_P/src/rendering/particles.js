// particles.js — Particle System
// Visual effects for impacts, trails, melee attacks, projectiles

// Particle pool size
const MAX_PARTICLES = 200;
const MAX_EFFECTS = 50;

/**
 * Create the particle system
 */
export function createParticles() {
  const particles = [];
  // Special effects (slash arcs, shockwaves, etc.)
  const effects = [];

  /**
   * Spawn particles or effects at a position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string|object} typeOrOptions - Effect type string or options object
   * @param {object} extraOptions - Additional options when type is string
   */
  function spawn(x, y, typeOrOptions = {}, extraOptions = {}) {
    // Handle type-based spawning
    if (typeof typeOrOptions === 'string') {
      return spawnEffect(x, y, typeOrOptions, extraOptions);
    }

    const options = typeOrOptions;
    const {
      count = 10,
      color = '#fff',
      speed = 100,
      spread = Math.PI * 2,
      angle = 0,
      lifetime = 500,
      size = 4,
      gravity = 200,
      fadeOut = true,
    } = options;

    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) {
        particles.shift(); // Remove oldest
      }

      const particleAngle = angle + (Math.random() - 0.5) * spread;
      const particleSpeed = speed * (0.5 + Math.random() * 0.5);

      particles.push({
        x,
        y,
        vx: Math.cos(particleAngle) * particleSpeed,
        vy: Math.sin(particleAngle) * particleSpeed,
        size: size * (0.5 + Math.random() * 0.5),
        color,
        lifetime,
        age: 0,
        gravity,
        fadeOut,
      });
    }
  }

  /**
   * Spawn a special effect (slash, shockwave, etc.)
   */
  function spawnEffect(x, y, type, options = {}) {
    if (effects.length >= MAX_EFFECTS) {
      effects.shift();
    }

    const color = options.color || '#ff6b35';
    const radius = options.radius || 80;

    switch (type) {
      case 'slash':
        // Sword slash arc
        effects.push({
          type: 'slash',
          x,
          y,
          color,
          startAngle: options.startAngle || -Math.PI / 4,
          endAngle: options.endAngle || Math.PI / 4,
          radius: 40,
          lifetime: 200,
          age: 0,
          lineWidth: 4,
        });
        // Slash sparks
        spawn(x + 30, y, {
          count: 8,
          color,
          speed: 200,
          spread: Math.PI / 3,
          angle: 0,
          lifetime: 200,
          size: 3,
          gravity: 100,
        });
        break;

      case 'kick':
        // Flying kick impact burst
        effects.push({
          type: 'kick',
          x,
          y,
          color: options.color || '#fbbf24',
          radius: 30,
          lifetime: 150,
          age: 0,
        });
        spawn(x, y, {
          count: 12,
          color: options.color || '#fbbf24',
          speed: 300,
          spread: Math.PI,
          angle: 0,
          lifetime: 250,
          size: 5,
          gravity: 150,
        });
        break;

      case 'hit':
        // Enemy hit impact
        effects.push({
          type: 'impact',
          x,
          y,
          color,
          radius: 25,
          lifetime: 150,
          age: 0,
        });
        spawn(x, y, {
          count: 10,
          color,
          speed: 180,
          spread: Math.PI * 2,
          lifetime: 300,
          size: 4,
          gravity: 200,
        });
        break;

      case 'dodge':
        // Dodge roll afterimage
        effects.push({
          type: 'afterimage',
          x,
          y,
          color,
          width: 32,
          height: 48,
          lifetime: 300,
          age: 0,
        });
        spawn(x, y, {
          count: 6,
          color,
          speed: 80,
          spread: Math.PI * 2,
          lifetime: 200,
          size: 3,
          gravity: 0,
        });
        break;

      case 'shockwave':
        // Ground pound shockwave ring
        effects.push({
          type: 'shockwave',
          x,
          y,
          color,
          maxRadius: radius,
          currentRadius: 10,
          lifetime: 400,
          age: 0,
          lineWidth: 6,
        });
        // Ground debris
        spawn(x, y + 20, {
          count: 15,
          color: '#8b7355',
          speed: 250,
          spread: Math.PI,
          angle: -Math.PI / 2,
          lifetime: 400,
          size: 6,
          gravity: 400,
        });
        break;

      case 'fireball':
        // Fireball projectile trail
        effects.push({
          type: 'fireball',
          x,
          y,
          targetX: options.targetX || x + 100,
          targetY: options.targetY || y,
          color: '#ff6b35',
          radius: 12,
          lifetime: 600,
          age: 0,
          trail: [],
        });
        break;

      case 'groundPound':
        // Ground pound landing
        effects.push({
          type: 'shockwave',
          x,
          y,
          color: '#fbbf24',
          maxRadius: 60,
          currentRadius: 5,
          lifetime: 300,
          age: 0,
          lineWidth: 4,
        });
        spawn(x, y, {
          count: 20,
          color: '#fbbf24',
          speed: 200,
          spread: Math.PI,
          angle: -Math.PI / 2,
          lifetime: 350,
          size: 5,
          gravity: 350,
        });
        break;

      default:
        // Generic particle burst
        spawn(x, y, {
          count: 10,
          color,
          speed: 150,
          spread: Math.PI * 2,
          lifetime: 300,
          size: 4,
          gravity: 200,
        });
    }
  }

  /**
   * Spawn a burst effect (explosion)
   */
  function burst(x, y, color = '#ff6b35', count = 20) {
    spawn(x, y, {
      count,
      color,
      speed: 200,
      spread: Math.PI * 2,
      lifetime: 400,
      size: 6,
      gravity: 300,
    });
  }

  /**
   * Spawn a trail effect
   */
  function trail(x, y, color = '#22d3ee') {
    spawn(x, y, {
      count: 2,
      color,
      speed: 50,
      spread: 0.5,
      angle: Math.PI, // Backwards
      lifetime: 200,
      size: 3,
      gravity: 0,
    });
  }

  /**
   * Spawn a jump effect
   */
  function jumpEffect(x, y) {
    spawn(x, y, {
      count: 8,
      color: '#fbbf24',
      speed: 150,
      spread: Math.PI,
      angle: -Math.PI / 2, // Upward
      lifetime: 300,
      size: 5,
      gravity: 400,
    });
  }

  /**
   * Spawn a hit effect
   */
  function hitEffect(x, y) {
    spawn(x, y, {
      count: 15,
      color: '#ef4444',
      speed: 250,
      spread: Math.PI * 2,
      lifetime: 350,
      size: 4,
      gravity: 100,
    });
  }

  /**
   * Update all particles and effects
   */
  function update(dt) {
    const dtMs = dt * 1000;

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Apply gravity
      p.vy += p.gravity * dt;

      // Age particle
      p.age += dtMs;

      // Remove dead particles
      if (p.age >= p.lifetime) {
        particles.splice(i, 1);
      }
    }

    // Update special effects
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.age += dtMs;

      // Type-specific updates
      if (e.type === 'shockwave') {
        const progress = e.age / e.lifetime;
        e.currentRadius = e.maxRadius * progress;
      }

      if (e.type === 'fireball' && e.trail) {
        // Add trail point
        e.trail.push({ x: e.x, y: e.y, age: 0 });
        // Age and remove old trail points
        for (let j = e.trail.length - 1; j >= 0; j--) {
          e.trail[j].age += dtMs;
          if (e.trail[j].age > 150) {
            e.trail.splice(j, 1);
          }
        }
        // Move fireball toward target
        const dx = e.targetX - e.x;
        const dy = e.targetY - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          const speed = 600 * dt;
          e.x += (dx / dist) * speed;
          e.y += (dy / dist) * speed;
        }
      }

      // Remove expired effects
      if (e.age >= e.lifetime) {
        effects.splice(i, 1);
      }
    }
  }

  /**
   * Render all particles and effects
   */
  function render(ctx) {
    // Render special effects first (behind particles)
    for (const e of effects) {
      const alpha = 1 - (e.age / e.lifetime);
      ctx.globalAlpha = alpha;

      switch (e.type) {
        case 'slash':
          // Draw arc slash
          ctx.strokeStyle = e.color;
          ctx.lineWidth = e.lineWidth * (1 - e.age / e.lifetime);
          ctx.lineCap = 'round';
          ctx.beginPath();
          const slashProgress = Math.min(1, (e.age / e.lifetime) * 2);
          const currentEndAngle = e.startAngle + (e.endAngle - e.startAngle) * slashProgress;
          ctx.arc(e.x, e.y, e.radius, e.startAngle, currentEndAngle);
          ctx.stroke();
          // Outer glow
          ctx.globalAlpha = alpha * 0.3;
          ctx.lineWidth = e.lineWidth * 2;
          ctx.stroke();
          break;

        case 'kick':
          // Impact burst circle
          const kickProgress = e.age / e.lifetime;
          const kickRadius = e.radius * (1 + kickProgress);
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 3 * (1 - kickProgress);
          ctx.beginPath();
          ctx.arc(e.x, e.y, kickRadius, 0, Math.PI * 2);
          ctx.stroke();
          // Inner star
          ctx.fillStyle = e.color;
          ctx.globalAlpha = alpha * 0.5;
          drawStar(ctx, e.x, e.y, 4, e.radius * 0.6 * (1 - kickProgress), e.radius * 0.3 * (1 - kickProgress));
          break;

        case 'impact':
          // Simple impact ring
          const impactProgress = e.age / e.lifetime;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 2 * (1 - impactProgress);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius * (0.5 + impactProgress * 0.5), 0, Math.PI * 2);
          ctx.stroke();
          break;

        case 'afterimage':
          // Ghostly player silhouette
          ctx.fillStyle = e.color;
          ctx.globalAlpha = alpha * 0.4;
          ctx.fillRect(e.x - e.width / 2, e.y - e.height / 2, e.width, e.height);
          break;

        case 'shockwave':
          // Expanding ring
          ctx.strokeStyle = e.color;
          ctx.lineWidth = e.lineWidth * (1 - e.age / e.lifetime);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.currentRadius, 0, Math.PI * 2);
          ctx.stroke();
          // Inner wave
          ctx.globalAlpha = alpha * 0.3;
          ctx.lineWidth = e.lineWidth * 0.5;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.currentRadius * 0.7, 0, Math.PI * 2);
          ctx.stroke();
          break;

        case 'fireball':
          // Fireball with trail
          // Draw trail
          ctx.globalAlpha = 0.6;
          for (let i = 0; i < e.trail.length; i++) {
            const t = e.trail[i];
            const trailAlpha = 1 - (t.age / 150);
            const trailSize = e.radius * (0.3 + 0.4 * (1 - t.age / 150));
            ctx.globalAlpha = trailAlpha * 0.5;
            ctx.fillStyle = '#ff9500';
            ctx.beginPath();
            ctx.arc(t.x, t.y, trailSize, 0, Math.PI * 2);
            ctx.fill();
          }
          // Draw fireball core
          ctx.globalAlpha = alpha;
          // Outer glow
          const gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius * 1.5);
          gradient.addColorStop(0, '#ffff00');
          gradient.addColorStop(0.3, '#ff6b35');
          gradient.addColorStop(0.7, '#ff4500');
          gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius * 1.5, 0, Math.PI * 2);
          ctx.fill();
          // Core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }

    // Render particles
    for (const p of particles) {
      let alpha = 1;
      if (p.fadeOut) {
        alpha = 1 - (p.age / p.lifetime);
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Helper: Draw a star shape
   */
  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Clear all particles and effects
   */
  function clear() {
    particles.length = 0;
    effects.length = 0;
  }

  /**
   * Spawn a melee slash effect
   */
  function slashEffect(x, y, color = '#ff6b35') {
    spawn(x, y, 'slash', { color });
  }

  /**
   * Spawn a kick impact effect
   */
  function kickEffect(x, y, color = '#fbbf24') {
    spawn(x, y, 'kick', { color });
  }

  /**
   * Spawn a shockwave effect
   */
  function shockwaveEffect(x, y, radius = 80, color = '#22d3ee') {
    spawn(x, y, 'shockwave', { color, radius });
  }

  /**
   * Spawn a fireball projectile effect
   */
  function fireballEffect(x, y, targetX, targetY) {
    spawn(x, y, 'fireball', { targetX, targetY });
  }

  /**
   * Spawn a dodge afterimage effect
   */
  function dodgeEffect(x, y, color = '#6366f1') {
    spawn(x, y, 'dodge', { color });
  }

  return {
    spawn,
    burst,
    trail,
    jumpEffect,
    hitEffect,
    slashEffect,
    kickEffect,
    shockwaveEffect,
    fireballEffect,
    dodgeEffect,
    update,
    render,
    clear,
  };
}

export default { createParticles };
