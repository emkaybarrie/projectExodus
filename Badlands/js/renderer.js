/**
 * BADLANDS: Renderer
 *
 * Canvas-based rendering with sprite animations and visual rhythm feedback.
 *
 * Visual Language:
 * - Beat pulses affect background and UI
 * - Momentum shown through particle trails
 * - Perfect hits create screen flashes
 * - Sprite-based character animations
 */

const Renderer = (() => {
  let canvas, ctx;
  let width, height;
  let cameraX = 0;

  // Visual effects state
  let screenShake = 0;
  let beatPulse = 0;
  let hitFlash = 0;
  let perfectFlash = 0;

  // Sprite system
  const sprites = new Map();
  const animations = {
    avatar1: {
      idle: { prefix: 'idle_', frames: 12, speed: 100 },
      run: { prefix: 'run_', frames: 10, speed: 60 },
      jump: { prefix: 'jump_', frames: 18, speed: 50 },
      attack: { prefix: '1_atk_', frames: 10, speed: 40 },
      death: { prefix: 'death_', frames: 19, speed: 80 },
      hit: { prefix: 'take_hit_', frames: 6, speed: 60 }
    }
  };

  // Animation state for each entity
  const animationStates = new Map();
  let spritesLoaded = false;

  // Background layers (using sprite images)
  let bgImages = {
    back: null,
    middle: null,
    tiles: null
  };

  // Parallax layers (fallback if sprites not loaded)
  const bgLayers = [
    { color: '#1a2a1a', speed: 0.1 },  // Far forest
    { color: '#2a3a2a', speed: 0.3 },  // Mid trees
    { color: '#3a4a3a', speed: 0.5 }   // Near brush
  ];

  // Debug flag
  let debugMode = true;
  let frameCount = 0;

  /**
   * Initialize renderer
   */
  function init(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    // Load sprites
    loadSprites();
    loadBackgroundImages();

    console.log('[Renderer] Initialized with canvas:', canvas.width, 'x', canvas.height);
  }

  /**
   * Load all sprites
   */
  async function loadSprites() {
    const basePath = 'assets/sprites/avatar1/';
    const loadPromises = [];

    // Load avatar animations
    for (const [animName, animData] of Object.entries(animations.avatar1)) {
      for (let i = 1; i <= animData.frames; i++) {
        const frameNum = i.toString().padStart(2, '0');
        const filename = `${animData.prefix}${frameNum}.png`;
        const key = `avatar1_${animName}_${i}`;

        loadPromises.push(loadImage(basePath + filename, key));
      }
    }

    // Load enemy sprites
    const enemySprites = ['nightBorne.png', 'nightBorne_Archer.png'];
    for (const sprite of enemySprites) {
      loadPromises.push(loadImage('assets/sprites/enemies/' + sprite, 'enemy_' + sprite.replace('.png', '')));
    }

    try {
      await Promise.all(loadPromises);
      spritesLoaded = true;
      console.log(`[Renderer] Loaded ${sprites.size} sprites`);
    } catch (e) {
      console.warn('[Renderer] Some sprites failed to load, using fallback rendering');
    }
  }

  /**
   * Load background images
   */
  async function loadBackgroundImages() {
    const basePath = 'assets/sprites/environment/';
    try {
      bgImages.back = await loadImageDirect(basePath + 'back.png');
      bgImages.middle = await loadImageDirect(basePath + 'middle.png');
      bgImages.tiles = await loadImageDirect(basePath + 'tiles.png');
      console.log('[Renderer] Background images loaded');
    } catch (e) {
      console.warn('[Renderer] Background images not loaded, using gradient fallback');
    }
  }

  /**
   * Load single image into sprites map
   */
  function loadImage(src, key) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        sprites.set(key, img);
        resolve(img);
      };
      img.onerror = () => {
        // Silent fail - we'll use fallback rendering
        resolve(null);
      };
      img.src = src;
    });
  }

  /**
   * Load image and return it directly
   */
  function loadImageDirect(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });
  }

  /**
   * Handle resize
   */
  function resize() {
    if (!canvas) {
      console.warn('[Renderer] Canvas not initialized');
      return;
    }

    // Get dimensions - prefer actual rendered size
    let w = canvas.offsetWidth;
    let h = canvas.offsetHeight;

    // Fallback to parent or window
    if (!w || w < 100) w = canvas.parentElement?.offsetWidth || window.innerWidth;
    if (!h || h < 100) h = canvas.parentElement?.offsetHeight || window.innerHeight;

    // Final fallback
    if (!w || w < 100) w = 800;
    if (!h || h < 100) h = 600;

    width = canvas.width = w;
    height = canvas.height = h;

    console.log(`[Renderer] Resized to ${width}x${height}`);
  }

  /**
   * Main render function
   */
  function render(gameState) {
    const { player, level, rhythm, score, combo, gameOver, paused } = gameState;

    // Ensure canvas has dimensions
    if (!width || !height) {
      resize();
    }

    // Update camera - keep player 30% from left edge
    if (player && typeof player.x === 'number' && !isNaN(player.x)) {
      cameraX = Math.max(0, player.x - width * 0.3);
    } else {
      cameraX = 0;
    }

    // Ensure cameraX is valid
    if (isNaN(cameraX) || !isFinite(cameraX)) {
      cameraX = 0;
    }

    // Apply screen shake
    let shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
      shakeX = (Math.random() - 0.5) * screenShake * 10;
      shakeY = (Math.random() - 0.5) * screenShake * 10;
      screenShake *= 0.9;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Clear and draw background
    drawBackground();

    // Draw parallax layers
    drawParallax();

    // World space rendering
    ctx.save();
    ctx.translate(-cameraX, 0);

    // Debug: Log render state occasionally
    frameCount++;
    if (frameCount <= 5 || frameCount % 300 === 0) {
      console.log(`[Renderer] Frame ${frameCount}: canvas=${width}x${height}, camera=${cameraX.toFixed(0)}, player=(${player?.x?.toFixed(0)},${player?.y?.toFixed(0)}), groundY=${level?.groundY}`);
    }

    // Debug: Draw a test square at player position to verify world rendering
    if (player) {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(player.x || 100, (level?.groundY || height * 0.8) - 60, 30, 30);
    }

    // Draw ground/terrain
    if (level && level.groundY !== undefined) {
      drawGround(level.groundY);
      if (level.platforms && level.platforms.length > 0) {
        drawPlatforms(level.platforms);
      }
      if (level.obstacles) drawObstacles(level.obstacles);
      if (level.powerUps) drawPowerUps(level.powerUps);
      if (level.enemies) drawEnemies(level.enemies);
      if (level.particles) drawParticles(level.particles);
    } else {
      // Fallback ground if level not ready
      ctx.fillStyle = '#3a5a3a';
      ctx.fillRect(cameraX, height * 0.8, width, height * 0.2);
    }

    // Draw player
    if (player && player.x !== undefined && player.y !== undefined) {
      drawPlayer(player);
      // Draw player projectiles (auto-attack)
      if (player.projectiles) {
        drawPlayerProjectiles(player.projectiles);
      }
    }

    ctx.restore();

    // Draw UI overlay
    drawUI(gameState);

    // Draw effects
    drawEffects();

    // Debug overlay (remove after fixing)
    if (debugMode) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(10, height - 100, 280, 90);
      ctx.fillStyle = '#0f0';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Canvas: ${width}x${height}`, 15, height - 82);
      ctx.fillText(`Camera: ${cameraX?.toFixed(0) || 'N/A'}`, 15, height - 67);
      ctx.fillText(`Player: (${player?.x?.toFixed(0) || 'N/A'}, ${player?.y?.toFixed(0) || 'N/A'})`, 15, height - 52);
      ctx.fillText(`GroundY: ${level?.groundY || 'N/A'}`, 15, height - 37);
      ctx.fillText(`Platforms: ${level?.platforms?.length || 0}`, 15, height - 22);
    }

    ctx.restore();
  }

  /**
   * Draw gradient background with beat pulse
   */
  function drawBackground() {
    const pulseIntensity = beatPulse * 0.1;

    // Forest-themed gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, lerpColor('#0d1a0d', '#1a2a1a', pulseIntensity));
    gradient.addColorStop(0.4, lerpColor('#1a2a1a', '#2a3a2a', pulseIntensity));
    gradient.addColorStop(0.7, lerpColor('#2a3a2a', '#3a4a3a', pulseIntensity));
    gradient.addColorStop(1, lerpColor('#3a4a3a', '#4a5a4a', pulseIntensity));

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Beat pulse overlay
    if (beatPulse > 0) {
      ctx.fillStyle = `rgba(100, 255, 100, ${beatPulse * 0.03})`;
      ctx.fillRect(0, 0, width, height);
      beatPulse *= 0.85;
    }
  }

  /**
   * Draw parallax background layers
   */
  function drawParallax() {
    // TEMPORARILY DISABLED sprite backgrounds for debugging
    // Use only procedural parallax for now
    const useProceduralOnly = true;

    // Use sprite backgrounds if loaded (disabled for debug)
    if (!useProceduralOnly && bgImages.back) {
      const backOffset = (cameraX * 0.1) % bgImages.back.width;
      for (let x = -bgImages.back.width; x < width + bgImages.back.width; x += bgImages.back.width) {
        ctx.drawImage(bgImages.back, x - backOffset, height - bgImages.back.height - 100);
      }
    }

    if (!useProceduralOnly && bgImages.middle) {
      const midOffset = (cameraX * 0.3) % bgImages.middle.width;
      for (let x = -bgImages.middle.width; x < width + bgImages.middle.width; x += bgImages.middle.width) {
        ctx.drawImage(bgImages.middle, x - midOffset, height - bgImages.middle.height - 50);
      }
    }

    // Use procedural parallax
    if (useProceduralOnly || (!bgImages.back && !bgImages.middle)) {
      for (const layer of bgLayers) {
        const offsetX = (cameraX * layer.speed) % width;

        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = -width; x < width * 2; x += 80) {
          const baseY = height - 120 - (layer.speed * 120);
          const hillHeight = Math.sin((x - offsetX) * 0.015) * 40 +
                            Math.sin((x - offsetX) * 0.008) * 20 + 35;
          ctx.lineTo(x + offsetX % 80, baseY - hillHeight);
        }

        ctx.lineTo(width * 2, height);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /**
   * Draw ground terrain
   */
  function drawGround(groundY) {
    // Ensure groundY is valid
    if (!groundY || isNaN(groundY) || groundY < 100 || groundY > height) {
      groundY = height * 0.8;
    }

    // Ground fill
    const groundGradient = ctx.createLinearGradient(0, groundY, 0, height);
    groundGradient.addColorStop(0, '#3a5a3a');
    groundGradient.addColorStop(0.2, '#2a4a2a');
    groundGradient.addColorStop(1, '#1a3a1a');

    ctx.fillStyle = groundGradient;
    ctx.fillRect(cameraX - 100, groundY, width + 200, height - groundY + 100);

    // Grass top edge - make it more visible
    ctx.fillStyle = '#6aca6a';
    ctx.fillRect(cameraX - 100, groundY - 4, width + 200, 8);

    // Ground texture details
    ctx.fillStyle = '#4a7a4a';
    for (let x = Math.floor((cameraX - 100) / 30) * 30; x < cameraX + width + 100; x += 30) {
      if ((x * 7) % 11 < 5) {
        ctx.fillRect(x, groundY + 5, 15, 3);
      }
    }
  }

  /**
   * Draw platforms
   */
  function drawPlatforms(platforms) {
    for (const platform of platforms) {
      // Platform body with grass theme
      const gradient = ctx.createLinearGradient(
        platform.x, platform.y,
        platform.x, platform.y + platform.height
      );
      gradient.addColorStop(0, '#5a8a5a');
      gradient.addColorStop(0.15, '#4a7a4a');
      gradient.addColorStop(0.3, '#3a6a3a');
      gradient.addColorStop(1, '#2a5a2a');

      ctx.fillStyle = gradient;

      // Rounded platform
      const radius = 8;
      ctx.beginPath();
      ctx.moveTo(platform.x + radius, platform.y);
      ctx.lineTo(platform.x + platform.width - radius, platform.y);
      ctx.quadraticCurveTo(platform.x + platform.width, platform.y, platform.x + platform.width, platform.y + radius);
      ctx.lineTo(platform.x + platform.width, platform.y + platform.height);
      ctx.lineTo(platform.x, platform.y + platform.height);
      ctx.lineTo(platform.x, platform.y + radius);
      ctx.quadraticCurveTo(platform.x, platform.y, platform.x + radius, platform.y);
      ctx.closePath();
      ctx.fill();

      // Grass top edge
      ctx.fillStyle = '#7aba7a';
      ctx.fillRect(platform.x, platform.y, platform.width, 4);

      // Grass tufts
      ctx.fillStyle = '#8aca8a';
      for (let i = 5; i < platform.width - 10; i += 12) {
        if ((platform.x + i) % 17 < 8) {
          ctx.beginPath();
          ctx.moveTo(platform.x + i, platform.y);
          ctx.lineTo(platform.x + i + 3, platform.y - 6);
          ctx.lineTo(platform.x + i + 6, platform.y);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Draw enemies with sprites or fallback
   */
  function drawEnemies(enemies) {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      const enemySprite = sprites.get('enemy_nightBorne');

      if (enemySprite) {
        // Draw sprite
        ctx.drawImage(
          enemySprite,
          enemy.x - enemy.width * 0.5,
          enemy.y - enemy.height * 0.3,
          enemy.width * 2,
          enemy.height * 1.6
        );
      } else {
        // Fallback: Draw styled enemy
        // Body
        const bodyGradient = ctx.createLinearGradient(enemy.x, enemy.y, enemy.x, enemy.y + enemy.height);
        bodyGradient.addColorStop(0, enemy.color);
        bodyGradient.addColorStop(1, darkenColor(enemy.color, 0.4));

        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        roundedRect(enemy.x, enemy.y, enemy.width, enemy.height, 5);
        ctx.fill();

        // Glowing eyes
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        const eyeX1 = enemy.x + enemy.width * 0.3;
        const eyeX2 = enemy.x + enemy.width * 0.7;
        const eyeY = enemy.y + enemy.height * 0.3;
        ctx.beginPath();
        ctx.arc(eyeX1, eyeY, 4, 0, Math.PI * 2);
        ctx.arc(eyeX2, eyeY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Type-specific features
        if (enemy.typeName === 'shooter') {
          ctx.fillStyle = '#666';
          ctx.fillRect(enemy.x - 12, enemy.y + enemy.height / 2 - 6, 18, 12);
          ctx.fillStyle = '#ff6600';
          ctx.beginPath();
          ctx.arc(enemy.x - 12, enemy.y + enemy.height / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw projectiles
      if (enemy.projectiles) {
        for (const proj of enemy.projectiles) {
          // Projectile glow
          ctx.fillStyle = 'rgba(255, 100, 0, 0.4)';
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.height, 0, Math.PI * 2);
          ctx.fill();

          // Projectile core
          ctx.fillStyle = '#ff6600';
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.height / 2, 0, Math.PI * 2);
          ctx.fill();

          // Trail
          ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
          for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.arc(proj.x + i * 8, proj.y, proj.height / 3 / i, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  /**
   * Draw obstacles
   */
  function drawObstacles(obstacles) {
    for (const obstacle of obstacles) {
      if (!obstacle.alive) continue;

      switch (obstacle.typeName) {
        case 'spike':
          // Metallic spike with gradient
          const spikeGrad = ctx.createLinearGradient(
            obstacle.x, obstacle.y + obstacle.height,
            obstacle.x + obstacle.width / 2, obstacle.y
          );
          spikeGrad.addColorStop(0, '#444');
          spikeGrad.addColorStop(0.5, '#888');
          spikeGrad.addColorStop(1, '#bbb');

          ctx.fillStyle = spikeGrad;
          ctx.beginPath();
          ctx.moveTo(obstacle.x + obstacle.width / 2, obstacle.y);
          ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
          ctx.lineTo(obstacle.x, obstacle.y + obstacle.height);
          ctx.closePath();
          ctx.fill();

          // Highlight edge
          ctx.strokeStyle = '#ddd';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(obstacle.x + obstacle.width / 2, obstacle.y + 2);
          ctx.lineTo(obstacle.x + obstacle.width * 0.65, obstacle.y + obstacle.height);
          ctx.stroke();
          break;

        case 'barrel':
          // Wooden barrel
          const barrelGrad = ctx.createLinearGradient(
            obstacle.x, obstacle.y, obstacle.x + obstacle.width, obstacle.y
          );
          barrelGrad.addColorStop(0, '#5c3317');
          barrelGrad.addColorStop(0.3, '#8b4513');
          barrelGrad.addColorStop(0.7, '#8b4513');
          barrelGrad.addColorStop(1, '#5c3317');

          ctx.fillStyle = barrelGrad;
          ctx.beginPath();
          roundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 3);
          ctx.fill();

          // Metal bands
          ctx.fillStyle = '#333';
          ctx.fillRect(obstacle.x - 2, obstacle.y + 8, obstacle.width + 4, 4);
          ctx.fillRect(obstacle.x - 2, obstacle.y + obstacle.height - 12, obstacle.width + 4, 4);
          break;

        case 'pit':
          // Dark pit with gradient
          const pitGrad = ctx.createLinearGradient(
            obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.height
          );
          pitGrad.addColorStop(0, '#222');
          pitGrad.addColorStop(1, '#000');

          ctx.fillStyle = pitGrad;
          ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

          // Danger edges
          ctx.fillStyle = '#ff4444';
          ctx.fillRect(obstacle.x, obstacle.y, 3, obstacle.height);
          ctx.fillRect(obstacle.x + obstacle.width - 3, obstacle.y, 3, obstacle.height);
          break;
      }
    }
  }

  /**
   * Draw power-ups
   */
  function drawPowerUps(powerUps) {
    const time = Date.now();

    for (const powerUp of powerUps) {
      if (powerUp.collected) continue;

      const floatY = Math.sin(time * 0.005 + powerUp.x) * 5;
      const cx = powerUp.x + powerUp.width / 2;
      const cy = powerUp.y + powerUp.height / 2 + floatY;

      // Outer glow
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, powerUp.width * 1.5);
      glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
      glowGrad.addColorStop(0.5, 'rgba(255, 215, 0, 0.2)');
      glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, powerUp.width * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Rotating ring
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, powerUp.width * 0.8, time * 0.003, time * 0.003 + Math.PI * 1.5);
      ctx.stroke();

      // Core
      const coreGrad = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, powerUp.width / 2);
      coreGrad.addColorStop(0, '#fff');
      coreGrad.addColorStop(0.5, '#ffd700');
      coreGrad.addColorStop(1, '#ff8c00');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, powerUp.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw particles
   */
  function drawParticles(particles) {
    if (!particles) return;

    for (const p of particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      // Circular particles
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Get animation frame for entity
   */
  function getAnimationFrame(entityId, animName, animSet = 'avatar1') {
    const animData = animations[animSet]?.[animName];
    if (!animData) return null;

    let state = animationStates.get(entityId);
    const now = Date.now();

    if (!state || state.animation !== animName) {
      state = { animation: animName, frame: 1, lastUpdate: now };
      animationStates.set(entityId, state);
    }

    // Update frame based on speed
    if (now - state.lastUpdate > animData.speed) {
      state.frame = (state.frame % animData.frames) + 1;
      state.lastUpdate = now;
    }

    return sprites.get(`${animSet}_${animName}_${state.frame}`);
  }

  /**
   * Draw player with sprites or enhanced fallback
   */
  function drawPlayer(player) {
    // Extract with safe defaults
    const x = player.x || 0;
    const y = player.y || 0;
    const pw = player.width || 40;
    const ph = player.height || 50;
    const classData = player.classData;
    const animationState = player.animationState || 'run';
    const momentum = player.momentum || 0;
    const facingRight = player.facingRight !== false;
    const invincible = player.invincible || false;

    // Determine animation to use
    let animName = 'run';
    if (animationState === 'jump') animName = 'jump';
    else if (animationState === 'attack') animName = 'attack';
    else if (animationState === 'dead') animName = 'death';
    else if (animationState === 'idle') animName = 'idle';

    // Get sprite frame
    const sprite = getAnimationFrame('player', animName);

    // Momentum trail
    if (momentum > 30) {
      const trailAlpha = (momentum - 30) / 100;
      const trailCount = Math.floor(momentum / 20);

      for (let i = 1; i <= trailCount; i++) {
        ctx.globalAlpha = trailAlpha * (1 - i / (trailCount + 1)) * 0.5;

        if (sprite) {
          ctx.drawImage(
            sprite,
            x - i * 20,
            y - ph * 0.3,
            pw * 2,
            ph * 1.6
          );
        } else {
          ctx.fillStyle = classData?.color || '#ff6600';
          ctx.fillRect(x - i * 15, y + 5, pw - 10, ph - 10);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Player shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + pw / 2, y + ph + 5, pw * 0.7, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Invincibility effect
    if (invincible && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Draw sprite or fallback
    if (sprite) {
      // Sprite rendering
      ctx.save();
      if (!facingRight) {
        ctx.translate(x + pw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, y - ph * 0.3, pw * 2, ph * 1.6);
      } else {
        ctx.drawImage(sprite, x - pw * 0.3, y - ph * 0.3, pw * 2, ph * 1.6);
      }
      ctx.restore();
    } else {
      // Enhanced fallback rendering
      drawPlayerFallback(player);
    }

    ctx.globalAlpha = 1;

    // Ability aura effect
    if (animationState === 'ability' && classData) {
      const time = Date.now();
      ctx.strokeStyle = classData.color || '#ff6600';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + Math.sin(time * 0.01) * 0.2;
      ctx.beginPath();
      ctx.arc(x + pw / 2, y + ph / 2, pw * 1.2 + Math.sin(time * 0.02) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Draw player auto-attack projectiles
   */
  function drawPlayerProjectiles(projectiles) {
    for (const proj of projectiles) {
      const cx = proj.x + proj.width / 2;
      const cy = proj.y;

      // Outer glow
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, proj.width);
      glowGrad.addColorStop(0, 'rgba(100, 200, 255, 0.6)');
      glowGrad.addColorStop(0.5, 'rgba(100, 200, 255, 0.3)');
      glowGrad.addColorStop(1, 'rgba(100, 200, 255, 0)');

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, proj.width, 0, Math.PI * 2);
      ctx.fill();

      // Core projectile
      ctx.fillStyle = '#88ddff';
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(cx, cy, proj.width / 2, proj.height / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Trail
      ctx.fillStyle = 'rgba(100, 200, 255, 0.4)';
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.ellipse(cx - i * 10, cy, (proj.width / 2) / i, (proj.height / 3) / i, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Helper: Draw rounded rectangle (polyfill for older browsers)
   */
  function roundedRect(x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      // Fallback for browsers without roundRect
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
  }

  /**
   * Fallback player rendering (enhanced version)
   */
  function drawPlayerFallback(player) {
    // Safe defaults
    const x = player.x || 0;
    const y = player.y || 0;
    const pw = player.width || 40;
    const ph = player.height || 50;
    const classData = player.classData;
    const classId = player.classId || 'warrior';
    const facingRight = player.facingRight !== false;

    if (!classData) {
      // Simple orange rectangle if no class data
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(x, y, pw, ph);
      return;
    }

    // Body gradient
    const bodyGradient = ctx.createLinearGradient(x, y, x + pw, y + ph);
    bodyGradient.addColorStop(0, classData.color || '#ff6600');
    bodyGradient.addColorStop(0.6, classData.colorSecondary || '#cc4400');
    bodyGradient.addColorStop(1, darkenColor(classData.colorSecondary || '#cc4400', 0.3));

    // Rounded body
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    roundedRect(x, y, pw, ph, 8);
    ctx.fill();

    // Class-specific details
    switch (classId) {
      case 'warrior':
        // Armor highlights
        ctx.fillStyle = '#999';
        ctx.fillRect(x + 5, y + 5, pw - 10, 8);
        // Shield
        ctx.fillStyle = '#777';
        ctx.beginPath();
        roundedRect(x + (facingRight ? pw - 10 : 0), y + 15, 10, 25, 3);
        ctx.fill();
        // Helmet visor
        ctx.fillStyle = '#222';
        ctx.fillRect(x + 8, y + 12, pw - 16, 6);
        break;

      case 'mage':
        // Hood
        ctx.fillStyle = classData.colorSecondary;
        ctx.beginPath();
        ctx.moveTo(x + pw / 2, y - 8);
        ctx.lineTo(x + pw - 3, y + 18);
        ctx.lineTo(x + 3, y + 18);
        ctx.closePath();
        ctx.fill();
        // Staff glow
        ctx.fillStyle = '#9933ff';
        ctx.shadowColor = '#9933ff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(x + (facingRight ? pw + 8 : -8), y + 8, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;

      case 'rogue':
        // Cloak edge
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.moveTo(x, y + ph);
        ctx.lineTo(x - 5, y + ph + 10);
        ctx.lineTo(x + 15, y + ph);
        ctx.fill();
        // Daggers
        ctx.fillStyle = '#ccc';
        ctx.fillRect(x + (facingRight ? pw : -12), y + 22, 12, 3);
        ctx.fillRect(x + (facingRight ? pw : -12), y + 32, 12, 3);
        // Mask
        ctx.fillStyle = '#111';
        ctx.fillRect(x + 6, y + 14, pw - 12, 5);
        break;
    }

    // Eyes with glow
    ctx.fillStyle = '#fff';
    const eyeX = x + (facingRight ? pw * 0.65 : pw * 0.35);
    ctx.beginPath();
    ctx.arc(eyeX, y + 18, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(eyeX + (facingRight ? 1 : -1), y + 18, 2, 0, Math.PI * 2);
    ctx.fill();

    // Attack effect
    if (animationState === 'attack') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      const attackX = x + (facingRight ? pw + 25 : -25);
      ctx.beginPath();
      ctx.moveTo(attackX - 20, y + ph / 2 - 20);
      ctx.lineTo(attackX + 20, y + ph / 2 + 20);
      ctx.moveTo(attackX + 20, y + ph / 2 - 20);
      ctx.lineTo(attackX - 20, y + ph / 2 + 20);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  /**
   * Draw UI overlay
   */
  function drawUI(gameState) {
    const { score, combo, momentum, health, maxHealth, player } = gameState;

    // Score with shadow
    ctx.fillStyle = '#000';
    ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score || 0}`, 22, 42);

    ctx.fillStyle = '#ffd700';
    ctx.fillText(`SCORE: ${score || 0}`, 20, 40);

    // Combo with scaling effect
    if (combo > 1) {
      const comboScale = 1 + Math.min(combo / 15, 0.6);
      const fontSize = Math.floor(22 * comboScale);
      ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;

      // Glow for high combos
      if (combo >= 10) {
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = combo >= 10 ? '#ff6600' : combo >= 5 ? '#ffaa00' : '#ffd700';
      ctx.fillText(`${combo}x COMBO`, 20, 75);
      ctx.shadowBlur = 0;
    }

    // Energy bar (new)
    if (player?.energy !== undefined) {
      const energyBarWidth = 150;
      const energyBarHeight = 8;
      const energyBarX = 20;
      const energyBarY = combo > 1 ? 90 : 60;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      roundedRect(energyBarX, energyBarY, energyBarWidth, energyBarHeight, 4);
      ctx.fill();

      // Energy fill
      const energyPercent = (player.energy || 0) / (player.maxEnergy || 100);
      const energyGrad = ctx.createLinearGradient(energyBarX, energyBarY, energyBarX + energyBarWidth, energyBarY);
      energyGrad.addColorStop(0, '#00aaff');
      energyGrad.addColorStop(1, '#0066ff');

      ctx.fillStyle = energyGrad;
      ctx.beginPath();
      roundedRect(energyBarX, energyBarY, energyBarWidth * energyPercent, energyBarHeight, 4);
      ctx.fill();

      // Label
      ctx.fillStyle = '#aaddff';
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillText('ENERGY', energyBarX + 2, energyBarY + energyBarHeight + 12);
    }

    // Momentum bar (bottom of screen)
    const barWidth = width - 40;
    const barHeight = 18;
    const barY = height - 35;

    // Bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    roundedRect(20, barY, barWidth, barHeight, 9);
    ctx.fill();

    // Momentum fill with gradient
    const momentumPercent = (momentum || 0) / 100;
    const momentumGradient = ctx.createLinearGradient(20, barY, 20 + barWidth, barY);
    momentumGradient.addColorStop(0, '#ff2200');
    momentumGradient.addColorStop(0.4, '#ff6600');
    momentumGradient.addColorStop(0.7, '#ffaa00');
    momentumGradient.addColorStop(1, '#ffdd00');

    ctx.fillStyle = momentumGradient;
    ctx.beginPath();
    roundedRect(20, barY, barWidth * momentumPercent, barHeight, 9);
    ctx.fill();

    // Momentum glow at high levels
    if (momentum > 70) {
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      roundedRect(20, barY, barWidth * momentumPercent, barHeight, 9);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Momentum label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MOMENTUM', width / 2, barY + 13);

    // Health hearts (top right)
    drawHealthHearts(health, maxHealth);

    // Beat indicator
    drawBeatIndicator(gameState.beatProgress);
  }

  /**
   * Draw health hearts
   */
  function drawHealthHearts(health, maxHealth) {
    const heartSize = 28;
    const maxHearts = maxHealth || 3;
    const currentHearts = health || 3;

    for (let i = 0; i < maxHearts; i++) {
      const hx = width - 35 - (i * (heartSize + 8));
      const hy = 28;

      if (i < currentHearts) {
        // Full heart with glow
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ff4444';
        drawHeart(hx, hy, heartSize);
        ctx.shadowBlur = 0;

        // Highlight
        ctx.fillStyle = '#ff8888';
        drawHeart(hx + 3, hy - 2, heartSize * 0.3);
      } else {
        // Empty heart
        ctx.strokeStyle = '#884444';
        ctx.lineWidth = 2;
        drawHeartOutline(hx, hy, heartSize);
      }
    }
  }

  /**
   * Draw beat indicator
   */
  function drawBeatIndicator(beatProgress) {
    const indicatorX = width / 2;
    const indicatorY = 55;

    // Outer ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 22, 0, Math.PI * 2);
    ctx.stroke();

    // Progress arc
    const progress = beatProgress || 0;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 22, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Beat flash
    if (beatPulse > 0.5) {
      ctx.fillStyle = `rgba(255, 215, 0, ${(beatPulse - 0.5) * 0.8})`;
      ctx.beginPath();
      ctx.arc(indicatorX, indicatorY, 28, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center dot
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw filled heart shape
   */
  function drawHeart(x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + size / 4);
    ctx.bezierCurveTo(x - size / 2, y + size / 2, x, y + size * 0.75, x, y + size);
    ctx.bezierCurveTo(x, y + size * 0.75, x + size / 2, y + size / 2, x + size / 2, y + size / 4);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size / 4);
    ctx.fill();
  }

  /**
   * Draw heart outline
   */
  function drawHeartOutline(x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + size / 4);
    ctx.bezierCurveTo(x - size / 2, y + size / 2, x, y + size * 0.75, x, y + size);
    ctx.bezierCurveTo(x, y + size * 0.75, x + size / 2, y + size / 2, x + size / 2, y + size / 4);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size / 4);
    ctx.stroke();
  }

  /**
   * Draw screen effects
   */
  function drawEffects() {
    // Hit flash (red vignette)
    if (hitFlash > 0) {
      const vignette = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7
      );
      vignette.addColorStop(0, 'rgba(255, 0, 0, 0)');
      vignette.addColorStop(0.7, `rgba(255, 0, 0, ${hitFlash * 0.2})`);
      vignette.addColorStop(1, `rgba(255, 0, 0, ${hitFlash * 0.5})`);

      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
      hitFlash *= 0.85;
    }

    // Perfect flash (gold overlay)
    if (perfectFlash > 0) {
      ctx.fillStyle = `rgba(255, 215, 0, ${perfectFlash * 0.15})`;
      ctx.fillRect(0, 0, width, height);
      perfectFlash *= 0.9;
    }
  }

  /**
   * Lerp between two colors
   */
  function lerpColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);

    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Darken a hex color
   */
  function darkenColor(hex, amount) {
    const rgb = hexToRgb(hex);
    const r = Math.round(rgb.r * (1 - amount));
    const g = Math.round(rgb.g * (1 - amount));
    const b = Math.round(rgb.b * (1 - amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Convert hex to RGB
   */
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 100, g: 100, b: 100 };
  }

  // Effect triggers
  function triggerBeatPulse() {
    beatPulse = 1;
  }

  function triggerScreenShake(intensity = 1) {
    screenShake = Math.max(screenShake, intensity);
  }

  function triggerHitFlash() {
    hitFlash = 1;
  }

  function triggerPerfectFlash() {
    perfectFlash = 1;
  }

  // Public API
  return {
    init,
    render,
    resize,
    triggerBeatPulse,
    triggerScreenShake,
    triggerHitFlash,
    triggerPerfectFlash
  };
})();
