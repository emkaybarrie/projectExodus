// src/ui/parts/RewardRow.js
// Primitive helper: renders a compact reward row (as pills) for objective-style cards.
// IMPORTANT: the qbCard__reward wrapper class is owned by ObjectiveFooter.

function pill(label){
  // Use baseline primitives; keep it compact for card footers.
  return `<span class="myfiPill myfiPillTiny">${label}</span>`;
}

/**
 * Returns HTML for reward pills.
 * @param {object} reward e.g. { xp: 50, essence: 2 }
 */
export function rewardRowHTML(reward){
  if (!reward) return '';
  const bits = [];
  if (reward.xp) bits.push(pill(`+${reward.xp} XP`));
  if (reward.essence) bits.push(pill(`+${reward.essence} Essence`));
  if (reward.gold) bits.push(pill(`+${reward.gold} Gold`));
  if (!bits.length) return '';
  return `<div class="myfiRow" style="gap:6px; flex-wrap:wrap;">${bits.join('')}</div>`;
}
