// SpatialNav Part — Directional navigation compass for Hub
// HUB-01: Badlands Hub Shell & Spatial Navigation

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.SpatialNav', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-SpatialNav SpatialNav';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Bind directional navigation
  bindNavigation(root, ctx);

  return {
    unmount() {
      root.remove();
    },
    update(newData) {
      // No dynamic updates needed
    },
  };
}

function bindNavigation(root, ctx) {
  const dirButtons = root.querySelectorAll('[data-dir]');

  dirButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (target && ctx.navigate) {
        ctx.navigate(target);
      } else if (target) {
        // Fallback: use hash navigation
        location.hash = `#${target}`;
      }
    });
  });

  // Keyboard navigation support
  root.addEventListener('keydown', (e) => {
    let target = null;
    switch (e.key) {
      case 'ArrowUp':
        target = 'guidance';
        break;
      case 'ArrowDown':
        target = 'badlands';
        break;
      case 'ArrowLeft':
        target = 'quests';
        break;
      case 'ArrowRight':
        target = 'avatar';
        break;
    }
    if (target) {
      e.preventDefault();
      if (ctx.navigate) {
        ctx.navigate(target);
      } else {
        location.hash = `#${target}`;
      }
    }
  });
}
