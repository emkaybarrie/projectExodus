// src/core/contractValidator.js
// Lightweight contract validation utilities.
//
// Purpose:
// - Provide "tripwire" warnings when uplift markup drifts from required hooks.
// - Allow parts to automatically fall back to baseline markup when uplift violates contract.

/**
 * Validate a <template> element against a contract definition.
 * Contract shape (minimum):
 *  - requiredHooks: string[] (data-hook names)
 *  - requiredButtonActs: string[] (button[data-act] values)
 */
export function validateTemplateAgainstContract(contract, templateEl){
  if (!contract || !templateEl) return { ok: true, problems: [] };

  const problems = [];
  const requiredHooks = Array.isArray(contract.requiredHooks) ? contract.requiredHooks : [];
  const requiredActs  = Array.isArray(contract.requiredButtonActs) ? contract.requiredButtonActs : [];

  for (const h of requiredHooks) {
    const found = templateEl.content.querySelector(`[data-hook="${h}"]`);
    if (!found) problems.push(`missing required data-hook="${h}"`);
  }

  for (const act of requiredActs) {
    const found = templateEl.content.querySelector(`button[data-act="${act}"]`);
    if (!found) problems.push(`missing required button[data-act="${act}"]`);
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Validate uplift template; if invalid, log a warning and return false.
 */
export function warnIfInvalid({ partName, variantName, contract, templateEl }){
  const vr = validateTemplateAgainstContract(contract, templateEl);
  if (vr.ok) return true;

  const label = `${partName || 'Part'}${variantName ? '.' + variantName : ''}`;
  console.warn(`[${label}] template violates contract; falling back to baseline.`, vr.problems);
  return false;
}
