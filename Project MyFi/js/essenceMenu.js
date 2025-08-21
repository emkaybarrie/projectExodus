// js/essenceMenu.js
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

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
      catch { alert('Copy failed'); }
    });
    return b;
  }

  function kvRow(label, value, copyable = true) {
    const wrap = document.createElement('div'); wrap.className = 'field';
    const row  = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.style.alignItems='center';
    const l = document.createElement('label'); l.textContent = label;
    const v = document.createElement('div'); v.className = 'current-value'; v.textContent = value;
    v.style.flex = '1';
    row.append(l, v, copyable ? copyBtn(value) : null);
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

  // Show monthly “available Essence” approximation based on current regen/spend
  async function getEssenceAvailableMonthly(uid) {
    try {
      const curSnap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
      if (!curSnap.exists()) return 0;

      const pools = curSnap.data()?.pools || {};
      const e = pools.essence || {};
      const regenBaseline = Number(e.regenBaseline || 0);
      const regenCurrent  = Number(e.regenCurrent  || regenBaseline);
      const spentToDate   = Number(e.spentToDate   || 0);

      let startMs = Date.now();
      const pSnap = await getDoc(doc(db, `players/${uid}`));
      if (pSnap.exists()) {
        const raw = pSnap.data()?.startDate;
        if (raw?.toMillis) startMs = raw.toMillis();
        else if (raw instanceof Date) startMs = raw.getTime();
        else if (typeof raw === 'number') startMs = raw;
      }
      const MS_PER_DAY = 86400000;
      const days = Math.max(0, (Date.now() - startMs) / MS_PER_DAY);

      const capMonthly = regenBaseline * 30;
      const T = Math.max(0, regenCurrent * days - spentToDate);
      const r = capMonthly > 0 ? ((T % capMonthly) + capMonthly) % capMonthly : 0;
      return Math.max(0, r);
    } catch {
      return 0;
    }
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

        // Amount
        const amountWrap = document.createElement('div');
        amountWrap.className = 'field';
        const lab = document.createElement('label'); lab.textContent = 'Amount (£ / Essence)';
        const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.step = '1'; input.id = 'contribAmount'; input.className = 'input';
        amountWrap.append(lab, input);

        // Tabs
        const tabs = document.createElement('div');
        tabs.className = 'subnav';
        const btnStripe = document.createElement('button'); btnStripe.className = 'btn seg--current'; btnStripe.textContent = 'Stripe (Card / Wallet)';
        const btnBank   = document.createElement('button'); btnBank.className   = 'btn'; btnBank.textContent = 'Bank Transfer (No fees)';
        const btnPBB    = document.createElement('button'); btnPBB.className    = 'btn'; btnPBB.textContent = 'Pay by Bank (Coming soon)';
        tabs.append(btnStripe, btnBank, btnPBB);

        const body = document.createElement('div'); body.style.display = 'grid'; body.style.gap = '10px';

        // Stripe view
        const stripeView = (() => {
          const wrap = document.createElement('div');
          const d = document.createElement('div'); d.className='helper'; d.innerHTML = `Fast checkout via card / Apple Pay / Google Pay.`;
          const go = document.createElement('button');
          go.className = 'btn btn--accent';
          go.textContent = 'Continue with Stripe';
          go.addEventListener('click', async () => {
            const u = auth.currentUser; if (!u) return;
            const amount = Math.max(0, Number(input.value || 0));
            if (!amount) { alert('Enter amount'); return; }
            try {
              const app = getApp();
              const functions = getFunctions(app, 'europe-west2');
              // connectFunctionsEmulator(functions, '127.0.0.1', 5001);
              const fn = httpsCallable(functions, 'createContributionCheckout');
              const returnUrl = window.location.href.split('#')[0] + '#vitals';
              const { data } = await fn({ amountGBP: amount, returnUrl });
              if (data?.url) window.location.href = data.url;
              else alert('Could not create checkout session.');
            } catch (err) {
              console.error('[Stripe] create session error', err);
              alert(err?.message || 'Checkout error');
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
          confirm.textContent = 'I’ve sent the transfer';
          confirm.addEventListener('click', async () => {
            const user = await ensureUser(); if (!user) return;
            const uid = user.uid;

            const amount = Math.max(0, Number(document.getElementById('contribAmount')?.value || 0));
            if (!amount) { alert('Enter amount'); return; }

            const ref = bankView.querySelector('[data-reference]')?.dataset?.reference
                     || `MYFI-${shortUid(uid)}-${Date.now()}`;

            const id = `contrib_${Date.now()}`;
            await setDoc(doc(db, `players/${uid}/contributions/${id}`), {
              amountGBP: amount,
              essenceCost: amount,
              provider: 'manual_bank',
              providerRef: ref,
              status: 'awaiting_settlement',
              createdAt: serverTimestamp(),
            }, { merge: true });

            alert('Thanks! We’ll credit Altruism once the transfer lands.');
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
        }

        btnStripe.addEventListener('click', ()=> show(btnStripe));
        btnBank  .addEventListener('click', ()=> show(btnBank));
        btnPBB   .addEventListener('click', ()=> show(btnPBB));

        root.append(availableRow, amountWrap, tabs, body);

        // init
        (async () => {
          const user = await ensureUser(); if (!user) return;
          const avail = await getEssenceAvailableMonthly(user.uid);
          const elVal = root.querySelector('#ess-available');
          if (elVal) elVal.textContent = fmtGBP(avail);
          show(btnBank); // default to Bank Transfer
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
