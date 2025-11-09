// settings-modal.js (new helper file you create)
import { open as openModal } from '../core/modal.js'; // adjust path
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
    <div class="modal-head">
      <div class="modal-head-title">Settings</div>
      <div class="modal-head-sub">Your profile & preferences</div>
    </div>

    <div class="modal-body">
      <div class="form-field">
        <label class="form-label">Alias</label>
        <input id="set-alias" class="form-input">
        <div id="alias-error" class="form-error"></div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label class="form-label">First name</label>
          <input id="set-first" class="form-input">
        </div>
        <div class="form-field">
          <label class="form-label">Last name</label>
          <input id="set-last" class="form-input">
        </div>
      </div>

      <div class="form-field">
        <label class="form-label">Vitals display mode</label>
        <select id="set-vitals" class="form-select">
          <option value="standard">Standard</option>
          <option value="detailed">Detailed</option>
        </select>
        <div class="form-hint">Controls how much detail shows in your vitals view.</div>
      </div>

      
    </div>

    <div class="modal-footer">
      <button id="settings-cancel" class="modal-btn">Close</button>
      <button id="settings-save" class="modal-btn modal-btn-primary">Save</button>
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
