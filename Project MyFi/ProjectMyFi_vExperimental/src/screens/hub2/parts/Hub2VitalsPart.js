function q(root, sel){ return root.querySelector(sel); }

function setBar(root, key, bar){
  const el = q(root, `[data-vital="${key}"]`);
  if (!el || !bar) return;
  const fill = q(el, '.bar-fill');
  const value = q(el, '.bar-value');
  const label = q(el, '.bar-label');
  if (fill) fill.style.width = `${(bar.widthPct||0).toFixed(2)}%`;
  if (value) value.textContent = bar.text || '-- / --';
  if (label) label.textContent = bar.label || key;

  el.classList.remove('overspending','underspending');
  if (bar.trend === 'overspending') el.classList.add('overspending');
  if (bar.trend === 'underspending') el.classList.add('underspending');
}

export async function Hub2VitalsPart(host, { ctx }){
  host.innerHTML = `
    <section class="card hub2-vitals">
      <div class="hub2-top">
        <div class="hub2-portrait">
          <img data-el="portrait" class="portrait" src="./assets/portraits/default.png" alt="Avatar Portrait" />
          <div class="meta">
            <div data-el="name" class="name">Player</div>
            <div data-el="level" class="level">Lv 1</div>
          </div>
        </div>
        <div class="hub2-bars">
          <div class="barWrap" data-vital="health">
            <div class="bar-label">Health</div>
            <div class="bar-track"><div class="bar-fill"></div></div>
            <div class="bar-value">-- / --</div>
          </div>
          <div class="barWrap" data-vital="mana">
            <div class="bar-label">Mana</div>
            <div class="bar-track"><div class="bar-fill"></div></div>
            <div class="bar-value">-- / --</div>
          </div>
        </div>
      </div>

      <div class="barWrap wide" data-vital="stamina">
        <div class="bar-label">Stamina</div>
        <div class="bar-track"><div class="bar-fill"></div></div>
        <div class="bar-value">-- / --</div>
      </div>

      <div class="hub2-row">
        <div class="barWrap" data-vital="shield">
          <div class="bar-label">Shield</div>
          <div class="bar-track"><div class="bar-fill"></div></div>
          <div class="bar-value">-- / --</div>
        </div>
        <div class="hub2-total" data-el="total">Total -- / --</div>
      </div>
    </section>
  `;

  const store = ctx?.hub2?.store;
  let unsub = null;

  function render({ vm }){
    if (!vm) return;
    // portrait (scoped)
    const img = q(host, '[data-el="portrait"]');
    const name = q(host, '[data-el="name"]');
    const level = q(host, '[data-el="level"]');
    const total = q(host, '[data-el="total"]');

    if (img) {
      const portraitSrc = (vm?.portraitKey ? `../public/assets/portraits/${vm.portraitKey}.png` : null) || './assets/portraits/default.png';
      img.src = portraitSrc;
    }
    if (name) name.textContent = vm?.alias || vm?.firstName || 'Player';
    if (level) level.textContent = `Lv ${vm?.level || 1}`;

    if (total) {
      const cur = Math.round(vm?.totals?.current || 0).toLocaleString();
      const max = Math.round(vm?.totals?.max || 0).toLocaleString();
      total.textContent = `Total ${cur} / ${max}`;
    }

    setBar(host, 'health', vm?.bars?.health);
    setBar(host, 'mana', vm?.bars?.mana);
    setBar(host, 'stamina', vm?.bars?.stamina);
    setBar(host, 'shield', vm?.bars?.shield);
  }

  if (store?.subscribe) {
    unsub = store.subscribe(render);
  }

  return {
    unmount(){ try { unsub?.(); } catch {} host.innerHTML=''; }
  };
}
