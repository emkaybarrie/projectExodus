// Excerpt from: src/parts/prefabs/BadlandsStage/part.js (lines 22-40)
// HUB-24: Battle skill definitions

const BATTLE_SKILLS = {
  endure: {
    id: 'endure',
    label: 'Endure',
    icon: '&#128737;',
    cost: { stamina: 5 },
    effect: { damageReduction: 0.5, shield: 15 },
    description: 'Reduce incoming damage and gain shield',
  },
  channel: {
    id: 'channel',
    label: 'Channel',
    icon: '&#10024;',
    cost: { mana: 25 },
    effect: { damage: 50, variance: 15 },
    description: 'Powerful magical strike',
  },
};

// Note: Two reserved skill slots exist in the UI (skill3, skill4)
// but have no implementation - they are disabled placeholders
