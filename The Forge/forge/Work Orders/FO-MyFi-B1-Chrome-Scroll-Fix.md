# WORK ORDER: FO-MyFi-B1-Chrome-Scroll-Fix

Status: Executed
Created: 2025-01-24
Executed: 2025-01-24
Author: Claude (Opus 4.5)
Executor: Claude (Opus 4.5)
Director Approval: Approved

---

## Task ID
FO-MyFi-B1-Chrome-Scroll-Fix

## Task Type
bugfix

## Intent Statement
Fix critical scrolling bug in Hub and all screen surfaces where content cannot scroll vertically within the chrome shell, blocking mobile usability entirely.

## Problem Analysis

### Root Cause Identified
In `surfaceRuntime.js` line 50:
```javascript
hostEl.className = `screen-host bg-${bgKey}`;
```

This **overwrites** the entire `className` property, removing the `chrome__surfaceHost` class from the host element. The `chrome__surfaceHost` class in `tokens.css` contains all critical scrolling CSS:

```css
.chrome__surfaceHost {
  flex: 1 1 auto;
  min-height: 0;           /* CRITICAL for flex overflow */
  overflow-y: auto;        /* Enables scrolling */
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

When this class is removed, the surface host loses:
- `overflow-y: auto` → No scroll capability
- `min-height: 0` → Flex container cannot detect overflow
- All mobile touch scrolling properties

### Affected Surfaces
All screen surfaces are affected:
- Hub (`#hub`)
- Start (`#start`)
- Auth (`#auth`)
- Any future screens

### Reproduction
1. Load MyFi on mobile or desktop
2. Navigate to Hub (`#hub`)
3. Attempt to scroll vertically
4. **Result:** Screen does not scroll; content below fold is unreachable

## Scope of Work

### 1. Fix surfaceRuntime.js
**Change:** Use `classList.add()` instead of overwriting `className`

**Before:**
```javascript
hostEl.className = `screen-host bg-${bgKey}`;
```

**After:**
```javascript
// Preserve existing classes (e.g., chrome__surfaceHost), add surface-specific classes
hostEl.classList.add('screen-host', `bg-${bgKey}`);
```

### 2. Fix unmount cleanup
**Before:**
```javascript
hostEl.className = 'screen-host';
```

**After:**
```javascript
// Remove only surface-specific classes, preserve chrome classes
hostEl.classList.remove('screen-host');
// Remove any bg-* class
hostEl.className = hostEl.className.replace(/\bbg-\w+\b/g, '').trim();
```

### 3. Verify tokens.css (No changes needed)
Current CSS is correct. Confirm these rules remain intact:
- `.chrome__surfaceHost` has `overflow-y: auto` and `min-height: 0`
- Mobile media query with `touch-action: pan-y`

## Allowed Files / Artifacts
- MODIFY: `Project MyFi/ProjectMyFi_vLatest/src/core/surfaceRuntime.js`
- NO CHANGES to `tokens.css` (already correct)

## Forbidden Changes
- Do not modify chrome.js structure
- Do not add new CSS files
- Do not change surface.json definitions
- Do not modify Parts

## Success Criteria
1. Hub screen scrolls vertically on desktop (mouse wheel, trackpad)
2. Hub screen scrolls vertically on mobile (touch swipe)
3. All Hub slots visible: StatusBar, VitalsHUD, EncounterWindow, QuickLinks
4. Start and Auth screens unaffected (still render correctly)
5. No console errors
6. Background gradient (`bg-cosmic`) still applied correctly

## Testing Protocol
1. Desktop Chrome: Load `#hub`, scroll with mouse wheel
2. Desktop Chrome DevTools: Enable touch simulation, test swipe
3. Mobile Safari (iOS): Load `#hub`, swipe to scroll
4. Mobile Chrome (Android): Load `#hub`, swipe to scroll
5. Verify QuickLinks with Badlands link is reachable at bottom

## Dependencies
- None (standalone bugfix)

## Risk Assessment
- **Low risk**: Single-line change with clear before/after
- **Rollback**: Revert single file if issues arise

---

## Implementation Details

### File: `Project MyFi/ProjectMyFi_vLatest/src/core/surfaceRuntime.js`

**Lines 48-50 (mount):**
```javascript
// BEFORE
const bgKey = surface.background || 'cosmic';
hostEl.className = `screen-host bg-${bgKey}`;

// AFTER
const bgKey = surface.background || 'cosmic';
hostEl.classList.add('screen-host', `bg-${bgKey}`);
```

**Lines 62-65 (unmount):**
```javascript
// BEFORE
unmount() {
  api?.unmount?.();
  hostEl.className = 'screen-host';
}

// AFTER
unmount() {
  api?.unmount?.();
  hostEl.classList.remove('screen-host');
  // Remove background class (bg-cosmic, etc.)
  for (const cls of [...hostEl.classList]) {
    if (cls.startsWith('bg-')) hostEl.classList.remove(cls);
  }
}
```

---

## Alignment with MyFi Specs

Per `HUB_SURFACE_SPEC.md`:
- Hub is the Spirit Hub — primary financial health readout
- Visual hierarchy requires all slots visible via scrolling
- Interaction depth model defines scrollable content within Hub boundary
- Chrome provides header/footer boundary; **surface content must scroll between them**

This fix restores spec-compliant behavior.

---

End of Work Order.
