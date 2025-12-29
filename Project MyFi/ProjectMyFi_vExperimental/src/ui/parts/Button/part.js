import { on } from '../_shared/dom.js';

async function loadHTML() {
  const res = await fetch(new URL('./baseline.html', import.meta.url));
  return res.text();
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
