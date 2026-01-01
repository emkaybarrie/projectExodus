// src/ui/parts/ObjectiveFooter.js
// Primitive helper: renders the standard Quests objective footer row.
// IMPORTANT: class names qbCard__foot / qbCard__prog / qbCard__reward are relied on by quests/styles.css.

/**
 * Returns HTML for the standard objective footer.
 * @param {string} progText e.g. "3/10"
 * @param {string} rewardText e.g. "+50 XP · +2 Essence"
 */
export function objectiveFooterHTML(progText, rewardText){
  const p = progText ?? '';
  const r = rewardText ?? '';
  return `
    <div class="qbCard__foot">
      <div class="qbCard__prog">${p}</div>
      <div class="qbCard__reward">${r}</div>
    </div>
  `;
}
