// fe/vitals.vm.js
const nf = (n, d=0) => new Intl.NumberFormat(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(n||0));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Build VM for bars and totals */
export function buildHUDModel(gw, mode = "core") {
  if (!gw || !gw.pools) return null;

  const pools = gw.pools;
  const essenceSoftCap = Number(gw?.essenceUI?.softCap || 0);

  const bar = (label, current, max, trend) => {
    const widthPct = max > 0 ? (current / max) * 100 : 0;
    return {
      label,
      widthPct: Math.max(0, Math.min(100, widthPct)),
      text: max > 0 ? `${nf(current)} / ${nf(max)}` : nf(current),
      trend: trend || "stable",
    };
  };

  const H = pools.health  || {};
  const M = pools.mana    || {};
  const S = pools.stamina || {};
  const Sh= pools.shield  || {};
  const E = pools.essence || {};

  const vm = {
    labels: {
      primary: mode === "core" ? "core" : "focus",
      focus: mode === "core" ? "daily" : mode,
      title: mode === "core" ? "Current" : (mode === "daily" ? "Today" : "This Week"),
    },
    totals: {
      current: (H.current||0) + (M.current||0) + (S.current||0),
      max:     (H.max||0)     + (M.max||0)     + (S.max||0),
    },
    bars: {
      health:  bar("Health",  H.current||0, H.max||0, H.trend),
      mana:    bar("Mana",    M.current||0, M.max||0, M.trend),
      stamina: bar("Stamina", S.current||0, S.max||0, S.trend),
      shield:  bar("Shield",  Sh.current||0, Sh.max||0, Sh.trend),
      essence: {
        label: "Essence",
        widthPct: essenceSoftCap > 0 ? Math.min(100, (Number(E.current||0) / essenceSoftCap) * 100) : 0,
        text: essenceSoftCap > 0 ? `${nf(E.current||0)} / ${nf(essenceSoftCap)}` : nf(E.current||0),
        trend: E.trend || "stable",
      },
    },
    pills: {
      // show “days” on Shield only (your FE anim can calculate live; static VM ok)
      shield: { now: Number(Sh.bankedDays || 0), next: Number(Sh.bankedDays || 0) }
    },
    ratePeek: {
      health:  `+${nf(H.regenDaily||0,2)}/day`,
      mana:    `+${nf(M.regenDaily||0,2)}/day`,
      stamina: `+${nf(S.regenDaily||0,2)}/day`,
      essence: `+${nf(E.regenDaily||0,2)}/day`,
    }
  };

  return vm;
}
