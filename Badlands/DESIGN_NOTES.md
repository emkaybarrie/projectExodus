# Badlands: Rhythm Run - Design Notes

## Work Order Reference
**FO-BADLANDS-POD-PROTO-01** - Rhythm-driven endless runner proof of concept

## Design Philosophy

The core hypothesis being tested: **Can rhythm mechanics create emergent skill expression in an auto-runner?**

Traditional rhythm games test timing against a predetermined chart. Traditional runners test reaction time. This prototype explores the intersection - where rhythm timing affects the physics and combat systems rather than being the sole mechanic.

---

## Key Decisions & Rationale

### 1. Procedural Audio Over Music Files

**Decision**: Generate all audio using Web Audio API oscillators instead of loading music files.

**Why**:
- Zero external dependencies - prototype runs from `file://`
- Guaranteed beat synchronization (beats are generated, not detected)
- Easier to adjust BPM and rhythm patterns dynamically
- No licensing concerns for a prototype

**Trade-off**: The audio sounds synthetic and lacks musical character. A production version would need actual composed tracks with beat annotations.

### 2. Momentum as the Core Loop

**Decision**: Make momentum the central resource that affects everything - speed, jump distance, damage, and scoring.

**Why**:
- Creates meaningful feedback loop: play well → move faster → more challenge → more reward
- Rhythm timing feeds into momentum, connecting all systems
- Players can "feel" their skill level through movement speed
- Provides natural difficulty scaling without explicit difficulty modes

**Trade-off**: Can feel punishing when momentum drops. Needs careful tuning of drain rates.

### 3. Three Distinct Classes

**Decision**: Warrior (heavy/melee), Mage (timing/ranged), Rogue (fast/precision) with different physics and rhythm interactions.

**Why**:
- Tests whether rhythm mechanics feel different across playstyles
- Warrior tests momentum retention (slow to build, slow to lose)
- Mage tests timing sensitivity (biggest bonuses on perfect)
- Rogue tests speed/precision trade-offs (fast but low momentum gain)

**Trade-off**: Three times the balancing work. Should have started with one.

### 4. Touch Zones Over Virtual Buttons

**Decision**: Left half = jump, right half = attack, with swipe gestures.

**Why**:
- No obscured visuals
- Works at any screen size
- Natural thumb positions
- Allows holding for variable jump height

**Trade-off**: Less discoverability. Players may not find swipe gestures.

### 5. Canvas Rendering Over DOM

**Decision**: All game rendering happens on a single canvas element.

**Why**:
- Consistent performance across devices
- Easier to implement effects (screen shake, particles, trails)
- No DOM manipulation overhead during gameplay
- Better for the visual style (parallax, custom shapes)

**Trade-off**: No CSS animations, must implement everything manually.

---

## What Worked

### Rhythm-to-Momentum Connection
The feel of hitting beats and watching speed increase is satisfying. There's a tangible "flow state" when you chain perfect timings. The beat indicator helps without being intrusive.

### Touch Control Scheme
The large touch zones work well. Players can focus on the game rather than hitting small buttons. Swipe gestures for special actions (ability, fast fall) feel natural.

### Procedural Level Generation
Tying platform gaps to beat intervals creates a natural relationship between music and level design. Gaps feel "musical" even though they're randomly generated.

### Visual Feedback Layers
The combination of screen flash, particle trails, beat pulse, and momentum bar creates clear feedback without overwhelming. Players know when they hit a perfect beat.

---

## What Didn't Work / Needs Iteration

### 1. Audio Quality
The procedural synth sounds "game jam-y" rather than stylish. The rhythm is there but the vibe is not. Would need:
- Actual composed tracks (Western guitar, electronic hybrid)
- Sound design for hits/jumps that complements the beat
- Dynamic mixing based on momentum

### 2. Enemy Variety
Three enemy types isn't enough variety. Combat feels repetitive after 30 seconds. Would need:
- More enemy patterns (charger, aerial, swarm)
- Enemy spawns that create rhythm-based challenges
- Boss encounters at distance milestones

### 3. Ability Implementations
Shield Dash and Shadow Step are basic. Time Warp barely affects gameplay. Would need:
- More dramatic ability effects
- Abilities that interact with rhythm (cast on beat for bonus)
- Cooldown tied to combo/momentum

### 4. Visual Polish
Placeholder shapes communicate function but lack character. Would need:
- Animated sprites (even simple 2-3 frame loops)
- Western anime character designs
- Environmental details (cacti, tumbleweeds, buildings)

### 5. Difficulty Curve
Current difficulty scaling is linear with distance. Creates sudden difficulty spikes. Would need:
- Wave-based intensity (buildup → climax → rest)
- "Safe zones" between challenges
- Difficulty tied to rhythm complexity (faster BPM, syncopation)

---

## Next Iteration Focus

### Priority 1: Audio Experience
- Compose 2-3 actual music tracks with different vibes/BPMs
- Beat annotations for precise sync
- Dynamic music layers that respond to momentum

### Priority 2: Combat Depth
- 3 more enemy types with unique rhythm-based behaviors
- Enemy patterns that create "rhythm puzzles"
- One boss fight prototype

### Priority 3: Visual Identity
- Commission or create sprite sheets for characters
- Parallax background layers with western theming
- Attack/ability animations

### Priority 4: Meta Loop
- Persistent unlocks (new abilities, cosmetics)
- Daily challenges
- Leaderboards

---

## Technical Debt

1. **Global State**: All systems use module-pattern globals. Would benefit from proper dependency injection for testing.

2. **Collision Detection**: Currently O(n) checks against all entities. Would need spatial partitioning for longer runs.

3. **Animation System**: None exists. Would need a state machine for character animations.

4. **Audio Context Resume**: Mobile browsers require user gesture. Current handling is minimal.

5. **Save System**: Only high score in localStorage. Would need structured save data for progression.

---

## Metrics to Track (Next Version)

- **Rhythm Accuracy Distribution**: Perfect/Good/OK/Miss percentages
- **Average Run Length**: Distance before death
- **Momentum Curve**: How momentum changes over a run
- **Class Preference**: Which class is most selected/successful
- **Retry Rate**: Do players play again after death?

---

## Conclusion

The core hypothesis is validated: rhythm timing creates satisfying emergent gameplay in an auto-runner context. The momentum system successfully connects rhythm to movement and combat, creating a "flow state" feeling.

However, the prototype needs significant polish to be fun for more than a few runs. The priority should be audio (to establish the vibe) followed by combat variety (to create replayability).

The isolated codebase approach worked well - no external dependencies, runs anywhere, easy to iterate. Would recommend keeping this constraint for the next iteration.
