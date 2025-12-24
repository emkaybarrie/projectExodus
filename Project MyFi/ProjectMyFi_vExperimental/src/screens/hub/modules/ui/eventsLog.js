/**
 * Hub UI: Events Log
 * UI-only renderer. Feed items are built by activity feature pack.
 */
import { getFeature } from '../../../../features/registry.js';

export function wireEventsLog(getGateway) {
  const listEl = document.querySelector('[data-el="log-list"]');
  const subEl  = document.querySelector('#events-log-wrapper .log-sub');

  if (!listEl || listEl.__wiredEventsLog) return () => {};
  listEl.__wiredEventsLog = true;

  const activity = getFeature('activity').api;

  function paint(vm, gw) {
    const items = activity.buildFeed(vm, gw);

    listEl.innerHTML = '';
    items.slice(0, 6).forEach(it => {
      const li = document.createElement('li');
      li.className = `log-item tone-${it.tone || 'neutral'}`;
      li.innerHTML = `
        <div class="log-ico">${escapeHtml(it.icon)}</div>
        <div class="log-txt">
          <div class="log-title">${escapeHtml(it.title)}</div>
          <div class="log-body">${escapeHtml(it.body)}</div>
        </div>
      `;
      listEl.appendChild(li);
    });

    if (subEl) subEl.innerHTML = `Active — <span class="muted">${items.length ? 'Updates available' : 'Nothing pending'}</span>`;
  }

  const onUpdated = (e) => {
    const vm = e?.detail?.vm;
    const gw = e?.detail?.gw || getGateway?.();
    paint(vm, gw);
  };

  window.addEventListener('vitals:updated', onUpdated);

  // initial paint
  try { paint(null, getGateway?.()); } catch {}

  return () => {
    window.removeEventListener('vitals:updated', onUpdated);
    try { delete listEl.__wiredEventsLog; } catch {}
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
