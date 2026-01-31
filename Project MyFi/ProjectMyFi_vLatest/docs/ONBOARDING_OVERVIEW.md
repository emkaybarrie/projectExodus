# Onboarding Overview

## WO-P0-A: First-Run Narrative Welcome Overlay

### Purpose

The first-run welcome overlay establishes the core narrative frame for MyFi:

> **The player is not the hero. They are the source of energy that decides which heroes matter.**

This overlay ensures anyone opening the demo understands what MyFi is within 30 seconds.

### Episode Arc Enabled

**"You Are Powering This World"**

### Design Principles

1. **Frame the player as patron/influence, not controller**
   - The player provides financial energy
   - The world responds to that energy
   - Characters live their own lives

2. **Explain Stage + Map + Vitals in narrative terms**
   - The Stage is a window into an ongoing simulation
   - The Map shows the world's geography
   - Vitals represent the avatar's state

3. **Set expectation that the world continues without them**
   - The story unfolds whether or not they intervene
   - Observation is a valid mode of engagement

### Implementation

**Files:**
- `src/core/firstRun.js` - localStorage flag management
- `src/parts/prefabs/WelcomeOverlay/part.js` - Overlay component
- `src/parts/prefabs/WelcomeOverlay/baseline.html` - Markup
- `src/parts/prefabs/WelcomeOverlay/uplift.css` - Styling
- `src/core/app.js` - Integration point

**Trigger:**
- Automatically shown on first app load
- Check: `!firstRun.hasCompletedFirstRun()`

**Dismissal:**
- Click "Enter" button
- Click backdrop
- Press Escape key

**Persistence:**
- `localStorage.setItem('myfi.firstRunComplete', '1')`

### Copy (Canonical)

```
This city lives and breathes on financial energy.

Your choices shape the fate of those who inhabit it.

You may intervene... or simply watch the story unfold.
```

### Testing

Reset first-run state via browser console:

```javascript
__MYFI_DEBUG__.firstRun.resetFirstRun();
location.reload();
```

### Configuration

The overlay can be disabled via config flag (future):
- `MYFI_SKIP_WELCOME=true` in environment
- Or extend `firstRun.js` with a config check

### Guardrails

- Must NOT block interaction (can be dismissed immediately)
- Must NOT modify existing Stage behaviour
- Must be removable via config flag
- No asset dependencies beyond text + animation

### Animation Timing

| Element | Delay | Duration |
|---------|-------|----------|
| Backdrop fade-in | 0ms | 600ms |
| Line 1 reveal | 400ms | 800ms |
| Line 2 reveal | 1200ms | 800ms |
| Line 3 reveal | 2000ms | 800ms |
| Enter button | 2800ms | 600ms |
| Exit animation | 0ms | 400ms |

### Future Extensions

1. **Contextual welcome** - Different copy based on entry point
2. **Tutorial mode** - Optional guided tour after welcome
3. **Return welcome** - "Welcome back" for returning users
4. **Skip preference** - "Don't show again" in settings
