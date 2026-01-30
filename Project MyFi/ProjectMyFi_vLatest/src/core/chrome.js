// chrome.js — Updated for I2-JourneyRunner-Phase1
// Adds: modal host element
// HUB-G5: Adds Dev Config Modal
// WO-FIX-3: Added screen transition support

import { setTransitionDirection } from './screenTransition.js';

// Direction map for compass navigation (target → transition direction)
// Transition direction determines where new content enters from:
// - 'right' = new content enters from LEFT (for westward destinations)
// - 'left' = new content enters from RIGHT (for eastward destinations)
const COMPASS_DIRECTIONS = {
  guidance: 'down',  // Guidance is north, content enters from top
  quests: 'right',   // Quests is west, content enters from left (swipe right to reveal)
  avatar: 'left',    // Avatar is east, content enters from right (swipe left to reveal)
  badlands: 'up',    // Badlands is south, content enters from bottom
  hub: null,         // Hub is center, no specific direction
};

export function createChrome(chromeHost){
  if (!chromeHost) throw new Error('createChrome requires chromeHost');

  chromeHost.innerHTML = `
    <div class="chrome">
      <header class="chrome__header" data-role="header">
        <div class="chrome__title" data-role="title">MyFi</div>
        <!-- WO-HUB-03: Demo status badge in AppChrome (alias moved to PlayerHeader) -->
        <div class="chrome__status" data-role="chromeStatus">
          <span class="chrome__statusIndicator" data-bind="modeIndicator"></span>
          <span class="chrome__statusLabel" data-bind="modeLabel">Demo</span>
        </div>
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

      <footer class="chrome__footer chrome__footer--3col" data-role="footer">
        <!-- WO-5: Energy Source button -->
        <button class="chrome__footerBtn" data-action="openEnergySource" title="Energy Source">
          <span class="chrome__footerBtnIcon">&#128161;</span>
          <span class="chrome__footerBtnLabel">Energy</span>
        </button>
        <!-- WO-FIX-1: Navigation Orb (tap = compass, hold = spirit stone) -->
        <button class="chrome__navOrb" data-action="orbInteract" title="Tap for Nav, Hold for Spirit Stone">
          <div class="chrome__orbInner">
            <div class="chrome__orbCore"></div>
            <div class="chrome__orbRing"></div>
          </div>
        </button>
        <!-- WO-5: Socials button -->
        <button class="chrome__footerBtn" data-action="openSocials" title="Socials">
          <span class="chrome__footerBtnIcon">&#128101;</span>
          <span class="chrome__footerBtnLabel">Socials</span>
        </button>
      </footer>

      <!-- Modal overlay host (Phase 1) -->
      <div class="chrome__modalHost" data-role="modalHost" hidden></div>

      <!-- WO-4: Navigation Cross Modal (enhanced visual) -->
      <div class="chrome__compassModal" data-role="compassModal" hidden>
        <div class="chrome__compassOverlay" data-action="closeCompass"></div>
        <div class="chrome__compassContent">
          <div class="chrome__compassCross">
            <!-- North - Guidance (revealed by swiping down) -->
            <button class="chrome__compassDirection chrome__compassDirection--n" data-nav="guidance" title="Guidance">
              <span class="chrome__compassDirIcon">&#128161;</span>
              <span class="chrome__compassDirLabel">Guidance</span>
              <span class="chrome__compassDirHint">Swipe Down</span>
            </button>
            <!-- West - Quests (revealed by swiping right, pulling from left) -->
            <button class="chrome__compassDirection chrome__compassDirection--w" data-nav="quests" title="Quests">
              <span class="chrome__compassDirIcon">&#128218;</span>
              <span class="chrome__compassDirLabel">Quests</span>
              <span class="chrome__compassDirHint">Swipe Right</span>
            </button>
            <!-- Center - Hub -->
            <div class="chrome__compassCenter">
              <button class="chrome__compassCenterBtn" data-nav="hub" title="Return to Hub">
                <span class="chrome__compassCenterIcon">&#127968;</span>
                <span class="chrome__compassCenterLabel">Hub</span>
              </button>
            </div>
            <!-- East - Avatar (revealed by swiping left, pulling from right) -->
            <button class="chrome__compassDirection chrome__compassDirection--e" data-nav="avatar" title="Avatar">
              <span class="chrome__compassDirIcon">&#128100;</span>
              <span class="chrome__compassDirLabel">Avatar</span>
              <span class="chrome__compassDirHint">Swipe Left</span>
            </button>
            <!-- South - Badlands (revealed by swiping up) -->
            <button class="chrome__compassDirection chrome__compassDirection--s" data-nav="badlands" title="Badlands">
              <span class="chrome__compassDirIcon">&#9876;</span>
              <span class="chrome__compassDirLabel">Badlands</span>
              <span class="chrome__compassDirHint">Swipe Up</span>
            </button>
          </div>
          <button class="chrome__compassClose" data-action="closeCompass" title="Close">
            <span>&times;</span>
          </button>
        </div>
      </div>

      <!-- WO-4: Spirit Stone Modal (hold action) -->
      <div class="chrome__spiritStoneModal" data-role="spiritStoneModal" hidden>
        <div class="chrome__spiritStoneOverlay" data-action="closeSpiritStone"></div>
        <div class="chrome__spiritStoneContent">
          <div class="chrome__spiritStoneHeader">
            <span class="chrome__spiritStoneIcon">&#128142;</span>
            <h3 class="chrome__spiritStoneTitle">Spirit Stone</h3>
          </div>
          <div class="chrome__spiritStoneBody">
            <p class="chrome__spiritStoneDesc">Your connection to the arcane energies of the Badlands.</p>
            <div class="chrome__spiritStoneStats">
              <div class="chrome__spiritStoneStat">
                <span class="chrome__spiritStoneStatLabel">Energy Reserves</span>
                <span class="chrome__spiritStoneStatValue">1,250</span>
              </div>
              <div class="chrome__spiritStoneStat">
                <span class="chrome__spiritStoneStatLabel">Daily Accrue</span>
                <span class="chrome__spiritStoneStatValue">+12.5/hr</span>
              </div>
            </div>
            <button class="chrome__spiritStoneAction" data-action="viewEnergySource">
              View Energy Source
            </button>
          </div>
          <button class="chrome__spiritStoneClose" data-action="closeSpiritStone">&times;</button>
        </div>
      </div>

      <!-- WO-5: Energy Source Modal -->
      <div class="chrome__energyModal" data-role="energyModal" hidden>
        <div class="chrome__energyOverlay" data-action="closeEnergy"></div>
        <div class="chrome__energyContent">
          <div class="chrome__energyHeader">
            <span class="chrome__energyIcon">&#128161;</span>
            <h3 class="chrome__energyTitle">Energy Source</h3>
            <button class="chrome__energyClose" data-action="closeEnergy">&times;</button>
          </div>
          <div class="chrome__energyBody">
            <!-- Income Section -->
            <div class="chrome__energySection">
              <label class="chrome__energyLabel">Monthly Income</label>
              <div class="chrome__energyInputGroup">
                <span class="chrome__energyCurrency">$</span>
                <input type="number" class="chrome__energyInput" data-field="income" placeholder="0" value="3500">
              </div>
            </div>

            <!-- Outgoings Section -->
            <div class="chrome__energySection">
              <div class="chrome__energySectionHeader">
                <label class="chrome__energyLabel">Outgoings</label>
                <span class="chrome__energyTotal" data-bind="outgoingsTotal">$1,850</span>
              </div>
              <div class="chrome__energyItemList" data-role="outgoingsList">
                <div class="chrome__energyItem" data-item-id="rent">
                  <span class="chrome__energyItemName">Rent</span>
                  <span class="chrome__energyItemValue">$1,200</span>
                  <button class="chrome__energyItemRemove" data-action="removeOutgoing">&times;</button>
                </div>
                <div class="chrome__energyItem" data-item-id="utilities">
                  <span class="chrome__energyItemName">Utilities</span>
                  <span class="chrome__energyItemValue">$150</span>
                  <button class="chrome__energyItemRemove" data-action="removeOutgoing">&times;</button>
                </div>
                <div class="chrome__energyItem" data-item-id="groceries">
                  <span class="chrome__energyItemName">Groceries</span>
                  <span class="chrome__energyItemValue">$500</span>
                  <button class="chrome__energyItemRemove" data-action="removeOutgoing">&times;</button>
                </div>
              </div>
              <button class="chrome__energyAddBtn" data-action="addOutgoing">+ Add Outgoing</button>
            </div>

            <!-- Available Energy -->
            <div class="chrome__energyAvailable">
              <span class="chrome__energyAvailableLabel">Available Energy</span>
              <span class="chrome__energyAvailableValue" data-bind="availableEnergy">$1,650</span>
            </div>

            <!-- Manual Override -->
            <div class="chrome__energyOverride">
              <label class="chrome__energyOverrideLabel">
                <input type="checkbox" class="chrome__energyOverrideCheck" data-field="manualOverride">
                <span>Manual Override Mode</span>
              </label>
            </div>

            <!-- Link Bank Button -->
            <button class="chrome__energyLinkBtn" data-action="linkBank">
              <span class="chrome__energyLinkIcon">&#127974;</span>
              <span>Link Bank Account</span>
            </button>
          </div>
        </div>
      </div>

      <!-- WO-5: Socials Modal -->
      <div class="chrome__socialsModal" data-role="socialsModal" hidden>
        <div class="chrome__socialsOverlay" data-action="closeSocials"></div>
        <div class="chrome__socialsContent">
          <div class="chrome__socialsHeader">
            <span class="chrome__socialsIcon">&#128101;</span>
            <h3 class="chrome__socialsTitle">Socials</h3>
            <button class="chrome__socialsClose" data-action="closeSocials">&times;</button>
          </div>
          <div class="chrome__socialsTabs">
            <button class="chrome__socialsTab active" data-tab="friends">Friends</button>
            <button class="chrome__socialsTab" data-tab="guilds">Guilds</button>
          </div>
          <div class="chrome__socialsBody">
            <!-- Friends Tab -->
            <div class="chrome__socialsTabContent" data-content="friends">
              <div class="chrome__socialsList">
                <div class="chrome__socialsCard">
                  <div class="chrome__socialsAvatar">&#128100;</div>
                  <div class="chrome__socialsInfo">
                    <span class="chrome__socialsName">Alex</span>
                    <span class="chrome__socialsStatus chrome__socialsStatus--online">Online</span>
                  </div>
                  <button class="chrome__socialsAction" data-action="viewProfile">View</button>
                </div>
                <div class="chrome__socialsCard">
                  <div class="chrome__socialsAvatar">&#128100;</div>
                  <div class="chrome__socialsInfo">
                    <span class="chrome__socialsName">Jordan</span>
                    <span class="chrome__socialsStatus chrome__socialsStatus--offline">Offline</span>
                  </div>
                  <button class="chrome__socialsAction" data-action="viewProfile">View</button>
                </div>
                <div class="chrome__socialsCard">
                  <div class="chrome__socialsAvatar">&#128100;</div>
                  <div class="chrome__socialsInfo">
                    <span class="chrome__socialsName">Morgan</span>
                    <span class="chrome__socialsStatus chrome__socialsStatus--online">In Badlands</span>
                  </div>
                  <button class="chrome__socialsAction" data-action="viewProfile">View</button>
                </div>
              </div>
              <button class="chrome__socialsAddBtn" data-action="addFriend">+ Add Friend</button>
            </div>
            <!-- Guilds Tab -->
            <div class="chrome__socialsTabContent" data-content="guilds" hidden>
              <div class="chrome__socialsList">
                <div class="chrome__socialsCard chrome__socialsCard--guild">
                  <div class="chrome__socialsGuildIcon">&#9876;</div>
                  <div class="chrome__socialsInfo">
                    <span class="chrome__socialsName">Budget Warriors</span>
                    <span class="chrome__socialsMembers">12 members</span>
                  </div>
                  <button class="chrome__socialsAction" data-action="viewGuild">View</button>
                </div>
                <div class="chrome__socialsCard chrome__socialsCard--guild">
                  <div class="chrome__socialsGuildIcon">&#128176;</div>
                  <div class="chrome__socialsInfo">
                    <span class="chrome__socialsName">Savings Squad</span>
                    <span class="chrome__socialsMembers">8 members</span>
                  </div>
                  <button class="chrome__socialsAction" data-action="viewGuild">View</button>
                </div>
              </div>
              <button class="chrome__socialsAddBtn" data-action="findGuild">Browse Guilds</button>
            </div>
          </div>
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
    // WO-HUB-03: Chrome status (demo badge only, alias moved to PlayerHeader)
    chromeStatus: chromeHost.querySelector('[data-role="chromeStatus"]'),
    modeIndicator: chromeHost.querySelector('[data-bind="modeIndicator"]'),
    modeLabel: chromeHost.querySelector('[data-bind="modeLabel"]'),
    // HUB-G5: Dev buttons container
    devButtons: chromeHost.querySelector('.chrome__devButtons'),
    devSpawn: chromeHost.querySelector('[data-action="devSpawn"]'),
    devConfigBtn: chromeHost.querySelector('[data-action="openDevConfig"]'),
    // WO-4: Navigation orb (tap = compass, hold = spirit stone)
    navOrb: chromeHost.querySelector('[data-action="orbInteract"]'),
    // Compass modal elements
    compassModal: chromeHost.querySelector('[data-role="compassModal"]'),
    compassNavBtns: Array.from(chromeHost.querySelectorAll('.chrome__compassDirection[data-nav], .chrome__compassCenterBtn[data-nav]')),
    compassCloseBtns: Array.from(chromeHost.querySelectorAll('[data-action="closeCompass"]')),
    // WO-4: Spirit stone modal elements
    spiritStoneModal: chromeHost.querySelector('[data-role="spiritStoneModal"]'),
    spiritStoneCloseBtns: Array.from(chromeHost.querySelectorAll('[data-action="closeSpiritStone"]')),
    spiritStoneEnergyBtn: chromeHost.querySelector('[data-action="viewEnergySource"]'),
    // WO-5: Energy Source modal elements
    energyBtn: chromeHost.querySelector('[data-action="openEnergySource"]'),
    energyModal: chromeHost.querySelector('[data-role="energyModal"]'),
    energyCloseBtns: Array.from(chromeHost.querySelectorAll('[data-action="closeEnergy"]')),
    energyAddBtn: chromeHost.querySelector('[data-action="addOutgoing"]'),
    energyLinkBtn: chromeHost.querySelector('[data-action="linkBank"]'),
    // WO-5: Socials modal elements
    socialsBtn: chromeHost.querySelector('[data-action="openSocials"]'),
    socialsModal: chromeHost.querySelector('[data-role="socialsModal"]'),
    socialsCloseBtns: Array.from(chromeHost.querySelectorAll('[data-action="closeSocials"]')),
    socialsTabs: Array.from(chromeHost.querySelectorAll('.chrome__socialsTab')),
    socialsTabContents: Array.from(chromeHost.querySelectorAll('.chrome__socialsTabContent')),
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
  // WO-STAGE-EPISODES-V1: Updated to emit demo signal through episode system
  function enableDevSpawn() {
    if (els.devButtons) {
      els.devButtons.style.display = 'flex';
    }
    if (els.devSpawn) {
      els.devSpawn.addEventListener('click', () => {
        // WO-STAGE-EPISODES-V1: Emit demo signal via episode system
        // This triggers: Signal → Incident Factory → Episode Runner → autobattler:spawn
        const emitDemoSignal = window.__MYFI_DEBUG__?.emitDemoSignal;
        if (emitDemoSignal) {
          emitDemoSignal();
          console.log('[Chrome] DEV: Emitted demo signal via episode system');
        } else {
          // Fallback to legacy forceEncounter if episode system not available
          const hubController = window.__MYFI_DEBUG__?.hubController;
          if (hubController && hubController.forceEncounter) {
            hubController.forceEncounter();
            console.log('[Chrome] DEV: Spawned encounter (legacy fallback)');
          }
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

  // WO-HUB-03: Update chrome status (demo badge only)
  function setStatus({ mode } = {}) {
    if (mode !== undefined) {
      const isVerified = mode === 'verified';
      if (els.modeIndicator) {
        els.modeIndicator.dataset.verified = isVerified ? 'true' : 'false';
      }
      if (els.modeLabel) {
        els.modeLabel.textContent = isVerified ? 'Connected' : 'Demo';
      }
    }
  }

  // Compass modal management
  function openCompass() {
    if (els.compassModal) {
      els.compassModal.hidden = false;
      els.compassModal.classList.add('chrome__compassModal--open');
    }
  }

  function closeCompass() {
    if (els.compassModal) {
      els.compassModal.classList.remove('chrome__compassModal--open');
      els.compassModal.hidden = true;
    }
  }

  // WO-4: Spirit Stone modal management
  function openSpiritStone() {
    if (els.spiritStoneModal) {
      els.spiritStoneModal.hidden = false;
      els.spiritStoneModal.classList.add('chrome__spiritStoneModal--open');
    }
  }

  function closeSpiritStone() {
    if (els.spiritStoneModal) {
      els.spiritStoneModal.classList.remove('chrome__spiritStoneModal--open');
      els.spiritStoneModal.hidden = true;
    }
  }

  // WO-FIX-1: Navigation Orb - tap vs hold detection (fixed)
  let orbHoldTimer = null;
  let orbHeld = false;
  let orbActive = false;
  const ORB_HOLD_THRESHOLD = 400; // ms

  function handleOrbStart(e) {
    e.preventDefault(); // Prevent default to avoid issues
    orbHeld = false;
    orbActive = true;
    if (els.navOrb) {
      els.navOrb.classList.add('chrome__navOrb--pressed');
    }
    orbHoldTimer = setTimeout(() => {
      if (orbActive) {
        orbHeld = true;
        if (els.navOrb) {
          els.navOrb.classList.remove('chrome__navOrb--pressed');
          els.navOrb.classList.add('chrome__navOrb--held');
        }
        openSpiritStone();
      }
    }, ORB_HOLD_THRESHOLD);
  }

  function handleOrbEnd(e) {
    e.preventDefault();
    if (!orbActive) return;
    orbActive = false;

    if (els.navOrb) {
      els.navOrb.classList.remove('chrome__navOrb--pressed');
      els.navOrb.classList.remove('chrome__navOrb--held');
    }
    if (orbHoldTimer) {
      clearTimeout(orbHoldTimer);
      orbHoldTimer = null;
    }
    if (!orbHeld) {
      // Tap action - open compass
      openCompass();
    }
    orbHeld = false;
  }

  function handleOrbCancel() {
    orbActive = false;
    if (els.navOrb) {
      els.navOrb.classList.remove('chrome__navOrb--pressed');
      els.navOrb.classList.remove('chrome__navOrb--held');
    }
    if (orbHoldTimer) {
      clearTimeout(orbHoldTimer);
      orbHoldTimer = null;
    }
    orbHeld = false;
  }

  // Bind orb interactions - use touch events for mobile, mouse for desktop
  if (els.navOrb) {
    // Touch events (mobile)
    els.navOrb.addEventListener('touchstart', handleOrbStart, { passive: false });
    els.navOrb.addEventListener('touchend', handleOrbEnd, { passive: false });
    els.navOrb.addEventListener('touchcancel', handleOrbCancel);
    // Mouse events (desktop)
    els.navOrb.addEventListener('mousedown', handleOrbStart);
    els.navOrb.addEventListener('mouseup', handleOrbEnd);
    els.navOrb.addEventListener('mouseleave', handleOrbCancel);
  }

  // Bind spirit stone close buttons
  els.spiritStoneCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeSpiritStone);
  });

  // Spirit stone energy source button - opens energy modal
  if (els.spiritStoneEnergyBtn) {
    els.spiritStoneEnergyBtn.addEventListener('click', () => {
      closeSpiritStone();
      openEnergy();
    });
  }

  // WO-5: Energy Source Modal management
  function openEnergy() {
    if (els.energyModal) {
      els.energyModal.hidden = false;
      els.energyModal.classList.add('chrome__energyModal--open');
    }
  }

  function closeEnergy() {
    if (els.energyModal) {
      els.energyModal.classList.remove('chrome__energyModal--open');
      els.energyModal.hidden = true;
    }
  }

  // Bind energy button
  if (els.energyBtn) {
    els.energyBtn.addEventListener('click', openEnergy);
  }

  // Bind energy close buttons
  els.energyCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeEnergy);
  });

  // Energy add outgoing (stub)
  if (els.energyAddBtn) {
    els.energyAddBtn.addEventListener('click', () => {
      console.log('[Chrome] Add outgoing clicked - stub');
      // Would open an add item dialog
    });
  }

  // Energy link bank (stub)
  if (els.energyLinkBtn) {
    els.energyLinkBtn.addEventListener('click', () => {
      console.log('[Chrome] Link bank clicked - stub');
      // Would initiate bank linking flow
    });
  }

  // WO-5: Socials Modal management
  function openSocials() {
    if (els.socialsModal) {
      els.socialsModal.hidden = false;
      els.socialsModal.classList.add('chrome__socialsModal--open');
    }
  }

  function closeSocials() {
    if (els.socialsModal) {
      els.socialsModal.classList.remove('chrome__socialsModal--open');
      els.socialsModal.hidden = true;
    }
  }

  // Bind socials button
  if (els.socialsBtn) {
    els.socialsBtn.addEventListener('click', openSocials);
  }

  // Bind socials close buttons
  els.socialsCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeSocials);
  });

  // Socials tabs
  els.socialsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      // Update active tab
      els.socialsTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
      // Show/hide content
      els.socialsTabContents.forEach(content => {
        content.hidden = content.dataset.content !== tabId;
      });
    });
  });

  // Bind compass close buttons (overlay click and X button)
  els.compassCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeCompass);
  });

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (els.devConfigModal && !els.devConfigModal.hidden) {
        closeDevConfig();
      } else if (els.energyModal && !els.energyModal.hidden) {
        closeEnergy();
      } else if (els.socialsModal && !els.socialsModal.hidden) {
        closeSocials();
      } else if (els.spiritStoneModal && !els.spiritStoneModal.hidden) {
        closeSpiritStone();
      } else if (els.compassModal && !els.compassModal.hidden) {
        closeCompass();
      }
    }
  });

  function onNav(handler){
    // Footer nav buttons (excluding compass)
    els.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        const direction = COMPASS_DIRECTIONS[target];
        if (direction) setTransitionDirection(direction);
        handler(target);
      });
    });

    // HUB-E2/WO-FIX-3: Compass modal nav buttons with transition support
    els.compassNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        closeCompass();
        const target = btn.dataset.nav;
        const direction = COMPASS_DIRECTIONS[target];
        if (direction) setTransitionDirection(direction);
        handler(target);
      });
    });
  }

  return {
    hostEl: els.surfaceHost,
    modalHostEl: els.modalHost,
    apply,
    setTitle,
    setStatus, // WO-HUB-03: Update demo mode + player alias
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
