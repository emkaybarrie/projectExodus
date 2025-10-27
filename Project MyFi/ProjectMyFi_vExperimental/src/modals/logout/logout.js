// logout-modal.js
import { open as openModal } from '../../core/modal.js';
import { logoutUser } from '../../screens/auth/modules/auth.js';

export function openLogoutConfirmModal(owner='hub') {
  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <div class="modal-head">
      <div class="modal-head-title">Sign out?</div>
      <div class="modal-head-sub">
        You’ll go back to the start screen.
      </div>
    </div>

    <div class="modal-body">
      <div style="font-size:14px;line-height:1.4;opacity:.8;">
        You can sign back in later and your data will still be here.
      </div>
    </div>

    <div class="modal-footer">
      <button class="modal-btn" id="logout-cancel">Cancel</button>
      <button class="modal-btn modal-btn-danger" id="logout-do">Sign out</button>
    </div>
  `;

  const ref = openModal({
    owner,
    scope: 'screen',
    content: tpl.content
  });

  const cardEl = document.querySelector('#modal-root .modal-card:last-child');

  cardEl.querySelector('#logout-cancel')?.addEventListener('click', () => {
    ref.close();
  });

  cardEl.querySelector('#logout-do')?.addEventListener('click', () => {
    ref.close();
    logoutUser(); // navigate('start') + signOut(auth)
  });
}
