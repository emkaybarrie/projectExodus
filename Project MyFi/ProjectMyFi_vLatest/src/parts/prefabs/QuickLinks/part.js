// QuickLinks Part — Quick access buttons to games/features
// Placeholder for Badlands link (journey to be finalized later)

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.QuickLinks', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-QuickLinks QuickLinks';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Bind interactions
  bindInteractions(root, data, ctx);

  return {
    unmount() {
      root.remove();
    },
    update(newData) {
      // No dynamic data for now
    },
  };
}

function bindInteractions(root, data, ctx) {
  // Badlands link - opens in relative path
  const badlandsBtn = root.querySelector('[data-link="badlands"]');
  if (badlandsBtn) {
    badlandsBtn.addEventListener('click', () => {
      // Navigate to Badlands game
      // Using relative path from MyFi app location
      window.location.href = '../../../Badlands/index.html';
    });
  }
}
