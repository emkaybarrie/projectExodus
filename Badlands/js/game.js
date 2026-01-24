/**
 * BADLANDS: Main Game Controller
 *
 * Orchestrates all game systems:
 * - Game state management
 * - Main loop
 * - Collision detection
 * - Score tracking
 * - Screen transitions
 */

const Game = (() => {
  // Game state
  let state = 'title'; // title, select, playing, paused, gameover
  let selectedClass = null;
  let score = 0;
  let highScore = 0;
  let combo = 0;
  let lastFrameTime = 0;

  // DOM elements
  let canvas;
  let screens = {};

  // Systems initialized flag
  let initialized = false;

  /**
   * Initialize game
   */
  function init() {
    // Get DOM elements
    canvas = document.getElementById('game-canvas');
    screens = {
      title: document.getElementById('title-screen'),
      select: document.getElementById('class-select'),
      game: document.getElementById('game-screen'),
      gameover: document.getElementById('game-over'),
      pause: document.getElementById('pause-overlay')
    };

    // Initialize renderer
    Renderer.init(canvas);

    // Initialize input
    InputSystem.init();

    // Load high score
    highScore = parseInt(localStorage.getItem('badlands_highscore') || '0');

    // Set up event listeners
    setupEventListeners();

    // Show title screen
    showScreen('title');

    initialized = true;
    console.log('[Game] Initialized');
  }

  /**
   * Set up UI event listeners
   */
  function setupEventListeners() {
    // Title screen
    document.getElementById('btn-start').addEventListener('click', () => {
      showScreen('select');
    });

    // Class selection
    document.querySelectorAll('.class-card').forEach(card => {
      card.addEventListener('click', () => {
        selectClass(card.dataset.class);
      });
    });

    // Game over
    document.getElementById('btn-retry').addEventListener('click', () => {
      startGame(selectedClass);
    });

    document.getElementById('btn-menu').addEventListener('click', () => {
      showScreen('title');
    });

    // Pause
    document.getElementById('btn-resume').addEventListener('click', () => {
      resumeGame();
    });

    document.getElementById('btn-quit').addEventListener('click', () => {
      quitToMenu();
    });

    // Pause button
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        pauseGame();
      });
    }

    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Input system callbacks - SIMPLIFIED (auto-attack handles combat)
    // Left side: Jump | Right side: Skill
    InputSystem.setCallbacks({
      jump: (action) => {
        if (state !== 'playing') return;
        if (action === 'start') {
          Player.jump();
          const rating = RhythmSystem.registerAction('jump');
          handleRhythmAction(rating);
        } else if (action === 'end') {
          Player.releaseJump();
        }
      },
      attack: () => {
        // Right side now triggers skill (auto-attack handles combat)
        if (state !== 'playing') return;
        Player.useAbility();
        const rating = RhythmSystem.registerAction('ability');
        handleRhythmAction(rating);
      },
      swipe: (direction) => {
        if (state !== 'playing') return;
        switch (direction) {
          case 'up':
            // Double jump / extra height
            Player.jump();
            break;
          case 'down':
            // Fast fall
            Player.fastFall();
            break;
        }
      },
      pause: () => {
        if (state === 'playing') {
          pauseGame();
        } else if (state === 'paused') {
          resumeGame();
        }
      }
    });

    // Rhythm system callbacks
    RhythmSystem.onBeat((beatNum) => {
      if (state === 'playing') {
        Renderer.triggerBeatPulse();
      }
    });
  }

  /**
   * Handle keyboard input
   */
  function handleKeyDown(e) {
    if (state === 'playing') {
      switch (e.code) {
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          Player.jump();
          const jumpRating = RhythmSystem.registerAction('jump');
          handleRhythmAction(jumpRating);
          break;

        case 'KeyX':
        case 'KeyJ':
        case 'KeyZ':
        case 'KeyK':
          // Skill activation (auto-attack handles combat)
          Player.useAbility();
          const abilityRating = RhythmSystem.registerAction('ability');
          handleRhythmAction(abilityRating);
          break;

        case 'ArrowDown':
        case 'KeyS':
          Player.fastFall();
          break;

        case 'Escape':
        case 'KeyP':
          pauseGame();
          break;
      }
    } else if (state === 'paused') {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        resumeGame();
      }
    }
  }

  function handleKeyUp(e) {
    if (state === 'playing') {
      switch (e.code) {
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          Player.releaseJump();
          break;
      }
    }
  }

  /**
   * Handle rhythm action feedback
   */
  function handleRhythmAction(rating) {
    if (!rating) return;

    switch (rating.rating) {
      case 'PERFECT':
        combo++;
        Renderer.triggerPerfectFlash();
        AudioSystem.playSFX('beatHit');
        showRatingPopup('PERFECT!', '#ffd700');
        break;

      case 'GOOD':
        combo++;
        AudioSystem.playSFX('beatHit');
        showRatingPopup('GOOD', '#88ff88');
        break;

      case 'OK':
        // Don't break combo, but no bonus
        showRatingPopup('OK', '#ffffff');
        break;

      case 'MISS':
        combo = 0;
        showRatingPopup('MISS', '#ff4444');
        break;
    }

    // Update combo display
    updateComboDisplay();
  }

  /**
   * Show rating popup
   */
  function showRatingPopup(text, color) {
    const popup = document.createElement('div');
    popup.className = 'rating-popup';
    popup.textContent = text;
    popup.style.color = color;

    const gameScreen = document.getElementById('game-screen');
    gameScreen.appendChild(popup);

    // Animate and remove
    setTimeout(() => {
      popup.style.opacity = '0';
      popup.style.transform = 'translateY(-50px)';
    }, 50);

    setTimeout(() => {
      popup.remove();
    }, 500);
  }

  /**
   * Update combo display
   */
  function updateComboDisplay() {
    const comboEl = document.getElementById('combo');
    if (combo > 1) {
      comboEl.textContent = `${combo}x`;
      comboEl.style.display = 'block';
      comboEl.style.transform = `scale(${1 + Math.min(combo / 20, 0.5)})`;
    } else {
      comboEl.style.display = 'none';
    }
  }

  /**
   * Select character class
   */
  function selectClass(classId) {
    selectedClass = classId;

    // Update UI
    document.querySelectorAll('.class-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.class === classId);
    });

    // Start game after short delay
    setTimeout(() => {
      startGame(classId);
    }, 300);
  }

  /**
   * Start new game
   */
  function startGame(classId) {
    selectedClass = classId;
    score = 0;
    combo = 0;

    // Initialize systems
    AudioSystem.init();
    RhythmSystem.init();
    Level.init();

    // Initialize player with starting position
    const levelState = Level.getState();
    Player.init(classId, 100, levelState.groundY - 50, levelState.groundY);

    // Start audio and rhythm
    AudioSystem.startMusic();
    RhythmSystem.start();

    // Show game screen
    showScreen('game');
    state = 'playing';

    // Resize canvas now that it's visible
    Renderer.resize();

    // Start game loop
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);

    console.log(`[Game] Started with class: ${classId}`);
  }

  /**
   * Main game loop
   */
  function gameLoop(currentTime) {
    if (state !== 'playing') return;

    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // Cap delta time to prevent huge jumps
    const cappedDelta = Math.min(deltaTime, 50);

    // Update systems
    update(cappedDelta);

    // Check collisions
    checkCollisions();

    // Render
    render();

    // Continue loop
    requestAnimationFrame(gameLoop);
  }

  /**
   * Update game state
   */
  function update(deltaTime) {
    // Get player position for level updates
    const playerState = Player.getState();

    // Update level
    Level.update(deltaTime, playerState.x);

    // Get level state for player
    const levelState = Level.getState();

    // Update player with platforms for collision
    Player.update(deltaTime, levelState.platforms);

    // Update score based on distance
    const distanceScore = Math.floor(playerState.x / 10);
    const comboBonus = Math.floor(combo * 0.5);
    score = distanceScore + comboBonus;

    // Update HUD
    updateHUD();

    // Clear per-frame input states
    InputSystem.clear();
  }

  /**
   * Check all collisions
   */
  function checkCollisions() {
    const playerState = Player.getState();
    const levelState = Level.getState();

    // Player hitbox
    const playerBox = {
      x: playerState.x + 5,
      y: playerState.y + 5,
      width: playerState.width - 10,
      height: playerState.height - 10
    };

    // Check enemy collisions
    for (const enemy of levelState.enemies) {
      if (!enemy.alive) continue;

      // Enemy body collision
      if (boxCollision(playerBox, enemy)) {
        if (playerState.state === 'attacking' || playerState.invincible) {
          // Player kills enemy
          enemy.health--;
          if (enemy.health <= 0) {
            Level.destroyEnemy(enemy);
            addScore(100);
            AudioSystem.playSFX('hit');
            Renderer.triggerScreenShake(0.5);
          }
        } else {
          // Enemy damages player
          handlePlayerHit(enemy.damage);
        }
      }

      // Check enemy projectiles
      if (enemy.projectiles) {
        for (const proj of enemy.projectiles) {
          if (boxCollision(playerBox, proj)) {
            if (!playerState.invincible) {
              handlePlayerHit(1);
            }
            // Remove projectile
            const idx = enemy.projectiles.indexOf(proj);
            if (idx > -1) enemy.projectiles.splice(idx, 1);
          }
        }
      }
    }

    // Check obstacle collisions
    for (const obstacle of levelState.obstacles) {
      if (!obstacle.alive) continue;

      if (boxCollision(playerBox, obstacle)) {
        if (obstacle.destructible && playerState.state === 'attacking') {
          Level.destroyObstacle(obstacle);
          addScore(25);
          AudioSystem.playSFX('hit');
        } else if (!playerState.invincible) {
          handlePlayerHit(obstacle.damage);
        }
      }
    }

    // Check power-up collisions
    for (const powerUp of levelState.powerUps) {
      if (powerUp.collected) continue;

      if (boxCollision(playerBox, powerUp)) {
        const type = Level.collectPowerUp(powerUp);
        handlePowerUp(type);
      }
    }

    // Check fall death - respawn instead of instant death
    if (Player.checkFallDeath(window.innerHeight)) {
      handlePlayerFall();
    }
  }

  /**
   * Handle player falling off screen
   */
  function handlePlayerFall() {
    const alive = Player.respawn();
    combo = 0;
    updateComboDisplay();

    Renderer.triggerHitFlash();
    Renderer.triggerScreenShake(1.5);

    if (!alive) {
      handlePlayerDeath();
    }
  }

  /**
   * Box collision check
   */
  function boxCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  }

  /**
   * Handle player taking damage
   */
  function handlePlayerHit(damage) {
    const alive = Player.takeDamage(damage);
    combo = 0;
    updateComboDisplay();

    AudioSystem.playSFX('hit');
    Renderer.triggerHitFlash();
    Renderer.triggerScreenShake(1);

    if (!alive) {
      handlePlayerDeath();
    }
  }

  /**
   * Handle power-up collection
   */
  function handlePowerUp(type) {
    switch (type) {
      case 'momentum':
        Player.addMomentum(30);
        break;
      case 'health':
        Player.heal(1);
        break;
    }

    AudioSystem.playSFX('combo');
    addScore(50);
  }

  /**
   * Add to score
   */
  function addScore(points) {
    const multiplier = RhythmSystem.getComboMultiplier();
    score += Math.round(points * multiplier);
  }

  /**
   * Handle player death
   */
  function handlePlayerDeath() {
    state = 'gameover';

    AudioSystem.playSFX('death');
    AudioSystem.stopMusic();
    RhythmSystem.stop();

    // Update high score
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('badlands_highscore', highScore.toString());
    }

    // Update game over screen
    document.getElementById('final-score').textContent = score;
    document.getElementById('high-score').textContent = highScore;

    // Show game over
    showScreen('gameover');

    console.log(`[Game] Game Over - Score: ${score}, High Score: ${highScore}`);
  }

  /**
   * Update HUD elements
   */
  function updateHUD() {
    document.getElementById('score').textContent = score;

    // Update momentum bar
    const playerState = Player.getState();
    const momentumBar = document.getElementById('momentum-fill');
    if (momentumBar) {
      momentumBar.style.width = `${playerState.momentum}%`;
    }

    // Update beat indicator
    const beatPhase = RhythmSystem.getBeatPhase();
    const beatIndicator = document.getElementById('beat-indicator');
    if (beatIndicator) {
      beatIndicator.style.setProperty('--beat-progress', beatPhase);
    }
  }

  /**
   * Render game
   */
  function render() {
    const playerState = Player.getState();
    const levelState = Level.getState();

    Renderer.render({
      player: playerState,
      level: levelState,
      rhythm: {
        combo: RhythmSystem.getCombo(),
        multiplier: RhythmSystem.getComboMultiplier(),
        beatPhase: RhythmSystem.getBeatPhase()
      },
      score: score,
      combo: combo,
      momentum: playerState.momentum,
      health: playerState.health,
      maxHealth: playerState.maxHealth,
      beatProgress: RhythmSystem.getBeatPhase(),
      gameOver: state === 'gameover',
      paused: state === 'paused'
    });
  }

  /**
   * Pause game
   */
  function pauseGame() {
    if (state !== 'playing') return;

    state = 'paused';
    AudioSystem.stopMusic();

    screens.pause.classList.remove('hidden');

    console.log('[Game] Paused');
  }

  /**
   * Resume game
   */
  function resumeGame() {
    if (state !== 'paused') return;

    state = 'playing';
    AudioSystem.startMusic();

    screens.pause.classList.add('hidden');

    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);

    console.log('[Game] Resumed');
  }

  /**
   * Quit to menu
   */
  function quitToMenu() {
    state = 'title';
    AudioSystem.stopMusic();
    RhythmSystem.stop();

    screens.pause.classList.add('hidden');
    showScreen('title');

    console.log('[Game] Quit to menu');
  }

  /**
   * Show specific screen
   */
  function showScreen(screenName) {
    Object.keys(screens).forEach(name => {
      if (screens[name]) {
        screens[name].classList.toggle('hidden', name !== screenName);
      }
    });

    // Always hide pause overlay unless explicitly paused
    if (screenName !== 'pause' && screens.pause) {
      screens.pause.classList.add('hidden');
    }
  }

  /**
   * Get current game state
   */
  function getState() {
    return {
      state,
      score,
      highScore,
      combo,
      selectedClass
    };
  }

  // Public API
  return {
    init,
    getState,
    pauseGame,
    resumeGame
  };
})();

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  Game.init();
});
