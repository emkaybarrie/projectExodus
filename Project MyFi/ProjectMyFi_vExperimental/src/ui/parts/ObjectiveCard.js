// src/ui/parts/ObjectiveCard.js
// A small, reusable renderer for "objective-style" cards.
// Not a surface-mountable part yet — it’s a primitive/helper used by parts like QuestBoard.
//
// Design rule:
// - Baseline look comes from tokens.css + base.css classes (myfiCard / myfiBtn / myfiPill etc.)
// - Screen/part styles may add small layout tweaks via extra classes.
// - Behaviour stays in the calling part (QuestBoard), not here.

function clamp01(n){ return Math.max(0, Math.min(1, n)); }

function fmtReward(r){
  if (!r) return '';
  const bits = [];
  if (r.xp) bits.push(`+${r.xp} XP`);
  if (r.essence) bits.push(`+${r.essence} Essence`);
  if (r.gold) bits.push(`+${r.gold} Gold`);
  return bits.join(' · ');
}

/**
 * @param {object} q - objective model (quest-shaped for now)
 * @param {object} opts
 * @param {Function} opts.onFocus
 * @param {Function} opts.onClaim
 */
export function renderObjectiveCard(q, opts = {}) {
  const pct = q.target ? clamp01((q.progress || 0) / q.target) : 0;

  const card = document.createElement('div');
  // Keep qbCard hook class for now (screen CSS can tune spacing), but base visuals come from myfiCard.
  card.className = [
    'myfiCard', 'myfiCardPad',
    'qbCard',
    q.focused ? 'is-focused' : '',
    q.state ? `is-${q.state}` : ''
  ].filter(Boolean).join(' ');
  card.dataset.qid = q.id;

  card.innerHTML = `
    <div class="qbCard__row">
      <div class="qbCard__meta">
        <div class="qbCard__type">${(q.type || '').toUpperCase()}</div>
        <div class="qbCard__name">${q.title || ''}</div>
        <div class="qbCard__narr">${q.narrative || ''}</div>
      </div>
      <div class="qbCard__actions">
        <button class="myfiBtn myfiBtnGhost js-focus" type="button">${q.focused ? 'Unfocus' : 'Focus'}</button>
        <button class="myfiBtn myfiBtnGhost js-claim" type="button">Claim</button>
      </div>
    </div>

    <div class="qbProg">
      <div class="qbProg__bar"><div class="qbProg__fill" style="width:${Math.round(pct*100)}%"></div></div>
      <div class="qbProg__row">
        <div class="qbProg__count">${q.progress || 0}/${q.target || 0}</div>
        <div class="qbProg__reward">${fmtReward(q.reward)}</div>
      </div>
    </div>
  `;

  const btnFocus = card.querySelector('.js-focus');
  const btnClaim = card.querySelector('.js-claim');

  // Focus always available unless claimed (caller can still ignore).
  btnFocus?.addEventListener('click', () => opts.onFocus?.(q));

  // Claim is only enabled when complete (or caller can set claimed state).
  const claimable = q.state === 'complete' && !q.claimed;
  if (!claimable) {
    btnClaim?.setAttribute('disabled', 'disabled');
    btnClaim?.classList.add('is-disabled');
  } else {
    btnClaim?.addEventListener('click', () => opts.onClaim?.(q));
  }

  return card;
}
