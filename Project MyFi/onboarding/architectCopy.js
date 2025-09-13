
// onboarding/architectCopy.js
export const VO = {
  s1_title: "The Rift Opens",
  s1: `You stir within the void. A new spirit, fragile and formless, yet filled with possibility.
I am the Architect, your elder and your guide. Through this conduit you may awaken and grow.
Tell me… what shall you be called?`,

  s2_title: "The Source of Your Power",
  s2: `Every being must draw essence to survive. Some spirits drink from a steady wellspring.
Others carry a hoard — a chest of light to sustain them. Which path is yours?`,

  s3a_title: "The Wellspring",
  s3a: `Your spirit drinks from a flowing stream. If you wish, I can read the streams of your world directly,
or you may simply speak the amount that reaches you each moon.`,
  s3b_title: "The Hoard",
  s3b: `Your journey begins with a finite hoard of essence. How much lies within your chest,
and how many moons should it last?`,

  s4_title: "Carving the Pools",
  s4: `Shape your being. Divide your essence among the four vessels: Health, Mana, Stamina, Essence.
These vessels power your bond with the avatars you will one day guide.`,

  s5_title: "Seeding the Flame",
  s5: `Every spirit’s flame must be kindled. Choose how your spark should catch — gentle, brighter, or bound directly to the mortal streams.`,

  s6_title: "The Conduit to Avatars",
  s6: `Through this portal you may inhabit mortal vessels — avatars. Any vessel may be entered, but the strongest bonds
are forged with the one most aligned to your essence. Choose your first vessel.`,

  s7_title: "Revelation of the Loom",
  s7: `Your awakening is complete. Behold your Loom — your vessels of essence. Guard them well; they power your journey
and bind you to the avatars you will guide. I will watch nearby until you no longer need my hand.`,
};

export const UI = {
  next: "Continue",
  back: "Back",
  skip: "Skip",
  finish: "Enter the Loom",
  link_realm: "Link a Realm",
  manual: "Enter Manually",
  tiles: {
    wellspring: { title: "Wellspring", desc: "A recurring flow replenishes you each cycle." },
    hoard: { title: "Hoard", desc: "A finite chest of essence sustains your journey." }
  },
  presets: {
    balanced: "Balanced",
    saver: "Enduring (Health+)",
    everyday: "Everyday (Stamina+)",
    ardent: "Ardent (Mana+)"
  },
  seed: {
    safe: "Safe",
    accel: "Accelerated",
    manual: "Manual",
    true: "True (Linked)"
  }
};
