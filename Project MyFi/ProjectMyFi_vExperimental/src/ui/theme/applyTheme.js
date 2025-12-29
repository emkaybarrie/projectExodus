/**
 * Apply theme CSS once (native ESM-safe: no CSS module imports).
 * - Injects <link rel="stylesheet"> pointing at theme.css
 * - Adds a marker class for baseline styles
 */

function ensureThemeLink() {
  const id = 'myfi-ui-theme-css';
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';

  // Resolve theme.css relative to this module file.
  link.href = new URL('./theme.css', import.meta.url).href;

  document.head.appendChild(link);
}

export function applyThemeOnce() {
  ensureThemeLink();
  document.documentElement.classList.add('ui-root');
}

// Auto-apply on import (safe)
applyThemeOnce();
