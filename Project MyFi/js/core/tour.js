// js/tour.js
// Zero-dependency spotlight tour with auto-positioning and arrow pointers.

const STATE = {
  steps: [],
  i: 0,
  overlay: null,
  pop: null,
  currentEl: null,
  onEnd: null,
};

function pickPlacement(rect) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const spaces = {
    top: rect.top,
    bottom: vh - rect.bottom,
    left: rect.left,
    right: vw - rect.right
  };
  // Side with most free space
  return Object.entries(spaces).sort((a,b)=>b[1]-a[1])[0][0];
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function placePop(pop, rect, placement, margin = 12) {
  // Reset to measure
  pop.style.left = "0px";
  pop.style.top  = "0px";

  const vw = window.innerWidth, vh = window.innerHeight;
  const { width: pw, height: ph } = pop.getBoundingClientRect();

  let left = 0, top = 0;
  if (placement === "top") {
    left = clamp(rect.left + (rect.width - pw)/2, 8, vw - pw - 8);
    top  = clamp(rect.top - ph - margin, 8, vh - ph - 8);
  } else if (placement === "bottom") {
    left = clamp(rect.left + (rect.width - pw)/2, 8, vw - pw - 8);
    top  = clamp(rect.bottom + margin, 8, vh - ph - 8);
  } else if (placement === "left") {
    left = clamp(rect.left - pw - margin, 8, vw - pw - 8);
    top  = clamp(rect.top + (rect.height - ph)/2, 8, vh - ph - 8);
  } else { // right
    left = clamp(rect.right + margin, 8, vw - pw - 8);
    top  = clamp(rect.top + (rect.height - ph)/2, 8, vh - ph - 8);
  }

  pop.style.left = `${Math.round(left)}px`;
  pop.style.top  = `${Math.round(top)}px`;
  pop.dataset.place = placement;
}

function ensureVisible(el) {
  try { el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }); }
  catch {}
}

function clearStep() {
  if (STATE.currentEl) STATE.currentEl.classList.remove("tour-highlight");
  STATE.currentEl = null;

  if (STATE.pop) { STATE.pop.remove(); STATE.pop = null; }
  if (STATE.overlay) { STATE.overlay.remove(); STATE.overlay = null; }

  window.removeEventListener("resize", onReposition);
  window.removeEventListener("scroll", onReposition, true);
}

function onReposition() {
  const step = STATE.steps[STATE.i];
  if (!step || !STATE.pop) return;
  const el = document.querySelector(step.target);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const placement = step.placement || pickPlacement(rect);
  placePop(STATE.pop, rect, placement);
}

function renderStep(index) {
  clearStep();

  const step = STATE.steps[index];
  if (!step) return end();

  const el = document.querySelector(step.target);
  if (!el) return next(); // skip missing

  STATE.currentEl = el;
  el.classList.add("tour-highlight");
  ensureVisible(el);

  // Transparent blocker (catch clicks outside)
  const overlay = document.createElement("div");
  overlay.className = "tour-blocker";
  overlay.addEventListener("click", (e) => e.stopPropagation());
  document.body.appendChild(overlay);
  STATE.overlay = overlay;

  // Popover
  const pop = document.createElement("div");
  pop.className = "tour-pop";
  pop.innerHTML = `
    ${step.title ? `<h4>${step.title}</h4>` : ""}
    <div class="tour-pop__content">${step.content || ""}</div>
    <div class="tour-pop__actions">
      ${index > 0 ? `<button class="tour-pop__btn" data-x="prev">Back</button>` : ""}
      <button class="tour-pop__btn" data-x="skip">Skip</button>
      <button class="tour-pop__btn tour-pop__btn--primary" data-x="next">${index < STATE.steps.length - 1 ? "Next" : "Done"}</button>
    </div>
  `;
  document.body.appendChild(pop);
  STATE.pop = pop;

  pop.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-x]");
    if (!btn) return;
    const x = btn.getAttribute("data-x");
    if (x === "prev") prev();
    else if (x === "next") next();
    else if (x === "skip") end();
  });

  // Initial position + arrow side
  const rect = el.getBoundingClientRect();
  const placement = step.placement || pickPlacement(rect);
  placePop(pop, rect, placement);

  // Track scroll/resize globally (capture phase catches modal scrollers)
  window.addEventListener("resize", onReposition);
  window.addEventListener("scroll", onReposition, true);
}

function next() {
  STATE.i = Math.min(STATE.i + 1, STATE.steps.length);
  renderStep(STATE.i);
}
function prev() {
  STATE.i = Math.max(STATE.i - 1, 0);
  renderStep(STATE.i);
}
function end() {
  clearStep();
  const cb = STATE.onEnd;
  STATE.steps = []; STATE.i = 0; STATE.onEnd = null;
  if (cb) cb();
}

/** Public API */
export function startTour(steps, { onEnd } = {}) {
  STATE.steps = Array.isArray(steps) ? steps : [];
  STATE.i = 0; STATE.onEnd = typeof onEnd === "function" ? onEnd : null;
  renderStep(0);
}

/* Optional global for quick manual triggering from console */
if (typeof window !== "undefined") {
  window.MyFiTour = { startTour };
}
