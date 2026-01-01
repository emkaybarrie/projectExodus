// src/ui/parts/ObjectiveCard.js
// A small, reusable renderer for "objective-style" cards.
// Not a surface-mountable part yet — it’s a primitive/helper used by parts like QuestBoard.
//
// Design rule:
// - Baseline look comes from tokens.css + base.css classes (myfiCard / myfiBtn / myfiPill etc.)
// - Screen/part styles may add small layout tweaks via extra classes.
// - Behaviour stays in the calling part (QuestBoard), not here.

import { progressBarHTML } from './ProgressBar.js';
import { objectiveFooterHTML } from './ObjectiveFooter.js';
import { rewardRowHTML } from './RewardRow.js';
import { ensureGlobalCSS } from '../../core/styleLoader.js';

function clamp01(n){ return Math.max(0, Math.min(1, n)); }

function fmtRewardFallback(r){
  if (!r) return '';
  const bits = [];
  if (r.xp) bits.push(`+${r.xp} XP`);
  if (r.essence) bits.push(`+${r.essence} Essence`);
  if (r.gold) bits.push(`+${r.gold} Gold`);
  return bits.join(' · ');
}

/**
 * Render one objective card.
 * The calling part is responsible for event wiring (typically via event delegation).
 *
 * Contract with caller:
 * - caller may rely on:
 *   - card.dataset.qid
 *   - buttons: button[data-act="focus"], button[data-act="claim"]
 * - progress uses qbCard__bar/qbCard__fill classes (styled by quests/styles.css)
 */
export function renderObjectiveCard(q){
  // Load ObjectiveCard uplift stylesheet once (part-owned). Safe on repeated calls.
  ensureGlobalCSS('ObjectiveCard', new URL('./ObjectiveCard/uplift.css', import.meta.url));

  const pct = q.target ? clamp01((q.progress || 0) / q.target) : 0;

  const card = document.createElement('div');
  card.className = [
    'myfiCard',
    'qbCard',
    q.focused ? 'is-focused' : '',
    q.state ? `is-${q.state}` : ''
  ].filter(Boolean).join(' ');
  card.dataset.qid = q.id;

  const claimable = q.state === 'complete' && !q.claimed;

  card.innerHTML = `
    <!-- CONTRACT:BEGIN ObjectiveCard -->
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
    ${progressBarHTML(pct)}
    ${objectiveFooterHTML(
      `${q.progress || 0}/${q.target || 0}`,
      // Prefer pill layout; fall back to plain text.
      rewardRowHTML(q.reward) || fmtRewardFallback(q.reward)
    )}
    <!-- CONTRACT:END ObjectiveCard -->
  `;
  return card;
}
