import { createRouter } from './router.js';
import { createChrome } from './chrome.js';
import * as session from './session.js';

function ensureAppRoot(){
  const el = document.getElementById('app');
  if (!el) throw new Error('#app not found');
  return el;
}

const appRoot = ensureAppRoot();

// Create persistent chrome (header/footer + surface mount host)
const chrome = createChrome(appRoot);

// Decide initial surface before router boots
if (!location.hash) {
  location.hash = session.isAuthed() ? '#hub' : '#start';
}

const router = createRouter({
  hostEl: chrome.hostEl,
  defaultSurfaceId: session.isAuthed() ? 'hub' : 'start',
  ctx: {
    chrome,
    session,
  }
});

// Wire chrome footer nav to router
chrome.onNav((id) => router.navigate(id));

router.start();
