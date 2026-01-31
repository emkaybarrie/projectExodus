// assetPreflight.js — WO-DEV-ASSET-PREFLIGHT
// Dev-only asset existence preflight with caching and placeholder support
// Validates assets exist before use, records missing assets for inspection

// ═══════════════════════════════════════════════════════════════════════════════
// Cache structures
// ═══════════════════════════════════════════════════════════════════════════════

// Manifest cache: manifestPath → { backgrounds: [], loaded: boolean, error: string|null }
const manifestCache = new Map();

// Asset existence cache: fullUrl → { exists: boolean, checked: boolean }
const assetExistsCache = new Map();

// Missing assets registry: fullUrl → { type, poolFolder, filename, manifestPath, expectedPath, fixSteps }
const missingAssets = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if dev asset preflight is enabled
 */
function isPreflightEnabled() {
  const devConfig = window.__MYFI_DEV_CONFIG__;
  return devConfig?.devAssetPreflightEnabled === true;
}

/**
 * Get the action bus for emitting events (if available)
 */
function getActionBus() {
  return window.__MYFI_DEBUG__?.actionBus;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Manifest Loading
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load and cache a manifest file
 * @param {string} manifestPath - Path to the manifest.json file
 * @returns {Promise<{backgrounds: string[], loaded: boolean, error: string|null}>}
 */
export async function loadManifest(manifestPath) {
  // Return cached if available
  if (manifestCache.has(manifestPath)) {
    return manifestCache.get(manifestPath);
  }

  const cacheEntry = { backgrounds: [], loaded: false, error: null };
  manifestCache.set(manifestPath, cacheEntry);

  try {
    const response = await fetch(manifestPath);
    if (!response.ok) {
      cacheEntry.error = `Failed to fetch manifest: ${response.status}`;
      return cacheEntry;
    }

    const data = await response.json();
    cacheEntry.backgrounds = data.backgrounds || [];
    cacheEntry.loaded = true;
    return cacheEntry;
  } catch (e) {
    cacheEntry.error = `Manifest parse error: ${e.message}`;
    return cacheEntry;
  }
}

/**
 * Get cached manifest (sync, returns null if not loaded)
 */
export function getCachedManifest(manifestPath) {
  return manifestCache.get(manifestPath) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Asset Existence Checking
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if an image asset exists (with caching)
 * @param {string} imageUrl - Full URL to the image
 * @returns {Promise<boolean>}
 */
export async function checkAssetExists(imageUrl) {
  // Return cached result if available
  if (assetExistsCache.has(imageUrl)) {
    const cached = assetExistsCache.get(imageUrl);
    if (cached.checked) {
      return cached.exists;
    }
  }

  const cacheEntry = { exists: false, checked: false };
  assetExistsCache.set(imageUrl, cacheEntry);

  try {
    // Use HEAD request for efficiency (no body download)
    const response = await fetch(imageUrl, { method: 'HEAD' });
    cacheEntry.exists = response.ok;
    cacheEntry.checked = true;
    return cacheEntry.exists;
  } catch (e) {
    // Network error or CORS issue - try loading as image
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        cacheEntry.exists = true;
        cacheEntry.checked = true;
        resolve(true);
      };
      img.onerror = () => {
        cacheEntry.exists = false;
        cacheEntry.checked = true;
        resolve(false);
      };
      img.src = imageUrl;
    });
  }
}

/**
 * Synchronously check cached existence (returns undefined if not checked)
 */
export function getCachedAssetExists(imageUrl) {
  const cached = assetExistsCache.get(imageUrl);
  return cached?.checked ? cached.exists : undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preflight Validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Preflight check for a stage background
 * Returns the asset URL if valid, or records as missing and returns null
 *
 * @param {Object} params
 * @param {string} params.imageUrl - Full URL to the background image
 * @param {string} params.poolFolder - Pool folder name (e.g., 'patrol/')
 * @param {string} params.filename - Just the filename (e.g., 'bg_patrol_01.png')
 * @param {string} params.manifestPath - Path to the pool's manifest.json
 * @param {string} params.stateName - Current world state name
 * @returns {Promise<{valid: boolean, url: string|null, fallbackUrl: string|null, missingEntry: Object|null}>}
 */
export async function preflightBackground(params) {
  const { imageUrl, poolFolder, filename, manifestPath, stateName } = params;

  // Skip preflight if not enabled
  if (!isPreflightEnabled()) {
    return { valid: true, url: imageUrl, fallbackUrl: null, missingEntry: null };
  }

  // Check if asset exists
  const exists = await checkAssetExists(imageUrl);

  if (exists) {
    // Asset is valid
    return { valid: true, url: imageUrl, fallbackUrl: null, missingEntry: null };
  }

  // Asset is missing - record it
  const missingEntry = {
    type: 'background',
    poolFolder,
    filename,
    manifestPath,
    expectedPath: imageUrl,
    stateName,
    timestamp: Date.now(),
    fixSteps: [
      `1. Create PNG file: ${filename}`,
      `2. Place at: ${poolFolder}${filename}`,
      `3. Add "${filename}" to backgrounds array in ${manifestPath}`,
    ],
  };

  missingAssets.set(imageUrl, missingEntry);

  // Emit asset:missing event
  const actionBus = getActionBus();
  if (actionBus) {
    actionBus.emit('asset:missing', missingEntry);
  }

  // Attempt fallback - find another valid asset in the same pool
  const fallbackUrl = await findFallbackBackground(manifestPath, poolFolder, imageUrl);

  return {
    valid: false,
    url: null,
    fallbackUrl,
    missingEntry,
  };
}

/**
 * Find a fallback background from the same pool
 */
async function findFallbackBackground(manifestPath, poolFolder, excludeUrl) {
  // Load manifest to get all backgrounds
  const manifest = await loadManifest(manifestPath);

  if (!manifest.loaded || manifest.backgrounds.length === 0) {
    return null;
  }

  // Extract base URL from manifest path
  const baseUrl = manifestPath.replace(/manifest\.json$/, '');

  // Check each background for existence (excluding the missing one)
  for (const bg of manifest.backgrounds) {
    const candidateUrl = baseUrl + bg;
    if (candidateUrl === excludeUrl) continue;

    const exists = await checkAssetExists(candidateUrl);
    if (exists) {
      return candidateUrl;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Missing Assets Registry
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all missing assets
 * @returns {Object[]} Array of missing asset entries
 */
export function getMissingAssets() {
  return Array.from(missingAssets.values());
}

/**
 * Check if a specific asset is recorded as missing
 */
export function isAssetMissing(url) {
  return missingAssets.has(url);
}

/**
 * Clear the missing assets registry
 */
export function clearMissingAssets() {
  missingAssets.clear();
}

/**
 * Remove a specific missing asset (e.g., after it's been added)
 */
export function removeMissingAsset(url) {
  missingAssets.delete(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Placeholder HTML Generation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate placeholder HTML for a missing background
 * @param {Object} missingEntry - The missing asset entry
 * @returns {string} HTML string for the placeholder
 */
export function generateMissingPlaceholderHTML(missingEntry) {
  if (!missingEntry) return '';

  const { type, filename, expectedPath, manifestPath, fixSteps } = missingEntry;

  return `
    <div class="AssetPreflight__placeholder" data-asset-type="${type}">
      <div class="AssetPreflight__placeholderIcon">⚠️</div>
      <div class="AssetPreflight__placeholderTitle">Missing ${type} Asset</div>
      <div class="AssetPreflight__placeholderDetails">
        <div class="AssetPreflight__placeholderRow">
          <span class="AssetPreflight__placeholderLabel">File:</span>
          <span class="AssetPreflight__placeholderValue">${filename}</span>
        </div>
        <div class="AssetPreflight__placeholderRow">
          <span class="AssetPreflight__placeholderLabel">Path:</span>
          <span class="AssetPreflight__placeholderValue AssetPreflight__placeholderValue--path">${expectedPath}</span>
        </div>
        <div class="AssetPreflight__placeholderRow">
          <span class="AssetPreflight__placeholderLabel">Manifest:</span>
          <span class="AssetPreflight__placeholderValue AssetPreflight__placeholderValue--path">${manifestPath}</span>
        </div>
      </div>
      <div class="AssetPreflight__placeholderFix">
        <div class="AssetPreflight__placeholderFixTitle">Fix Steps:</div>
        <ol class="AssetPreflight__placeholderFixList">
          ${fixSteps.map(step => `<li>${step}</li>`).join('')}
        </ol>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS for Placeholder (inject once)
// ═══════════════════════════════════════════════════════════════════════════════

let placeholderCSSInjected = false;

/**
 * Ensure placeholder CSS is injected
 */
export function ensurePlaceholderCSS() {
  if (placeholderCSSInjected) return;
  placeholderCSSInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .AssetPreflight__placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.25) 100%);
      border: 2px dashed rgba(239, 68, 68, 0.6);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      z-index: 50;
      backdrop-filter: blur(4px);
    }

    .AssetPreflight__placeholderIcon {
      font-size: 48px;
      margin-bottom: 12px;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
    }

    .AssetPreflight__placeholderTitle {
      font-family: 'Rajdhani', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #fca5a5;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 16px;
    }

    .AssetPreflight__placeholderDetails {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
      max-width: 100%;
    }

    .AssetPreflight__placeholderRow {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      text-align: left;
    }

    .AssetPreflight__placeholderLabel {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 1px;
      min-width: 60px;
      flex-shrink: 0;
    }

    .AssetPreflight__placeholderValue {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.9);
      word-break: break-all;
    }

    .AssetPreflight__placeholderValue--path {
      font-family: monospace;
      font-size: 10px;
      color: rgba(253, 186, 116, 0.9);
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .AssetPreflight__placeholderFix {
      background: rgba(0, 0, 0, 0.4);
      border-radius: 8px;
      padding: 12px 16px;
      text-align: left;
      max-width: 100%;
    }

    .AssetPreflight__placeholderFixTitle {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .AssetPreflight__placeholderFixList {
      margin: 0;
      padding-left: 20px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.8);
      line-height: 1.6;
    }

    .AssetPreflight__placeholderFixList li {
      margin-bottom: 4px;
    }
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports for Inspector Integration
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  isPreflightEnabled,
  loadManifest,
  getCachedManifest,
  checkAssetExists,
  getCachedAssetExists,
  preflightBackground,
  getMissingAssets,
  isAssetMissing,
  clearMissingAssets,
  removeMissingAsset,
  generateMissingPlaceholderHTML,
  ensurePlaceholderCSS,
};
