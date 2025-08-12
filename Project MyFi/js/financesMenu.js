// js/financesMenu.js
import { logoutUser } from './core/auth.js';
import { initHUD } from './hud/hud.js'; 
import { connectTrueLayerAccount } from './core/truelayer.js';
import { updateIncome, updateCoreExpenses, getDailyIncome, getDailyCoreExpenses } from './data/cashflowData.js';
import { addTransaction } from './data/financialData_USER.js';

(function(){
  const { el, open, setMenu } = window.MyFiModal;

  const fmt = (n)=> new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n)||0);
  const factor = (cadence)=>{
    switch((cadence||'monthly').toLowerCase()){
      case 'daily': return 1;
      case 'weekly': return 7;
      default: return 30; // monthly
    }
  };

  function currentRow(labelTxt, id){
    const wrap = document.createElement('div');
    wrap.className = 'field current-row';
    const l = document.createElement('label');
    l.textContent = labelTxt;
    const v = document.createElement('div');
    v.id = id;
    v.className = 'current-value';
    v.textContent = '—';
    wrap.append(l, v);
    return wrap;
  }

  function updateCurrentDisplay(currentId, dailyValue, cadence){
    const node = document.getElementById(currentId);
    if(!node) return;
    const total = Number(dailyValue) * factor(cadence);
    node.textContent = fmt(total);
  }

  const FinancesMenu = {
    setIncome: {
      label:'Income', title:'Set Income',
      render(){ 
        const current = currentRow('Current Income','incomeCurrent');
        const amount = field('Income Amount','number','incomeAmount',{min:0,step:'0.01',placeholder:'e.g. 3200.00'});
        const cadence = select('Cadence','incomeCadence',[['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);
        const note = helper('This updates your regen baseline and HUD projections.');

        // fetch & wire up after elements exist
        (async ()=>{
          const daily = await getDailyIncome(); // stored as daily in Firestore
          // initial display (default select value is first option = monthly)
          updateCurrentDisplay('incomeCurrent', daily, cadence.querySelector('select')?.value || 'monthly');

          // when cadence changes, recalc
          cadence.querySelector('select').addEventListener('change', (e)=>{
            updateCurrentDisplay('incomeCurrent', daily, e.target.value);
          });
        })();

        return [ current, amount, cadence, note ];
      },
      footer(){ return [ primary('Save',()=>emit('income:save')), cancel() ]; }
    },

    setCoreExpenses: {
      label:'Core Expenses', title:'Set Core Expenses',
      render(){ 
        const current = currentRow('Current Core Expenses','expenseCurrent');
        const amount = field('Core Expenses Amount','number','expenseAmount',{min:0,step:'0.01',placeholder:'e.g. 1850.00'});
        const cadence = select('Cadence','expenseCadence',[['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);
        const note = helper('Core expenses inform Health/Mana/Stamina baselines.');

        (async ()=>{
          const daily = await getDailyCoreExpenses();
          updateCurrentDisplay('expenseCurrent', daily, cadence.querySelector('select')?.value || 'monthly');
          cadence.querySelector('select').addEventListener('change', (e)=>{
            updateCurrentDisplay('expenseCurrent', daily, e.target.value);
          });
        })();

        return [ current, amount, cadence, note ];
      },
      footer(){ return [ primary('Save',()=>emit('core:save')), cancel() ]; }
    },

    addTransaction: {
      label:'Transactions', title:'Add Transaction',
      render(){ return [
        field('Description','text','txDesc',{placeholder:'e.g. Groceries'}),
        field('Amount','number','txAmount',{min:0,step:'0.01',placeholder:'e.g. 23.40'}),
        select('Type','txType',[['debit','Expense'],['credit','Income']]),
        field('Date','date','txDate',{}),
        select('Pool (optional)','txPool',[['','Unassigned'],['stamina','Stamina'],['mana','Mana']]),
        helper('If unassigned, fallback routes it: Stamina first, overflow to Health.')
      ];},
      footer(){ return [ primary('Add',()=>emit('tx:add')), cancel() ]; }
    },

    connectAccount: {
      label:'Connect Account', title:'Connect a Bank Account',
      render(){ 
        const p = helper('Connect a bank via TrueLayer to sync transactions automatically.');
        const btn = document.createElement('button');
        btn.className='btn btn--accent'; btn.type='button'; btn.id='btnStartOAuth'; btn.textContent='Start Connection';
        btn.addEventListener('click', connectTrueLayerAccount);
        const h = helper('You’ll be redirected to your bank to authorise access. Currently demo data for illustration purposes.');
        return [p, btn, h];
      },
      footer(){ return [ cancel() ]; }
    },
  };

  // helpers (unchanged + a tiny style hook)
  function field(labelTxt,type,id,attrs={}){
    const wrap=document.createElement('div'); wrap.className='field';
    const l=document.createElement('label'); l.htmlFor=id; l.textContent=labelTxt;
    const i=document.createElement('input'); i.className='input'; i.type=type; i.id=id; Object.assign(i,attrs);
    wrap.append(l,i); return wrap;
  }
  function select(labelTxt,id,options){
    const wrap=document.createElement('div'); wrap.className='field';
    const l=document.createElement('label'); l.htmlFor=id; l.textContent=labelTxt;
    const s=document.createElement('select'); s.className='select'; s.id=id;
    options.forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; s.appendChild(o); });
    wrap.append(l,s); return wrap;
  }
  function helper(html){ const d=document.createElement('div'); d.className='helper'; d.innerHTML=html; return d; }
  function btn(label,klass,fn){ const b=document.createElement('button'); b.type='button'; b.className=`btn ${klass||''}`; b.textContent=label; b.addEventListener('click',fn); return b; }
  const primary=(l,f)=>btn(l,'btn--accent',f);
  const cancel =(l='Close')=>btn(l,'',()=>window.MyFiModal.close());

  function emit(type){
    const values={}; el.contentEl.querySelectorAll('input,select,textarea').forEach(i=>values[i.id]=i.value);
    window.dispatchEvent(new CustomEvent(type,{detail:values}));
  }

  // register + default open
  document.getElementById('right-btn')?.addEventListener('click', ()=>{
    setMenu(FinancesMenu);
    open('addTransaction');
  });

  // actions
 window.addEventListener('income:save', async (e) => {
  const { incomeAmount, incomeCadence } = e.detail;

  await updateIncome(incomeAmount, incomeCadence);

  // NEW: refresh the visible "Current Income" total
  const daily = (Number(incomeAmount) || 0) / factor(incomeCadence); // convert entered cadence → daily
  const cadenceNow = document.getElementById('incomeCadence')?.value || 'monthly';
  updateCurrentDisplay('incomeCurrent', daily, cadenceNow);

  await initHUD();
});

window.addEventListener('core:save', async (e) => {
  const { expenseAmount, expenseCadence } = e.detail;

  await updateCoreExpenses(expenseAmount, expenseCadence);

  // NEW: refresh the visible "Current Core Expenses" total
  const daily = (Number(expenseAmount) || 0) / factor(expenseCadence);
  const cadenceNow = document.getElementById('expenseCadence')?.value || 'monthly';
  updateCurrentDisplay('expenseCurrent', daily, cadenceNow);

  await initHUD();
});
  window.addEventListener('tx:add', async e=>{
    await addTransaction(e.detail);
    await initHUD();
  });
})();
