// src/screens/quests/parts/QuestsTabsPart.js

import { mountSegmentTabs } from '../../../ui/primitives/SegmentTabs/part.js';

export async function QuestsTabsPart(host, { ctx = {} } = {}){
  const store = ctx?.quests;
  if (!store) throw new Error('QuestsTabsPart: missing ctx.quests store');

  const types = store.types();

  host.classList.add('qb__types');

  const tabs = mountSegmentTabs(host, {
    ariaLabel: 'Quest types',
    buttonClass: 'qbTab',
    activeClass: 'is-active',
    items: [{ key:'all', label:'All' }, ...types.map(t => ({ key:t.key, label:t.label }))],
    initialKey: 'all',
    onSelect: (key) => store.setFilter(key),
  });

  return {
    unmount(){
      try { tabs?.unmount?.(); } catch {}
      try { host.innerHTML = ''; } catch {}
    }
  };
}
