// js/interactionGuards.js
export function installInteractionGuards(root = document) {
  const isAllowed = (t) => {
    if (!t) return false;
    // Any ancestor explicitly allowed, or native editable controls
    return !!t.closest('[data-allow-context], .allow-select, input, textarea, select, [contenteditable="true"]');
  };

  // Block right-click / context menu globally unless allowed
  root.addEventListener('contextmenu', (e) => {
    if (!isAllowed(e.target)) e.preventDefault();
  }, { capture: true });

  // Block text selection starts globally unless allowed
  root.addEventListener('selectstart', (e) => {
    if (!isAllowed(e.target)) e.preventDefault();
  }, { capture: true });

  // Block auxclick (middle/right) where applicable
  root.addEventListener('auxclick', (e) => {
    // button 2 = right
    if (e.button === 2 && !isAllowed(e.target)) e.preventDefault();
  }, { capture: true });

  // Block drag (e.g., long-press -> drag image)
  root.addEventListener('dragstart', (e) => {
    if (!isAllowed(e.target)) e.preventDefault();
  }, { capture: true });

  // NOTE: We do NOT preventDefault on touchstart to keep scrolling smooth.
  // Long-press menus are already handled via CSS (-webkit-touch-callout: none).
}
