// Load a CSS file and scope all selectors under a screen root id.
export async function loadScopedCSS(url, rootId) {
  const res = await fetch(url, { cache: 'no-cache' });
  const css = await res.text();

  // naive but effective scoper: prefix simple rules
  const scoped = css.replace(/(^|\})\s*([^{@}][^{]*)\{/g, (m, close, sel) => {
    // allow :root and @ rules to pass
    if (sel.includes(':root')) return m;
    return `${close} #${rootId} ${sel}{`;
  });

  const tag = document.createElement('style');
  tag.setAttribute('data-scoped', rootId);
  tag.textContent = scoped;
  document.head.appendChild(tag);
  return () => tag.remove();
}
