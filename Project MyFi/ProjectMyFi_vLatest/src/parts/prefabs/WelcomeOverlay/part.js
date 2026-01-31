// WelcomeOverlay Part — WO-P0-A: First-Run Narrative Welcome
// Frames the player as a patron/influence, not a controller
// Shows once on first load, skippable, does not block interaction

import { ensureGlobalCSS } from '../../../core/styleLoader.js';
import { markFirstRunComplete } from '../../../core/firstRun.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.WelcomeOverlay', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-WelcomeOverlay WelcomeOverlay';

  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // State
  let isActive = false;

  /**
   * Show the welcome overlay with staggered animation
   */
  function show() {
    if (isActive) return;
    isActive = true;

    // Trigger visibility (CSS handles staggered line reveal)
    requestAnimationFrame(() => {
      root.classList.add('is-visible');
    });

    console.log('[WelcomeOverlay] Showing first-run welcome');
  }

  /**
   * Hide the welcome overlay and mark first-run complete
   */
  function hide() {
    if (!isActive) return;
    isActive = false;

    root.classList.add('is-exiting');
    root.classList.remove('is-visible');

    // Mark first-run complete
    markFirstRunComplete();

    // Remove after animation
    setTimeout(() => {
      root.classList.remove('is-exiting');
    }, 400);

    console.log('[WelcomeOverlay] First-run welcome complete');

    // Emit event for any listeners
    if (ctx.emitter) {
      ctx.emitter.emit('welcome:complete', {});
    }
  }

  // Bind interactions
  const continueBtn = root.querySelector('[data-action="continue"]');
  if (continueBtn) {
    continueBtn.addEventListener('click', hide);
  }

  // Backdrop click to dismiss (optional - for skippability)
  const backdrop = root.querySelector('.WelcomeOverlay__backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', hide);
  }

  // Escape key to dismiss
  function onKeyDown(e) {
    if (e.key === 'Escape' && isActive) {
      hide();
    }
  }
  document.addEventListener('keydown', onKeyDown);

  // Auto-show on mount if triggered
  if (data.autoShow !== false) {
    // Small delay to ensure DOM is ready
    setTimeout(show, 100);
  }

  return {
    unmount() {
      document.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
    update(newData) {
      // No dynamic updates needed
    },
    show,
    hide,
    isActive() {
      return isActive;
    },
  };
}
