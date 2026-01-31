// chrome.js — Updated for I2-JourneyRunner-Phase1
// Adds: modal host element
// HUB-G5: Adds Dev Config Modal
// WO-FIX-3: Added screen transition support

import { setTransitionDirection } from './screenTransition.js';

// WO-S6: Direction map for compass navigation (target → transition direction)
// Transition direction determines where new content enters from
const COMPASS_DIRECTIONS = {
  guidance: 'down',  // Guidance is north, content enters from top
  quests: 'right',   // Quests is west, content enters from left
  avatar: 'left',    // Avatar is east, content enters from right
  badlands: 'up',    // Badlands is south, content enters from bottom
  hub: null,         // Hub is center, no specific direction
};

export function createChrome(chromeHost){
  if (!chromeHost) throw new Error('createChrome requires chromeHost');

  chromeHost.innerHTML = `
    <div class="chrome">
      <header class="chrome__header" data-role="header">
        <div class="chrome__title" data-role="title">MyFi</div>
        <!-- WO-LIVE-DEMO: Tappable mode toggle (Live/Demo) -->
        <button class="chrome__modeToggle" data-action="toggleGameMode" title="Tap to switch mode">
          <span class="chrome__modeIndicator" data-bind="modeIndicator"></span>
          <span class="chrome__modeLabel" data-bind="modeLabel">Live</span>
        </button>
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
        <!-- WO-LIVE-DEMO: Energy button (tap = transaction modal, hold = energy source) -->
        <button class="chrome__footerBtn chrome__energyBtn" data-action="energyInteract" title="Tap for Transaction, Hold for Energy Source">
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
            <!-- North - Guidance -->
            <button class="chrome__compassDirection chrome__compassDirection--n" data-nav="guidance" title="Guidance">
              <span class="chrome__compassDirIcon">&#128161;</span>
              <span class="chrome__compassDirLabel">Guidance</span>
              <span class="chrome__compassDirHint">North</span>
            </button>
            <!-- West - Quests -->
            <button class="chrome__compassDirection chrome__compassDirection--w" data-nav="quests" title="Quests">
              <span class="chrome__compassDirIcon">&#128218;</span>
              <span class="chrome__compassDirLabel">Quests</span>
              <span class="chrome__compassDirHint">West</span>
            </button>
            <!-- Center - Hub -->
            <div class="chrome__compassCenter">
              <button class="chrome__compassCenterBtn" data-nav="hub" title="Return to Hub">
                <span class="chrome__compassCenterIcon">&#127968;</span>
                <span class="chrome__compassCenterLabel">Hub</span>
              </button>
            </div>
            <!-- East - Avatar -->
            <button class="chrome__compassDirection chrome__compassDirection--e" data-nav="avatar" title="Avatar">
              <span class="chrome__compassDirIcon">&#128100;</span>
              <span class="chrome__compassDirLabel">Avatar</span>
              <span class="chrome__compassDirHint">East</span>
            </button>
            <!-- South - Badlands -->
            <button class="chrome__compassDirection chrome__compassDirection--s" data-nav="badlands" title="Badlands">
              <span class="chrome__compassDirIcon">&#9876;</span>
              <span class="chrome__compassDirLabel">Badlands</span>
              <span class="chrome__compassDirHint">South</span>
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

            <!-- ═══════════════════════════════════════════════════════════════ -->
            <!-- DEMO MODE SETTINGS - Controls for Demo mode simulation -->
            <!-- ═══════════════════════════════════════════════════════════════ -->
            <div class="chrome__devConfigSection chrome__devConfigSection--watchMode">
              <h4 class="chrome__devConfigSectionTitle chrome__devConfigSectionTitle--watch">🎬 Demo Mode Settings</h4>
              <p class="chrome__devConfigSectionDesc">Controls for Demo mode - simulated time and auto-generated events. Toggle Demo mode via header chip.</p>

              <div class="chrome__devConfigField chrome__devConfigField--checkbox">
                <label class="chrome__devConfigCheckboxLabel">
                  <input type="checkbox" class="chrome__devConfigCheckbox" data-config="watchModeEnabled">
                  <span><strong>Enable Auto Events (in Demo)</strong></span>
                </label>
              </div>

              <div class="chrome__devConfigSubsection" data-watch-only="true">
                <div class="chrome__devConfigField">
                  <label class="chrome__devConfigLabel">Time Scale</label>
                  <div class="chrome__devConfigBtnGroup" data-config-group="watchTimeScale">
                    <button class="chrome__devConfigScaleBtn" data-scale="1">1x</button>
                    <button class="chrome__devConfigScaleBtn chrome__devConfigScaleBtn--active" data-scale="5">5x</button>
                    <button class="chrome__devConfigScaleBtn" data-scale="20">20x</button>
                    <button class="chrome__devConfigScaleBtn" data-scale="60">60x</button>
                    <button class="chrome__devConfigScaleBtn" data-scale="300">Turbo</button>
                  </div>
                </div>

                <div class="chrome__devConfigField">
                  <label class="chrome__devConfigLabel">Clock Control</label>
                  <div class="chrome__devConfigBtnGroup">
                    <button class="chrome__devConfigBtn chrome__devConfigBtn--small" data-action="watchPauseResume" data-bind="watchPauseBtn">Pause</button>
                    <button class="chrome__devConfigBtn chrome__devConfigBtn--small" data-action="watchPrevSegment">&lt; Prev</button>
                    <button class="chrome__devConfigBtn chrome__devConfigBtn--small" data-action="watchNextSegment">Next &gt;</button>
                    <button class="chrome__devConfigBtn chrome__devConfigBtn--small" data-action="resetDay">Reset</button>
                  </div>
                </div>

                <div class="chrome__devConfigField">
                  <label class="chrome__devConfigLabel">Jump to Segment</label>
                  <div class="chrome__devConfigBtnGroup chrome__devConfigBtnGroup--wrap" data-config-group="watchSegmentJump">
                    <button class="chrome__devConfigSegmentBtn" data-segment="dawn">Dawn</button>
                    <button class="chrome__devConfigSegmentBtn" data-segment="morning">Morning</button>
                    <button class="chrome__devConfigSegmentBtn" data-segment="midday">Midday</button>
                    <button class="chrome__devConfigSegmentBtn" data-segment="afternoon">Afternoon</button>
                    <button class="chrome__devConfigSegmentBtn" data-segment="evening">Evening</button>
                    <button class="chrome__devConfigSegmentBtn" data-segment="night">Night</button>
                  </div>
                </div>

                <div class="chrome__devConfigField">
                  <label class="chrome__devConfigLabel">Auto-Transaction Frequency</label>
                  <input type="range" class="chrome__devConfigSlider" data-config="autoTxFrequency" min="0" max="100" value="30">
                  <span class="chrome__devConfigValue" data-value="autoTxFrequency">30%</span>
                </div>

                <div class="chrome__devConfigField chrome__devConfigField--checkbox">
                  <label class="chrome__devConfigCheckboxLabel">
                    <input type="checkbox" class="chrome__devConfigCheckbox" data-config="enableMapBinding" checked>
                    <span>Bind Map to Simulated State</span>
                  </label>
                </div>

                <div class="chrome__devConfigField chrome__devConfigField--checkbox">
                  <label class="chrome__devConfigCheckboxLabel">
                    <input type="checkbox" class="chrome__devConfigCheckbox" data-config="showStageDebugOverlay">
                    <span>Show Stage Debug Overlay</span>
                  </label>
                </div>

                <div class="chrome__devConfigField">
                  <label class="chrome__devConfigLabel">Current State</label>
                  <div class="chrome__devConfigStatus">
                    <span class="chrome__devConfigStatusItem" data-bind="watchTime">--:--</span>
                    <span class="chrome__devConfigStatusItem" data-bind="watchSegment">--</span>
                    <span class="chrome__devConfigStatusItem" data-bind="watchActivity">--</span>
                  </div>
                </div>

                <div class="chrome__devConfigField">
                  <label class="chrome__devConfigLabel">Pressure Status</label>
                  <div class="chrome__devConfigStatus chrome__devConfigStatus--hybrid">
                    <div class="chrome__devConfigStatusRow">
                      <span class="chrome__devConfigStatusLabel">Distance:</span>
                      <span class="chrome__devConfigStatusItem" data-bind="hybridDistance">0.000</span>
                      <span class="chrome__devConfigStatusItem" data-bind="hybridBand">City</span>
                    </div>
                    <div class="chrome__devConfigStatusRow">
                      <span class="chrome__devConfigStatusLabel">Pressure:</span>
                      <span class="chrome__devConfigStatusItem" data-bind="hybridPressure">0.000</span>
                      <span class="chrome__devConfigStatusLabel">Override:</span>
                      <span class="chrome__devConfigStatusItem" data-bind="hybridOverride">None</span>
                    </div>
                  </div>
                </div>

                <div class="chrome__devConfigField">
                  <label class="chrome__devConfigLabel">Manual Triggers</label>
                  <div class="chrome__devConfigBtnGroup">
                    <button class="chrome__devConfigBtn chrome__devConfigBtn--small" data-action="triggerSpike">Spike $100</button>
                    <button class="chrome__devConfigBtn chrome__devConfigBtn--small" data-action="clearOverride">Clear Override</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- ═══════════════════════════════════════════════════════════════ -->
            <!-- ENCOUNTER SETTINGS - Combat/Episode configuration -->
            <!-- ═══════════════════════════════════════════════════════════════ -->
            <div class="chrome__devConfigSection">
              <h4 class="chrome__devConfigSectionTitle">⚔️ Encounter Settings</h4>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Auto-Resolve Duration (sec)</label>
                <input type="range" class="chrome__devConfigSlider" data-config="encounterDuration" min="5" max="120" value="30">
                <span class="chrome__devConfigValue" data-value="encounterDuration">30</span>
              </div>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Damage Multiplier</label>
                <input type="range" class="chrome__devConfigSlider" data-config="damageMultiplier" min="50" max="200" value="100">
                <span class="chrome__devConfigValue" data-value="damageMultiplier">100</span>
              </div>
              <div class="chrome__devConfigField chrome__devConfigField--checkbox">
                <label class="chrome__devConfigCheckboxLabel">
                  <input type="checkbox" class="chrome__devConfigCheckbox" data-config="godMode">
                  <span>God Mode (No Damage)</span>
                </label>
              </div>
            </div>

            <!-- ═══════════════════════════════════════════════════════════════ -->
            <!-- PRESSURE TUNING - Advanced hybrid routing settings -->
            <!-- ═══════════════════════════════════════════════════════════════ -->
            <div class="chrome__devConfigSection">
              <h4 class="chrome__devConfigSectionTitle">📊 Pressure Tuning</h4>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">EMA Alpha (smoothing)</label>
                <input type="range" class="chrome__devConfigSlider" data-config="pressureEmaAlpha" min="5" max="20" value="10">
                <span class="chrome__devConfigValue" data-value="pressureEmaAlpha">0.10</span>
              </div>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Spike Threshold ($)</label>
                <input type="range" class="chrome__devConfigSlider" data-config="spikeThreshold" min="20" max="150" value="50">
                <span class="chrome__devConfigValue" data-value="spikeThreshold">50</span>
              </div>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Explore Override Threshold</label>
                <input type="range" class="chrome__devConfigSlider" data-config="exploreOverrideThreshold" min="20" max="100" value="50">
                <span class="chrome__devConfigValue" data-value="exploreOverrideThreshold">0.50</span>
              </div>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Return Override Threshold</label>
                <input type="range" class="chrome__devConfigSlider" data-config="returnOverrideThreshold" min="50" max="150" value="80">
                <span class="chrome__devConfigValue" data-value="returnOverrideThreshold">0.80</span>
              </div>
            </div>

            <!-- ═══════════════════════════════════════════════════════════════ -->
            <!-- TRANSACTION EVENTS - Manual transaction creation -->
            <!-- ═══════════════════════════════════════════════════════════════ -->
            <div class="chrome__devConfigSection">
              <h4 class="chrome__devConfigSectionTitle">💳 Transaction Events</h4>
              <p class="chrome__devConfigSectionDesc">Manually create transaction signals for testing</p>
              <div class="chrome__devConfigField">
                <button class="chrome__devConfigBtn chrome__devConfigBtn--primary chrome__devConfigBtn--full" data-action="openTransactionModal">
                  📝 New Transaction Event...
                </button>
              </div>
              <div class="chrome__devConfigField">
                <label class="chrome__devConfigLabel">Quick Emit</label>
                <div class="chrome__devConfigBtnGroup">
                  <button class="chrome__devConfigBtn chrome__devConfigBtn--small" data-action="quickEmitSmall">Small $25</button>
                  <button class="chrome__devConfigBtn chrome__devConfigBtn--small" data-action="quickEmitMed">Med $50</button>
                  <button class="chrome__devConfigBtn chrome__devConfigBtn--small" data-action="quickEmitLarge">Large $100</button>
                </div>
              </div>
            </div>

            <!-- ═══════════════════════════════════════════════════════════════ -->
            <!-- DEBUG OPTIONS -->
            <!-- ═══════════════════════════════════════════════════════════════ -->
            <div class="chrome__devConfigSection">
              <h4 class="chrome__devConfigSectionTitle">🔧 Debug</h4>
              <div class="chrome__devConfigField chrome__devConfigField--checkbox">
                <label class="chrome__devConfigCheckboxLabel">
                  <input type="checkbox" class="chrome__devConfigCheckbox" data-config="showDebugLogs" checked>
                  <span>Show Debug Logs</span>
                </label>
              </div>
              <div class="chrome__devConfigField chrome__devConfigField--checkbox">
                <label class="chrome__devConfigCheckboxLabel">
                  <input type="checkbox" class="chrome__devConfigCheckbox" data-config="enableRenderInspector">
                  <span>Enable Render Inspector</span>
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
    // WO-LIVE-DEMO: Mode toggle (Live/Demo)
    modeToggle: chromeHost.querySelector('[data-action="toggleGameMode"]'),
    modeIndicator: chromeHost.querySelector('[data-bind="modeIndicator"]'),
    modeLabel: chromeHost.querySelector('[data-bind="modeLabel"]'),
    // WO-LIVE-DEMO: Energy button (tap/hold)
    energyInteractBtn: chromeHost.querySelector('[data-action="energyInteract"]'),
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
    // WO-5: Energy Source modal elements (energyBtn now uses energyInteractBtn above)
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
    // Watch Mode dev config elements
    watchTimeScaleBtns: Array.from(chromeHost.querySelectorAll('[data-config-group="watchTimeScale"] .chrome__devConfigScaleBtn')),
    watchSegmentBtns: Array.from(chromeHost.querySelectorAll('[data-config-group="watchSegmentJump"] .chrome__devConfigSegmentBtn')),
    watchPauseBtn: chromeHost.querySelector('[data-action="watchPauseResume"]'),
    watchPrevBtn: chromeHost.querySelector('[data-action="watchPrevSegment"]'),
    watchNextBtn: chromeHost.querySelector('[data-action="watchNextSegment"]'),
    watchTimeDisplay: chromeHost.querySelector('[data-bind="watchTime"]'),
    watchSegmentDisplay: chromeHost.querySelector('[data-bind="watchSegment"]'),
    watchActivityDisplay: chromeHost.querySelector('[data-bind="watchActivity"]'),
    // Hybrid Routing dev config elements
    hybridDistanceDisplay: chromeHost.querySelector('[data-bind="hybridDistance"]'),
    hybridBandDisplay: chromeHost.querySelector('[data-bind="hybridBand"]'),
    hybridBaseScheduleDisplay: chromeHost.querySelector('[data-bind="hybridBaseSchedule"]'),
    hybridPressureDisplay: chromeHost.querySelector('[data-bind="hybridPressure"]'),
    hybridSpikeDisplay: chromeHost.querySelector('[data-bind="hybridSpike"]'),
    hybridAftershockDisplay: chromeHost.querySelector('[data-bind="hybridAftershock"]'),
    hybridOverrideDisplay: chromeHost.querySelector('[data-bind="hybridOverride"]'),
    triggerSpikeBtn: chromeHost.querySelector('[data-action="triggerSpike"]'),
    clearOverrideBtn: chromeHost.querySelector('[data-action="clearOverride"]'),
    resetDistanceBtn: chromeHost.querySelector('[data-action="resetDistance"]'),
    // WO-DEV-RENDER-BINDING: Render inspector elements
    resetDayBtn: chromeHost.querySelector('[data-action="resetDay"]'),
    // WO-TRANSACTION-MODAL-V1: Transaction event elements
    openTransactionModalBtn: chromeHost.querySelector('[data-action="openTransactionModal"]'),
    quickEmitSmallBtn: chromeHost.querySelector('[data-action="quickEmitSmall"]'),
    quickEmitMedBtn: chromeHost.querySelector('[data-action="quickEmitMed"]'),
    quickEmitLargeBtn: chromeHost.querySelector('[data-action="quickEmitLarge"]'),
  };

  // HUB-G5: Dev config state
  const devConfig = {
    // Encounter Settings
    encounterDuration: 30,     // Auto-resolve duration in seconds
    damageMultiplier: 100,     // Damage multiplier percentage
    godMode: false,            // No damage to player

    // Watch Mode Settings (simulated day)
    watchModeEnabled: false,   // Enable/disable Watch Mode
    watchTimeScale: 5,         // Time acceleration (1x, 5x, 20x, 60x, 300x)
    autoTxFrequency: 30,       // Auto-transaction frequency 0-100%
    enableMapBinding: true,    // Bind WorldMap to simulated state
    showStageDebugOverlay: false, // Show debug overlay on stage

    // Pressure/Hybrid Routing Settings
    hybridModeEnabled: true,
    pressureEmaAlpha: 10,      // EMA smoothing (10 = 0.10)
    spikeThreshold: 50,        // Spike threshold in dollars
    exploreOverrideThreshold: 50, // (50 = 0.50)
    returnOverrideThreshold: 80,  // (80 = 0.80)

    // Debug Settings
    showDebugLogs: true,
    enableRenderInspector: false,
  };

  // Watch Mode UI state (renamed to Demo Mode)
  let watchModeUIUpdateInterval = null;
  let autoTxInterval = null;   // Auto-transaction interval (Demo Mode only)

  // ═══════════════════════════════════════════════════════════════════════════
  // WO-LIVE-DEMO: Game Mode State (Live vs Demo)
  // ═══════════════════════════════════════════════════════════════════════════
  // Live Mode: Real time, no random events, user-triggered transactions only
  // Demo Mode: Simulated time, random events based on config
  let gameMode = 'live'; // Default to 'live', can be 'demo'

  /**
   * WO-LIVE-TIME: Convert current local time to dayT (0..1)
   * Maps 00:00 to 0.0, 12:00 to 0.5, 23:59 to ~1.0
   */
  function getLocalTimeDayT() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    // Total seconds in day = 86400
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds / 86400;
  }

  function getGameMode() {
    return gameMode;
  }

  function setGameMode(mode) {
    if (mode !== 'live' && mode !== 'demo') return;
    if (mode === gameMode) return;

    gameMode = mode;
    updateGameModeUI();

    // Broadcast mode change via global config and actionBus
    if (!window.__MYFI_DEV_CONFIG__) {
      window.__MYFI_DEV_CONFIG__ = {};
    }
    window.__MYFI_DEV_CONFIG__.gameMode = mode;

    // WO-LIVE-TIME: Sync episode clock to mode
    const clock = window.__MYFI_DEBUG__?.episodeClock;
    if (clock) {
      if (mode === 'live') {
        // Live mode: use player's actual local time, real-time speed
        const localDayT = getLocalTimeDayT();
        clock.setDayT(localDayT);
        clock.setTimeScale(1); // REALTIME
        console.log(`[Chrome] Clock synced to local time: ${(localDayT * 24).toFixed(1)}h (dayT: ${localDayT.toFixed(3)})`);
      } else {
        // Demo mode: use accelerated time (5x default)
        clock.setTimeScale(5);
      }
    }

    // In Demo mode, enable watch mode features
    if (mode === 'demo') {
      devConfig.watchModeEnabled = true;
      startAutoTransactionLoop();
    } else {
      devConfig.watchModeEnabled = false;
      stopAutoTransactionLoop();
    }

    // Sync dev config UI if modal is open
    if (els.devConfigModal && !els.devConfigModal.hidden) {
      syncDevConfigUI();
    }

    // Emit mode change event
    if (window.__MYFI_DEBUG__?.actionBus) {
      window.__MYFI_DEBUG__.actionBus.emit('gameMode:changed', {
        mode,
        isLive: mode === 'live',
        isDemo: mode === 'demo',
      });
    }

    console.log(`[Chrome] Game mode changed to: ${mode}`);
  }

  function toggleGameMode() {
    setGameMode(gameMode === 'live' ? 'demo' : 'live');
  }

  function updateGameModeUI() {
    if (els.modeIndicator) {
      els.modeIndicator.dataset.mode = gameMode;
    }
    if (els.modeLabel) {
      els.modeLabel.textContent = gameMode === 'live' ? 'Live' : 'Demo';
    }
    if (els.modeToggle) {
      els.modeToggle.dataset.mode = gameMode;
    }
  }

  // Initialize game mode UI
  updateGameModeUI();

  // Bind mode toggle click
  if (els.modeToggle) {
    els.modeToggle.addEventListener('click', toggleGameMode);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WO-LIVE-DEMO: Energy Button (tap = transaction modal, hold = energy source)
  // ═══════════════════════════════════════════════════════════════════════════
  let energyHoldTimer = null;
  let energyHeld = false;
  let energyActive = false;
  const ENERGY_HOLD_THRESHOLD = 400; // ms

  function handleEnergyStart(e) {
    e.preventDefault();
    energyHeld = false;
    energyActive = true;

    if (els.energyInteractBtn) {
      els.energyInteractBtn.classList.add('chrome__footerBtn--pressed');
    }

    energyHoldTimer = setTimeout(() => {
      if (energyActive) {
        energyHeld = true;
        if (els.energyInteractBtn) {
          els.energyInteractBtn.classList.remove('chrome__footerBtn--pressed');
          els.energyInteractBtn.classList.add('chrome__footerBtn--held');
        }
        // Hold = Open Energy Source modal
        openEnergy();
      }
    }, ENERGY_HOLD_THRESHOLD);
  }

  function handleEnergyEnd(e) {
    e.preventDefault();
    if (!energyActive) return;
    energyActive = false;

    if (els.energyInteractBtn) {
      els.energyInteractBtn.classList.remove('chrome__footerBtn--pressed');
      els.energyInteractBtn.classList.remove('chrome__footerBtn--held');
    }

    if (energyHoldTimer) {
      clearTimeout(energyHoldTimer);
      energyHoldTimer = null;
    }

    if (!energyHeld) {
      // Tap = Open Transaction Modal (in Live mode, this is the primary way to create events)
      if (transactionModalShowFn) {
        transactionModalShowFn();
        console.log('[Chrome] Energy tap: Opening Transaction Modal');
      } else {
        console.warn('[Chrome] Transaction modal handler not registered');
      }
    }

    energyHeld = false;
  }

  function handleEnergyCancel() {
    energyActive = false;
    if (els.energyInteractBtn) {
      els.energyInteractBtn.classList.remove('chrome__footerBtn--pressed');
      els.energyInteractBtn.classList.remove('chrome__footerBtn--held');
    }
    if (energyHoldTimer) {
      clearTimeout(energyHoldTimer);
      energyHoldTimer = null;
    }
    energyHeld = false;
  }

  // Bind energy button interactions
  if (els.energyInteractBtn) {
    // Touch events (mobile)
    els.energyInteractBtn.addEventListener('touchstart', handleEnergyStart, { passive: false });
    els.energyInteractBtn.addEventListener('touchend', handleEnergyEnd, { passive: false });
    els.energyInteractBtn.addEventListener('touchcancel', handleEnergyCancel);
    // Mouse events (desktop)
    els.energyInteractBtn.addEventListener('mousedown', handleEnergyStart);
    els.energyInteractBtn.addEventListener('mouseup', handleEnergyEnd);
    els.energyInteractBtn.addEventListener('mouseleave', handleEnergyCancel);
  }

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
      startWatchModeUIUpdates(); // Start Watch Mode UI updates when modal opens
    }
  }

  function closeDevConfig() {
    if (els.devConfigModal) {
      els.devConfigModal.hidden = true;
      stopWatchModeUIUpdates(); // Stop updates when modal closes
    }
  }

  function syncDevConfigUI() {
    // Sync sliders
    els.devConfigSliders.forEach(slider => {
      const key = slider.dataset.config;
      if (devConfig[key] !== undefined) {
        slider.value = devConfig[key];
        const valueEl = chromeHost.querySelector(`[data-value="${key}"]`);
        if (valueEl) {
          // Format based on slider type
          if (key === 'pressureEmaAlpha' || key === 'exploreOverrideThreshold' || key === 'returnOverrideThreshold') {
            valueEl.textContent = (devConfig[key] / 100).toFixed(2);
          } else if (key === 'autoTxFrequency') {
            valueEl.textContent = devConfig[key] + '%';
          } else {
            valueEl.textContent = devConfig[key];
          }
        }
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

    // WO-HYBRID-ROUTING: Build distanceDriver config with proper decimal values
    const distanceDriverConfig = {
      pressureEmaAlpha: devConfig.pressureEmaAlpha / 100,  // Convert to decimal
      spikeThreshold: devConfig.spikeThreshold,
      exploreOverrideThreshold: devConfig.exploreOverrideThreshold / 100,
      returnOverrideThreshold: devConfig.returnOverrideThreshold / 100,
    };

    // WO-HYBRID-ROUTING: Build episodeRouter config
    const episodeRouterConfig = {
      hybridModeEnabled: devConfig.hybridModeEnabled,
    };

    // Broadcast config to window for other modules to read
    window.__MYFI_DEV_CONFIG__ = {
      ...devConfig,
      distanceDriver: distanceDriverConfig,
      episodeRouter: episodeRouterConfig,
    };

    // Apply Watch Mode settings to clock
    const clock = getEpisodeClock();
    if (clock) {
      clock.setTimeScale(devConfig.watchTimeScale);
    }

    // Emit Watch Mode toggle event
    if (window.__MYFI_DEBUG__?.actionBus) {
      window.__MYFI_DEBUG__.actionBus.emit('watchMode:toggle', {
        enabled: devConfig.watchModeEnabled,
        timeScale: devConfig.watchTimeScale,
      });

      // WO-HYBRID-ROUTING: Emit hybrid mode toggle event
      window.__MYFI_DEBUG__.actionBus.emit('hybridMode:configChanged', {
        enabled: devConfig.hybridModeEnabled,
        config: distanceDriverConfig,
      });
    }

    // WO-DEV-RENDER-BINDING: Start/stop auto-transaction loop based on Watch Mode
    if (devConfig.watchModeEnabled) {
      startAutoTransactionLoop();
    } else {
      stopAutoTransactionLoop();
    }

    console.log('[Chrome] Dev config applied:', devConfig);
    closeDevConfig();
  }

  function resetDevConfig() {
    // Encounter settings
    devConfig.encounterDuration = 30;
    devConfig.damageMultiplier = 100;
    devConfig.godMode = false;
    // Watch Mode settings
    devConfig.watchModeEnabled = false;
    devConfig.watchTimeScale = 5;
    devConfig.autoTxFrequency = 30;
    devConfig.enableMapBinding = true;
    devConfig.showStageDebugOverlay = false;
    // Hybrid/Pressure settings
    devConfig.hybridModeEnabled = true;
    devConfig.pressureEmaAlpha = 10;
    devConfig.spikeThreshold = 50;
    devConfig.exploreOverrideThreshold = 50;
    devConfig.returnOverrideThreshold = 80;
    // Debug settings
    devConfig.showDebugLogs = true;
    devConfig.enableRenderInspector = false;

    syncDevConfigUI();

    // Stop auto-transaction loop when reset
    stopAutoTransactionLoop();

    // Reset Watch Mode clock if present
    const clock = getEpisodeClock();
    if (clock) {
      clock.setTimeScale(5);
      clock.resume();
    }
    updateWatchModeUI();
    updateHybridRoutingUI();
    console.log('[Chrome] Dev config reset to defaults');
  }

  // Bind dev config modal events
  els.devConfigCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeDevConfig);
  });

  els.devConfigSliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
      const key = e.target.dataset.config;
      const value = parseInt(e.target.value, 10);
      const valueEl = chromeHost.querySelector(`[data-value="${key}"]`);
      if (valueEl) {
        // Format based on slider type
        if (key === 'pressureEmaAlpha' || key === 'exploreOverrideThreshold' || key === 'returnOverrideThreshold') {
          valueEl.textContent = (value / 100).toFixed(2);
        } else if (key === 'autoTxFrequency') {
          valueEl.textContent = value + '%';
        } else {
          valueEl.textContent = value;
        }
      }
    });
  });

  if (els.devConfigResetBtn) {
    els.devConfigResetBtn.addEventListener('click', resetDevConfig);
  }

  if (els.devConfigApplyBtn) {
    els.devConfigApplyBtn.addEventListener('click', applyDevConfig);
  }

  // Watch Mode control handlers
  function getEpisodeClock() {
    return window.__MYFI_DEBUG__?.episodeClock;
  }

  function getEpisodeRouter() {
    return window.__MYFI_DEBUG__?.episodeRouter;
  }

  function updateWatchModeUI() {
    const clock = getEpisodeClock();
    const router = getEpisodeRouter();

    if (!clock) {
      if (els.watchTimeDisplay) els.watchTimeDisplay.textContent = '--:--';
      if (els.watchSegmentDisplay) els.watchSegmentDisplay.textContent = '--';
      if (els.watchActivityDisplay) els.watchActivityDisplay.textContent = '--';
      return;
    }

    const state = clock.getState();
    if (els.watchTimeDisplay) els.watchTimeDisplay.textContent = state.timeString;
    if (els.watchSegmentDisplay) els.watchSegmentDisplay.textContent = state.segmentLabel;

    if (router) {
      const activityState = router.getCurrentActivityState();
      if (els.watchActivityDisplay && activityState) {
        els.watchActivityDisplay.textContent = activityState.label;
      }
    }

    // Update pause button text
    if (els.watchPauseBtn) {
      els.watchPauseBtn.textContent = state.isPaused ? 'Resume' : 'Pause';
    }

    // Update time scale button active state
    els.watchTimeScaleBtns.forEach(btn => {
      const scale = parseInt(btn.dataset.scale, 10);
      btn.classList.toggle('chrome__devConfigScaleBtn--active', scale === state.timeScale);
    });
  }

  function startWatchModeUIUpdates() {
    if (watchModeUIUpdateInterval) return;
    watchModeUIUpdateInterval = setInterval(() => {
      updateWatchModeUI();
      updateHybridRoutingUI(); // Also update hybrid routing UI
    }, 500);
    updateWatchModeUI(); // Initial update
    updateHybridRoutingUI();
  }

  function stopWatchModeUIUpdates() {
    if (watchModeUIUpdateInterval) {
      clearInterval(watchModeUIUpdateInterval);
      watchModeUIUpdateInterval = null;
    }
  }

  // WO-DEV-RENDER-BINDING: Auto-transaction loop for Watch Mode
  // Emits random transactions based on autoTxFrequency setting
  function startAutoTransactionLoop() {
    if (autoTxInterval) return;

    // Check every 5 seconds (scaled by time scale)
    const baseIntervalMs = 5000;

    autoTxInterval = setInterval(() => {
      // Only emit if Watch Mode is enabled
      if (!devConfig.watchModeEnabled) return;

      // Check frequency (0-100%)
      const frequency = devConfig.autoTxFrequency || 0;
      if (frequency === 0) return;

      // Roll for transaction
      const roll = Math.random() * 100;
      if (roll < frequency) {
        emitRandomTransaction();
      }
    }, baseIntervalMs);

    console.log('[Chrome] Auto-transaction loop started');
  }

  function stopAutoTransactionLoop() {
    if (autoTxInterval) {
      clearInterval(autoTxInterval);
      autoTxInterval = null;
      console.log('[Chrome] Auto-transaction loop stopped');
    }
  }

  function emitRandomTransaction() {
    const emitFn = window.__MYFI_DEBUG__?.emitDemoSignal;
    if (!emitFn) return;

    // Random amount distribution: 60% small, 30% medium, 10% large
    const roll = Math.random();
    let amount, merchant, category;

    if (roll < 0.6) {
      // Small transaction
      amount = 10 + Math.floor(Math.random() * 25); // $10-35
      merchant = ['Coffee Shop', 'Fast Food', 'Convenience Store', 'Snack Bar'][Math.floor(Math.random() * 4)];
      category = 'discretionary';
    } else if (roll < 0.9) {
      // Medium transaction
      amount = 35 + Math.floor(Math.random() * 50); // $35-85
      merchant = ['Restaurant', 'Gas Station', 'Grocery Store', 'Online Shop'][Math.floor(Math.random() * 4)];
      category = ['discretionary', 'essential'][Math.floor(Math.random() * 2)];
    } else {
      // Large transaction (spike potential)
      amount = 80 + Math.floor(Math.random() * 100); // $80-180
      merchant = ['Electronics Store', 'Department Store', 'Subscription Service', 'Utility Bill'][Math.floor(Math.random() * 4)];
      category = ['discretionary', 'subscription', 'essential'][Math.floor(Math.random() * 3)];
    }

    emitFn(amount, merchant, category);
    console.log(`[Chrome] Auto-transaction: $${amount} at ${merchant} (${category})`);
  }

  // WO-HYBRID-ROUTING: Get distance driver for hybrid routing
  function getDistanceDriver() {
    return window.__MYFI_DEBUG__?.distanceDriver;
  }

  // WO-HYBRID-ROUTING: Update hybrid routing UI displays
  function updateHybridRoutingUI() {
    const driver = getDistanceDriver();
    const router = getEpisodeRouter();

    if (!driver) {
      if (els.hybridDistanceDisplay) els.hybridDistanceDisplay.textContent = '--';
      if (els.hybridBandDisplay) els.hybridBandDisplay.textContent = '--';
      if (els.hybridBaseScheduleDisplay) els.hybridBaseScheduleDisplay.textContent = '--';
      if (els.hybridPressureDisplay) els.hybridPressureDisplay.textContent = '--';
      if (els.hybridSpikeDisplay) els.hybridSpikeDisplay.textContent = '--';
      if (els.hybridAftershockDisplay) els.hybridAftershockDisplay.textContent = '--';
      if (els.hybridOverrideDisplay) els.hybridOverrideDisplay.textContent = '--';
      return;
    }

    const state = driver.getState();

    if (els.hybridDistanceDisplay) {
      els.hybridDistanceDisplay.textContent = state.distance01.toFixed(3);
    }
    if (els.hybridBandDisplay && state.distanceBand) {
      els.hybridBandDisplay.textContent = state.distanceBand.label;
    }
    if (els.hybridBaseScheduleDisplay) {
      els.hybridBaseScheduleDisplay.textContent = state.baseSchedule.toFixed(3);
    }
    if (els.hybridPressureDisplay) {
      els.hybridPressureDisplay.textContent = state.pressureModifier.toFixed(3);
    }
    if (els.hybridSpikeDisplay) {
      els.hybridSpikeDisplay.textContent = state.spikeImpulse.toFixed(3);
    }
    if (els.hybridAftershockDisplay) {
      els.hybridAftershockDisplay.textContent = state.aftershock.toFixed(3);
    }
    if (els.hybridOverrideDisplay && router) {
      const routerState = router.getState();
      if (routerState.currentPressureOverride) {
        els.hybridOverrideDisplay.textContent = routerState.currentPressureOverride.reason.toUpperCase();
        els.hybridOverrideDisplay.classList.add('chrome__devConfigStatusItem--active');
      } else {
        els.hybridOverrideDisplay.textContent = 'None';
        els.hybridOverrideDisplay.classList.remove('chrome__devConfigStatusItem--active');
      }
    }
  }

  // WO-HYBRID-ROUTING: Bind hybrid routing buttons
  if (els.triggerSpikeBtn) {
    els.triggerSpikeBtn.addEventListener('click', () => {
      const driver = getDistanceDriver();
      if (driver && driver.triggerSpike) {
        driver.triggerSpike(100); // $100 spike
        console.log('[Chrome] Manual spike triggered');
        updateHybridRoutingUI();
      }
    });
  }

  if (els.clearOverrideBtn) {
    els.clearOverrideBtn.addEventListener('click', () => {
      const router = getEpisodeRouter();
      if (router && router.clearOverride) {
        router.clearOverride();
        console.log('[Chrome] Override cleared');
        updateHybridRoutingUI();
      }
    });
  }

  if (els.resetDistanceBtn) {
    els.resetDistanceBtn.addEventListener('click', () => {
      const driver = getDistanceDriver();
      if (driver && driver.reset) {
        driver.reset('manual');
        console.log('[Chrome] Distance reset');
        updateHybridRoutingUI();
      }
    });
  }

  // WO-DEV-RENDER-BINDING: Render inspector button handlers
  if (els.resetDayBtn) {
    els.resetDayBtn.addEventListener('click', () => {
      const clock = getEpisodeClock();
      const driver = getDistanceDriver();
      const scenePacer = window.__MYFI_DEBUG__?.scenePacer;

      if (clock) clock.reset();
      if (driver) driver.reset('day_reset');
      if (scenePacer && scenePacer.reset) scenePacer.reset('day_reset');

      console.log('[Chrome] Day reset');
      updateWatchModeUI();
      updateHybridRoutingUI();
    });
  }

  // WO-TRANSACTION-MODAL-V1: Transaction modal and quick emit handlers
  // Reference to transaction modal show function (set by app.js)
  let transactionModalShowFn = null;

  function setTransactionModalHandler(showFn) {
    transactionModalShowFn = showFn;
  }

  if (els.openTransactionModalBtn) {
    els.openTransactionModalBtn.addEventListener('click', () => {
      if (transactionModalShowFn) {
        closeDevConfig(); // Close dev config first
        transactionModalShowFn();
        console.log('[Chrome] Opening Transaction Modal');
      } else {
        console.warn('[Chrome] Transaction modal handler not registered');
      }
    });
  }

  // Quick emit handlers - emit preset transactions directly
  function quickEmitTransaction(amount, merchant, category) {
    const emitFn = window.__MYFI_DEBUG__?.emitDemoSignal;
    if (emitFn) {
      emitFn(amount, merchant, category);
      console.log(`[Chrome] Quick emit: $${amount} at ${merchant} (${category})`);
    } else {
      console.warn('[Chrome] emitDemoSignal not available');
    }
  }

  if (els.quickEmitSmallBtn) {
    els.quickEmitSmallBtn.addEventListener('click', () => {
      quickEmitTransaction(25, 'Quick Purchase', 'discretionary');
    });
  }

  if (els.quickEmitMedBtn) {
    els.quickEmitMedBtn.addEventListener('click', () => {
      quickEmitTransaction(50, 'Medium Purchase', 'discretionary');
    });
  }

  if (els.quickEmitLargeBtn) {
    els.quickEmitLargeBtn.addEventListener('click', () => {
      quickEmitTransaction(100, 'Large Purchase', 'discretionary');
    });
  }

  // Bind Watch Mode time scale buttons
  els.watchTimeScaleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const scale = parseInt(btn.dataset.scale, 10);
      devConfig.watchTimeScale = scale;

      const clock = getEpisodeClock();
      if (clock) {
        clock.setTimeScale(scale);
      }

      // Update active state
      els.watchTimeScaleBtns.forEach(b => {
        b.classList.toggle('chrome__devConfigScaleBtn--active', b === btn);
      });
    });
  });

  // Bind Watch Mode segment jump buttons
  els.watchSegmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const segment = btn.dataset.segment;
      const clock = getEpisodeClock();
      if (clock) {
        clock.jumpToSegment(segment);
        updateWatchModeUI();
      }
    });
  });

  // Bind pause/resume button
  if (els.watchPauseBtn) {
    els.watchPauseBtn.addEventListener('click', () => {
      const clock = getEpisodeClock();
      if (clock) {
        clock.togglePause();
        updateWatchModeUI();
      }
    });
  }

  // Bind prev/next segment buttons
  if (els.watchPrevBtn) {
    els.watchPrevBtn.addEventListener('click', () => {
      const clock = getEpisodeClock();
      if (clock) {
        clock.jumpToPreviousSegment();
        updateWatchModeUI();
      }
    });
  }

  if (els.watchNextBtn) {
    els.watchNextBtn.addEventListener('click', () => {
      const clock = getEpisodeClock();
      if (clock) {
        clock.jumpToNextSegment();
        updateWatchModeUI();
      }
    });
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
      // WO-S6: Update current screen highlighting
      updateCompassHighlight();
      els.compassModal.hidden = false;
      els.compassModal.classList.add('chrome__compassModal--open');
    }
  }

  // WO-S6: Update compass button highlighting based on current route
  function updateCompassHighlight() {
    // Remove current class from all nav buttons
    els.compassNavBtns.forEach(btn => {
      btn.classList.remove('chrome__compassDirection--current', 'chrome__compassCenterBtn--current');
    });
    // Add current class to matching button
    els.compassNavBtns.forEach(btn => {
      if (btn.dataset.nav === currentRoute) {
        if (btn.classList.contains('chrome__compassCenterBtn')) {
          btn.classList.add('chrome__compassCenterBtn--current');
        } else {
          btn.classList.add('chrome__compassDirection--current');
        }
      }
    });
  }

  // WO-S6: Set current route (called externally or via navigation)
  function setCurrentRoute(route) {
    currentRoute = route || 'hub';
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

  // WO-S10: Navigation Orb - tap = Spirit Stone, hold = Nav modal (with radial charge)
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
        // WO-S10: Hold opens navigation compass modal
        openCompass();
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
      // WO-S10: Tap opens Spirit Stone modal
      openSpiritStone();
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

  // WO-LIVE-DEMO: Energy button binding moved to energyInteractBtn above (tap/hold)
  // Old els.energyBtn removed - now uses energyInteractBtn

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

  // WO-S6: Navigation handler reference (set by onNav)
  let navHandler = null;
  // WO-S6: Track current route for compass highlighting
  let currentRoute = 'hub';

  // WO-S6: Direct click handlers for ALL compass nav buttons (including hub center)
  // This is more reliable than event delegation
  const allCompassNavBtns = chromeHost.querySelectorAll('[data-nav]');
  allCompassNavBtns.forEach(btn => {
    // Only handle buttons inside the compass modal
    if (btn.closest('.chrome__compassModal')) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = btn.dataset.nav;
        console.log(`[Chrome] Compass nav: ${target}`);
        closeCompass();
        if (navHandler) {
          // WO-S6: Track current route for highlighting
          currentRoute = target;
          const direction = COMPASS_DIRECTIONS[target];
          if (direction) setTransitionDirection(direction);
          navHandler(target);
        } else {
          console.warn('[Chrome] navHandler not set - onNav not called?');
        }
      });
    }
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
    // WO-S6: Store handler for event delegation (compass uses this)
    navHandler = handler;

    // Footer nav buttons (excluding compass)
    els.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        // WO-S6: Track current route for highlighting
        currentRoute = target;
        const direction = COMPASS_DIRECTIONS[target];
        if (direction) setTransitionDirection(direction);
        handler(target);
      });
    });

    // WO-S6: Compass navigation now handled via event delegation above
    console.log('[Chrome] Navigation handler registered');
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
    // WO-S6: Route tracking for compass highlighting
    setCurrentRoute,
    // WO-TRANSACTION-MODAL-V1: Transaction modal handler
    setTransactionModalHandler,
    // WO-LIVE-DEMO: Game mode functions
    getGameMode,
    setGameMode,
    toggleGameMode,
  };
}
