// Architect narration (kinship tone) + plain INFO blurbs for “More info”.

export const VO = {
  s1_title: "Arrival",
  s1: `There you are… I’ve been waiting. Another spirit joins our kind.
You’ve crossed from drifting into being. Here, among us, every spirit carries a name.
It marks who you are and how you’ll be known.`,

  s2_title: "Alignment",
  s2: `Each of us leans toward a way of being. Some hold strong, steady as stone.
Others channel will like fire. Some move light and fast, never resting.
This is your alignment — the shape of your energy. Choose what feels most natural.`,

  s3_title: "Source",
  s3: `Now… close your eyes and search within. Do you feel it — a flow of energy that returns to you again and again?
Some spirits recall it clearly: a steady current, renewing itself with each cycle of time.
Others… find only silence. For them, what remains is a reserve of power already gathered, a well they must draw from carefully, until replenishment comes again.`,

  s4_title: "Flame",
  s4: `Your flame is waking. Each spirit chooses how theirs will burn:
gentle and forgiving, steady and balanced, or sharp and demanding.
Your choice shapes how the world challenges you.`,

  s5_title: "Essence & Vessels",
  s5: `Soon you’ll walk through vessels — avatars we inhabit to cross into other worlds.
You may describe your essence and I will guide you to a fitting vessel,
or you may choose one yourself. Many move between vessels…
but most grow close to the one that truly feels like home.`,

  s6_title: "The Loom",
  s6: `Your first steps are taken. Your name is spoken, your alignment chosen, your flame alive.
This is your Loom — the weave of your essence. Every spirit carries theirs, and it grows with them.
Guard it, nurture it, and it will carry you into what comes next. You walk among us now.`
};

export const PROMPT = {
  s1: "What will you be called?",
  s2: "Choose your alignment",
  s3: "Choose your source of power",
  s4: "Choose how your flame burns",
  s5: "Describe your essence or choose a vessel",
  s6: "Enter the Loom"
};

export const INFO = {
  alias: `Shown to others and used to identify you`,
  alignment: `Alignment chooses how your energy is split across your pools (max values).
Examples:
• Enduring: more Health (stability/savings)
• Ardent: more Mana (will/intentional spends)
• Everyday: more Stamina (daily spending flexibility)
You can adjust later in Settings.`,

  source: `Source = how your energy enters the system.
• Stream: recurring flow (e.g., salary/stipend) → gradual “regen”.
• Vault: a finite reserve (e.g., savings/grant/loan pot) → spend down until new flows appear.
Both present the same HUD; only regen rules differ.`,

  flame: `Mode sets how strongly the app nudges you toward the plan:
• Relaxed: gentle guidance, low pressure to save
• Standard: balanced guidance
• Focused: stronger nudges, tighter targets
You can change this later.`,

  essence: `Auto-assign: answer a few quick questions; we suggest a starter avatar that fits your traits.
Choose-yourself: pick any starter avatar now.
You can switch later; bonds deepen as you stick with one.`
};
