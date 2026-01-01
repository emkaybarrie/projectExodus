import { applyChromeProfile } from './chrome.js';
import { applyBackground, updateParallax  } from './background.js';
import { closeOwnedBy } from './modal.js';

const registry = new Map();       // id -> loader()
const cache = new Map();          // id -> { def, root, pos:{x,y} }
let stage, plane, current, layout;
let dragging = false, startX=0, startY=0, lastDX=0, lastDY=0, activeTarget=null;

let dragListenersArmed = false;

const SNAP_MS = 260;
const THRESHOLD = 0.34;
const VX_BONUS  = 0.18;

function armDragListeners() {
  if (dragListenersArmed) return;
  dragListenersArmed = true;

  // Capture phase so we get events even if UI underneath tries to handle them.
  stage.addEventListener('pointermove', onMove, { passive: false, capture: true });
  stage.addEventListener('pointerup', onUp, { passive: true, capture: true });
  stage.addEventListener('pointercancel', onUp, { passive: true, capture: true });
}

function disarmDragListeners() {
  if (!dragListenersArmed) return;
  dragListenersArmed = false;

  stage.removeEventListener('pointermove', onMove, { capture: true });
  stage.removeEventListener('pointerup', onUp, { capture: true });
  stage.removeEventListener('pointercancel', onUp, { capture: true });
}

function setNavState(state) {
  try { document.body.dataset.navState = state; } catch {}
}


export function initRouter({ stageEl }) {
  stage = stageEl;
  plane = stage.querySelector('#plane');
  if (!plane) throw new Error('router: #plane missing in #stage');
  addGestureHandlers();
}

export function registerScreens(importers) {
  importers.forEach(({ id, loader }) => registry.set(id, loader));
}

// layout = { center, left, right, up, down }
export function setLayout(map) { layout = { ...map }; }

function isInDashboard(id) {
  if (!layout) return false;
  return id === layout.center || id === layout.left || id === layout.right || id === layout.up || id === layout.down;
}
function hasAnyNeighbor(id) {
  return !!(getNeighbor(id,'left') || getNeighbor(id,'right') || getNeighbor(id,'up') || getNeighbor(id,'down'));
}

function getNeighbor(id, dir) {
  if (!layout) return null;
  if (id === layout.center) return layout[dir] || null;
  if (dir === 'right' && id === layout.left) return layout.center;
  if (dir === 'left'  && id === layout.right) return layout.center;
  if (dir === 'down'  && id === layout.up) return layout.center;
  if (dir === 'up'    && id === layout.down) return layout.center;
  return null;
}

function screenPos(id) {
  if (!layout) return { x:0, y:0 };
  if (id === layout.center) return { x:0, y:0 };
  if (id === layout.left)   return { x:-1, y:0 };
  if (id === layout.right)  return { x:+1, y:0 };
  if (id === layout.up)     return { x:0, y:-1 };
  if (id === layout.down)   return { x:0, y:+1 };
  return { x:0, y:0 };
}

async function ensureMounted(id) {
  let rec = cache.get(id);
  if (rec) return rec;

  const mod = await registry.get(id)();
  const def = mod.default;
  const root = document.createElement('section');
  root.id = 'screen-' + def.id;
  root.className = 'screen-root';
  plane.appendChild(root);

  const pos = screenPos(def.id);
  rec = { def, root, pos };
  cache.set(def.id, rec);

  positionScreen(rec);
  await def.mount(root, { navigate });
  return rec;
}

function positionScreen(rec) {
  // NEW: only position dashboard screens; others will be hidden unless active
  if (!isInDashboard(rec.def.id)) {
    rec.root.style.transform = 'translate(0,0)';
    return;
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = rec.pos.x * vw;
  const y = rec.pos.y * vh;
  rec.root.style.transform = `translate(${x}px, ${y}px)`;
}

function setPlaneTransform(x, y, _withTransition = false) {
  plane.style.transition = 'none';
  plane.style.transform  = `translate(${-x}px, ${-y}px)`;
  animX = x; animY = y;   // keep animator in sync
  updateParallax(x, y);
}


export async function navigate(id) {
  const target = await ensureMounted(id);

  if (current && current.def.onHide) current.def.onHide();
  // close any modals opened by the leaving screen
  if (current?.def?.id) closeOwnedBy(current.def.id);

  applyChromeProfile(target.def.chrome || {});
  applyBackground(target.def.background?.key);

  // NEW: Toggle visibility based on dashboard vs non-dashboard
  const dashboardIds = new Set(Object.values(layout || {}));
  cache.forEach((rec) => {
    if (isInDashboard(target.def.id)) {
      // In dashboard mode: show only dashboard screens
      rec.root.style.display = dashboardIds.has(rec.def.id) ? '' : 'none';
    } else {
      // In non-dashboard mode: show only the target screen
      rec.root.style.display = (rec.def.id === target.def.id) ? '' : 'none';
    }
  });

  // Re-position dashboard screens (in case of resize)
  cache.forEach(positionScreen);

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (isInDashboard(target.def.id)) {
    // slide plane to the dashboard slot
    const tx = target.pos.x * vw;
    const ty = target.pos.y * vh;
    // setPlaneTransform(tx, ty, true);
    animateTo(tx, ty);      // <— smooth glide instead of CSS snap
  } else {
    // NEW: reset plane for non-dashboard screens
    // setPlaneTransform(0, 0, true);
    stopAnim();
    setPlaneTransform(0, 0, false);
  }

  if (target.def.onShow) target.def.onShow();
  current = target;

  // Mark the current screen so CSS can allow interaction only there.
  cache.forEach(rec => {
    rec.root.classList.toggle('screen-current', rec === current);
  });

  applyMusicPolicy(target.def);

}

export function currentId() { return current?.def?.id; }

let animFrame = 0;
let animX = 0, animY = 0;
function stopAnim(){ if (animFrame) cancelAnimationFrame(animFrame); animFrame = 0; }
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function animateTo(tx, ty, ms = 220){
  stopAnim();
  const sx = animX, sy = animY;
  const dx = tx - sx, dy = ty - sy;
  const t0 = performance.now();
  function step(now){
    const t = Math.min(1, (now - t0) / ms);
    const k = easeOutCubic(t);
    const x = sx + dx * k, y = sy + dy * k;
    setPlaneTransform(x, y, false);
    if (t < 1) animFrame = requestAnimationFrame(step);
    else { animX = tx; animY = ty; animFrame = 0; }
  }
  animFrame = requestAnimationFrame(step);
}



/* ── Gestures ─────────────────────────────────────────── */

function addGestureHandlers() {
  // listen on stage so events from child screens always bubble to us
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('resize', () => cache.forEach(positionScreen), { passive:true });
}

// Fallback: map touch events to our pointer handlers if Pointer Events are absent
(function ensureTouchFallback(){
  const supportsPointer = 'onpointerdown' in window;
  if (supportsPointer) return;

  stage.addEventListener('touchstart', (ev) => {
    const t = ev.touches[0]; if (!t) return;
    onDown({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: false });

  window.addEventListener('touchmove', (ev) => {
    const t = ev.touches[0]; if (!t) return;
    onMove({
      clientX: t.clientX, clientY: t.clientY,
      preventDefault(){ ev.preventDefault(); }
    });
  }, { passive: false });

  window.addEventListener('touchend', () => onUp(), { passive: true });
})();

function onDown(e) {
  if (!current) return;
  // only drag inside dashboard layout
  if (!isInDashboard(current.def.id) || !hasAnyNeighbor(current.def.id)) return;

  // ignore non-primary pointers (avoids weird multi-touch / pen edge cases)
  if ('isPrimary' in e && e.isPrimary === false) return;

  dragging = true;
  stage.classList.add('dragging');
  setNavState('transitioning');
  armDragListeners();
  
  // capture safely (some desktop emulators don’t support/allow it)
  try { stage.setPointerCapture(e.pointerId); } catch {}

  startX = e.clientX; startY = e.clientY;
  lastDX = 0; lastDY = 0;

  const neighbors = ['left','right','up','down']
    .map(dir => getNeighbor(current.def.id, dir))
    .filter(Boolean);
  neighbors.forEach(n => ensureMounted(n));
}

function onMove(e) {
  if (!dragging) return;
  e.preventDefault();
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  lastDX = dx; lastDY = dy;

  const ax = Math.abs(dx), ay = Math.abs(dy);
  const vw = window.innerWidth, vh = window.innerHeight;
  const baseX = current.pos.x * vw;
  const baseY = current.pos.y * vh;

  // Axis lock (prevents diagonal travel)
  const useX = ax >= ay;
  setPlaneTransform(baseX - (useX ? dx : 0), baseY - (useX ? 0 : dy), false);

  activeTarget = null;
  if (useX && dx > 0) activeTarget = getNeighbor(current.def.id, 'left');
  else if (useX && dx < 0) activeTarget = getNeighbor(current.def.id, 'right');
  else if (!useX && dy > 0) activeTarget = getNeighbor(current.def.id, 'up');
  else if (!useX && dy < 0) activeTarget = getNeighbor(current.def.id, 'down');
}

function onUp() {
  if (!dragging) return;
  dragging = false;
  stage.classList.remove('dragging');
  setNavState('idle');
  disarmDragListeners();
  

  if (!activeTarget) {
    const vw = window.innerWidth, vh = window.innerHeight;
    setPlaneTransform(current.pos.x * vw, current.pos.y * vh, true);
    return;
  }

  const vw = window.innerWidth, vh = window.innerHeight;
  const fracX = Math.abs(lastDX) / vw;
  const fracY = Math.abs(lastDY) / vh;
  const passed = Math.max(fracX, fracY) + VX_BONUS >= THRESHOLD;

if (passed) {
  navigate(activeTarget);  // navigate will call animateTo() to glide into place
} else {
  const vw = window.innerWidth, vh = window.innerHeight;
  animateTo(current.pos.x * vw, current.pos.y * vh); // glide back to current
}

  activeTarget = null;
}

// ───────────────────────── Music policy per screen ─────────────────────────
function applyMusicPolicy(def) {
  // Nothing to do if engine isn’t present or no music config on the screen.
  if (!window.MyFiMusic || !def) return;
  const m = def.music || {};

  // Optional scene (soft volume target). Safe to call even if unchanged.
  if (m.scene) window.MyFiMusic.setScene(m.scene);

  // Mode: 'off' | 'play' | 'playAt'
  switch (m.mode) {
    case 'off': {
      // Enforce silence for this screen, but don’t change user mute preference.
      window.MyFiMusic.pause?.();
      break;
    }
    case 'play': {
      // Resume current track if user isn’t muted.
      if (!window.MyFiMusic.isMuted?.()) window.MyFiMusic.play?.();
      break;
    }
    case 'playAt': {
      // Select a specific track index if given; else fall back to current.
      const i = Number.isFinite(m.index) ? (m.index | 0) : null;
      if (!window.MyFiMusic.isMuted?.()) {
        if (i !== null) window.MyFiMusic.playAt?.(i);
        else window.MyFiMusic.play?.();
      }
      break;
    }
    default:
      // No policy: do nothing (screen leaves playback as-is).
      break;
  }
}


