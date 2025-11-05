// src/modals/spirit.js
import { open as openModal } from '../core/modal.js';

export function openSpiritMenu(owner='hub') {
  const root = document.createElement('div');
  root.className = 'spirit-menu';
  root.innerHTML = `
    <header class="sp-h">
      <h3 class="sp-title">Spirit</h3>
      <div class="sp-sub">Skill tree (preview)</div>
    </header>

    <nav class="sp-tabs">
      <button class="sp-tab is-active" data-tab="skills">Skills</button>
      <button class="sp-tab" data-tab="rituals">Rituals</button>
      <button class="sp-tab" data-tab="aspects">Aspects</button>
    </nav>

    <section class="sp-panel" data-panel="skills">
      <div class="sp-grid">
        <button class="sp-node" data-node="vital-cap">↑ Vital Caps</button>
        <button class="sp-node" data-node="essence-rate">↑ Essence Rate</button>
        <button class="sp-node" data-node="shield-eff">↑ Shield Efficiency</button>
        <button class="sp-node" data-node="credit-handling">Credit Handling</button>
      </div>
    </section>
    <section class="sp-panel" data-panel="rituals" hidden>
      <p>Rituals (coming soon)</p>
    </section>
    <section class="sp-panel" data-panel="aspects" hidden>
      <p>Aspects (coming soon)</p>
    </section>
  `;

  // Tab switching
  const tabs = [...root.querySelectorAll('.sp-tab')];
  const panels = [...root.querySelectorAll('.sp-panel')];
  function activate(which){
    tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab===which));
    panels.forEach(p => p.hidden = (p.dataset.panel!==which));
  }
  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.tab)));

  // Node click stubs
  root.addEventListener('click', (e) => {
    const n = e.target.closest('.sp-node');
    if (!n) return;
    window.dispatchEvent(new CustomEvent('spirit:nodeSelected', { detail: { node: n.dataset.node }}));
  });

  return openModal({ content: root, owner, scope: 'screen' });
}
