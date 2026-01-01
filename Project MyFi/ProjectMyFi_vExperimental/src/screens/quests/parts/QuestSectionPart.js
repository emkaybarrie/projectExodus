// src/screens/quests/parts/QuestSectionPart.js
// Renders one quests section (Focused / Available / Completed).
//
// Model A: controller owns state via ctx.quests store; this part is view-only
// except for button click delegation that calls store actions.

import { preloadObjectiveCardTemplate, renderObjectiveCard } from '../../../ui/prefabs/ObjectiveCard/part.js';

function sectionMeta(section){
  if (section === 'focused') return { title: 'Focused', empty: 'No focused quests yet.' };
  if (section === 'available') return { title: 'Available', empty: 'No available quests in this filter.' };
  return { title: 'Completed', empty: 'Nothing claimed yet.' };
}

export async function QuestSectionPart(host, { props = {}, ctx = {} } = {}){
  const store = ctx?.quests;
  if (!store) throw new Error('QuestSectionPart: missing ctx.quests store');

  const section = props.section || 'available';
  const meta = sectionMeta(section);

  const card = document.createElement('div');
  card.className = 'qb__section myfiCard myfiCardPad';
  card.dataset.sec = section;
  card.innerHTML = `
    <div class="qb__secHead myfiSectionTitle">${meta.title}</div>
    <div class="qb__list" data-list="${section}"></div>
  `;
  host.appendChild(card);

  const listEl = card.querySelector('.qb__list');
  let unsub = null;

  function paint(){
    const quests = store.selectBySection(section);
    listEl.innerHTML = '';
    if (!quests || quests.length === 0) {
      listEl.innerHTML = `<div class="qbEmpty">${meta.empty}</div>`;
      return;
    }
    for (const q of quests) {
      listEl.appendChild(renderObjectiveCard(q));
    }
  }

  function onClick(e){
    const btn = e.target?.closest?.('button[data-act]');
    if (!btn) return;
    const qid = btn.closest?.('.qbCard')?.dataset?.qid;
    if (!qid) return;
    const act = btn.dataset.act;
    if (act === 'focus') {
      store.toggleFocus(qid);
    }
    if (act === 'claim') {
      const detail = store.claim(qid);
      if (detail) {
        host.dispatchEvent(new CustomEvent('quests:claimed', { bubbles:true, detail }));
      }
    }
  }

  // Ensure ObjectiveCard template is ready before first paint so we don't flash fallback.
  try { await preloadObjectiveCardTemplate(); } catch {}

  host.addEventListener('click', onClick);
  unsub = store.subscribe(() => paint());
  paint();

  return {
    unmount(){
      try { host.removeEventListener('click', onClick); } catch {}
      try { unsub?.(); } catch {}
      try { host.innerHTML = ''; } catch {}
    }
  };
}
