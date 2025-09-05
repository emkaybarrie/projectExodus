// js/socialMenu.js
// Social (Friends / Community / Requests) — v1 UI only, no backend writes.
// Depends on: kit.js, modal.js
//
// Exposes: window.MyFiSocialMenu
// Use via quickMenus OR:
//   window.MyFiModal.openChildItem(window.MyFiSocialMenu, 'home', { menuTitle: 'Social' });

(function () {
  const { el, helper, field, inlineError, setError, btn, primary, cancel, btnOpenItem } = window.MyFiUI;
  const modal = () => window.MyFiModal?.el || {};

  // -------------------- Local ephemeral state (stub) --------------------
  // Replace these with Firestore listeners later.
  const state = {
    currentTab: 'friends', // 'friends' | 'community' | 'requests'
    friends: [
    ],
    requests: [
    ],
    // Outgoing (sent) — shown in the new "Sent" sub-tab
    sentRequests: [
      // { uid:'u_kai', alias:'Kai', avatar:'./assets/portraits/avatarKai.png', sinceMs: Date.now()-2200_000 }
    ],

  };

  // -------------------- Helpers --------------------
  // In-memory profile cache for display (alias, avatar)
    const _profileCache = new Map(); // uid -> { alias, avatar }
    async function fetchProfile(uid) {
    if (_profileCache.has(uid)) return _profileCache.get(uid);
    try {
        const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const db = getFirestore();
        const snap = await getDoc(doc(db, 'players', uid));
        const d = snap.exists() ? snap.data() : {};

        // Stub for profile pic
        const portraitNames = ["Emkay","Alie","Richard","Mohammed","Jane","Amandeep","Matthew","Gerard","Sammi","Kirsty", "Kim"];
        const portraitKey = portraitNames.includes(d.firstName) ? ('avatar' + d.firstName) : 'default';
        const portraitImageSrc = `./assets/portraits/${portraitKey}.png`;

        const obj = { alias: d.alias || uid.slice(0,6), avatar: portraitImageSrc || d.avatarUrl || './assets/portraits/default.png', firstName: d.firstName || ''};
        _profileCache.set(uid, obj);
        return obj;
    } catch { return { alias: uid.slice(0,6), avatar: './assets/portraits/default.png' }; }
    }

  // Small utility
  const timeAgo = (ms) => {
    const s = Math.max(1, Math.floor((Date.now() - ms)/1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s/60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m/60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h/24); return `${d}d ago`;
  };

  function pendingReceivedCount(){ return state.requests.length|0; }
  function pendingTotalCount(){ return (state.requests.length + state.sentRequests.length) | 0; }

  // ---- External badge API (call this once from your app to attach a target) ----
  if (!window.MyFiSocialMenu) window.MyFiSocialMenu = {};
  window.MyFiSocialMenu.__state = state;


  // -------------------- Header (title + Invite) --------------------
  function headerBar() {
    const wrap = el('div', { class: 'social__header', style: {
      display:'flex', alignItems:'center', justifyContent:'space-between',
      gap:'12px', marginBottom:'8px'
    }});
    const title = el('div', { class: 'social__title', style:{ fontWeight:'600', fontSize:'18px' }}, 'Social');
    const invite = btn('Invite to MyFi', 'accent', () => {
      // Navigate to internal Invite placeholder
      window.MyFiModal.openChildItem(window.MyFiSocialMenu, 'invite', { menuTitle: 'Invite to MyFi' });
    });
    invite.classList.add('social__inviteBtn');
    wrap.append(title, invite);
    return wrap;
  }

  // -------------------- Tabs --------------------
  function tabsBar(onChange) {
    const bar = el('div', { class: 'social__tabs', style: {
      display:'flex', gap:'8px', margin:'8px 0 12px', flexWrap:'wrap'
    }});

    const mkTab = (key, label) => {
      const b = btn(label, 'secondary', () => {
        state.currentTab = key;
        onChange?.(key);
      });
      b.dataset.tab = key;
      b.classList.add('social__tab');
      return b;
    };

    const f = mkTab('friends', 'Friends');
    const c = mkTab('community', 'Community');
    const r = mkTab('requests', '');

    function paint() {
      [f,c,r].forEach(b => {
        if (b.dataset.tab === state.currentTab) b.classList.add('is-active');
        else b.classList.remove('is-active');
      });

      const rc = pendingReceivedCount();
      r.textContent = rc > 0 ? `Requests (${rc})` : 'Requests';
    }
    paint();
    bar.append(f,c,r);
    bar.paint = paint; // allow external refresh
    return bar;
  }

  // -------------------- Friend Row (with sandwich menu) --------------------
  function friendRow(friend) {
    const row = el('div', { class: 'social__row', style: {
      display:'grid', gridTemplateColumns:'40px 1fr auto', alignItems:'center',
      gap:'10px', padding:'8px 6px', border:'1px solid rgba(255,255,255,0.06)',
      borderRadius:'10px', marginBottom:'8px', background:'rgba(255,255,255,0.03)'
    }});

    const avatar = el('img', {
      src: friend.avatar || './assets/portraits/default.png',
      alt: `${friend.alias} avatar`,
      style:{ width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover' }
    });

    const text = el('div', { class: 'social__rowText' });
    const alias = el('div', { style:{ fontWeight:'600' }}, friend.alias);
    const secondaryText = (friend.theirTrust && friend.firstName)
      ? `First name visible: ${friend.firstName}`
      : (friend.status || '—');
    const status = el('div', { class: 'social__status', style:{ opacity:0.8, fontSize:'12px' }}, secondaryText);
    text.append(alias, status);

    // Sandwich button + tiny dropdown
    const actionsWrap = el('div', { style:{ position:'relative' }});
    const menuBtn = btn('⋮', 'secondary', () => {
      menu.classList.toggle('is-open');
    });
    menuBtn.setAttribute('aria-haspopup','menu');
    menuBtn.style.width = '36px';

    const menu = el('div', { class:'social__menu', role:'menu', style:{
      position:'absolute', right:'0', top:'calc(100% + 6px)',
      background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)',
      border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px',
      padding:'6px', minWidth:'160px', display:'none', zIndex:'4'
    }});
    menu.classList.toggle = (on) => { menu.style.display = (on ? 'block' :
      (menu.style.display==='block' ? 'none' : 'block')); };
    menu.classList.contains = () => menu.style.display === 'block';

    const closeMenus = (e) => {
      if (!actionsWrap.contains(e.target)) menu.style.display = 'none';
    };
    document.addEventListener('click', closeMenus);

    // Send Message
    const sendMsg = btn('Send message', 'secondary', () => {
      // TODO: hook to messaging menu
      alert(`(Placeholder) Start chat with ${friend.alias}`);
      menu.style.display = 'none';
    });
    sendMsg.style.width = '100%';

    // Trusted Friendship
    const toggleTrust = btn(friend.myTrust ? 'Remove trust' : 'Trust friend', 'secondary', async () => {
      const wantTrust = !friend.myTrust;
      const ok = confirm(
        wantTrust
          ? 'Trust this friend? Your first name will be visible to them (and more in future).'
          : 'Remove trust for this friend? They will lose access to your first name.'
      );
      if (!ok) return;

      // Backend hook
      try {
        const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
        const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'setFriendTrust');
        await fn({ friendUid: friend.uid, trusted: wantTrust });

        friend.trusted = wantTrust;
        // Repaint current panel
        const panel = modal().contentEl?.querySelector('.social__panel');
        panel && panel.parentElement?.paintPanel?.();
        menu.style.display = 'none';
      } catch (e) {
        alert('Could not update trust. Please try again.');
      }
    });
    toggleTrust.style.width = '100%';


    // Remove Friend
    const removeBtn = btn('Remove friend', 'secondary', async () => {
    if (!confirm(`Remove ${friend.alias} from your friends?`)) return;
    removeBtn.disabled = true;

    try {
        const { getFunctions, httpsCallable } =
        await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
        const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'removeFriend');
        await fn({ uid: friend.uid });
        // Live friends listener will update the UI automatically.
        alert(`Removed ${friend.alias}.`);
        menu.style.display = 'none';
    } catch (e) {
        console.warn('[Social] removeFriend failed', e);
        alert('Could not remove friend. Please try again.');
    } finally {
        removeBtn.disabled = false;
    }
    });
    removeBtn.style.width = '100%';

    menu.append(sendMsg, toggleTrust, removeBtn);
    actionsWrap.append(menuBtn, menu);

    row.append(avatar, text, actionsWrap);

    // Make clickable (but not on menu button)
    row.style.cursor = 'pointer';
    row.addEventListener('click', (e) => {
      if (actionsWrap.contains(e.target)) return; // ignore menu clicks
      window.MyFiModal.openChildItem(window.MyFiSocialMenu, 'friendProfile', {
        menuTitle: friend.alias,
        friend
      });
    });
    return row;
  }

  // -------------------- Requests list rows --------------------
  function requestRow(req, onAccept, onDecline) {
    const row = el('div', { class: 'social__row', style: {
      display:'grid', gridTemplateColumns:'40px 1fr auto', alignItems:'center',
      gap:'10px', padding:'8px 6px', border:'1px solid rgba(255,255,255,0.06)',
      borderRadius:'10px', marginBottom:'8px', background:'rgba(255,255,255,0.03)'
    }});

    const avatar = el('img', {
      src: req.avatar || './assets/portraits/default.png',
      alt: `${req.alias} avatar`,
      style:{ width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover' }
    });

    const text = el('div', {});
    const alias = el('div', { style:{ fontWeight:'600' }}, req.alias);
    const since = el('div', { style:{ opacity:0.8, fontSize:'12px' }}, `Requested ${timeAgo(req.sinceMs)}`);
    text.append(alias, since);

    const actions = el('div', { style:{ display:'flex', gap:'8px' }});
    const accept = primary('Accept', () => onAccept(req));
    const decline = btn('Decline', 'secondary', () => onDecline(req));

    actions.append(accept, decline);
    row.append(avatar, text, actions);
    return row;
  }

  // -------------------- Panels --------------------
  function renderFriendsPanel(container) {
    container.replaceChildren(
      helper('<strong>Your friends</strong>'),
      ...state.friends.map(friendRow),
      state.friends.length ? '' : helper('No friends yet. Tap <em>Add friend</em> to get started.')
    );
  }

  function renderCommunityPanel(container) {
    container.replaceChildren(
      helper('<strong>Community</strong>'),
      helper('Placeholder for now — this will list communities (clans/guilds) you create or join.'),
      helper('Tap <em>Create Community</em> below to mock-create one in a future update.')
    );
  }

  function renderRequestsPanel(container) {
    // local UI state for sub-tab
    let subTab = 'received'; // 'received' | 'sent'

    const wrap = el('div', {});

    // Sub-tabs
    const tabs = el('div', { style:{ display:'flex', gap:'8px', marginBottom:'8px', flexWrap:'wrap' }});
    const tRecv = btn('Received', 'secondary', () => { subTab='received'; paint(); });
    const tSent = btn('Sent',     'secondary', () => { subTab='sent';     paint(); });
    function paintSubTabs(){
      [tRecv, tSent].forEach(b=>b.classList.remove('is-active'));
      (subTab === 'received' ? tRecv : tSent).classList.add('is-active');
    }
    tabs.append(tRecv, tSent);

    const list = el('div');

    const onAccept = async (req) => {
      try {
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const me = getAuth()?.currentUser?.uid;
        if (!me) throw new Error('No auth');
        const requestId = `${req.uid}__${me}`;
        const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
        const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'respondToFriendRequest');
        await fn({ requestId, accept: true });
        // listener updates UI
      } catch (e) {
        alert('Could not accept the request.'); console.warn(e);
      }
    };
    const onDecline = async (req) => {
      try {
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const me = getAuth()?.currentUser?.uid;
        if (!me) throw new Error('No auth');
        const requestId = `${req.uid}__${me}`;
        const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
        const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'respondToFriendRequest');
        await fn({ requestId, accept: false });
      } catch (e) {
        alert('Could not decline the request.'); console.warn(e);
      }
    };
    const onCancelSent = async (req) => {
      try {
        // TODO: implement cancelFriendRequest in backend
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const me = getAuth()?.currentUser?.uid;
        if (!me) throw new Error('Not signed in');

        const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
        const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'cancelFriendRequest');
        await fn({ requestId: `${me}__${req.uid}` });

        paint();
      } catch (e) {
        alert('Could not cancel the request.'); console.warn(e);
      }
    };

    function sentRow(req){
      const row = el('div', { class:'social__row', style:{
        display:'grid', gridTemplateColumns:'40px 1fr auto', alignItems:'center',
        gap:'10px', padding:'8px 6px', border:'1px solid rgba(255,255,255,0.06)',
        borderRadius:'10px', marginBottom:'8px', background:'rgba(255,255,255,0.03)'
      }});
      const avatar = el('img', { src:req.avatar || './assets/portraits/default.png', alt:`${req.alias} avatar`,
        style:{ width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover' }});
      const text = el('div', {});
      const alias = el('div', { style:{ fontWeight:'600' }}, req.alias);
      const since = el('div', { style:{ opacity:0.8, fontSize:'12px' }}, `Sent ${timeAgo(req.sinceMs || Date.now())}`);
      text.append(alias, since);
      const actions = el('div', { style:{ display:'flex', gap:'8px' }});
      const cancelBtn = btn('Cancel', 'secondary', () => onCancelSent(req));
      actions.append(cancelBtn);
      row.append(avatar, text, actions);
      return row;
    }

    function paintList(){
      if (subTab === 'received') {
        list.replaceChildren(
          helper('<strong>Friend requests — Received</strong>'),
          ...state.requests.map(r => requestRow(r, onAccept, onDecline)),
          state.requests.length ? '' : helper('No pending received requests.')
        );
      } else {
        list.replaceChildren(
          helper('<strong>Friend requests — Sent</strong>'),
          ...state.sentRequests.map(sentRow),
          state.sentRequests.length ? '' : helper('No pending sent requests.')
        );
      }
    }

    function paint(){
      paintSubTabs();
      paintList();
    }

    wrap.append(tabs, list);
    container.replaceChildren(wrap);
    paint();
  }

  // -------------------- Add Friend (child item) --------------------
    function addFriendRender() {
    // Simple one-field form (alias or friend code)
    const root = el('div');

    const tip = helper(
        '<strong>Add a friend</strong><br>' +
        'Enter their public alias or a friend code.'
    );

    const input = field('Friend alias or code', 'text', 'afTarget', {
        placeholder: 'e.g. AnnaTheBrave or ABC123',
        autocomplete: 'off',
        inputmode: 'text'
    });

    const err = inlineError('afError');

    // Hints
    const hint = helper('<small>Tip: You can paste a code from an invite, or type their handle.</small>');

    root.append(tip, input, err, hint);

    // Accessibility nicety: focus input after mount
    setTimeout(() => document.getElementById('afTarget')?.focus(), 0);

    return [root];
    }

    // (inside socialMenu.js) replace only the addFriendFooter() with this version:
    function addFriendFooter() {
    const send = primary('Send request', async () => {
        const targetEl = document.getElementById('afTarget');
        const errEl    = document.getElementById('afError');
        const raw      = String(targetEl?.value || '').trim();

        // Basic validation
        if (!raw) return setError(errEl, 'Please enter a friend alias or code.', targetEl);
        const ok = /^[A-Za-z0-9_\-]{3,32}$/.test(raw);
        if (!ok) return setError(errEl, 'Use 3–32 letters/numbers/underscore/dash.', targetEl);
        setError(errEl, '');

        // Disable while sending
        const prevLabel = send.textContent;
        send.disabled = true; send.textContent = 'Sending…';

        try {
        const { getApp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
        const { getFunctions, httpsCallable } =
            await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');

        const app = getApp(); // should be myfi-app-7fa78
        const functions = getFunctions(app, 'europe-west2');
        const fn = httpsCallable(functions, 'sendFriendRequest');

        await fn({ target: raw }); // { requestId, toUid, status }

        if (window.MyFiSocialMenu?.__state) window.MyFiSocialMenu.__state.currentTab = 'requests';
        window.MyFiModal.openChildItem(window.MyFiSocialMenu, 'home', { menuTitle: 'Social' });
        } catch (e) {
        const code = e?.code || '';
        const msg =
            code === 'not-found'         ? 'We couldn’t find that alias.' :
            code === 'already-exists'    ? 'You are already friends.' :
            code === 'permission-denied' ? 'You can’t add this player.' :
            code === 'unauthenticated'   ? 'Please sign in first.' :
            'Could not send the request. Please try again.';
        setError(errEl, msg, targetEl);
        send.disabled = false; send.textContent = prevLabel;
        return;
        }
    });

    return [send];
    }
  
  // -------------------- Friend Profile --------------------
  function friendProfileRender(opts){
    const friend = opts?.friend || {};
    const root = el('div', { style:{ display:'grid', gap:'12px' }});

    const avatar = el('img', {
      src: friend.avatar || './assets/portraits/default.png',
      alt: `${friend.alias} avatar`,
      style:{ width:'96px', height:'96px', borderRadius:'14px', objectFit:'cover' }
    });

    const title = el('div', { style:{ fontWeight:'700', fontSize:'18px' }}, friend.alias || 'Friend');

    const sub = el('div', { style:{ opacity:.85 }});
    const lines = [];
    if (friend.theirTrust && friend.firstName) lines.push(`<strong>First name:</strong> ${friend.firstName}`);
    lines.push(`<strong>Your sharing:</strong> ${friend.myTrust ? 'You trust them' : 'Standard'}`);
    sub.innerHTML = lines.join('<br>');

    const actions = el('div', { style:{ display:'flex', gap:'8px', flexWrap:'wrap' }});
    const msg = btn('Send message', 'secondary', () => alert(`(Placeholder) Start chat with ${friend.alias}`));

    const toggleTrust = btn(friend.myTrust ? 'Remove trust' : 'Trust friend', 'secondary', async () => {
      const wantTrust = !friend.myTrust;
      const ok = confirm(
        wantTrust
          ? 'Trust this friend? Your first name will be visible to them (and more in future).'
          : 'Remove trust for this friend? They will lose access to your first name.'
      );
      if (!ok) return;

      // Backend hook
      try {
        const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
        const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'setFriendTrust');
        await fn({ friendUid: friend.uid, trusted: wantTrust });

        friend.trusted = wantTrust;
        // Repaint current panel
        const panel = modal().contentEl?.querySelector('.social__panel');
        panel && panel.parentElement?.paintPanel?.();
        menu.style.display = 'none';
      } catch (e) {
        alert('Could not update trust. Please try again.');
      }
    });

    actions.append(msg, toggleTrust);
    root.append(avatar, title, sub, actions);
    return [root];
  }
  function friendProfileFooter(){ return [ cancel('Close') ]; }


// Unsub holders so we can cleanup if needed
let _unsubFriends = null;
let _unsubRequests = null;

// Start/stop listeners for current user
async function startSocialListeners(uid, onFriends, onRequests) {
  const { getFirestore, collection, doc, getDoc, onSnapshot, query, orderBy } =
    await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
  const db = getFirestore();

  // Friends listener
  const friendsCol = collection(db, 'players', uid, 'friends');
  const qFriends = query(friendsCol, orderBy('createdMs', 'desc'));
  _unsubFriends?.();
  _unsubFriends = onSnapshot(qFriends, async (snap) => {
    const rows = [];
    for (const docSnap of snap.docs) {
      const fuid = docSnap.id;
      const [prof, theirEdge] = await Promise.all([
        fetchProfile(fuid),
        // reverse edge: do THEY trust ME?
        getDoc(doc(db, 'players', fuid, 'friends', uid)).catch(() => null)
      ]);
      const myTrust    = !!docSnap.data()?.trusted;
      const theirTrust = !!(theirEdge && theirEdge.exists && theirEdge.data()?.trusted);
      rows.push({
        uid: fuid,
        alias: prof.alias,
        firstName: prof.firstName || '',
        avatar: prof.avatar,
        myTrust,          // I trust them (lets THEM see MY name)
        theirTrust,       // They trust me (lets ME see THEIR name)
        status: '—'
      });
    }
    onFriends(rows);
  });

  // Requests listener (pending)
  const reqCol = collection(db, 'players', uid, 'friendRequests');
  // order by createdMs desc if you store it; otherwise plain onSnapshot
  _unsubRequests?.();
  _unsubRequests = onSnapshot(reqCol, async (snap) => {
    const rows = [];
    for (const docSnap of snap.docs) {
      const d = docSnap.data() || {};
      const fromUid = d.fromUid;
      if (!fromUid) continue;
      const prof = await fetchProfile(fromUid);
      rows.push({
        uid: fromUid,
        alias: prof.alias,
        avatar: prof.avatar,
        sinceMs: d.createdMs || Date.now()
      });
    }
    onRequests(rows);
  });

  // OPTIONAL: Sent requests listener (if you maintain such a subcollection)
  try {
    const sentCol = collection(db, 'players', uid, 'requestsSent');
    const qSent = query(sentCol, orderBy('createdMs', 'desc'));
    onSnapshot(qSent, async (snap) => {
      const rows = [];
      for (const docSnap of snap.docs) {
        const d = docSnap.data() || {};
        const toUid = d.toUid;
        if (!toUid) continue;
        const prof = await fetchProfile(toUid);
        rows.push({
          uid: toUid,
          alias: prof.alias,
          avatar: prof.avatar,
          sinceMs: d.createdMs || Date.now()
        });
      }
      state.sentRequests = rows;
     // repaint if user is on Requests tab and viewing "Sent"
     if (state.currentTab === 'requests') {
       const panel = document.querySelector('.social__panel');
       // Note: renderRequestsPanel fully rerenders, so just call holder's paint if available
       panel && panel.parentElement?.paintPanel?.();
     }
    });
  } catch {}
 
}

function stopSocialListeners() {
  try { _unsubFriends?.(); } catch {}
  try { _unsubRequests?.(); } catch {}
  _unsubFriends = _unsubRequests = null;
}



  // -------------------- Main render (home) --------------------
  function socialHomeRender() {
    const root = el('div');

    // inside socialHomeRender(), after: const root = el('div');
    (async () => {
    try {
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const auth = getAuth();
        const uid = auth?.currentUser?.uid;
        if (!uid) return; // not signed-in; keep stubs
        await startSocialListeners(uid,
        (friends) => { state.friends = friends; root.paintPanel?.(); },
        (requests) => { state.requests = requests; tabs.paint?.(); if (state.currentTab === 'requests') root.paintPanel?.();}
        );
    } catch (e) {
        console.warn('[Social] listeners failed to start', e);
    }
    })();

    // (optional) stop listeners when modal closes (if you have such an event)
    // window.addEventListener('modal:closed', stopSocialListeners);


    // Header with Invite
    root.append(headerBar());

    // Tabs + content
    const tabs = tabsBar((key) => {
      state.currentTab = key;
      tabs.paint?.();
      paintPanel();
      paintFooter();
    });
    const panel = el('div', { class: 'social__panel' });
    root.append(tabs, panel);

    function paintPanel() {
      if (state.currentTab === 'friends') renderFriendsPanel(panel);
      else if (state.currentTab === 'community') renderCommunityPanel(panel);
      else renderRequestsPanel(panel);
    }
    paintPanel();
    tabs.paint?.();

    // Save a handle so footer can refresh its primary action label
    root.paintPanel = paintPanel;
    return [root];
  }

  // Footer with dynamic primary action
  function socialHomeFooter() {
    const container = el('div'); // wrapper to let us repaint

    const addFriend = btnOpenItem('Add friend', window.MyFiSocialMenu, 'addFriend', {
    menuTitle: 'Add Friend'
    });


    const createCommunity = primary('Create Community', () => {
      // TODO: open "Create Community" form (future)
      alert('(Placeholder) Create Community wizard coming soon.');
    });

    const closeBtn = cancel('Close');

    function paintFooter() {
      container.replaceChildren(
        state.currentTab === 'community' ? createCommunity : addFriend,
        closeBtn
      );
    }
    paintFooter();

    // expose so body renderer can request a repaint if tabs change
    container.paintFooter = paintFooter;
    // tiny handshake to allow repaint after tab switch
    setTimeout(() => {
      const body = modal().contentEl?.querySelector('.social__panel')?.parentElement;
      // no-op; kept to mirror pattern if you add cross-refs later
    }, 0);

    // Make available to the tabs change handler
    socialHomeFooter.paint = paintFooter;
    return [container];
  }
  function paintFooter() { socialHomeFooter.paint?.(); }

  // -------------------- Invite placeholder --------------------
  function inviteRender() {
    const root = el('div');
    const codeEl = el('div', { style:{ fontSize:'14px', opacity:0.85 }}, 'Loading…');
    const linkEl = el('code', { style:{ display:'block', marginTop:'6px', wordBreak:'break-all' }}, '');
    const copyBtn = btn('Copy link', 'secondary', async () => {
      const txt = linkEl.textContent || '';
      await navigator.clipboard?.writeText(txt);
      alert('Copied!');
    });

    root.append(
      helper('<strong>Invite to MyFi</strong>'),
      helper('Share your personal invite link or code with friends.'),
      codeEl,
      linkEl,
      copyBtn
    );

    (async () => {
      try {
        const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
        const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'ensureInviteCode');
        const baseHint = window.location.href; // e.g., http://127.0.0.1:5500/Project%20MyFi/somepage.html
        const { data } = await fn({baseHint});
        codeEl.textContent = `Your code: ${data.inviteCode}`;
        linkEl.textContent = data.inviteUrl;
      } catch (e) {
        console.warn('[Invite] ensureInviteCode failed', e);
        codeEl.textContent = 'Could not load your invite code.';
        linkEl.textContent = '';
        copyBtn.disabled = true;
      }
    })();

    return [root];
  }

  function inviteFooter() { return [ cancel('Close') ]; }

  // -------------------- Menu map --------------------
  const SocialMenu = {
    home: {
      label: 'Social',
      title: 'Social',
      preview: 'Friends, Requests, and Community (v1)',
      render: socialHomeRender,
      footer: () => {
        // The footer is dynamic based on current tab.
        const f = socialHomeFooter();
        // Patch in a repaint bridge so tabs can refresh this footer.
        setTimeout(() => paintFooter(), 0);
        return f;
      },
    },
    invite: {
      label: 'Invite',
      title: 'Invite to MyFi',
      preview: 'Share your link or code',
      render: inviteRender,
      footer: inviteFooter,
    },
    // NEW
    addFriend: {
        label: 'Add Friend',
        title: 'Add Friend',
        preview: 'Send a friend request by alias or code',
        render: addFriendRender,
        footer: addFriendFooter,
    }, 
    friendProfile: {
      label: 'Friend',
      title: 'Friend',
      preview: 'Friend details',
      render: friendProfileRender,
      footer: friendProfileFooter,
    },
   
  };

  window.MyFiSocialMenu = SocialMenu;
})();
