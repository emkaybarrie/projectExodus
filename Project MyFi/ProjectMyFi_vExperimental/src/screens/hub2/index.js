import { createController } from './controller.js';

export default {
  id: 'hub2',
  title: 'Hub (JSON-first)',
  chrome: { mode: 'dashboard' },
  background: { key: 'default' },
  mount(root, ctx) {
    const c = createController();
    root.__controller = c;
    return c.mount(root, ctx);
  },
  onShow() { try { this.__controller?.onShow?.(); } catch {} },
  onHide() { try { this.__controller?.onHide?.(); } catch {} },
  unmount() { try { this.__controller?.unmount?.(); } catch {} }
};
