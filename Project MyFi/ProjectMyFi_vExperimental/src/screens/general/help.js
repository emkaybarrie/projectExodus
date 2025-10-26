// help-modal.js
import { open as openModal } from '../../core/modal.js';

export function openHelpModal(owner='hub') {
  const content = `
    <div style="display:grid;gap:16px;padding:16px;min-width:min(380px,90vw);max-width:90vw;color:#fff;">
      <header style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-family:'Cinzel',serif;font-size:16px;letter-spacing:.06em;">Help & Support</div>
          <div style="font-size:12px;opacity:.7;">Tips, FAQs, contact</div>
        </div>
      </header>

      <section style="display:grid;gap:12px;font-size:14px;line-height:1.4;">
        <div>
          <strong>What is Essence?</strong><br>
          Essence is your available, flexible energy (cash-like resource).
        </div>
        <div>
          <strong>What is Emberward?</strong><br>
          Emberward tracks recurring drains like rent, bills, etc., so you see net flow.
        </div>
        <div>
          <strong>Need help?</strong><br>
          Reach out via the community or send feedback through Settings → Support.
        </div>
      </section>

      <footer style="display:flex;justify-content:flex-end;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);">
        <button id="help-close"
          style="border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font-size:14px;padding:8px 12px;cursor:pointer;">
          Close
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
  cardEl.querySelector('#help-close')?.addEventListener('click', () => {
    ref.close();
  });
}
