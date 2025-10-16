let host, root;                     // host = #bg-host, root = .bg-space
let panoL, starsL, nebulaL, flareL, planetGlowL;
let mode = 'class';                 // 'class' or 'panorama'

// Defaults for flare/planet anchors (percent of the image)
let anchors = {
  sun:    { x: 60, y: 22 },
  planet: { x: 21, y: 24 },
};

export function setPanoramaAnchors({ sun, planet } = {}) {
  if (sun)    anchors.sun    = { x: sun[0],    y: sun[1]    };
  if (planet) anchors.planet = { x: planet[0], y: planet[1] };
  // push to CSS vars if layers exist
  if (flareL) {
    flareL.style.setProperty('--flare-x',  anchors.sun.x + '%');
    flareL.style.setProperty('--flare-y',  anchors.sun.y + '%');
  }
  if (planetGlowL) {
    planetGlowL.style.setProperty('--planet-x', anchors.planet.x + '%');
    planetGlowL.style.setProperty('--planet-y', anchors.planet.y + '%');
  }
}

export function applyBackground(key) {
  host = host || document.getElementById('bg-host');
  host.className = ''; // reset legacy classes

  mode = (key === 'panorama') ? 'panorama' : 'class';

  if (mode === 'panorama') {
    ensureSpace();
    ensureLayers();
    setPanoramaAnchors(anchors); // write defaults to CSS vars
    // clear transforms
    host.style.transform = 'none';
    root.style.transform = 'none';
  } else if (key) {
    destroySpace();              // remove layered mode cleanly
    host.classList.add('bg-' + key);
  }
}

/** Router calls this every time the plane moves (drag + glide) */
export function updateParallax(x, y) {
  if (mode !== 'panorama') return;

  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  const nx = clamp(x / vw, -1, 1);  // -1..1
  const ny = clamp(y / vh, -1, 1);

  // Pan ranges (percent away from center) per layer
  panBG(panoL,   nx, ny, 58, 52);   // base world
  panBG(starsL,  nx, ny, 66, 58);   // stars move more (closer)
  panBG(nebulaL, nx, ny, 52,  49);   // nebula moves less (farther)

  // Camera tilt (on host) + auto-stretch (on root) to hide edges when tilted
  const tiltDeg = 4; // feel free to tweak
  host.style.transform = `perspective(1000px) rotateX(${tiltDeg*ny}deg) rotateY(${-tiltDeg*nx}deg)`;

  // Scale up a little as you look off-axis to avoid gaps (simulates 3D)
  // 0.0 at center -> up to ~1.06 at extreme
  const stretch = 1 + 0.06 * Math.max(Math.abs(nx), Math.abs(ny));
  root.style.transform = `scale(${stretch})`;

  // Flare bias: brightens facing top-right “sun”; slight drift for depth
  if (flareL) {
    const towardSun = clamp((nx * 0.9) + (-ny * 0.4), -1, 1);
    const base = 0.25, gain = 0.55;
    flareL.style.opacity = String(base + gain * Math.max(0, towardSun));
    flareL.style.transform = `translate3d(${nx*8}px, ${ny*6}px, 0)`;
  }

  // Planet glow: slightly stronger when looking toward planet (left/top bias)
  if (planetGlowL) {
    const towardPlanet = clamp((-nx * 0.9) + (-ny * 0.3), -1, 1);
    planetGlowL.style.opacity = String(0.12 + 0.18 * Math.max(0, towardPlanet));
    planetGlowL.style.transform = `translate3d(${nx*4}px, ${ny*3}px, 0)`;
  }
}

/* ---------- internals ---------- */
function ensureSpace() {
  if (!root) {
    root = document.createElement('div');
    root.className = 'bg-space';
    host.appendChild(root);
  }
}

function destroySpace() {
  if (root && root.parentNode) root.parentNode.removeChild(root);
  root = panoL = starsL = nebulaL = flareL = planetGlowL = null;
}

function ensureLayers() {
  panoL       = panoL       || make('pano');
  starsL      = starsL      || make('stars');
  nebulaL     = nebulaL     || make('nebula');
  flareL      = flareL      || make('flare');
  planetGlowL = planetGlowL || make('planet-glow');
}

function make(kind) {
  const el = document.createElement('div');
  el.className = `layer ${kind}`;
  root.appendChild(el);
  return el;
}

function panBG(node, nx, ny, rangeX, rangeY) {
  if (!node) return;
  const px = 50 + nx * rangeX;
  const py = 50 + ny * rangeY;
  node.style.backgroundPosition = `${px}% ${py}%`;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
