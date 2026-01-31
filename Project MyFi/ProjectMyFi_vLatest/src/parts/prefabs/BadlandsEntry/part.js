// BadlandsEntry Part — WO-3: Badlands entry screen
// Shows portal graphic, loadout preview, avatar select, and enter button
// Updated: Subscription-based background + Badland_P game launch

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

// Portal background folder
const PORTAL_BG_FOLDER = '../../../../assets/art/badlands-portal/';

// Map subscription level to portal theme
const SUBSCRIPTION_TO_THEME = {
  free: 'frontier',
  silver: 'badlands',
  gold: 'void',
};

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchJSON failed ${res.status} for ${url}`);
  return await res.json();
}

// Load and cache portal manifest
let portalManifest = null;
async function loadPortalManifest(baseUrl) {
  if (portalManifest) return portalManifest;
  try {
    const manifestUrl = new URL(PORTAL_BG_FOLDER + 'manifest.json', baseUrl).href;
    portalManifest = await fetchJSON(manifestUrl);
    return portalManifest;
  } catch (e) {
    console.warn('[BadlandsEntry] Failed to load portal manifest:', e);
    return null;
  }
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

  // Load portal manifest for background selection
  const manifest = await loadPortalManifest(import.meta.url);

  // Bind interactions
  bindInteractions(root, ctx);

  // Initial render with demo data
  const renderData = data.loadout ? data : getDemoData();
  render(root, renderData, manifest, import.meta.url);

  return {
    unmount() {
      root.remove();
    },
    update(newData) {
      render(root, newData, manifest, import.meta.url);
    },
  };
}

function bindInteractions(root, ctx) {
  const { router, emitter } = ctx;

  /**
   * Launch the Badlands game with confirmation
   */
  function launchBadlands() {
    // Show confirmation prompt
    const confirmed = window.confirm(
      '⚡ Enter the Badlands?\n\n' +
      'You are about to travel to the Badlands Runner game.\n\n' +
      'Your progress will be saved when you return.'
    );

    if (confirmed) {
      // Open standalone Badland_P game (up 5 levels to Project MyFi folder)
      const gameUrl = new URL('../../../../../Badland_P/index.html', import.meta.url).href;
      window.open(gameUrl, 'badlands_game', 'width=1280,height=720');
      console.log('[BadlandsEntry] Launching Badland_P game:', gameUrl);
    }
  }

  // Portal card - tap to travel (with confirmation)
  const portalCard = root.querySelector('.BadlandsEntry__portal');
  if (portalCard) {
    portalCard.style.cursor = 'pointer';
    portalCard.addEventListener('click', launchBadlands);
  }

  // Enter Badlands button - opens Badland_P game with confirmation
  const enterBtn = root.querySelector('[data-action="enterBadlands"]');
  if (enterBtn) {
    enterBtn.addEventListener('click', launchBadlands);
  }

  // Loadout edit
  const loadoutBtn = root.querySelector('[data-action="editLoadout"]');
  if (loadoutBtn && emitter) {
    loadoutBtn.addEventListener('click', () => {
      emitter.emit('openLoadout', {});
    });
  }
}

function render(root, data, manifest, baseUrl) {
  const { loadout = {}, avatar = {}, subscriptionLevel = 'free', stats = {}, leaderboard = [] } = data;

  // Render subscription-based background
  renderBackground(root, subscriptionLevel, manifest, baseUrl);

  renderLoadout(root, loadout);
  renderAvatar(root, avatar);
  renderStats(root, stats);
  renderLeaderboard(root, leaderboard);
}

/**
 * Render portal card background based on subscription level
 */
function renderBackground(root, subscriptionLevel, manifest, baseUrl) {
  const portalCard = root.querySelector('.BadlandsEntry__portal');
  if (!portalCard) return;

  // Map subscription to theme
  const theme = SUBSCRIPTION_TO_THEME[subscriptionLevel] || 'frontier';

  // Get background file from manifest (supports PNG)
  let bgFile = 'portal-frontier.png'; // fallback
  if (manifest?.backgrounds?.[theme]) {
    bgFile = manifest.backgrounds[theme].file;
  }

  // Build URL and apply via CSS custom property to the portal card
  const bgUrl = new URL(PORTAL_BG_FOLDER + bgFile, baseUrl).href;
  portalCard.style.setProperty('--portal-bg-url', `url('${bgUrl}')`);

  // Also set theme class for color variations
  portalCard.dataset.portalTheme = theme;

  console.log(`[BadlandsEntry] Portal theme: ${theme} (subscription: ${subscriptionLevel})`);
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

/**
 * Render activity stats
 */
function renderStats(root, stats) {
  const { activePlayers = 0, totalEssence = 0, essenceByRegion = {} } = stats;

  // Active players
  const activePlayersEl = root.querySelector('[data-bind="activePlayers"]');
  if (activePlayersEl) activePlayersEl.textContent = activePlayers.toLocaleString();

  // Total essence
  const totalEssenceEl = root.querySelector('[data-bind="totalEssence"]');
  if (totalEssenceEl) totalEssenceEl.textContent = totalEssence.toLocaleString();

  // Essence by region
  const frontierEl = root.querySelector('[data-bind="essenceFrontier"]');
  const badlandsEl = root.querySelector('[data-bind="essenceBadlands"]');
  const voidEl = root.querySelector('[data-bind="essenceVoid"]');

  if (frontierEl) frontierEl.textContent = (essenceByRegion.frontier || 0).toLocaleString();
  if (badlandsEl) badlandsEl.textContent = (essenceByRegion.badlands || 0).toLocaleString();
  if (voidEl) voidEl.textContent = (essenceByRegion.void || 0).toLocaleString();
}

/**
 * Render leaderboard
 */
function renderLeaderboard(root, leaderboard) {
  const rows = root.querySelectorAll('.BadlandsEntry__leaderRow[data-rank]');

  rows.forEach((row, index) => {
    const entry = leaderboard[index];
    if (!entry) return;

    const nameEl = row.querySelector('.BadlandsEntry__leaderName');
    const scoreEl = row.querySelector('.BadlandsEntry__leaderScore');

    if (nameEl) nameEl.textContent = entry.name;
    if (scoreEl) scoreEl.textContent = entry.score.toLocaleString();
  });
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
    stats: {
      activePlayers: 127,
      totalEssence: 45280,
      essenceByRegion: {
        frontier: 18500,
        badlands: 15780,
        void: 11000,
      },
    },
    leaderboard: [
      { rank: 1, name: 'SavingsKing', score: 984500 },
      { rank: 2, name: 'BudgetNinja', score: 872300 },
      { rank: 3, name: 'FrugalMaster', score: 756100 },
    ],
  };
}
