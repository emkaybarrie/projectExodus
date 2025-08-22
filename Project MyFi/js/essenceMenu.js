// js/essenceMenu.js
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFunctions, httpsCallable/*, connectFunctionsEmulator*/ } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getEssenceAvailableMonthlyFromHUD } from './hud/modules/vitals.js';

(function () {
  const { open, setMenu, el } = window.MyFiModal;

  const db = getFirestore();
  const auth = getAuth();

  /* ------------------------------ helpers ------------------------------ */
  const fmtGBP   = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(n) || 0);
  const toISODate= (ms) => new Date(ms).toISOString().slice(0,10);
  const shortUid = (uid) => (uid || '').slice(0, 6) || 'PLAYER';

  async function ensureUser() {
    if (auth.currentUser) return auth.currentUser;
    return await new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u || null); });
    });
  }

  function copyBtn(text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = 'Copy';
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); b.textContent = 'Copied!'; setTimeout(()=>b.textContent='Copy', 1200); }
      catch { /* keep silent: UX*/ }
    });
    return b;
  }

  function kvRow(label, value, copyable = true) {
    const wrap = document.createElement('div'); wrap.className = 'field';
    const row  = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.style.alignItems='center';
    const l = document.createElement('label'); l.textContent = label;
    const v = document.createElement('div'); v.className = 'current-value'; v.textContent = value;
    v.style.flex = '1';
    if (copyable) row.append(l, v, copyBtn(value)); else row.append(l, v);
    wrap.appendChild(row);
    return wrap;
  }

  async function readBankConfig() {
    try {
      const snap = await getDoc(doc(db, 'appConfig', 'payments'));
      const d = snap.exists() ? snap.data() : {};
      return d.bank || null;
    } catch { return null; }
  }

  // Show monthly “available Essence” approximation, aligned with HUD seeding
  async function getEssenceAvailableMonthly(uid) {
    return await getEssenceAvailableMonthlyFromHUD(uid);
  }


  /* ------------------------------ Contribute (MenuItem) ------------------------------ */
  function ContributeMenu() {
    return {
      label: 'Contribute',
      title: 'Contribute Essence',
      preview: 'Turn Essence into Credits to support development. Choose Stripe (card/wallet) or no‑fee bank transfer.',
      ctaLabel: 'Open',
      render() {
        const root = document.createElement('div');

        // Available Essence (Monthly)
        const availableRow = document.createElement('div');
        availableRow.className = 'field';
        availableRow.innerHTML = `
          <div class="current-row">
            <label>Available Essence (Monthly)</label>
            <div id="ess-available" class="current-value">—</div>
          </div>
        `;

        // Amount + inline error
        const amountWrap = document.createElement('div');
        amountWrap.className = 'field';
        const lab = document.createElement('label'); lab.textContent = 'Amount (£ / Essence)';
        const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.step = '1'; input.id = 'contribAmount'; input.className = 'input';
        const errorP = document.createElement('p'); errorP.id = 'contribError'; errorP.className = 'form-error'; errorP.setAttribute('role','alert'); errorP.setAttribute('aria-live','polite');
        amountWrap.append(lab, input, errorP);

        // Tabs
        const tabs = document.createElement('div');
        tabs.className = 'subnav';
        const btnStripe = document.createElement('button'); btnStripe.className = 'btn seg--current'; btnStripe.textContent = 'Stripe (Card / Wallet)';
        const btnBank   = document.createElement('button'); btnBank.className   = 'btn'; btnBank.textContent = 'Bank Transfer (No fees)';
        const btnPBB    = document.createElement('button'); btnPBB.className    = 'btn'; btnPBB.textContent = 'Pay by Bank (Coming soon)';
        tabs.append(btnStripe, btnBank, btnPBB);

        const body = document.createElement('div'); body.style.display = 'grid'; body.style.gap = '10px';

        // shared validation state
        let available = 0;
        function setError(msg) {
          errorP.textContent = msg || '';
          const invalid = Boolean(msg);
          if (invalid) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
          // disable CTA in whichever tab is showing
          const currentCta = body.querySelector('button[data-role="primary-cta"]');
          if (currentCta) {
            currentCta.disabled = invalid;
            currentCta.setAttribute('aria-disabled', invalid ? 'true' : 'false');
          }
        }
        function validate() {
          const raw = (input.value || '').trim();
          if (raw === '') { setError(''); return { ok: false }; }
          const n = Number(raw);
          if (!Number.isFinite(n)) { setError('Enter a valid number.'); return { ok: false }; }
          if (n <= 0) { setError('Amount must be greater than £0.'); return { ok: false }; }
          if (n > available) { setError(`You only have £${available.toFixed(2)} Essence available.`); return { ok: false }; }
          setError('');
          return { ok: true, value: n };
        }
        input.addEventListener('input', validate);

        // Stripe view
        const stripeView = (() => {
          const wrap = document.createElement('div');
          const d = document.createElement('div'); d.className='helper'; d.innerHTML = `Fast checkout via card / Apple Pay / Google Pay.`;
          const go = document.createElement('button');
          go.className = 'btn btn--accent';
          go.dataset.role = 'primary-cta';
          go.textContent = 'Continue with Stripe';
          go.disabled = true; go.setAttribute('aria-disabled','true');
          go.addEventListener('click', async () => {
            const u = auth.currentUser; if (!u) return;
            const v = validate(); if (!v.ok) return;

            try {
              const app = getApp();
              const functions = getFunctions(app, 'europe-west2');
              // connectFunctionsEmulator(functions, '127.0.0.1', 5001);
              const fn = httpsCallable(functions, 'createContributionCheckout');
              const returnUrl = window.location.href.split('#')[0] + '#vitals';
              const { data } = await fn({ amountGBP: v.value, returnUrl });
              if (data?.url) window.location.href = data.url;
              else setError('Could not create checkout session.');
            } catch (err) {
              setError(err?.message || 'Checkout error. Please try again.');
            }
          });
          wrap.append(d, go);
          return wrap;
        })();

        // Bank transfer view
        const bankView = (() => {
          const wrap = document.createElement('div');

          const hint = document.createElement('div');
          hint.className = 'helper';
          hint.innerHTML = `Send a bank transfer from your Monzo/other bank. Use the reference shown so we can match it.`;

          const bankBlock = document.createElement('div');
          bankBlock.append(hint);

          (async () => {
            const user = await ensureUser(); if (!user) return;
            const uid = user.uid;

            const cfg = (await readBankConfig()) || {};
            const today = toISODate(Date.now()).replace(/-/g,'');
            const ref = `MYFI-${shortUid(uid).toUpperCase()}-${today}`;

            const rows = [];
            rows.push(kvRow('Account name', cfg.accountName || 'MyFi Ltd', true));
            rows.push(kvRow('Sort code',    cfg.sortCode    || '00-00-00', true));
            rows.push(kvRow('Account no.',  cfg.accountNumber || '00000000', true));
            if (cfg.iban) rows.push(kvRow('IBAN', cfg.iban, true));
            rows.push(kvRow('Reference',    ref, true));
            rows.forEach(r => bankBlock.append(r));
            if (cfg.instructions) {
              const extra = document.createElement('div'); extra.className='helper'; extra.textContent = cfg.instructions; bankBlock.append(extra);
            }
            bankBlock.dataset.reference = ref;
          })();

          const confirm = document.createElement('button');
          confirm.className = 'btn btn--accent';
          confirm.dataset.role = 'primary-cta';
          confirm.textContent = 'I’ve sent the transfer';
          confirm.disabled = true; confirm.setAttribute('aria-disabled','true');

          confirm.addEventListener('click', async () => {
            const v = validate(); if (!v.ok) return;
            const user = await ensureUser(); if (!user) return;
            const uid = user.uid;

            const ref = bankView.querySelector('[data-reference]')?.dataset?.reference
                     || `MYFI-${shortUid(uid)}-${Date.now()}`;

            const id = `contrib_${Date.now()}`;
            await setDoc(doc(db, `players/${uid}/contributions/${id}`), {
              amountGBP: v.value,
              essenceCost: v.value,
              provider: 'manual_bank',
              providerRef: ref,
              status: 'awaiting_settlement',
              createdAt: serverTimestamp(),
            }, { merge: true });

            window.MyFiModal.close();
          });

          wrap.append(bankBlock, confirm);
          wrap.dataset.reference = '';
          return wrap;
        })();

        // Pay-by-Bank (placeholder)
        const pbbView = (() => {
          const wrap = document.createElement('div');
          const info = document.createElement('div'); info.className = 'helper';
          info.textContent = 'Pay by Bank (TrueLayer) is coming soon.';
          wrap.append(info);
          return wrap;
        })();

        function show(tab) {
          [btnStripe, btnBank, btnPBB].forEach(b => b.classList.remove('seg--current'));
          tab.classList.add('seg--current');
          body.replaceChildren(
            tab === btnStripe ? stripeView :
            tab === btnBank   ? bankView   :
                                pbbView
          );
          // re-evaluate current CTA enabled state against current input value
          validate();
        }

        btnStripe.addEventListener('click', ()=> show(btnStripe));
        btnBank  .addEventListener('click', ()=> show(btnBank));
        btnPBB   .addEventListener('click', ()=> show(btnPBB));

        root.append(availableRow, amountWrap, tabs, body);

        // init
        (async () => {
          const user = await ensureUser(); if (!user) return;
          available = await getEssenceAvailableMonthly(user.uid);
          const elVal = root.querySelector('#ess-available');
          if (elVal) elVal.textContent = fmtGBP(available);
          show(btnStripe); // default to Bank Transfer
        })();

        return [root];
      },
      footer() { 
        const close = document.createElement('button');
        close.className = 'btn'; close.type = 'button'; close.textContent = 'Close';
        close.addEventListener('click', ()=> window.MyFiModal.close());
        return [close];
      }
    };
  }

  const EssenceMenu = {
    contribute: ContributeMenu(),
  };

  // Main Essence button → drill‑down (list + preview → detail)
  document.getElementById('essence-btn')?.addEventListener('click', async () => {
    await ensureUser();
    setMenu(EssenceMenu);
    open('contribute', { variant: 'drilldown', menuTitle: 'Actions' });
  });
})();
