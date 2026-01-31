// platforms.js — Badlands Terrain Manager
// Weekly arena structure: 5 days terrain + 2 days platform bridges
// Visual clarity: distinct foreground, water in valleys/pits, clear danger zones

// ═══════════════════════════════════════════════════════════════════════════
// TERRAIN CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const TERRAIN_SEGMENT_WIDTH = 40; // Width of each terrain segment
const BASE_GROUND_Y = 480; // Base ground level (water level)
const TERRAIN_AMPLITUDE = 100; // Max height variation for hills/valleys
const WATER_LEVEL = 520; // Water surface Y position (below base ground)
const SCREEN_HEIGHT = 600;

// Weekly structure (in pixels, not meters)
const DAY_LENGTH = 800; // ~16 meters per day at 50px/m
const WEEK_LENGTH = DAY_LENGTH * 7; // Full week
const WEEKDAY_LENGTH = DAY_LENGTH * 5; // Monday-Friday terrain
const WEEKEND_LENGTH = DAY_LENGTH * 2; // Saturday-Sunday bridges

// Bridge/platform settings for weekend sections
const BRIDGE_PLATFORM = {
  minWidth: 80,
  maxWidth: 160,
  gapMin: 60,
  gapMax: 120,
  height: 20,
  yVariation: 60, // How much platforms vary in height
};

// Generation buffer
const BUFFER_AHEAD = 2500;
const BUFFER_BEHIND = 800;

// ═══════════════════════════════════════════════════════════════════════════
// TERRAIN MANAGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create the terrain manager
 */
export function createPlatformManager(region) {
  // Terrain segments (each has x, y, slope)
  const segments = [];
  // Bridge platforms (weekend sections)
  const bridgePlatforms = [];
  // Combined for collision
  let allPlatforms = [];

  let lastSegmentX = 0;
  let difficulty = 1;
  let zoneIndex = 0;
  let weekIndex = 0;
  let distanceTraveled = 0;

  // Terrain generation state
  let terrainPhase = Math.random() * Math.PI * 2;
  let terrainFreq1 = 0.006 + Math.random() * 0.003; // Primary rolling hills
  let terrainFreq2 = 0.018 + Math.random() * 0.008; // Secondary detail
  let terrainFreq3 = 0.002 + Math.random() * 0.001; // Large mountains/valleys

  // Track what section we're generating (weekday terrain vs weekend bridges)
  let currentWeekProgress = 0; // 0 to WEEK_LENGTH

  // Region-specific palettes with enhanced visual clarity
  const regionPalettes = {
    frontier: {
      // Foreground terrain (high contrast, saturated)
      terrainTop: '#5a9f4a',      // Vibrant grass
      terrainMid: '#7a6b4a',      // Rich dirt
      terrainBase: '#5a5a5a',     // Stone
      terrainDeep: '#3a3a3a',     // Deep rock
      terrainEdge: '#2d5a1f',     // Dark edge for definition
      // Water
      waterSurface: '#4a90b8',
      waterDeep: '#2d5a7a',
      waterFoam: '#8ac4e0',
      // Danger indicators
      dangerGlow: '#ff6b35',
      // Accent
      accent: '#7cb342',
    },
    badlands: {
      terrainTop: '#c4784a',      // Desert sand/rock
      terrainMid: '#8b5a3a',      // Clay
      terrainBase: '#6a3a2a',     // Red rock
      terrainDeep: '#4a2a1a',     // Deep canyon
      terrainEdge: '#3a1a0a',
      waterSurface: '#3a6a5a',    // Murky water
      waterDeep: '#2a4a3a',
      waterFoam: '#5a8a7a',
      dangerGlow: '#ff4444',
      accent: '#cd853f',
    },
    void: {
      terrainTop: '#6a5a8a',      // Purple rock
      terrainMid: '#4a3a6a',
      terrainBase: '#3a2a5a',
      terrainDeep: '#2a1a4a',
      terrainEdge: '#1a0a3a',
      waterSurface: '#4a3a6a',    // Dark mystical water
      waterDeep: '#2a1a4a',
      waterFoam: '#8a7aaa',
      dangerGlow: '#a855f7',
      accent: '#7c6fdc',
    },
  };
  const palette = regionPalettes[region.id] || regionPalettes.frontier;

  // Initialize starting area (flat safe zone)
  createStartingArea();

  function createStartingArea() {
    // Generate flat starting terrain for first "day"
    for (let x = -200; x < DAY_LENGTH; x += TERRAIN_SEGMENT_WIDTH) {
      segments.push({
        x,
        y: BASE_GROUND_Y - 40, // Slightly above water
        width: TERRAIN_SEGMENT_WIDTH,
        slope: 0,
        isGround: true,
        isSolid: true,
        isValley: false,
      });
    }
    lastSegmentX = DAY_LENGTH;
    currentWeekProgress = DAY_LENGTH;
  }

  /**
   * Generate terrain height at a given x position using layered noise
   */
  function getTerrainHeight(x) {
    // Layer multiple sine waves for natural-looking terrain
    const wave1 = Math.sin(x * terrainFreq1 + terrainPhase) * TERRAIN_AMPLITUDE * 0.6;
    const wave2 = Math.sin(x * terrainFreq2 + terrainPhase * 2) * TERRAIN_AMPLITUDE * 0.25;
    const wave3 = Math.sin(x * terrainFreq3 + terrainPhase * 0.5) * TERRAIN_AMPLITUDE * 0.9;

    // Combine waves
    const combinedHeight = wave1 + wave2 + wave3;

    // Difficulty modifier (terrain gets more extreme)
    const difficultyMod = 1 + (difficulty - 1) * 0.25;

    // Base height (above water level)
    const baseY = BASE_GROUND_Y - 50;

    return baseY - combinedHeight * difficultyMod;
  }

  /**
   * Get terrain slope at a position (for momentum physics)
   */
  function getTerrainSlope(x) {
    const delta = 5;
    const y1 = getTerrainHeight(x - delta);
    const y2 = getTerrainHeight(x + delta);
    return (y2 - y1) / (delta * 2); // Slope as rise/run
  }

  /**
   * Check if this position would be in a valley (near water)
   */
  function isValleyPosition(y) {
    return y > BASE_GROUND_Y - 30; // Within 30px of water level
  }

  /**
   * Update terrain based on camera position
   */
  function update(visibleRange) {
    const { minX, maxX } = visibleRange;
    distanceTraveled = maxX;

    // Remove segments too far behind
    while (segments.length > 0 && segments[0].x + segments[0].width < minX - BUFFER_BEHIND) {
      segments.shift();
    }

    // Remove bridge platforms too far behind
    while (bridgePlatforms.length > 0 && bridgePlatforms[0].x + bridgePlatforms[0].width < minX - BUFFER_BEHIND) {
      bridgePlatforms.shift();
    }

    // Generate terrain ahead
    while (lastSegmentX < maxX + BUFFER_AHEAD) {
      generateNextSection();
    }

    // Update difficulty, zone, and week
    difficulty = 1 + (maxX / 4000) * 0.5;
    zoneIndex = Math.floor(maxX / 3000);
    weekIndex = Math.floor(maxX / WEEK_LENGTH);

    // Slowly evolve terrain characteristics per zone
    if (Math.random() < 0.0005) {
      terrainPhase += Math.random() * 0.3 - 0.15;
    }

    // Rebuild collision list
    allPlatforms = [...segments.filter(s => s.isSolid), ...bridgePlatforms];
  }

  /**
   * Generate the next section (weekday terrain or weekend bridge)
   */
  function generateNextSection() {
    // Determine if we're in weekday (terrain) or weekend (bridges)
    const weekPosition = currentWeekProgress % WEEK_LENGTH;
    const isWeekend = weekPosition >= WEEKDAY_LENGTH;

    if (isWeekend) {
      generateBridgeSection();
    } else {
      generateTerrainSegment();
    }

    currentWeekProgress += TERRAIN_SEGMENT_WIDTH;
  }

  /**
   * Generate a weekday terrain segment (continuous ground)
   */
  function generateTerrainSegment() {
    const x = lastSegmentX;
    const y = getTerrainHeight(x);
    const slope = getTerrainSlope(x);
    const inValley = isValleyPosition(y);

    segments.push({
      x,
      y: Math.min(y, BASE_GROUND_Y - 15), // Keep above water
      width: TERRAIN_SEGMENT_WIDTH,
      slope,
      isGround: true,
      isSolid: true,
      isValley: inValley,
      isWeekday: true,
    });

    lastSegmentX = x + TERRAIN_SEGMENT_WIDTH;
  }

  /**
   * Generate a weekend bridge section (platforms over water)
   */
  function generateBridgeSection() {
    const x = lastSegmentX;

    // Check if we need to start a new platform or continue a gap
    const lastBridge = bridgePlatforms[bridgePlatforms.length - 1];
    const lastSegment = segments[segments.length - 1];

    // Determine base height for this bridge section
    const baseHeight = BASE_GROUND_Y - 80 - Math.random() * BRIDGE_PLATFORM.yVariation;

    // Decide: platform or gap?
    const distFromLastPlatform = lastBridge
      ? x - (lastBridge.x + lastBridge.width)
      : (lastSegment ? x - (lastSegment.x + lastSegment.width) : 0);

    // After a gap, always place a platform
    const needsPlatform = distFromLastPlatform >= BRIDGE_PLATFORM.gapMin ||
      (!lastBridge && lastSegment);

    if (needsPlatform) {
      // Create a stepping stone platform
      const platWidth = BRIDGE_PLATFORM.minWidth +
        Math.random() * (BRIDGE_PLATFORM.maxWidth - BRIDGE_PLATFORM.minWidth);

      bridgePlatforms.push({
        x,
        y: baseHeight,
        width: platWidth,
        height: BRIDGE_PLATFORM.height,
        slope: 0,
        isGround: false,
        isSolid: true,
        isBridge: true,
        isWeekend: true,
      });

      // Also add a non-solid gap marker for rendering
      segments.push({
        x,
        y: WATER_LEVEL,
        width: TERRAIN_SEGMENT_WIDTH,
        slope: 0,
        isGround: false,
        isSolid: false,
        isWaterGap: true,
        isWeekend: true,
      });
    } else {
      // Gap segment (water)
      segments.push({
        x,
        y: WATER_LEVEL,
        width: TERRAIN_SEGMENT_WIDTH,
        slope: 0,
        isGround: false,
        isSolid: false,
        isWaterGap: true,
        isWeekend: true,
      });
    }

    lastSegmentX = x + TERRAIN_SEGMENT_WIDTH;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Render terrain
   */
  function render(ctx) {
    // 1. Render water first (background layer)
    renderWater(ctx);

    // 2. Render ground terrain with clear foreground treatment
    renderGroundTerrain(ctx);

    // 3. Render bridge platforms
    for (const platform of bridgePlatforms) {
      renderBridgePlatform(ctx, platform);
    }

    // 4. Render danger indicators
    renderDangerZones(ctx);
  }

  /**
   * Render water layer (fills valleys and gaps) - optimized for crisp rendering
   */
  function renderWater(ctx) {
    if (segments.length < 2) return;

    const startX = segments[0].x;
    const endX = segments[segments.length - 1].x + TERRAIN_SEGMENT_WIDTH;

    // Solid water fill (no gradient for crisp look)
    ctx.fillStyle = palette.waterDeep;
    ctx.fillRect(startX, WATER_LEVEL, endX - startX, SCREEN_HEIGHT - WATER_LEVEL + 50);

    // Water surface band
    ctx.fillStyle = palette.waterSurface;
    ctx.fillRect(startX, WATER_LEVEL - 8, endX - startX, 12);

    // Single clean surface line
    ctx.strokeStyle = palette.waterFoam;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, WATER_LEVEL - 6);
    ctx.lineTo(endX, WATER_LEVEL - 6);
    ctx.stroke();
  }

  /**
   * Render ground terrain with crisp, clean visuals
   */
  function renderGroundTerrain(ctx) {
    if (segments.length < 2) return;

    // Filter to only solid ground segments
    const groundSegments = segments.filter(s => s.isSolid && !s.isWaterGap);
    if (groundSegments.length < 2) return;

    const firstSeg = groundSegments[0];
    const lastSeg = groundSegments[groundSegments.length - 1];

    // Build terrain profile points (skip gaps for clean edges)
    const profileTop = [];
    const profileBottom = [];

    for (let i = 0; i < groundSegments.length; i++) {
      const seg = groundSegments[i];
      const prevSeg = groundSegments[i - 1];
      const nextSeg = groundSegments[i + 1];

      // Check for discontinuity (gap before or after)
      const hasGapBefore = prevSeg && (seg.x - (prevSeg.x + prevSeg.width) > 5);
      const hasGapAfter = nextSeg && (nextSeg.x - (seg.x + seg.width) > 5);

      if (hasGapBefore) {
        // Start new section - add cliff edge
        profileTop.push({ x: seg.x, y: seg.y, isCliff: true });
      }

      profileTop.push({ x: seg.x + seg.width / 2, y: seg.y });

      if (hasGapAfter) {
        // End section - add cliff edge
        profileTop.push({ x: seg.x + seg.width, y: seg.y, isCliff: true });
      }
    }

    // === LAYER 1: Terrain body (single solid fill to water level) ===
    ctx.fillStyle = palette.terrainBase;
    ctx.beginPath();
    ctx.moveTo(firstSeg.x, firstSeg.y);

    for (const pt of profileTop) {
      ctx.lineTo(pt.x, pt.y);
    }

    // Close along bottom
    ctx.lineTo(lastSeg.x + lastSeg.width, WATER_LEVEL + 20);
    ctx.lineTo(firstSeg.x, WATER_LEVEL + 20);
    ctx.closePath();
    ctx.fill();

    // === LAYER 2: Dirt stripe ===
    ctx.fillStyle = palette.terrainMid;
    ctx.beginPath();
    ctx.moveTo(firstSeg.x, firstSeg.y);

    for (const pt of profileTop) {
      ctx.lineTo(pt.x, pt.y);
    }

    ctx.lineTo(lastSeg.x + lastSeg.width, lastSeg.y + 25);
    ctx.lineTo(firstSeg.x, firstSeg.y + 25);
    ctx.closePath();
    ctx.fill();

    // === LAYER 3: Top surface (grass/sand) ===
    ctx.fillStyle = palette.terrainTop;
    ctx.beginPath();
    ctx.moveTo(firstSeg.x, firstSeg.y);

    for (const pt of profileTop) {
      ctx.lineTo(pt.x, pt.y);
    }

    ctx.lineTo(lastSeg.x + lastSeg.width, lastSeg.y + 8);
    ctx.lineTo(firstSeg.x, firstSeg.y + 8);
    ctx.closePath();
    ctx.fill();

    // === LAYER 4: Clean edge line (crisp definition) ===
    ctx.strokeStyle = palette.terrainEdge;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    let inPath = false;
    for (let i = 0; i < profileTop.length; i++) {
      const pt = profileTop[i];
      if (pt.isCliff) {
        if (inPath) ctx.stroke();
        ctx.beginPath();
        inPath = false;
      } else {
        if (!inPath) {
          ctx.moveTo(pt.x, pt.y);
          inPath = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
    }
    if (inPath) ctx.stroke();

    // === Draw cliff faces at gaps ===
    ctx.fillStyle = palette.terrainDeep;
    for (let i = 0; i < groundSegments.length; i++) {
      const seg = groundSegments[i];
      const nextSeg = groundSegments[i + 1];

      if (nextSeg && (nextSeg.x - (seg.x + seg.width) > 5)) {
        // Gap detected - draw cliff faces
        const cliffX = seg.x + seg.width;
        const cliffY = seg.y;

        // Right cliff face
        ctx.fillRect(cliffX - 4, cliffY, 4, WATER_LEVEL - cliffY + 10);

        // Left cliff face of next segment
        ctx.fillRect(nextSeg.x, nextSeg.y, 4, WATER_LEVEL - nextSeg.y + 10);
      }
    }
  }

  /**
   * Render a bridge platform (weekend stepping stone)
   */
  function renderBridgePlatform(ctx, platform) {
    const { x, y, width, height } = platform;

    // Platform shadow on water
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, WATER_LEVEL - 5, width / 2 + 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Platform underside (depth)
    ctx.fillStyle = palette.terrainDeep;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + height);
    ctx.lineTo(x + width - 5, y + height);
    ctx.lineTo(x + width - 15, y + height + 25);
    ctx.lineTo(x + 15, y + height + 25);
    ctx.closePath();
    ctx.fill();

    // Platform body (stone)
    ctx.fillStyle = palette.terrainBase;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    // Platform top surface
    ctx.fillStyle = palette.terrainTop;
    ctx.beginPath();
    ctx.roundRect(x + 2, y, width - 4, height - 4, 3);
    ctx.fill();

    // Edge highlight
    ctx.strokeStyle = palette.terrainEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 2);
    ctx.lineTo(x + width - 4, y + 2);
    ctx.stroke();

    // Moss/grass details
    ctx.fillStyle = palette.accent + '60';
    for (let i = 0; i < width / 20; i++) {
      ctx.fillRect(x + 10 + i * 20, y - 2, 3, 4);
    }
  }

  /**
   * Render danger zone indicators - simple, clean markers
   */
  function renderDangerZones(ctx) {
    // Find gap edges and mark them clearly
    const groundSegs = segments.filter(s => s.isSolid);

    for (let i = 0; i < groundSegs.length; i++) {
      const seg = groundSegs[i];
      const nextSeg = groundSegs[i + 1];

      // Check for gap after this segment
      if (nextSeg && (nextSeg.x - (seg.x + seg.width) > 40)) {
        const edgeX = seg.x + seg.width;
        const edgeY = seg.y;

        // Simple danger stripe at cliff edge
        ctx.fillStyle = palette.dangerGlow;
        ctx.fillRect(edgeX - 6, edgeY - 2, 6, 4);
        ctx.fillRect(edgeX - 6, edgeY + 8, 6, 4);
        ctx.fillRect(edgeX - 6, edgeY + 18, 6, 4);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHYSICS QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get terrain height at a specific x position (for physics)
   */
  function getHeightAt(x) {
    // Check bridge platforms first
    for (const plat of bridgePlatforms) {
      if (x >= plat.x && x < plat.x + plat.width) {
        return plat.y;
      }
    }

    // Check ground segments
    for (const seg of segments) {
      if (x >= seg.x && x < seg.x + seg.width) {
        if (seg.isWaterGap || !seg.isSolid) {
          return WATER_LEVEL + 200; // Below water = death zone
        }
        // Interpolate height within segment
        const t = (x - seg.x) / seg.width;
        const nextSeg = segments.find(s => s.x === seg.x + seg.width && s.isSolid);
        if (nextSeg) {
          return seg.y + (nextSeg.y - seg.y) * t;
        }
        return seg.y;
      }
    }
    return BASE_GROUND_Y;
  }

  /**
   * Get slope at a specific x position
   */
  function getSlopeAt(x) {
    // Bridge platforms are flat
    for (const plat of bridgePlatforms) {
      if (x >= plat.x && x < plat.x + plat.width) {
        return 0;
      }
    }

    // Ground segments
    for (const seg of segments) {
      if (x >= seg.x && x < seg.x + seg.width && seg.isSolid) {
        return seg.slope || 0;
      }
    }
    return 0;
  }

  /**
   * Check if position is over a gap (water/death zone)
   */
  function isOverGap(x) {
    // Check if over a bridge platform
    for (const plat of bridgePlatforms) {
      if (x >= plat.x && x < plat.x + plat.width) {
        return false; // Over bridge = safe
      }
    }

    // Check segments
    for (const seg of segments) {
      if (x >= seg.x && x < seg.x + seg.width) {
        return seg.isWaterGap || !seg.isSolid;
      }
    }
    return true; // Unknown = assume gap
  }

  /**
   * Get all platforms (for collision detection)
   */
  function getPlatforms() {
    return allPlatforms;
  }

  /**
   * Get current zone index (for background changes)
   */
  function getZoneIndex() {
    return zoneIndex;
  }

  /**
   * Get current week index (for roguelike progression)
   */
  function getWeekIndex() {
    return weekIndex;
  }

  /**
   * Check if currently in weekend section
   */
  function isWeekendSection(x) {
    const weekPosition = x % WEEK_LENGTH;
    return weekPosition >= WEEKDAY_LENGTH;
  }

  /**
   * Get water level
   */
  function getWaterLevel() {
    return WATER_LEVEL;
  }

  /**
   * Get bottomless pit threshold
   */
  function getBottomlessThreshold() {
    return WATER_LEVEL + 50; // Below water surface = death
  }

  return {
    update,
    render,
    getPlatforms,
    getZoneIndex,
    getWeekIndex,
    getHeightAt,
    getSlopeAt,
    isOverGap,
    isWeekendSection,
    getWaterLevel,
    getBottomlessThreshold,
  };
}

export default { createPlatformManager };
