/**
 * Modal: Profile
 * UI surface only.
 * - Fetches model from profile feature pack.
 * - Emits intents (settings/help) rather than importing modal paths.
 */
import { open as openModal } from '../core/modal.js';
import { getFeature } from '../features/registry.js';

export async function openProfileModal(owner = 'hub') {
  const profile = getFeature('profile').api;

  const p = await profile.getSummary();

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <div class="modal-head">
      <div class="modal-head-title">Profile</div>
      <div class="modal-head-sub">${escapeHtml(p.displayName)}</div>
    </div>

    <div class="modal-body">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <div style="width:64px;height:64px;border-radius:14px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:28px;">🧑‍🚀</span>
        </div>
        <div>
          <div style="font-weight:700;font-size:16px;">${escapeHtml(p.alias)}</div>
          <div style="opacity:.8;font-size:13px;">Level ${Number(p.level || 1)}</div>
        </div>
      </div>

      <div style="border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;">
        <div style="font-weight:700;margin-bottom:6px;">Emberward</div>
        <div style="opacity:.8;font-size:13px;line-height:1.4;">
          ${escapeHtml(p.emberward?.note || '')}
        </div>
      </div>

      <div style="height:10px;"></div>

      <div style="border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;">
        <div style="font-weight:700;margin-bottom:6px;">Quick actions</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="modal-btn" data-act="settings">Settings</button>
          <button class="modal-btn" data-act="help">Help</button>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="modal-btn" data-act="close">Close</button>
    </div>
  `;

  const modalRef = openModal({
    owner,
    scope: 'screen',
    content: tpl.content
  });

  const card = modalRef.node?.querySelector?.('.modal-card');
  card?.querySelector('[data-act="close"]')?.addEventListener('click', () => modalRef.close());

  card?.querySelector('[data-act="settings"]')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('hub:intent', { detail: { type: 'openSettings' } }));
    modalRef.close();
  });

  card?.querySelector('[data-act="help"]')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('hub:intent', { detail: { type: 'openHelp' } }));
    modalRef.close();
  });

  return modalRef;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
