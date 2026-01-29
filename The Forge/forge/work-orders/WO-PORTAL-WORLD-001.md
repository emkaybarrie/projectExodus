# WO-PORTAL-WORLD-001: World Model UX Alignment

**Priority:** High
**Effort:** Medium
**Lane:** Forge
**Status:** Draft
**Source:** ADDENDUM 3 — Final World/Authority/Visibility Model

---

## Context

ADDENDUM 3 establishes the canonical World/Product/Authority model:

- **Forante** is a World (not just a Portal name)
- **Forge OS** is a Product of Forante (not a World or Entity)
- **MyFi** is a sub-World of Forante (not an "entity")
- **Badlands** is a Product of MyFi

Current Portal UX has conceptual drift:
- Entity Switcher presents "Forge" as an entity peer to "MyFi"
- MyFi Portal inherits Forante chrome (upward visibility leak)
- No explicit World context indicator
- Navigation uses "entity" semantics instead of "world" semantics

---

## Acceptance Criteria

### 1. Terminology Corrections

- [ ] Rename "Entity Switcher" to "World Switcher" in code and UI
- [ ] Rename `state.currentEntity` to `state.currentWorld`
- [ ] Rename `entities.json` to `worlds.json` (or add `worlds.json` with correct model)
- [ ] Update all references from "entity" to "world" where appropriate
- [ ] Remove "Forge" from World Switcher (Forge is a Product, not a World)

### 2. World Switcher Restructure

Current structure:
```
Entity Switcher
├── Forge (icon: ⚙️)
├── MyFi (icon: 🎮)
└── [Other entities...]
```

Correct structure:
```
World Switcher
├── Forante (current world - home)
│   └── Products: Forge OS
├── MyFi (sub-world)
│   └── Products: Badlands
└── [Other sub-worlds...]
```

- [ ] Switcher shows Worlds, not a mix of worlds and products
- [ ] Products are listed under their owning World (nested or separate view)
- [ ] "Enter World" action instead of "Switch Entity"
- [ ] Current World highlighted with indicator

### 3. Header Context Line

Add subtle context indicator showing current World and Role:

```html
<div class="world-context">
  <span class="world-badge">World: Forante</span>
  <span class="role-badge">Role: Director</span>
</div>
```

- [ ] Context line visible in header (lightweight, not banner)
- [ ] Updates when World changes
- [ ] Role derived from user's authority in current World

### 4. MyFi World Sovereignty

When user enters MyFi World:
- [ ] Portal should feel like "MyFi Portal", not "Forante Portal showing MyFi"
- [ ] Header shows "MyFi" as world identity (not Forante)
- [ ] No visible Forante governance controls unless user has Forante authority
- [ ] "Return to Forante" available only if user has upward travel rights

**Sanity Check:** If Forante is removed, MyFi must still function as complete sovereign world.

### 5. Travel Semantics

- [ ] "Enter World" button/action for downward travel
- [ ] "Return to [Parent World]" for upward travel (only if permitted)
- [ ] No raw route jumps or file-path navigation
- [ ] Travel actions respect authority rules

### 6. Product Visibility

- [ ] Products shown as owned by their World
- [ ] Forge OS appears under Forante (not as peer to MyFi)
- [ ] Badlands appears under MyFi
- [ ] Products cannot be selected as "current world"

---

## Technical Notes

### Data Model Changes

**Current `entities.json`:**
```json
{
  "entities": [
    { "id": "forge", "name": "Forge", ... },
    { "id": "myfi", "name": "MyFi", ... }
  ]
}
```

**Proposed `worlds.json`:**
```json
{
  "worlds": [
    {
      "id": "forante",
      "name": "Forante",
      "type": "world",
      "products": ["forge-os"],
      "subWorlds": ["myfi"]
    },
    {
      "id": "myfi",
      "name": "MyFi",
      "type": "world",
      "parentWorld": "forante",
      "products": ["badlands"]
    }
  ],
  "products": [
    { "id": "forge-os", "name": "Forge OS", "world": "forante" },
    { "id": "badlands", "name": "Badlands", "world": "myfi" }
  ]
}
```

### State Changes

```javascript
// Before
state.currentEntity = 'forge';
state.entityFilter = 'myfi';

// After
state.currentWorld = 'forante';
state.worldContext = {
  world: 'forante',
  role: 'director',
  products: ['forge-os'],
  canTravelUp: false,
  canTravelDown: true
};
```

### Backward Compatibility

- Keep `entities.json` temporarily with deprecation notice
- Map old entity IDs to new world IDs during transition
- `forge` entity → `forante` world (Forge OS is product)
- `myfi` entity → `myfi` world

---

## UX Guidelines (from ADDENDUM 3)

1. **World context must be obvious but lightweight** — No heavy banners
2. **Parent world presence is contextual, not structural** — Forante shouldn't feel "always present" in MyFi
3. **No upward visibility leaks** — If user shouldn't see parent, UI must not hint at it
4. **Products feel owned** — Not peers of worlds
5. **Enter/Return semantics** — Travel, not "switch"

---

## Verification

- [ ] MyFi Director in MyFi Portal never perceives Forante
- [ ] Forante Director entering MyFi feels like they entered MyFi (not drilled into menu)
- [ ] Products feel owned by worlds, not peers
- [ ] World nesting works without UX collapse
- [ ] Authority boundaries are intuitive

**Final Sanity Check:**
> "If I removed Forante entirely, would MyFi still feel like a complete, sovereign world?"

Must answer: **YES**

---

## Dependencies

- None (can proceed independently)
- Informs: WO-FCL-D1 through D4 (Intent system should respect World scoping)

---

## Files Affected

- `portal/index.html` — Header, world switcher markup
- `portal/app.js` — State management, navigation, rendering
- `portal/styles.css` — World switcher, context line styles
- `portal/data/entities.json` → `worlds.json` — Data model
- `portal/entity/myfi/` — May need restructure for sovereignty

---

End of Work Order.
