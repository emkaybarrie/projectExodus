import { loadScopedCSS } from '../../core/cssScope.js';
import { setHeaderTitle } from '../../core/chrome.js';
import { navigate } from '../../core/router.js';

let unstyle;
export default {
  id:'myana', route:'myana', title:'MYANA',
  chrome:{ mode:'full', footer:{
    left:{icon:'📝', title:'Active'}, main:{icon:'＋', title:'New Entry'}, right:{icon:'🗂', title:'Archive'}
  }},
  background: { key: 'panorama' },   // ← use the panning image mode
  async mount(root){ unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);
    root.innerHTML = `<div class="wrap"><h2>Myana / The Badlands</h2><p>Swipe ↑ to Vitals</p></div>`; },
  onShow() {
    setHeaderTitle('MYANA');
    // later: hook PDM, update essence mini, start listeners
  },
  onHide(){},
  unmount(){ if (unstyle) unstyle(); }
}
