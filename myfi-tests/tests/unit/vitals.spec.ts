import { describe, it, expect } from 'vitest';

// Placeholder pure functions mirroring your formulas.
// Swap these with imports from your app once exposed.

function computeTruth({ regenCurrent, elapsedDays, spentToDate }: { regenCurrent: number; elapsedDays: number; spentToDate: number; }) {
  // T = regenCurrent * elapsedDays - spentToDate
  return regenCurrent * elapsedDays - spentToDate;
}

function lensRemainder({ baseline, truth }: { baseline: number; truth: number; }) {
  // cap = baseline * factor (factor = 1 in daily lens here for simplicity)
  const cap = baseline * 1;
  const s = Math.floor(truth / cap);
  const r = ((truth % cap) + cap) % cap; // safe modulo for negatives
  return { s, r, cap };
}

describe('Vitals math', () => {
  it('computes truth correctly', () => {
    expect(computeTruth({ regenCurrent: 20, elapsedDays: 3, spentToDate: 25 })).toBe(35);
  });

  it('lens remainder wraps correctly', () => {
    const { s, r, cap } = lensRemainder({ baseline: 20, truth: 35 });
    expect(cap).toBe(20);
    expect(s).toBe(1);
    expect(r).toBe(15);
  });
});
