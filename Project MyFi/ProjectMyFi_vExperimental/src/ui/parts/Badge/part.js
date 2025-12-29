const PART_ID = 'Badge';

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
  id: 'Badge',
  variants: ['default'],

  mount({ el, props, slice }) {
    function render() {
      const b = el.querySelector('[data-role="badge"]') || el;
      b.textContent = props?.text ?? slice?.text ?? '';
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
