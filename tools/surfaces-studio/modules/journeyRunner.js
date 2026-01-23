// tools/surfaces-studio/modules/journeyRunner.js
import { $ } from './dom.js';
import { toast } from './toast.js';

export function initJourneyRunner(state) {
  const btnLoad = $('#btnLoadJourneys');
  const btnRun  = $('#btnRunJourney');
  const btnStop = $('#btnStopJourney');
  const sel     = $('#journeySel');
  const logBox  = $('#journeyLog');

  if (!btnLoad || !btnRun || !btnStop || !sel || !logBox) return;

  let journeys = [];         // [{id, run}]
  let running = null;        // { stop? }

  function log(line) {
    const cur = logBox.textContent || '';
    logBox.textContent = (cur === '—' ? '' : cur) + line + '\n';
    logBox.scrollTop = logBox.scrollHeight;
  }

  function clearLog() {
    logBox.textContent = '';
  }

  function setButtons() {
    btnRun.disabled = !sel.value || !!running;
    btnStop.disabled = !running;
  }

  async function loadJourneys() {
    clearLog();
    journeys = [];
    sel.innerHTML = '';
    btnRun.disabled = true;

    const dev = window.__DEV__;
    const surfaces = dev?.surfaces;

    // expected hook shapes:
    // - surfaces.listJourneys(): [{id, title?}]
    // - surfaces.runJourney(id): returns stop handle
    if (!surfaces) {
      log('No window.__DEV__.surfaces found.');
      toast('No project hook');
      return;
    }

    if (typeof surfaces.listJourneys !== 'function' || typeof surfaces.runJourney !== 'function') {
      log('Project hook missing listJourneys() or runJourney(id).');
      toast('Hook incomplete');
      return;
    }

    const list = await surfaces.listJourneys();
    for (const j of (list || [])) {
      journeys.push(j);
      const opt = document.createElement('option');
      opt.value = j.id;
      opt.textContent = j.title ? `${j.id} — ${j.title}` : j.id;
      sel.appendChild(opt);
    }

    if (!journeys.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(no journeys found)';
      sel.appendChild(opt);
    }

    log(`Loaded ${journeys.length} journeys.`);
    toast('Journeys loaded');
    setButtons();
  }

  async function runSelected() {
    const id = sel.value;
    if (!id) return;

    const surfaces = window.__DEV__?.surfaces;
    if (!surfaces?.runJourney) return toast('No runJourney');

    try {
      log(`▶ Running: ${id}`);
      const handle = await surfaces.runJourney(id);
      running = handle || { stop: null };
      setButtons();
    } catch (e) {
      log(`✖ Error: ${String(e?.message || e)}`);
      running = null;
      setButtons();
    }
  }

  async function stopRunning() {
    if (!running) return;
    try {
      if (typeof running.stop === 'function') await running.stop();
      log('■ Stopped.');
    } catch (e) {
      log(`✖ Stop error: ${String(e?.message || e)}`);
    } finally {
      running = null;
      setButtons();
    }
  }

  btnLoad.addEventListener('click', () => loadJourneys());
  btnRun.addEventListener('click', () => runSelected());
  btnStop.addEventListener('click', () => stopRunning());
  sel.addEventListener('change', () => setButtons());

  setButtons();
}
