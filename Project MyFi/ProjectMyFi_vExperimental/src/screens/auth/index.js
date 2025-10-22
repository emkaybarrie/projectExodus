import { loadScopedCSS } from '../../core/cssScope.js';
import { injectView } from '../../core/view.js';
import { loginUser, signupUser } from '../../../../js/core/auth.js';

let unstyle;
let cleanup = [];
const addCleanup = fn => cleanup.push(fn);

// Render
function keepLoopsPlaying(root) {
  const wrap  = root.querySelector('.wrap');
  const loops = ['#fire','#smoke','#rays','#pulse']
    .map(sel => root.querySelector(sel))
    .filter(Boolean);

  // Show the motion layers
  wrap?.classList.add('ready');

  // Ensure they actually play (SPA insert timing)
  const playAll = () => loops.forEach(v => { v.currentTime = 0; v.play().catch(()=>{}); });
  playAll();

  // Resume if tab visibility changes (matches legacy script)
  const onVis = () => { if (!document.hidden) playAll(); };
  document.addEventListener('visibilitychange', onVis);
  addCleanup(() => document.removeEventListener('visibilitychange', onVis));
}

// Wiring
function wireTabsAndTooltips(root) {
  const loginTab  = root.querySelector('#login-tab');
  const signupTab = root.querySelector('#signup-tab');
  const loginCard = root.querySelector('#login-form');
  const signupCard= root.querySelector('#signup-form');

  const showLogin = () => {
    loginCard.style.display = 'flex';
    signupCard.style.display = 'none';
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
  };
  const showSignup = () => {
    loginCard.style.display = 'none';
    signupCard.style.display = 'flex';
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
  };

  loginTab.addEventListener('click', showLogin);
  signupTab.addEventListener('click', showSignup);
  addCleanup(() => { loginTab.removeEventListener('click', showLogin); signupTab.removeEventListener('click', showSignup); });

  // Tooltips
  const fields = Array.from(root.querySelectorAll('.field'));
  const closeAll = (exceptBtn=null) => {
    fields.forEach(f => {
      const btn = f.querySelector('.info-btn');
      f.classList.remove('show-tip');
      if (btn && btn !== exceptBtn) btn.setAttribute('aria-expanded','false');
    });
  };
  const onDocClick = (e) => {
    const btn = e.target.closest('.info-btn');
    if (!btn) { closeAll(); return; }
    const field = btn.closest('.field');
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    closeAll(btn);
    btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    field.classList.toggle('show-tip', !expanded);
  };
  const onEsc = (e) => { if (e.key === 'Escape') closeAll(); };

  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onEsc);
  addCleanup(() => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onEsc);
  });

  showLogin(); // default
}

function wireAuth(root) {
  const loginBtn   = root.querySelector('#login-btn');
  const emailIn    = root.querySelector('#login-email');
  const passIn     = root.querySelector('#login-password');
  const buildTgl   = root.querySelector('#build-toggle');

  const signupForm = root.querySelector('#signup-form-element');
  const sEmail     = root.querySelector('#signup-email');
  const sPass      = root.querySelector('#signup-password');
  const sFirst     = root.querySelector('#firstName');
  const sLast      = root.querySelector('#lastName');

  // Restore last chosen build
  try {
    const last = localStorage.getItem('lastBuildVariant');
    if (last) buildTgl.checked = (last === 'experimental');
  } catch {}

  const onLogin = async () => {
    const email = emailIn.value.trim();
    const pass  = passIn.value;
    const variant = buildTgl?.checked ? 'experimental' : 'stable';
    if (!email || !pass) { alert('Please enter both email and password.'); return; }
    await loginUser(email, pass, { variant }); // redirects internally
  };
  loginBtn.addEventListener('click', onLogin);
  addCleanup(() => loginBtn.removeEventListener('click', onLogin));

  const onSignup = async (e) => {
    e.preventDefault();
    const data = {
      email: sEmail.value.trim(),
      password: sPass.value,
      firstName: sFirst.value.trim(),
      lastName: sLast.value.trim(),
    };
    if (!data.email || !data.password || !data.firstName || !data.lastName) {
      alert('Please fill all fields.'); return;
    }
    await signupUser(data);
  };
  signupForm.addEventListener('submit', onSignup);
  addCleanup(() => signupForm.removeEventListener('submit', onSignup));
}

export default {
  id: 'auth',
  route: 'auth',
  chrome: { mode: 'none' },
  background: { key: 'emberward' },

  async mount(root) {
    // 1) Scoped CSS
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);
    // 2) Screen body
    await injectView(root, new URL('./view.html', import.meta.url));
    // 3) Wire Actions
    wireTabsAndTooltips(root);
    // wireAuth(root);
    root.addEventListener('click', () => { window.dispatchEvent(new CustomEvent('demo:login')); });
    // 4) Render
    keepLoopsPlaying(root);

  },

  unmount() {
    cleanup.forEach(fn => { try{ fn(); } catch {} });
    cleanup = [];
    if (unstyle) unstyle();
  }
};
