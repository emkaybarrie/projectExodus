async function loadHTML() {
  const res = await fetch(new URL('./baseline.html', import.meta.url));
  return res.text();
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
