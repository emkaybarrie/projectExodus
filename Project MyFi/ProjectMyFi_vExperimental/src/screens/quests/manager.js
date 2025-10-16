import { loadScopedCSS } from '../../core/cssScope.js';
import { setHeaderTitle } from '../../core/chrome.js';
import { navigate } from '../../core/router.js';

let unstyle;
export default {
  id: 'quests',
  route: 'quests',
  title: 'QUESTS',
  chrome: {
    mode: 'full',
    footer: {
      left:  { icon:'🏁', title:'Active',   onClick(){ alert('Active Quests'); } },
      main:  { icon:'＋', title:'New Goal', onClick(){ alert('Create Goal'); } },
      right: { icon:'📚', title:'Completed',onClick(){ alert('Completed'); } },
    }
  },
  background: { key: 'panorama' },   // ← use the panning image mode
  async mount(root){
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);
    root.innerHTML = `<div class="wrap"><h2>Quests</h2><p>Swipe → to Vitals</p></div>`;
  },
  onShow() {
    setHeaderTitle('QUESTS');
    // later: hook PDM, update essence mini, start listeners
  },
  onHide(){},
  unmount(){ if (unstyle) unstyle(); }
}
