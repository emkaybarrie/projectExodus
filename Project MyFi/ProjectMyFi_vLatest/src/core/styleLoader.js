// Safe CSS loader: if the CSS file 404s, we do NOT crash.
export async function ensureGlobalCSS(key, href){
  const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
  const selector = `link[data-myfi-style="${safeKey}"]`;
  const existing = document.querySelector(selector);
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.myfiStyle = safeKey;

  // Never reject mount because a CSS file is missing.
  link.addEventListener('error', () => {
    console.warn(`CSS missing (ignored): ${href}`);
  });

  document.head.appendChild(link);
}
