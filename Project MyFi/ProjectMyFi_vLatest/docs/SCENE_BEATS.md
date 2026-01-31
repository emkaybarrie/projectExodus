# Scene Beat Log (WO-S5)

**Implementation:** [`src/systems/sceneBeatLog.js`](../src/systems/sceneBeatLog.js)

## Overview

The Scene Beat Log captures resolved episodes as structured "beats" for display in the Recent Events tab. Each beat contains time, location, incident type, resolution mode, vitals impact, and pre-computed display data.

---

## Scene Beat Schema

```javascript
{
  id: 'beat-ep-xxx',                    // Unique beat ID
  time: 1700000030000,                  // Timestamp (ms)
  location: {                           // WorldPosition
    sector: 'east',
    areaIndex: 2,
    zoneId: 'frontier-outpost'
  },
  incidentType: 'combat',               // combat | traversal | social | anomaly
  resolvedBy: 'player',                 // player | auto | skip
  choiceId: 'health',                   // Tagged vital (if player engaged)
  vitalsDelta: {                        // Vitals impact
    health: -15,
    essence: +5
  },
  narrativeTag: 'encounter_health',     // Short narrative label
  display: {                            // Pre-computed display data
    icon: '&#128058;',
    title: 'Wolf Pack',
    subtitle: 'The dust settles...',
    resultBadge: { label: 'Engaged', class: 'engaged' },
    choiceLabel: 'Survival',
    vitalsImpact: [...],
    locationLabel: 'East • Medium',
    timeAgo: ''                         // Computed at render
  }
}
```

---

## API Reference

### Create Beat from Episode

```javascript
import { createSceneBeat } from '../systems/sceneBeatLog.js';

const beat = createSceneBeat(episode, incident, {
  currentPosition: worldPosition  // Optional
});
```

### Scene Beat Log Manager

```javascript
import { createSceneBeatLog } from '../systems/sceneBeatLog.js';

const log = createSceneBeatLog({
  actionBus,
  maxBeats: 50  // Rolling window
});

log.init();  // Subscribes to episode:resolved

// Manual operations
log.addBeat(beat);
log.logEpisodeResolution(episode, incident);
log.getBeats();           // All beats
log.getRecentBeats(10);   // Last N beats
log.clear();              // Clear log
```

---

## Events

### Emitted

| Event | Payload | When |
|-------|---------|------|
| `sceneBeat:added` | { beat, total } | New beat logged |
| `sceneBeat:cleared` | - | Log cleared |

### Subscribed

| Event | Action |
|-------|--------|
| `episode:resolved` | Auto-creates beat from episode |

---

## Display Data Structure

### Result Badges

| resolvedBy | Badge Label | CSS Class |
|------------|-------------|-----------|
| `player` | Engaged | `engaged` |
| `auto` | Auto | `auto` |
| `skip` | Skipped | `skipped` |

### Choice Labels

| choiceId | Display Label |
|----------|---------------|
| `health` | Survival |
| `mana` | Growth |
| `stamina` | Daily |
| `wardfire` | Impulse |
| `unknown` | Unknown |
| `combat_victory` | Victory |
| `combat_defeat` | Defeat |

### Vitals Impact Format

```javascript
{
  vital: 'health',
  delta: -15,
  label: '❤️-15',
  isPositive: false
}
```

---

## Integration with BadlandsStage

### Recent Events Subscription

```javascript
actionBus.subscribe('sceneBeat:added', (data) => {
  const beat = data.beat;
  state.recentEvents.unshift({
    id: beat.id,
    name: beat.display.title,
    icon: beat.display.icon,
    result: beat.resolvedBy,
    timestamp: beat.time,
    details: beat.display.choiceLabel
      ? `Tagged as: ${beat.display.choiceLabel}`
      : beat.display.subtitle,
    location: beat.display.locationLabel,
    vitalsImpact: beat.display.vitalsImpact,
    resultBadge: beat.display.resultBadge,
  });
});
```

### Enhanced HTML Structure

```html
<li class="BadlandsStage__recentItem" data-result="player">
  <div class="BadlandsStage__recentItemMain">
    <span class="BadlandsStage__recentItemIcon">🐺</span>
    <div class="BadlandsStage__recentItemInfo">
      <span class="BadlandsStage__recentItemName">Wolf Pack</span>
      <span class="BadlandsStage__recentItemTime">2m ago</span>
    </div>
    <span class="BadlandsStage__recentItemBadge BadlandsStage__recentItemBadge--engaged">
      Engaged
    </span>
  </div>
  <div class="BadlandsStage__recentItemDetails">
    Tagged as: Survival
    <span class="BadlandsStage__recentItemLocation">East • Medium</span>
  </div>
  <div class="BadlandsStage__recentItemVitals">
    <span class="BadlandsStage__recentItemVital BadlandsStage__recentItemVital--negative">
      ❤️-15
    </span>
    <span class="BadlandsStage__recentItemVital BadlandsStage__recentItemVital--positive">
      ✨+5
    </span>
  </div>
</li>
```

---

## Narrative Tags

Tags follow the pattern: `{incidentKind}_{resolution}` or `{incidentKind}_{choiceId}`

Examples:
- `encounter_engaged` - Player engaged with combat
- `encounter_health` - Player tagged combat as health/survival
- `passage_autopilot` - Traversal resolved by autopilot
- `pact_mana` - Social tagged as growth/investment
- `mystery_skipped` - Anomaly skipped by player

---

## Key Files

| File | Purpose |
|------|---------|
| [`src/systems/sceneBeatLog.js`](../src/systems/sceneBeatLog.js) | Beat creation and log management |
| [`src/core/app.js`](../src/core/app.js) | Log initialization |
| [`src/parts/prefabs/BadlandsStage/part.js`](../src/parts/prefabs/BadlandsStage/part.js) | Recent Events rendering |
| [`src/parts/prefabs/BadlandsStage/uplift.css`](../src/parts/prefabs/BadlandsStage/uplift.css) | Beat display styles |

---

## Regression Harness

- [x] Stage idle cycle unchanged
- [x] Combat overlay timing unchanged
- [x] Vitals ticking unchanged
- [x] Map movement unchanged
- [x] Nav modal/hub routing unchanged

**Flags OFF = identical to pre-WO**
