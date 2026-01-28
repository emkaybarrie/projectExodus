// Safe CSS loader: if the CSS file 404s, we do NOT crash.
// Supports both href (link element) and inline CSS (style element)
export async function ensureGlobalCSS(key, href, inlineCSS = null){
  const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '_');

  // Check for existing style (link or style element)
  const existingLink = document.querySelector(`link[data-myfi-style="${safeKey}"]`);
  const existingStyle = document.querySelector(`style[data-myfi-style="${safeKey}"]`);
  if (existingLink || existingStyle) return;

  if (inlineCSS) {
    // Inject inline CSS via style element
    const style = document.createElement('style');
    style.dataset.myfiStyle = safeKey;
    style.textContent = inlineCSS;
    document.head.appendChild(style);
  } else if (href) {
    // Load external CSS via link element
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
}
