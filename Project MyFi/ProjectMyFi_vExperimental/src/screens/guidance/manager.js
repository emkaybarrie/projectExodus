import { loadScopedCSS } from '../../core/cssScope.js';
import { setHeaderTitle } from '../../core/chrome.js';
import { navigate } from '../../core/router.js';

let unstyle;
export default {
  id:'guidance', route:'guidance', title:'GUIDANCE',
  chrome:{ mode:'full', footer:{
    left:{icon:'🛒', title:'Browse'}, main:{icon:'⭐', title:'Featured'}, right:{icon:'🔎', title:'Search'}
  }},
  background: { key: 'panorama' },   // ← use the panning image mode
  async mount(root){ unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);
    root.innerHTML = `<div class="wrap"><h2>Guidance</h2><p>Swipe ↓ to Vitals</p></div>`; },
  onShow() {
    setHeaderTitle('GUIDANCE');
    // later: hook PDM, update essence mini, start listeners
  },
  onHide(){},
  unmount(){ if (unstyle) unstyle(); }
}
