// ErrorCard Part — Fallback for missing bindings or Part errors
// Part of I1-Hub-Phase1-Scaffold

export default async function mount(host, { id, kind, error, slotId }) {
  const errorMessage = error?.message || error || 'Unknown error';
  const errorStack = error?.stack || '';

  // Log to console with full details
  console.error(`[ErrorCard] Part binding failed for slot "${slotId || id}"`, {
    requestedKind: kind,
    error: errorMessage,
    stack: errorStack,
  });

  host.innerHTML = `
    <div class="Part-ErrorCard ErrorCard">
      <div class="ErrorCard__icon">⚠</div>
      <div class="ErrorCard__title">Part Error</div>
      <div class="ErrorCard__message">
        <strong>Slot:</strong> ${slotId || id || 'unknown'}<br>
        <strong>Part:</strong> ${kind || 'unknown'}<br>
        <strong>Error:</strong> ${escapeHtml(errorMessage)}
      </div>
    </div>
  `;

  return {
    unmount() {
      host.innerHTML = '';
    },
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
