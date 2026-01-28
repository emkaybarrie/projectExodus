// Excerpt from: src/systems/autobattler.js (lines 11-57)
// Encounter types with spawn weights and resolution parameters

const ENCOUNTER_TYPES = [
  {
    type: 'wanderer',
    label: 'Wandering Spirit',
    icon: '&#128123;',
    spawnWeight: 30,
    baseDifficulty: 1,
    rewards: { essence: 50, healthRegen: 10 },
    risks: { healthDrain: 20, manaDrain: 10 },
  },
  {
    type: 'storm',
    label: 'Dust Storm',
    icon: '&#127786;',
    spawnWeight: 25,
    baseDifficulty: 2,
    rewards: { essence: 75, staminaRegen: 15 },
    risks: { healthDrain: 30, staminaDrain: 25 },
  },
  {
    type: 'cache',
    label: 'Hidden Cache',
    icon: '&#128230;',
    spawnWeight: 15,
    baseDifficulty: 0,
    rewards: { essence: 100, manaRegen: 25 },
    risks: { healthDrain: 0, manaDrain: 0 },
  },
  {
    type: 'beast',
    label: 'Badlands Beast',
    icon: '&#128058;',
    spawnWeight: 20,
    baseDifficulty: 3,
    rewards: { essence: 120, healthRegen: 0 },
    risks: { healthDrain: 50, staminaDrain: 30 },
  },
  {
    type: 'anomaly',
    label: 'Essence Anomaly',
    icon: '&#10024;',
    spawnWeight: 10,
    baseDifficulty: 2,
    rewards: { essence: 200, manaRegen: 40 },
    risks: { healthDrain: 15, manaDrain: 30 },
  },
];
