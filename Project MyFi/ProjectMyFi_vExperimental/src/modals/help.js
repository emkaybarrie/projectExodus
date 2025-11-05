// help-modal.js
import { open as openModal } from '../core/modal.js';
import {
  getFirestore, collection, addDoc, serverTimestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

/**
 * Small DOM helpers we used to get from window.MyFiUI
 * We'll inline minimal equivalents so this modal stands alone.
 */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'style' && typeof v === 'object') {
      Object.assign(node.style, v);
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null) continue;
    if (c instanceof Node) node.appendChild(c);
    else node.insertAdjacentHTML('beforeend', c);
  }
  return node;
}

function helper(htmlString) {
  const div = document.createElement('div');
  div.style.fontSize = '14px';
  div.style.lineHeight = '1.4';
  div.style.opacity = '.9';
  div.innerHTML = htmlString;
  return div;
}

// media block from legacy
function mediaBlock({type='image', src='#', alt='', poster='', autoplay=true}) {
  const wrap = document.createElement('div');
  wrap.style.display = 'grid';
  wrap.style.borderRadius = '8px';
  wrap.style.overflow = 'hidden';
  wrap.style.background = 'rgba(255,255,255,.03)';
  wrap.style.border = '1px solid rgba(255,255,255,.06)';
  wrap.style.padding = '8px';

  if (type === 'video') {
    const v = document.createElement('video');
    v.src = src;
    v.playsInline = true;
    v.muted = true;
    v.loop = true;
    if (poster) v.poster = poster;
    if (autoplay) v.autoplay = true;
    v.controls = true;
    v.style.width = '100%';
    v.style.borderRadius = '6px';
    wrap.appendChild(v);

    const io = new IntersectionObserver((ents) => {
      ents.forEach(e => {
        if (e.isIntersecting) { v.play().catch(()=>{}); }
        else { v.pause(); }
      });
    }, { threshold: .25 });
    io.observe(v);
  } else {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || 'Help image';
    img.style.width = '100%';
    img.style.borderRadius = '6px';
    img.style.objectFit = 'cover';
    wrap.appendChild(img);
  }
  return wrap;
}

/**
 * Pages – We recreate the data/logic from legacy helpMenu.js.
 * Each page renderer returns a DOM node to inject into .modal-body.
 */

function segmentedNav(pages, onChange) {
  const wrap = el('div', {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginBottom: '12px'
    }
  });

  pages.forEach((p, idx) => {
    const b = el('button', {
      class: 'modal-btn',
      style: {
        fontSize: '13px',
        lineHeight: '1.2',
        fontWeight: idx === 0 ? '600' : '400',
        border: idx === 0
          ? '1px solid rgba(120,140,255,.4)'
          : '1px solid rgba(255,255,255,.2)',
        background: idx === 0
          ? 'rgba(120,140,255,.15)'
          : 'rgba(255,255,255,.05)'
      }
    }, p.label);

    b.addEventListener('click', () => {
      // visual state
      wrap.querySelectorAll('button').forEach(btn => {
        btn.style.border = '1px solid rgba(255,255,255,.2)';
        btn.style.background = 'rgba(255,255,255,.05)';
        btn.style.fontWeight = '400';
      });
      b.style.border = '1px solid rgba(120,140,255,.4)';
      b.style.background = 'rgba(120,140,255,.15)';
      b.style.fontWeight = '600';

      onChange(idx);
    });

    wrap.appendChild(b);
  });

  return wrap;
}

// ----- individual page builders -----

function overviewPage() {
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
        • <em>Vitals</em> — your energy pools.<br>
        • <em>Quests</em> — challenges that turn goals into rewards.<br>
        • <em>Avatar</em> — customise and level up.<br>
        • <em>Resources</em> — spending insights & partner tools.<br>
        • <em>The Badlands</em> — test the build you’ve created.<br><br>
        Tip: Open the Energy Menu ⚡ to set the energy sources that power your avatar.
      `,
      media:{ type:'image', src:'assets/help/basics-nav.png' }
    }
  ];

  const container = el('div', { style:{ display:'grid', rowGap:'12px' }});
  const nav = segmentedNav(pages, showPage);
  const body = el('div', { style:{ display:'grid', rowGap:'12px' }});

  function showPage(i) {
    const p = pages[i];
    body.replaceChildren(helper(p.text), mediaBlock(p.media));
  }
  showPage(0);

  container.append(nav, body);
  return container;
}

function vitalsPage() {
  const pages = [
    {
      label:'Purpose',
      text: `
        The <strong>Vitals</strong> screen is your core dashboard. It tracks:
        • <em>Stamina</em> — day-to-day energy (flex spending).
        • <em>Mana</em> — intentional / power spending.
        • <em>Health</em> — last line of defense (savings baseline).
        • <em>Essence</em> — long-term growth for unlocks & cosmetics.
        Managing these flows is how you survive quests, grow your avatar, and push deeper into The Badlands.
      `,
      media:{ type:'image', src:'assets/help/vitals-overview.png' }
    },
    {
      label:'Using It',
      text: `
        • Use ⚡ to open the Energy Menu and confirm incoming energy sources.
        • Bars show current vs. max; surplus icons = extra full days stored.
        • Events Log tracks recent spending events — tag them before they lock in.
      `,
      media:{ type:'video', src:'assets/help/vitals-using.mp4', poster:'assets/help/vitals-using.jpg' }
    }
  ];

  const container = el('div', { style:{ display:'grid', rowGap:'12px' }});
  const nav = segmentedNav(pages, showPage);
  const body = el('div', { style:{ display:'grid', rowGap:'12px' }});

  function showPage(i) {
    const p = pages[i];
    body.replaceChildren(helper(p.text), mediaBlock(p.media));
  }
  showPage(0);

  container.append(nav, body);
  return container;
}

function questsPage() {
  const body = el('div', { style:{ display:'grid', rowGap:'12px' }});
  body.append(
    helper(`
      <strong>Quests</strong> turn goals into challenges. Maintain tagging streaks,
      hit savings milestones, keep your energy balanced — you get rewards, momentum,
      and perks that strengthen your avatar.
    `),
    mediaBlock({ type:'image', src:'assets/help/quests.png' })
  );
  return body;
}

function avatarsPage() {
  const pages = [
    {
      label:'Progress',
      text: `
        Your <strong>Avatar</strong> mirrors your journey. Level up, unlock skills,
        gear, cosmetics, and perks that reflect (and reinforce) real-world progress.
      `,
      media:{ type:'image', src:'assets/help/avatars-1.png' }
    },
    {
      label:'Loadout',
      text: `
        Equip skills and items that match your style: Mana-heavy planner, Stamina-balanced survivor, etc.
        Your loadout affects your stats in Vitals and your strength in The Badlands.
      `,
      media:{ type:'image', src:'assets/help/avatars-2.png' }
    }
  ];

  const container = el('div', { style:{ display:'grid', rowGap:'12px' }});
  const nav = segmentedNav(pages, showPage);
  const body = el('div', { style:{ display:'grid', rowGap:'12px' }});

  function showPage(i) {
    const p = pages[i];
    body.replaceChildren(helper(p.text), mediaBlock(p.media));
  }
  showPage(0);

  container.append(nav, body);
  return container;
}

function badlandsPage() {
  const wrap = el('div', { style:{ display:'grid', rowGap:'12px' }});
  wrap.append(
    helper(`
      <strong>The Badlands</strong> is where you prove yourself.
      Rogue-lite runs, changing routes, co-op potential, seasonal challenge.
      Your avatar's strength there literally comes from how you manage IRL.
    `),
    mediaBlock({ type:'video', src:'assets/help/badlands.mp4', poster:'assets/help/badlands.jpg' })
  );
  return wrap;
}

function resourcesPage() {
  const pages = [
    {
      label:'Overview',
      text: `
        <strong>Resources</strong> gives you spending insight and partner tools.
        See trends, spot risk, explore options that may boost both IRL and in-game.
      `,
      media:{ type:'image', src:'assets/help/resources-overview.png' }
    },
    {
      label:'Insights',
      text: `
        • Spot behavioural trends (drift, burn rate, streaks)
        • See projections and alerts
        • Unlock tips that feed into Quests and Avatar perks
      `,
      media:{ type:'image', src:'assets/help/resources-insights.png' }
    },
    {
      label:'Partner Products',
      text: `
        Curated services (banks, utilities, etc.) that can unlock perks.
        100% optional. You choose.
      `,
      media:{ type:'image', src:'assets/help/resources-products.png' }
    }
  ];

  const container = el('div', { style:{ display:'grid', rowGap:'12px' }});
  const nav = segmentedNav(pages, showPage);
  const body = el('div', { style:{ display:'grid', rowGap:'12px' }});

  function showPage(i) {
    const p = pages[i];
    body.replaceChildren(helper(p.text), mediaBlock(p.media));
  }
  showPage(0);

  container.append(nav, body);
  return container;
}

function faqPage() {
  // dynamic select Q/A
  const faqs = [
    ['getting-started','How do I get started?'],
    ['tagging','What is tagging and why does it matter?'],
    ['regen','How does regen work?'],
    ['privacy','What data do you store?'],
  ];

  const contentByKey = {
    'getting-started': {
      text:`Set income & core expenses, then add a few transactions. Watch the Vitals HUD update live.`,
      media:{type:'image', src:'assets/help/faq-start.png'}
    },
    'tagging': {
      text:`Tag spending as Mana if it’s intentional. Otherwise it defaults to Stamina. Overspending can spill into Health.`,
      media:{type:'image', src:'assets/help/faq-tag.png'}
    },
    'regen': {
      text:`Energy regenerates from income (after core expenses). Overspending slows the flow.`,
      media:{type:'image', src:'assets/help/faq-regen.png'}
    },
    'privacy': {
      text:`Your data stays yours. Bank connections use trusted providers; you control access.`,
      media:{type:'image', src:'assets/help/faq-privacy.png'}
    },
  };

  const root = el('div', { style:{ display:'grid', rowGap:'12px' }});

  const label = el('label', {
    style:{ fontSize:'12px', color:'rgba(255,255,255,.8)' }
  }, 'Question');

  const selectEl = el('select', {
    class: 'form-select',
    style:{ maxWidth:'100%' }
  });

  faqs.forEach(([value, text]) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    selectEl.appendChild(o);
  });

  const body = el('div', { style:{ display:'grid', rowGap:'12px' }});

  function renderKey(k) {
    const d = contentByKey[k];
    body.replaceChildren(helper(d.text), mediaBlock(d.media));
  }
  selectEl.addEventListener('change', e => {
    renderKey(e.target.value);
  });

  // init
  renderKey(faqs[0][0]);

  root.append(
    el('div', { style:{ display:'grid', rowGap:'4px' }}, label, selectEl),
    body
  );
  return root;
}

function reportPage(refCloseModal) {
  // This matches legacy "Report an Issue"
  const root = el('div', { style:{ display:'grid', rowGap:'12px' }});

  const emailField = (() => {
    const lab = el('label', { class:'form-label' }, 'Email (optional, for follow-up)');
    const input = el('input', { class:'form-input', type:'email', id:'issueEmail', placeholder:'you@example.com' });
    const wrap  = el('div', { class:'form-field' }, lab, input);
    return wrap;
  })();

  const catField = (() => {
    const lab = el('label', { class:'form-label' }, 'Category (optional)');
    const sel = el('select', { class:'form-select', id:'issueCategory' });
    [
      ['bug-ui','UI bug'],
      ['bug-data','Data issue'],
      ['perf','Performance'],
      ['suggestion','Suggestion/Idea'],
      ['other','Other'],
    ].forEach(([v,t])=>{
      const o=document.createElement('option');
      o.value=v;o.textContent=t;sel.appendChild(o);
    });
    const wrap = el('div', { class:'form-field' }, lab, sel);
    return wrap;
  })();

  const descField = (() => {
    const lab = el('label', { class:'form-label' }, 'Describe the issue');
    const area = el('textarea', {
      class:'form-input',
      id:'issueDescription',
      rows:'5',
      placeholder:'What happened? Steps to reproduce?'
    });
    area.style.resize = 'vertical';
    const wrap = el('div', { class:'form-field' }, lab, area);
    return wrap;
  })();

  const note = helper(`No sensitive info please. A minimal log will be attached automatically.`);

  root.append(
    helper('<strong>Report an Issue</strong>'),
    helper('Spotted a bug or idea? Tell us.'),
    catField,
    descField,
    emailField,
    note
  );

  // Footer buttons (Submit / Close)
  // We return both body node and a function that can render footer buttons.
  function buildFooterButtons(footerEl) {
    const closeBtn = el('button', { class:'modal-btn', id:'help-close' }, 'Close');
    const submitBtn = el('button', { class:'modal-btn modal-btn-primary', id:'help-submit' }, 'Submit');

    footerEl.replaceChildren(submitBtn, closeBtn);

    closeBtn.addEventListener('click', () => {
      refCloseModal();
    });

    submitBtn.addEventListener('click', async () => {
      // collect data
      const values = {};
      const emailInput = footerEl.closest('.modal-inner').querySelector('#issueEmail');
      const catInput   = footerEl.closest('.modal-inner').querySelector('#issueCategory');
      const descInput  = footerEl.closest('.modal-inner').querySelector('#issueDescription');

      values.email = emailInput?.value?.trim() || '';
      values.category = catInput?.value || '';
      values.description = descInput?.value?.trim() || '';
      values._meta = {
        ts: Date.now(),
        userAgent: navigator.userAgent
      };

      try {
        const auth = getAuth();
        const uid = auth?.currentUser?.uid || null;

        // attach alias for triage
        let alias = null;
        if (uid) {
          const db  = getFirestore();
          const snap = await getDoc(doc(db, 'players', uid));
          if (snap.exists()) {
            alias = snap.data().alias || null;
          }
        }

        const db = getFirestore();
        await addDoc(collection(db, 'bugReports'), {
          ...values,
          alias,
          uid,
          createdAt: serverTimestamp()
        });

        refCloseModal();
        alert('Thanks — sent.');
      } catch (err) {
        console.error('[Help Report] Failed to save', err);
        alert('Sorry, could not submit right now.');
      }
    });
  }

  return { node: root, buildFooterButtons };
}

/**
 * openHelpModal
 * - Builds shell HTML with head/body/footer using our shared modal classes.
 * - Injects initial page (Overview).
 * - Renders tab buttons so user can switch pages, including Report.
 * - Footer is updated dynamically depending on page.
 */
export function openHelpModal(owner='hub') {
  // We'll render:
  // modal-head: static title/subtitle
  // modal-body: dynamic content area
  // modal-footer: dynamic action row
  //
  // Implementation strategy:
  //   1. Build template HTML string for these three sections.
  //   2. After openModal(), grab .modal-card:last-child and hydrate.

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <div class="modal-head">
      <div class="modal-head-title">Help &amp; Support</div>
      <div class="modal-head-sub">Tips, FAQs, contact</div>
    </div>

    <div class="modal-body" id="help-body"
      style="display:grid;row-gap:16px;">
      <!-- populated dynamically -->
    </div>

    <div class="modal-footer" id="help-footer">
      <!-- populated dynamically -->
      <button class="modal-btn" id="help-close">Close</button>
    </div>
  `;

  const ref = openModal({
    owner,
    scope: 'screen',
    content: tpl.content
  });

  const cardEl   = document.querySelector('#modal-root .modal-card:last-child');
  const bodyEl   = cardEl.querySelector('#help-body');
  const footerEl = cardEl.querySelector('#help-footer');
  const closeNow = () => ref.close();

  // Build our page map, similar to HelpMenu in legacy:
  function simplePage(nodeBuilder, footerButtons=defaultFooterButtons) {
    return { mount() {
      bodyEl.replaceChildren(nodeBuilder());
      footerButtons();
    }};
  }

  function defaultFooterButtons() {
    footerEl.replaceChildren(
      mkCloseBtn()
    );
  }

  function mkCloseBtn() {
    const b = document.createElement('button');
    b.className = 'modal-btn';
    b.textContent = 'Close';
    b.addEventListener('click', closeNow);
    return b;
  }

  const pages = {
    overview: {
      label: 'Overview',
      build: () => simplePage(() => overviewPage())
    },
    vitals: {
      label: 'Vitals',
      build: () => simplePage(() => vitalsPage())
    },
    quests: {
      label: 'Quests',
      build: () => simplePage(() => questsPage())
    },
    avatars: {
      label: 'Avatars',
      build: () => simplePage(() => avatarsPage())
    },
    badlands: {
      label: 'The Badlands',
      build: () => simplePage(() => badlandsPage())
    },
    resources: {
      label: 'Resources',
      build: () => simplePage(() => resourcesPage())
    },
    faq: {
      label: 'FAQ',
      build: () => simplePage(() => faqPage())
    },
    report: {
      label: 'Report an Issue',
      build: () => {
        const { node, buildFooterButtons } = reportPage(closeNow);
        return {
          mount() {
            bodyEl.replaceChildren(node);
            buildFooterButtons(footerEl);
          }
        };
      }
    }
  };

  // Render nav pills for each section at the top of body
  const navBar = document.createElement('div');
  navBar.style.display = 'flex';
  navBar.style.flexWrap = 'wrap';
  navBar.style.gap = '8px';

  Object.entries(pages).forEach(([key, page]) => {
    const btn = document.createElement('button');
    btn.className = 'modal-btn';
    btn.textContent = page.label;
    btn.style.fontSize = '13px';
    btn.style.lineHeight = '1.2';

    btn.addEventListener('click', () => {
      // highlight active
      [...navBar.children].forEach(c => {
        c.classList.remove('modal-btn-primary');
        c.classList.remove('modal-btn-danger');
        c.style.border = '1px solid rgba(255,255,255,.2)';
        c.style.background = 'rgba(255,255,255,.05)';
      });
      btn.style.border = '1px solid rgba(120,140,255,.4)';
      btn.style.background = 'rgba(120,140,255,.15)';
      btn.classList.add('modal-btn-primary');

      // mount page
      const built = page.build();
      built.mount();
      // re-prepend navBar on every mount so nav sticks at top
      bodyEl.prepend(navBar);
    });

    navBar.appendChild(btn);
  });

  // Initial page = Overview
  const firstBtn = navBar.firstChild;
  const firstPage = pages.overview.build();
  firstPage.mount();
  bodyEl.prepend(navBar);

  // Close button in footer (for initial state)
  footerEl.querySelector('#help-close')?.addEventListener('click', closeNow);
}
