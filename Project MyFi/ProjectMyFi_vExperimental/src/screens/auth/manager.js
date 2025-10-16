import { loadScopedCSS } from '../../core/cssScope.js';

let unstyle;

export default {
  id: 'auth',
  route: 'auth',
  chrome: { mode: 'none' },
  background: { key: 'title' },

  async mount(root) {
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);
    root.innerHTML = `
      <div class="auth-wrap">
        <h2>Welcome back</h2>
        <button class="btn" id="demo-login">Sign in (Demo)</button>
      </div>`;
    root.querySelector('#demo-login').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('demo:login'));
    });
  },
  onShow(){}, onHide(){},
  unmount(){ if (unstyle) unstyle(); }
};
