import { clamp } from '../_shared/dom.js';

async function loadHTML() {
  const res = await fetch(new URL('./baseline.html', import.meta.url));
  return res.text();
}

export default {
  id: 'ProgressBar',
  variants: ['default'],

  mount({ el, props, slice }) {
    function render() {
      const p = slice || props?.progress || { current: 0, max: 1, label: '' };
      const current = Number(p.current ?? 0);
      const max = Number(p.max ?? 1);
      const pct = max > 0 ? clamp((current / max) * 100, 0, 100) : 0;

      const wrap = el.querySelector('[data-role="wrap"]');
      const bar = el.querySelector('[data-role="bar"]');
      const label = el.querySelector('[data-role="label"]');

      if (!wrap || !bar || !label) return;

      wrap.style.display = 'block';

      // baseline bar styling
      bar.style.height = '12px';
      bar.style.borderRadius = '999px';
      bar.style.border = '1px solid var(--ui-line)';
      bar.style.background = `linear-gradient(90deg, var(--ui-accent) ${pct}%, var(--ui-surface) ${pct}%)`;

      label.textContent = p.label || `${current} / ${max}`;
      label.style.fontSize = '12px';
      label.style.color = 'var(--ui-muted)';
      label.style.marginTop = '6px';
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
      unmount() {}
    };
  }
};
