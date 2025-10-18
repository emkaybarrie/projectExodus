// ui/components/Bars.js
// Expects specific DOM with ids: #vital-health, #vital-mana, #vital-stamina, #vital-shield, #vital-essence
// and inside each: .bar .bar-fill, .bar-value, .bar-label, .bar-surplus.

function getEls() {
  const pools = ["health","mana","stamina","shield","essence"];
  const out = {};
  pools.forEach(p => {
    const root = document.querySelector(`#vital-${p}`);
    if (!root) return;
    out[p] = {
      root,
      bar:   root.querySelector('.bar'),
      fill:  root.querySelector('.bar .bar-fill'),
      value: root.querySelector('.bar-value'),
      label: root.querySelector('.bar-label'),
      pill:  root.querySelector('.bar-surplus'),
    };
  });
  out.total = document.getElementById('vitals-total');
  out.title = document.getElementById('mode-engrave');
  return out;
}

export function renderBars(vm) {
  if (!vm) return;
  const els = getEls();

  // Title
  if (els.title) els.title.setAttribute('data-mode', vm.labels.title);

  // Totals (H/M/S)
  if (els.total) {
    const cur = Math.round(vm.totals.current || 0).toLocaleString();
    const max = Math.round(vm.totals.max || 0).toLocaleString();
    els.total.innerHTML = `<span class="label">Total</span><span class="vital-value">${cur}</span><span class="sep">/</span><span class="vital-max">${max}</span>`;
  }

  // Helper
  const paint = (key, b) => {
    const e = els[key]; if (!e || !b) return;
    if (e.fill)  e.fill.style.width = `${b.widthPct.toFixed(2)}%`;
    if (e.value) e.value.textContent = b.text;
    if (e.label) e.label.textContent = b.label || key;
    if (e.bar) {
      e.bar.classList.remove('overspending','underspending');
      if (b.trend === 'overspending')  e.bar.classList.add('overspending');
      if (b.trend === 'underspending') e.bar.classList.add('underspending');
    }
  };

  paint("health",  vm.bars.health);
  paint("mana",    vm.bars.mana);
  paint("stamina", vm.bars.stamina);
  paint("shield",  vm.bars.shield);
  paint("essence", vm.bars.essence);

  // Surplus pill (Shield only here)
  const sp = vm.pills?.shield;
  if (els.shield?.pill) {
    if (!sp || (!sp.now && !sp.next)) {
      els.shield.pill.style.display = "none";
    } else {
      els.shield.pill.style.display = "inline-flex";
      els.shield.pill.textContent = `+${Math.max(0, Math.floor(sp.now))}`;
    }
  }
}

