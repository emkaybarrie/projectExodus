// settings-modal.js (new helper file you create)
import { open as openModal } from '../../core/modal.js'; // adjust path
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

export async function openSettingsModal(owner='hub') {
  const auth = getAuth();
  const db   = getFirestore();
  const fns  = getFunctions(undefined, 'europe-west2');

  const uid = auth?.currentUser?.uid;
  let initial = { alias:'', firstName:'', lastName:'', vitalsMode:'standard' };

  if (uid) {
    try {
      const snap = await getDoc(doc(db, "players", uid));
      if (snap.exists()) {
        const d = snap.data() || {};
        initial.alias      = d.alias || '';
        initial.firstName  = d.firstName || '';
        initial.lastName   = d.lastName || '';
        initial.vitalsMode = d.vitalsMode || 'standard';
      }
    } catch(e){ console.warn('[SettingsModal] load failed', e); }
  }

  // build DOM for modal body
  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <div class="modal-section" style="display:grid;gap:16px;padding:16px;min-width:min(420px,90vw);max-width:90vw;color:#fff;">
      <header style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;row-gap:8px;">
        <div>
          <div style="font-family:'Cinzel',serif;font-size:16px;letter-spacing:.06em;">Settings</div>
          <div style="font-size:12px;opacity:.7;">Your profile & preferences</div>
        </div>
      </header>

      <section style="display:grid;gap:12px;">
        <label style="display:grid;gap:4px;">
          <span style="font-size:12px;opacity:.8;">Alias</span>
          <input id="set-alias" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.3);color:#fff;font-size:14px;">
          <div id="alias-error" style="color:#ff6b6b;font-size:12px;min-height:16px;"></div>
        </label>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label style="display:grid;gap:4px;">
            <span style="font-size:12px;opacity:.8;">First name</span>
            <input id="set-first" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.3);color:#fff;font-size:14px;">
          </label>

          <label style="display:grid;gap:4px;">
            <span style="font-size:12px;opacity:.8;">Last name</span>
            <input id="set-last" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.3);color:#fff;font-size:14px;">
          </label>
        </div>

        <label style="display:grid;gap:4px;">
          <span style="font-size:12px;opacity:.8;">Vitals display mode</span>
          <select id="set-vitals" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.3);color:#fff;font-size:14px;">
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
          </select>
          <div style="font-size:12px;opacity:.6;">Controls how much detail shows in your vitals view.</div>
        </label>
      </section>

      <footer style="display:flex;justify-content:flex-end;gap:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);">
        <button id="settings-cancel"
          style="border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font-size:14px;padding:8px 12px;cursor:pointer;">
          Close
        </button>
        <button id="settings-save"
          style="border-radius:10px;border:1px solid rgba(120,140,255,.4);background:rgba(120,140,255,.15);box-shadow:0 0 12px rgba(120,140,255,.4);color:#fff;font-size:14px;padding:8px 12px;font-weight:600;cursor:pointer;">
          Save
        </button>
      </footer>
    </div>
  `;

  const frag = tpl.content;
  const aliasInput = frag.querySelector('#set-alias');
  const firstInput = frag.querySelector('#set-first');
  const lastInput  = frag.querySelector('#set-last');
  const vitalsSel  = frag.querySelector('#set-vitals');
  const aliasErr   = frag.querySelector('#alias-error');

  aliasInput.value = initial.alias;
  firstInput.value = initial.firstName;
  lastInput.value  = initial.lastName;
  vitalsSel.value  = initial.vitalsMode;

  const ALIAS_RE = /^[a-zA-Z0-9_-]{3,32}$/;

  function showAliasError(msg) {
    aliasErr.textContent = msg || '';
  }

  aliasInput.addEventListener('input', () => {
    const raw = aliasInput.value.trim();
    if (!ALIAS_RE.test(raw)) {
      showAliasError('Use 3–32 chars: letters, numbers, _ or -.');
    } else {
      showAliasError('');
    }
  });

  const modalRef = openModal({
    owner,
    scope: 'screen',
    content: frag
  });

  // wire buttons
  const rootEl = modalRef ? modalRef : null; // modalRef doesn't expose node directly,
  // BUT we can reach it via document.querySelector('#modal-root .modal-card:last-child')
  const cardEl = document.querySelector('#modal-root .modal-card:last-child');

  cardEl.querySelector('#settings-cancel')?.addEventListener('click', () => {
    modalRef.close();
  });

  cardEl.querySelector('#settings-save')?.addEventListener('click', async () => {
    const newAlias  = aliasInput.value.trim();
    const newFirst  = firstInput.value.trim();
    const newLast   = lastInput.value.trim();
    const newVitals = vitalsSel.value;

    // local format check
    if (!ALIAS_RE.test(newAlias)) {
      showAliasError('Use 3–32 chars: letters, numbers, _ or -.');
      return;
    }
    showAliasError('');

    if (!uid) { modalRef.close(); return; }

    // 1) update alias if changed
    try {
      if (newAlias !== initial.alias) {
        const setAlias = httpsCallable(fns, 'setAlias');
        await setAlias({ alias: newAlias });
        initial.alias = newAlias;
      }
    } catch(e) {
      console.warn('[Settings] alias error', e);
      showAliasError('Alias not available.');
      return;
    }

    // 2) update profile doc
    try {
      await updateDoc(doc(db, "players", uid), {
        firstName: newFirst,
        lastName:  newLast,
        vitalsMode: newVitals
      });
    } catch(e) {
      console.warn('[Settings] save failed', e);
      alert('Could not save right now.');
      return;
    }

    modalRef.close();
  });
}
