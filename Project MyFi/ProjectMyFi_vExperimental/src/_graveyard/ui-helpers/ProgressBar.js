// src/ui/parts/ProgressBar.js
// Primitive helper: renders a progress bar using the existing Quests CSS contract.
// IMPORTANT: class names qbCard__bar / qbCard__fill are relied on by quests/styles.css.

function clamp01(n){ return Math.max(0, Math.min(1, n)); }

/**
 * Returns HTML for the standard Quests progress bar.
 * @param {number} pct 0..1
 */
export function progressBarHTML(pct){
  const p = clamp01(Number(pct) || 0);
  return `
    <div class="qbCard__bar">
      <div class="qbCard__fill" style="width:${Math.round(p*100)}%"></div>
    </div>
  `;
}
