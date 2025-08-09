// js/settingsMenu.js
import { connectTrueLayerAccount } from './core/truelayer.js';

(function(){
  const { el, open, setMenu } = window.MyFiModal;

  const SettingsMenu = {
    setIncome: {
      label:'Income', title:'Set Daily/Monthly Income',
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
        field('Core Expenses Amount','number','coreAmount',{min:0,step:'0.01',placeholder:'e.g. 1850.00'}),
        select('Cadence','coreCadence',[['monthly','Monthly'],['weekly','Weekly']]),
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
        select('Pool (optional)','txPool',[['','Unassigned'],['stamina','Stamina'],['mana','Mana'],['health','Health']]),
        field('Date','date','txDate',{}),
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
        const h = helper('You’ll be redirected to your bank to authorise access.');
        return [p, btn, h];
      },
      footer(){ return [ cancel() ]; }
    },
    logout: {
      label:'Log Out', title:'Log Out',
      render(){ return [ helper('<strong>Are you sure?</strong> You’ll be signed out from this device.') ]; },
      footer(){ return [ danger('Log Out',()=>emit('auth:logout')), cancel('Cancel') ]; }
    }
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
  window.MyFiModal.setMenu(SettingsMenu);
  document.getElementById('settings-btn')?.addEventListener('click', ()=> window.MyFiModal.open('setIncome'));

  // demo listeners (replace with real logic)
  window.addEventListener('income:save', e=>console.log('Save income', e.detail));
  window.addEventListener('core:save',   e=>console.log('Save core', e.detail));
  window.addEventListener('tx:add',      e=>console.log('Add tx', e.detail));
  window.addEventListener('auth:logout', ()=>{ console.log('Logout'); window.MyFiModal.close(); });
})();
