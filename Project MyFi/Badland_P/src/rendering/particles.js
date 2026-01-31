// particles.js — Particle System
// Visual effects for impacts, trails, etc.

// Particle pool size
const MAX_PARTICLES = 200;

/**
 * Create the particle system
 */
export function createParticles() {
  const particles = [];

  /**
   * Spawn particles at a position
   */
  function spawn(x, y, options = {}) {
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
   * Update all particles
   */
  function update(dt) {
    const dtMs = dt * 1000;

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
  }

  /**
   * Render all particles
   */
  function render(ctx) {
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
   * Clear all particles
   */
  function clear() {
    particles.length = 0;
  }

  return {
    spawn,
    burst,
    trail,
    jumpEffect,
    hitEffect,
    update,
    render,
    clear,
  };
}

export default { createParticles };
