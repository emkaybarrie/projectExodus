// src/ui/parts/ObjectiveCard/part.js
// ObjectiveCard uplift-pack v1.
//
// WORKFLOW RULES
// - AI may edit ONLY:
//   - baseline.html (inside CONTRACT block only)
//   - uplift.css
// - AI must NOT edit this file. It contains wiring + safeguards.

import { ensureGlobalCSS } from '../../../core/styleLoader.js';
import { loadTextOnce, loadJSONOnce } from '../../../core/assetLoader.js';
import { warnIfInvalid } from '../../../core/contractValidator.js';
// RewardRow is a primitive. Import directly from primitives.
// so the ObjectiveCard prefab stays decoupled from internal folder layout.
import { rewardRowHTML } from '../../primitives/RewardRow/part.js';

function clamp01(n){ return Math.max(0, Math.min(1, n)); }

function fmtRewardFallback(r){
  if (!r) return '';
  const bits = [];
  if (r.xp) bits.push(`+${r.xp} XP`);
  if (r.essence) bits.push(`+${r.essence} Essence`);
  if (r.gold) bits.push(`+${r.gold} Gold`);
  return bits.join(' · ');
}

let _tpl = null;          // HTMLTemplateElement
let _contract = null;     // parsed contract.json
let _preloadP = null;     // Promise

function hook(root, name){
  return root.querySelector(`[data-hook="${name}"]`);
}

export async function preloadObjectiveCardTemplate(){
  if (_preloadP) return _preloadP;

  _preloadP = (async () => {
    // Load uplift CSS (safe even if file is empty)
    ensureGlobalCSS('ObjectiveCard', new URL('./uplift.css', import.meta.url));

    // Load contract first (used to validate uplift).
    let contract = null;
    try {
      contract = await loadJSONOnce(
        'ObjectiveCard.contract',
        new URL('./contract.json', import.meta.url)
      );
    } catch {
      contract = null; // guardrail only
    }

    // Load template HTML.
    // - baseline.html = locked baseline
    // - uplift.html  = optional AI-uplift markup (delete to revert)
    // If uplift violates contract, we auto-fallback to baseline.
    let tpl = null;

    // 1) Try uplift
    try {
      const upliftHtml = await loadTextOnce(
        'ObjectiveCard.upliftHtml',
        new URL('./uplift.html', import.meta.url)
      );
      const upliftTpl = document.createElement('template');
      upliftTpl.innerHTML = upliftHtml;
      const ok = warnIfInvalid({
        partName: 'ObjectiveCard',
        variantName: 'uplift',
        contract,
        templateEl: upliftTpl
      });
      if (ok) tpl = upliftTpl;
    } catch {
      // no uplift -> fall through
    }

    // 2) Baseline fallback
    if (!tpl) {
      const baseHtml = await loadTextOnce(
        'ObjectiveCard.baseline',
        new URL('./baseline.html', import.meta.url)
      );
      const baseTpl = document.createElement('template');
      baseTpl.innerHTML = baseHtml;
      // Baseline should always satisfy contract; warn if it doesn't.
      warnIfInvalid({
        partName: 'ObjectiveCard',
        variantName: 'baseline',
        contract,
        templateEl: baseTpl
      });
      tpl = baseTpl;
    }

    _tpl = tpl;
    _contract = contract;
  })();

  return _preloadP;
}

function fallbackRenderObjectiveCard(q){
  const pct = q.target ? clamp01((q.progress || 0) / q.target) : 0;
  const claimable = q.state === 'complete' && !q.claimed;

  const card = document.createElement('div');
  card.className = [
    'myfiCard',
    'qbCard',
    'ObjectiveCard',
    q.focused ? 'is-focused' : '',
    q.state ? `is-${q.state}` : ''
  ].filter(Boolean).join(' ');
  card.dataset.qid = q.id;
  card.dataset.focused = q.focused ? '1' : '0';
  card.dataset.complete = (q.state === 'complete') ? '1' : '0';

  card.innerHTML = `
    <div class="qbCard__row">
      <div class="qbCard__meta">
        <div class="qbCard__type">${(q.type || 'misc').toUpperCase()}</div>
        <div class="qbCard__name">${q.title || ''}</div>
      </div>
      <div class="qbCard__actions">
        <button class="myfiBtn myfiBtnGhost" data-act="focus" type="button">${q.focused ? 'Unfocus' : 'Focus'}</button>
        <button class="myfiBtn myfiBtnGhost" data-act="claim" type="button" ${claimable ? '' : 'disabled'}>Claim</button>
      </div>
    </div>
    <div class="qbCard__nar">${q.narrative || ''}</div>
    <div class="qbCard__bar"><div class="qbCard__fill" style="width:${Math.round(pct*100)}%"></div></div>
    <div class="qbCard__foot">
      <div class="qbCard__prog">${q.progress || 0}/${q.target || 0}</div>
      <div class="qbCard__reward">${rewardRowHTML(q.reward) || fmtRewardFallback(q.reward)}</div>
    </div>
  `;

  return card;
}

/**
 * Render one objective card.
 * NOTE: The calling part (QuestBoard) owns behaviour via event delegation.
 */
export function renderObjectiveCard(q){
  // If template isn't ready yet, kick off preload and render fallback.
  if (!_tpl) {
    // Fire-and-forget preload (QuestBoard should await preload before first paint).
    preloadObjectiveCardTemplate().catch(() => {});
    return fallbackRenderObjectiveCard(q);
  }

  const pct = q.target ? clamp01((q.progress || 0) / q.target) : 0;
  const claimable = q.state === 'complete' && !q.claimed;

  const card = document.createElement('div');
  card.className = [
    'myfiCard',
    'qbCard',
    'ObjectiveCard',
    q.focused ? 'is-focused' : '',
    q.state ? `is-${q.state}` : ''
  ].filter(Boolean).join(' ');
  card.dataset.qid = q.id;
  card.dataset.focused = q.focused ? '1' : '0';
  card.dataset.complete = (q.state === 'complete') ? '1' : '0';

  const frag = _tpl.content.cloneNode(true);

  const typeEl = hook(frag, 'type');
  if (typeEl) typeEl.textContent = (q.type || 'misc').toUpperCase();

  const titleEl = hook(frag, 'title');
  if (titleEl) titleEl.textContent = q.title || '';

  const narEl = hook(frag, 'narrative');
  if (narEl) narEl.textContent = q.narrative || '';

  const btnFocus = hook(frag, 'btnFocus');
  if (btnFocus) btnFocus.textContent = q.focused ? 'Unfocus' : 'Focus';

  const btnClaim = hook(frag, 'btnClaim');
  if (btnClaim) {
    btnClaim.disabled = !claimable;
    btnClaim.textContent = 'Claim';
  }

  const fillEl = hook(frag, 'fill');
  if (fillEl && fillEl instanceof HTMLElement) {
    fillEl.style.width = `${Math.round(pct * 100)}%`;
  }

  const progEl = hook(frag, 'progressText');
  if (progEl) progEl.textContent = `${q.progress || 0}/${q.target || 0}`;

  const rewardEl = hook(frag, 'reward');
  if (rewardEl) rewardEl.innerHTML = rewardRowHTML(q.reward) || fmtRewardFallback(q.reward);

  card.appendChild(frag);
  return card;
}
