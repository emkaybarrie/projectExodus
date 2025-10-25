import { loadScopedCSS } from '../../core/cssScope.js';
import { injectView } from '../../core/view.js';
import { navigate } from '../../core/router.js';

let unstyle;
let cleanup = [];

function addCleanup(fn){ cleanup.push(fn); }

function playIntroAnimation(root){
  const intro = document.getElementById('intro');
  const fire  = document.getElementById('fire');
  const smoke = document.getElementById('smoke');
  const rays  = document.getElementById('rays');
  const pulse = document.getElementById('pulse');
  const wrap  = root.querySelector('.wrap');   // NEW

  let introStarted = false;

  const removeUnblock = () => {
    document.removeEventListener('click', onFirstInteract, opts);
  };
  const opts = { once: true };

  const markStarted = () => {
    if (!introStarted) {
      introStarted = true;
      removeUnblock();
    }
  };

  const tryPlayIntro = () => {
    if (!intro) return;
    if (!intro.paused || intro.currentTime > 0) { markStarted(); return; }
    intro.play().then(markStarted).catch(() => {});
  };

  const onFirstInteract = () => {
    if (!introStarted && intro?.paused) {
      intro.play().then(markStarted).catch(()=>{});
    } else {
      markStarted();
    }
  };
  document.addEventListener('click', onFirstInteract, opts);
  addCleanup(removeUnblock);

  const onIntroEnded = () => {
    [fire, smoke, rays, pulse].forEach(v => { if (v){ v.currentTime = 0; v.play().catch(()=>{}); } });
    // was: root.classList.add('ready');
    wrap?.classList.add('ready');             // NEW: put .ready on the inner wrapper so scoped CSS matches
    if (intro) {
      intro.classList.add('hidden');
      intro.pause();
    }
  };
  intro?.addEventListener('ended', onIntroEnded, { once: true });
  addCleanup(() => intro?.removeEventListener('ended', onIntroEnded));

  tryPlayIntro();
  const onPlaying = () => markStarted();
  intro?.addEventListener('playing', onPlaying, { once: true });
  addCleanup(() => intro?.removeEventListener('playing', onPlaying));
}
function wireScreen(root){
  const cta = document.getElementById('cta');

  // Tap anywhere on the screen to proceed (matches legacy)
  const onProceed = async () => {
    cta?.classList.add('leaving');
    setTimeout(() => navigate('auth'), 260);
  };
  root.addEventListener('click', onProceed);
  addCleanup(() => root.removeEventListener('click', onProceed));
}

export default {
  id: 'start',
  route: 'start',
  chrome: { mode: 'none' },
  background: { key: 'emberward' }, 

  async mount(root) {
    // 1) Scoped CSS
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);
    // 2) Screen body
    await injectView(root, new URL('./view.html', import.meta.url));
    // 3) Wire Actions
    wireScreen(root)
    // 4) Render
    playIntroAnimation(root)

  },

  onShow(){},
  onHide(){},

  unmount() {
    cleanup.forEach(fn => { try{ fn(); } catch{} });
    cleanup = [];
    if (unstyle) unstyle();
    // Ensure screen-local class is removed when leaving
    // (if we ever mounted but didn’t reach the 'ended' phase)
    // Not strictly necessary, but keeps DOM tidy on remounts.
  }
};
