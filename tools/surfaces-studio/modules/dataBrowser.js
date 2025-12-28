// tools/surfaces-studio/modules/dataBrowser.js
import { $, $$ } from './dom.js';
import { toast } from './toast.js';

/**
 * Data Browser (VM Explorer)
 * - Connects to a running project tab (dev) via window.__DEV__.surfaces
 * - Shows full VM or a slice via dot-path (slicePath)
 */
export function initDataBrowser(state) {
  const btnTryLive = $('#btnTryLive');
  const pillLive   = $('#pillLive');

  const btnRefresh = $('#btnRefreshVM');
  const btnCopy    = $('#btnCopyVM');
  const sliceInp   = $('#slicePath');
  const vmBox      = $('#vmBox');

  if (!btnRefresh || !btnCopy || !sliceInp || !vmBox) return;

  // local cache
  let liveConnected = false;
  let liveHandle = null; // { getVM(): any } or similar
  let lastVM = {};       // whatever we last loaded

  // --- helpers ---

  function setLivePill(on) {
    if (!pillLive) return;
    pillLive.innerHTML = `Live VM: <b>${on ? 'on' : 'off'}</b>`;
    pillLive.style.borderColor = on ? 'rgba(52,211,153,.35)' : 'rgba(255,255,255,.12)';
  }

  function safeJson(obj) {
    try { return JSON.stringify(obj, null, 2); }
    catch { return '"<unserializable>"'; }
  }

  function getByPath(obj, path) {
    if (!path) return obj;
    const parts = String(path).split('.').map(s => s.trim()).filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  async function copyText(s) {
    try {
      await navigator.clipboard.writeText(s);
      toast('Copied');
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = s;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Copied');
    }
  }

  // --- live connect ---

  function tryConnectLive() {
    const dev = window.__DEV__;
    const surfaces = dev?.surfaces;

    // We support a few shapes:
    // 1) surfaces.getVM(): returns full VM
    // 2) surfaces.vm: object
    // 3) surfaces.getSurfaceVM(type, id): returns VM for a specific surface
    if (!surfaces) {
      liveConnected = false;
      liveHandle = null;
      setLivePill(false);
      toast('No window.__DEV__.surfaces found');
      return false;
    }

    liveConnected = true;

    liveHandle = {
      getVM: async () => {
        // If the project offers a per-surface VM getter, prefer it:
        const surfaceType = state.surfaceType || 'screen';
        const surfaceId = state.surfaceId || '';

        if (typeof surfaces.getSurfaceVM === 'function' && surfaceId) {
          return await surfaces.getSurfaceVM(surfaceType, surfaceId);
        }
        if (typeof surfaces.getVM === 'function') {
          return await surfaces.getVM();
        }
        if (surfaces.vm && typeof surfaces.vm === 'object') {
          return surfaces.vm;
        }
        // last resort: whole surfaces object
        return surfaces;
      }
    };

    setLivePill(true);
    toast('Live VM connected');
    return true;
  }

  // --- rendering ---

  function renderBox() {
    const path = sliceInp.value.trim();
    const slice = getByPath(lastVM, path);
    vmBox.textContent = safeJson(slice);
  }

  async function refreshVM() {
    // if live, load from project
    if (liveConnected && liveHandle?.getVM) {
      try {
        lastVM = await liveHandle.getVM();
      } catch (e) {
        liveConnected = false;
        liveHandle = null;
        setLivePill(false);
        toast('Live VM failed — using local');
        lastVM = makeLocalVM();
      }
    } else {
      lastVM = makeLocalVM();
    }
    renderBox();
  }

  function makeLocalVM() {
    // Local mock: enough structure to design slice paths without live connect
    return {
      vm: {
        meta: {
          surfaceType: state.surfaceType || 'screen',
          surfaceId: state.surfaceId || '(unset)',
          selectedSlotId: state.selectedSlotId || null
        },
        slots: (state.rootSlots || []).map(s => ({
          id: s.id,
          variant: s.variant || '',
          surface: s.surface || 'card'
        })),
        partsMap: state.partsMap || {}
      }
    };
  }

  // --- events ---

  btnTryLive?.addEventListener('click', () => {
    tryConnectLive();
  });

  btnRefresh.addEventListener('click', () => {
    refreshVM();
  });

  btnCopy.addEventListener('click', () => {
    copyText(vmBox.textContent || '');
  });

  sliceInp.addEventListener('input', () => {
    renderBox();
  });

  // Keep VM context updated when surface id/type changes (if your state emits it)
  state.on?.('surfaceChanged', () => {
    // surfaceType / surfaceId may have changed — refresh local VM at least
    refreshVM();
  });
  state.on?.('selectionChanged', () => {
    // help users quickly inspect selected slot mapping / related slice
    // (no auto-writing to slice path yet—keeping it conservative)
    refreshVM();
  });
  state.on?.('slotsChanged', () => {
    refreshVM();
  });
  state.on?.('partsChanged', () => {
    refreshVM();
  });

  // init
  setLivePill(false);
  refreshVM();
}
