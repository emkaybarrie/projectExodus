import { on } from '../_shared/dom.js';

const PART_ID = 'Button';

async function loadHTML() {
  const url = new URL('./baseline.html', import.meta.url);
  const res = await fetch(url);

  if (!res.ok) {
    console.warn(`[${PART_ID}] baseline.html failed to load (${res.status}):`, url.href);
    return `<div class="ui-btn">Missing baseline.html for ${PART_ID}</div>`;
  }

  const html = await res.text();

  // CONTRACT validation MUST come after this line
  if (!html.includes('CONTRACT:BEGIN') || !html.includes('CONTRACT:END')) {
    console.warn(`[${PART_ID}] baseline.html missing CONTRACT markers`);
  }

  return html;
}

export default {
  id: 'Button',
  variants: ['default'],

  mount({ el, props, slice, emit }) {
    let off = null;

    function render() {
      const btn = el.querySelector('[data-role="btn"]') || el.querySelector('button');
      if (!btn) return;

      btn.textContent = props?.label ?? slice?.label ?? 'Button';
      btn.disabled = !!props?.disabled;

      off?.();
      off = on(btn, 'click', (ev) => {
        ev.preventDefault();
        emit('press', { id: props?.id });
      });
    }

    loadHTML().then(html => {
      el.innerHTML = html;
      render();
    });

    return {
      update({ props: nextProps, slice: nextSlice }) {
        props = nextProps;
        slice = nextSlice;
        render();
      },
      unmount() {
        off?.();
        off = null;
      }
    };
  }
};
