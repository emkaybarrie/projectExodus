// chrome.js — Updated for I2-JourneyRunner-Phase1
// Adds: modal host element
// HUB-G5: Adds Dev Config Modal

export function createChrome(chromeHost){
  if (!chromeHost) throw new Error('createChrome requires chromeHost');

  chromeHost.innerHTML = `
    <div class="chrome">
      <header class="chrome__header" data-role="header">
        <div class="chrome__title" data-role="title">MyFi</div>
        <!-- HUB-D4/G5: DEV buttons (only visible in debug mode) -->
        <div class="chrome__devButtons" style="display: none;">
          <button class="chrome__devSpawn" data-action="devSpawn">
            DEV: Spawn
          </button>
          <button class="chrome__devConfig" data-action="openDevConfig">
            ⚙️
          </button>
        </div>
      </header>

      <main class="chrome__surfaceHost" data-role="surfaceHost"></main>

      <footer class="chrome__footer" data-role="footer">
        <button class="chrome__navBtn" data-nav="quests">Quests</button>
        <!-- HUB-E2: Compass button replaces Hub, opens navigation modal -->
        <button class="chrome__navBtn chrome__navBtn--compass" data-action="openCompass" title="Navigation Compass">
          <span class="chrome__compassIcon">&#129517;</span>
        </button>
        <button class="chrome__navBtn" data-nav="avatar">Avatar</button>
      </footer>

      <!-- Modal overlay host (Phase 1) -->
      <div class="chrome__modalHost" data-role="modalHost" hidden></div>

      <!-- HUB-E2: Navigation Compass Modal -->
      <div class="chrome__compassModal" data-role="compassModal" hidden>
        <div class="chrome__compassOverlay" data-action="closeCompass"></div>
        <div class="chrome__compassContent">
          <div class="chrome__compassRing">
            <div class="chrome__compassCenter">
              <span class="chrome__compassCenterIcon">&#129517;</span>
              <span class="chrome__compassCenterLabel">Navigate</span>
            </div>
            <button class="chrome__compassDirection chrome__compassDirection--n" data-nav="guidance" title="Guidance">
              <span class="chrome__compassDirIcon">&#128218;</span>
              <span class="chrome__compassDirLabel">Guidance</span>
            </button>
            <button class="chrome__compassDirection chrome__compassDirection--e" data-nav="quests" title="Quests">
              <span class="chrome__compassDirIcon">&#128220;</span>
              <span class="chrome__compassDirLabel">Quests</span>
            </button>
            <button class="chrome__compassDirection chrome__compassDirection--s" data-nav="hub" title="Badlands Hub">
              <span class="chrome__compassDirIcon">&#127758;</span>
              <span class="chrome__compassDirLabel">Hub</span>
            </button>
            <button class="chrome__compassDirection chrome__compassDirection--w" data-nav="avatar" title="Avatar">
              <span class="chrome__compassDirIcon">&#129489;</span>
              <span class="chrome__compassDirLabel">Avatar</span>
            </button>
          </div>
          <button class="chrome__compassClose" data-action="closeCompass" title="Close">
            <span>&times;</span>
          </button>
        </div>
      </div>

      <!-- HUB-G5: Dev Config Modal -->
      <div class="chrome__devConfigModal" data-role="devConfigModal" hidden>
        <div class="chrome__devConfigOverlay" data-action="closeDevConfig"></div>
        <div class="chrome__devConfigContent">
          <div class="chrome__devConfigHeader">
            <h3 class="chrome__devConfigTitle">⚙️ Dev Configuration</h3>
            <button class="chrome__devConfigClose" data-action="closeDevConfig">&times;</button>
          </div>
          <div class="chrome__devConfigBody">
            <!-- Encounter Settings -->
            <div class="chrome__devConfigSection">
              <h4 class="chrome__devConfigSectionTitle">Encounter Settings</h4>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Auto-Resolve Duration (sec)</label>
                <input type="range" class="chrome__devConfigSlider" data-config="encounterDuration" min="5" max="120" value="30">
                <span class="chrome__devConfigValue" data-value="encounterDuration">30</span>
              </div>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Encounter Rate (% per tick)</label>
                <input type="range" class="chrome__devConfigSlider" data-config="encounterRate" min="1" max="50" value="10">
                <span class="chrome__devConfigValue" data-value="encounterRate">10</span>
              </div>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Average Enemies</label>
                <input type="range" class="chrome__devConfigSlider" data-config="avgEnemies" min="1" max="5" value="2">
                <span class="chrome__devConfigValue" data-value="avgEnemies">2</span>
              </div>
            </div>
            <!-- Vitals Settings -->
            <div class="chrome__devConfigSection">
              <h4 class="chrome__devConfigSectionTitle">Vitals Settings</h4>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Regen Rate (% per tick)</label>
                <input type="range" class="chrome__devConfigSlider" data-config="regenRate" min="1" max="20" value="3">
                <span class="chrome__devConfigValue" data-value="regenRate">3</span>
              </div>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Damage Multiplier</label>
                <input type="range" class="chrome__devConfigSlider" data-config="damageMultiplier" min="50" max="200" value="100">
                <span class="chrome__devConfigValue" data-value="damageMultiplier">100</span>
              </div>
            </div>
            <!-- Debug Options -->
            <div class="chrome__devConfigSection">
              <h4 class="chrome__devConfigSectionTitle">Debug Options</h4>
              <div class="chrome__devConfigField chrome__devConfigField--checkbox">
                <label class="chrome__devConfigCheckboxLabel">
                  <input type="checkbox" class="chrome__devConfigCheckbox" data-config="showDebugLogs" checked>
                  <span>Show Debug Logs</span>
                </label>
              </div>
              <div class="chrome__devConfigField chrome__devConfigField--checkbox">
                <label class="chrome__devConfigCheckboxLabel">
                  <input type="checkbox" class="chrome__devConfigCheckbox" data-config="godMode">
                  <span>God Mode (No Damage)</span>
                </label>
              </div>
            </div>
          </div>
          <div class="chrome__devConfigFooter">
            <button class="chrome__devConfigBtn chrome__devConfigBtn--reset" data-action="resetDevConfig">Reset Defaults</button>
            <button class="chrome__devConfigBtn chrome__devConfigBtn--apply" data-action="applyDevConfig">Apply</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const els = {
    header: chromeHost.querySelector('[data-role="header"]'),
    footer: chromeHost.querySelector('[data-role="footer"]'),
    title: chromeHost.querySelector('[data-role="title"]'),
    surfaceHost: chromeHost.querySelector('[data-role="surfaceHost"]'),
    modalHost: chromeHost.querySelector('[data-role="modalHost"]'),
    navBtns: Array.from(chromeHost.querySelectorAll('.chrome__footer [data-nav]')),
    // HUB-G5: Dev buttons container
    devButtons: chromeHost.querySelector('.chrome__devButtons'),
    devSpawn: chromeHost.querySelector('[data-action="devSpawn"]'),
    devConfigBtn: chromeHost.querySelector('[data-action="openDevConfig"]'),
    // HUB-E2: Compass modal elements
    compassBtn: chromeHost.querySelector('[data-action="openCompass"]'),
    compassModal: chromeHost.querySelector('[data-role="compassModal"]'),
    compassNavBtns: Array.from(chromeHost.querySelectorAll('.chrome__compassDirection[data-nav]')),
    compassCloseBtns: Array.from(chromeHost.querySelectorAll('[data-action="closeCompass"]')),
    // HUB-G5: Dev config modal elements
    devConfigModal: chromeHost.querySelector('[data-role="devConfigModal"]'),
    devConfigCloseBtns: Array.from(chromeHost.querySelectorAll('[data-action="closeDevConfig"]')),
    devConfigSliders: Array.from(chromeHost.querySelectorAll('.chrome__devConfigSlider')),
    devConfigCheckboxes: Array.from(chromeHost.querySelectorAll('.chrome__devConfigCheckbox')),
    devConfigResetBtn: chromeHost.querySelector('[data-action="resetDevConfig"]'),
    devConfigApplyBtn: chromeHost.querySelector('[data-action="applyDevConfig"]'),
  };

  // HUB-G5: Dev config state
  const devConfig = {
    encounterDuration: 30,
    encounterRate: 10,
    avgEnemies: 2,
    regenRate: 3,
    damageMultiplier: 100,
    showDebugLogs: true,
    godMode: false,
  };

  // HUB-D4/G5: Enable DEV buttons (called from app.js after debug setup)
  function enableDevSpawn() {
    if (els.devButtons) {
      els.devButtons.style.display = 'flex';
    }
    if (els.devSpawn) {
      els.devSpawn.addEventListener('click', () => {
        const hubController = window.__MYFI_DEBUG__?.hubController;
        if (hubController && hubController.forceEncounter) {
          hubController.forceEncounter();
          console.log('[Chrome] DEV: Spawned encounter');
        }
      });
    }
    if (els.devConfigBtn) {
      els.devConfigBtn.addEventListener('click', openDevConfig);
    }
  }

  // HUB-G5: Dev Config Modal Management
  function openDevConfig() {
    if (els.devConfigModal) {
      els.devConfigModal.hidden = false;
      syncDevConfigUI();
    }
  }

  function closeDevConfig() {
    if (els.devConfigModal) {
      els.devConfigModal.hidden = true;
    }
  }

  function syncDevConfigUI() {
    // Sync sliders
    els.devConfigSliders.forEach(slider => {
      const key = slider.dataset.config;
      if (devConfig[key] !== undefined) {
        slider.value = devConfig[key];
        const valueEl = chromeHost.querySelector(`[data-value="${key}"]`);
        if (valueEl) valueEl.textContent = devConfig[key];
      }
    });
    // Sync checkboxes
    els.devConfigCheckboxes.forEach(checkbox => {
      const key = checkbox.dataset.config;
      if (devConfig[key] !== undefined) {
        checkbox.checked = devConfig[key];
      }
    });
  }

  function applyDevConfig() {
    // Read values from UI
    els.devConfigSliders.forEach(slider => {
      const key = slider.dataset.config;
      devConfig[key] = parseInt(slider.value, 10);
    });
    els.devConfigCheckboxes.forEach(checkbox => {
      const key = checkbox.dataset.config;
      devConfig[key] = checkbox.checked;
    });

    // Broadcast config to window for other modules to read
    window.__MYFI_DEV_CONFIG__ = { ...devConfig };
    console.log('[Chrome] Dev config applied:', devConfig);

    closeDevConfig();
  }

  function resetDevConfig() {
    devConfig.encounterDuration = 30;
    devConfig.encounterRate = 10;
    devConfig.avgEnemies = 2;
    devConfig.regenRate = 3;
    devConfig.damageMultiplier = 100;
    devConfig.showDebugLogs = true;
    devConfig.godMode = false;
    syncDevConfigUI();
    console.log('[Chrome] Dev config reset to defaults');
  }

  // Bind dev config modal events
  els.devConfigCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeDevConfig);
  });

  els.devConfigSliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
      const key = e.target.dataset.config;
      const valueEl = chromeHost.querySelector(`[data-value="${key}"]`);
      if (valueEl) valueEl.textContent = e.target.value;
    });
  });

  if (els.devConfigResetBtn) {
    els.devConfigResetBtn.addEventListener('click', resetDevConfig);
  }

  if (els.devConfigApplyBtn) {
    els.devConfigApplyBtn.addEventListener('click', applyDevConfig);
  }

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

  // HUB-E2: Compass modal management
  function openCompass() {
    if (els.compassModal) {
      els.compassModal.hidden = false;
      // Add animation class
      els.compassModal.classList.add('chrome__compassModal--open');
    }
  }

  function closeCompass() {
    if (els.compassModal) {
      els.compassModal.classList.remove('chrome__compassModal--open');
      els.compassModal.hidden = true;
    }
  }

  // Bind compass button
  if (els.compassBtn) {
    els.compassBtn.addEventListener('click', openCompass);
  }

  // Bind compass close buttons (overlay click and X button)
  els.compassCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeCompass);
  });

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (els.devConfigModal && !els.devConfigModal.hidden) {
        closeDevConfig();
      } else if (els.compassModal && !els.compassModal.hidden) {
        closeCompass();
      }
    }
  });

  function onNav(handler){
    // Footer nav buttons (excluding compass)
    els.navBtns.forEach(btn => {
      btn.addEventListener('click', () => handler(btn.dataset.nav));
    });

    // HUB-E2: Compass modal nav buttons
    els.compassNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        closeCompass();
        handler(btn.dataset.nav);
      });
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
    enableDevSpawn, // HUB-D4: Enable DEV spawn button
    // HUB-G5: Dev config functions
    openDevConfig,
    closeDevConfig,
    getDevConfig() { return { ...devConfig }; },
  };
}
