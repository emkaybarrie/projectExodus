# Badlands: Rhythm Run

A rhythm-driven endless runner prototype with momentum-based movement and roguelike elements. Built as an isolated prototype for mobile-first gameplay.

## How to Run

1. Open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge)
2. For best experience on mobile, add to home screen for fullscreen mode
3. No build step or server required - runs entirely in the browser

### Local Development

For local testing with live reload:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

Then open `http://localhost:8000` in your browser.

## Controls

### Mobile (Touch)
- **Left side of screen**: Tap to jump (hold for higher jump)
- **Right side of screen**: Tap to attack
- **Swipe up**: Double jump (when airborne)
- **Swipe down**: Fast fall
- **Swipe right**: Use class ability

### Desktop (Keyboard)
- **Space / W / Arrow Up**: Jump (hold for higher)
- **Arrow Down / S**: Fast fall
- **X / J**: Attack
- **Z / K**: Class ability
- **P / Escape**: Pause

## Core Mechanics

### Momentum System ("Flow")
- Momentum builds from 0-100 as you maintain rhythm
- Higher momentum = faster movement, longer jumps
- Taking damage or missing beats drains momentum
- The momentum bar at the top right shows your current flow state

### Rhythm Coupling
- Actions timed to the beat receive bonuses:
  - **PERFECT** (within 50ms): Maximum damage/momentum bonus, builds combo
  - **GOOD** (within 100ms): Moderate bonus, builds combo
  - **OK** (within 150ms): Small bonus, no combo break
  - **MISS**: Resets combo
- The beat indicator pulses to help you time actions
- Procedural audio generates the rhythm track

### Character Classes

#### Warrior
- **Playstyle**: Heavy momentum retention, melee focus
- **Stats**: Slow acceleration, hard to stop, strong attacks
- **Ability**: Shield Dash - Invincible charge forward, destroys enemies
- **Rhythm Bonus**: 2x damage on perfect, +50% momentum gain

#### Mage
- **Playstyle**: Timing-sensitive, ranged attacks
- **Stats**: Medium speed, floaty jumps, good air control
- **Ability**: Time Warp - Slows all enemies (enhanced on perfect beat)
- **Rhythm Bonus**: 3x damage on perfect, ability enhanced on perfect

#### Rogue
- **Playstyle**: Speed-focused, precision timing
- **Stats**: Very fast, quick acceleration/deceleration
- **Ability**: Shadow Step - Teleport through enemies, dealing damage
- **Rhythm Bonus**: 2.5x damage on perfect, 50% crit chance on perfect

### Level Generation
- Platforms spawn procedurally based on beat timing
- Gaps are designed to be jumpable within beat windows
- Enemies spawn on downbeats (every 4 beats)
- Difficulty increases with distance traveled

### Enemy Types
- **Crawler**: Stationary, 1 HP
- **Jumper**: Hops periodically, 1 HP
- **Shooter**: Fires projectiles, 2 HP

## Known Limitations

1. **Audio**: Uses procedural Web Audio synthesis - no actual music tracks yet
2. **Visuals**: Placeholder shapes instead of sprites/animations
3. **Mobile Safari**: May require user gesture to start audio
4. **Abilities**: Shield Dash and Shadow Step have basic implementations
5. **No persistent progression**: Only high score is saved locally

## File Structure

```
Badlands/
├── index.html          # Main HTML with all screens
├── css/
│   └── style.css       # All styling (western anime aesthetic)
├── js/
│   ├── audio.js        # Procedural audio synthesis & beats
│   ├── rhythm.js       # Beat detection & timing system
│   ├── input.js        # Touch & keyboard input handling
│   ├── classes.js      # Character class definitions
│   ├── player.js       # Player movement & state
│   ├── level.js        # Procedural level generation
│   ├── renderer.js     # Canvas rendering
│   └── game.js         # Main game loop & state management
├── assets/
│   └── audio/          # (empty - using procedural audio)
├── README.md           # This file
└── DESIGN_NOTES.md     # Design decisions & learnings
```

## Browser Support

- Chrome 80+ (desktop & mobile)
- Firefox 75+
- Safari 13+ (iOS 13+)
- Edge 80+

Requires Web Audio API and ES6 support.
