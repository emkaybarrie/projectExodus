// spiritstone-modal.js
import { open as openModal } from '../../core/modal.js';
// import needed helpers from vitals-spirit-menu.js
// (You'll expose them or move them here. For brevity I'll inline the idea.)

export function openSpiritStoneModal(owner='hub', data = {
  essence: 342,
  shards: 12,
  tier: 3,
  chargePct: 0.42,
}) {
  // data.essence, data.shards, data.tier, data.chargePct etc.
  // In real app you'll pull from vitals HUD state.

  const cardWrap = document.createElement('div');
  cardWrap.style.display = 'grid';
  cardWrap.style.gridTemplateRows = '1fr auto';
  cardWrap.style.maxHeight = '80vh';
  cardWrap.style.minWidth = 'min(480px,92vw)';
  cardWrap.style.maxWidth = '92vw';
  cardWrap.style.color = '#fff';
  cardWrap.style.padding = '16px';
  cardWrap.style.gap = '12px';

  const head = document.createElement('div');
  head.style.display = 'flex';
  head.style.justifyContent = 'space-between';
  head.style.alignItems = 'flex-start';
  head.innerHTML = `
    <div>
      <div style="font-family:'Cinzel',serif;font-size:16px;letter-spacing:.06em;">Spirit Stone</div>
      <div style="font-size:12px;opacity:.7;">Channel, spend, shards</div>
    </div>
  `;

  const body = document.createElement('div');
  body.style.minHeight = '200px';
  body.style.maxHeight = '50vh';
  body.style.overflow = 'auto';
  body.style.display = 'grid';
  body.style.gap = '12px';

  // placeholder markup: you'll drop in the real Spirit Stone card HTML
  body.innerHTML = `
    <div style="font-size:14px;opacity:.8;">
      (Spirit Stone UI placeholder – port vitals-spirit-menu.js panels here)
    </div>
  `;

  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'space-between';
  footer.style.flexWrap = 'wrap';
  footer.style.gap = '8px';
  footer.style.paddingTop = '8px';
  footer.style.borderTop = '1px solid rgba(255,255,255,.08)';
  footer.innerHTML = `
    <button id="spirit-reset"
      style="border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font-size:14px;padding:8px 12px;cursor:pointer;">
      Reset
    </button>
    <button id="spirit-confirm"
      style="border-radius:10px;border:1px solid rgba(120,140,255,.4);background:rgba(120,140,255,.15);box-shadow:0 0 12px rgba(120,140,255,.4);color:#fff;font-size:14px;padding:8px 12px;font-weight:600;cursor:pointer;">
      Confirm
    </button>
    <button id="spirit-close"
      style="margin-left:auto;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font-size:14px;padding:8px 12px;cursor:pointer;">
      Close
    </button>
  `;

  cardWrap.append(head, body, footer);

  const ref = openModal({
    owner,
    scope: 'screen',
    content: cardWrap
  });

  const closeBtn = cardWrap.querySelector('#spirit-close');
  closeBtn.addEventListener('click', () => ref.close());

  // Wire Reset / Confirm events to the spirit stone logic here.
  cardWrap.querySelector('#spirit-reset')?.addEventListener('click', () => {
    // fire spirit:footer:reset style event, etc.
    console.log('[SpiritStone] reset requested');
  });

  cardWrap.querySelector('#spirit-confirm')?.addEventListener('click', () => {
    // fire spirit:footer:confirm style event, etc.
    console.log('[SpiritStone] confirm requested');
  });
}
