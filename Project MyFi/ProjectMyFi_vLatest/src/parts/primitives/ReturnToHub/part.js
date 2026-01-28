// ReturnToHub Part — Simple navigation button to return to Hub
// HUB-01: Guarantees return-to-Hub from all directions

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Inline CSS for simplicity
  const css = `
    .Part-ReturnToHub {
      padding: var(--spacing-md, 1rem);
      display: flex;
      justify-content: center;
    }
    .ReturnToHub__btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 1rem);
      background: var(--color-surface, rgba(255, 255, 255, 0.1));
      border: 1px solid var(--color-border, rgba(255, 255, 255, 0.2));
      border-radius: var(--radius-md, 8px);
      color: var(--color-text, #fff);
      cursor: pointer;
      font-family: inherit;
      font-size: 0.9rem;
      transition: all 0.15s ease;
      min-height: 44px;
    }
    .ReturnToHub__btn:hover,
    .ReturnToHub__btn:focus {
      background: var(--color-primary, rgba(139, 92, 246, 0.3));
      border-color: var(--color-primary, #8b5cf6);
    }
    .ReturnToHub__icon {
      font-size: 1.25rem;
    }
  `;

  await ensureGlobalCSS('part.ReturnToHub', null, css);

  const root = document.createElement('div');
  root.className = 'Part-ReturnToHub ReturnToHub';
  root.innerHTML = `
    <button class="ReturnToHub__btn" aria-label="Return to Hub">
      <span class="ReturnToHub__icon">&#127968;</span>
      <span class="ReturnToHub__label">Return to Hub</span>
    </button>
  `;

  host.appendChild(root);

  // Bind click
  const btn = root.querySelector('.ReturnToHub__btn');
  btn.addEventListener('click', () => {
    if (ctx.navigate) {
      ctx.navigate('hub');
    } else {
      location.hash = '#hub';
    }
  });

  return {
    unmount() {
      root.remove();
    },
    update(newData) {},
  };
}
