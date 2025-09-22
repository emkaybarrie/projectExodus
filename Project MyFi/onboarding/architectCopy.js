// Architect narration (kinship tone) + plain INFO blurbs for “More info”.

export const VO = {
  s1_title: "Arrival",
  s1: `There you are… I’ve been waiting. Another spirit awakens.
You’ve crossed from drifting into being. 
Here, among us, every spirit carries a name.
So tell me, friend.... how would you like to be known.`,

  s2_title: "Alignment",
  s2: `Each of us leans toward a way of being. How we wield the power we posses.
Some are resilient — guarding for the unseen storm.
Others are willful — moving with intent and power to shape the world.
Some are adaptable — flowing through whatever comes, anticipating the unknown.
And some walk a harmonic path - steady, balanced, centred.
This is your alignment — Choose what feels most natural.`,

  s3_title: "Affinity",
  s3: `Each spirit carries an elemental thread within them.
Some are as light as Air — fluid, accessible, ever-moving yet safe.
Others are steady as Earth — grounded, enduring, built to last.
Some flow as Water — shifting, cycling, rising and falling yet sustaining growth.
Others burn as Fire — bold, transformative, capable of sudden and dramatic change.
And some are touched by Chaos — unbound, weaving all paths into one, and balanced through flux.
This is your affinity — the element that colors your spirit. Choose what feels most comfortable.`,

  s4_title: "Flame",
  s4: `Your flame stirs. Each spirit chooses how theirs will burn:
gentle and forgiving, steady and balanced, or sharp and demanding.
Your choice shapes how the world challenges you.`,

  s5_title: "Essence",
  s5: `Soon you’ll walk through vessels — avatars empowered by your very being, as you cross into their world.
Describe your essence and I will guide you to a fitting vessel.
When the time is right, I will teach you how to move between them freely…
but most grow close to the one that truly feels like home.`,

  s6_title: "The Crucible",
  s6: `Your first steps are taken. Your name is spoken, your alignment chosen, your flame alive.
This is your Crucible — the heart where your essence gathers, the source from which your power flows.
Every spirit carries theirs, and it grows with them.
Guard it, nurture it, and it will shape everything you become. You walk among us now.`

//   s4_title: "Energy",
//   s4: `Now… close your eyes and search within. Do you feel it — the source of your power, ebbing and flowing?
// Some spirits know it well: a steady stream, feeding their light each cycle, time after time.
// Others… carry only a spark. A reserve of energy already gathered, precious, to be spent with care until it can be renewed.`,

//   s5_title: "Ember",
//   s5: `Whatever your source, every spirit bears an Ember - the quiet weight of survival. 
// It burns without pause, consuming what is owed each cycle.  That which must be fed, so the spirit may endure.
// Tell me: how much does your ember take from you?`,
};

export const PROMPT = {
  s1: "What will you be called?",
  s2: "Choose your Alignment",
  s3: "Choose your Affinity",
  s4: "Choose how your flame burns",
  s5: "Describe your essence",
  s6: "Enter the Crucible"
};

export const INFO = {
  alias: `Shown to others and used to identify you`,
  alignment: `Alignment chooses how your energy is divided across your pools (max values).
Examples:
• Enduring: more Health (stability/savings)
• Ardent: more Mana (will/intentional spends)
• Everyday: more Stamina (daily spending flexibility)
You can adjust later in Settings.`,

  affinity: `Affinity reflects your elemental nature — and your temperament toward risk and reward:
• Air: fluid, safe, ever-accessible — lowest risk
• Earth: grounded, enduring, stable — secure and long-term
• Water: flowing, cyclical, sustaining — moderate risk, steady growth
• Fire: volatile, transformative — immense potential. High risk, high reward
• Chaos: unpredictable, fluid, touching all — balanced through flux
Your choice is thematic, shaping how your spirit is expressed, and how affects the way you obtain rewards in the Badlands.`,

  flame: `Mode sets how strongly the app nudges you toward the plan:
• Gentle: strong pressure to save, pushing you to reduced burn each cycle
• Standard: balanced approach to saving and spending
• Intense: more relaxed pressure to save, subtly promoting increased spending (without discipline)
You can change this later.`,

  essence: `Answer a few quick questions; we suggest a starter avatar that fits your traits.
You can switch later; bonds deepen as you stick with one.`

//   source: `How your energy enters the system.
// • Stream: a recurring flow (e.g., salary, stipend) — regenerates each cycle.
// • Spark: a finite reserve (e.g., savings, loan, grant) — lasts until it’s spent.
// Both appear the same on your HUD; only regeneration rules differ.`,

//   ember:`Your Ember represents mandatory outgoings — the minimum fire you must feed each cycle to exist.
// Examples: rent or mortgage, essential bills, debts, basic food, survival costs.`,
};
