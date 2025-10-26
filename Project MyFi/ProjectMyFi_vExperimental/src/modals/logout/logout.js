// logout-modal.js
import { open as openModal } from '../../core/modal.js';
import { logoutUser } from '../../screens/auth/modules/auth.js';

export function openLogoutConfirmModal(owner='hub') {
  const content = `
    <div style="display:grid;gap:16px;padding:16px;min-width:260px;max-width:90vw;color:#fff;">
      <header style="display:grid;gap:4px;">
        <div style="font-family:'Cinzel',serif;font-size:16px;letter-spacing:.06em;color:#fff;">
          Sign out?
        </div>
        <div style="font-size:12px;opacity:.7;">
          You’ll go back to the start screen.
        </div>
      </header>

      <footer style="display:flex;justify-content:flex-end;gap:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);">
        <button id="logout-cancel"
          style="border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font-size:14px;padding:8px 12px;cursor:pointer;">
          Cancel
        </button>
        <button id="logout-do"
          style="border-radius:10px;border:1px solid rgba(255,80,80,.4);background:rgba(255,80,80,.15);box-shadow:0 0 12px rgba(255,80,80,.4);color:#fff;font-size:14px;padding:8px 12px;font-weight:600;cursor:pointer;">
          Sign out
        </button>
      </footer>
    </div>
  `;

  const ref = openModal({
    owner,
    scope: 'screen',
    content
  });

  const cardEl = document.querySelector('#modal-root .modal-card:last-child');
  cardEl.querySelector('#logout-cancel')?.addEventListener('click', () => {
    ref.close();
  });
  cardEl.querySelector('#logout-do')?.addEventListener('click', () => {
    ref.close();
    logoutUser(); // your navigate('start')+signOut flow
  });
}
