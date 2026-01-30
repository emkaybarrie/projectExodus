// gradeProfileRegistry.js — Grade/Lighting Profiles for Stage (WO-S4)
// FEATURE-FLAGGED: __MYFI_DEV_CONFIG__.enableGradeProfiles
//
// Prepares Stage to support lighting/grade profiles without:
// - Requiring new assets
// - Changing existing rendering
// - Breaking existing manifests
//
// Per STAGE-S4-ASSET-LAYERS-V2 guardrails:
// - Existing background loading UNCHANGED
// - Existing CSS effects UNCHANGED
// - Existing manifests remain valid
// - Grade profiles do nothing unless flag enabled

/**
 * Grade Profile definitions
 *
 * Each profile defines visual parameters applied via CSS overlay.
 * When gradeProfile is missing from manifest, renders exactly as today.
 *
 * Parameters:
 * - darkness: 0-1, amount of dark overlay (0 = none, 1 = full black)
 * - tint: CSS color to blend over scene
 * - saturation: 0-2, color saturation multiplier (1 = normal)
 * - contrast: 0-2, contrast multiplier (1 = normal)
 * - blur: px value for background blur
 * - vignette: 0-1, vignette intensity
 */
export const GRADE_PROFILES = {
  // No grading (default, matches current behaviour)
  none: {
    id: 'none',
    label: 'None',
    description: 'No visual grading applied',
    params: {},
  },

  // Cave / underground environments
  cave_dark: {
    id: 'cave_dark',
    label: 'Cave Dark',
    description: 'Dark underground with blue-ish tones',
    params: {
      darkness: 0.4,
      tint: 'rgba(30, 40, 60, 0.3)',
      saturation: 0.8,
      vignette: 0.3,
    },
  },

  // Twilight / dusk atmosphere
  twilight: {
    id: 'twilight',
    label: 'Twilight',
    description: 'Warm orange-pink dusk tones',
    params: {
      tint: 'rgba(180, 100, 80, 0.15)',
      saturation: 1.1,
      contrast: 1.05,
      vignette: 0.2,
    },
  },

  // Night / moonlit
  night: {
    id: 'night',
    label: 'Night',
    description: 'Cool blue moonlit night',
    params: {
      darkness: 0.3,
      tint: 'rgba(40, 60, 120, 0.25)',
      saturation: 0.7,
      vignette: 0.4,
    },
  },

  // Storm / dramatic weather
  storm: {
    id: 'storm',
    label: 'Storm',
    description: 'Dark stormy atmosphere with desaturation',
    params: {
      darkness: 0.25,
      tint: 'rgba(60, 70, 80, 0.2)',
      saturation: 0.6,
      contrast: 1.2,
      vignette: 0.3,
    },
  },

  // Void / corruption
  void: {
    id: 'void',
    label: 'Void',
    description: 'Otherworldly purple void tones',
    params: {
      darkness: 0.2,
      tint: 'rgba(100, 40, 120, 0.3)',
      saturation: 0.9,
      vignette: 0.5,
    },
  },

  // Danger / alert
  danger: {
    id: 'danger',
    label: 'Danger',
    description: 'Red-tinted high alert',
    params: {
      tint: 'rgba(200, 50, 50, 0.15)',
      saturation: 1.2,
      contrast: 1.1,
      vignette: 0.25,
    },
  },

  // Safe zone / sanctuary
  sanctuary: {
    id: 'sanctuary',
    label: 'Sanctuary',
    description: 'Warm golden safe zone',
    params: {
      tint: 'rgba(200, 180, 100, 0.1)',
      saturation: 1.1,
      vignette: 0.15,
    },
  },
};

/**
 * Check if grade profiles feature is enabled
 * @returns {boolean}
 */
function isEnabled() {
  const config = typeof window !== 'undefined' ? window.__MYFI_DEV_CONFIG__ : null;
  return config?.enableGradeProfiles === true;
}

/**
 * Get a grade profile by ID
 *
 * @param {string} profileId - Profile ID
 * @returns {Object|null} Profile definition or null if not found
 */
export function getGradeProfile(profileId) {
  return GRADE_PROFILES[profileId] || null;
}

/**
 * Get CSS filter string for a grade profile
 *
 * Returns empty string if:
 * - Feature is disabled
 * - Profile is 'none' or not found
 *
 * @param {string} profileId - Profile ID
 * @returns {string} CSS filter value
 */
export function getGradeFilterCSS(profileId) {
  if (!isEnabled()) {
    return ''; // Feature disabled - no filter
  }

  const profile = getGradeProfile(profileId);
  if (!profile || profile.id === 'none' || !profile.params) {
    return '';
  }

  const { saturation = 1, contrast = 1, blur = 0 } = profile.params;
  const filters = [];

  if (saturation !== 1) {
    filters.push(`saturate(${saturation})`);
  }
  if (contrast !== 1) {
    filters.push(`contrast(${contrast})`);
  }
  if (blur > 0) {
    filters.push(`blur(${blur}px)`);
  }

  return filters.join(' ');
}

/**
 * Get CSS for grade overlay element
 *
 * Returns empty string if:
 * - Feature is disabled
 * - Profile is 'none' or not found
 *
 * @param {string} profileId - Profile ID
 * @returns {string} CSS declarations for overlay
 */
export function getGradeOverlayCSS(profileId) {
  if (!isEnabled()) {
    return ''; // Feature disabled - no overlay
  }

  const profile = getGradeProfile(profileId);
  if (!profile || profile.id === 'none' || !profile.params) {
    return '';
  }

  const { darkness = 0, tint = null, vignette = 0 } = profile.params;
  const declarations = [];

  // Build background layers
  const layers = [];

  // Vignette layer (radial gradient from transparent to dark)
  if (vignette > 0) {
    const vignetteColor = `rgba(0, 0, 0, ${vignette})`;
    layers.push(`radial-gradient(ellipse at center, transparent 30%, ${vignetteColor} 100%)`);
  }

  // Tint layer
  if (tint) {
    layers.push(`linear-gradient(${tint}, ${tint})`);
  }

  // Darkness layer
  if (darkness > 0) {
    layers.push(`linear-gradient(rgba(0, 0, 0, ${darkness}), rgba(0, 0, 0, ${darkness}))`);
  }

  if (layers.length > 0) {
    declarations.push(`background: ${layers.join(', ')}`);
  }

  return declarations.join('; ');
}

/**
 * Apply grade profile to an element (feature-flagged)
 *
 * Creates/updates an overlay element for grading effects.
 * Does nothing if feature is disabled.
 *
 * @param {HTMLElement} containerEl - Container element
 * @param {string} profileId - Profile ID
 * @returns {HTMLElement|null} Overlay element or null
 */
export function applyGradeProfile(containerEl, profileId) {
  if (!isEnabled() || !containerEl) {
    return null;
  }

  const profile = getGradeProfile(profileId);

  // Get or create overlay element
  let overlay = containerEl.querySelector('.grade-profile-overlay');

  // If profile is none or not found, remove overlay and return
  if (!profile || profile.id === 'none') {
    if (overlay) {
      overlay.remove();
    }
    return null;
  }

  // Create overlay if needed
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'grade-profile-overlay';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      transition: opacity 0.3s ease, background 0.3s ease;
    `;
    containerEl.appendChild(overlay);
  }

  // Apply overlay CSS
  const overlayCSS = getGradeOverlayCSS(profileId);
  if (overlayCSS) {
    overlay.style.cssText += `;${overlayCSS}`;
  }

  // Apply filter to container (affects children)
  const filterCSS = getGradeFilterCSS(profileId);
  if (filterCSS) {
    // Apply to a background element if it exists, not container itself
    const bgEl = containerEl.querySelector('.stage-background, .BadlandsStage__scenicBg, .BadlandsStage__encounterBg');
    if (bgEl) {
      bgEl.style.filter = filterCSS;
    }
  }

  overlay.dataset.profileId = profileId;
  return overlay;
}

/**
 * Remove grade profile from an element
 *
 * @param {HTMLElement} containerEl - Container element
 */
export function removeGradeProfile(containerEl) {
  if (!containerEl) return;

  const overlay = containerEl.querySelector('.grade-profile-overlay');
  if (overlay) {
    overlay.remove();
  }

  // Clear any filters
  const bgEl = containerEl.querySelector('.stage-background, .BadlandsStage__scenicBg, .BadlandsStage__encounterBg');
  if (bgEl) {
    bgEl.style.filter = '';
  }
}

/**
 * Get all available grade profiles
 * @returns {Array} Array of profile definitions
 */
export function getAllProfiles() {
  return Object.values(GRADE_PROFILES);
}

/**
 * Get system status
 * @returns {Object} Status object
 */
export function getSystemStatus() {
  return {
    enabled: isEnabled(),
    version: 'v2',
    featureFlag: 'enableGradeProfiles',
    profileCount: Object.keys(GRADE_PROFILES).length,
    note: 'gradeProfile in manifests is optional. Existing assets render unchanged.',
  };
}

export default {
  GRADE_PROFILES,
  getGradeProfile,
  getGradeFilterCSS,
  getGradeOverlayCSS,
  applyGradeProfile,
  removeGradeProfile,
  getAllProfiles,
  getSystemStatus,
  isEnabled,
};
