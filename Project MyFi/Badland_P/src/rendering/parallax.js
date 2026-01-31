// parallax.js — Parallax Background System
// Multi-layer scrolling backgrounds with zone-based transitions

// Region color themes with zone variations - wilderness/nature themed
const REGION_THEMES = {
  frontier: {
    zones: [
      // Zone 0: Golden plains at dawn
      { sky: ['#87ceeb', '#b0d4e8', '#f0e68c'], horizon: '#ffd700', ground: '#4a7c59', accent: '#7cb342' },
      // Zone 1: Midday meadows
      { sky: ['#5cb3cc', '#87ceeb', '#c8e6c9'], horizon: '#ffe082', ground: '#3d6b4f', accent: '#66bb6a' },
      // Zone 2: Afternoon hills
      { sky: ['#4a90a4', '#6aaebd', '#a5d6a7'], horizon: '#ffb74d', ground: '#2e5a40', accent: '#4caf50' },
      // Zone 3: Sunset mountains
      { sky: ['#ff8a65', '#ffab91', '#ffcc80'], horizon: '#ff7043', ground: '#1b4332', accent: '#fb8c00' },
      // Zone 4: Twilight valleys
      { sky: ['#5c6bc0', '#7986cb', '#9fa8da'], horizon: '#ff5722', ground: '#0d3320', accent: '#e64a19' },
    ],
    features: { stars: false, clouds: true, birds: true, trees: true },
  },
  badlands: {
    zones: [
      // Zone 0: Desert canyon entrance
      { sky: ['#f4a460', '#deb887', '#ffdab9'], horizon: '#cd853f', ground: '#8b4513', accent: '#d2691e' },
      // Zone 1: Red rock valley
      { sky: ['#e07b53', '#cd6839', '#b8533f'], horizon: '#ff6347', ground: '#8b3a3a', accent: '#dc143c' },
      // Zone 2: Scorched mesa
      { sky: ['#c0392b', '#a93226', '#922b21'], horizon: '#ff4500', ground: '#6b2020', accent: '#b22222' },
      // Zone 3: Volcanic ridge
      { sky: ['#4a1c1c', '#3d1515', '#2d0d0d'], horizon: '#ff3300', ground: '#4a0e0e', accent: '#ff4444' },
      // Zone 4: Ashen wasteland
      { sky: ['#2c2c2c', '#3a3a3a', '#4a4a4a'], horizon: '#a0522d', ground: '#2d2d2d', accent: '#696969' },
    ],
    features: { stars: false, embers: true, smoke: true, rocks: true },
  },
  void: {
    zones: [
      // Zone 0: Mystical forest
      { sky: ['#1a1a3e', '#252550', '#303065'], horizon: '#9370db', ground: '#1a0a2e', accent: '#ba55d3' },
      // Zone 1: Crystal caverns
      { sky: ['#15152d', '#202040', '#2a2a55'], horizon: '#8a2be2', ground: '#150825', accent: '#9932cc' },
      // Zone 2: Ethereal plains
      { sky: ['#100d25', '#1a1535', '#241e45'], horizon: '#7b68ee', ground: '#0d0518', accent: '#8b5cf6' },
      // Zone 3: Shadow realm
      { sky: ['#0a0815', '#0f0c20', '#15102a'], horizon: '#6366f1', ground: '#08030f', accent: '#4f46e5' },
      // Zone 4: Void's edge
      { sky: ['#050510', '#080815', '#0b0b1a'], horizon: '#4338ca', ground: '#030208', accent: '#3730a3' },
    ],
    features: { stars: true, auroras: true, portals: true, crystals: true },
  },
};

/**
 * Create the parallax background system
 */
export function createParallax() {
  let width = 800;
  let height = 600;
  let regionId = 'frontier';
  let regionData = REGION_THEMES.frontier;
  let currentZone = 0;
  let targetZone = 0;
  let zoneTransition = 0; // 0-1 for blending between zones
  let theme = regionData.zones[0];

  // Layer definitions - SIMPLIFIED to avoid visual confusion with terrain
  // Only render sky gradient and atmospheric effects - NO terrain-like shapes
  const layers = [
    { depth: 0.1, type: 'sky' },
  ];

  /**
   * Set the region (changes color theme)
   */
  function setRegion(region) {
    regionId = region.id || 'frontier';
    regionData = REGION_THEMES[regionId] || REGION_THEMES.frontier;
    currentZone = 0;
    targetZone = 0;
    zoneTransition = 0;
    theme = regionData.zones[0];
  }

  /**
   * Set the current zone (triggers background transition)
   */
  function setZone(zoneIndex) {
    const maxZone = regionData.zones.length - 1;
    const clampedZone = Math.min(zoneIndex, maxZone);

    if (clampedZone !== targetZone) {
      targetZone = clampedZone;
      // Don't reset transition if already transitioning
      if (currentZone !== targetZone) {
        zoneTransition = 0;
      }
    }
  }

  /**
   * Update zone transition (call each frame)
   */
  function update(dt) {
    if (currentZone !== targetZone) {
      // Smooth transition between zones (takes ~2 seconds)
      zoneTransition += dt * 0.5;

      if (zoneTransition >= 1) {
        currentZone = targetZone;
        zoneTransition = 0;
        theme = regionData.zones[currentZone];
      }
    }
  }

  /**
   * Get the current zone index
   */
  function getZone() {
    return currentZone;
  }

  /**
   * Interpolate between two colors
   */
  function lerpColor(color1, color2, t) {
    // Parse hex colors
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Get interpolated theme (for smooth zone transitions)
   */
  function getInterpolatedTheme() {
    if (currentZone === targetZone || zoneTransition === 0) {
      return regionData.zones[currentZone];
    }

    const fromTheme = regionData.zones[currentZone];
    const toTheme = regionData.zones[targetZone];
    const t = zoneTransition;

    return {
      sky: [
        lerpColor(fromTheme.sky[0], toTheme.sky[0], t),
        lerpColor(fromTheme.sky[1], toTheme.sky[1], t),
        lerpColor(fromTheme.sky[2], toTheme.sky[2], t),
      ],
      horizon: lerpColor(fromTheme.horizon, toTheme.horizon, t),
      ground: lerpColor(fromTheme.ground, toTheme.ground, t),
      accent: lerpColor(fromTheme.accent, toTheme.accent, t),
    };
  }

  /**
   * Resize the parallax layers
   */
  function resize(w, h) {
    width = w;
    height = h;
  }

  /**
   * Render all parallax layers
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cameraX - Camera X position
   * @param {number} zoom - Current zoom level (1.0 = normal, < 1 = zoomed out)
   */
  function render(ctx, cameraX, zoom = 1.0) {
    // Get current theme (with transition blending)
    const currentTheme = getInterpolatedTheme();

    // Calculate scaled dimensions for zoom (background needs to cover more area when zoomed out)
    const scaledWidth = Math.ceil(width / zoom) + 2;  // +2 to prevent edge gaps
    const scaledHeight = Math.ceil(height / zoom) + 2;
    const offsetX = (scaledWidth - width) / 2;
    const offsetY = (scaledHeight - height) / 2;

    // Draw sky gradient (covers full area accounting for zoom)
    const skyGradient = ctx.createLinearGradient(0, -offsetY, 0, height + offsetY);
    skyGradient.addColorStop(0, currentTheme.sky[0]);
    skyGradient.addColorStop(0.5, currentTheme.sky[1]);
    skyGradient.addColorStop(1, currentTheme.sky[2]);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(-offsetX, -offsetY, scaledWidth, scaledHeight);

    // Draw horizon glow (intensity based on zone - brighter in early zones)
    const horizonY = height * 0.7;
    const horizonIntensity = Math.max(0.15, 0.4 - currentZone * 0.05);
    const horizonGradient = ctx.createRadialGradient(
      width / 2, horizonY, 0,
      width / 2, horizonY, width * 0.8
    );
    horizonGradient.addColorStop(0, currentTheme.horizon + Math.round(horizonIntensity * 255).toString(16).padStart(2, '0'));
    horizonGradient.addColorStop(0.5, currentTheme.horizon + Math.round(horizonIntensity * 127).toString(16).padStart(2, '0'));
    horizonGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = horizonGradient;
    ctx.fillRect(-offsetX, -offsetY, scaledWidth, scaledHeight);

    // Draw region-specific features
    const features = regionData.features;

    // Stars (void region or later zones in other regions)
    if (features.stars || currentZone >= 3) {
      drawStars(ctx, cameraX, currentZone);
    }

    // Auroras (void region feature)
    if (features.auroras && currentZone >= 1) {
      drawAuroras(ctx, cameraX, currentTheme.accent);
    }

    // Clouds (frontier feature)
    if (features.clouds && currentZone < 3) {
      drawClouds(ctx, cameraX, currentTheme.sky[2]);
    }

    // Embers (badlands feature)
    if (features.embers) {
      drawEmbers(ctx, cameraX, currentTheme.accent);
    }

    // Smoke (badlands feature in later zones)
    if (features.smoke && currentZone >= 2) {
      drawSmoke(ctx, cameraX);
    }

    // REMOVED: Trees, rocks, mountains - they cause visual confusion with actual terrain
    // Background should only be sky gradient + atmospheric effects (stars, clouds, embers)

    // Zone indicator (subtle text for debugging / atmosphere)
    if (currentZone > 0) {
      drawZoneIndicator(ctx, currentZone, currentTheme.accent);
    }
  }

  /**
   * Draw zone indicator
   */
  function drawZoneIndicator(ctx, zone, color) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(`ZONE ${zone + 1}`, width - 20, 30);
    ctx.restore();
  }

  /**
   * Draw aurora effects (void region)
   */
  function drawAuroras(ctx, cameraX, color) {
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.sin(Date.now() * 0.001) * 0.1;

    const waveOffset = cameraX * 0.02;
    const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.4);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.3, color + '40');
    gradient.addColorStop(0.6, color + '20');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;

    // Wavy aurora bands
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= width; x += 10) {
      const y = 50 + Math.sin((x + waveOffset) * 0.02) * 30 + Math.sin((x + waveOffset) * 0.005) * 50;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height * 0.4);
    ctx.lineTo(0, height * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw clouds (frontier region)
   */
  function drawClouds(ctx, cameraX, color) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;

    const cloudSeed = 54321;
    for (let i = 0; i < 8; i++) {
      const baseX = ((cloudSeed * (i + 1)) % width) * 1.5;
      const baseY = 50 + ((cloudSeed * (i + 7)) % 120);
      const x = ((baseX - cameraX * 0.08) % (width * 1.5)) - width * 0.25;
      const cloudWidth = 100 + (i % 3) * 50;

      // Cloud shape (overlapping circles)
      ctx.beginPath();
      ctx.arc(x, baseY, 25, 0, Math.PI * 2);
      ctx.arc(x + 30, baseY - 10, 30, 0, Math.PI * 2);
      ctx.arc(x + 60, baseY, 25, 0, Math.PI * 2);
      ctx.arc(x + 40, baseY + 5, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw floating embers (badlands region)
   */
  function drawEmbers(ctx, cameraX, color) {
    ctx.save();
    const time = Date.now() * 0.001;

    for (let i = 0; i < 30; i++) {
      const seed = i * 7919;
      const baseX = (seed % width) * 1.5;
      const x = ((baseX - cameraX * 0.3 + Math.sin(time + i) * 20) % (width * 1.5)) - width * 0.25;
      const y = height - 100 - (seed % 300) - Math.sin(time * 2 + i * 0.5) * 30;
      const size = 2 + (i % 3);
      const alpha = 0.3 + Math.sin(time * 3 + i) * 0.2;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw smoke wisps (badlands later zones)
   */
  function drawSmoke(ctx, cameraX) {
    ctx.save();
    ctx.globalAlpha = 0.15;

    const time = Date.now() * 0.0005;

    for (let i = 0; i < 5; i++) {
      const baseX = (i * 200 + 100);
      const x = ((baseX - cameraX * 0.1) % width);
      const gradient = ctx.createRadialGradient(x, height * 0.6, 0, x, height * 0.6, 150);
      gradient.addColorStop(0, '#ffffff30');
      gradient.addColorStop(0.5, '#88888815');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, height * 0.6 + Math.sin(time + i) * 20, 100, 80 + Math.sin(time * 2 + i) * 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw distant trees (frontier wilderness)
   */
  function drawDistantTrees(ctx, cameraX, groundColor) {
    ctx.save();

    const treeSeed = 98765;
    const treeCount = 12;

    // Far trees (smaller, more muted)
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < treeCount; i++) {
      const baseX = ((treeSeed * (i + 1)) % (width * 3));
      const x = ((baseX - cameraX * 0.15) % (width * 1.5)) - width * 0.25;
      const treeHeight = 40 + (i % 4) * 15;
      const treeY = height * 0.6;

      // Tree trunk
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(x - 3, treeY, 6, treeHeight * 0.4);

      // Tree foliage (triangular pine style)
      ctx.fillStyle = groundColor;
      ctx.beginPath();
      ctx.moveTo(x, treeY - treeHeight * 0.6);
      ctx.lineTo(x - 15 - (i % 3) * 5, treeY);
      ctx.lineTo(x + 15 + (i % 3) * 5, treeY);
      ctx.closePath();
      ctx.fill();
    }

    // Near trees (larger, more detailed)
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < treeCount / 2; i++) {
      const baseX = ((treeSeed * (i + 20)) % (width * 2));
      const x = ((baseX - cameraX * 0.3) % (width * 1.3)) - width * 0.15;
      const treeHeight = 60 + (i % 3) * 25;
      const treeY = height * 0.72;

      // Tree trunk
      ctx.fillStyle = '#3d2817';
      ctx.fillRect(x - 4, treeY, 8, treeHeight * 0.35);

      // Tree foliage layers
      ctx.fillStyle = groundColor;
      for (let layer = 0; layer < 3; layer++) {
        const layerY = treeY - treeHeight * 0.3 - layer * treeHeight * 0.2;
        const layerWidth = 20 + (2 - layer) * 8 - (i % 2) * 3;
        ctx.beginPath();
        ctx.moveTo(x, layerY - treeHeight * 0.15);
        ctx.lineTo(x - layerWidth, layerY + 15);
        ctx.lineTo(x + layerWidth, layerY + 15);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Draw distant rocks (badlands terrain)
   */
  function drawDistantRocks(ctx, cameraX, groundColor) {
    ctx.save();

    const rockSeed = 54321;
    const rockCount = 8;

    ctx.globalAlpha = 0.5;

    for (let i = 0; i < rockCount; i++) {
      const baseX = ((rockSeed * (i + 1)) % (width * 2));
      const x = ((baseX - cameraX * 0.2) % (width * 1.4)) - width * 0.2;
      const rockWidth = 30 + (i % 4) * 20;
      const rockHeight = 20 + (i % 3) * 15;
      const rockY = height * 0.68;

      // Rock shape (irregular polygon)
      ctx.fillStyle = groundColor;
      ctx.beginPath();
      ctx.moveTo(x, rockY);
      ctx.lineTo(x + rockWidth * 0.2, rockY - rockHeight);
      ctx.lineTo(x + rockWidth * 0.6, rockY - rockHeight * 0.8);
      ctx.lineTo(x + rockWidth, rockY - rockHeight * 0.3);
      ctx.lineTo(x + rockWidth, rockY);
      ctx.closePath();
      ctx.fill();

      // Rock highlight
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(x + rockWidth * 0.2, rockY - rockHeight);
      ctx.lineTo(x + rockWidth * 0.5, rockY - rockHeight * 0.9);
      ctx.lineTo(x + rockWidth * 0.3, rockY - rockHeight * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw stars (intensity varies by zone)
   */
  function drawStars(ctx, cameraX, zone) {
    const starCount = regionId === 'void' ? 80 : 30 + zone * 10;
    const baseAlpha = regionId === 'void' ? 0.5 : 0.2 + zone * 0.08;
    const time = Date.now() * 0.001;

    ctx.fillStyle = '#fff';
    const starSeed = 12345;

    for (let i = 0; i < starCount; i++) {
      const baseX = ((starSeed * (i + 1)) % (width * 2));
      const baseY = ((starSeed * (i + 17)) % (height * 0.6));
      const x = ((baseX - cameraX * 0.05) % (width * 1.2)) - width * 0.1;
      const size = 1 + (i % 3);

      // Twinkling effect
      const twinkle = Math.sin(time * 2 + i * 0.7) * 0.3;
      ctx.globalAlpha = Math.max(0.1, baseAlpha + (i % 5) * 0.1 + twinkle);

      ctx.beginPath();
      ctx.arc(x < 0 ? x + width * 1.2 : x, baseY, size, 0, Math.PI * 2);
      ctx.fill();

      // Occasional larger stars with glow
      if (i % 15 === 0 && regionId === 'void') {
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(x < 0 ? x + width * 1.2 : x, baseY, size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Draw mountain silhouettes
   */
  function drawMountains(ctx, offsetX, scale, color, baseY) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-100, height * 2);  // Start below and left

    const mountainWidth = 200 * scale;
    const mountainHeight = 150 * scale;

    // Extend mountains well beyond viewport to prevent edge gaps
    for (let x = -mountainWidth * 2; x < width + mountainWidth * 3; x += mountainWidth * 0.7) {
      const actualX = ((x + offsetX) % (width + mountainWidth * 3)) - mountainWidth;
      const peakY = baseY - mountainHeight * (0.7 + Math.sin(x * 0.01) * 0.3);

      ctx.lineTo(actualX, baseY);
      ctx.lineTo(actualX + mountainWidth / 2, peakY);
      ctx.lineTo(actualX + mountainWidth, baseY);
    }

    ctx.lineTo(width + 100, height * 2);  // End below and right
    ctx.lineTo(-100, height * 2);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw rolling hills
   */
  function drawHills(ctx, offsetX, color, baseY) {
    ctx.fillStyle = color + 'cc';
    ctx.beginPath();
    ctx.moveTo(-50, height * 2);  // Start below and left of viewport

    // Extend hills beyond viewport edges to prevent gaps
    for (let x = -50; x <= width + 50; x += 20) {
      const actualX = x + (offsetX % 400);
      const hillY = baseY + Math.sin(actualX * 0.02) * 30 + Math.sin(actualX * 0.005) * 20;
      ctx.lineTo(x, hillY);
    }

    ctx.lineTo(width + 50, height * 2);  // Extend right and below
    ctx.lineTo(-50, height * 2);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw ground layer
   */
  function drawGround(ctx, offsetX, color, baseY) {
    // Extend ground well beyond viewport to prevent gaps when zoomed out
    const extendedHeight = height * 2;
    ctx.fillStyle = color;
    ctx.fillRect(-100, baseY, width + 200, extendedHeight);

    // Ground texture lines
    ctx.strokeStyle = color + '40';
    ctx.lineWidth = 1;
    for (let x = -100; x < width + 100; x += 50) {
      const actualX = ((x + offsetX * 0.5) % 100);
      ctx.beginPath();
      ctx.moveTo(actualX + (x + 100) % (width + 200) - 100, baseY);
      ctx.lineTo(actualX + (x + 100) % (width + 200) - 100 + 30, baseY + 20);
      ctx.stroke();
    }
  }

  return {
    setRegion,
    setZone,
    update,
    getZone,
    resize,
    render,
  };
}

export default { createParallax };
