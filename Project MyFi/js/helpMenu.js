// js/helpMenu.js
import { db, auth } from './core/auth.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  const { el, open, setMenu } = window.MyFiModal;

  // --- UI helpers ---
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

  // --- Overview (now includes "Introduction" and "The Basics") ---
  function overviewRender(){
    const pages = [
      {
        label:'Introduction',
        text: `
          Welcome to <strong>Project MyFi</strong> — a living world where your real-life money habits power your in-game journey.
          The app blends financial tracking with RPG adventure to help you spend wisely, plan intentionally, and grow stronger over time.
          Every choice shapes your avatar, progress, and ability to face The Badlands ahead.
        `,
        media:{ type:'image', src:'assets/help/overview-1.png' }
      },
      {
        label:'The Basics',
        text: `
          <strong>Navigation</strong><br>
          • Swipe between panels to explore your hub.<br>
          • Tap icons to open details; long-press where noted for extra options.<br><br>
          <strong>Main Screens</strong><br>
          • <em>Vitals</em> — your financial health as game-like resources.<br>
          • <em>Quests</em> — goals/challenges that build habits.<br>
          • <em>Avatar</em> — customise, level up, and equip perks.<br>
          • <em>The Badlands</em> — the 2D rogue-lite where your prep is tested and rewarded.<br><br>
          Tip: Use the 🌀 toggle on Vitals to switch Daily/Weekly/Monthly context.
        `,
        media:{ type:'image', src:'assets/help/basics-nav.png' }
      }
    ];
    const container = document.createElement('div');
    const subnav = segmentedNav(pages, showPage);
    const body = document.createElement('div'); body.className = 'help-body';
    container.append(subnav, body);
    function showPage(i){
      const p = pages[i];
      body.replaceChildren(helper(p.text), mediaBlock(p.media));
    }
    showPage(0);
    return [container];
  }

  // --- Vitals ---
  function vitalsRender(){
    const pages = [
      {
        label:'Purpose',
        text: `
          The <strong>Vitals</strong> screen is your central dashboard. It tracks:
          <br>• <em>Stamina</em> — day-to-day spending.
          <br>• <em>Mana</em> — intentional/power spending.
          <br>• <em>Health</em> — protected savings baseline.
          <br>• <em>Essence</em> — avatar growth, boosts, unlocks, and cosmetics.
          <br><br>
          As transactions flow in, tag them to the right pool. Manage your energy carefully, and see how your spending will impact your avatar's resources before confirmation.
          From Vitals, everything else flows: quests, avatar growth, and deeper Badlands runs.
        `,
        media:{ type:'image', src:'assets/help/vitals-overview.png' }
      },
      {
        label:'Using It',
        text: `
          • Toggle 🌀 to view Daily/Weekly/Monthly context.<br>
          • Watch bars for current vs. max; surplus pills hint how many full bars remain based on the current time context.<br>
          • Use the Update Log to review pending items: tag to confirm, or let defaults apply.
        `,
        media:{ type:'video', src:'assets/help/vitals-using.mp4', poster:'assets/help/vitals-using.jpg' }
      }
    ];
    const container = document.createElement('div');
    const subnav = segmentedNav(pages, showPage);
    const body = document.createElement('div'); body.className='help-body';
    container.append(subnav, body);
    function showPage(i){ const p = pages[i]; body.replaceChildren(helper(p.text), mediaBlock(p.media)); }
    showPage(0);
    return [container];
  }

  // --- Quests ---
  function questsRender(){
    const content = helper(`
      <strong>Quests</strong> turn financial goals into adventures. Complete daily, weekly, or long-term challenges
      (e.g., tagging streaks, savings targets, clearing your Update Log). Rewards strengthen your avatar and unlock progression.
      Active quests appear in your Journal; completion builds habits and momentum.
    `);
    const media = mediaBlock({ type:'image', src:'assets/help/quests.png' });
    return [content, media];
  }

  // --- Avatars ---
  function avatarsRender(){
    const pages = [
      {
        label:'Progress',
        text: `
          Your <strong>Avatar</strong> reflects your journey. Customise look, gear, and abilities as you level up.
          Progress ties directly to Vitals and Quest completions.
          <br><br>
          • <em>Levelling</em> = financial resilience.<br>
          • <em>Gear & Skills</em> = perks linked to milestones.<br>
          • <em>Cosmetics</em> = unlocked with Essence or earned rewards.
          <br><br>
          A stronger avatar unlocks deeper power in The Badlands.
        `,
        media:{ type:'image', src:'assets/help/avatars-1.png' }
      },
      {
        label:'Loadout',
        text: `
          Equip skills and items that reflect your spending style and complement your habits (e.g., consistent tagging, savings streaks).
          Use these to amplify your performance and see them reflected in your chosen hero during Badlands runs and events.
        `,
        media:{ type:'image', src:'assets/help/avatars-2.png' }
      }
    ];
    const sub = segmentedNav(pages, show);
    const body = document.createElement('div'); body.className='help-body';
    function show(i){ const p=pages[i]; body.replaceChildren(helper(p.text), mediaBlock(p.media)); }
    const wrap = document.createElement('div'); wrap.append(sub, body);
    show(0);
    return [wrap];
  }

  // --- The Badlands ---
  function badlandsRender(){
    const content = helper(`
      <strong>The Badlands</strong> is the core gameplay: a 2D endless-runner rogue-lite where your avatar becomes a hero.
      Explore the lands surrounding Kianova, defeat enemies, liberate towns, and discover routes that change over time. Success depends on your Avatar's strength as well as your own skill and commitment.
      Compete or cooperate with others for leaderboards and seasonal prizes—better real-world habits fuel deeper runs.
    `);
    const media = mediaBlock({ type:'video', src:'assets/help/badlands.mp4', poster:'assets/help/badlands.jpg' });
    return [content, media];
  }

  // --- Resources (Products / Financial Guidance) ---
  function resourcesRender(){
    const pages = [
      {
        label:'Overview',
        text: `
          The <strong>Products & Guidance</strong> screen gives deeper insight into your financial health and habits,
          and connects you to partner products/services that fit your profile.
          You’ll see trends, spending patterns, risk flags, and opportunities to optimise.
        `,
        media:{ type:'image', src:'assets/help/resources-overview.png' }
      },
      {
        label:'Insights',
        text: `
          • Behavioural trends (e.g., streaks, category drift, burn rate).<br>
          • Projections and alerts based on your Vitals and recent activity.<br>
          • Actionable tips that feed back into Quests and Avatar perks.
        `,
        media:{ type:'image', src:'assets/help/resources-insights.png' }
      },
      {
        label:'Partner Products',
        text: `
          Curated links to banks, cards, savings, utilities, and other services.
          Offers are <em>context-aware</em> and optional; picking one may grant in-game bonuses or other perks.
          We prioritise clarity and suitability—no pressure, just options that might help you on your journey to financial independence.
        `,
        media:{ type:'image', src:'assets/help/resources-products.png' }
      }
    ];
    const container = document.createElement('div');
    const subnav = segmentedNav(pages, show);
    const body = document.createElement('div'); body.className='help-body';
    container.append(subnav, body);
    function show(i){ const p = pages[i]; body.replaceChildren(helper(p.text), mediaBlock(p.media)); }
    show(0);
    return [container];
  }

  // --- FAQ ---
  function faqRender(){
    const faqs = [
      ['getting-started','How do I get started?'],
      ['tagging','What is tagging and why does it matter?'],
      ['regen','How does regen work?'],
      ['privacy','What data do you store?'],
    ];
    const content = {
      'getting-started': {
        text:`Set income & core expenses, then add a few transactions. Watch the HUD update live.`,
        media:{type:'image', src:'assets/help/faq-start.png'}
      },
      'tagging': {
        text:`Tag planned spending as Mana. Everything else defaults to Stamina and can overflow to Health when needed.`,
        media:{type:'image', src:'assets/help/faq-tag.png'}
      },
      'regen': {
        text:`Current = (regenCurrent × daysTracked) − spentToDate. Max = regenBaseline × daysTracked.`,
        media:{type:'image', src:'assets/help/faq-regen.png'}
      },
      'privacy': {
        text:`Your data stays yours. Bank connections use trusted providers; you control access.`,
        media:{type:'image', src:'assets/help/faq-privacy.png'}
      },
    };

    const dd = select('Question','faqSelect',faqs);
    const body = document.createElement('div'); body.className='help-body';
    function renderKey(k){ const d=content[k]; body.replaceChildren(helper(d.text), mediaBlock(d.media)); }
    dd.querySelector('select').addEventListener('change', (e)=> renderKey(e.target.value));
    renderKey(faqs[0][0]);
    return [dd, body];
  }

  // --- Report an Issue ---
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

  // --- Menu map (unified schema with previews; works for split or drill‑down) ---
  const HelpMenu = {
    overview:  { 
      label:'Overview', title:'Help • Overview',
      preview:'Start here: what MyFi is, how the world works, and how to navigate.',
      render: overviewRender
    },
    vitals:    { 
      label:'Vitals',   title:'Help • Vitals',
      preview:'Understand Stamina, Mana, Health, and Essence — and how they regen/spend.',
      render: vitalsRender
    },
    quests:    { 
      label:'Quests',   title:'Help • Quests',
      preview:'Goals and challenges that build habits and unlock rewards.',
      render: questsRender 
    },
    avatars:   { 
      label:'Avatars',  title:'Help • Avatars',
      preview:'Level up, customise, and equip perks that reflect your progress.',
      render: avatarsRender 
    },
    badlands:  { 
      label:'The Badlands', title:'Help • The Badlands',
      preview:'Our rogue‑lite game mode: explore, fight, and push deeper as you grow.',
      render: badlandsRender 
    },
    resources: { 
      label:'Products / Guidance', title:'Help • Products & Guidance',
      preview:'Insights, projections, and optional partner products tailored to you.',
      render: resourcesRender 
    },
    faq:       { 
      label:'FAQ',      title:'Help • FAQ',
      preview:'Quick answers to common questions.',
      render: faqRender 
    },
    report:    { 
      label:'Report an Issue', title:'Help • Report an Issue',
      preview:'Tell us about a bug or idea — it goes straight to the team.',
      render: reportIssueRender, footer: reportFooter 
    },
  };

  // expose (optional)
  window.MyFiHelpMenu = HelpMenu;

  // Open Help → drill‑down (list + preview → detail)
  document.getElementById('help-btn')?.addEventListener('click', ()=>{
    setMenu(HelpMenu);
    open('overview', { variant: 'drilldown', menuTitle: 'Help' });
  });

  // Save bug reports to Firestore
  window.addEventListener('help:report', async (e)=>{
    try {
      let alias = null;
      const uid = auth.currentUser?.uid || null;
      if (uid) {
        const playerSnap = await getDoc(doc(db, 'players', uid));
        if (playerSnap.exists()) alias = playerSnap.data().alias || null;
      }
      await addDoc(collection(db, 'bugReports'), {
        ...e.detail,
        alias,
        uid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('[Help Report] Failed to save', err);
      alert('Sorry, we could not submit your report. Please try again later.');
    }
  });
})();
