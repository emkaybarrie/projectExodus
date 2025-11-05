// status.js — Status section toggle + live dots from bar trend classes
export function wireVitalsStatusToggle(){
  const box = document.getElementById('vitals-status');
  if (!box || box.__wired) return () => {};
  box.__wired = true;

  const vitalIds = ['health','mana','stamina'];
  const weights  = { health:1, mana:1, stamina:1 };
  const observers = [];

  const onClick = () => {
    const on = box.classList.toggle('is-breakdown');
    box.setAttribute('aria-expanded', on ? 'true' : 'false');
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  };

  box.addEventListener('click', onClick, { passive:true });
  box.addEventListener('keydown', onKey);

  function stateClassFromBar(barEl){
    if (!barEl) return 'is-warn';
    if (barEl.classList.contains('overspending'))   return 'is-bad';
    if (barEl.classList.contains('underspending'))  return 'is-good';
    return 'is-warn';
  }
  function setDot(dot, cls){
    if (!dot) return;
    dot.classList.remove('is-good','is-warn','is-bad');
    dot.classList.add(cls);
  }
  const toScore = (cls) => cls === 'is-good' ? 1 : (cls === 'is-bad' ? -1 : 0);
  function computeSummary(classes){
    const sum = classes.reduce((n,c,i)=> n + (toScore(c) * weights[vitalIds[i]]), 0);
    if (sum >= 1) return { cls:'is-good', label:'Ahead' };
    if (sum <= -1) return { cls:'is-bad',  label:'Off Track' };
    return { cls:'is-warn', label:'On Track' };
  }

  function syncVitalsBreakdown(){
    const classes = [];
    vitalIds.forEach(v => {
      const bar = document.querySelector(`#vital-${v} .bar`);
      const cls = stateClassFromBar(bar);
      const dot = document.querySelector(`.vs-item[data-vital="${v}"] .status-dot`);
      setDot(dot, cls);
      classes.push(cls);
    });

    const { cls, label } = computeSummary(classes);
    setDot(document.querySelector('#vitals-status .vs-overview .status-dot'), cls);
    const overviewText = document.getElementById('vitals-status-text');
    if (overviewText) overviewText.textContent = label;

    const wrap = document.getElementById('vitals-status');
    if (wrap) wrap.title = `H:${classes[0]?.slice(3)} • M:${classes[1]?.slice(3)} • S:${classes[2]?.slice(3)} → ${label}`;
  }

  // Run now and keep in sync when bar trend classes change
  const obsOpts = { attributes: true, attributeFilter: ['class'], subtree: true };
  ['health','mana','stamina'].forEach(v => {
    const root = document.querySelector(`#vital-${v}`);
    if (root) {
      const mo = new MutationObserver(syncVitalsBreakdown);
      mo.observe(root, obsOpts);
      observers.push(mo);
    }
  });

  // Also resync whenever vitals repaint
  const onUpdated = () => syncVitalsBreakdown();
  window.addEventListener('vitals:updated', onUpdated);

  // Initial paint
  if (document.readyState !== 'loading') syncVitalsBreakdown();
  else document.addEventListener('DOMContentLoaded', syncVitalsBreakdown, { once:true });

  // Cleanup
  return () => {
    try{
      box.removeEventListener('click', onClick);
      box.removeEventListener('keydown', onKey);
      window.removeEventListener('vitals:updated', onUpdated);
      observers.forEach(mo => mo.disconnect());
    }catch{}
  };
}
