export async function mountSurface(hostEl, surface, { resolvePart, ctx }){
  const mounted = [];

  const root = document.createElement('div');
  root.className = 'surface-root';
  hostEl.appendChild(root);

  const slots = Array.isArray(surface.slots) ? surface.slots : [];

  for (const slotDef of slots) {
    const slotEl = document.createElement('div');
    slotEl.className = `slot ${slotDef.card ? 'slot-card' : ''}`;
    slotEl.dataset.slotId = slotDef.id || '';
    root.appendChild(slotEl);

    const partKind = slotDef?.part?.kind;
    if (!partKind) continue;

    const factory = await resolvePart(partKind);
    const api = await factory(slotEl, {
      id: slotDef.id || partKind,
      kind: partKind,
      props: slotDef.part.props || {},
      ctx,
      packet: slotDef.part.packet || null,
    });

    if (api?.unmount) mounted.push(api);
  }

  return {
    unmount(){
      for (let i = mounted.length - 1; i >= 0; i--) {
        try { mounted[i].unmount(); } catch(e){ console.warn('part unmount failed', e); }
      }
      mounted.length = 0;
      hostEl.innerHTML = '';
    }
  };
}
