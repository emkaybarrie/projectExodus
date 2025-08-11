// js/financesMenu.js
import { logoutUser } from './core/auth.js';
import { initHUD } from './hud/hud.js'; 
import { connectTrueLayerAccount } from './core/truelayer.js';
import { updateIncome, updateCoreExpenses } from './data/cashflowData.js';
import { addTransaction } from './data/financialData_USER_v2.js';

(function(){
  const { el, open, setMenu } = window.MyFiModal;

  const FinancesMenu = {
    setIncome: {
      label:'Income', title:'Set Income',
      render(){ return [
        field('Income Amount','number','incomeAmount',{min:0,step:'0.01',placeholder:'e.g. 3200.00'}),
        select('Cadence','incomeCadence',[['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]),
        helper('This updates your regen baseline and HUD projections.')
      ];},
      footer(){ return [ primary('Save',()=>emit('income:save')), cancel() ]; }
    },
    setCoreExpenses: {
      label:'Core Expenses', title:'Set Core Expenses',
      render(){ return [
        field('Core Expenses Amount','number','expenseAmount',{min:0,step:'0.01',placeholder:'e.g. 1850.00'}),
        select('Cadence','expenseCadence',[['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]),
        helper('Core expenses inform Health/Mana/Stamina baselines.')
      ];},
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

  // helpers
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
  const danger =(l,f)=>btn(l,'',f);

  function emit(type){
    const values={}; el.contentEl.querySelectorAll('input,select,textarea').forEach(i=>values[i.id]=i.value);
    window.dispatchEvent(new CustomEvent(type,{detail:values}));
  }

  // register + open hook
   document.getElementById('right-btn')?.addEventListener('click', ()=>{
    setMenu(FinancesMenu);       // load finances menu items
    open('addTransaction');      // open default to add transaction
  });

  // demo listeners (replace with real logic)
  window.addEventListener('income:save', async e=>{console.log('Save income', e.detail); await updateIncome(e.detail.incomeAmount, e.detail.incomeCadence); await initHUD(); });
  window.addEventListener('core:save',   async e=>{console.log('Save expenses', e.detail); await updateCoreExpenses(e.detail.expenseAmount, e.detail.expenseCadence); await initHUD(); });
  window.addEventListener('tx:add',      async e=>{console.log('Add txn', e.detail); await addTransaction(e.detail); await initHUD(); });
})();
