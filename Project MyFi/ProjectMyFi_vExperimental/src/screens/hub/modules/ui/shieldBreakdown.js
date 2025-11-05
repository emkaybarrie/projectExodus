// shieldBreakdown.js — In-bar H/M/S composition overlay on Shield tap
export function wireShieldBreakdown(getGateway){
  const bar = document.querySelector('#vital-shield .bar');
  if (!bar || bar.__shieldBreakdownWired) return () => {};
  bar.__shieldBreakdownWired = true;

  const fill = bar.querySelector('.bar-fill');
  if (!fill) return () => {};

  const overlay = document.createElement('div');
  overlay.className = 'shield-breakdown';
  fill.appendChild(overlay);

  const HIDE_MS = 1500;
  let timer = null;
  let isOn = false;

  function paint(gw){
    const by = gw?.meta?.escrow?.carry?.bySource || { health:0, mana:0, stamina:0 };
    const h = Math.max(0, +by.health  || 0);
    const m = Math.max(0, +by.mana    || 0);
    const s = Math.max(0, +by.stamina || 0);
    const tot = h + m + s;
    if (!tot){
      overlay.style.opacity = '0';
      overlay.classList.remove('is-visible');
      return;
    }
    const hp = (h / tot) * 100;
    const mp = (m / tot) * 100;
    overlay.style.background = `linear-gradient(90deg,
      var(--health-color, #7f1d1d) 0% ${hp.toFixed(2)}%,
      var(--mana-color,   #164e63) ${hp.toFixed(2)}% ${(hp+mp).toFixed(2)}%,
      var(--stamina-color,#14532d) ${(hp+mp).toFixed(2)}% 100%
    )`;
  }

  function show(){
    paint(getGateway?.());
    overlay.classList.add('is-visible');
    clearTimeout(timer);
    timer = setTimeout(hide, HIDE_MS);
    isOn = true;
  }
  function hide(){
    overlay.classList.remove('is-visible');
    isOn = false;
  }

  const onClick = () => (isOn ? hide() : show());
  bar.addEventListener('click', onClick, { passive:true });

  // Keep correct if gateway refreshes while visible
  const onUpdated = (e) => { if (isOn) paint(e?.detail?.gw || getGateway?.()); };
  window.addEventListener('vitals:updated', onUpdated);

  // Hide on mode switches
  const onModeChange = () => hide();
  window.addEventListener('vitals:viewmode', onModeChange);

  return () => {
    try{
      bar.removeEventListener('click', onClick);
      window.removeEventListener('vitals:updated', onUpdated);
      window.removeEventListener('vitals:viewmode', onModeChange);
      overlay.remove();
    }catch{}
  };
}
