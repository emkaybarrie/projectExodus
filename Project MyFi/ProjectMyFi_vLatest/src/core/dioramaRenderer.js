// dioramaRenderer.js — Layered diorama composition renderer
// Per STAGE_EPISODES_SPEC_V1.md
//
// Composes background + actors + props + effects into a layered scene
// Supports crossfade transitions and veil placeholders

import { createAssetRegistry } from './assetRegistry.js';

/**
 * Z-index layers for diorama composition
 */
const LAYERS = {
  BACKGROUND: 0,
  PROPS_BACK: 1,
  ACTORS: 2,
  PROPS_FRONT: 3,
  EFFECTS: 4,
  OVERLAY: 5,
  CAPTION: 6,
};

/**
 * Create a Diorama Renderer
 *
 * @param {HTMLElement} container - Container element for the diorama
 * @param {Object} options
 * @param {string} options.baseUrl - Base URL for asset resolution
 * @param {number} options.transitionMs - Crossfade duration in ms
 * @returns {Object} Renderer interface
 */
export function createDioramaRenderer(container, options = {}) {
  const {
    baseUrl = import.meta.url,
    transitionMs = 400,
  } = options;

  // Create asset registry
  const registry = createAssetRegistry({ baseUrl });

  // Current diorama spec
  let currentSpec = null;

  // Layer elements
  const layers = {
    background: null,
    actors: null,
    props: null,
    effects: null,
    caption: null,
  };

  // Initialize container
  function init() {
    container.classList.add('diorama');
    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    // Create layer containers
    layers.background = createLayer('diorama__background', LAYERS.BACKGROUND);
    layers.props = createLayer('diorama__props', LAYERS.PROPS_BACK);
    layers.actors = createLayer('diorama__actors', LAYERS.ACTORS);
    layers.effects = createLayer('diorama__effects', LAYERS.EFFECTS);
    layers.caption = createLayer('diorama__caption', LAYERS.CAPTION);

    // Apply base styles
    injectStyles();
  }

  /**
   * Create a layer element
   */
  function createLayer(className, zIndex) {
    const layer = document.createElement('div');
    layer.className = className;
    layer.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: ${zIndex};
      pointer-events: none;
    `;
    container.appendChild(layer);
    return layer;
  }

  /**
   * Inject CSS styles for diorama
   */
  function injectStyles() {
    const styleId = 'diorama-renderer-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .diorama {
        background: #0a0815;
      }

      .diorama__background {
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        transition: opacity ${transitionMs}ms ease, background-image ${transitionMs}ms ease;
      }

      .diorama__actor {
        position: absolute;
        transform-origin: center bottom;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }

      .diorama__actor img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .diorama__prop {
        position: absolute;
        transform-origin: center bottom;
      }

      .diorama__effect {
        position: absolute;
        inset: 0;
        background-size: cover;
        pointer-events: none;
        mix-blend-mode: screen;
      }

      .diorama__caption {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 16px;
        pointer-events: none;
      }

      .diorama__captionText {
        background: rgba(10, 8, 21, 0.85);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 8px;
        padding: 12px 20px;
        font-family: 'Crimson Pro', Georgia, serif;
        font-size: 14px;
        font-style: italic;
        color: rgba(240, 230, 210, 0.9);
        text-align: center;
        max-width: 80%;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.4s ease, transform 0.4s ease;
      }

      .diorama__captionText--visible {
        opacity: 1;
        transform: translateY(0);
      }

      .diorama__veil {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(26, 16, 37, 0.8);
        border: 2px dashed rgba(139, 92, 246, 0.4);
        border-radius: 8px;
        color: rgba(139, 92, 246, 0.7);
        font-size: 24px;
      }

      /* Slow-time overlay */
      .diorama--slowtime .diorama__background {
        filter: brightness(0.7) saturate(0.8);
      }

      .diorama--slowtime .diorama__actor {
        animation: slowtimePulse 2s ease-in-out infinite;
      }

      @keyframes slowtimePulse {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.1) drop-shadow(0 0 8px rgba(139, 92, 246, 0.5)); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Render a diorama from spec
   */
  async function render(spec) {
    if (!spec) {
      console.warn('[DioramaRenderer] No spec provided');
      return;
    }

    console.log(`[DioramaRenderer] Rendering diorama: ${spec.seed}`);

    // Preload assets
    await registry.preloadDiorama(spec);

    currentSpec = spec;

    // Render each layer
    renderBackground(spec);
    renderActors(spec);
    renderProps(spec);
    renderEffects(spec);

    // Apply camera
    applyCamera(spec.camera);
  }

  /**
   * Render background layer
   */
  function renderBackground(spec) {
    const url = registry.getBackgroundUrl(
      spec.background.id,
      spec.background.variant
    );

    // Check if missing
    if (registry.isMissing(url)) {
      layers.background.style.backgroundImage = `url('${registry.getVeilUrl()}')`;
      console.warn(`[DioramaRenderer] Using veil for missing background: ${spec.background.id}`);
    } else {
      layers.background.style.backgroundImage = `url('${url}')`;
    }
  }

  /**
   * Render actors layer
   */
  function renderActors(spec) {
    // Clear existing actors
    layers.actors.innerHTML = '';

    for (const actor of spec.actors || []) {
      const actorEl = createActorElement(actor);
      layers.actors.appendChild(actorEl);
    }
  }

  /**
   * Create an actor element
   */
  function createActorElement(actor) {
    const url = registry.getActorUrl(actor.slot, actor.kind, actor.pose);
    const isMissing = registry.isMissing(url);

    const el = document.createElement('div');
    el.className = `diorama__actor diorama__actor--${actor.slot}`;
    el.dataset.kind = actor.kind;

    // Position and scale
    el.style.left = `${actor.x}%`;
    el.style.top = `${actor.y}%`;
    el.style.transform = `translate(-50%, -100%) scale(${actor.scale})`;
    el.style.zIndex = actor.z;

    if (isMissing) {
      // Render veil placeholder
      el.classList.add('diorama__veil');
      el.style.width = '80px';
      el.style.height = '100px';
      el.textContent = '?';
      console.warn(`[DioramaRenderer] Using veil for missing actor: ${actor.kind}`);
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.alt = actor.kind;
      img.style.height = '100px';
      img.onerror = () => {
        el.classList.add('diorama__veil');
        el.style.width = '80px';
        el.style.height = '100px';
        el.textContent = '?';
        img.remove();
      };
      el.appendChild(img);
    }

    return el;
  }

  /**
   * Render props layer
   */
  function renderProps(spec) {
    layers.props.innerHTML = '';

    for (const prop of spec.props || []) {
      const url = registry.getPropUrl(prop.kind);
      const isMissing = registry.isMissing(url);

      const el = document.createElement('div');
      el.className = 'diorama__prop';
      el.style.left = `${prop.x}%`;
      el.style.top = `${prop.y}%`;
      el.style.transform = `translate(-50%, -100%) scale(${prop.scale})`;
      el.style.zIndex = prop.z;

      if (isMissing) {
        el.classList.add('diorama__veil');
        el.style.width = '40px';
        el.style.height = '40px';
        el.textContent = '?';
      } else {
        const img = document.createElement('img');
        img.src = url;
        img.alt = prop.kind;
        img.style.height = '40px';
        el.appendChild(img);
      }

      layers.props.appendChild(el);
    }
  }

  /**
   * Render effects layer
   */
  function renderEffects(spec) {
    layers.effects.innerHTML = '';

    for (const effect of spec.effects || []) {
      const url = registry.getEffectUrl(effect.kind);

      const el = document.createElement('div');
      el.className = `diorama__effect diorama__effect--${effect.kind}`;
      el.style.opacity = effect.intensity;

      if (!registry.isMissing(url)) {
        el.style.backgroundImage = `url('${url}')`;
      }

      layers.effects.appendChild(el);
    }
  }

  /**
   * Apply camera settings
   */
  function applyCamera(camera) {
    if (!camera) return;

    const { zoom = 1, pan = 'none' } = camera;

    // Apply zoom
    container.style.transform = `scale(${zoom})`;

    // Apply pan (adjust background position)
    let bgPosition = 'center';
    if (pan === 'left') bgPosition = '30% center';
    if (pan === 'right') bgPosition = '70% center';

    layers.background.style.backgroundPosition = bgPosition;
  }

  /**
   * Show caption text
   */
  function showCaption(text, duration = 3000) {
    // Remove existing caption
    const existing = layers.caption.querySelector('.diorama__captionText');
    if (existing) existing.remove();

    if (!text) return;

    const captionEl = document.createElement('div');
    captionEl.className = 'diorama__captionText';
    captionEl.textContent = text;
    layers.caption.appendChild(captionEl);

    // Animate in
    requestAnimationFrame(() => {
      captionEl.classList.add('diorama__captionText--visible');
    });

    // Auto-hide
    if (duration > 0) {
      setTimeout(() => {
        captionEl.classList.remove('diorama__captionText--visible');
        setTimeout(() => captionEl.remove(), 400);
      }, duration);
    }
  }

  /**
   * Enable slow-time mode
   */
  function enableSlowTime() {
    container.classList.add('diorama--slowtime');
  }

  /**
   * Disable slow-time mode
   */
  function disableSlowTime() {
    container.classList.remove('diorama--slowtime');
  }

  /**
   * Crossfade to new spec
   */
  async function crossfade(newSpec) {
    // Fade out
    layers.background.style.opacity = '0';

    await new Promise(resolve => setTimeout(resolve, transitionMs));

    // Render new
    await render(newSpec);

    // Fade in
    layers.background.style.opacity = '1';
  }

  /**
   * Clear the diorama
   */
  function clear() {
    layers.background.style.backgroundImage = 'none';
    layers.actors.innerHTML = '';
    layers.props.innerHTML = '';
    layers.effects.innerHTML = '';
    layers.caption.innerHTML = '';
    currentSpec = null;
  }

  /**
   * Destroy the renderer
   */
  function destroy() {
    clear();
    Object.values(layers).forEach(layer => layer?.remove());
    container.classList.remove('diorama', 'diorama--slowtime');
    registry.clearCache();
  }

  // Initialize on creation
  init();

  return {
    render,
    crossfade,
    showCaption,
    enableSlowTime,
    disableSlowTime,
    clear,
    destroy,

    // Getters
    getCurrentSpec: () => currentSpec,
    getRegistry: () => registry,
    getContainer: () => container,
  };
}

export default { createDioramaRenderer };
