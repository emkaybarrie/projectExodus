import { loadScopedCSS } from '../../core/cssScope.js';

let unstyle;

export default {
  id: 'start',
  route: 'start',
  chrome: { mode: 'none' },
  background: { key: 'title' }, 

  async mount(root) {
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);
    root.innerHTML = `
      <div class="start-wrap">
        <div class="logo">MYFI</div>
        <div class="hint">Tap to start</div>
      </div>`;
    root.addEventListener('click', () => this.proceed());
  },

  onShow(){},
  onHide(){},

  proceed() {
    // play video/intro here; for now just go to auth
    import('../../core/router.js').then(({ navigate }) => navigate('auth'));
  },

  unmount(){ if (unstyle) unstyle(); }
};
