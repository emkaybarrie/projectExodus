// tools/surfaces-studio/modules/tabs.js
import { $$ } from './dom.js';

export function initTabs(state) {
  const tabs = $$('.tab');
  const pages = $$('.panelPage');

  function activate(tabName) {
    tabs.forEach(t => t.classList.toggle('isOn', t.dataset.tab === tabName));
    pages.forEach(p => p.classList.toggle('isOn', p.dataset.page === tabName));
    state.emit('tabChanged', tabName);
  }

  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.tab)));

  // Default to layout
  activate('layout');
}
