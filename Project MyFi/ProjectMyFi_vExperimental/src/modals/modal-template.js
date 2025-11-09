// src/modals/_modal-template.js
// Standard Modal Template (A→F workflow, uniform content factories)
// Requires: openConfiguredModal (core/modal.js)
// Helper lib: ../modules/modal-helpers.js (you can grow this shared library)

// ─────────────────────────────────────────────────────────────
// A) INSTRUCTIONS
// -------------------------------------------------------------
/*
  - Rename this file & exported function for your modal.
  - Follow sections (B→F) in order.
  - Step D = your modal’s “functions library”: assign imported helpers here.
  - Step F = build header/sections/footer using the same content pattern
             (all are functions returning Node/Fragment/string).
*/

// ─────────────────────────────────────────────────────────────
// Imports
// -------------------------------------------------------------
import { openConfiguredModal } from '../core/modal.js';
import { buildTabs, buildSubTabs, buildPanels } from './modal-helpers.js';

// Utility: per-open unique id → used for auto-scoped CSS in modal.js
const genId = (p='modal') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

// ─────────────────────────────────────────────────────────────
// B) DEFAULT OPTIONS (owner/title/id + defaults for this modal)
// -------------------------------------------------------------
export function openExampleStandardModal(opts = {}) {
  const {
    owner   = 'general',             // screen owner for router cleanup
    title   = 'Example Modal',       // shown in sticky header
    modalId = genId('example'),      // not needed in your CSS—auto-scoped for you
  } = opts;

  // Body scroll default; sections can override in Step F
  const bodyScrollDefault = { direction: 'vertical', behavior: 'smooth', snap: 'none' };

  // Local modal state (if you need it)
  let bodyMode = 'vertical'; // 'vertical' | 'carousel'
  let api = null;

// ─────────────────────────────────────────────────────────────
// C) DATA / INPUTS (optional)
// -------------------------------------------------------------
// Put any incoming data adapters or lookups here (from store/gateway if needed).

// ─────────────────────────────────────────────────────────────
// D) MODAL FUNCTIONS LIBRARY (assign helpers you’ll use)
// -------------------------------------------------------------
  const fns = {
    tabs: buildTabs,
    subTabs: buildSubTabs,
    panels: buildPanels,
    // ← add/assign more helpers over time (pickers, lists, edit-rows, etc.)
  };

// ─────────────────────────────────────────────────────────────
// E) PER-MODAL CSS (auto-scoped; no need to track modalId)
// -------------------------------------------------------------
  const styles = `
    .tabbar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .tabbar-sm .tab { padding:6px 10px; font-size:12px; }
    .tabbar-md .tab { padding:8px 12px; font-size:14px; }
    .tab {
      border:1px solid rgba(255,255,255,.2);
      background:rgba(255,255,255,.06);
      color:#fff; border-radius:10px; cursor:pointer;
      transition: box-shadow .15s ease, border-color .15s ease, background .15s ease;
    }
    .tab.active {
      border-color: rgba(120,140,255,.45);
      background: rgba(120,140,255,.18);
      box-shadow: 0 0 10px rgba(120,140,255,.35) inset, 0 0 8px rgba(120,140,255,.25);
      font-weight: 600;
    }
    .subtabbar .tab.active {
      border-color: rgba(255,255,255,.35);
      box-shadow: inset 0 0 8px rgba(255,255,255,.18);
      background: rgba(255,255,255,.12);
    }
    .panel {
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 12px;
      padding: 12px;
      background: rgba(255,255,255,.04);
      min-height: 120px;
    }
  `;

// ─────────────────────────────────────────────────────────────
// F) CONTENT FACTORIES → OPEN MODAL → WIRE BEHAVIOUR
//    (Uniform pattern: header(), sections[].content(), footer())
// -------------------------------------------------------------

  // Header factory (returns Node/Fragment/string)
  function header() {
    const wrap = document.createElement('div');

    // Header text
    const headerText = document.createElement('div');
    headerText.style.marginBottom = '8px';
    headerText.innerHTML = `
      <div id="modalHeaderText">Example text for header section of modal</div>
    `
    wrap.appendChild(headerText);

    // Tabs in header
    const headerTabs = fns.tabs(
      [
        { id: 'overview', label: 'Overview' },
        { id: 'manage',   label: 'Manage'   },
      ],
      { activeId: 'overview', onChange: (id) => jumpToSection(id === 'overview' ? 'A' : 'B') }
    );
    wrap.appendChild(headerTabs.node);

    // Body mode selector
    const row = document.createElement('div');
    row.className = 'form-row';
    row.style.marginTop = '8px';
    row.innerHTML = `
      <div class="form-field">
        <div class="form-label">Body Mode</div>
        <select id="bodyMode" class="form-select">
          <option value="vertical">Vertical</option>
          <option value="carousel">Horizontal w/ snap</option>
        </select>
      </div>
    `;
    row.querySelector('#bodyMode').addEventListener('change', (e) => {
      bodyMode = e.target.value;
      applyBodyScrollMode();
    });
    wrap.appendChild(row);

    return wrap;
  }

  // Body sections (array of { id, content: () => Node|Fragment|string, scroll? })
  const sections = [
    {
      id: 'A',
      content: () => {
        // Vertical list of panels
        return fns.panels(
          [
            () => card('Overview Card 1', 'Some descriptive copy.'),
            () => card('Overview Card 2', 'More information here.'),
            () => card('Overview Card 3', 'Details and stats go here.'),
          ],
          { direction: 'vertical', snap: 'none' }
        );
      }
    },
    {
      id: 'B',
      // Horizontal carousel of full-width panels — snap at panel edges
      scroll: { direction: 'horizontal', behavior: 'smooth', snap: 'mandatory' },
      content: () => {
        // Optional sub-tabs for quick jumps inside the carousel
        const host = document.createElement('div');
        const sub = fns.subTabs(
          [
            { id: 'p1', label: 'Pane 1' },
            { id: 'p2', label: 'Pane 2' },
            { id: 'p3', label: 'Pane 3' },
          ],
          {
            activeId: 'p1',
            onChange: (id) => {
              const idx = { p1:0, p2:1, p3:2 }[id] ?? 0;
              const target = host.querySelectorAll('.panel')[idx];
              if (target) target.scrollIntoView({ behavior:'smooth', inline:'start', block:'nearest' });
            }
          }
        );
        host.appendChild(sub.node);

        host.appendChild(
          fns.panels(
            [
              () => card('Manage — Pane 1', 'Edit values or settings here.'),
              () => card('Manage — Pane 2', 'Advanced controls.'),
              () => card('Manage — Pane 3', 'Summary & actions.'),
            ],
            { direction:'horizontal', behavior:'smooth', snap:'mandatory', fullWidthPanels:true }
          )
        );
        return host;
      }
    },
    {
      id: 'C',
      content: `
        <div class="form-field">
          <div class="form-label">Section C</div>
          <div class="form-hint">Add anything else here.</div>
        </div>
      `
    },
  ];

  // Footer factory (returns Node; you can also keep using footer.buttons if preferred)
  function footer() {
    // Example: custom footer content + requestClose broadcast:
    const foot = document.createElement('div');
    const left = document.createElement('div');
    left.className = 'form-hint';
    left.textContent = 'Footer notes…';
    foot.appendChild(left);

    // Keep standard buttons by using modal system’s buttons instead (below).
    return foot;
  }

  // Open modal (uniform factories; styles auto-scoped)
  api = openConfiguredModal({
    owner,
    scope: 'screen',
    title,
    modalId,
    styles,
    header,           // function → Node/Fragment/string
    sections,         // array with content factories
    footer: {         // combine content + standard buttons (both supported)
      content: footer,
      buttons: [
        { label: 'Close',   onClick: (api) => api.close() },
        { label: 'Primary', variant: 'primary', onClick: () => {/* action */} },
      ]
    },
    scroll: bodyScrollDefault
  });

  // Uniform utilities
  function jumpToSection(id) {
    const el = api.body.querySelector(`.modal-section[data-section-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'start', inline:'nearest' });
  }
  function applyBodyScrollMode() {
    if (bodyMode === 'carousel') {
      api.setBodyScroll({ direction:'horizontal', behavior:'smooth', snap:'mandatory' });
    } else {
      api.setBodyScroll({ direction:'vertical', behavior:'smooth', snap:'none' });
      api.body.scrollTo({ top:0, left:0, behavior:'smooth' });
    }
  }

  // Initial paint
  applyBodyScrollMode();
  jumpToSection('A');

  return api;
}

// Small helper for cards in this template
function card(title, desc) {
  const n = document.createElement('div');
  n.className = 'panel';
  n.innerHTML = `<div style="font-weight:700; margin-bottom:6px;">${title}</div><div>${desc}</div>`;
  return n;
}
