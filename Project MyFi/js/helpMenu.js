// js/helpMenu.js
(function(){
  const { el, open, setMenu } = window.MyFiModal;

  function field(labelTxt,type,id,attrs={}){
    const wrap=document.createElement('div'); wrap.className='field';
    const l=document.createElement('label'); l.htmlFor=id; l.textContent=labelTxt;
    const i=document.createElement(type==='textarea'?'textarea':'input');
    i.className='input'; if(type!=='textarea') i.type=type; i.id=id; Object.assign(i,attrs);
    if(type==='textarea'){ i.rows = attrs.rows || 5; i.style.resize = 'vertical'; }
    wrap.append(l,i); return wrap;
  }
  function select(labelTxt,id,options){
    const wrap=document.createElement('div'); wrap.className='field';
    const l=document.createElement('label'); l.htmlFor=id; l.textContent=labelTxt;
    const s=document.createElement('select'); s.className='select'; s.id=id;
    options.forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; s.appendChild(o); });
    wrap.append(l,s); return wrap;
  }
  const helper=(html)=>{ const d=document.createElement('div'); d.className='helper'; d.innerHTML=html; return d; };
  const btn=(label,klass,fn)=>{ const b=document.createElement('button'); b.type='button'; b.className=`btn ${klass||''}`; b.textContent=label; b.addEventListener('click',fn); return b; };
  const primary=(l,f)=>btn(l,'btn--accent',f);
  const cancel =(l='Close')=>btn(l,'',()=>window.MyFiModal.close());

  function mediaBlock({type='image', src='#', alt='', poster='', autoplay=true}){
    const wrap = document.createElement('div');
    wrap.className = 'help-media';
    if(type==='video'){
      const v = document.createElement('video');
      v.src = src; v.playsInline = true; v.muted = true; v.loop = true;
      if(poster) v.poster = poster;
      if(autoplay) v.autoplay = true;
      v.controls = true;
      wrap.appendChild(v);
      const io = new IntersectionObserver((ents)=>{
        ents.forEach(e=>{
          if(e.isIntersecting){ v.play().catch(()=>{}); }
          else { v.pause(); }
        });
      }, {threshold: .25});
      io.observe(v);
    } else {
      const img = document.createElement('img');
      img.src = src; img.alt = alt || 'Help image';
      wrap.appendChild(img);
    }
    return wrap;
  }

  function segmentedNav(pages, onChange){
    const wrap = document.createElement('div');
    wrap.className = 'subnav';
    pages.forEach((p,idx)=>{
      const b = btn(p.label, idx===0 ? 'seg--current' : '', ()=>{
        wrap.querySelectorAll('.btn').forEach(x=>x.classList.remove('seg--current'));
        b.classList.add('seg--current');
        onChange(idx);
      });
      b.dataset.index = idx;
      wrap.appendChild(b);
    });
    return wrap;
  }

  function overviewRender(){
    const pages = [
      { label:'Introduction', text:`Welcome to <strong>MyFi</strong>. This screen is your home base: watch your <em>Health</em>, <em>Mana</em>, <em>Stamina</em>, and <em>Essence</em> change as you tag transactions and set goals.`,
        media:{type:'image', src:'assets/help/overview-1.png'} },
      { label:'HUD Basics', text:`The toggle 🌀 switches Daily/Weekly/Monthly views. Bars show your projected max and current position. Surplus pills show how many full bars remain after pending actions.`,
        media:{type:'video', src:'assets/help/overview-basics.mp4', poster:'assets/help/overview-basics.jpg'} },
      { label:'Next Steps', text:`Use <strong>Settings</strong> to set Income/Core Expenses. Connect a bank to sync data automatically, or add manual transactions to start right away.`,
        media:{type:'image', src:'assets/help/overview-next.png'} },
    ];

    const container = document.createElement('div');
    const subnav = segmentedNav(pages, showPage);
    const body = document.createElement('div');
    body.className = 'help-body';
    container.append(subnav, body);

    function showPage(i){
      const p = pages[i];
      body.replaceChildren(
        helper(p.text),
        mediaBlock(p.media)
      );
    }
    showPage(0);
    return [container];
  }

  function basicsRender(){
    const pages = [
      { label:'Tagging', text:`Tag transactions as <strong>Mana</strong> for intentional spending. Unassigned debits default to <strong>Stamina</strong> and overflow to <strong>Health</strong> when needed.`,
        media:{type:'image', src:'assets/help/basics-tagging.png'} },
      { label:'Ghost Preview', text:`The update log shows pending items with a countdown. Ghost overlays preview the impact before expiry; tag to confirm or let the default apply.`,
        media:{type:'video', src:'assets/help/ghost-preview.mp4', poster:'assets/help/ghost-preview.jpg'} },
    ];
    const container = document.createElement('div');
    const subnav = segmentedNav(pages, showPage);
    const body = document.createElement('div'); body.className='help-body';
    container.append(subnav, body);
    function showPage(i){ const p = pages[i]; body.replaceChildren(helper(p.text), mediaBlock(p.media)); }
    showPage(0);
    return [container];
  }

  function resourcesRender(){
    const text = helper(`Useful links and references will appear here. Placeholder for now.`);
    const media = mediaBlock({type:'image', src:'assets/help/resources.png'});
    return [text, media];
  }

  function avatarsRender(){
    const pages = [
      {label:'Styles', text:`Avatars evolve with your progress. Cosmetics and abilities tie to your financial milestones.`, media:{type:'image', src:'assets/help/avatars-1.png'}},
      {label:'Loadouts', text:`Equip skills that reflect your habits—automations, tagging streaks, and savings unlock buffs.`, media:{type:'image', src:'assets/help/avatars-2.png'}},
    ];
    const sub = segmentedNav(pages, show);
    const body = document.createElement('div'); body.className='help-body';
    function show(i){ const p=pages[i]; body.replaceChildren(helper(p.text), mediaBlock(p.media)); }
    const note = helper(`All artwork TBD; these are placeholders.`);
    const wrap = document.createElement('div'); wrap.append(sub, body, note);
    show(0);
    return [wrap];
  }

  function questsRender(){
    const text = helper(`Quests guide your next actions—complete tagging streaks, hit savings goals, or clear your update log.`);
    const media = mediaBlock({type:'image', src:'assets/help/quests.png'});
    return [text, media];
  }

  function badlandsRender(){
    const text = helper(`<strong>The Badlands</strong> is a challenge zone that reacts to overspending and missed goals. Expect temporary debuffs—and rare rewards.`);
    const media = mediaBlock({type:'video', src:'assets/help/badlands.mp4', poster:'assets/help/badlands.jpg'});
    return [text, media];
  }

  function faqRender(){
    const faqs = [
      ['getting-started','How do I get started?'],
      ['tagging','What is tagging and why does it matter?'],
      ['regen','How does regen work?'],
      ['privacy','What data do you store?'],
    ];
    const content = {
      'getting-started': { text:`Set income & core expenses in Settings, then add a few transactions. Watch the HUD update live.`,
                           media:{type:'image', src:'assets/help/faq-start.png'} },
      'tagging':         { text:`Tag planned spending as Mana. Everything else defaults to Stamina and overflows to Health.`,
                           media:{type:'image', src:'assets/help/faq-tag.png'} },
      'regen':           { text:`Current = (regenCurrent × daysTracked) − spentToDate. Max = regenBaseline × daysTracked.`, 
                           media:{type:'image', src:'assets/help/faq-regen.png'} },
      'privacy':         { text:`Your data stays yours. Bank connections use trusted providers; you control access.`, 
                           media:{type:'image', src:'assets/help/faq-privacy.png'} },
    };

    const dd = select('Question','faqSelect',faqs);
    const body = document.createElement('div'); body.className='help-body';
    function renderKey(k){ const d=content[k]; body.replaceChildren(helper(d.text), mediaBlock(d.media)); }

    dd.querySelector('select').addEventListener('change', (e)=> renderKey(e.target.value));
    renderKey(faqs[0][0]);
    return [dd, body];
  }

  function reportIssueRender(){
    const cat = select('Category (optional)','issueCategory',[
      ['bug-ui','UI bug'],
      ['bug-data','Data issue'],
      ['perf','Performance'],
      ['suggestion','Suggestion/Idea'],
      ['other','Other'],
    ]);
    const desc = field('Describe the issue','textarea','issueDescription',{rows:6,placeholder:'What happened? Steps to reproduce?'});
    const email= field('Email (optional, for follow-up)','email','issueEmail',{placeholder:'you@example.com'});
    const note = helper(`No sensitive info please. A minimal log will be attached automatically.`);
    return [cat, desc, email, note];
  }

  function reportFooter(){
    return [
      primary('Submit', ()=>{
        const values={};
        el.contentEl.querySelectorAll('input,select,textarea').forEach(i=>values[i.id]=i.value);
        values._meta = { ts: Date.now(), userAgent: navigator.userAgent };
        window.dispatchEvent(new CustomEvent('help:report',{detail:values}));
        window.MyFiModal.close();
      }),
      cancel()
    ];
  }

  const HelpMenu = {
    overview: { label:'Overview', title:'Help • Overview', render: overviewRender },
    basics:   { label:'Basics', title:'Help • Basics', render: basicsRender },
    resources:{ label:'Resources', title:'Help • Resources', render: resourcesRender },
    avatars:  { label:'Avatars', title:'Help • Avatars', render: avatarsRender },
    quests:   { label:'Quests', title:'Help • Quests', render: questsRender },
    badlands: { label:'The Badlands', title:'Help • The Badlands', render: badlandsRender },
    faq:      { label:'FAQ', title:'Help • FAQ', render: faqRender },
    report:   { label:'Report an Issue', title:'Help • Report an Issue', render: reportIssueRender, footer: reportFooter },
  };

  window.MyFiHelpMenu = HelpMenu;

  document.getElementById('help-btn')?.addEventListener('click', ()=>{
    setMenu(HelpMenu);
    open('overview');
  });

  window.addEventListener('help:report', (e)=>{
    console.log('[Help Report]', e.detail);
  });
})();
