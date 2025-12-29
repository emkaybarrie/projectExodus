export function attachDebugOverlay({ mountEl, slotMetaList }) {
  // Toggle via localStorage: MYFI_DEBUG_SURFACES=1
  const enabled = localStorage.getItem('MYFI_DEBUG_SURFACES') === '1';
  if (!enabled) return { detach(){} };

  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '9999';

  // Create click handlers on slots by temporarily adding pointer-events
  function onClick(ev) {
    const slotEl = ev.target.closest?.('[data-ui-slot]');
    if (!slotEl) return;

    const info = slotMetaList.find(x => x.slotEl === slotEl);
    if (!info) return;

    // eslint-disable-next-line no-alert
    alert(
      [
        `slotId: ${info.slotId}`,
        `partId: ${info.partId}`,
        `variant: ${info.variant || ''}`,
        `slicePath: ${info.slicePath || ''}`,
        `events: ${Object.keys(info.eventsMap || {}).join(', ') || '(none)'}`
      ].join('\n')
    );
  }

  // Allow slot click only when debug enabled
  mountEl.style.position = mountEl.style.position || 'relative';
  mountEl.addEventListener('click', onClick, true);

  mountEl.appendChild(overlay);

  return {
    detach() {
      mountEl.removeEventListener('click', onClick, true);
      overlay.remove();
    }
  };
}
