# WORK ORDER: FO-MyFi-B2-Footer-Scroll-Fix

Status: Executed
Created: 2026-01-24
Executed: 2026-01-24
Author: Claude (Opus 4.5)
Executor: Claude (Opus 4.5)
Director Approval: Approved

---

## Task ID
FO-MyFi-B2-Footer-Scroll-Fix

## Task Type
bugfix

## Intent Statement
Fix two UI issues discovered after B1 scroll fix: (1) Chrome footer not visible on Hub surface, and (2) Surface content wrapping when scrolling upward past the content boundary.

## Problem Analysis

### Issue 1: Missing Footer

**Expected Behavior:**
- Hub surface should display chrome footer with three navigation buttons: Hub, Quests, Avatar
- Footer defined in chrome.js lines 15-19
- Hub surface.json specifies `showFooter: true`

**Observed Behavior:**
- Footer is not visible when Hub surface loads
- Only header is visible

**Root Cause Investigation:**
After tracing the code flow:
1. chrome.js creates footer element correctly
2. chrome.apply() receives correct config `{ showHeader: true, showFooter: true }`
3. apply() sets `els.footer.style.display = ''` (should make visible)

**Suspected Cause:**
The `els.footer` reference may be stale or the DOM query isn't finding the element correctly after initial render. Adding debug logging will confirm.

### Issue 2: Surface Wrapping on Scroll

**Expected Behavior:**
- Surface content scrolls vertically within chrome shell
- Scrolling stops at content boundaries (no wrap-around)

**Observed Behavior:**
- When scrolling upward past the top of content, surface content appears to "wrap around"

**Root Cause Identified:**
In `tokens.css` line 79-81:
```css
.screen-host{
  min-height: 100%;
}
```

This rule forces `.screen-host` to be at least 100% of its parent (`.chrome__surfaceHost`) height. When combined with `overflow-y: auto` on the parent, this creates:
1. An artificially tall scrollable container
2. Extra scrollable space beyond actual content
3. Potential for elastic/bounce scrolling to show unexpected areas

**Additional CSS Conflict:**
The `.screen-host` class is added dynamically by surfaceRuntime.js, but its `min-height: 100%` conflicts with the flex-based scrolling model established in B1.

## Scope of Work

### 1. Fix tokens.css - Remove min-height constraint
**File:** `Project MyFi/ProjectMyFi_vLatest/src/core/tokens.css`

**Before (lines 79-81):**
```css
.screen-host{
  min-height: 100%;
}
```

**After:**
```css
.screen-host{
  /* min-height removed: flex parent + overflow handles scroll containment */
  /* Content height determined by surface-root grid layout */
}
```

Or simply remove the rule entirely since it only contained `min-height: 100%`.

### 2. Add debug logging to chrome.js (temporary)
**File:** `Project MyFi/ProjectMyFi_vLatest/src/core/chrome.js`

Add temporary logging in apply() to verify footer state:
```javascript
function apply(cfg = {}){
  console.log('[Chrome] apply called with:', cfg);
  console.log('[Chrome] Footer element:', els.footer);

  const showHeader = cfg.showHeader !== false;
  const showFooter = cfg.showFooter !== false;

  console.log('[Chrome] showFooter resolved to:', showFooter);

  els.header.style.display = showHeader ? '' : 'none';
  els.footer.style.display = showFooter ? '' : 'none';

  console.log('[Chrome] Footer display after set:', els.footer.style.display);

  if (typeof cfg.title === 'string') setTitle(cfg.title);
}
```

### 3. Verify surfaceRuntime passes chrome context
**File:** `Project MyFi/ProjectMyFi_vLatest/src/core/surfaceRuntime.js`

Add logging before chrome.apply call:
```javascript
// Apply chrome config (if chrome exists)
console.log('[SurfaceRuntime] ctx.chrome exists:', !!ctx?.chrome);
console.log('[SurfaceRuntime] surface.chrome:', surface.chrome);
if (ctx?.chrome?.apply) {
  ctx.chrome.apply(surface.chrome || {});
}
```

## Allowed Files / Artifacts
- MODIFY: `Project MyFi/ProjectMyFi_vLatest/src/core/tokens.css`
- MODIFY: `Project MyFi/ProjectMyFi_vLatest/src/core/chrome.js` (temporary debug logs)
- MODIFY: `Project MyFi/ProjectMyFi_vLatest/src/core/surfaceRuntime.js` (temporary debug logs)

## Forbidden Changes
- Do not modify chrome HTML structure
- Do not modify surface.json files
- Do not change router logic
- Do not add new CSS files

## Success Criteria
1. Hub surface displays chrome footer with three nav buttons
2. Footer nav buttons clickable and trigger navigation
3. Scrolling stops cleanly at content boundaries (no wrap-around)
4. All existing functionality preserved (scroll within chrome shell works)
5. Debug logs confirm chrome.apply receives correct config

## Testing Protocol
1. Clear browser cache and localStorage
2. Load MyFi at `#start` (footer should be hidden)
3. Navigate to `#hub` (footer should appear)
4. Verify footer shows: Hub | Quests | Avatar buttons
5. Test scroll behavior:
   - Scroll down: content scrolls, footer stays fixed
   - Scroll up: stops at top of content, no wrapping
6. Test on mobile (DevTools touch simulation)
7. Remove debug logs after verification

## Dependencies
- Requires FO-MyFi-B1-Chrome-Scroll-Fix (executed)

## Risk Assessment
- **Low risk**: CSS rule removal and temporary logging
- **Rollback**: Re-add `min-height: 100%` if layout breaks

---

## Implementation Notes

The `min-height: 100%` rule was likely added to ensure screens fill the viewport when content is short. However, with the B1 fix establishing proper flex-based scroll containment, this rule is now counterproductive:

- `.chrome__surfaceHost` has `flex: 1 1 auto` (takes available space)
- `.chrome__surfaceHost` has `min-height: 0` (allows proper overflow)
- `.chrome__surfaceHost` has `overflow-y: auto` (enables scrolling)
- `.surface-root` has padding including bottom padding for scroll breathing room

The flex layout naturally handles viewport filling. The `min-height: 100%` creates a rigid constraint that interferes with natural content flow.

---

End of Work Order.
