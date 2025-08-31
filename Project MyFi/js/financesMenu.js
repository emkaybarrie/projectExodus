// js/financesMenu.js
import { initHUD } from './hud/hud.js';
import { connectTrueLayerAccount } from './core/truelayer.js';
import {
  updateIncome,
  updateCoreExpenses,
  getDailyIncome,
  getDailyCoreExpenses
} from './data/cashflowData.js';
import { addTransaction } from './data/financialData_USER.js';

import {
  getFirestore, doc, getDoc, setDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

(function () {
  const { el, open, setMenu } = window.MyFiModal;

  // ───────────────────────── helpers ─────────────────────────
  const fmtGBP = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(n) || 0);
  const fromDaily = (daily, cadence) => {
    const d = Number(daily) || 0;
    switch ((cadence || 'monthly').toLowerCase()) {
      case 'daily': return d;
      case 'weekly': return d * 7;
      default: return d * 30;
    }
  };

  const helper = (html) => { const d = document.createElement('div'); d.className = 'helper'; d.innerHTML = html; return d; };
  const field = (label, type, id, attrs = {}) => {
    const wrap = document.createElement('div'); wrap.className = 'field';
    const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label;
    const inp = document.createElement('input'); inp.type = type; inp.id = id; inp.className = 'input';
    Object.entries(attrs).forEach(([k, v]) => inp.setAttribute(k, v));
    wrap.append(lab, inp); return wrap;
  };
  const select = (label, id, options) => {
    const wrap = document.createElement('div'); wrap.className = 'field';
    const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label;
    const sel = document.createElement('select'); sel.id = id; sel.className = 'input';
    options.forEach(([val, text]) => {
      const o = document.createElement('option'); o.value = val; o.textContent = text; sel.appendChild(o);
    });
    wrap.append(lab, sel); return wrap;
  };
  const btn = (label, klass, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = `btn ${klass || ''}`; b.textContent = label; b.addEventListener('click', fn); return b; };
  const cancel = (l = 'Close') => btn(l, '', () => window.MyFiModal.close());
  const primary = (l = 'Save', fn) => btn(l, 'btn--accent', fn);

  const currentRow = (label, id) => {
    const wrap = document.createElement('div'); wrap.className = 'field';
    wrap.innerHTML = `
      <div class="current-row">
        <label>${label}</label>
        <div id="${id}" class="current-value">—</div>
      </div>`;
    return wrap;
  };
  function setCurrentDisplay(container, id, dailyValue, cadence = 'monthly') {
    const n = cadence === 'weekly' ? 7 : cadence === 'daily' ? 1 : 30;
    const node = container.querySelector(`#${id}`);
    if (node) node.textContent = fmtGBP((Number(dailyValue) || 0) * n);
  }

  async function ensureAuthReady() {
    const auth = getAuth();
    if (auth.currentUser) return auth.currentUser;
    return await new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user || null); });
    });
  }

  async function getPlayerCore() {
    const user = (getAuth()).currentUser;
    if (!user) return { uid: null, mode: 'standard', startMs: Date.now() };
    const uid = user.uid;
    const db = getFirestore();
    const p = await getDoc(doc(db, "players", uid));
    let mode = 'standard', startMs = Date.now();
    if (p.exists()) {
      const d = p.data() || {};
      mode = String(d.vitalsMode || 'standard').toLowerCase();
      const raw = d.startDate;
      if (raw?.toMillis) startMs = raw.toMillis();
      else if (raw instanceof Date) startMs = raw.getTime();
      else if (typeof raw === 'number') startMs = raw;
    }
    return { uid, mode, startMs };
  }

  function monthWindow(startMs) {
    const d = new Date(startMs);
    const startMonthStartMs = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const startDateMs = startMs;
    return { startMonthStartMs, startDateMs };
  }
  const toISODate = (ms) => new Date(ms).toISOString().slice(0, 10);

  function renderConnectBankInline() {
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.style.marginBottom = '1rem';

  const info = document.createElement('div');
  info.className = 'helper';
  info.innerHTML = 'Link your bank to fetch transactions automatically through TrueLayer. Safe, optional, and unlocks full game features.';

  const btn = document.createElement('button');
  btn.className = 'btn btn--accent';
  btn.textContent = 'Connect with TrueLayer';

  btn.addEventListener('click', async () => {
    try {
      await connectTrueLayerAccount();
      window.MyFiModal.close();
      await initHUD();
      // optional: reopen the Add Transaction view after successful connect
      window.MyFiOpenAddTransaction?.({ variant: 'single' });
    } catch (e) { console.warn('TrueLayer connect failed:', e); }
  });

  wrap.append(info, btn);
  return wrap;
  }



  // ───────────────────────── Unified Itemised storage ─────────────────────────
  const DEFAULT_INCOME_CATS = [
    ['salary', 'Salary/Wages'], ['bonus', 'Bonus'], ['side', 'Side Income'], ['other', 'Other']
  ];
  const DEFAULT_EXPENSE_CATS = [
    ['shelter', 'Rent/Mortgage'], ['bills', 'Bills'], ['groceries', 'Groceries'],
    ['transport', 'Transport'], ['debt', 'Debts'], ['other', 'Other']
  ];

  function storeKey(uid, kind)   { return `myfi:unified:${uid}:${kind}`; }
  function docPath(uid, kind)    { return `players/${uid}/cashflowData/itemised_${kind}`; }

  async function readUnified(uid, kind) {
    const db = getFirestore();
    const snap = await getDoc(doc(db, docPath(uid, kind)));
    if (!snap.exists()) return null;
    const d = snap.data() || {};
    return {
      mode: d.mode || 'totals',
      cadence: d.cadence || 'monthly',
      totalAmount: Number(d.totalAmount || 0),
      categories: (d.categories && typeof d.categories === 'object') ? d.categories : {}
    };
  }
  async function writeUnified(uid, kind, data) {
    const db = getFirestore();
    await setDoc(doc(db, docPath(uid, kind)), {
      mode: data.mode || 'totals',
      cadence: data.cadence || 'monthly',
      totalAmount: Number(data.totalAmount || 0),
      categories: data.categories || {},
      updatedAt: Date.now()
    }, { merge: true });
  }

  // ───────────────────────── Unified view builder ─────────────────────────
  function buildUnified(kind) {
    const isIncome = (kind === 'income');
    const root = document.createElement('div');

    const current = currentRow(isIncome ? 'Current Income' : 'Current Core Expenses', `${kind}-current`);
    const cadence = select('Cadence', `${kind}-cadence`, [['monthly','Monthly'], ['weekly','Weekly'], ['daily','Daily']]);
    const total   = field(isIncome ? 'Total Amount' : 'Total Amount', 'number', `${kind}-total`, { min: 0, step: '0.01', placeholder: isIncome ? 'e.g. 3200.00' : 'e.g. 1800.00' });

    const itemiseWrap = document.createElement('div');
    itemiseWrap.className = 'field';
    itemiseWrap.innerHTML = `
      <label class="checkbox">
        <input type="checkbox" id="${kind}-itemise-toggle" />
        <span>Itemise</span>
      </label>
      <div class="helper">Itemise to break down by category. In itemised mode, the total is the sum of categories.</div>
    `;

    const itemisedSection = document.createElement('div');
    itemisedSection.style.display = 'none';

    const cats = isIncome ? DEFAULT_INCOME_CATS : DEFAULT_EXPENSE_CATS;
    const categoriesWrap = document.createElement('div');
    categoriesWrap.className = 'field';
    categoriesWrap.innerHTML = `<label>Categories</label>`;
    const list = document.createElement('div');
    list.style.display = 'grid';
    list.style.gridTemplateColumns = '1fr auto';
    list.style.gap = '8px 10px';

    const catInputs = new Map();
    cats.forEach(([key, label]) => {
      const lab = document.createElement('div'); lab.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = '0.01'; inp.className = 'input';
      inp.dataset.key = key;
      catInputs.set(key, inp);
      list.append(lab, inp);
    });
    categoriesWrap.appendChild(list);
    itemisedSection.append(categoriesWrap);

    root.append(current, cadence, total, itemiseWrap, itemisedSection);

    (async () => {
      await ensureAuthReady();
      const daily = isIncome ? await getDailyIncome() : await getDailyCoreExpenses();
      setCurrentDisplay(root, `${kind}-current`, daily, 'monthly');
      const c = root.querySelector(`#${kind}-cadence`);
      const t = root.querySelector(`#${kind}-total`);
      if (c) c.value = 'monthly';
      if (t) t.value = fromDaily(daily, 'monthly').toFixed(2);
    })();

    const recomputeItemisedSum = () => {
      let sum = 0;
      catInputs.forEach(inp => { sum += Math.max(0, parseFloat(inp.value) || 0); });
      const on = root.querySelector(`#${kind}-itemise-toggle`)?.checked;
      const totalInput = root.querySelector(`#${kind}-total`);
      if (on && totalInput) totalInput.value = String(sum.toFixed(2));
      return sum;
    };

    function wireDraftPersistence() {
      const uid = getAuth().currentUser?.uid; if (!uid) return;
      const key = storeKey(uid, kind);
      const saveDraft = () => {
        const categories = {};
        catInputs.forEach((inp, k) => { categories[k] = Number(inp.value) || 0; });
        const data = {
          mode: root.querySelector(`#${kind}-itemise-toggle`)?.checked ? 'itemised' : 'totals',
          cadence: root.querySelector(`#${kind}-cadence`)?.value || 'monthly',
          totalAmount: Number(root.querySelector(`#${kind}-total`)?.value || 0),
          categories
        };
        localStorage.setItem(key, JSON.stringify(data));
        recomputeItemisedSum();
      };
      root.querySelector(`#${kind}-itemise-toggle`)?.addEventListener('change', saveDraft);
      root.querySelector(`#${kind}-cadence`)?.addEventListener('change', saveDraft);
      root.querySelectorAll(`#${kind}-total`).forEach(i => i.addEventListener('input', saveDraft));
      catInputs.forEach(inp => {
        inp.addEventListener('input', saveDraft);
        inp.addEventListener('change', saveDraft);
      });
    }

    async function applySavedAndDraft() {
      await ensureAuthReady();
      const uid = getAuth().currentUser?.uid; if (!uid) return;
      let saved = null;
      try { saved = await readUnified(uid, kind); } catch (_) {}
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem(storeKey(uid, kind)) || 'null'); } catch (_) {}

      const data = { mode: 'totals', cadence: 'monthly', totalAmount: 0, categories: {}, ...(saved || {}), ...(draft || {}) };
      const toggle = root.querySelector(`#${kind}-itemise-toggle`);
      const cEl = root.querySelector(`#${kind}-cadence`);
      const tEl = root.querySelector(`#${kind}-total`);
      if (toggle) toggle.checked = (data.mode === 'itemised');
      if (cEl) cEl.value = data.cadence;
      if (tEl) tEl.value = String(Number(data.totalAmount || 0).toFixed(2));

      catInputs.forEach((inp, k) => {
        const v = Number(data.categories?.[k] ?? 0);
        inp.value = Number.isFinite(v) ? String(v) : '0';
      });

      reflectItemiseMode();
      recomputeItemisedSum();
    }

    function reflectItemiseMode() {
      const on = root.querySelector(`#${kind}-itemise-toggle`)?.checked;
      itemisedSection.style.display = on ? '' : 'none';
      const totalInput = root.querySelector(`#${kind}-total`);
      if (totalInput) {
        totalInput.readOnly = !!on;
        totalInput.style.opacity = on ? '0.7' : '1';
      }
      if (on) recomputeItemisedSum();
    }

    root.querySelector(`#${kind}-itemise-toggle`)?.addEventListener('change', reflectItemiseMode);
    root.querySelector(`#${kind}-cadence`)?.addEventListener('change', recomputeItemisedSum);
    catInputs.forEach(inp => inp.addEventListener('input', recomputeItemisedSum));

    (async () => {
      await applySavedAndDraft();
      wireDraftPersistence();
    })();

    return {
      nodes: [root],
      async onSave() {
        await ensureAuthReady();
        const uid = getAuth().currentUser?.uid; if (!uid) return;

        const mode = root.querySelector(`#${kind}-itemise-toggle`)?.checked ? 'itemised' : 'totals';
        const cadence = root.querySelector(`#${kind}-cadence`)?.value || 'monthly';

        let totalAmount = 0;
        let categories = {};

        if (mode === 'itemised') {
          totalAmount = (function sum() { let s = 0; catInputs.forEach(inp => s += Math.max(0, Number(inp.value) || 0)); return s; })();
          catInputs.forEach((inp, k) => { categories[k] = Math.max(0, Number(inp.value) || 0); });
        } else {
          totalAmount = Math.max(0, Number(root.querySelector(`#${kind}-total`)?.value || 0));
          catInputs.forEach((inp, k) => { categories[k] = Math.max(0, Number(inp.value) || 0); });
        }

        await writeUnified(uid, kind, { mode, cadence, totalAmount, categories });

        if (isIncome) await updateIncome(totalAmount, cadence);
        else          await updateCoreExpenses(totalAmount, cadence);

        await initHUD();

        const daily = isIncome ? await getDailyIncome() : await getDailyCoreExpenses();
        setCurrentDisplay(root, `${kind}-current`, daily, 'monthly');

        localStorage.removeItem(storeKey(uid, kind));
      }
    };
  }

  function makeUnifiedEntry(kind, label, title, previewText) {
    return {
      label, title,
      preview: previewText, // used by drill‑down list screen
      ctaLabel: 'Open',
      render() {
        if (!this._view) this._view = buildUnified(kind);
        return this._view.nodes;
      },
      footer() {
        return [primary('Save', () => this._view?.onSave?.()), cancel()];
      }
    };
  }


  const FinancesMenu = {
    connectBank: {
      label: 'Connect Bank',
      title: 'Connect a Bank (COMING SOON - TEST MODE ONLY)',
      preview: 'Link your bank for automatic transaction sync (via TrueLayer). Unlocks full automation.',
      render() {
        const info = helper('Linking your bank lets the app fetch transactions automatically through TrueLayer. Safe, optional, and unlocks full game features.');
        const b = document.createElement('button');
        b.className = 'btn btn--accent';
        b.textContent = 'Connect with TrueLayer';
        b.addEventListener('click', async () => {
          try {
            await connectTrueLayerAccount();
            window.MyFiModal.close();
            await initHUD();
          } catch (e) { console.warn('TrueLayer connect failed:', e); }
        });
        return [info, b];
      },
      footer() { return [cancel()]; }
    },
    income:   makeUnifiedEntry('income',   'Income',        'Income',        'Set your recurring income and frequency. Input as a total or break it down by source.'),
    expenses: makeUnifiedEntry('expenses', 'Core Expenses', 'Core Expenses', 'Define your essential costs (things you must pay every month). Itemise by category or keep it simple with one total'),
    addTransaction: {
      label: 'Add Transaction',
      title: 'Add Transaction',
      preview: 'Log a one-off income or spending. Separate from your core expenses; you can optionally assign it to a pool.',
      render() {
        const root = document.createElement('div');
        // 👉 Add the inline Connect Bank block at the very top
        root.appendChild(renderConnectBankInline());

        const desc = field('Description', 'text', 'txDesc', { placeholder: 'e.g. Groceries' });
        const amt = field('Amount', 'number', 'txAmount', { min: 0, step: '0.01', placeholder: 'e.g. 23.40' });
        const type = select('Type', 'txType', [['debit', 'Expense'], ['credit', 'Income']]);
        const date = field('Date', 'date', 'txDate', {});
        const pool = select('Pool (optional)', 'txPool', [['', 'Unassigned'], ['stamina', 'Stamina'], ['mana', 'Mana']]);
        const note = helper('If left unassigned, the transaction is automatically tagged based on your avatar.  Default: Stamina.');

        (async () => {
          await ensureAuthReady();
          const { startMs } = await getPlayerCore();
          const { startDateMs } = monthWindow(startMs);
          const dateInput = date.querySelector('#txDate');

          if (dateInput) {
            // Disallow dates before the player’s start date
            dateInput.min = toISODate(startDateMs);
            const todayISO = toISODate(Date.now());
            dateInput.value = todayISO < dateInput.min ? dateInput.min : todayISO;
            dateInput.removeAttribute('max');
          }
        })();

        root.append(desc, amt, type, date, pool, note);
        return [root];
      },
      footer() {
        return [
          primary('Add', () => {
            const c = el.contentEl;
            const detail = {
              txDesc: c.querySelector('#txDesc')?.value || '',
              txAmount: Number(c.querySelector('#txAmount')?.value || 0),
              txType: c.querySelector('#txType')?.value || 'debit',
              txDate: c.querySelector('#txDate')?.value || '',
              txPool: c.querySelector('#txPool')?.value || ''
            };
            window.dispatchEvent(new CustomEvent('tx:add', { detail }));
          }),
          cancel()
        ];
      }
    },
    
  };

  // Open menu in DRILL‑DOWN mode
  document.getElementById('left-btn')?.addEventListener('click', async () => {
    await ensureAuthReady();
    setMenu(FinancesMenu);
    open('connectBank', { variant: 'drilldown', menuTitle: 'Actions' });
  });


  // Open Add Transaction directly (content view)
// Usage: window.MyFiOpenAddTransaction({ variant: 'single' })
window.MyFiOpenAddTransaction = async function (opts = {}) {
  const variant   = opts.variant || 'single';
  const menuTitle = opts.menuTitle || (variant === 'single' ? 'Add Transaction' : 'Actions');

  await ensureAuthReady();
  setMenu(FinancesMenu);
  open('addTransaction', { variant, menuTitle });

  // optional: focus first field when rendered
  setTimeout(() => document.getElementById('txDesc')?.focus(), 0);
};


  // ───────────────────────── Event handlers ─────────────────────────
  window.addEventListener('tx:add', async e => {
    await ensureAuthReady();
    const user = getAuth().currentUser;
    if (!user) return;

    const { startMs } = await getPlayerCore();
    const { startDateMs } = monthWindow(startMs);

    const detail = { ...e.detail };
    const type = String(detail.txType || 'debit');
    const amt = Math.abs(Number(detail.txAmount || 0));
    const sign = (type === 'debit') ? -1 : 1;
    detail.amount = sign * amt;

    if (detail.txPool === '') delete detail.txPool;

    // Enforce no pre-start entries (remove this block if you want pre-start dates to be allowed)
    const selDateMs = detail.txDate ? new Date(detail.txDate + 'T00:00:00Z').getTime() : Date.now();
    const finalMs = Math.max(selDateMs, startDateMs);
    detail.txDate = toISODate(finalMs);

    await addTransaction(detail);
    window.MyFiModal.close();
    await initHUD();
  });


})();
