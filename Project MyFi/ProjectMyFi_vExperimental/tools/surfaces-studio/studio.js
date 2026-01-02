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
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tabPane').forEach(p=>p.classList.toggle('active', p.id===`tab-${tab}`));
}
document.querySelectorAll('.tab').forEach(b=> b.onclick = ()=> setTab(b.dataset.tab));

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

// View toggles
btnViewCanvas.onclick = () => { if (!btnViewCanvas.disabled) setSurfaceView('canvas'); };
btnViewList.onclick = () => { if (!btnViewList.disabled) setSurfaceView('list'); };

// Default state
setSurfaceView('canvas');
