// js/essenceMenu.js
// Standardised Essence menu. Keeps inline validation for amount, uses MyFiUI.
// Exposes window.MyFiEssenceMenu.

import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp,
  collection, query, where, onSnapshot, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFunctions, httpsCallable/*, connectFunctionsEmulator*/ } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getEssenceAvailableMonthlyFromHUD } from './vitals.js';
import { showToast } from '../js/core/toast.js';

(function () {
  const { helper, field, select, primary, cancel, danger, inlineError, setError, btnOpenItem, btnOpenMenu } = window.MyFiUI;

  const db = getFirestore();
  const auth = getAuth();

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
      catch { /* UX silence */ }
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

  // Toasts on successful contributions (Stripe or Bank)
  function startContributionSuccessToasts() {
    const lsKey = (uid) => `myfi:toasted:contributions:${uid}`;
    const loadSeen = (uid) => { try { return new Set(JSON.parse(localStorage.getItem(lsKey(uid)) || '[]')); } catch { return new Set(); } };
    const saveSeen = (uid, set) => { try { localStorage.setItem(lsKey(uid), JSON.stringify(Array.from(set))); } catch {} };

    (async () => {
      const u = await ensureUser(); if (!u) return;
      const uid = u.uid;
      const seen = loadSeen(uid);

      // expected IDs (set before Stripe redirect or manual-bank click)
      let expect = [];
      try { expect = JSON.parse(sessionStorage.getItem('myfi:expectContrib') || '[]').filter(Boolean); } catch {}

      const col = collection(db, `players/${uid}/contributions`);
      const q   = query(col, where('status', '==', 'succeeded'));

      // Warm-up: mark existing successes as seen, except expected ones
      try {
        const warm = await getDocs(q);
        warm.forEach(d => { if (!expect.includes(d.id)) seen.add(d.id); });
        saveSeen(uid, seen);
      } catch {}

      // If expected already succeeded, toast now
      for (const id of expect) {
        try {
          const snap = await getDoc(doc(db, `players/${uid}/contributions/${id}`));
          if (snap.exists() && snap.data()?.status === 'succeeded' && !seen.has(id)) {
            const amt = typeof snap.data().amountGBP === 'number' ? snap.data().amountGBP : null;
            showToast(amt != null ? `Alturium has been increased by £${amt.toFixed(2)}.` : `Alturium has been increased.`);
            seen.add(id);
          }
        } catch {}
      }
      saveSeen(uid, seen);
      try { sessionStorage.removeItem('myfi:expectContrib'); } catch {}

      // Live updates
      onSnapshot(q, (snap) => {
        snap.docChanges().forEach((chg) => {
          if (chg.type !== 'added' && chg.type !== 'modified') return;
          const id = chg.doc.id;
          if (seen.has(id)) return;

          const d = chg.doc.data() || {};
          const amt = typeof d.amountGBP === 'number' ? d.amountGBP : null;
          showToast(amt != null ? `Alturium has been increased by £${amt.toFixed(2)}.` : `Alturium has been increased.`);
          seen.add(id);
          saveSeen(uid, seen);
        });
      });
    })();
  }

  async function getEssenceAvailableMonthly(uid) {
    return await getEssenceAvailableMonthlyFromHUD(uid);
  }

  function ContributeMenu() {
    return {
      label: 'Contribute',
      title: 'Contribute Essence (Test Mode)',
      preview: 'Contribute your Essence to support development. Choose Stripe (card/wallet) or no-fee bank transfer.',
      ctaLabel: 'Open',
      render() {
        const root = document.createElement('div');

        // Available Essence (Monthly)
        const availableRow = document.createElement('div');
        availableRow.className = 'field';
        availableRow.innerHTML = `
          <div class="current-row">
            <label>Available Essence</label>
            <div id="ess-available" class="current-value">—</div>
          </div>
        `;

        // Amount + inline error
        const amountWrap = document.createElement('div');
        amountWrap.className = 'field';
        const lab = document.createElement('label'); lab.textContent = 'Amount (£ / Essence)';
        const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.step = '1'; input.id = 'contribAmount'; input.className = 'input';
        const errorP = inlineError('contribError');
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
        function disableCTA(disabled) {
          const currentCta = body.querySelector('button[data-role="primary-cta"]');
          if (currentCta) {
            currentCta.disabled = !!disabled;
            currentCta.setAttribute('aria-disabled', disabled ? 'true' : 'false');
          }
        }
        function validate() {
          const raw = (input.value || '').trim();
          if (raw === '') { setError(errorP, '', input); disableCTA(true); return { ok: false }; }

          const n = Number(raw);
          if (!Number.isFinite(n)) { setError(errorP, 'Enter a valid number.', input); disableCTA(true); return { ok: false }; }

          // Stripe needs ≥ £2 (fees), Bank can be ≥ £1
          const usingStripe = tabs.querySelector('.seg--current') === btnStripe;
          const min = usingStripe ? 2 : 1;

          if (n < min) {
            setError(errorP, `Minimum is £${min}${usingStripe ? ' for card checkout.' : '.'}`, input);
            disableCTA(true); return { ok: false };
          }

          if (n > available) {
            setError(errorP, `You only have £${available.toFixed(2)} Essence available.`, input);
            disableCTA(true); return { ok: false };
          }

          setError(errorP, '', input);
          disableCTA(false);
          return { ok: true, value: n };
        }

        input.addEventListener('input', validate);

        // Stripe view
        const stripeView = (() => {
          const wrap = document.createElement('div');
          const d = helper(`Fast checkout via card / Apple Pay / Google Pay.`);
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
              if (data?.url) {
                try {
                  const expect = JSON.parse(sessionStorage.getItem('myfi:expectContrib') || '[]');
                  expect.push(String(data.contributionId || ''));
                  sessionStorage.setItem('myfi:expectContrib', JSON.stringify(expect));
                } catch {}
                window.location.href = data.url;
              } else setError(errorP, 'Could not create checkout session.', input);
            } catch (err) {
              setError(errorP, err?.message || 'Checkout error. Please try again.', input);
            }
          });
          wrap.append(d, go);
          return wrap;
        })();

        // Bank transfer view
        const bankView = (() => {
          const wrap = document.createElement('div');

          const hint = helper('Send a transfer from your bank. Use the reference shown so we can match it.');
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
            if (cfg.instructions) bankBlock.append(helper(cfg.instructions));
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

            try {
              const expect = JSON.parse(sessionStorage.getItem('myfi:expectContrib') || '[]');
              expect.push(id);
              sessionStorage.setItem('myfi:expectContrib', JSON.stringify(expect));
            } catch {}

            window.MyFiModal.close();
          });

          wrap.append(bankBlock, confirm);
          wrap.dataset.reference = '';
          return wrap;
        })();

        // Pay-by-Bank (placeholder)
        const pbbView = (() => {
          const wrap = document.createElement('div');
          wrap.append(helper('Pay by Bank (TrueLayer) is coming soon.'));
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
          validate(); // refresh CTA state
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

          // If not enough Essence for Stripe fees, steer to Bank and message on Stripe
          if (available < 2) {
            show(btnBank);
            btnStripe.addEventListener('click', () => {
              setError(errorP, 'You need at least £2 Essence to use card checkout. Try Bank Transfer (no fees).', input);
            });
          } else {
            show(btnStripe);
          }
          validate();
        })();

        return [root];
      },
      footer() {
        return [ cancel() ];
      }
    };
  }

  function PurchaseMenu() {
  return {
    label: 'Purchase',
    title: 'Purchase Credits',
    preview: 'Buy spendable Credits for Myana (coming soon).',
    ctaLabel: 'Open',
    render() {
      const root = document.createElement('div');
      root.append(
        helper(`
          <p><strong>Credits (TBC)</strong> will let you pick up cosmetics, seasonal passes, boosts, and partner perks.</p>
          <p>This feature is <em>coming soon</em>. We’re finalising pricing and delivery so it feels fair, transparent, and optional.</p>
          <ul>
            <li>One-tap checkout (card/wallet) and fee-free bank transfer</li>
            <li>Instant wallet crediting with receipt in your Events Log</li>
            <li>Bonuses for streaks and supporter milestones</li>
          </ul>
          <p>Thanks for your patience while we finish wiring this up.</p>
        `)
      );

      const btn = document.createElement('button');
      btn.className = 'btn btn--accent';
      btn.textContent = 'Notify me when ready';
      btn.addEventListener('click', () => {
        try {
          // simple local flag; hook into your settings/profile later if you like
          localStorage.setItem('myfi:notifyPurchaseReady', '1');
          window.dispatchEvent(new CustomEvent('myfi:toast', { detail: { type:'success', text:'We’ll let you know in-app when Purchase goes live.' }}));
        } catch {}
        window.MyFiModal.close();
      });

      return [root, btn];
    },
    footer() { return [ cancel() ]; }
  };
}

function EmpowerMenu() {
  return {
    label: 'Empower',
    title: 'Empower Your Avatar',
    preview: 'Channel Essence into your Core via a conduit to unlock power (coming soon).',
    ctaLabel: 'Open',
    render() {
      const root = document.createElement('div');
      root.append(
        helper(`
          <p><strong>Empower</strong> lets you channel your saved Essence into a personal <em>Core</em> (your avatar’s heart).
          Through a <em>conduit</em>, you’ll unlock persistent bonuses and new skill interactions.</p>
          <ul>
            <li>Convert Essence → Core charge over time (with caps and tiers)</li>
            <li>Tie bonuses to your playstyle (Stamina/Mana/Health leaning)</li>
            <li>Seasonal conduits for special events in The Badlands</li>
          </ul>
          <p>This system is in active development. We’re designing it to be meaningful, not pay-to-win.</p>
        `)
      );

      const btn = document.createElement('button');
      btn.className = 'btn btn--accent';
      btn.textContent = 'Keep me posted';
      btn.addEventListener('click', () => {
        try {
          localStorage.setItem('myfi:notifyEmpowerReady', '1');
          window.dispatchEvent(new CustomEvent('myfi:toast', { detail: { type:'success', text:'Got it — we’ll ping you in-app when Empower is live.' }}));
        } catch {}
        window.MyFiModal.close();
      });

      return [root, btn];
    },
    footer() { return [ cancel() ]; }
  };
}


  const EssenceMenu = {
    contribute: ContributeMenu(),
    purchase:   PurchaseMenu(),   // NEW
    empower:    EmpowerMenu(),    // NEW
  };

  window.MyFiEssenceMenu = EssenceMenu;

  // start listening for successful contributions → toast
  startContributionSuccessToasts();

})();
