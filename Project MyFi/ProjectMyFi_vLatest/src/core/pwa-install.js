// pwa-install.js — PWA Install Prompt & Service Worker Registration
// Dev/prod aware: shows appropriate app name based on environment

// Detect environment
const isDevEnv = window.location.pathname.includes('/dev/');
const appName = isDevEnv ? 'Badlands Hub (DEV)' : 'Badlands Hub';

// Track the deferred install prompt
let deferredPrompt = null;

// Check if running as installed PWA
function isInstalledPWA() {
  // Check display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // Check iOS standalone mode
  if (window.navigator.standalone === true) {
    return true;
  }
  // Check if launched from home screen (Android TWA)
  if (document.referrer.includes('android-app://')) {
    return true;
  }
  return false;
}

// Show the install banner
function showInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  const title = document.getElementById('pwa-install-title');

  if (banner && title) {
    title.textContent = `Install ${appName}`;
    banner.hidden = false;
    banner.classList.add('pwa-install-banner--visible');
  }
}

// Hide the install banner
function hideInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.classList.remove('pwa-install-banner--visible');
    banner.hidden = true;
  }
}

// Handle install button click
async function handleInstallClick() {
  if (!deferredPrompt) {
    console.log('[PWA] No deferred prompt available');
    return;
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for user response
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`[PWA] User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} install prompt`);

  // Clear the deferred prompt
  deferredPrompt = null;
  hideInstallBanner();
}

// Register service worker
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      // Service worker path relative to index.html location
      const swPath = new URL('./sw.js', window.location.href).href;
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: './',
      });

      console.log(`[PWA] Service worker registered (scope: ${registration.scope})`);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        console.log('[PWA] Service worker update found');
      });
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  }
}

// Initialize PWA install prompt handling
function initPWAInstall() {
  // Skip if already installed as PWA
  if (isInstalledPWA()) {
    console.log('[PWA] Running as installed PWA, skipping install prompt');
    return;
  }

  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome's default mini-infobar
    e.preventDefault();

    // Store the event for later use
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');

    // Show custom install banner
    showInstallBanner();
  });

  // Bind install button
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', handleInstallClick);
  }

  // Bind close button
  const closeBtn = document.getElementById('pwa-install-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideInstallBanner();
      // Remember dismissal for this session
      sessionStorage.setItem('pwa-install-dismissed', 'true');
    });
  }

  // Don't show banner if dismissed this session
  if (sessionStorage.getItem('pwa-install-dismissed')) {
    console.log('[PWA] Install banner was dismissed this session');
  }

  // Listen for successful install
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    hideInstallBanner();
    deferredPrompt = null;
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    initPWAInstall();
  });
} else {
  registerServiceWorker();
  initPWAInstall();
}

// Export for debugging
window.__PWA_DEBUG__ = {
  isDevEnv,
  appName,
  isInstalledPWA,
  showInstallBanner,
  hideInstallBanner,
  get deferredPrompt() { return deferredPrompt; },
};
