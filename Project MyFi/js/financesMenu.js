// js/financesMenu.js
import { initHUD } from './hud/hud.js';
import { connectTrueLayerAccount } from './core/truelayer.js';
import { updateIncome, updateCoreExpenses, getDailyIncome, getDailyCoreExpenses } from './data/cashflowData.js';
import { addTransaction } from './data/financialData_USER.js';

import {
  getFirestore, doc, getDoc, setDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

(function(){
  const { el, open, setMenu } = window.MyFiModal;

  // ───────────────────────── helpers ─────────────────────────
  const fmt = (n)=> new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n)||0);
  const factor = (cadence)=>{
    switch((cadence||'monthly').toLowerCase()){
      case 'daily': return 1;
      case 'weekly': return 7;
      default: return 30; // monthly
    }
  };

  function helper(html){ const d=document.createElement('div'); d.className='helper'; d.innerHTML=html; return d; }
  function field(label,type,id,attrs={}){
    const wrap=document.createElement('div'); wrap.className='field';
    const lab=document.createElement('label'); lab.htmlFor=id; lab.textContent=label;
    const inp=document.createElement('input'); inp.type=type; inp.id=id; inp.className='input';
    Object.entries(attrs).forEach(([k,v])=>inp.setAttribute(k,v));
    wrap.append(lab,inp); return wrap;
  }
  function select(label,id,options){
    const wrap=document.createElement('div'); wrap.className='field';
    const lab=document.createElement('label'); lab.htmlFor=id; lab.textContent=label;
    const sel=document.createElement('select'); sel.id=id; sel.className='input';
    options.forEach(([val,text])=>{
      const o=document.createElement('option'); o.value=val; o.textContent=text; sel.appendChild(o);
    });
    wrap.append(lab,sel); return wrap;
  }
  const cancel =(l='Close')=>btn(l,'',()=>window.MyFiModal.close());
  const primary=(l='Save',fn)=>btn(l,'btn-primary',fn);
  const danger =(l,fn)=>btn(l,'',fn);
  function btn(label,klass,fn){ const b=document.createElement('button'); b.type='button'; b.className=`btn ${klass||''}`; b.textContent=label; b.addEventListener('click',fn); return b; }
  function currentRow(label,id){
    const wrap=document.createElement('div'); wrap.className='field';
    wrap.innerHTML=`<div class="row"><div class="label">${label}</div><div id="${id}" class="value muted">—</div></div>`;
    return wrap;
  }
  function updateCurrentDisplay(id, dailyValue, cadence='monthly'){
    const n = factor(cadence);
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(dailyValue * n);
  }
  function emit(type){
    const values={};
    window.MyFiModal.el.contentEl
      .querySelectorAll('input,select,textarea')
      .forEach(i=>values[i.id]=i.type==='number'?Number(i.value):i.value);
    window.dispatchEvent(new CustomEvent(type,{detail:values}));
  }

  // Player + month helpers
  async function getPlayerCore() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return { uid: null, mode: 'safe', startMs: Date.now() };
    const uid = user.uid;
    const db  = getFirestore();
    const p   = await getDoc(doc(db, "players", uid));

    let mode = 'safe', startMs = Date.now();
    if (p.exists()) {
      const d = p.data() || {};
      mode = String(d.vitalsMode || 'safe').toLowerCase();
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
  function toISODate(ms){ return new Date(ms).toISOString().slice(0,10); }

  // ───────────────────────── Menu ─────────────────────────
  const FinancesMenu = {
    setIncome: {
      label:'Income', title:'Set Income',
      render(){
        const current = currentRow('Current Income','incomeCurrent');
        const amount = field('Income Amount','number','incomeAmount',{min:0,step:'0.01',placeholder:'e.g. 3200.00'});
        const cadence = select('Cadence','incomeCadence',[['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);
        const note = helper('This updates your regen baseline and HUD projections.');

        (async ()=>{
          const daily = await getDailyIncome();
          updateCurrentDisplay('incomeCurrent', daily, 'monthly');
          document.getElementById('incomeAmount').value = (daily * 30).toFixed(2);
          document.getElementById('incomeCadence').value = 'monthly';
        })();

        return [ current, amount, cadence, note ];
      },
      footer(){ return [ primary('Save',()=>emit('income:save')), cancel() ]; }
    },

    setExpenses: {
      label:'Core Expenses', title:'Set Core Expenses',
      render(){
        const current = currentRow('Current Core Expenses','expenseCurrent');
        const amount = field('Expenses Amount','number','expenseAmount',{min:0,step:'0.01',placeholder:'e.g. 1800.00'});
        const cadence = select('Cadence','expenseCadence',[['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);
        const note = helper('Core expenses reduce your discretionary daily regen.');

        (async ()=>{
          const daily = await getDailyCoreExpenses();
          updateCurrentDisplay('expenseCurrent', daily, 'monthly');
          document.getElementById('expenseAmount').value = (daily * 30).toFixed(2);
          document.getElementById('expenseCadence').value = 'monthly';
        })();

        return [ current, amount, cadence, note ];
      },
      footer(){ return [ primary('Save',()=>emit('expenses:save')), cancel() ]; }
    },

    addTransaction: {
      label:'Add Transaction', title:'Add Transaction',
      render(){
        const desc = field('Description','text','txDesc',{placeholder:'e.g. Groceries'});
        const amt  = field('Amount','number','txAmount',{min:0,step:'0.01',placeholder:'e.g. 23.40'});
        const type = select('Type','txType',[['debit','Expense'],['credit','Income']]);
        const date = field('Date','date','txDate',{});

        // Backfill toggle (Manual mode only)
        const backfill = (()=>{
          const wrap = document.createElement('div');
          wrap.className = 'field';
          wrap.innerHTML = `
            <label class="checkbox">
              <input type="checkbox" id="txBackfill" />
              <span>Backfill (pre-start)</span>
            </label>
            <div class="helper">Manual mode only. When on, you can date this between the 1st of your start month and the day before your start date.</div>
          `;
          return wrap;
        })();

        const pool = select('Pool (optional)','txPool',[
          ['','Unassigned'],
          ['stamina','Stamina'],
          ['mana','Mana']
        ]);
        const note = helper('If unassigned, fallback routes it: Stamina first, overflow to Health.');

        (async ()=>{
          const { mode, startMs } = await getPlayerCore();
          const { startMonthStartMs, startDateMs } = monthWindow(startMs);
          const dateInput = date.querySelector('#txDate');
          const bfInput   = backfill.querySelector('#txBackfill');

          function setRange(prestart) {
            if (!dateInput) return;
            if (mode === 'manual' && prestart) {
              dateInput.min = toISODate(startMonthStartMs);
              dateInput.max = toISODate(startDateMs - 24*60*60*1000);
            } else {
              dateInput.min = toISODate(startDateMs);
              dateInput.removeAttribute('max');
            }
          }
          if (bfInput) bfInput.disabled = (mode !== 'manual');
          setRange(false);
          const todayISO = toISODate(Date.now());
          dateInput.value = todayISO;
          if (dateInput.min && dateInput.value < dateInput.min) dateInput.value = dateInput.min;
          bfInput?.addEventListener('change', (e)=> setRange(!!e.target.checked));
        })();

        return [ desc, amt, type, date, backfill, pool, note ];
      },
      footer(){ return [ primary('Add',()=>emit('tx:add')), cancel() ]; }
    },

    connectBank: {
      label:'Connect Bank', title:'Connect a Bank',
      render(){
        const info = helper('Link your bank to pull transactions automatically (paid feature).');
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.textContent = 'Connect with TrueLayer';
        btn.addEventListener('click', async ()=>{
          try{
            await connectTrueLayerAccount();
            window.MyFiModal.close();
            await initHUD();
          }catch(e){ console.warn('TrueLayer connect failed:', e); }
        });
        return [ info, btn ];
      },
      footer(){ return [ cancel() ]; }
    },
  };

  // Factory for manualOpening entry — now auto‑defaults split from Firestore allocations
  function makeManualOpeningEntry() {
    return {
      label: 'Manual (Pre-start) Summary',
      title: 'Pre-start spend this month',
      render(){
        const info  = helper('Optional: enter a single total of what you had already spent <em>this month</em> before you joined. Defaults use your pool allocations. You can also backfill itemised via “Add Transaction → Backfill”.');
        const total = field('Total pre-start spend (£)','number','prestartTotal',{ min:0, step:'0.01', placeholder:'e.g. 350.00' });

        // Inputs start with 60/40 but will be overwritten from Firestore allocations
        const split = (()=>{
          const wrap = document.createElement('div');
          wrap.className = 'field';
          wrap.innerHTML = `
            <label>Split (optional)</label>
            <div class="row">
              <input id="prestartStaminaPct" type="number" class="input" min="0" max="100" step="1" value="60" />
              <span class="helper">Stamina %</span>
            </div>
            <div class="row" style="margin-top:.5rem;">
              <input id="prestartManaPct" type="number" class="input" min="0" max="100" step="1" value="40" />
              <span class="helper">Mana %</span>
            </div>
            <div class="helper">We ignore Health here; this split is just between Stamina and Mana.</div>
          `;
          return wrap;
        })();

        // 🔄 Prefill from Firestore poolAllocations (stamina vs mana)
        (async ()=>{
          const auth = getAuth();
          const user = auth.currentUser;
          if (!user) return;
          const uid = user.uid;
          const db  = getFirestore();
          try {
            const snap = await getDoc(doc(db, `players/${uid}/cashflowData/poolAllocations`));
            if (!snap.exists()) return;
            const d = snap.data() || {};
            const s = Number(d.staminaAllocation ?? 0);
            const m = Number(d.manaAllocation ?? 0);
            const sum = s + m;
            if (sum > 0) {
              const staminaPct = Math.round((s / sum) * 100);
              const manaPct    = 100 - staminaPct;
              const sEl = document.getElementById('prestartStaminaPct');
              const mEl = document.getElementById('prestartManaPct');
              if (sEl) sEl.value = String(staminaPct);
              if (mEl) mEl.value = String(manaPct);
            }
          } catch (e) {
            // non-fatal; keep defaults
            console.warn('allocations read failed', e);
          }
        })();

        return [ info, total, split ];
      },
      footer(){ return [ primary('Save',()=>emit('manual:save')), cancel() ]; }
    };
  }

  // ───────────────────────── Open menu wiring ─────────────────────────
  document.getElementById('right-btn')?.addEventListener('click', async ()=>{
    const { mode } = await getPlayerCore();
    if (mode === 'manual') {
      FinancesMenu.manualOpening = makeManualOpeningEntry();
    } else {
      if (FinancesMenu.manualOpening) delete FinancesMenu.manualOpening;
    }
    setMenu(FinancesMenu);
    open('addTransaction');
  });

  // ───────────────────────── Event handlers ─────────────────────────
  window.addEventListener('income:save', async e=>{
    const amount  = Number(e.detail.incomeAmount || 0);
    const cadence = String(e.detail.incomeCadence || 'monthly');
    await updateIncome({ amount, cadence });
    const daily = (Number(amount) || 0) / factor(cadence);
    const cadenceNow = document.getElementById('incomeCadence')?.value || 'monthly';
    updateCurrentDisplay('incomeCurrent', daily, cadenceNow);
    await initHUD();
  });

  window.addEventListener('expenses:save', async e=>{
    const expenseAmount  = Number(e.detail.expenseAmount || 0);
    const expenseCadence = String(e.detail.expenseCadence || 'monthly');
    await updateCoreExpenses({ amount: expenseAmount, cadence: expenseCadence });
    const daily = (Number(expenseAmount) || 0) / factor(expenseCadence);
    const cadenceNow = document.getElementById('expenseCadence')?.value || 'monthly';
    updateCurrentDisplay('expenseCurrent', daily, cadenceNow);
    await initHUD();
  });

  // Add Transaction (with Manual backfill support + date clamping)
  window.addEventListener('tx:add', async e=>{
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const { mode, startMs } = await getPlayerCore();
    const { startMonthStartMs, startDateMs } = monthWindow(startMs);

    const detail = { ...e.detail };
    const type = String(detail.txType || 'debit');
    const amt  = Math.abs(Number(detail.txAmount || 0));
    const sign = (type === 'debit') ? -1 : 1;
    detail.amount = sign * amt;

    if (detail.txPool === '') delete detail.txPool;

    const selDateMs = detail.txDate ? new Date(detail.txDate + 'T00:00:00Z').getTime() : Date.now();
    const isManual = (mode === 'manual');
    const backfillChecked = document.getElementById('txBackfill')?.checked === true;
    const isPre = isManual && backfillChecked;

    let finalMs = selDateMs;

    if (!isManual) {
      if (finalMs < startDateMs) finalMs = startDateMs;
    } else if (isPre) {
      const latestAllowed = startDateMs - 24*60*60*1000;
      if (finalMs < startMonthStartMs) finalMs = startMonthStartMs;
      if (finalMs > latestAllowed)     finalMs = latestAllowed;
      detail.isPrestart = true;
    } else {
      if (finalMs < startDateMs) finalMs = startDateMs;
    }

    detail.txDate = toISODate(finalMs);

    await addTransaction(detail);
    window.MyFiModal.close();
    await initHUD();
  });

  // Manual opening summary save — auto-fallback to allocations if user inputs sum to 0
  window.addEventListener('manual:save', async (e)=>{
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;

    const total = Math.max(0, Number(e.detail.prestartTotal || 0));

    // Start with user-entered values
    let spct = Math.max(0, Math.min(100, Number(e.detail.prestartStaminaPct || 0)));
    let mpct = Math.max(0, Math.min(100, Number(e.detail.prestartManaPct || 0)));
    let sum = spct + mpct;

    // If user cleared or 0/0, fallback to allocations
    if (sum <= 0.0001) {
      try {
        const db  = getFirestore();
        const snap = await getDoc(doc(db, `players/${uid}/cashflowData/poolAllocations`));
        if (snap.exists()) {
          const d = snap.data() || {};
          const s = Number(d.staminaAllocation ?? 0);
          const m = Number(d.manaAllocation ?? 0);
          const allocSum = s + m;
          if (allocSum > 0) {
            spct = (s / allocSum) * 100;
            mpct = (m / allocSum) * 100;
            sum  = spct + mpct;
          }
        }
      } catch (_) { /* ignore, keep defaults */ }
      if (sum <= 0.0001) { spct = 60; mpct = 40; sum = 100; }
    }

    // Normalise to 1.0 for storage
    spct = spct / sum;
    mpct = mpct / sum;

    const db = getFirestore();
    const playersRef = doc(db, `players/${uid}`);
    const pSnap = await getDoc(playersRef);
    let startMs = Date.now();
    if (pSnap.exists()) {
      const raw = pSnap.data()?.startDate;
      if (raw?.toMillis) startMs = raw.toMillis();
      else if (raw instanceof Date) startMs = raw.getTime();
      else if (typeof raw === 'number') startMs = raw;
    }
    const d = new Date(startMs);
    const startMonthStartMs = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

    await setDoc(doc(db, `players/${uid}/manualSeed/meta`), {
      startMonthStartMs, startDateMs: startMs, updatedAtMs: Date.now()
    }, { merge: true });

    await setDoc(doc(db, `players/${uid}/manualSeed/openingSummary`), {
      totalPrestartDiscretionary: total,
      split: { staminaPct: spct, manaPct: mpct },
      providedAtMs: Date.now()
    }, { merge: true });

    window.MyFiModal.close();
    await initHUD();
  });

})();
