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

// Layered terrain settings - natural ground at multiple heights
// Creates stacked cliff/plateau terrain instead of floating platforms
const LAYERED_TERRAIN = {
  enabled: true,

  // Ground layers (from bottom to top) - each is solid terrain, not floating
  // baseY is the ground level, amplitude is the hill variation within that layer
  layers: [
    // Layer 0: Base ground (always present, lowest)
    { baseY: 480, amplitude: 60, color: 'base' },
    // Layer 1: Low plateau (overlaps base in places)
    { baseY: 380, amplitude: 50, color: 'low' },
    // Layer 2: Mid cliff (creates significant height)
    { baseY: 280, amplitude: 45, color: 'mid' },
    // Layer 3: High ridge (risk/reward path)
    { baseY: 160, amplitude: 40, color: 'high' },
  ],

  // How terrain layers interact - increased upper layer presence
  layerTransition: {
    minSectionLength: 300,   // Reduced - more frequent transitions
    maxSectionLength: 800,   // Reduced - force variety sooner
    gapChance: 0.12,         // Slightly reduced gap chance
    gapWidth: [80, 180],     // Gap width range
    rampChance: 0.4,         // Increased ramp frequency
    rampLength: 140,         // Ramp length
    // Layer activation chances (increase with difficulty)
    baseLayerChance: 0.5,    // Chance to activate a new upper layer per transition
    upperLayerBonus: 0.15,   // Additional chance per difficulty level for higher layers
  },

  // Visual distinction per layer
  layerColors: {
    base: { top: '#5a9f4a', mid: '#7a6b4a', deep: '#5a5a5a' },
    low: { top: '#4a8f3a', mid: '#6a5b3a', deep: '#4a4a4a' },
    mid: { top: '#6a7a5a', mid: '#5a5a4a', deep: '#3a3a3a' },
    high: { top: '#7a6a5a', mid: '#5a4a3a', deep: '#3a2a2a' },
  },
};

// Sparse floating platform settings - for reaching otherwise unreachable areas
const CONNECTOR_PLATFORMS = {
  enabled: true,
  minGapTrigger: 120,        // Minimum gap width to potentially spawn a connector
  spawnChance: 0.25,         // Base chance to spawn connector platform in valid gap
  difficultyBonus: 0.05,     // Additional spawn chance per difficulty level
  platformWidth: [60, 100],  // Width range for connector platforms
  platformHeight: 16,        // Platform thickness
  maxPerSection: 2,          // Max connectors per terrain section
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
  // Elevated/alternate path platforms (multi-path system)
  const elevatedPlatforms = [];
  // Branch connectors (visual ramps/stepping stones connecting paths)
  const branchConnectors = [];
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

  // Layered terrain state - tracks active layers and transitions
  const layerState = {
    activeLayers: [0],        // Which layers are currently generating (indices)
    layerSections: [],        // Track section boundaries per layer
    lastTransitionX: 0,       // Last X where we changed layers
    currentSectionLength: 0,  // How long current section has been
  };

  // Initialize layer sections
  for (let i = 0; i < LAYERED_TERRAIN.layers.length; i++) {
    layerState.layerSections[i] = {
      isActive: i === 0,      // Only base layer starts active
      startX: -200,
      endX: Infinity,
      hasGapAfter: false,
    };
  }

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

    // Remove elevated platforms too far behind
    while (elevatedPlatforms.length > 0 && elevatedPlatforms[0].x + elevatedPlatforms[0].width < minX - BUFFER_BEHIND) {
      elevatedPlatforms.shift();
    }

    // Remove branch connectors too far behind
    while (branchConnectors.length > 0 && branchConnectors[0].x + branchConnectors[0].width < minX - BUFFER_BEHIND) {
      branchConnectors.shift();
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

    // Rebuild collision list (include elevated platforms and branch connectors)
    allPlatforms = [
      ...segments.filter(s => s.isSolid),
      ...bridgePlatforms,
      ...elevatedPlatforms,
      ...branchConnectors.filter(c => c.isSolid),
    ];
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

    // Generate layered terrain (upper ground levels) if enabled
    if (LAYERED_TERRAIN.enabled) {
      generateLayeredTerrain(x, y);
    }
  }

  /**
   * Generate layered terrain - solid ground at multiple heights
   * Creates natural cliffs and plateaus, not floating platforms
   */
  function generateLayeredTerrain(groundX, baseGroundY) {
    if (!LAYERED_TERRAIN.enabled) return;

    const config = LAYERED_TERRAIN.layerTransition;

    // Update section length tracking
    layerState.currentSectionLength = groundX - layerState.lastTransitionX;

    // Check if we should transition layers
    const shouldTransition = layerState.currentSectionLength > config.minSectionLength &&
      (Math.random() < 0.02 || layerState.currentSectionLength > config.maxSectionLength);

    if (shouldTransition) {
      handleLayerTransition(groundX);
    }

    // Generate terrain for each active layer (above base)
    for (let layerIdx = 1; layerIdx < LAYERED_TERRAIN.layers.length; layerIdx++) {
      const section = layerState.layerSections[layerIdx];

      if (!section.isActive) continue;
      if (groundX < section.startX || groundX > section.endX) continue;

      const layer = LAYERED_TERRAIN.layers[layerIdx];

      // Calculate terrain height for this layer (with rolling hills)
      const layerY = getLayerTerrainHeight(groundX, layerIdx);

      // Add terrain segment for this layer
      elevatedPlatforms.push({
        x: groundX,
        y: layerY,
        width: TERRAIN_SEGMENT_WIDTH,
        height: 200, // Tall enough to look like solid ground
        slope: getTerrainSlope(groundX),
        isGround: true,
        isSolid: true,
        isLayeredTerrain: true,
        layerIndex: layerIdx,
        layerColor: layer.color,
        fillToBottom: true, // Render as solid ground, not floating
      });
    }
  }

  /**
   * Get terrain height for a specific layer
   */
  function getLayerTerrainHeight(x, layerIndex) {
    const layer = LAYERED_TERRAIN.layers[layerIndex];

    // Use similar wave calculation as base terrain but offset
    const phase = terrainPhase + layerIndex * 1.5;
    const wave1 = Math.sin(x * terrainFreq1 * 0.8 + phase) * layer.amplitude * 0.6;
    const wave2 = Math.sin(x * terrainFreq2 * 0.7 + phase * 2) * layer.amplitude * 0.3;

    return layer.baseY - wave1 - wave2;
  }

  /**
   * Handle transitions between terrain layers
   * Layer activation increases with difficulty for more verticality
   */
  function handleLayerTransition(x) {
    const config = LAYERED_TERRAIN.layerTransition;
    layerState.lastTransitionX = x;

    // Difficulty-scaled activation chance (more upper layers as game progresses)
    const baseActivationChance = config.baseLayerChance || 0.5;
    const difficultyBonus = (config.upperLayerBonus || 0.15) * (difficulty - 1);
    const activationChance = Math.min(0.75, baseActivationChance + difficultyBonus);

    // Decide what kind of transition
    const transitionType = Math.random();

    if (transitionType < activationChance) {
      // Start a new upper layer - prefer higher layers as difficulty increases
      const inactiveLayers = [];
      for (let i = 1; i < LAYERED_TERRAIN.layers.length; i++) {
        if (!layerState.layerSections[i].isActive) {
          inactiveLayers.push(i);
        }
      }

      if (inactiveLayers.length > 0) {
        // Weight selection toward higher layers as difficulty increases
        // At low difficulty: prefer layer 1, at high difficulty: prefer layers 2-3
        const difficultyFactor = Math.min(1, (difficulty - 1) / 2); // 0 to 1
        const weights = inactiveLayers.map((layerIdx) => {
          // Higher layers get more weight as difficulty increases
          const baseWeight = inactiveLayers.length - inactiveLayers.indexOf(layerIdx);
          const heightBonus = layerIdx * difficultyFactor * 2;
          return baseWeight + heightBonus;
        });

        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let pick = Math.random() * totalWeight;
        let chosenIdx = 0;
        for (let i = 0; i < weights.length; i++) {
          pick -= weights[i];
          if (pick <= 0) {
            chosenIdx = i;
            break;
          }
        }
        const layerToActivate = inactiveLayers[chosenIdx];

        // Longer sections for higher layers (more risk/reward time)
        const sectionLengthBonus = layerToActivate * 100;
        const sectionLength = config.minSectionLength + sectionLengthBonus +
          Math.random() * (config.maxSectionLength - config.minSectionLength);

        layerState.layerSections[layerToActivate] = {
          isActive: true,
          startX: x + 50, // Small gap before new layer starts
          endX: x + sectionLength,
          hasGapAfter: Math.random() < config.gapChance,
        };

        // Generate ramp if this layer connects to an existing one
        if (Math.random() < config.rampChance) {
          generateRamp(x, layerToActivate);
        } else {
          // No ramp - try to spawn a connector platform
          trySpawnConnectorPlatform(x, layerToActivate);
        }
      }
    } else if (transitionType < activationChance + 0.25) {
      // End an active upper layer (but keep at least one upper layer if difficulty is high)
      const activeLayers = [];
      for (let i = 1; i < LAYERED_TERRAIN.layers.length; i++) {
        if (layerState.layerSections[i].isActive) {
          activeLayers.push(i);
        }
      }

      // At higher difficulty, be more reluctant to end upper layers
      const minActiveUpperLayers = Math.floor(difficulty / 2);
      if (activeLayers.length > minActiveUpperLayers) {
        // Prefer to end lower layers first (keep high layers active longer)
        const layerToEnd = activeLayers[0];
        layerState.layerSections[layerToEnd].endX = x;
        layerState.layerSections[layerToEnd].hasGapAfter = Math.random() < config.gapChance;

        // Possibly spawn connector platform at layer end
        if (Math.random() < 0.3) {
          trySpawnConnectorPlatform(x, layerToEnd);
        }
      }
    }
    // else: no change, continue current layers
  }

  /**
   * Try to spawn a connector platform (floating platform for vertical access)
   * Only spawns sparingly where needed for verticality
   */
  function trySpawnConnectorPlatform(x, targetLayer) {
    if (!CONNECTOR_PLATFORMS.enabled) return;

    const config = CONNECTOR_PLATFORMS;
    const spawnChance = config.spawnChance + (config.difficultyBonus * (difficulty - 1));

    if (Math.random() > spawnChance) return;

    const targetLayerData = LAYERED_TERRAIN.layers[targetLayer];

    // Find a lower active layer to connect from
    let sourceLayer = 0;
    for (let i = targetLayer - 1; i >= 0; i--) {
      if (i === 0 || layerState.layerSections[i].isActive) {
        sourceLayer = i;
        break;
      }
    }

    const sourceLayerData = LAYERED_TERRAIN.layers[sourceLayer];
    const heightDiff = sourceLayerData.baseY - targetLayerData.baseY;

    // Only spawn if there's significant height difference
    if (heightDiff < 80) return;

    // Calculate platform position (in the gap between layers)
    const platWidth = config.platformWidth[0] +
      Math.random() * (config.platformWidth[1] - config.platformWidth[0]);
    const platX = x + 30 + Math.random() * 60;
    const platY = targetLayerData.baseY + heightDiff * 0.5; // Midpoint between layers

    // Add floating connector platform
    bridgePlatforms.push({
      x: platX,
      y: platY,
      width: platWidth,
      height: config.platformHeight,
      slope: 0,
      isGround: false,
      isSolid: true,
      isConnector: true,
      connectsTo: targetLayer,
    });
  }

  /**
   * Generate a ramp connecting two terrain layers
   */
  function generateRamp(x, targetLayer) {
    const config = LAYERED_TERRAIN.layerTransition;
    const targetLayerData = LAYERED_TERRAIN.layers[targetLayer];

    // Find the layer below to connect from
    let sourceLayer = targetLayer - 1;
    while (sourceLayer >= 0 && !layerState.layerSections[sourceLayer].isActive) {
      sourceLayer--;
    }
    if (sourceLayer < 0) sourceLayer = 0;

    const sourceLayerData = LAYERED_TERRAIN.layers[sourceLayer];
    const sourceY = sourceLayerData.baseY;
    const targetY = targetLayerData.baseY;
    const heightDiff = sourceY - targetY;

    // Create ramp segments
    const rampSteps = Math.ceil(config.rampLength / TERRAIN_SEGMENT_WIDTH);
    for (let i = 0; i < rampSteps; i++) {
      const progress = i / rampSteps;
      const rampX = x - config.rampLength + i * TERRAIN_SEGMENT_WIDTH;
      const rampY = sourceY - heightDiff * progress;

      branchConnectors.push({
        x: rampX,
        y: rampY,
        width: TERRAIN_SEGMENT_WIDTH,
        height: 150,
        slope: -heightDiff / config.rampLength,
        isGround: true,
        isSolid: true,
        isRamp: true,
        sourceLayer,
        targetLayer,
        fillToBottom: true,
      });
    }
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
   * Order: water -> high layers (back) -> low layers (front) -> base ground
   */
  function render(ctx) {
    // 1. Render water first (deepest background)
    renderWater(ctx);

    // 2. Render layered terrain from back to front
    // Group segments by layer and render each layer as continuous terrain
    renderLayeredTerrainLayers(ctx);

    // 3. Render ramps/connectors
    for (const connector of branchConnectors) {
      renderBranchConnector(ctx, connector);
    }

    // 4. Render base ground terrain (front, covers lower portions of upper layers)
    renderGroundTerrain(ctx);

    // 5. Render bridge platforms (weekend stepping stones)
    for (const platform of bridgePlatforms) {
      renderBridgePlatform(ctx, platform);
    }

    // 6. Render danger indicators
    renderDangerZones(ctx);
  }

  /**
   * Render all layered terrain as continuous terrain profiles
   * Each layer is rendered as a smooth ground surface, not individual rectangles
   */
  function renderLayeredTerrainLayers(ctx) {
    if (elevatedPlatforms.length === 0) return;

    // Group platforms by layer index
    const layerGroups = {};
    for (const platform of elevatedPlatforms) {
      if (!platform.isLayeredTerrain) continue;
      const idx = platform.layerIndex ?? 1;
      if (!layerGroups[idx]) {
        layerGroups[idx] = [];
      }
      layerGroups[idx].push(platform);
    }

    // Sort layers descending (highest layer = background, renders first)
    const layerIndices = Object.keys(layerGroups).map(Number).sort((a, b) => b - a);

    for (const layerIdx of layerIndices) {
      const platforms = layerGroups[layerIdx];
      if (!platforms || platforms.length === 0) continue;

      // Sort platforms by X position
      platforms.sort((a, b) => a.x - b.x);

      // Find continuous sections (segments with gaps between them)
      const sections = [];
      let currentSection = [platforms[0]];

      for (let i = 1; i < platforms.length; i++) {
        const prev = platforms[i - 1];
        const curr = platforms[i];

        // Check if there's a gap (more than 1 segment width apart)
        if (curr.x - (prev.x + prev.width) > TERRAIN_SEGMENT_WIDTH * 1.5) {
          // Gap found, start new section
          sections.push(currentSection);
          currentSection = [curr];
        } else {
          currentSection.push(curr);
        }
      }
      sections.push(currentSection);

      // Render each section as continuous terrain
      for (const section of sections) {
        renderLayerSection(ctx, section, layerIdx);
      }
    }
  }

  /**
   * Render a continuous section of a terrain layer
   * Creates smooth ground profile with cliff edges at section ends
   */
  function renderLayerSection(ctx, sectionPlatforms, layerIdx) {
    if (sectionPlatforms.length === 0) return;

    const layer = LAYERED_TERRAIN.layers[layerIdx];
    const colorKey = layer?.color || 'base';
    const colors = LAYERED_TERRAIN.layerColors[colorKey] || LAYERED_TERRAIN.layerColors.base;

    const first = sectionPlatforms[0];
    const last = sectionPlatforms[sectionPlatforms.length - 1];
    const fillBottom = WATER_LEVEL + 50;

    // Build terrain profile
    const profile = [];
    for (const seg of sectionPlatforms) {
      profile.push({ x: seg.x, y: seg.y });
      profile.push({ x: seg.x + seg.width, y: seg.y });
    }

    // === Deep rock layer (fills to water) ===
    ctx.fillStyle = colors.deep;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const pt of profile) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineTo(last.x + last.width, fillBottom);
    ctx.lineTo(first.x, fillBottom);
    ctx.closePath();
    ctx.fill();

    // === Mid layer (dirt/rock band) ===
    ctx.fillStyle = colors.mid;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const pt of profile) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineTo(last.x + last.width, last.y + 30);
    ctx.lineTo(first.x, first.y + 30);
    ctx.closePath();
    ctx.fill();

    // === Top surface (grass/vegetation) ===
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const pt of profile) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineTo(last.x + last.width, last.y + 10);
    ctx.lineTo(first.x, first.y + 10);
    ctx.closePath();
    ctx.fill();

    // === Edge line for definition ===
    ctx.strokeStyle = colors.deep;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const pt of profile) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // === Draw cliff faces at section edges ===
    // Left cliff (start of section)
    ctx.fillStyle = colors.deep;
    ctx.fillRect(first.x - 3, first.y, 3, fillBottom - first.y);

    // Right cliff (end of section)
    ctx.fillRect(last.x + last.width, last.y, 3, fillBottom - last.y);
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
   * Render a bridge platform (weekend stepping stone or connector platform)
   */
  function renderBridgePlatform(ctx, platform) {
    const { x, y, width, height, isConnector, connectsTo } = platform;

    // Connector platforms have a distinct look (more ethereal/helpful)
    if (isConnector) {
      renderConnectorPlatform(ctx, platform);
      return;
    }

    // Regular bridge platform
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
   * Render a connector platform (sparse floating platform for vertical access)
   * Visually distinct - shows it's a stepping stone to reach higher terrain
   */
  function renderConnectorPlatform(ctx, platform) {
    const { x, y, width, height, connectsTo } = platform;

    // Glow effect indicating it leads somewhere
    const glowColor = connectsTo >= 2 ? 'rgba(160, 100, 200, 0.3)' : 'rgba(100, 180, 100, 0.25)';
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, width / 2 + 10, height + 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shadow below
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height + 20, width / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Platform body (semi-transparent to show it's floating)
    const bodyColor = connectsTo >= 2 ? '#8a7aaa' : '#7a9a7a';
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    // Top surface
    const topColor = connectsTo >= 2 ? '#aa9acc' : '#9aba9a';
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 1, width - 4, height - 4, 3);
    ctx.fill();

    // Highlight edge
    ctx.strokeStyle = '#ffffff40';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 2);
    ctx.lineTo(x + width - 4, y + 2);
    ctx.stroke();

    // Arrow indicator pointing up (shows this leads to higher ground)
    ctx.fillStyle = '#ffffff60';
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y - 6);
    ctx.lineTo(x + width / 2 - 5, y - 1);
    ctx.lineTo(x + width / 2 + 5, y - 1);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Render elevated path platform (legacy floating platforms)
   * Note: Layered terrain is now rendered by renderLayeredTerrainLayers()
   */
  function renderElevatedPlatform(ctx, platform) {
    // Skip layered terrain - handled by renderLayeredTerrainLayers
    if (platform.isLayeredTerrain) return;

    // Legacy floating platform rendering (kept for special cases like weekend bridges)
    const { x, y, width, height, tierColor, bonusMultiplier } = platform;

    // Color schemes per tier (more dramatic as height increases)
    const tierColors = {
      low: {
        body: '#6a8a6a',      // Mossy green
        top: '#8aaa8a',
        edge: '#4a6a4a',
        glow: 'rgba(100, 180, 100, 0.2)',
        accent: '#88bb88',
      },
      mid: {
        body: '#6a7a9a',      // Slate blue
        top: '#8a9aba',
        edge: '#4a5a7a',
        glow: 'rgba(100, 140, 200, 0.25)',
        accent: '#aabbdd',
      },
      high: {
        body: '#8a6a9a',      // Purple
        top: '#aa8aba',
        edge: '#6a4a7a',
        glow: 'rgba(160, 100, 200, 0.3)',
        accent: '#cc99ff',
      },
      sky: {
        body: '#9a7a6a',      // Golden/amber
        top: '#baa080',
        edge: '#7a5a4a',
        glow: 'rgba(255, 200, 100, 0.35)',
        accent: '#ffdd88',
      },
    };

    const colors = tierColors[tierColor] || tierColors.mid;

    // Glow effect (stronger for higher tiers)
    ctx.fillStyle = colors.glow;
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, width / 2 + 12, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Platform shadow (fainter for higher platforms)
    const shadowAlpha = tierColor === 'sky' ? 0.15 : (tierColor === 'high' ? 0.2 : 0.25);
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height + 25, width / 2 - 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Platform underside
    ctx.fillStyle = colors.edge;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + height);
    ctx.lineTo(x + width - 6, y + height);
    ctx.lineTo(x + width - 14, y + height + 12);
    ctx.lineTo(x + 14, y + height + 12);
    ctx.closePath();
    ctx.fill();

    // Platform body
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5);
    ctx.fill();

    // Platform top surface
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, width - 4, height - 5, 4);
    ctx.fill();

    // Top edge highlight
    ctx.strokeStyle = '#ffffff50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 3);
    ctx.lineTo(x + width - 6, y + 3);
    ctx.stroke();

    // Tier-specific decorations
    if (tierColor === 'sky') {
      // Floating crystals for sky tier
      ctx.fillStyle = colors.accent + '90';
      for (let i = 0; i < width / 30; i++) {
        const crystalX = x + 12 + i * 30 + Math.sin(x + i) * 4;
        ctx.beginPath();
        ctx.moveTo(crystalX, y - 2);
        ctx.lineTo(crystalX - 4, y - 10);
        ctx.lineTo(crystalX + 4, y - 10);
        ctx.closePath();
        ctx.fill();
      }
    } else if (tierColor === 'high') {
      // Mystical sparkles for high tier
      ctx.fillStyle = colors.accent + '70';
      for (let i = 0; i < width / 25; i++) {
        ctx.beginPath();
        ctx.arc(x + 10 + i * 25, y - 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tierColor === 'mid') {
      // Small rocks for mid tier
      ctx.fillStyle = colors.accent + '50';
      for (let i = 0; i < width / 35; i++) {
        ctx.fillRect(x + 12 + i * 35, y - 2, 4, 3);
      }
    }

    // Bonus indicator for higher tiers
    if (bonusMultiplier > 1.0) {
      ctx.fillStyle = colors.accent;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`×${bonusMultiplier.toFixed(1)}`, x + width / 2, y - 6);
    }
  }

  /**
   * Render branch connector (ramps connecting terrain layers)
   * Solid ground ramps, not floating stepping stones
   */
  function renderBranchConnector(ctx, connector) {
    const { x, y, width, height, isRamp, fillToBottom, sourceLayer, targetLayer } = connector;

    // Use solid ramp rendering for terrain connections
    if (isRamp && fillToBottom) {
      renderSolidRamp(ctx, connector);
      return;
    }

    // Legacy stepping stone rendering (kept for special cases)
    const { stepIndex = 0, tier = 0, isConnector } = connector;

    // Color based on tier (matches elevated platform colors)
    const tierHues = [120, 210, 280, 35]; // green, blue, purple, gold
    const hue = tierHues[Math.min(tier, tierHues.length - 1)];
    const saturation = 20 + tier * 5;
    const lightness = 40 + stepIndex * 3;

    const stoneColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const topColor = `hsl(${hue}, ${saturation}%, ${lightness + 12}%)`;

    // Step shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height + 6, width / 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone body
    ctx.fillStyle = stoneColor;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    // Stone top
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 1, width - 4, height - 4, 3);
    ctx.fill();

    // Highlight edge
    ctx.strokeStyle = '#ffffff30';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 2);
    ctx.lineTo(x + width - 4, y + 2);
    ctx.stroke();

    // Arrow indicator on connector steps (shows climb direction)
    if (isConnector && stepIndex % 3 === 0) {
      ctx.fillStyle = '#ffffff40';
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y - 4);
      ctx.lineTo(x + width / 2 - 4, y);
      ctx.lineTo(x + width / 2 + 4, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Render a solid ramp connecting terrain layers
   * Natural slope like a cliff path, not floating
   */
  function renderSolidRamp(ctx, ramp) {
    const { x, y, width, sourceLayer, targetLayer } = ramp;

    // Determine color based on target layer (higher layer gets the color)
    const layerIdx = Math.max(sourceLayer || 0, targetLayer || 1);
    const layerColor = LAYERED_TERRAIN.layers[layerIdx]?.color || 'base';
    const colors = LAYERED_TERRAIN.layerColors[layerColor] || LAYERED_TERRAIN.layerColors.base;

    // Calculate fill depth
    const fillBottom = WATER_LEVEL + 50;

    // Ramp body (solid fill down to bottom)
    ctx.fillStyle = colors.deep;
    ctx.fillRect(x, y, width, fillBottom - y);

    // Mid-layer band
    ctx.fillStyle = colors.mid;
    ctx.fillRect(x, y, width, Math.min(30, fillBottom - y));

    // Top surface
    ctx.fillStyle = colors.top;
    ctx.fillRect(x, y, width, 8);

    // Edge line for definition
    ctx.strokeStyle = colors.deep;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
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
