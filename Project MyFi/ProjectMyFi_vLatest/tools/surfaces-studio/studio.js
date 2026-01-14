const $ = (sel) => document.querySelector(sel);
const screensList = $('#screensList');
const uiUnitsList = $('#uiUnitsList');
const slotsTree = $('#slotsTree');
const partsList = $('#partsList');
const propsEditor = $('#propsEditor');
const btnApplyProps = $('#btnApplyProps');
const btnOpen = $('#btnOpen');
const btnReload = $('#btnReload');
const btnValidate = $('#btnValidate');
const btnSaveSurface = $('#btnSaveSurface');
const btnDownloadSurface = $('#btnDownloadSurface');
const surfaceTitle = $('#surfaceTitle');

// Surface editor view
const btnViewCanvas = $('#btnViewCanvas');
const btnViewList = $('#btnViewList');
const canvasWrap = $('#canvasWrap');
const listWrap = $('#listWrap');
const canvasEl = $('#canvas');
const canvasHint = $('#canvasHint');
const addPartKind = $('#addPartKind');
const btnAddPart = $('#btnAddPart');

const screenUpliftEditor = $('#screenUpliftEditor');
const btnSaveScreenUplift = $('#btnSaveScreenUplift');
const btnClearScreenUplift = $('#btnClearScreenUplift');
const btnCopyScreenAIPack = $('#btnCopyScreenAIPack');

const upliftMeta = $('#upliftMeta');
const packPrompt = $('#packPrompt');
const packContract = $('#packContract');
const packFiles = $('#packFiles');
const btnCopyAIPack = $('#btnCopyAIPack');

const upliftCssEditor = $('#upliftCssEditor');
const upliftHtmlEditor = $('#upliftHtmlEditor');
const btnSaveUplift = $('#btnSaveUplift');
const btnClearUplift = $('#btnClearUplift');


// Parts Fabricator
const fabPartId = $('#fabPartId');
const fabCategory = $('#fabCategory');
const fabDesc = $('#fabDesc');
const fabBinds = $('#fabBinds');
const btnFabCreate = $('#btnFabCreate');
const btnFabCopyPack = $('#btnFabCopyPack');
const fabPaste = $('#fabPaste');
const btnFabApply = $('#btnFabApply');
const btnFabValidate = $('#btnFabValidate');
const fabStatus = $('#fabStatus');

// Modeler
const selectorMapOut = $('#selectorMapOut');
const partPreview = $('#partPreview');


// Part instance bind editor (optional metadata)
const bindEditor = $('#bindEditor');
const btnApplyBind = $('#btnApplyBind');

const logOut = $('#logOut');
function log(msg){ logOut.textContent += msg + "\n"; logOut.scrollTop = logOut.scrollHeight; }
function clearLog(){ logOut.textContent = ''; }

let dirHandle = null;
let manifest = null;

let currentScreen = null;
let currentSurfacePath = null;
let currentSurface = null;
let selectedSlotId = null;
let selectedPartId = null;

let surfaceView = 'canvas'; // 'canvas' | 'list'

let selectedUiUnit = null; // manifest ui_units entry
let uiUnitFiles = null;

// --- Studio state persistence (prevents losing progress on dev-server reloads)
// Live Server / similar tools may refresh this page when files are written.
// We persist lightweight draft state in sessionStorage so the UI restores.
const STUDIO_STATE_KEY = 'myfi_surfaces_studio_state_v1';
// Persist the chosen project folder handle so Studio survives Live Server reloads.
// Use IndexedDB because FileSystemDirectoryHandle can't be stored in sessionStorage.
const STUDIO_DB_NAME = 'myfi_surfaces_studio_db_v1';
const STUDIO_DB_STORE = 'kv';
const STUDIO_DB_KEY_PROJECT = 'projectDirHandle';
// Pending ops let us finish multi-file writes even if Live Server reloads mid-flight.
const STUDIO_PENDING_KEY = 'myfi_surfaces_studio_pending_v1';
let activeTab = 'compose';
let _saveTimer = null;

function _readStudioState(){
  try{
    const raw = sessionStorage.getItem(STUDIO_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}

function _writeStudioState(state){
  try{ sessionStorage.setItem(STUDIO_STATE_KEY, JSON.stringify(state)); }catch{}
}

function _snapshotStudioState(){
  return {
    v: 1,
    tab: activeTab,
    surfaceView,
    fabricate: {
      partId: fabPartId?.value || '',
      category: fabCategory?.value || 'primitive',
      desc: fabDesc?.value || '',
      binds: fabBinds?.value || '',
      paste: fabPaste?.value || ''
    }
  };
}

function scheduleStudioSave(){
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(()=>{
    _saveTimer = null;
    _writeStudioState(_snapshotStudioState());
  }, 120);
}

function restoreStudioState(){
  const st = _readStudioState();
  if (!st || st.v !== 1) return;
  if (st.surfaceView && (st.surfaceView === 'canvas' || st.surfaceView === 'list')){
    surfaceView = st.surfaceView;
  }
  if (st.fabricate){
    if (fabPartId) fabPartId.value = st.fabricate.partId || '';
    if (fabCategory) fabCategory.value = st.fabricate.category || 'primitive';
    if (fabDesc) fabDesc.value = st.fabricate.desc || '';
    if (fabBinds) fabBinds.value = st.fabricate.binds || '';
    if (fabPaste) fabPaste.value = st.fabricate.paste || '';
  }
  if (st.tab) activeTab = st.tab;
}

// --- Handle persistence (survive dev-server reloads)
function _openStudioDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(STUDIO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STUDIO_DB_STORE)) db.createObjectStore(STUDIO_DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _idbSet(key, value){
  const db = await _openStudioDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STUDIO_DB_STORE, 'readwrite');
    tx.objectStore(STUDIO_DB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const e = tx.error; db.close(); reject(e); };
  });
}

async function _idbGet(key){
  const db = await _openStudioDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STUDIO_DB_STORE, 'readonly');
    const req = tx.objectStore(STUDIO_DB_STORE).get(key);
    req.onsuccess = () => { const v = req.result; db.close(); resolve(v); };
    req.onerror = () => { const e = req.error; db.close(); reject(e); };
  });
}

async function tryRestoreProjectHandle(){
  if (dirHandle) return true;
  try{
    const h = await _idbGet(STUDIO_DB_KEY_PROJECT);
    if (!h) return false;
    // Ask for permission silently; if denied, user can re-open folder.
    const perm = await h.queryPermission({ mode:'readwrite' });
    if (perm !== 'granted'){
      const req = await h.requestPermission({ mode:'readwrite' });
      if (req !== 'granted') return false;
    }
    dirHandle = h;
    setEnabled(btnReload, true);
    log('Restored project folder handle.');
    return true;
  }catch{
    return false;
  }
}

function getPendingOps(){
  try{
    const raw = sessionStorage.getItem(STUDIO_PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}

function setPendingOps(obj){
  try{
    if (!obj) sessionStorage.removeItem(STUDIO_PENDING_KEY);
    else sessionStorage.setItem(STUDIO_PENDING_KEY, JSON.stringify(obj));
  }catch{}
}

async function resumePendingOpsIfAny(){
  const pending = getPendingOps();
  if (!pending) return;
  if (!dirHandle){
    const ok = await tryRestoreProjectHandle();
    if (!ok) return;
  }
  if (pending.type !== 'createPartSkeleton') return;
  try{
    fabStatus.textContent = 'Resuming pending part creation…';
    const { folder, files, nextIndex=0, manifestPatch } = pending;
    const entries = Object.entries(files);
    for (let i=nextIndex; i<entries.length; i++){
      const [name, txt] = entries[i];
      await writeText(`${folder}/${name}`, txt);
      setPendingOps({ ...pending, nextIndex: i+1 });
    }
    if (manifestPatch){
      // Apply manifest patch last
      const manifestText = await readText('src/ui/manifest.json');
      const man = JSON.parse(manifestText);
      man.ui_units = man.ui_units || [];
      const exists = man.ui_units.some(u=>u.id===manifestPatch.id);
      if (!exists){
        man.ui_units.push(manifestPatch.entry);
        await writeText('src/ui/manifest.json', JSON.stringify(man, null, 2));
      }
    }
    setPendingOps(null);
    await loadManifest();
    fabStatus.textContent = '✅ Pending part creation completed.';
  }catch(e){
    fabStatus.textContent = '⚠️ Resume failed (will retry on next reload): ' + e.message;
  }
}

// Hook draft persistence for Fabricator fields
[ fabPartId, fabCategory, fabDesc, fabBinds, fabPaste ].forEach(el=>{
  if (!el) return;
  el.addEventListener('input', scheduleStudioSave);
  el.addEventListener('change', scheduleStudioSave);
});



function setEnabled(el, on){ el.disabled = !on; }
function escapeHTML(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function setSurfaceView(next){
  surfaceView = next;
  btnViewCanvas.classList.toggle('active', next==='canvas');
  btnViewList.classList.toggle('active', next==='list');
  canvasWrap.hidden = (next !== 'canvas');
  listWrap.hidden = (next !== 'list');
  if (next==='canvas') renderCanvas();
}

async function pickFolder(){
  dirHandle = await window.showDirectoryPicker({ mode:'readwrite' });
  try{ await _idbSet(STUDIO_DB_KEY_PROJECT, dirHandle); }catch{}
  log('Opened project folder.');
  setEnabled(btnReload, true);
  await loadManifest();
}

async function getFileHandleByPath(relPath, create=false){
  if (!dirHandle) throw new Error('No project folder open.');
  const parts = relPath.split('/').filter(Boolean);
  let h = dirHandle;
  for (let i=0;i<parts.length;i++){
    const name = parts[i];
    const isFile = (i === parts.length-1);
    if (isFile){
      return await h.getFileHandle(name, { create });
    } else {
      h = await h.getDirectoryHandle(name, { create });
    }
  }
  throw new Error('Invalid path');
}

async function readText(relPath){
  const fh = await getFileHandleByPath(relPath, false);
  const file = await fh.getFile();
  return await file.text();
}

async function writeText(relPath, content){
  const fh = await getFileHandleByPath(relPath, true);
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
}

async function deleteFile(relPath){
  const parts = relPath.split('/').filter(Boolean);
  let h = dirHandle;
  for (let i=0;i<parts.length-1;i++){
    h = await h.getDirectoryHandle(parts[i]);
  }
  await h.removeEntry(parts[parts.length-1]);
}

async function loadManifest(){
  clearLog();
  try{
    const text = await readText('src/ui/manifest.json');
    manifest = JSON.parse(text);
    log('Loaded src/ui/manifest.json');
    renderScreens();
    renderUiUnits();
    setEnabled(btnValidate, true);
  }catch(e){
    log('ERROR loading manifest: ' + e.message);
    console.error(e);
  }
}

function renderScreens(){
  screensList.innerHTML = '';
  for (const s of (manifest.screens||[])){
    const el = document.createElement('div');
    el.className = 'item' + (currentScreen?.id===s.id ? ' active':'');
    el.innerHTML = `<div class="itemTitle">${escapeHTML(s.title||s.id)}</div>
                    <div class="itemMeta">${escapeHTML(s.surface)}</div>`;
    el.onclick = () => openScreen(s);
    screensList.appendChild(el);
  }
}

function renderUiUnits(){
  uiUnitsList.innerHTML = '';
  for (const u of (manifest.ui_units||[])){
    const el = document.createElement('div');
    el.className = 'item' + (selectedUiUnit?.id===u.id ? ' active':'');
    const caps = [];
    if (u.uplift?.css) caps.push('css');
    if (u.uplift?.html) caps.push('html');
    el.innerHTML = `<div class="itemTitle">${escapeHTML(u.id)}</div>
                    <div class="itemMeta">${escapeHTML(u.category)} · uplift: ${caps.join('+')||'none'}</div>`;
    el.onclick = () => openUiUnit(u);
    uiUnitsList.appendChild(el);
  }
}

async function openScreen(s){
  currentScreen = s;
  currentSurfacePath = s.surface;
  selectedSlotId = null;
  selectedPartId = null;
  renderScreens();
  surfaceTitle.textContent = `Surface · ${s.id}`;
  setEnabled(btnSaveSurface, true);
  setEnabled(btnDownloadSurface, true);

  // enable view toggles (default canvas)
  setEnabled(btnViewCanvas, true);
  setEnabled(btnViewList, true);
  setSurfaceView('canvas');

  // screen uplift
  try{
    const css = await readText(s.uplift?.css);
    screenUpliftEditor.value = css;
    setEnabled(screenUpliftEditor, true);
    setEnabled(btnSaveScreenUplift, true);
    setEnabled(btnClearScreenUplift, true);
    setEnabled(btnCopyScreenAIPack, true);
  }catch{
    screenUpliftEditor.value = '';
    setEnabled(screenUpliftEditor, false);
    setEnabled(btnSaveScreenUplift, false);
    setEnabled(btnClearScreenUplift, false);
    setEnabled(btnCopyScreenAIPack, false);
  }

  await loadSurface();
}

async function loadSurface(){
  try{
    const text = await readText(currentSurfacePath);
    currentSurface = JSON.parse(text);
    log(`Loaded surface: ${currentSurfacePath}`);

    // Populate "add part" kinds from manifest.mountables
    addPartKind.innerHTML = '';
    for (const m of (manifest?.mountables||[])){
      const opt = document.createElement('option');
      opt.value = m.kind;
      opt.textContent = m.kind + (m.category ? ` · ${m.category}` : '');
      addPartKind.appendChild(opt);
    }
    setEnabled(addPartKind, true);
    setEnabled(btnAddPart, true);

    renderSlotsTree();
    // auto select root
    selectSlot(currentSurface.slots?.[0]?.id || 'root');
  }catch(e){
    log('ERROR loading surface: ' + e.message);
    console.error(e);
  }
}

function slotChildrenMap(slots){
  const map = new Map();
  for (const s of slots){
    const parent = s.parent || null;
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent).push(s);
  }
  return map;
}

function renderSlotsTree(){
  slotsTree.innerHTML = '';
  const slots = currentSurface?.slots || [];
  const map = slotChildrenMap(slots);

  function renderNode(slot, depth){
    const row = document.createElement('div');
    row.className = 'treeNode' + (selectedSlotId===slot.id ? ' active':'');
    row.style.paddingLeft = (8 + depth*14) + 'px';
    row.innerHTML = `<div>${escapeHTML(slot.id)} <span class="badge">${escapeHTML(slot.variant||'slot')}</span></div>
                     <div class="badge">${escapeHTML(slot.parent||'root')}</div>`;
    row.onclick = () => selectSlot(slot.id);
    slotsTree.appendChild(row);

    const kids = map.get(slot.id) || [];
    for (const k of kids) renderNode(k, depth+1);
  }

  // render roots: parent null OR parent missing -> treat as root
  const roots = (map.get(null) || []).filter(s => true);
  if (!roots.length && slots.length){
    // fallback: treat first as root
    roots.push(slots[0]);
  }
  for (const r of roots) renderNode(r, 0);
}

function getRootsAndChildren(){
  const slots = currentSurface?.slots || [];
  const map = slotChildrenMap(slots);
  let roots = map.get(null) || [];
  if (!roots.length && slots.length) roots = [slots[0]];
  return { slots, map, roots };
}

function partsInSlot(slotId){
  return (currentSurface?.parts||[]).filter(p => (p.slot||'root')===slotId);
}

function renderCanvas(){
  if (!canvasEl || !currentSurface) return;
  canvasEl.innerHTML = '';
  const { map, roots } = getRootsAndChildren();

  const renderSlot = (slot, depth) => {
    const box = document.createElement('div');
    box.className = 'slotBox' + (selectedSlotId===slot.id ? ' active':'');
    box.dataset.slotId = slot.id;
    box.style.marginLeft = (depth*12) + 'px';

    const head = document.createElement('div');
    head.className = 'slotHead';
    head.innerHTML = `<div class="slotTitle">${escapeHTML(slot.id)}</div>
                      <div class="slotMeta">variant: ${escapeHTML(slot.variant||'slot')} · parent: ${escapeHTML(slot.parent||'root')}</div>`;
    head.onclick = () => selectSlot(slot.id);
    box.appendChild(head);

    // Drop onto slot to move to end of this slot
    box.addEventListener('dragover', (e) => {
      e.preventDefault();
      box.classList.add('active');
    });
    box.addEventListener('dragleave', () => {
      // don't remove active selection styling; keep subtle by re-render
    });
    box.addEventListener('drop', (e) => {
      e.preventDefault();
      const partId = e.dataTransfer.getData('text/myfi-part');
      if (!partId) return;
      movePartToSlot(partId, slot.id, null);
    });

    const ps = partsInSlot(slot.id);
    if (!ps.length){
      const hint = document.createElement('div');
      hint.className = 'dropHint';
      hint.textContent = 'Drop a part here';
      box.appendChild(hint);
    }

    for (const p of ps){
      const pb = document.createElement('div');
      pb.className = 'partBlock' + (selectedPartId===p.id ? ' active':'');
      pb.draggable = true;
      pb.dataset.partId = p.id;
      pb.innerHTML = `<div class="partInfo"><div class="partKind2">${escapeHTML(p.kind)}</div>
                        <div class="partSub">${escapeHTML(p.id)} · slot: ${escapeHTML(p.slot||'root')}</div></div>
                      <div class="dragHandle" title="Drag">≡</div>`;
      pb.addEventListener('click', () => {
        if ((p.slot||'root') !== selectedSlotId) selectedSlotId = (p.slot||'root');
        selectSlot(selectedSlotId);
        selectPart(p.id);
      });
      pb.addEventListener('dragstart', (e) => {
        pb.classList.add('dragging');
        e.dataTransfer.setData('text/myfi-part', p.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      pb.addEventListener('dragend', () => {
        pb.classList.remove('dragging');
      });
      // Drop onto a part to insert above it
      pb.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      pb.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/myfi-part');
        if (!draggedId) return;
        movePartToSlot(draggedId, slot.id, p.id);
      });
      box.appendChild(pb);
    }

    const kids = map.get(slot.id) || [];
    for (const k of kids){
      box.appendChild(renderSlot(k, depth+1));
    }
    return box;
  };

  for (const r of roots){
    canvasEl.appendChild(renderSlot(r, 0));
  }
}

function movePartToSlot(partId, targetSlotId, beforePartId){
  const parts = currentSurface.parts || [];
  const idx = parts.findIndex(p=>p.id===partId);
  if (idx < 0) return;
  const part = parts[idx];
  parts.splice(idx, 1);
  part.slot = targetSlotId;

  if (beforePartId){
    const beforeIdx = parts.findIndex(p=>p.id===beforePartId);
    if (beforeIdx >= 0){
      parts.splice(beforeIdx, 0, part);
    } else {
      parts.push(part);
    }
  } else {
    // insert after last in target slot (preserve relative ordering across slots)
    let insertAt = parts.length;
    for (let i=parts.length-1;i>=0;i--){
      if ((parts[i].slot||'root')===targetSlotId){
        insertAt = i+1;
        break;
      }
    }
    parts.splice(insertAt, 0, part);
  }

  // Sync selection
  selectedSlotId = targetSlotId;
  renderSlotsTree();
  renderPartsList();
  renderCanvas();
  log(`Moved ${partId} → slot ${targetSlotId}${beforePartId ? ` (before ${beforePartId})` : ''}`);
}

function selectSlot(slotId){
  selectedSlotId = slotId;
  selectedPartId = null;
  renderSlotsTree();
  renderPartsList();
  propsEditor.value = '';
  setEnabled(propsEditor, false);
  setEnabled(btnApplyProps, false);

  bindEditor.value = '';
  setEnabled(bindEditor, false);
  setEnabled(btnApplyBind, false);

  if (surfaceView==='canvas') renderCanvas();
}

function renderPartsList(){
  partsList.innerHTML = '';
  const parts = (currentSurface?.parts || []).filter(p => (p.slot||'root') === selectedSlotId);
  const slotIds = (currentSurface?.slots||[]).map(s=>s.id);

  for (let idx=0; idx<parts.length; idx++){
    const p = parts[idx];
    const row = document.createElement('div');
    row.className = 'partRow';
    const left = document.createElement('div');
    left.className = 'partLeft';
    left.innerHTML = `<div class="partKind">${escapeHTML(p.kind)}</div>
                      <div class="partId">${escapeHTML(p.id||'(no id)')}</div>`;
    left.onclick = () => selectPart(p.id);
    const actions = document.createElement('div');
    actions.className = 'partActions';

    const up = document.createElement('button');
    up.className = 'smallBtn';
    up.textContent = '▲';
    up.onclick = () => { movePartInSlot(p.id, -1); };
    const dn = document.createElement('button');
    dn.className = 'smallBtn';
    dn.textContent = '▼';
    dn.onclick = () => { movePartInSlot(p.id, +1); };

    const sel = document.createElement('select');
    for (const sid of slotIds){
      const opt = document.createElement('option');
      opt.value = sid;
      opt.textContent = sid;
      if (sid === (p.slot||'root')) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.onchange = () => { p.slot = sel.value; renderPartsList(); };

    actions.appendChild(up);
    actions.appendChild(dn);
    actions.appendChild(sel);

    row.appendChild(left);
    row.appendChild(actions);
    partsList.appendChild(row);
  }
}

function selectPart(partId){
  selectedPartId = partId;
  const p = (currentSurface?.parts || []).find(x => x.id === partId);
  if (!p) return;
  propsEditor.value = JSON.stringify(p.props || {}, null, 2);
  setEnabled(propsEditor, true);
  setEnabled(btnApplyProps, true);

  bindEditor.value = JSON.stringify(p.bind || {}, null, 2);
  setEnabled(bindEditor, true);
  setEnabled(btnApplyBind, true);

  if (surfaceView==='canvas') renderCanvas();
}

function movePartInSlot(partId, dir){
  const all = currentSurface.parts || [];
  const inSlotIdxs = [];
  for (let i=0;i<all.length;i++){
    if ((all[i].slot||'root') === selectedSlotId) inSlotIdxs.push(i);
  }
  const pos = inSlotIdxs.findIndex(i => all[i].id === partId);
  if (pos < 0) return;
  const swapPos = pos + dir;
  if (swapPos < 0 || swapPos >= inSlotIdxs.length) return;
  const i1 = inSlotIdxs[pos];
  const i2 = inSlotIdxs[swapPos];
  const tmp = all[i1];
  all[i1] = all[i2];
  all[i2] = tmp;
  renderPartsList();
  if (surfaceView==='canvas') renderCanvas();
}

function safeParseJSON(text){
  try{ return { ok:true, value: JSON.parse(text) }; }
  catch(e){ return { ok:false, error:e.message }; }
}

btnApplyProps.onclick = () => {
  if (!selectedPartId) return;
  const res = safeParseJSON(propsEditor.value);
  if (!res.ok){
    log('props JSON error: ' + res.error);
    return;
  }
  const p = currentSurface.parts.find(x=>x.id===selectedPartId);
  p.props = res.value;
  log(`Updated props for ${selectedPartId}`);
};

btnApplyBind.onclick = () => {
  if (!selectedPartId) return;
  const res = safeParseJSON(bindEditor.value);
  if (!res.ok){
    log('bind JSON error: ' + res.error);
    return;
  }
  const p = currentSurface.parts.find(x=>x.id===selectedPartId);
  // Allow empty object; allow null to clear
  p.bind = res.value;
  log(`Updated bind for ${selectedPartId}`);
};

$('#btnSaveSurface').onclick = async () => {
  try{
    await writeText(currentSurfacePath, JSON.stringify(currentSurface, null, 2));
    log('Saved surface.json');
  }catch(e){
    log('ERROR saving surface.json: ' + e.message);
  }
};

$('#btnDownloadSurface').onclick = () => {
  const blob = new Blob([JSON.stringify(currentSurface, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (currentScreen?.id || 'surface') + '.surface.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

function makeUniquePartId(kind){
  const safe = (kind||'Part').replace(/[^a-z0-9_]/gi,'_');
  const existing = new Set((currentSurface?.parts||[]).map(p=>p.id));
  for (let i=1;i<999;i++){
    const id = `${safe}_${i}`;
    if (!existing.has(id)) return id;
  }
  return `${safe}_${Date.now()}`;
}

btnAddPart.onclick = () => {
  if (!currentSurface) return;
  const kind = addPartKind.value;
  if (!kind) return;
  const slot = selectedSlotId || 'root';
  const id = makeUniquePartId(kind);
  currentSurface.parts = currentSurface.parts || [];
  currentSurface.parts.push({ id, kind, slot, props:{}, bind:{} });
  log(`Added part ${id} (${kind}) to slot ${slot}`);
  renderPartsList();
  if (surfaceView==='canvas') renderCanvas();
};

btnSaveScreenUplift.onclick = async () => {
  try{
    await writeText(currentScreen.uplift.css, screenUpliftEditor.value);
    log('Saved screen uplift.css');
  }catch(e){
    log('ERROR saving screen uplift.css: ' + e.message);
  }
};

btnClearScreenUplift.onclick = async () => {
  screenUpliftEditor.value = '';
  try{
    await writeText(currentScreen.uplift.css, '');
    log('Cleared screen uplift.css');
  }catch(e){
    log('ERROR clearing screen uplift.css: ' + e.message);
  }
};

btnCopyScreenAIPack.onclick = async () => {
  try{
    const prompt = await readText(currentScreen.uplift.prompt);
    const contract = await readText(currentScreen.uplift.contract);
    const payload =
`# SCREEN UPLIFT AI PACK (READ CAREFULLY)
## Rules
- You may ONLY output updated contents for uplift.css.
- Do NOT suggest edits to JS/HTML.
- Scope all selectors to the screen root container (as described in the contract).
- Output the FULL uplift.css file contents only.

## Contract (read-only)
${contract}

## Prompt
${prompt}

## Current uplift.css
${screenUpliftEditor.value}
`;
    await navigator.clipboard.writeText(payload);
    log('Copied SCREEN AI Pack to clipboard.');
  }catch(e){
    log('ERROR copying screen AI pack: ' + e.message);
  }
};

function setTab(tab){
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tabPane').forEach(p=>p.classList.toggle('active', p.id===`tab-${tab}`));
  scheduleStudioSave();
}
document.querySelectorAll('.tab').forEach(b=> b.onclick = ()=> setTab(b.dataset.tab));

// Restore draft state after potential dev-server reloads (e.g., after file writes)
restoreStudioState();
setTab(activeTab || 'compose');
setSurfaceView(surfaceView || 'canvas');

// Live Server note: the VS Code Live Server extension may auto-reload this page on file writes.
// That can make skeleton creation look "slow" because each file write can trigger a reload.
// This repo includes .vscode/settings.json to ignore writes under src/ui/** so Studio can write
// multiple files without repeated reloads. If you still see repeated reloads, check Live Server
// ignore settings or use a simple static file server without hot reload.
try{
  const isLikelyLiveServer = /:\/\/127\.0\.0\.1:5500\b/.test(location.href);
  if (isLikelyLiveServer && fabStatus){
    fabStatus.textContent = 'Tip: If skeleton creation feels slow, configure Live Server to ignore src/ui/** writes (repo includes .vscode/settings.json).';
  }
}catch{}

// Attempt to restore the last opened project folder and resume any interrupted writes.
// This makes Parts Fabricator robust even when Live Server auto-reloads on file changes.
(async () => {
  try{
    const ok = await tryRestoreProjectHandle();
    if (ok){
      await resumePendingOpsIfAny();
      // If manifest isn't loaded yet, load it now.
      if (!manifest) await loadManifest();
    }
  }catch(e){
    // Silent: user can still click Open Project Folder.
    console.warn('Studio auto-restore failed', e);
  }
})();


async function openUiUnit(u){
  selectedUiUnit = u;
  uiUnitFiles = null;
  renderUiUnits();
  upliftMeta.textContent = `${u.id} · ${u.category}`;
  setEnabled(btnCopyAIPack, false);
  setEnabled(upliftCssEditor, false);
  setEnabled(upliftHtmlEditor, false);
  setEnabled(btnSaveUplift, false);
  setEnabled(btnClearUplift, false);

  try{
    const prompt = await readText(u.prompt);
    const contract = await readText(u.contract);
    const css = u.uplift?.css ? await readText(u.uplift.css) : '';
    let html = '';
    if (u.uplift?.html){
      try{ html = await readText(u.uplift.html); }catch{ html = ''; }
    }
    uiUnitFiles = { prompt, contract, css, html };
    packPrompt.textContent = prompt;
    packContract.textContent = contract;
    packFiles.textContent = JSON.stringify({
      editable: {
        "uplift.css": u.uplift?.css || null,
        "uplift.html": u.uplift?.html || null
      }
    }, null, 2);

    upliftCssEditor.value = css || '';
    upliftHtmlEditor.value = html || '';

    setEnabled(btnCopyAIPack, true);
    setEnabled(upliftCssEditor, !!u.uplift?.css);
    setEnabled(upliftHtmlEditor, !!u.uplift?.html);
    setEnabled(btnSaveUplift, true);
    setEnabled(btnClearUplift, true);
    log(`Loaded uplift pack for ${u.id}`);
  }catch(e){
    log('ERROR loading UI unit pack: ' + e.message);
    console.error(e);
  }
}

btnCopyAIPack.onclick = async () => {
  if (!selectedUiUnit || !uiUnitFiles) return;
  const u = selectedUiUnit;
  const payload =
`# PART UPLIFT AI PACK (READ CAREFULLY)
## Unit
${u.id} (${u.category})

## Rules
- You may ONLY output updated contents for uplift.css${u.uplift?.html ? ' and uplift.html' : ''}.
- Do NOT rename required hooks.
- Do NOT suggest edits to JS or baseline.html.
- Keep selectors scoped to the part root.
- Output FULL file contents.

## Contract (read-only)
${uiUnitFiles.contract}

## Prompt
${uiUnitFiles.prompt}

## Current uplift.css
${upliftCssEditor.value}

${u.uplift?.html ? `## Current uplift.html\n${upliftHtmlEditor.value}\n` : ''}

## Output format
Return:
- A block labeled 'uplift.css' containing the full file
${u.uplift?.html ? "- A block labeled 'uplift.html' containing the full file" : ''}
`;
  await navigator.clipboard.writeText(payload);
  log('Copied PART AI Pack to clipboard.');
};

btnSaveUplift.onclick = async () => {
  if (!selectedUiUnit) return;
  const u = selectedUiUnit;
  try{
    if (u.uplift?.css){
      await writeText(u.uplift.css, upliftCssEditor.value);
    }
    if (u.uplift?.html){
      // write or clear
      await writeText(u.uplift.html, upliftHtmlEditor.value);
    }
    log('Saved uplift file(s).');
  }catch(e){
    log('ERROR saving uplift: ' + e.message);
  }
};

btnClearUplift.onclick = async () => {
  if (!selectedUiUnit) return;
  const u = selectedUiUnit;
  try{
    if (u.uplift?.css){
      upliftCssEditor.value = '';
      await writeText(u.uplift.css, '');
    }
    if (u.uplift?.html){
      upliftHtmlEditor.value = '';
      // Prefer delete to trigger baseline fallback if supported
      try{
        await deleteFile(u.uplift.html);
        log('Deleted uplift.html (revert to baseline).');
      }catch{
        await writeText(u.uplift.html, '');
        log('Cleared uplift.html (delete unsupported).');
      }
    }
    log('Cleared uplift.');
  }catch(e){
    log('ERROR clearing uplift: ' + e.message);
  }
};

btnValidate.onclick = async () => {
  clearLog();
  log('Validate: (v1) basic checks');
  if (!manifest){
    log('No manifest loaded.');
    return;
  }
  // basic: ensure kind mappings exist in surface parts
  try{
    const s = currentScreen;
    if (s){
      const surface = currentSurface;
      const knownKinds = new Set((manifest.mountables||[]).map(x=>x.kind));
      const badKinds = (surface.parts||[]).map(p=>p.kind).filter(k=>!knownKinds.has(k));
      if (badKinds.length){
        log('Unknown kinds in surface.json: ' + badKinds.join(', '));
      } else {
        log('Surface kinds OK.');
      }
    }
    log('NOTE: Contract validation for markup uplifts still handled by runtime for ObjectiveCard.');
  }catch(e){
    log('Validate error: ' + e.message);
  }
};

btnOpen.onclick = async () => {
  try{
    await pickFolder();
  }catch(e){
    log('Folder open cancelled or failed: ' + e.message);
  }
};

btnReload.onclick = async () => {
  await loadManifest();
};


// Fabricator buttons
if (btnFabCreate) btnFabCreate.onclick = async () => { try{ await createPartSkeleton(); }catch(e){ fabStatus.textContent = 'Error: ' + e.message; console.error(e);} };
if (btnFabCopyPack) btnFabCopyPack.onclick = async () => { try{ await copyFabricatorAIPack(); }catch(e){ fabStatus.textContent = 'Error: ' + e.message; console.error(e);} };
if (btnFabApply) btnFabApply.onclick = async () => { try{ await applyFabricatorOutput(); }catch(e){ fabStatus.textContent = 'Error: ' + e.message; console.error(e);} };
if (btnFabValidate) btnFabValidate.onclick = async () => { try{ await validateFabricator(); }catch(e){ fabStatus.textContent = 'Error: ' + e.message; console.error(e);} };



// View toggles
btnViewCanvas.onclick = () => { if (!btnViewCanvas.disabled) setSurfaceView('canvas'); };
btnViewList.onclick = () => { if (!btnViewList.disabled) setSurfaceView('list'); };




async function readOptionalText(path){
  try{ return await readText(path); }catch{ return ''; }
}

function buildSelectorMapFromHTML(html){
  const map = { hooks: [], classes: [], ids: [] };
  if (!html || !html.trim()) return map;
  try{
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const hooks = [...doc.querySelectorAll('[data-hook]')].map(el=>el.getAttribute('data-hook')).filter(Boolean);
    map.hooks = Array.from(new Set(hooks)).sort();
    const ids = [...doc.querySelectorAll('[id]')].map(el=>el.id).filter(Boolean);
    map.ids = Array.from(new Set(ids)).sort();
    const cls = new Set();
    [...doc.querySelectorAll('[class]')].forEach(el=>{
      (el.getAttribute('class')||'').split(/\s+/).filter(Boolean).forEach(c=>cls.add(c));
    });
    map.classes = Array.from(cls).sort();
  }catch(e){
    map.error = e.message;
  }
  return map;
}

async function updateModelerForUiUnit(u){
  if (!selectorMapOut || !partPreview) return;

  // prefer baseline.html if available, else uplift.html if present
  let html = '';
  if (u.baseline?.html){
    html = await readOptionalText(u.baseline.html);
  }
  if (!html && u.uplift?.html){
    html = await readOptionalText(u.uplift.html);
  }

  const map = buildSelectorMapFromHTML(html);
  selectorMapOut.textContent = JSON.stringify(map, null, 2);

  // Build a safe preview that shows the structure + CSS only.
  // We intentionally do NOT run arbitrary JS here; preview is for layout/styling + hook visibility.
  const upliftCssPath = u.uplift?.css || '';
  const safeHTML = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="../../src/core/myfi.css">
  ${upliftCssPath ? `<link rel="stylesheet" href="../../${upliftCssPath}">` : ''}
  <style>
    body{ margin:0; padding:16px; background: #070712; color: #fff; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; }
    .previewRoot{ max-width: 520px; margin: 0 auto; }
    .hookBadge{ display:inline-block; padding:2px 6px; border:1px solid rgba(255,255,255,0.15); border-radius:999px; font-size:11px; opacity:0.85; }
    [data-hook]{ outline: 1px dashed rgba(170,120,255,0.25); outline-offset: 3px; }
    .previewNote{ opacity:0.75; font-size:12px; margin-bottom:10px; }
  </style>
</head>
<body>
  <div class="previewRoot">
    <div class="previewNote">Preview shows markup + CSS (no JS). Hooks are outlined.</div>
    ${html || '<div class="previewNote">No baseline/uplift HTML available for preview.</div>'}
  </div>
</body>
</html>`;
  partPreview.srcdoc = safeHTML;
}

// Built-in templates (fallback) so Parts Fabricator works even if template fetch fails
const BUILTIN_TPL = {
  prefab: {
    'baseline.html': `<!-- CONTRACT:BASELINE_HTML:BEGIN -->\n<section class="{{ID}} myfiCard">\n  <div class="cardHead" data-hook="title">{{ID}}</div>\n  <div class="cardBody" data-hook="body">Prefab body</div>\n</section>\n<!-- CONTRACT:BASELINE_HTML:END -->\n`,
    'uplift.html': `<!-- CONTRACT:UPLIFT_HTML:BEGIN -->\n<!-- Optional uplift markup (keep hooks intact). -->\n<!-- CONTRACT:UPLIFT_HTML:END -->\n`,
    'uplift.css': `/* UPLIFT ONLY. Scope everything under .{{ID}} */\n.{{ID}}{\n  /* styles here */\n}\n`,
    'contract.json': `{
  "id": "{{ID}}",
  "category": "prefab",
  "description": "",
  "hooks": ["title","body"],
  "allowedSelectors": [".{{ID}}"],
  "binds": {}
}\n`,
    'prompt.md': `# MyFi UI Prefab Uplift Task\n\nYou are updating a SINGLE UI Prefab called {{ID}}.\n\n## Non‑negotiable rules\n- Edit ONLY the files listed in the AI Pack under "Files".\n- Do NOT propose edits to any other files.\n- Keep all existing data-hook values intact (do not rename/remove).\n- Scope ALL CSS selectors under the root class .{{ID}} (or .Part-{{ID}} when provided).\n- Do not add external dependencies.\n\n## What to output\n- Output ONLY paste-back blocks. No extra commentary, no markdown/code fences.\n- Format must be EXACTLY:\n---FILE: <filename>\n<full file contents>\n\n## For this part\n- You MUST output full contents for uplift.css and uplift.html.\n- You MUST NOT change part.js.\n- You MAY use baseline.html for context, but do not edit outside CONTRACT markers if asked.\n`,
    'part.js': `export function mount(root, ctx){\n  // Basic prefab mount: render is DOM-only; no external deps.\n  const el = root.querySelector('.{{ID}}');\n  const title = root.querySelector('[data-hook="title"]');\n  if (title) title.textContent = '{{ID}}';\n  return {\n    update(nextCtx){ /* noop by default */ },\n    unmount(){ /* noop */ }\n  };\n}\n`
  },
  primitive: {
    'uplift.css': `/* UPLIFT ONLY. Scope everything under .{{ID}} */\n.{{ID}}{\n  /* styles here */\n}\n`,
    'contract.json': `{
  "id": "{{ID}}",
  "category": "primitive",
  "description": "",
  "hooks": [],
  "allowedSelectors": [".{{ID}}"],
  "binds": {}
}\n`,
    'prompt.md': `# MyFi UI Primitive Uplift Task\n\nYou are updating a SINGLE UI Primitive called {{ID}}.\n\n## Non‑negotiable rules\n- Edit ONLY the files listed in the AI Pack under "Files".\n- Do NOT propose edits to any other files.\n- Scope ALL CSS selectors under the root class .{{ID}} (or .Part-{{ID}} when provided).\n- Do not add external dependencies.\n\n## What to output\n- Output ONLY paste-back blocks. No extra commentary, no markdown/code fences.\n- Format must be EXACTLY:\n---FILE: <filename>\n<full file contents>\n`,
    'part.js': `export function mount(root, ctx){\n  // Primitive mounts into the root element passed by the surface runtime.\n  root.classList.add('{{ID}}');\n  return {\n    update(nextCtx){ /* noop */ },\n    unmount(){ /* noop */ }\n  };\n}\n`
  }
};

async function fetchTemplateText(rel, cat, filename, partId){
  // Try HTTP fetch first (works when served via Live Server)
  try{
    const res = await fetch(rel, { cache: 'no-store' });
    if (res.ok){
      return await res.text();
    }
  }catch(e){ /* ignore and fall back */ }

  // Fallback: built-in template
  const group = BUILTIN_TPL[cat] || {};
  const raw = group[filename];
  if (raw == null) throw new Error('Missing template (fetch + fallback): ' + rel);
  const id = partId || 'Part';
  return raw.replaceAll('{{ID}}', id);
}

function coercePartId(raw){
  const s = (raw||'').trim();
  // allow letters/numbers/underscore only, start with letter
  const cleaned = s.replace(/[^A-Za-z0-9_]/g, '');
  if (!cleaned) return '';
  if (!/^[A-Za-z]/.test(cleaned)) return 'Part' + cleaned;
  return cleaned;
}

async function createPartSkeleton(){
  // Persist current draft in case the dev server reloads Studio while writing files
  scheduleStudioSave();
  const id = coercePartId(fabPartId?.value);
  const cat = fabCategory?.value === 'prefab' ? 'prefab' : 'primitive';
  if (!id) throw new Error('Part ID is required.');

  const folder = `src/ui/${cat === 'prefab' ? 'prefabs' : 'primitives'}/${id}`;
  const tplBase = `./templates/new-part-pack/${cat}`;

  // Load templates
  const files = {};
  const fileList = (cat === 'prefab')
    ? ['baseline.html','uplift.html','uplift.css','contract.json','prompt.md','part.js']
    : ['uplift.css','contract.json','prompt.md','part.js'];

  for (const f of fileList){
    files[f] = await fetchTemplateText(`${tplBase}/${f}`, cat, f, id);
  }

  // Light customisation: inject id/desc/binds into contract + prompt
  const desc = (fabDesc?.value || '').trim();
  const bindsRaw = (fabBinds?.value || '').trim();

  // Parse binds if possible (we use this to generate a better prefab skeleton + hooks)
  let bindsObj = null;
  if (bindsRaw){
    try{ bindsObj = JSON.parse(bindsRaw); }catch{ bindsObj = null; }
  }

  try{
    const c = JSON.parse(files['contract.json']);
    c.id = id;
    c.category = cat;
    if (desc) c.description = desc;
    if (bindsRaw){
      c.binds = bindsObj || bindsRaw;
    }

    // Improve prefab hooks: include bind keys as data-hook targets if binds provided
    if (cat === 'prefab'){
      const baseHooks = Array.isArray(c.hooks) ? c.hooks.slice() : [];
      const extra = [];
      if (bindsObj && typeof bindsObj === 'object'){
        for (const k of Object.keys(bindsObj)) extra.push(k);
      }
      const merged = Array.from(new Set([...baseHooks, ...extra]));
      c.hooks = merged;
    }
    files['contract.json'] = JSON.stringify(c, null, 2);
  }catch{
    // leave as-is (template might be comments)
  }

  // Add a header to prompt with your description
  if (desc){
    files['prompt.md'] = `## Studio brief\n${desc}\n\n` + files['prompt.md'];
  }

  // For prefabs, generate a more useful baseline/uplift skeleton when binds are present.
  // This ensures the selector map contains meaningful hooks and gives AI concrete targets.
  if (cat === 'prefab' && bindsObj && typeof bindsObj === 'object'){
    const keys = Object.keys(bindsObj);
    const niceLabel = (k) => {
      const s = k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g,' ').trim();
      const lower = s.toLowerCase();
      if (lower.includes('xp')) return 'XP';
      if (lower.includes('essence')) return 'Essence';
      if (lower.includes('complete')) return 'Completed';
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    const statRows = keys.map(k => {
      const lbl = niceLabel(k);
      return `    <div class="${id}__stat" data-hook="${k}">
      <div class="${id}__statLabel">${escapeHTML(lbl)}</div>
      <div class="${id}__statValue" data-hook="${k}__value">0</div>
    </div>`;
    }).join('\n');

    const rootClass = `Part-${id}`;
    files['baseline.html'] = `<!-- baseline.html (LOCKED) -->\n<div class="${rootClass} ${id} myfiCard">\n  <!-- CONTRACT:BEGIN -->\n  <div class="${id}__title" data-hook="title">${escapeHTML(id)}</div>\n  <div class="${id}__body" data-hook="body">\n${statRows}\n  </div>\n  <div class="${id}__actions" data-hook="actions"></div>\n  <!-- CONTRACT:END -->\n</div>\n`;

    files['uplift.html'] = `<!-- uplift.html (EDITABLE). Delete file to revert to baseline.html -->\n<div class="${rootClass} ${id} myfiCard">\n  <!-- CONTRACT:BEGIN -->\n  <div class="${id}__title" data-hook="title">Today</div>\n  <div class="${id}__body" data-hook="body">\n${statRows}\n  </div>\n  <div class="${id}__actions" data-hook="actions"></div>\n  <!-- CONTRACT:END -->\n</div>\n`;

    // Ensure uplift.css is correctly scoped and not placeholder tokens
    files['uplift.css'] = `/* UPLIFT (PREFAB) — edit freely, delete/blank to revert */\n.${rootClass}{\n  /* styles here */\n}\n\n.${rootClass} .${id}__body{\n  display: flex;\n  gap: 10px;\n  flex-wrap: wrap;\n}\n\n.${rootClass} .${id}__stat{\n  flex: 1 1 90px;\n  min-width: 90px;\n}\n`;

    // Patch contract root/allowed selectors away from <Kind> placeholders
    try{
      const c = JSON.parse(files['contract.json']);
      c.root = `.${rootClass}`;
      c.allowedSelectors = [`.${rootClass}`];
      files['contract.json'] = JSON.stringify(c, null, 2);
    }catch{}

    // Strengthen prompt with concrete non-negotiables (integrated “safe prompt”)
    const safe = [
      `## Output focus (do exactly this)`,
      `- Implement a compact “Today” summary card with three stats: Completed, XP, Essence.`,
      `- Use ONLY the files listed in this pack.`,
      `- Do NOT change any data-hook values.`,
      `- Keep all selectors scoped under .${rootClass} only.`,
      `- Do NOT edit part.js unless the pack explicitly allows it (default: NO).`,
      `- Return output in paste-back format:`,
      `  ---FILE: <filename>`,
      `  <content>`,
      ``
    ].join('\n');
    files['prompt.md'] = safe + (files['prompt.md'] ? ('\n' + files['prompt.md']) : '');
  }

  // Write files
  // Prepare a pending op so we can resume if Live Server reloads mid-write.
  const manifestEntry = {
    id,
    category: cat,
    pack: folder,
    uplift: { css: `${folder}/uplift.css` },
    prompt: `${folder}/prompt.md`,
    contract: `${folder}/contract.json`
  };
  if (cat === 'prefab'){
    manifestEntry.uplift.html = `${folder}/uplift.html`;
    manifestEntry.baseline = { html: `${folder}/baseline.html` };
  }
  setPendingOps({
    type: 'createPartSkeleton',
    folder,
    files,
    nextIndex: 0,
    manifestPatch: { id, entry: manifestEntry }
  });

  // Perform writes; if a reload happens, resumePendingOpsIfAny() will finish.
  await resumePendingOpsIfAny();

  fabStatus.textContent = `Created skeleton: ${id} (${cat})\nFolder: ${folder}`;
}

function parsePasteBack(text){
  const lines = (text||'').split(/\r?\n/);
  const out = [];
  let cur = null;
  for (const line of lines){
    const m = line.match(/^---FILE:\s*(.+)$/);
    if (m){
      if (cur) out.push(cur);
      cur = { path: m[1].trim(), content: '' };
      continue;
    }
    if (cur){
      cur.content += line + '\n';
    }
  }
  if (cur) out.push(cur);
  return out.filter(f=>f.path && f.content != null);
}

async function applyFabricatorOutput(){
  const id = coercePartId(fabPartId?.value);
  if (!id) throw new Error('Part ID is required.');
  const cat = fabCategory?.value === 'prefab' ? 'prefab' : 'primitive';
  const folder = `src/ui/${cat === 'prefab' ? 'prefabs' : 'primitives'}/${id}`;

  const files = parsePasteBack(fabPaste?.value || '');
  if (!files.length) throw new Error('No files detected in paste-back.');

  // allowlist within the part folder only
  const allowedNames = new Set(['uplift.css','uplift.html','baseline.html','contract.json','prompt.md','part.js']);
  for (const f of files){
    // normalize
    const rel = f.path.replace(/^\.\//,'').replace(/^\//,'');
    const base = rel.split('/').pop();
    if (!allowedNames.has(base)) throw new Error('Disallowed file in paste-back: ' + rel);
    const target = `${folder}/${base}`;
    await writeText(target, f.content.replace(/\s+$/,'') + '\n');
  }

  await loadManifest();
  fabStatus.textContent = `Applied ${files.length} file(s) to ${folder}`;
}

async function copyFabricatorAIPack(){
  const id = coercePartId(fabPartId?.value);
  if (!id) throw new Error('Part ID is required.');
  const cat = fabCategory?.value === 'prefab' ? 'prefab' : 'primitive';
  const folder = `src/ui/${cat === 'prefab' ? 'prefabs' : 'primitives'}/${id}`;

  // build pack from current files
  const prompt = await readOptionalText(`${folder}/prompt.md`);
  const contract = await readOptionalText(`${folder}/contract.json`);
  const upliftCss = await readOptionalText(`${folder}/uplift.css`);
  const upliftHtml = cat==='prefab' ? await readOptionalText(`${folder}/uplift.html`) : '';
  const baselineHtml = cat==='prefab' ? await readOptionalText(`${folder}/baseline.html`) : '';

  const map = buildSelectorMapFromHTML(baselineHtml || upliftHtml);

  // Normalize legacy placeholder tokens (older packs used <Kind>)
  const rootClass = `Part-${id}`;
  const norm = (t) => (t||'')
    .replaceAll('<Kind>', id)
    .replaceAll('.Part-<Kind>', `.${rootClass}`)
    .replaceAll('.Part-{{ID}}', `.${rootClass}`);

  const payload = [
`# MyFi Studio: Parts Fabricator AI Pack`,
`Part ID: ${id}`,
`Category: ${cat}`,
``,
`## Rules (non-negotiable)`,
`- You may edit ONLY the files listed below.`,
`- Keep all existing data-hook values intact.`,
`- Do not introduce new external dependencies.`,
`- Return output in the exact paste-back format (NO extra text, NO markdown/code fences):`,
`  ---FILE: <filename>`,
`  <content>`,
``,
`## Selector Map (what exists to style / hook into)`,
JSON.stringify(map, null, 2),
``,
`## Prompt`,
norm(prompt),
``,
`## Contract (locked intent + hooks)`,
norm(contract),
``,
`## Files`,
`---FILE: uplift.css`,
norm(upliftCss || ''),
cat==='prefab' ? `---FILE: uplift.html
${norm(upliftHtml||'')}` : '',
cat==='prefab' ? `---FILE: baseline.html
${norm(baselineHtml||'')}` : '',
``
  ].filter(Boolean).join('\n');

  await navigator.clipboard.writeText(payload);
  fabStatus.textContent = 'Copied Fabricator AI Pack to clipboard.';
}

async function validateFabricator(){
  const id = coercePartId(fabPartId?.value);
  if (!id) throw new Error('Part ID is required.');
  const cat = fabCategory?.value === 'prefab' ? 'prefab' : 'primitive';
  const folder = `src/ui/${cat === 'prefab' ? 'prefabs' : 'primitives'}/${id}`;

  const contractText = await readOptionalText(`${folder}/contract.json`);
  let contract = null;
  try{ contract = JSON.parse(contractText); }catch{}
  const html = cat==='prefab' ? await readOptionalText(`${folder}/baseline.html`) : '';
  const map = buildSelectorMapFromHTML(html);

  const issues = [];
  if (!contractText.trim()) issues.push('Missing contract.json');
  if (cat==='prefab' && !html.trim()) issues.push('Missing baseline.html');
  if (contract && contract.hooks && Array.isArray(contract.hooks)){
    for (const h of contract.hooks){
      if (!map.hooks.includes(h)) issues.push(`Contract hook missing in HTML: ${h}`);
    }
  }

  fabStatus.textContent = issues.length
    ? `⚠️ Issues found:\n- ${issues.join('\n- ')}`
    : '✅ Fabricator validation OK (basic).';
}

// Default state
setTab('compose');
setSurfaceView('canvas');
