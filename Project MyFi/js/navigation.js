// js/navigation.js
// Centralized Navigation: layout + state + edge glow + arrows + continuous drag + keys + tour hooks
//
// Usage from dashboard.js:
//   import { createRouter } from './navigation.js';
//   const router = createRouter({
//     stage: document.getElementById('screen-stage'),
//     hubId: 'vitals-root',
//     layout: { up:'screen-products', right:'screen-avatar', down:'screen-myana', left:'screen-quests' },
//     onNavigate: ({ fromId, toId }) => { /* optional */ },
//   });
//   router.update(); // first paint
//
// Public API returned:
//   - update()               -> refreshes arrows + glow availability
//   - setLayout(nextLayout)  -> change neighbours dynamically
//   - current()              -> current screen id
//   - go(dir)                -> programmatic navigation ('up'|'right'|'down'|'left')
//   - setLegend(dir, text)   -> small legend near edge (for tours); pass null to clear
//   - setTone(dir, tone)     -> 'default'|'notify'|'alert'|'okay'
//   - pulse(dir, on)         -> subtle pulsing on/off
//

export function createRouter({ stage, hubId, layout, onNavigate }) {
  const dirs = ['up','right','down','left'];
  const reverseDir = d => ({ up:'down', right:'left', down:'up', left:'right' })[d] || null;

  // ---------- State ----------
  let currentId = (stage.querySelector('.screen.screen--active')?.id) || hubId;
  let animating = false;

  // Build reverse map so satellites know how to go back
  let backDirByScreen = {};
  function rebuildBackMap() {
    backDirByScreen = Object.fromEntries(
      Object.entries(layout).filter(([,id])=>id).map(([d,id])=>[id, reverseDir(d)])
    );
  }
  rebuildBackMap();

  const byId = id => document.getElementById(id);
  const canGo = (dir) => (currentId === hubId) ? !!layout[dir] : backDirByScreen[currentId] === dir;
  const targetFor = (dir) => (currentId === hubId) ? (layout[dir] || null) : (canGo(dir) ? hubId : null);

  // ---------- Edge Glow ----------
  const edgeMount = document.getElementById('edgeGlowMount');
  const glowLayer = document.createElement('div');
  glowLayer.className = 'edge-glow';
  edgeMount?.appendChild(glowLayer);

  const strips = Object.create(null);
  dirs.forEach(d => {
    const s = document.createElement('div');
    s.className = 'edge-glow__strip tone-default is-disabled';
    s.dataset.dir = d;
    glowLayer.appendChild(s);
    strips[d] = s;
  });

  // Optional legends (tour labels)
  const legends = Object.create(null);
  dirs.forEach(d=>{
    const l = document.createElement('div');
    l.className = 'edge-glow-legend';
    l.dataset.dir = d;
    l.style.display = 'none';
    edgeMount?.appendChild(l);
    legends[d] = l;
  });

  const glowState = {
    available: { up:false, right:false, down:false, left:false },
    tones:     { up:'default', right:'default', down:'default', left:'default' },
  };
  function setAvailability(next={}) {
    Object.assign(glowState.available, next);
    dirs.forEach(d => strips[d].classList.toggle('is-disabled', !glowState.available[d]));
  }
  function setTone(dir, tone='default') {
    const el = strips[dir]; if (!el) return;
    el.classList.remove('tone-default','tone-notify','tone-alert','tone-okay');
    el.classList.add('tone-'+tone);
    glowState.tones[dir] = tone;
  }
  function pulse(dir, on=true){ strips[dir]?.classList.toggle('is-pulsing', !!on); }
  function peek(dir, on=true){
    const el = strips[dir]; if (!el || !glowState.available[dir]) return;
    el.classList.toggle('is-peek', !!on);
    if (on){ clearTimeout(el.__peekT); el.__peekT=setTimeout(()=>el.classList.remove('is-peek'), 900); }
  }
  function dragGlow(dir, on=true){
    const el = strips[dir]; if (!el || !glowState.available[dir]) return;
    el.classList.toggle('is-drag', !!on);
    if (on){ clearTimeout(el.__dragT); el.__dragT=setTimeout(()=>el.classList.remove('is-drag'), 220); }
  }
  function setLegend(dir, text){
    const l = legends[dir]; if (!l) return;
    if (text) { l.textContent = text; l.style.display='block'; }
    else { l.style.display='none'; }
  }

  // Expose tour hooks globally if you want (optional)
  window.MyFiNav = {
    setAvailability, setTone, pulse, peek, drag: dragGlow, legend: setLegend,
    clear(dir){ setTone(dir,'default'); pulse(dir,false); setLegend(dir,null); },
  };

  // ---------- Arrow buttons ----------
  const navMount = document.getElementById('myfiNavMount');
  const arrowLayer = document.createElement('div');
  arrowLayer.className = 'myfi-nav myfi-nav--edge nav-hidden';
  navMount?.appendChild(arrowLayer);

  dirs.forEach(d=>{
    const b = document.createElement('button');
    b.className = 'myfi-nav-btn';
    b.type = 'button';
    b.dataset.dir = d;
    b.setAttribute('aria-label', `Navigate ${d}`);
    b.addEventListener('click', () => {
      showArrows();
      dragGlow(d, true);
      go(d);
    });
    arrowLayer.appendChild(b);
  });

  let hideTimer = null;
  function showArrows(){
    arrowLayer.classList.remove('nav-hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(()=> arrowLayer.classList.add('nav-hidden'), 1400);
  }

  function refreshIndicators(){
    // 1) toggle arrow visibility
    arrowLayer.querySelectorAll('.myfi-nav-btn').forEach(btn=>{
      const d = btn.dataset.dir;
      if (canGo(d)) btn.classList.remove('myfi-hidden'); else btn.classList.add('myfi-hidden');
    });

    // 2) sync glow availability
    setAvailability({
      up: canGo('up'), right: canGo('right'), down: canGo('down'), left: canGo('left')
    });

    // 3) short reveal
    showArrows();

    // 4) first paint: peek the available edges so it’s clearly visible in devtools desktop too
    if (!window.__EG_FIRST_PEEK_DONE) {
      window.__EG_FIRST_PEEK_DONE = true;
      dirs.forEach(d => canGo(d) && peek(d, true));
    }
  }

  // ---------- Programmatic slide (animated) ----------
  function go(dir) {
    if (!canGo(dir) || animating) return;
    const toId = targetFor(dir);
    const fromEl = byId(currentId), toEl = byId(toId);
    if (!fromEl || !toEl) return;

    animating = true;
    // position the incoming screen at its starting offset, then animate with CSS classes (fall-back)
    const enter = {up:'from-up', right:'from-right', down:'from-down', left:'from-left'}[dir];
    const exit  = {up:'to-down',  right:'to-left',   down:'to-up',    left:'to-right'}[dir];

    toEl.classList.add('screen--active', enter, 'animating');
    fromEl.classList.add('animating');
    requestAnimationFrame(()=>{
      fromEl.classList.add(exit);
      toEl.classList.remove(enter);

      const end = () => {
        fromEl.classList.remove('screen--active','animating','to-up','to-down','to-left','to-right');
        toEl.classList.remove('animating','from-up','from-down','from-left','from-right');
        fromEl.setAttribute('aria-hidden','true');
        toEl.removeAttribute('aria-hidden');

        currentId = toId;
        animating = false;
        refreshIndicators();
        onNavigate?.({ fromId: fromEl.id, toId });
      };

      let ended = 0;
      const doneOnce = () => { if (++ended >= 2) end(); };
      fromEl.addEventListener('transitionend', doneOnce, { once:true });
      toEl  .addEventListener('transitionend', doneOnce, { once:true });
    });
  }

  // ---------- Continuous drag (follow finger) ----------
  (function setupDrag(){
    if (!stage) return;

    let tracking = false;
    let startX=0, startY=0, dx=0, dy=0;
    let axis = null; // 'x'|'y'
    let dragDir = null; // 'left'|'right'|'up'|'down'
    let targetId = null;
    let fromEl = null, toEl = null;

    const EDGE_HINT = 28;
    const LOCK = 10;         // movement before we lock axis
    const COMPLETE = 0.33;   // % of width/height to consider a commit

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    function begin(x,y,target){
      // if started on a scrollable area, ignore navigation
      if (target && target.closest && target.closest('.scrollable')) return;
      startX=x; startY=y; dx=0; dy=0; axis=null; dragDir=null; targetId=null;
      tracking = true;
    }
    function update(x,y){
      if (!tracking) return;
      dx = x - startX; dy = y - startY;

      // axis lock
      if (!axis) {
        if (Math.abs(dx) > LOCK || Math.abs(dy) > LOCK) {
          axis = (Math.abs(dx) > Math.abs(dy)) ? 'x' : 'y';
        } else {
          // show edge hint if we’re near
          if (x < EDGE_HINT) peek('left', true);
          else if (x > w() - EDGE_HINT) peek('right', true);
          if (y < EDGE_HINT) peek('up', true);
          else if (y > h() - EDGE_HINT) peek('down', true);
          return;
        }
      }

      // pick direction from movement sign
      const want = axis === 'x'
        ? (dx < 0 ? 'right' : 'left')
        : (dy < 0 ? 'down'  : 'up');

      if (dragDir !== want) {
        // on direction change, initialise drag scene
        dragDir = want;
        targetId = canGo(dragDir) ? targetFor(dragDir) : null;

        // clean any previous inline transforms
        if (fromEl) { fromEl.style.transform=''; fromEl.style.transition=''; }
        if (toEl)   { toEl.style.transform='';   toEl.style.transition='';   toEl.classList.remove('screen--active'); }

        fromEl = byId(currentId);
        toEl   = targetId ? byId(targetId) : null;

        if (!toEl) { // direction not allowed → stop tracking
          tracking = false; axis=null; dragDir=null; return;
        }

        // prepare positions
        toEl.classList.add('screen--active');
        toEl.removeAttribute('aria-hidden');
        fromEl.removeAttribute('aria-hidden');

        // place target just off-screen in the correct direction
        const off = { up:`translate3d(0,-100%,0)`,
                      down:`translate3d(0,100%,0)`,
                      left:`translate3d(-100%,0,0)`,
                      right:`translate3d(100%,0,0)` }[dragDir];
        toEl.style.transform = off;

        // punch up the glow slightly while dragging
        dragGlow(dragDir, true);
      }

      // apply live transforms
      if (toEl) {
        if (axis === 'x') {
          const prog = Math.max(-1, Math.min(1, dx / w())); // -1..1
          fromEl.style.transform = `translate3d(${prog*100}%,0,0)`;
          toEl  .style.transform = `translate3d(${(prog>0? (prog-1):(prog+1))*100}%,0,0)`;
        } else {
          const prog = Math.max(-1, Math.min(1, dy / h()));
          fromEl.style.transform = `translate3d(0,${prog*100}%,0)`;
          toEl  .style.transform = `translate3d(0,${(prog>0? (prog-1):(prog+1))*100}%,0)`;
        }
      }
    }
    function end(){
      if (!tracking) return;
      tracking = false;

      if (!toEl) {
        axis=null; dragDir=null; return;
      }

      // decide commit vs snap-back
      const progress = (axis === 'x') ? Math.abs(dx)/w() : Math.abs(dy)/h();
      const commit = progress > COMPLETE;

      // animate to completion or back
      fromEl.style.transition = toEl.style.transition = 'transform 280ms cubic-bezier(.22,.8,.22,1)';

      if (commit) {
        // finish move
        if (axis === 'x') {
          const endFrom = (dx < 0) ? '-100%' : '100%';
          const endTo   = '0%';
          fromEl.style.transform = `translate3d(${endFrom},0,0)`;
          toEl  .style.transform = `translate3d(${endTo},0,0)`;
        } else {
          const endFrom = (dy < 0) ? '-100%' : '100%';
          fromEl.style.transform = `translate3d(0,${endFrom},0)`;
          toEl  .style.transform = `translate3d(0,0,0)`;
        }

        const finish = () => {
          // cleanup classes/styles
          fromEl.classList.remove('screen--active');
          fromEl.setAttribute('aria-hidden','true');
          fromEl.style.transform = fromEl.style.transition = '';
          toEl  .style.transform = toEl  .style.transition  = '';

          const prev = currentId;
          currentId = targetId;
          refreshIndicators();
          onNavigate?.({ fromId: prev, toId: currentId });
          axis=null; dragDir=null; toEl=null; fromEl=null;
        };
        toEl.addEventListener('transitionend', finish, { once:true });
      } else {
        // snap back
        fromEl.style.transform = 'translate3d(0,0,0)';
        if (axis === 'x') {
          const back = (dx < 0) ? '100%' : '-100%';
          toEl.style.transform = `translate3d(${back},0,0)`;
        } else {
          const back = (dy < 0) ? '100%' : '-100%';
          toEl.style.transform = `translate3d(0,${back},0)`;
        }
        const finish = () => {
          toEl.classList.remove('screen--active');
          toEl.setAttribute('aria-hidden','true');
          fromEl.style.transform = fromEl.style.transition = '';
          toEl  .style.transform = toEl  .style.transition  = '';
          axis=null; dragDir=null; toEl=null; fromEl=null;
          refreshIndicators();
        };
        toEl.addEventListener('transitionend', finish, { once:true });
      }
    }

    // Touch
    stage.addEventListener('touchstart', (e)=> {
      const t = e.changedTouches[0];
      begin(t.clientX, t.clientY, e.target);
    }, { passive:true });
    stage.addEventListener('touchmove', (e)=> {
      const t = e.changedTouches[0];
      update(t.clientX, t.clientY);
    }, { passive:true });
    stage.addEventListener('touchend', ()=> end(), { passive:true });

    // Mouse (dev)
    stage.addEventListener('mousedown', (e)=> begin(e.clientX, e.clientY, e.target));
    window.addEventListener('mousemove', (e)=> update(e.clientX, e.clientY));
    window.addEventListener('mouseup',  ()=> end());
  })();

  // ---------- Keyboard ----------
  document.addEventListener('keydown', (e)=>{
    if (!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key)) return;
    const tag=(document.activeElement?.tagName||'').toLowerCase();
    if (tag==='input'||tag==='textarea'||document.activeElement?.isContentEditable) return;
    e.preventDefault();
    showArrows();
    const map = { ArrowUp:'up', ArrowRight:'right', ArrowDown:'down', ArrowLeft:'left' };
    const dir = map[e.key];
    if (canGo(dir)) { dragGlow(dir,true); go(dir); }
  }, { capture:true });

  // ---------- Controller API ----------
  function update(){ refreshIndicators(); }
  function setLayout(next){
    Object.assign(layout, next||{});
    rebuildBackMap();
    refreshIndicators();
  }
  function current(){ return currentId; }

  return { update, setLayout, current, go, setLegend, setTone, pulse };
}
