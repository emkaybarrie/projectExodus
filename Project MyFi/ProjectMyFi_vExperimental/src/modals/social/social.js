// social-modal.js
import { open as openModal } from '../../core/modal.js';
// import and reuse code from socialMenu.js
// We'll assume you split socialMenu.js so you can call buildSocialHome(rootEl)
// which populates rootEl and returns {cleanup}

export async function openSocialModal(owner='hub') {
  // Build wrapper for body + footer
  const cardWrap = document.createElement('div');
  cardWrap.style.display = 'grid';
  cardWrap.style.gridTemplateRows = '1fr auto';
  cardWrap.style.maxHeight = '80vh';
  cardWrap.style.minWidth = 'min(420px,90vw)';
  cardWrap.style.maxWidth = '90vw';
  cardWrap.style.color = '#fff';
  cardWrap.style.padding = '16px';
  cardWrap.style.gap = '12px';

  // Header
  const head = document.createElement('div');
  head.style.display = 'flex';
  head.style.justifyContent = 'space-between';
  head.style.alignItems = 'flex-start';
  head.innerHTML = `
    <div>
      <div style="font-family:'Cinzel',serif;font-size:16px;letter-spacing:.06em;">Social</div>
      <div style="font-size:12px;opacity:.7;">Friends, community, requests</div>
    </div>
  `;

  // Body
  const body = document.createElement('div');
  body.style.minHeight = '200px';
  body.style.maxHeight = '50vh';
  body.style.overflow = 'auto';
  body.style.display = 'grid';
  body.style.gap = '12px';

  // Footer
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.gap = '8px';
  footer.style.paddingTop = '8px';
  footer.style.borderTop = '1px solid rgba(255,255,255,.08)';
  footer.innerHTML = `
    <button id="social-close"
      style="border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font-size:14px;padding:8px 12px;cursor:pointer;">
      Close
    </button>
  `;

  cardWrap.append(head, body, footer);

  // Open modal
  const ref = openModal({
    owner,
    scope: 'screen',
    content: cardWrap
  });

  // Hydrate the social UI into `body`
  // This is where you adapt socialHomeRender() from socialMenu.js into a function
  // that takes (bodyEl, {onUpdateFooter}) and fills in tabs, lists, etc.
  // For now: placeholder
  body.innerHTML = `<div style="opacity:.8;font-size:14px;">(Social list placeholder – port socialMenu.js here)</div>`;

  // Close
  const closeBtn = cardWrap.querySelector('#social-close');
  closeBtn.addEventListener('click', () => ref.close());
}
