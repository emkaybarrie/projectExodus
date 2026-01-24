// chrome.js — Updated for I2-JourneyRunner-Phase1
// Adds: modal host element

export function createChrome(chromeHost){
  if (!chromeHost) throw new Error('createChrome requires chromeHost');

  chromeHost.innerHTML = `
    <div class="chrome">
      <header class="chrome__header" data-role="header">
        <div class="chrome__title" data-role="title">MyFi</div>
      </header>

      <main class="chrome__surfaceHost" data-role="surfaceHost"></main>

      <footer class="chrome__footer" data-role="footer">
        <button class="chrome__navBtn" data-nav="hub">Hub</button>
        <button class="chrome__navBtn" data-nav="quests">Quests</button>
        <button class="chrome__navBtn" data-nav="avatar">Avatar</button>
      </footer>

      <!-- Modal overlay host (Phase 1) -->
      <div class="chrome__modalHost" data-role="modalHost" hidden></div>
    </div>
  `;

  const els = {
    header: chromeHost.querySelector('[data-role="header"]'),
    footer: chromeHost.querySelector('[data-role="footer"]'),
    title: chromeHost.querySelector('[data-role="title"]'),
    surfaceHost: chromeHost.querySelector('[data-role="surfaceHost"]'),
    modalHost: chromeHost.querySelector('[data-role="modalHost"]'),
    navBtns: Array.from(chromeHost.querySelectorAll('[data-nav]')),
  };

  function apply(cfg = {}){
    console.log('[Chrome] apply called with:', cfg);
    console.log('[Chrome] Footer element exists:', !!els.footer);

    const showHeader = cfg.showHeader !== false;
    const showFooter = cfg.showFooter !== false;

    console.log('[Chrome] showFooter resolved to:', showFooter);

    els.header.style.display = showHeader ? '' : 'none';
    els.footer.style.display = showFooter ? '' : 'none';

    console.log('[Chrome] Footer display set to:', els.footer.style.display || '(empty string = visible)');

    if (typeof cfg.title === 'string') setTitle(cfg.title);
  }

  function setTitle(t){
    els.title.textContent = t || 'MyFi';
  }

  function onNav(handler){
    els.navBtns.forEach(btn => {
      btn.addEventListener('click', () => handler(btn.dataset.nav));
    });
  }

  return {
    hostEl: els.surfaceHost,
    modalHostEl: els.modalHost,
    apply,
    setTitle,
    onNav,
    setHeaderVisible(v){ els.header.style.display = v ? '' : 'none'; },
    setFooterVisible(v){ els.footer.style.display = v ? '' : 'none'; },
  };
}
