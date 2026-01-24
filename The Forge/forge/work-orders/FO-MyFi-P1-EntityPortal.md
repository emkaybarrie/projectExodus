# Work Order: FO-MyFi-P1

## Title
MyFi Entity Portal — Phone-Native Implementation

## Status
`executed`

## Lane
MyFi

## Type
P1 — Portal Implementation

## Priority
High

## Summary
Complete the MyFi Entity Portal as a phone-native, entity-scoped governance interface. The Forante Portal has an "Open MyFi Portal" button that navigates to `./entity/myfi/` but the portal is not accessible. This WO ensures the MyFi Entity Portal is fully functional and properly integrated.

---

## Context

### Model 3 Hierarchy
```
Forante (Constitutional)
    └── Forge (Institutional OS)
            └── MyFi (Entity Portal) ← THIS WORK ORDER
```

### Design Principles (from FO-Forge-P0)
1. **Forge is an Institutional OS** — not a product
2. **Entity Portals are scoped** — MyFi portal only shows MyFi concerns
3. **Phone-native first** — Bottom tab navigation, large touch targets
4. **Products are visibility filters** — Not separate portals
5. **Escalation path** — Entity can propose Forge evolution via Work Orders

### Current State
- Forante Portal: ✓ Complete at `portal/index.html`
- MyFi Portal files exist at `portal/entity/myfi/` but link may be broken
- Files: `index.html`, `myfi-app.js`, `myfi-styles.css`

---

## Deliverables

### D1: Verify/Fix MyFi Portal Files
Ensure all three files are complete and functional:
- [ ] `portal/entity/myfi/index.html` — Entry point with bottom tabs
- [ ] `portal/entity/myfi/myfi-app.js` — App logic with tab navigation
- [ ] `portal/entity/myfi/myfi-styles.css` — MyFi-specific styles (green accent)

### D2: MyFi Portal Tabs
Bottom navigation with four tabs:
| Tab | Icon | Content |
|-----|------|---------|
| **Home** | 🏠 | Welcome, status cards, quick actions |
| **Work** | 📋 | MyFi-scoped Work Orders only |
| **Products** | 📦 | Product visibility filters (Core MyFi, Badlands) |
| **Envs** | 🌐 | Dev/Prod environment links from `environments.json` |

### D3: MyFi-Scoped Data
- Work Orders: Filter to `*-MyFi-*` pattern only
- Products: Load from `products.json` → `products.myfi[]`
- Environments: Use MyFi URLs from `environments.json`

### D4: Escalation Feature
- "Escalate to Forge" screen accessible from Home
- Links to Forge Work Order creation
- Links to MyFi documentation (PRODUCT_STATE.md, MIGRATION_PARITY_MATRIX.md)

### D5: Navigation Integration
- [ ] "Back to Forante Portal" button on Home tab
- [ ] Verify `openEntityPortal('myfi')` navigates correctly from Forante
- [ ] Relative URLs work in both Dev and Prod environments

### D6: Update entities.json
Update the `portals.product` field to point to the entity portal:
```json
"portals": {
  "forge": "...",
  "product": "entity/myfi/"
}
```

---

## Technical Notes

### File Structure
```
The Forge/forge/portal/
├── index.html          ← Forante Portal
├── app.js
├── styles.css
├── data/
│   ├── entities.json
│   ├── environments.json
│   └── products.json
└── entity/
    └── myfi/
        ├── index.html      ← MyFi Entity Portal
        ├── myfi-app.js
        └── myfi-styles.css
```

### URL Pattern
- Forante Portal: `.../portal/`
- MyFi Entity Portal: `.../portal/entity/myfi/`
- Navigation: `./entity/myfi/` (relative from Forante)
- Back navigation: `../../` (relative from MyFi to Forante)

### Data URLs (relative from myfi-app.js)
```javascript
const SHARE_PACK_BASE = '../../../exports/share-pack/';
const PRODUCTS_URL = '../../data/products.json';
const ENVIRONMENTS_URL = '../../data/environments.json';
```

---

## Acceptance Criteria

1. **Link works**: Clicking "Open MyFi Portal" in Forante navigates to MyFi portal
2. **Tabs function**: All four bottom tabs render correct content
3. **Data loads**: Work orders, products, and environments load successfully
4. **Scoping works**: Only MyFi work orders appear (filtered by `-MyFi-` in ID)
5. **Back navigation**: "Back to Forante" returns to parent portal
6. **Styling**: Green accent theme (#10b981) distinguishes from Forante purple
7. **Flagship badge**: Shows "Flagship" designation in header

---

## Testing

### Local Testing
```bash
# From portal directory
npx serve .
# Navigate to http://localhost:3000/entity/myfi/
```

### Production URLs
- Prod: `https://emkaybarrie.github.io/projectExodus/The%20Forge/forge/portal/entity/myfi/`
- Dev: `https://emkaybarrie.github.io/projectExodus/dev/The%20Forge/forge/portal/entity/myfi/`

---

## Cross-References

- [FO-Forge-P0](./FO-Forge-P0-PhoneNativePortal.md) — Forante Portal scaffolding (parent WO)
- [DERIVED_PORTALS.md](../portal/DERIVED_PORTALS.md) — Extension patterns
- [environments.json](../portal/data/environments.json) — Environment URLs
- [products.json](../portal/data/products.json) — Product definitions

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-24 | WO created |
| 2026-01-24 | Executed — Files verified, entities.json updated with portal path |

---

End of Work Order.
