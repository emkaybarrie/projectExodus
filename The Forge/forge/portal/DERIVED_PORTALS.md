# Derived Portals Pattern

Status: Canonical
Last Updated: 2026-01-24
Scope: Extension pattern for entity-specific portal views

---

## Overview

The Forge Portal is designed to support derived views for specific entities (e.g., MyFi, Forante). This document describes the patterns and conventions for creating entity-scoped portal experiences.

---

## Current Implementation: Entity Drilldown

### Lane Detection

Work Orders are associated with entities via their ID prefix:

```
FO-{Lane}-{Type}{Number}-{Name}
```

Examples:
- `FO-Forge-M2a-Mobile-Portal-Scaffold` → Lane: Forge
- `FO-MyFi-I2-JourneyRunner-Phase1` → Lane: MyFi
- `FO-Forante-G1-Governance-Setup` → Lane: Forante

### Drilldown Flow

1. User clicks an Entity card in the Entities panel
2. Portal navigates to Work Orders view
3. Lane filter is automatically set to the selected entity
4. Only Work Orders for that entity are displayed

### Filter State

The portal maintains filter state:

```javascript
state = {
  woFilter: 'all',        // Status filter: all, approved, executed, etc.
  woLaneFilter: 'all',    // Lane filter: all, Forge, MyFi, Forante
  entityFilter: null      // Entity drilldown context (entity ID)
};
```

---

## Extension Patterns

### Pattern 1: URL Parameter Filtering

Future enhancement: Support URL parameters for deep linking.

```
/portal/?entity=myfi
/portal/?lane=MyFi&status=approved
```

Implementation approach:
```javascript
function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('entity')) {
    state.entityFilter = params.get('entity');
  }
  if (params.has('lane')) {
    state.woLaneFilter = params.get('lane');
  }
  if (params.has('status')) {
    state.woFilter = params.get('status');
  }
}
```

### Pattern 2: Entity-Specific Landing Pages

For deeper entity integration, create entity-specific entry points:

```
portal/
  index.html          # Main Forge Portal
  myfi.html           # MyFi-scoped view (future)
  forante.html        # Forante-scoped view (future)
```

Each derived page would:
1. Load the same `app.js`
2. Set initial filter state via data attributes or URL params
3. Optionally hide cross-entity panels

Example `myfi.html`:
```html
<div id="portal-content" data-entity="myfi" data-lane="MyFi">
```

### Pattern 3: Embedded Portals

For embedding portal views in entity products (e.g., MyFi Hub):

```html
<iframe src="/portal/?embed=true&entity=myfi" />
```

Embed mode would:
- Hide header/footer
- Disable navigation to other entities
- Focus on Work Orders and status for that entity

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      PORTAL DATA FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  share-pack.index.json ──> Forge headlines                  │
│           │                                                  │
│           └──> work-orders.index.json ──> parseLane()       │
│                        │                                     │
│                        ├──> Forge WOs                       │
│                        ├──> MyFi WOs                        │
│                        └──> Forante WOs                     │
│                                                              │
│  entities.json ──> Entity cards ──> Click ──> Drilldown     │
│                                                              │
│  environments.json ──> Prod/Dev links                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Lane Configuration

Lanes are defined in `app.js`:

```javascript
function getLaneInfo(lane) {
  const lanes = {
    'Forge': { icon: '⚙️', label: 'Forge', class: 'lane-forge', color: '#6366f1' },
    'MyFi': { icon: '📱', label: 'MyFi', class: 'lane-myfi', color: '#10b981' },
    'Forante': { icon: '🏛️', label: 'Forante', class: 'lane-forante', color: '#f59e0b' },
    'unknown': { icon: '❓', label: 'Other', class: 'lane-unknown', color: '#6b7280' }
  };
  return lanes[lane] || lanes['unknown'];
}
```

To add a new lane:
1. Add entry to `getLaneInfo()` with icon, label, class, color
2. Add CSS styles for `.lane-{name}` and `.filter-chip.lane.lane-{name}.active`
3. Register the entity in `data/entities.json`

---

## CSS Customization

Each lane has dedicated CSS classes:

```css
/* Lane chip colors */
.lane-chip.lane-forge { /* purple tint */ }
.lane-chip.lane-myfi { /* green tint */ }
.lane-chip.lane-forante { /* amber tint */ }

/* Active filter chip colors */
.filter-chip.lane.lane-forge.active { background: #6366f1; }
.filter-chip.lane.lane-myfi.active { background: #10b981; }
.filter-chip.lane.lane-forante.active { background: #f59e0b; }
```

---

## Entity Registration

Entities are registered in `data/entities.json`:

```json
{
  "entities": [
    {
      "id": "myfi",
      "name": "MyFi",
      "integrationTier": 2,
      "flagship": true,
      "status": "active",
      "description": "Personal finance management platform"
    }
  ]
}
```

The `name` field must match the lane prefix used in Work Order IDs.

---

## Future Considerations

### Entity-Specific Dashboards

Each entity could have custom dashboard widgets:
- MyFi: Sprint velocity, feature completion, runtime status
- Forge: Cross-entity metrics, institutional health
- Forante: Governance compliance, entity tier stats

### Role-Based Views

Different views for different roles:
- Director: High-level dashboards, approval queues
- Executor: Task queues, execution context
- Observer: Read-only status views

### Mobile Entity Apps

Native-feeling PWA experiences for each entity:
- `/myfi-ops/` - MyFi operations dashboard
- `/forge-admin/` - Forge administration

---

## Cross-References

- [Forge Index](../FORGE_INDEX.md) - Forge navigation
- [Operating Model Lanes](../ops/OPERATING_MODEL_LANES.md) - Development lane governance
- [Entity Charter Template](../../../Forante/ENTITY_CHARTER_TEMPLATE.md) - Entity registration

---

End of Derived Portals Pattern.
