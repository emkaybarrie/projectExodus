// tools/surfaces-studio/modules/toast.js
import { $ } from './dom.js';

let timer = null;

export function toast(msg) {
  const el = $('#toast');
  const body = $('#toastBody');
  if (!el || !body) return;

  body.textContent = String(msg);
  el.hidden = false;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    el.hidden = true;
  }, 1400);
}
