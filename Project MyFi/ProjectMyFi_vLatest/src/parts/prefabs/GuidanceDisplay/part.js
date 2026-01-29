// GuidanceDisplay Part — WO-3: Guidance screen main display
// Shows partner tiles, resources, and financial guidance disclaimer

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.GuidanceDisplay', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-GuidanceDisplay GuidanceDisplay';

  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Bind interactions
  bindInteractions(root, ctx);

  // Initial render with demo data
  const renderData = data.partners ? data : getDemoData();
  render(root, renderData);

  return {
    unmount() {
      root.remove();
    },
    update(newData) {
      render(root, newData);
    },
  };
}

function bindInteractions(root, ctx) {
  // Partner tile clicks
  root.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-partner]');
    if (tile && ctx.emitter) {
      ctx.emitter.emit('partnerDetail', { partnerId: tile.dataset.partner });
    }

    const resource = e.target.closest('[data-resource]');
    if (resource && ctx.emitter) {
      ctx.emitter.emit('resourceOpen', { resourceId: resource.dataset.resource });
    }
  });
}

function render(root, data) {
  const { partners = [], resources = [] } = data;

  renderPartners(root, partners);
  renderResources(root, resources);
}

function renderPartners(root, partners) {
  const container = root.querySelector('.GuidanceDisplay__partners');
  if (!container) return;

  container.innerHTML = partners.map(partner => `
    <div class="GuidanceDisplay__partnerTile" data-partner="${partner.id}">
      <div class="GuidanceDisplay__partnerIcon">${partner.icon || '&#127970;'}</div>
      <div class="GuidanceDisplay__partnerInfo">
        <span class="GuidanceDisplay__partnerName">${escapeHtml(partner.name)}</span>
        <span class="GuidanceDisplay__partnerType">${escapeHtml(partner.type)}</span>
      </div>
      <div class="GuidanceDisplay__partnerStatus ${partner.connected ? 'connected' : ''}">
        ${partner.connected ? 'Connected' : 'Connect'}
      </div>
    </div>
  `).join('');
}

function renderResources(root, resources) {
  const container = root.querySelector('.GuidanceDisplay__resources');
  if (!container) return;

  container.innerHTML = resources.map(resource => `
    <div class="GuidanceDisplay__resource" data-resource="${resource.id}">
      <span class="GuidanceDisplay__resourceIcon">${resource.icon || '&#128218;'}</span>
      <span class="GuidanceDisplay__resourceTitle">${escapeHtml(resource.title)}</span>
    </div>
  `).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getDemoData() {
  return {
    partners: [
      { id: 'bank', name: 'Bank Connect', type: 'Financial Institution', icon: '&#127974;', connected: false },
      { id: 'advisor', name: 'Advisor Hub', type: 'Financial Guidance', icon: '&#129309;', connected: false },
      { id: 'tools', name: 'Money Tools', type: 'Calculators & Planning', icon: '&#128200;', connected: true },
    ],
    resources: [
      { id: 'budgeting-101', title: 'Budgeting 101', icon: '&#128218;' },
      { id: 'savings-tips', title: 'Savings Tips', icon: '&#128161;' },
      { id: 'debt-management', title: 'Debt Management', icon: '&#128176;' },
      { id: 'investment-basics', title: 'Investment Basics', icon: '&#128200;' },
    ],
  };
}
