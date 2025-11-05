// social-modal.js
import { open as openModal } from '../core/modal.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc,
  collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

// ---------- tiny helpers ----------
function el(tag, attrs={}, ...children){
  const n = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else n.setAttribute(k,v);
  }
  for (const c of children){
    if (c == null) continue;
    if (c instanceof Node) n.appendChild(c);
    else n.insertAdjacentHTML('beforeend', c);
  }
  return n;
}

function btn(label, variant='secondary'){
  const b = document.createElement('button');
  b.className = 'modal-btn';
  b.textContent = label;
  if (variant === 'accent' || variant === 'primary') {
    b.classList.add('modal-btn-primary');
  }
  return b;
}
function helper(html){
  const d = document.createElement('div');
  d.style.fontSize='14px';
  d.style.lineHeight='1.4';
  d.style.opacity='.9';
  d.innerHTML = html;
  return d;
}

function portraitSrcFrom(srcOrKey) {
  if (!srcOrKey) return './assets/portraits/default.png';
  const looksLikeUrl = /^https?:\/\//i.test(srcOrKey) || srcOrKey.startsWith('./') || srcOrKey.startsWith('/assets/');
  return looksLikeUrl ? srcOrKey : `./assets/portraits/${srcOrKey}.png`;
}

function timeAgo(ms) {
  const s = Math.max(1, Math.floor((Date.now() - ms)/1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h/24); return `${d}d ago`;
}

// ---------- state ----------
const state = {
  currentTab: 'friends', // 'friends' | 'community' | 'requests'
  subTabRequests: 'received', // 'received' | 'sent'
  friends: [],
  requests: [],
  sentRequests: []
};

// cache profile lookups
const _profileCache = new Map();
async function fetchProfile(uid){
  if (_profileCache.has(uid)) return _profileCache.get(uid);
  try {
    const db = getFirestore();
    const snap = await getDoc(doc(db,'players',uid));
    const d = snap.exists() ? snap.data() : {};
    if (!d.avatarKey){ d.avatarKey = 'default'; }
    const portraitImageSrc = `./assets/portraits/${d.avatarKey}.png`;
    const obj = {
      uid,
      avatarKey: d.avatarKey || 'default',
      alias: d.alias || uid.slice(0,6),
      avatarImgPath: portraitImageSrc || d.avatarUrl || './assets/portraits/default.png',
      firstName: d.firstName || ''
    };
    _profileCache.set(uid, obj);
    return obj;
  } catch {
    return {
      uid,
      alias: uid.slice(0,6),
      avatarImgPath: './assets/portraits/default.png',
      firstName: ''
    };
  }
}

// ---------- live listeners ----------
let _unsubFriends = null;
let _unsubRequests = null;
let _unsubSent = null;

async function startSocialListeners(uid, onFriends, onRequests, onSent) {
  const db = getFirestore();

  // Friends list
  const friendsCol = collection(db, 'players', uid, 'friends');
  const qFriends = query(friendsCol, orderBy('createdMs', 'desc'));
  _unsubFriends?.();
  _unsubFriends = onSnapshot(qFriends, async (snap) => {
    const rows = [];
    for (const docSnap of snap.docs) {
      const fuid = docSnap.id;
      const [prof, theirEdgeSnap] = await Promise.all([
        fetchProfile(fuid),
        getDoc(doc(db,'players',fuid,'friends',uid)).catch(() => null)
      ]);

      const myTrust    = !!docSnap.data()?.trusted;
      const theirTrust = !!(theirEdgeSnap && theirEdgeSnap.exists && theirEdgeSnap.data()?.trusted);

      rows.push({
        uid: fuid,
        alias: prof.alias,
        firstName: prof.firstName || '',
        avatarImgPath: prof.avatarImgPath,
        myTrust,
        theirTrust,
        status: '—',
        sinceMs: docSnap.data()?.createdMs || Date.now()
      });
    }
    onFriends(rows);
  });

  // Incoming friend requests
  const reqCol = collection(db,'players',uid,'friendRequests');
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
        avatarImgPath: prof.avatarImgPath,
        sinceMs: d.createdMs || Date.now()
      });
    }
    onRequests(rows);
  });

  // Sent friend requests, if exists
  try {
    const sentCol = collection(db,'players',uid,'requestsSent');
    const qSent = query(sentCol, orderBy('createdMs','desc'));
    _unsubSent?.();
    _unsubSent = onSnapshot(qSent, async (snap) => {
      const rows = [];
      for (const docSnap of snap.docs) {
        const d = docSnap.data() || {};
        const toUid = d.toUid;
        if (!toUid) continue;
        const prof = await fetchProfile(toUid);
        rows.push({
          uid: toUid,
          alias: prof.alias,
          avatarImgPath: prof.avatarImgPath,
          sinceMs: d.createdMs || Date.now()
        });
      }
      onSent(rows);
    });
  } catch {
    // if subcollection doesn't exist yet, ignore
  }
}

function stopSocialListeners() {
  try { _unsubFriends?.(); } catch {}
  try { _unsubRequests?.(); } catch {}
  try { _unsubSent?.(); } catch {}
  _unsubFriends = _unsubRequests = _unsubSent = null;
}

// ---------- row builders ----------

function friendRow(friend) {
  const row = el('div', {
    style:{
      display:'grid',
      gridTemplateColumns:'40px 1fr auto',
      alignItems:'center',
      gap:'10px',
      padding:'8px 6px',
      border:'1px solid rgba(255,255,255,0.06)',
      borderRadius:'10px',
      marginBottom:'8px',
      background:'rgba(255,255,255,0.03)',
      fontSize:'14px',
      lineHeight:'1.4'
    }
  });

  const avatar = el('img', {
    src: friend.avatarImgPath || './assets/portraits/default.png',
    alt: `${friend.alias} avatar`,
    style:{
      width:'40px',
      height:'40px',
      borderRadius:'50%',
      objectFit:'cover'
    }
  });

  const textWrap = el('div', {});
  const aliasEl = el('div', { style:{ fontWeight:'600' }}, friend.alias);
  const secondary = (friend.theirTrust && friend.firstName)
    ? friend.firstName
    : (friend.status || '—');
  const subEl = el('div', { style:{ opacity:'0.8', fontSize:'12px' }}, secondary);
  textWrap.append(aliasEl, subEl);

  // TODO future: per-friend action menu, DM, trust toggle, etc.
  const meta = el('div', {
    style:{ fontSize:'11px', opacity:'.6', whiteSpace:'nowrap' }
  }, timeAgo(friend.sinceMs));

  row.append(avatar, textWrap, meta);
  return row;
}

function requestRow(req, onAccept, onDecline) {
  const row = el('div', {
    style:{
      display:'grid',
      gridTemplateColumns:'40px 1fr auto',
      alignItems:'center',
      gap:'10px',
      padding:'8px 6px',
      border:'1px solid rgba(255,255,255,0.06)',
      borderRadius:'10px',
      marginBottom:'8px',
      background:'rgba(255,255,255,0.03)',
      fontSize:'14px',
      lineHeight:'1.4'
    }
  });

  const avatar = el('img', {
    src: req.avatarImgPath || './assets/portraits/default.png',
    alt: `${req.alias} avatar`,
    style:{
      width:'40px',
      height:'40px',
      borderRadius:'50%',
      objectFit:'cover'
    }
  });

  const textWrap = el('div', {});
  const aliasEl = el('div', { style:{ fontWeight:'600' }}, req.alias);
  const since = el('div', { style:{ opacity:'0.8', fontSize:'12px' }}, `Requested ${timeAgo(req.sinceMs)}`);
  textWrap.append(aliasEl, since);

  const acceptBtn = btn('Accept','primary');
  const declineBtn = btn('Decline','secondary');
  const actions = el('div', { style:{ display:'flex', gap:'8px' }}, acceptBtn, declineBtn);

  acceptBtn.addEventListener('click', () => onAccept(req));
  declineBtn.addEventListener('click', () => onDecline(req));

  row.append(avatar, textWrap, actions);
  return row;
}

function sentRequestRow(req, onCancel) {
  const row = el('div', {
    style:{
      display:'grid',
      gridTemplateColumns:'40px 1fr auto',
      alignItems:'center',
      gap:'10px',
      padding:'8px 6px',
      border:'1px solid rgba(255,255,255,0.06)',
      borderRadius:'10px',
      marginBottom:'8px',
      background:'rgba(255,255,255,0.03)',
      fontSize:'14px',
      lineHeight:'1.4'
    }
  });

  const avatar = el('img', {
    src: req.avatarImgPath || './assets/portraits/default.png',
    alt: `${req.alias} avatar`,
    style:{
      width:'40px',
      height:'40px',
      borderRadius:'50%',
      objectFit:'cover'
    }
  });

  const textWrap = el('div', {});
  const aliasEl = el('div', { style:{ fontWeight:'600' }}, req.alias);
  const sinceEl = el('div', { style:{ opacity:'0.8', fontSize:'12px' }}, `Sent ${timeAgo(req.sinceMs || Date.now())}`);
  textWrap.append(aliasEl, sinceEl);

  const cancelBtn = btn('Cancel','secondary');
  cancelBtn.addEventListener('click', () => onCancel(req));

  const actions = el('div', { style:{ display:'flex', gap:'8px' }}, cancelBtn);

  row.append(avatar, textWrap, actions);
  return row;
}

// ---------- accept/decline friend requests backend ----------

async function respondToRequest(req, accept) {
  const auth = getAuth();
  const me = auth?.currentUser?.uid;
  if (!me) throw new Error('Not signed in');

  const requestId = accept
    ? `${req.uid}__${me}`
    : `${req.uid}__${me}`; // same id, action differs

  const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'respondToFriendRequest');
  await fn({ requestId, accept });
}

async function cancelSentRequest(req) {
  const auth = getAuth();
  const me = auth?.currentUser?.uid;
  if (!me) throw new Error('Not signed in');

  const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'cancelFriendRequest');
  await fn({ requestId: `${me}__${req.uid}` });
}

// ---------- add friend flow ----------
function openAddFriendDialog(onDone) {
  // very lightweight inline modal-in-modal could be done,
  // but for now we just prompt:
  const val = prompt('Enter friend alias or code:');
  if (!val) return;
  sendFriendRequest(val).then(onDone).catch(err=>{
    alert(err?.message || 'Could not send request.');
  });
}

async function sendFriendRequest(rawTarget){
  if (!rawTarget) throw new Error('Missing alias/code');
  const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'sendFriendRequest');
  await fn({ target: rawTarget.trim() });
  state.currentTab = 'requests';
  state.subTabRequests = 'received';
}

// ---------- main paint logic ----------
export async function openSocialModal(owner='hub') {
  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <div class="modal-head">
      <div class="modal-head-title">Social</div>
      <div class="modal-head-sub">Friends, community, requests</div>
    </div>

    <div class="modal-body" id="social-body"
      style="display:grid;row-gap:12px;">
      <!-- dynamic -->
    </div>

    <div class="modal-footer" id="social-footer">
      <!-- dynamic footer buttons -->
      <button class="modal-btn" id="social-close">Close</button>
    </div>
  `;

  const ref = openModal({
    owner,
    scope: 'screen',
    content: tpl.content
  });

  const cardEl     = document.querySelector('#modal-root .modal-card:last-child');
  const bodyEl     = cardEl.querySelector('#social-body');
  const footerEl   = cardEl.querySelector('#social-footer');
  const closeBtnEl = cardEl.querySelector('#social-close');

  const closeModal = () => {
    stopSocialListeners();
    ref.close();
  };

  closeBtnEl.addEventListener('click', closeModal);

  // build sub-UI containers inside body:
  const headerBar = el('div', {
    style:{
      display:'flex',
      flexWrap:'wrap',
      alignItems:'center',
      justifyContent:'space-between',
      gap:'8px'
    }
  });
  const titleEl = el('div', {
    style:{ fontWeight:'600', fontSize:'16px', fontFamily:'Cinzel,serif', letterSpacing:'.06em' }
  }, 'Social');
  const inviteBtn = btn('Invite to MyFi','primary');
  inviteBtn.addEventListener('click', async () => {
    // Simple invite mini flow using ensureInviteCode
    try {
      const fn = httpsCallable(getFunctions(undefined, 'europe-west2'), 'ensureInviteCode');
      const baseHint = window.location.href;
      const { data } = await fn({ baseHint });
      const linkTxt = `${data.inviteUrl || ''}\n(code: ${data.inviteCode || ''})`;
      await navigator.clipboard?.writeText(linkTxt);
      alert('Invite link copied!');
    } catch(e) {
      alert('Could not load invite link yet.');
    }
  });
  headerBar.append(titleEl, inviteBtn);

  // tabs
  const tabsBar = el('div', {
    style:{
      display:'flex',
      flexWrap:'wrap',
      gap:'8px'
    }
  });
  const friendsTab   = btn('Friends','secondary');
  const communityTab = btn('Community','secondary');
  const requestsTab  = btn('Requests','secondary');

  function paintTabs() {
    const setActive = (tabBtn, active) => {
      if (active) {
        tabBtn.classList.add('modal-btn-primary');
        tabBtn.style.border = '1px solid rgba(120,140,255,.4)';
        tabBtn.style.background = 'rgba(120,140,255,.15)';
      } else {
        tabBtn.classList.remove('modal-btn-primary');
        tabBtn.style.border = '1px solid rgba(255,255,255,.2)';
        tabBtn.style.background = 'rgba(255,255,255,.05)';
      }
    };
    setActive(friendsTab,   state.currentTab === 'friends');
    setActive(communityTab, state.currentTab === 'community');
    // requests also shows pending count
    const pendingReceived = state.requests.length;
    requestsTab.textContent =
      pendingReceived > 0 ? `Requests (${pendingReceived})` : 'Requests';
    setActive(requestsTab,  state.currentTab === 'requests');
  }

  friendsTab.addEventListener('click', () => {
    state.currentTab = 'friends';
    paintTabs();
    paintPanel();
    paintFooter();
  });
  communityTab.addEventListener('click', () => {
    state.currentTab = 'community';
    paintTabs();
    paintPanel();
    paintFooter();
  });
  requestsTab.addEventListener('click', () => {
    state.currentTab = 'requests';
    paintTabs();
    paintPanel();
    paintFooter();
  });

  tabsBar.append(friendsTab, communityTab, requestsTab);

  // panel (scrollable list area under tabs)
  const panelEl = el('div', {
    style:{
      display:'grid',
      rowGap:'12px'
    }
  });

  // paintPanel renders friends/community/requests view into panelEl
  async function paintPanel() {
    panelEl.replaceChildren(); // clear

    if (state.currentTab === 'friends') {
      panelEl.append(helper('<strong>Your friends</strong>'));
      if (!state.friends.length) {
        panelEl.append(helper('No friends yet. Tap "Add friend".'));
      } else {
        state.friends.forEach(f => {
          panelEl.append(friendRow(f));
        });
      }
    } else if (state.currentTab === 'community') {
      panelEl.append(
        helper('<strong>Community</strong>'),
        helper('Placeholder — this will list clans/guilds you create or join.'),
        helper('Tap "Create Community" below to mock-create one in a future update.')
      );
    } else {
      // Requests tab
      // sub-tabs: Received / Sent
      const subTabsWrap = el('div', {
        style:{ display:'flex', flexWrap:'wrap', gap:'8px' }
      });
      const recvBtn = btn('Received','secondary');
      const sentBtn = btn('Sent','secondary');

      function paintSubTabs() {
        const setActive = (b,active)=>{
          if (active) {
            b.classList.add('modal-btn-primary');
            b.style.border='1px solid rgba(120,140,255,.4)';
            b.style.background='rgba(120,140,255,.15)';
          } else {
            b.classList.remove('modal-btn-primary');
            b.style.border='1px solid rgba(255,255,255,.2)';
            b.style.background='rgba(255,255,255,.05)';
          }
        };
        setActive(recvBtn, state.subTabRequests==='received');
        setActive(sentBtn, state.subTabRequests==='sent');
      }

      recvBtn.addEventListener('click', ()=>{
        state.subTabRequests='received';
        paintSubTabs();
        paintReqList();
      });
      sentBtn.addEventListener('click', ()=>{
        state.subTabRequests='sent';
        paintSubTabs();
        paintReqList();
      });

      subTabsWrap.append(recvBtn, sentBtn);

      const reqListEl = el('div', {});

      function paintReqList(){
        reqListEl.replaceChildren();
        if (state.subTabRequests === 'received') {
          reqListEl.append(helper('<strong>Friend requests — Received</strong>'));
          if (!state.requests.length) {
            reqListEl.append(helper('No pending received requests.'));
          } else {
            state.requests.forEach(r=>{
              reqListEl.append(
                requestRow(
                  r,
                  async (req) => {
                    try {
                      await respondToRequest(req, true);
                    } catch(e) {
                      alert('Could not accept request.');
                    }
                  },
                  async (req) => {
                    try {
                      await respondToRequest(req, false);
                    } catch(e) {
                      alert('Could not decline request.');
                    }
                  }
                )
              );
            });
          }
        } else {
          reqListEl.append(helper('<strong>Friend requests — Sent</strong>'));
          if (!state.sentRequests.length) {
            reqListEl.append(helper('No pending sent requests.'));
          } else {
            state.sentRequests.forEach(r=>{
              reqListEl.append(
                sentRequestRow(
                  r,
                  async (req) => {
                    try {
                      await cancelSentRequest(req);
                    } catch(e) {
                      alert('Could not cancel request.');
                    }
                  }
                )
              );
            });
          }
        }
      }

      panelEl.append(
        helper('<strong>Requests</strong>'),
        subTabsWrap,
        reqListEl
      );
      paintSubTabs();
      paintReqList();
    }
  }

  // footer logic changes with tab
  function paintFooter() {
    // footerEl initially had Close button. We'll rebuild it each time.
    footerEl.replaceChildren();

    if (state.currentTab === 'community') {
      const createBtn = btn('Create Community','primary');
      createBtn.addEventListener('click', () => {
        alert('(Placeholder) Create Community wizard coming soon.');
      });

      footerEl.append(createBtn);
    } else {
      const addFriendBtn = btn('Add friend','primary');
      addFriendBtn.addEventListener('click', () => {
        openAddFriendDialog(() => {
          // after sending, jump to Requests tab
          state.currentTab = 'requests';
          state.subTabRequests = 'received';
          paintTabs();
          paintPanel();
          paintFooter();
        });
      });

      footerEl.append(addFriendBtn);
    }

    const closeBtn = btn('Close','secondary');
    closeBtn.addEventListener('click', closeModal);
    footerEl.append(closeBtn);
  }

  // assemble body now
  bodyEl.replaceChildren(
    headerBar,
    tabsBar,
    panelEl
  );

  // start listeners → keep state in sync then repaint
  (async () => {
    try {
      const auth = getAuth();
      const uid = auth?.currentUser?.uid;
      if (!uid) {
        paintTabs();
        paintPanel();
        paintFooter();
        return;
      }

      await startSocialListeners(
        uid,
        (friends) => {
          state.friends = friends;
          if (state.currentTab === 'friends') {
            paintPanel();
          }
          paintTabs(); // pending counts not needed here, but safe
        },
        (requests) => {
          state.requests = requests;
          if (state.currentTab === 'requests' && state.subTabRequests === 'received') {
            paintPanel();
          }
          paintTabs(); // update "(x)" badge
          paintFooter();
        },
        (sentReqs) => {
          state.sentRequests = sentReqs;
          if (state.currentTab === 'requests' && state.subTabRequests === 'sent') {
            paintPanel();
          }
        }
      );

      paintTabs();
      paintPanel();
      paintFooter();
    } catch (e) {
      console.warn('[Social] listeners failed to start', e);
      paintTabs();
      paintPanel();
      paintFooter();
    }
  })();

  // When modal closes, kill listeners
  ref.onClose(() => {
    stopSocialListeners();
  });
}
