// tools/surfaces-studio/modules/liveHooks.js
import { $ } from './dom.js';
import { toast } from './toast.js';

export function initLiveHooks(state) {
  const pill = $('#pillLive');
  const btn = $('#btnTryLive');

  function updatePill() {
    if (!pill) return;
    pill.innerHTML = `Live VM: <b>${state.liveConnected ? 'on' : 'off'}</b>`;
    pill.style.borderColor = state.liveConnected ? 'rgba(52,211,153,.45)' : 'rgba(255,255,255,.12)';
  }

  btn?.addEventListener('click', () => {
    try {
      // Look for a running dev page in the same tab (common approach: open studio in a separate tab and use postMessage later)
      // For MVP, we just check if this page has the hook.
      const dev = window.__DEV__?.surfaces;
      if (dev) {
        state.liveConnected = true;
        updatePill();
        toast('Live hook detected (same tab)');
      } else {
        state.liveConnected = false;
        updatePill();
        toast('No live hook found in this tab');
      }
    } catch (e) {
      state.liveConnected = false;
      updatePill();
      toast('Live hook check failed');
    }
  });

  updatePill();
}
