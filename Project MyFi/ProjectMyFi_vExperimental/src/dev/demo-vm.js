// ---FILE: src/dev/demo-vm.js
export function makeDemoHubVM() {
  return {
    hub: {
      status: { ahead: true, focusLabel: "Today" },
      vitals: {
        health: { cur: 276, max: 276 },
        mana:   { cur: 415, max: 415 },
        stam:   { cur: 691, max: 691 },
        shield: { cur: 1382, max: 1382, delta: +27 }
      },
      ghost: {
        // Ghost preview: where health would land if remaining pressure leaked
        healthIfLeak: 252
      },
      stage: {
        // "patrol" | "battle" (battle here means an encounter is present)
        mode: "battle",
        // When true, Stage enters Battle Mode UI (no carousel)
        battleOpen: false,
        auto: true,
        // V1 encounter list (up to 3 rendered in UI)
        encounters: [
          { id: "e1", name: "Cost",  pressure: 5, label: "Cost" },
          { id: "e2", name: "Spike", pressure: 3, label: "Spike" }
        ],
        // V1: simple text log
        battleLog: [
          "Cost presses the wardline (pressure 5).",
          "Auto Endure contained 1.",
          "Spike leaked 1 → health -1."
        ],
        recent: [
          { name: "Cost",  when: "Earlier",    result: "Leak 24", icon: "🜁" },
          { name: "Bill",  when: "Yesterday",  result: "Mit 12",  icon: "🛡️" },
          { name: "Price", when: "2d",         result: "Auto",    icon: "✦" }
        ]
      },
      essence: { cur: 0, max: 1382 }
    }
  };
}
