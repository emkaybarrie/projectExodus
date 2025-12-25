import { setHeaderTitle } from '../../core/chrome.js';
import { createController } from './controller.js';

let c;

export default {
  id: 'guidance',
  route: 'guidance',
  title: 'GUIDANCE',
  chrome: {
    mode: 'full',
    footer: {
      left:  { icon:'🏁', title:'Active',    onClick(){ alert('Active Quests'); } },
      main:  { icon:'＋', title:'New Goal',  onClick(){ alert('Create Goal'); } },
      right: { icon:'📚', title:'Completed', onClick(){ alert('Completed'); } },
    }
  },
  background: { key: 'panorama' },

  async mount(root) {
    c = createController();
    await c.mount(root);
  },
  onShow() {
    setHeaderTitle('GUIDANCE');
    c?.onShow?.();
  },
  onHide() {
    c?.onHide?.();
  },
  unmount() {
    c?.unmount?.();
    c = null;
  }
};
