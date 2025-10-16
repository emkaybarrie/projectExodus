import { loadScopedCSS } from '../../core/cssScope.js';
import { setHeaderTitle } from '../../core/chrome.js';
import { navigate } from '../../core/router.js'; // add this import

let unstyle;

export default {
  id: 'vitals',
  route: 'vitals',
  title: 'VITALS',
    chrome: {
    mode: 'full',
    footer: {
        left:  { icon:'⚡', title:'Energy',  onClick(){ navigate('quests'); } },
        main:  { icon:'⦿', title:'Essence', onClick(){ alert('Essence menu'); } },
        right: { icon:'🕘', title:'Log',     onClick(){ navigate('avatar'); } }
    }
    },
  background: { key: 'panorama' },   // ← use the panning image mode

  async mount(root) {
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);
    root.innerHTML = `
      <div class="screen scrollable">
        <section class="hero card">
          <div class="avatar"></div>
          <div class="stats">
            <div class="line"><span>HEALTH</span><b>72 / 276</b></div>
            <div class="line"><span>MANA</span><b>64 / 415</b></div>
            <div class="line"><span>STAMINA</span><b>177 / 691</b></div>
          </div>
        </section>

        <section class="shield card">
          <div class="row">
            <span>SHIELD</span>
            <b>0 / 1,382</b>
          </div>
          <div class="status">Status: <em>Off Track</em></div>
          <div class="bar"><div class="fill" style="width:0%"></div></div>
        </section>

        <section class="skills card">
          <h3>Skills</h3>
          <div class="grid">
            <button class="slot locked" title="Locked"></button>
            <button class="slot locked" title="Locked"></button>
            <button class="slot locked" title="Locked"></button>
            <button class="slot locked" title="Locked"></button>
          </div>
        </section>

        <section class="log card">
          <div class="log-header">
            <h3>Event Log</h3>
            <div class="actions">
              <button class="btn small" data-act="add">＋</button>
              <button class="btn small" data-act="filter">☰</button>
            </div>
          </div>
          <div class="log-sub">Active — <span class="muted">Nothing pending</span></div>
          <ul class="log-list" data-el="log-list"></ul>
        </section>

        <div class="pad-bottom"></div>
      </div>
    `;
  },

  onShow() {
    setHeaderTitle('VITALS');
    // later: hook PDM, update essence mini, start listeners
  },
  onHide(){},
  unmount(){ if (unstyle) unstyle(); }
};
