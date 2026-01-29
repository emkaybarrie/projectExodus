// AvatarDisplay Part — WO-3: Avatar screen main display
// Shows avatar portrait, stats, and skill tree preview

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.AvatarDisplay', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-AvatarDisplay AvatarDisplay';

  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Bind interactions
  bindInteractions(root, ctx);

  // Initial render with demo data
  const renderData = data.avatar ? data : getDemoData();
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
  // Customize button
  const customizeBtn = root.querySelector('[data-action="customize"]');
  if (customizeBtn && ctx.emitter) {
    customizeBtn.addEventListener('click', () => {
      ctx.emitter.emit('openCustomization', {});
    });
  }

  // Skill node clicks
  root.addEventListener('click', (e) => {
    const skill = e.target.closest('[data-skill]');
    if (skill && ctx.emitter) {
      ctx.emitter.emit('skillDetail', { skillId: skill.dataset.skill });
    }
  });
}

function render(root, data) {
  const { avatar = {}, stats = {}, skills = [] } = data;

  // Render portrait
  renderPortrait(root, avatar);

  // Render stats
  renderStats(root, stats);

  // Render skill preview
  renderSkills(root, skills);
}

function renderPortrait(root, avatar) {
  const { name = 'Wanderer', level = 1, xp = 0, xpNext = 100, class: cls = 'Novice' } = avatar;

  const nameEl = root.querySelector('[data-bind="avatarName"]');
  const levelEl = root.querySelector('[data-bind="level"]');
  const classEl = root.querySelector('[data-bind="class"]');
  const xpFill = root.querySelector('.AvatarDisplay__xpFill');
  const xpText = root.querySelector('[data-bind="xpProgress"]');

  if (nameEl) nameEl.textContent = name;
  if (levelEl) levelEl.textContent = `Lv. ${level}`;
  if (classEl) classEl.textContent = cls;

  const xpPercent = xpNext > 0 ? Math.min(100, (xp / xpNext) * 100) : 0;
  if (xpFill) xpFill.style.width = `${xpPercent}%`;
  if (xpText) xpText.textContent = `${xp} / ${xpNext} XP`;
}

function renderStats(root, stats) {
  const statEntries = [
    { key: 'discipline', label: 'Discipline', icon: '&#128170;' },
    { key: 'insight', label: 'Insight', icon: '&#128161;' },
    { key: 'resilience', label: 'Resilience', icon: '&#128737;' },
    { key: 'fortune', label: 'Fortune', icon: '&#127808;' },
  ];

  const statsGrid = root.querySelector('.AvatarDisplay__statsGrid');
  if (!statsGrid) return;

  statsGrid.innerHTML = statEntries.map(({ key, label, icon }) => {
    const value = stats[key] ?? 10;
    return `
      <div class="AvatarDisplay__stat">
        <span class="AvatarDisplay__statIcon">${icon}</span>
        <span class="AvatarDisplay__statLabel">${label}</span>
        <span class="AvatarDisplay__statValue">${value}</span>
      </div>
    `;
  }).join('');
}

function renderSkills(root, skills) {
  const skillsContainer = root.querySelector('.AvatarDisplay__skillTree');
  if (!skillsContainer) return;

  if (skills.length === 0) {
    skills = [
      { id: 'budget-basics', name: 'Budget Basics', unlocked: true, level: 2 },
      { id: 'expense-track', name: 'Expense Tracking', unlocked: true, level: 1 },
      { id: 'savings-init', name: 'Savings Initiative', unlocked: false, level: 0 },
      { id: 'invest-intro', name: 'Investment Intro', unlocked: false, level: 0 },
    ];
  }

  skillsContainer.innerHTML = skills.map(skill => `
    <div class="AvatarDisplay__skillNode ${skill.unlocked ? 'unlocked' : 'locked'}"
         data-skill="${skill.id}">
      <div class="AvatarDisplay__skillIcon">${skill.unlocked ? '&#10003;' : '&#128274;'}</div>
      <div class="AvatarDisplay__skillInfo">
        <span class="AvatarDisplay__skillName">${escapeHtml(skill.name)}</span>
        <span class="AvatarDisplay__skillLevel">${skill.unlocked ? `Lv. ${skill.level}` : 'Locked'}</span>
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getDemoData() {
  return {
    avatar: {
      name: 'Wanderer',
      level: 5,
      xp: 320,
      xpNext: 500,
      class: 'Budgeteer',
    },
    stats: {
      discipline: 14,
      insight: 12,
      resilience: 10,
      fortune: 8,
    },
    skills: [],
  };
}
