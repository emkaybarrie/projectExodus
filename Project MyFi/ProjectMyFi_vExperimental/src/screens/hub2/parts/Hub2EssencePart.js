function q(root, sel){ return root.querySelector(sel); }

export async function Hub2EssencePart(host, { ctx }){
  host.innerHTML = `
    <section class="card hub2-essence">
      <div class="card-hd"><h3>Essence</h3><span class="muted">(scoped render)</span></div>
      <div class="barWrap wide" data-vital="essence">
        <div class="bar-label">Essence</div>
        <div class="bar-track"><div class="bar-fill"></div></div>
        <div class="bar-value">-- / --</div>
      </div>
    </section>
  `;

  const store = ctx?.hub2?.store;
  let unsub = null;

  function render({ vm }){
    const bar = vm?.bars?.essence;
    const wrap = q(host, '[data-vital="essence"]');
    if (!wrap || !bar) return;
    const fill = q(wrap, '.bar-fill');
    const val = q(wrap, '.bar-value');
    if (fill) fill.style.width = `${(bar.widthPct||0).toFixed(2)}%`;
    if (val) val.textContent = bar.text || '-- / --';
  }

  if (store?.subscribe) unsub = store.subscribe(render);

  return { unmount(){ try { unsub?.(); } catch {} host.innerHTML=''; } };
}
