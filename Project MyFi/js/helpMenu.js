// js/helpMenu.js
// Standardised Help menu using MyFiUI + MyFiModal nav stack.
// No direct DOM listeners here — quickMenus.js opens this via window.MyFiHelpMenu.

import { db, auth } from './core/auth.js';
import {
  collection, addDoc, serverTimestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  const { helper, btn, primary, cancel } = window.MyFiUI;

  // Simple media block kept local (pure UI, no network)
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
        ents.forEach(e=>{ if(e.isIntersecting){ v.play().catch(()=>{}); } else { v.pause(); } });
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
      const b = btn(p.label, idx===0 ? 'accent' : 'secondary', ()=>{
        wrap.querySelectorAll('.btn').forEach(x=>x.classList.remove('seg--current'));
        b.classList.add('seg--current');
        onChange(idx);
      });
      if(idx===0) b.classList.add('seg--current');
      b.dataset.index = idx;
      wrap.appendChild(b);
    });
    return wrap;
  }

  // Pages
  function overviewRender(){
    const pages = [
      {
        label:'Introduction',
        text: `
          Welcome to <strong>Project MyFi</strong> — a living world where your real-world money habits fuel your in-game destiny.
          Every transaction costs energy, every decision shapes your avatar, and every step prepares you for the challenges of The Badlands.
          Spend wisely, plan intentionally, and watch both your finances and your hero grow stronger.
        `,
        media:{ type:'image', src:'assets/help/overview-1.png' }
      },
      {
        label:'The Basics',
        text: `
          <strong>Navigation</strong><br>
          • Swipe from the hub to explore — left for Quests, right for Avatar, up for Insights & Partners, down for The Badlands.<br>
          • Tap icons to open details; long-press where noted for hidden options.<br><br>
          <strong>Main Screens</strong><br>
          • <em>Vitals</em> — your energy pools (Health, Mana, Stamina, Essence).<br>
          • <em>Quests</em> — challenges that turn goals into progress.<br>
          • <em>Avatar</em> — customise, level up, and unlock perks.<br>
          • <em>Resources</em> — financial insights and partner tools.<br>
          • <em>The Badlands</em> — a rogue-lite adventure to test your avatar and earn rewards.<br><br>
          Tip: Use the 🌀 toggle on Vitals to swap Daily/Weekly/Monthly views.
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

  function vitalsRender(){
    const pages = [
      {
        label:'Purpose',
        text: `
          The <strong>Vitals</strong> screen is your core dashboard — the lifeblood of your adventure. It tracks:<br>
          • <em>Stamina</em> — everyday energy, linked to flexible day-to-day spending.<br>
          • <em>Mana</em> — deliberate, power spending that fuels intentional choices.<br>
          • <em>Health</em> — your safeguarded savings baseline; drained only if others run dry.<br>
          • <em>Essence</em> — long-term growth, powering avatar upgrades, unlocks, and cosmetics.<br><br>
          Tag transactions to the right pool and see instantly how they affect your energy. Managing these flows is the heart of survival — quests, avatar growth, and Badlands exploration all start here.
        `,
        media:{ type:'image', src:'assets/help/vitals-overview.png' }
      },
      {
        label:'Using It',
        text: `
          • Toggle 🌀 to shift between Daily, Weekly, or Monthly context.<br>
          • Bars show current vs. maximum; surplus pills = how many full bars remain.<br>
          • The Action Log tracks pending actions — tag them before they lock in, or unlock skills to decide for you.
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

  function questsRender(){
    const content = helper(`
      <strong>Quests</strong> transform your financial goals into challenges. Reach savings goals, maintain tagging streaks or manage your energy consistently — completing quests grants rewards and builds lasting habits.
      Active quests appear in your Journal. Every success fuels momentum and strengthens your avatar for the journey ahead.
    `);
    const media = mediaBlock({ type:'image', src:'assets/help/quests.png' });
    return [content, media];
  }

  function avatarsRender(){
    const pages = [
      {
        label:'Progress',
        text: `
          Your <strong>Avatar</strong> mirrors your journey. As you level up, customise their look, gear, and abilities to reflect your progress.<br><br>
          • <em>Levelling</em> opens up more options to improve financial resilience.<br>
          • <em>Gear & Skills</em> can be equipped to gain perks and automate actions.<br>
          • <em>Cosmetics</em> can be unlocked with Essence or rewards to make your avatar truly yours.<br><br>
          With stronger avatar comes more power, and greater rewards, in The Badlands.
        `,
        media:{ type:'image', src:'assets/help/avatars-1.png' }
      },
      {
        label:'Loadout',
        text: `
          Equip skills and items that match your playstyle — maybe you’re a disciplined planner (Mana-heavy) or a flexible spender (Stamina-balanced).
          Your loadout affects both your stats on the Vitals HUD and your hero’s performance in Badlands adventures.
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

  function badlandsRender(){
    const content = helper(`
      <strong>The Badlands</strong> is the proving ground: a 2D endless-runner rogue-lite where your avatar becomes the hero.
      Liberate towns, face shifting routes, and battle enemies as seasons change. Success depends on both your own skill and the strength you’ve built through Vitals management, Quests achievements, and Essence use.
      Compete on leaderboards, cooperate with friends, and discover how better real-world habits lead to deeper, more rewarding runs.
    `);
    const media = mediaBlock({ type:'video', src:'assets/help/badlands.mp4', poster:'assets/help/badlands.jpg' });
    return [content, media];
  }

  function resourcesRender(){
    const pages = [
      {
        label:'Overview',
        text: `
          The <strong>Resources</strong> screen gives you financial insight and access to curated partner tools.
          Track spending trends, spot risks, and explore services that may grant in-game bonuses as well as real-world benefits.
        `,
        media:{ type:'image', src:'assets/help/resources-overview.png' }
      },
      {
        label:'Insights',
        text: `
          • Spot behavioural trends (streaks, burn rate, drift).<br>
          • See projections and alerts based on your activity.<br>
          • Unlock tips that feed back into Quests and Avatar perks.
        `,
        media:{ type:'image', src:'assets/help/resources-insights.png' }
      },
      {
        label:'Partner Products',
        text: `
          Curated services — banks, cards, savings, utilities — tailored to your journey.
          Optional and transparent: no pressure, just potential shortcuts. Some choices may unlock in-game perks or boost your avatar.
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

  function faqRender(){
    const faqs = [
      ['getting-started','How do I get started?'],
      ['tagging','What is tagging and why does it matter?'],
      ['regen','How does regen work?'],
      ['privacy','What data do you store?'],
    ];
    const content = {
      'getting-started': { text:`Set income & core expenses, then add a few transactions. Watch the Vitals HUD update live.`, media:{type:'image', src:'assets/help/faq-start.png'} },
      'tagging':         { text:`Tag spending as Mana if it’s intentional. Otherwise it defaults to Stamina. Overspending can spill into Health, your last line of defense.`, media:{type:'image', src:'assets/help/faq-tag.png'} },
      'regen':           { text:`Energy regenerates over time, based on your income (after core expenses). Spending too much will affect this, ensuring you can’t outpace your means.`, media:{type:'image', src:'assets/help/faq-regen.png'} },
      'privacy':         { text:`Your data stays yours. Bank connections use trusted providers; you control access.`, media:{type:'image', src:'assets/help/faq-privacy.png'} },
    };

    const wrap = document.createElement('div');
    const lab = document.createElement('label'); lab.textContent = 'Question';
    const sel = document.createElement('select'); sel.className='input';
    faqs.forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; sel.appendChild(o); });
    const top = document.createElement('div'); top.className='field'; top.append(lab, sel);

    const body = document.createElement('div'); body.className='help-body';
    function renderKey(k){ const d=content[k]; body.replaceChildren(helper(d.text), mediaBlock(d.media)); }
    sel.addEventListener('change', (e)=> renderKey(e.target.value));
    renderKey(faqs[0][0]);
    return [top, body];
  }

  // Unified schema
  const HelpMenu = {
    overview:  { label:'Overview', title:'Help • Overview',   preview:'What MyFi is and how to get around.', render: overviewRender },
    vitals:    { label:'Vitals',   title:'Help • Vitals',     preview:'Your energy pools and how they rise/fall.', render: vitalsRender },
    quests:    { label:'Quests',   title:'Help • Quests',     preview:'Goals into adventures with rewards.', render: questsRender },
    avatars:   { label:'Avatars',  title:'Help • Avatars',    preview:'Customise your hero and perks.', render: avatarsRender },
    badlands:  { label:'The Badlands', title:'Help • The Badlands', preview:'Enter and test your strength.', render: badlandsRender },
    resources: { label:'Products / Guidance', title:'Help • Products & Guidance', preview:'Insights and partner tools.', render: resourcesRender },
    faq:       { label:'FAQ',      title:'Help • FAQ',         preview:'Fast answers to common questions.', render: faqRender },
    report:    { label:'Report an Issue', title:'Help • Report an Issue', preview:'Spotted a bug or idea? Tell us.', 
      render() {
        const wrap = document.createElement('div');
        const email = document.createElement('input'); email.type='email'; email.className='input'; email.id='issueEmail'; email.placeholder='you@example.com';
        const emailField = document.createElement('div'); emailField.className='field';
        const emailLab = document.createElement('label'); emailLab.htmlFor='issueEmail'; emailLab.textContent='Email (optional, for follow-up)';
        emailField.append(emailLab, email);

        const catField = document.createElement('div'); catField.className='field';
        const catLab = document.createElement('label'); catLab.htmlFor='issueCategory'; catLab.textContent='Category (optional)';
        const catSel = document.createElement('select'); catSel.id='issueCategory'; catSel.className='input';
        [['bug-ui','UI bug'],['bug-data','Data issue'],['perf','Performance'],['suggestion','Suggestion/Idea'],['other','Other']]
          .forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; catSel.appendChild(o); });
        catField.append(catLab, catSel);

        const descField = document.createElement('div'); descField.className='field';
        const dLab = document.createElement('label'); dLab.htmlFor='issueDescription'; dLab.textContent='Describe the issue';
        const dTxt = document.createElement('textarea'); dTxt.id='issueDescription'; dTxt.className='input'; dTxt.rows=6; dTxt.placeholder='What happened? Steps to reproduce?';
        descField.append(dLab, dTxt);

        const note = helper(`No sensitive info please. A minimal log will be attached automatically.`);

        wrap.append(catField, descField, emailField, note);
        return [wrap];
      },
      footer() {
        return [
          primary('Submit', ()=>{
            const values={};
            const root = window.MyFiModal.el.contentEl;
            root.querySelectorAll('input,select,textarea').forEach(i=>values[i.id]=i.value);
            values._meta = { ts: Date.now(), userAgent: navigator.userAgent };
            window.dispatchEvent(new CustomEvent('help:report',{detail:values}));
            window.MyFiModal.close();
          }),
          cancel()
        ];
      }
    },
  };

  // expose for quickMenus + deep links
  window.MyFiHelpMenu = HelpMenu;

  // Firestore save for reports
  window.addEventListener('help:report', async (e)=>{
    try {
      let alias = null;
      const uid = auth.currentUser?.uid || null;
      if (uid) {
        const playerSnap = await getDoc(doc(db, 'players', uid));
        if (playerSnap.exists()) alias = playerSnap.data().alias || null;
      }
      await addDoc(collection(db, 'bugReports'), {
        ...e.detail, alias, uid, createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('[Help Report] Failed to save', err);
      alert('Sorry, we could not submit your report. Please try again later.');
    }
  });
})();
