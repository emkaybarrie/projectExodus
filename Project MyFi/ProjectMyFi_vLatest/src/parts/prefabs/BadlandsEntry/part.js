// BadlandsEntry Part — WO-3: Badlands entry screen
// Shows portal graphic, loadout preview, avatar select, and enter button

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.BadlandsEntry', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-BadlandsEntry BadlandsEntry';

  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Bind interactions
  bindInteractions(root, ctx);

  // Initial render with demo data
  const renderData = data.loadout ? data : getDemoData();
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
  const { router, emitter } = ctx;

  // Enter Badlands button - navigate to hub where the game is
  const enterBtn = root.querySelector('[data-action="enterBadlands"]');
  if (enterBtn) {
    enterBtn.addEventListener('click', () => {
      if (router && router.navigate) {
        router.navigate('hub');
      } else if (emitter) {
        emitter.emit('navigate', { screen: 'hub' });
      }
    });
  }

  // Loadout edit
  const loadoutBtn = root.querySelector('[data-action="editLoadout"]');
  if (loadoutBtn && emitter) {
    loadoutBtn.addEventListener('click', () => {
      emitter.emit('openLoadout', {});
    });
  }
}

function render(root, data) {
  const { loadout = {}, avatar = {} } = data;

  renderLoadout(root, loadout);
  renderAvatar(root, avatar);
}

function renderLoadout(root, loadout) {
  const { weapon = 'Starter Blade', armor = 'Basic Cloth', charm = 'None' } = loadout;

  const weaponEl = root.querySelector('[data-bind="weapon"]');
  const armorEl = root.querySelector('[data-bind="armor"]');
  const charmEl = root.querySelector('[data-bind="charm"]');

  if (weaponEl) weaponEl.textContent = weapon;
  if (armorEl) armorEl.textContent = armor;
  if (charmEl) charmEl.textContent = charm;
}

function renderAvatar(root, avatar) {
  const { name = 'Wanderer', level = 1, class: cls = 'Budgeteer' } = avatar;

  const nameEl = root.querySelector('[data-bind="avatarName"]');
  const detailEl = root.querySelector('[data-bind="avatarDetail"]');

  if (nameEl) nameEl.textContent = name;
  if (detailEl) detailEl.textContent = `Lv. ${level} ${cls}`;
}

function getDemoData() {
  return {
    loadout: {
      weapon: 'Discipline Edge',
      armor: 'Saver\'s Mail',
      charm: 'Focus Gem',
    },
    avatar: {
      name: 'Wanderer',
      level: 5,
      class: 'Budgeteer',
    },
  };
}
