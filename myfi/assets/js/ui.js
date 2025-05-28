// ui.js
import { auth, db } from './auth.js';
import { getDoc, doc, setDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { categories, subCategories, incomeCategory } from './config.js';
import { loadDashboard, getPlayerData, loadFromLocalStorage, saveAttributesToFirestore, saveToLocalStorage } from './dashboard.js';
import { generateCashflowData, generateHudData, getAvatarStatData } from './calculations.js'; 
import playerDataManager from './playerDataManager.js';


/* ========== Helpers ========== */

// Create HTML-safe ID from a name
function createIdFromName(name) {
    return name.toLowerCase().replace(/\s+/g, '-');
}

// Smooth progress bar animation
function animateProgressBar(barElement, targetPercent, duration = 1000) {
    let start = null;
    const initialWidth = 0;

    function step(timestamp) {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const percent = Math.min(initialWidth + (progress / duration) * targetPercent, targetPercent);
        barElement.style.width = percent + '%';

        if (percent < targetPercent) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

// Smooth amount animation
function animateAmount(labelElement, startAmount, endAmount, dailyCap, duration = 1000) {
    let start = null;

    function step(timestamp) {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const currentAmount = Math.min(startAmount + (progress / duration) * (endAmount - startAmount), endAmount);

        labelElement.innerText = `£${currentAmount.toFixed(2)} / £${dailyCap.toFixed(2)}`;

        if (currentAmount < endAmount) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

/* ========== Displayed Information ========== */
// Predefined library of tooltip text, using the `id` as the key
const tooltipLibrary = {
    "contributions-bar-container": "Spend energy to your avatar, empowering them up to Rank 5 each day",
    'hud-upper-misc-left': "Stored Energy can be formed into Power Gems (and represent a month's worth of discretionary funds)",
    'hud-upper-misc-right': "Shows your total available energy for today, as well as total energy pool value (i.e actual balance)",
    tooltip3: "This is another custom tooltip message."
  };

  // Timer to delay the tooltip showing
let tooltipTimeout;
// Function to show the tooltip
// Function to show the tooltip
export function showTooltip(event) {
    const elementId = event.target.id;  // Get the element's id
    const tooltipText = tooltipLibrary[elementId]; // Use id to fetch tooltip text from the library
    
    if (tooltipText) {
      // Create tooltip element if it doesn't exist
      let tooltip = document.querySelector('.tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        document.body.appendChild(tooltip);
      }
  
      // Set the tooltip text and position
      tooltip.textContent = tooltipText;

      

      //tooltip.classList.add('tooltip-visible');
      // Set a timeout to show the tooltip after a delay
        tooltipTimeout = setTimeout(() => {
            tooltip.classList.add('tooltip-visible');

            if(elementId == "contributions-bar-container"){
                tooltip.classList.add('glow'); // Add glow class conditionally
            } 
        }, 500); // Adjust the 500ms delay to your preference
      
      // Positioning the tooltip
      const rect = event.target.getBoundingClientRect();
      tooltip.style.left = rect.left + window.scrollX + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
      tooltip.style.top = rect.top + window.scrollY - tooltip.offsetHeight - 10 + 'px'; // Adjust the 10 for space above element





    }
  }

  // Function to update the tooltip's position based on the mouse position
export function updateTooltipPosition(event) {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip && tooltip.classList.contains('tooltip-visible')) {
      // Position the tooltip near the cursor
      tooltip.style.left = `${event.clientX + 10}px`;  // 10px offset from the cursor
      tooltip.style.top = `${event.clientY + 10}px`;  // 10px offset from the cursor
    }
  }
  
  // Function to hide the tooltip
export  function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        clearTimeout(tooltipTimeout); // Clear the delay if the mouse leaves before the tooltip appears
      tooltip.classList.remove('tooltip-visible');
      tooltip.classList.remove('glow');
    }
  }
  
  // Add event listeners for elements with 'tooltip-target' class
  const tooltipElements = document.querySelectorAll('.tooltip-target');
  tooltipElements.forEach(element => {
    element.addEventListener('mouseover', showTooltip);
    //element.addEventListener('mousemove', updateTooltipPosition); // Update tooltip position as cursor moves
    element.addEventListener('mouseout', hideTooltip);
  });
  

/* ============ Profile Rendering =========== */

export function renderProfile() {
    console.log('Rendering Profile...' )
    const playerData = playerDataManager.get()
    renderAvatarDetails(playerData)
    renderAvatarStats(playerData)
    renderChampionStats()
    
}

    function renderAvatarDetails(playerData){
        document.getElementById('alias-banner').innerText = playerData.alias || 'No Alias';

    const avatarData = playerData.avatarData

    // Spending Persona

    // Avatar Level
    const avatarLevelElement = document.getElementById('profile-level');
    avatarLevelElement.innerText = avatarData.contributionLevel !== undefined
        ? `Lvl ${avatarData.contributionLevel.toFixed(0)}`
        : 'Lvl 1';

    // Avatar Pic
    const avatarPic = document.getElementById('profile-picture');
    avatarPic.style.backgroundImage = "url('./assets/img/default-profile.png')";

    if (avatarData.avatarPictureUrl) {
        avatarPic.style.backgroundImage = `url('${avatarData.avatarPictureUrl}')`;
    }

    // Charge
    const powerLevelElement = document.getElementById('power-level');
    powerLevelElement.innerText = avatarData.contributionPercent_Avatar !== undefined
    ? `${avatarData.contributionPercent_Avatar.toFixed(2) * 100}%`
    : '0';

    // Power
    const powerTotalElement = document.getElementById('power-total');
    powerTotalElement.innerText = playerData.avatarData.avatarContribution !== undefined
    ? `${avatarData.avatarContribution.toFixed(0)}`
    : '0';

    
    }

    async function renderAvatarStats(playerData) {

        const attributePoints = playerData.attributePoints
        const avatarData = playerData.avatarData
        
        const spentPoints = attributePoints.resilience + attributePoints.focus + attributePoints.adaptability
        const unspentPoints = (avatarData.contributionLevel * 10) - spentPoints ?? 0;//attributeData.unspent ?? 0;
        attributePoints.unspent = unspentPoints

        updateUI(attributePoints)

        document.querySelectorAll(".increment").forEach(button => {
            button.addEventListener("click", (e) => {
                
                const row = e.target.closest(".attribute-row");
                const attr = row.dataset.attribute;
                if (attributePoints.unspent > 0) {
                
                    attributePoints[attr]++;
                    attributePoints.unspent--;
                    updateUI(attributePoints)

                }
            });
        });

        document.querySelectorAll(".decrement").forEach(button => {
            button.addEventListener("click", (e) => {
            const row = e.target.closest(".attribute-row");
            const attr = row.dataset.attribute;
            if (attributePoints[attr] > 0) {
                attributePoints[attr]--;
                attributePoints.unspent++;
                updateUI(attributePoints);
            }
            });
        });

        document.querySelector("#reset-attributes").addEventListener("click", () => {
            let totalSpent = 0;

            for (const key in attributePoints) {
                if (key !== "unspent") {
                    totalSpent += attributePoints[key];
                    attributePoints[key] = 0;
                }
            }

            attributePoints.unspent += totalSpent;
            updateUI(attributePoints);
        });
    }

        function updateUI(attributePoints){
            for (let key in attributePoints) {
                document.getElementById(`${key}-value`).textContent = attributePoints[key];
            }

            playerDataManager.update({
                attributePoints: attributePoints,
            });
            saveToLocalStorage('attributeData', attributePoints)
        }

        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById("save-attributes").addEventListener("click", () => {
                    //const attributeData = loadFromLocalStorage('attributeData')
                    //saveAttributesToFirestore(attributeData);
                    playerDataManager.save()

                   
                });
        });

    const avatarStatConfig = {
    health: { color: '#e53935', glow: '#ff8a80' },
    mana: { color: '#1e88e5', glow: '#82b1ff' },
    stamina: { color: '#43a047', glow: '#b9f6ca' },
    };

    async function renderChampionStats(statData = null) {
        if(!statData){
            
            const selectedavatarStub = {
                            health: {
                                base:1,
                                empower: 0,
                                hud:0,
                            },
                            mana: {
                                base:1.5,
                                empower:0,
                                hud:0,
                            },
                            stamina: {
                                base:3,
                                empower:0,
                                hud:0,
                            }, 
                            lowestStat: "Health"
                        }

            statData = await getAvatarStatData(selectedavatarStub)

        }

        

    const container = document.getElementById('avatar-stats');

    const rows = container.querySelectorAll('.avatar-stat');

    rows.forEach(row => {
        
        
        const stat = row.dataset.stat;
        const value_Base = statData[stat].base || 0;
        const value_Empower = statData[stat].empower || 0;
        const value_Charge = statData[stat].charge || 0;
        const value_Hud = statData[stat].hud || 0;
        
        const blocksWrapper = row.querySelector('.stat-blocks');
        blocksWrapper.innerHTML = ''; // Clear old blocks


        // Base
        for (let i = 0; i < value_Base; i++) {
        const block = document.createElement('div');
        block.classList.add('block');
        
            block.classList.add('filled');
            block.style.backgroundColor = avatarStatConfig[stat].color;
            block.style.boxShadow = `0 0 5px ${avatarStatConfig[stat].glow}`;
            block.style.animationDelay = `${i * 50}ms`;
        
        blocksWrapper.appendChild(block);
        }
        // Empower 
        for (let i = 0; i < value_Empower; i++) {
        const bonusBlock = document.createElement('div');
        bonusBlock.classList.add('block', 'bonus');
        bonusBlock.style.backgroundColor = '#6435e5' //'purple';
        bonusBlock.style.boxShadow = `0 0 5px ${avatarStatConfig[stat].color}`; //purple';
        bonusBlock.style.animationDelay = `${(i + 10) * 50}ms`;
        blocksWrapper.appendChild(bonusBlock);
        }

        // Charge 
        for (let i = 0; i < value_Charge; i++) {
        const bonusBlock = document.createElement('div');
        bonusBlock.classList.add('block', 'bonus');
        bonusBlock.style.backgroundColor = '#4a25af' //'purple';'
        bonusBlock.style.boxShadow = '0 0 5px purple';
        bonusBlock.style.animationDelay = `${(i + 10) * 50}ms`;
        blocksWrapper.appendChild(bonusBlock);
        }


        // Hud
        for (let i = 0; i < value_Hud; i++) {
        const bonusBlock = document.createElement('div');
        bonusBlock.classList.add('block', 'bonus');
        bonusBlock.style.backgroundColor = 'orange';
        bonusBlock.style.boxShadow = `0 0 5px ${avatarStatConfig[stat].glow}`;
        bonusBlock.style.animationDelay = `${(i + 10) * 50}ms`;
        blocksWrapper.appendChild(bonusBlock);
        }

        

        

        
    });
    }




/* ========== HUD Renderer ========== */
export const hudBars = {}; // outside your renderHUD function, ideally module/global scope
export async function renderHUD() {
    console.log('Rendering HUD...' )
    const playerData = playerDataManager.get()

    const hudData = playerData.hudData


    const upperHudContainer_Vitals = document.getElementById('upper-hud-vitals');
    upperHudContainer_Vitals.innerHTML = "";

    

    subCategories[categories.discretionary].forEach(subCat => {
    if (subCat.toLowerCase() === 'unallocated') return;

        const barInstance = createBar({
            container: upperHudContainer_Vitals,
            subCat: subCat.toLowerCase(),
            availableAmount: hudData[`availableResource_${subCat}`] ?? 0,
            //availableAmountPath: `hudData.availableResource_${subCat}` ?? 0,
            capAmount: hudData[`dSpendingCap_${subCat}`] ?? 1,
            //capAmountPath: `hudData.dSpendingCap_${subCat}` ?? 1,
            storedDays: hudData[`storedDays_${subCat}`] ?? 0,
            //storedDaysPath: `hudData.storedDays_${subCat}` ?? 0,
            regenRate: hudData[`dRegenRate_${subCat}`] * 7500 ?? 0,
            type: 'regen',
            playerDataManager: playerDataManager,
            onComplete: () => {
                const barData = barInstance.getCurrentState()
                // Read current storedDays from playerDataManager or default 0
                //const keyStoredDays = `storedDays_${subCat}`;
                //const keyAvailable = `availableResource_${subCat}`;
            
                //const playerData = playerDataManager.get();
                //const currentDays = playerData?.hudData?.[keyStoredDays] ?? 0;
                const currentDays = barData.storedDays ?? 0;
    
                // 2. Update the bar's internal resource state and displayed badge
                barInstance.updateResource({ 
                    storedDays: currentDays + 1, 
                    availableAmount: 0 
                });

                // 3. Also update the badge text so the UI reflects the increment immediately
                barInstance.storedDaysBadge.textContent = `${Math.round(currentDays + 1)}`;


                // Optional: trigger any UI refresh or dashboard updates here if needed
                // generateHudData();
                // loadDashboard();

            }
        });

        hudBars[subCat.toLowerCase()] = barInstance;  // store by subCat key

    });

    //setSegmentsCount(2)

    const hudBalanceElement = document.getElementById('discretionary-current-balance');
    hudBalanceElement.innerText = hudData.availableResource_Total !== undefined
        ? `£${hudData.availableResource_Total.toFixed(2)}`
        : '£0.00';
}

    function applyPulseSettings(badgeEl, storedDays, {
    minDays = 1,
    maxDays = 31,
    minDuration = 0.6,
    maxDuration = 3.0,
    crackMin = -1,
    crackMax = -31,
    } = {}) {
    const category = badgeEl.classList.contains('growth') ? 'growth'
                    : badgeEl.classList.contains('wants') ? 'wants'
                    : badgeEl.classList.contains('needs') ? 'needs'
                    : null;

    badgeEl.classList.remove('growth-pulse', 'wants-pulse', 'needs-pulse', 'crack-effect');
    badgeEl.style.removeProperty('--pulse-duration');
    badgeEl.style.removeProperty('--crack-magnitude');
    badgeEl.style.removeProperty('--crack-duration');

    if (!category) return;

    if (storedDays < minDays) {
        const clampedNeg = Math.max(crackMin, Math.min(crackMax, storedDays));
        const normalized = (clampedNeg - crackMin) / (crackMax - crackMin); // [0, 1]
        const magnitude = 1 + normalized * 4; // Range [1, 5]
        const duration = 1.8 - normalized * 0.8; // Faster if more negative, e.g. 1s to 1.8s

        badgeEl.style.setProperty('--crack-magnitude', magnitude.toFixed(2));
        badgeEl.style.setProperty('--crack-duration', `${duration.toFixed(2)}s`);
        badgeEl.classList.add('crack-effect');
        return;
    }

    // Otherwise, apply normal pulsing
    const clamped = Math.min(maxDays, Math.max(minDays, storedDays));
    const normalized = (clamped - minDays) / (maxDays - minDays);
    const duration = maxDuration - normalized * (maxDuration - minDuration);

    badgeEl.style.setProperty('--pulse-duration', `${duration.toFixed(2)}s`);
    badgeEl.classList.add(`${category}-pulse`);
    }

/* ========== Animation Engine ========== */



/* ========== Contribution Bar Drainer (for Avatar) ========== */

document.addEventListener('DOMContentLoaded', () => {
    const discretionaryData = JSON.parse(localStorage.getItem('discretionaryData'));
    const baseCapAmount = discretionaryData.dContributionsTarget_Avatar
   
    const contributionsResource = {
        availableAmount: 1000,//baseCapAmount * 30,
        capAmount: 10000, //baseCapAmount * 30,
        ratePerSecond: 100// baseCapAmount 
    };



    createBar({
        container: document.getElementById('contributions-bar-container'),
        subCat: 'Empower', // Style category
        availableAmount: contributionsResource.availableAmount,
        //availableAmountPath: 'hudDate.dContributionsTarget_Avatar',
        capAmount: contributionsResource.capAmount,
        capAmountPath: 'hudDate.dContributionsTarget_Avatar',
        storedDays: 2,
        //storedDaysPath: ,
        type: 'drainable',
        button: document.getElementById('contributions-drain-btn'),
        label: 'Contributions',
        regenRate: contributionsResource.ratePerSecond,
        soundEffectPath: '/assets/sounds/drain-sound.mp3',
        onComplete: (amount, empowerLevel) => {
            openPaymentModal(amount.toFixed(2), empowerLevel);
        }
    });

    
});

/// BAr

function createBar({
    container,
    subCat,
    availableAmount = 0,
    capAmount = 100,
    storedDays = 0,
    regenRate = null,
    availableAmountPath = null,
    capAmountPath = null,
    storedDaysPath = null,
    regenRatePath = null, 
    playerDataManager = null,
    type = 'static',
    iconPath = '',
    label = '',
    button = null,
    soundEffectPath = '',
    onComplete = () => {},
    lastUpdated = Date.now(),
    lerpFactor = 0.15, // ✅ ADDED: configurable smoothing speed
    precision = 0.005   // ✅ ADDED: prevents jitter
}) {
    const getFromPath = (obj, path) =>
        path ? path.split('.').reduce((o, k) => o?.[k], obj) : undefined;

    let currentPlayer = playerDataManager?.get?.() || {};
    let resource = {
        availableAmount: availableAmountPath ? getFromPath(currentPlayer, availableAmountPath) ?? availableAmount : availableAmount,
        capAmount: capAmountPath ? getFromPath(currentPlayer, capAmountPath) ?? capAmount : capAmount,
        storedDays: storedDaysPath ? getFromPath(currentPlayer, storedDaysPath) ?? storedDays : storedDays,
        //regenRate: regenRatePath ? getFromPath(currentPlayer, regenRatePath) ?? regenRate : regenRate,
        
        regenRate: regenRatePath ? (getFromPath(currentPlayer, regenRatePath) ?? regenRate) / 86400 : (regenRate !== null ? regenRate / 86400 : null),
        lastUpdated
    };

    let displayedPercent = 0;
    let animationFrame;

    // DOM setup
    const barWrapper = document.createElement('div');
    barWrapper.className = 'bar-wrapper';

    const barBackground = document.createElement('div');
    barBackground.className = 'bar-background';

    const barFill = document.createElement('div');
    barFill.className = `bar-fill ${subCat}`;
    barFill.style.width = '0%';

    const stripeOverlay = document.createElement('div');
    stripeOverlay.className = 'bar-stripes';

    const barContent = document.createElement('div');
    barContent.className = 'bar-inner-content';

    const leftText = document.createElement('div');
    leftText.className = 'bar-left-text';
    leftText.innerText = subCat.charAt(0).toUpperCase() + subCat.slice(1);//subCat;

    const rightText = document.createElement('div');
    rightText.className = 'bar-right-text';
    rightText.innerText = `£${resource.availableAmount.toFixed(2)} / £${resource.capAmount.toFixed(2)}`;

    barContent.append(leftText, rightText);

    const icon = document.createElement('img');
    icon.className = 'vital-icon';
    icon.src = iconPath || `/assets/img/${subCat}.png`;

    const storedDaysBadge = document.createElement('div');

    storedDaysBadge.className = `circle-badge outside-right ${subCat}`;
    storedDaysBadge.dataset.type = "stored";  // <- Add this line
    storedDaysBadge.dataset.subcat = subCat.toLowerCase();  // <- Optional: for extra safety
    storedDaysBadge.innerText = `${Math.round(resource.storedDays)}`;

    const badgeWrapper = document.createElement('div');
    badgeWrapper.className = 'badge-wrapper';
    badgeWrapper.appendChild(storedDaysBadge);

    barBackground.append(stripeOverlay, barFill, barContent, icon);
    barWrapper.append(barBackground, badgeWrapper);
    container.appendChild(barWrapper);

    // ✅ Unified smoothing loop
    const animate = () => {
        const targetPercent = (resource.capAmount === 0) ? 0 : (resource.availableAmount / resource.capAmount) * 100;
        if (Math.abs(targetPercent - displayedPercent) > precision) {
            displayedPercent += (targetPercent - displayedPercent) * lerpFactor;
            barFill.style.width = `${displayedPercent}%`;
        } else {
            displayedPercent = targetPercent;
            barFill.style.width = `${targetPercent}%`;
        }

        rightText.innerText = `£${resource.availableAmount.toFixed(2)} / £${resource.capAmount.toFixed(2)}`;
        barFill.classList.toggle('glow-effect', targetPercent > 0);
        barFill.classList.toggle('pulse', targetPercent >= 90);

        animationFrame = requestAnimationFrame(animate);
    };

    animate();
    applyPulseSettings(storedDaysBadge, resource.storedDays);

    let paused = false;

    const updateLoop = () => {
        if (!paused && regenRate !== null && ['regen', 'degen', 'drainable'].includes(type)) {
            const now = Date.now();
            const elapsed = (now - resource.lastUpdated) / 1000;
            resource.lastUpdated = now;
            const delta = resource.regenRate * elapsed;

            resource.availableAmount = Math.max(0, Math.min(resource.capAmount, resource.availableAmount + delta));

            if (resource.availableAmount === 0 || resource.availableAmount === resource.capAmount) {
                onComplete();
            }
        }
        requestAnimationFrame(updateLoop);
    };

    if (['regen', 'degen', 'drainable'].includes(type)) requestAnimationFrame(updateLoop);

    const pause = () => { paused = true; };
    const resume = () => {
        resource.lastUpdated = Date.now();
        paused = false;
    };

    const updateFromPlayerData = () => {
        const player = playerDataManager?.get?.();
        if (!player) return;
        const newAvailable = availableAmountPath ? getFromPath(player, availableAmountPath) : resource.availableAmount;
        const newCap = capAmountPath ? getFromPath(player, capAmountPath) : resource.capAmount;
        const newDays = storedDaysPath ? getFromPath(player, storedDaysPath) : resource.storedDays;
        const newRegen = regenRatePath ? getFromPath(player, regenRatePath) : resource.regenRate;
    
        resource.availableAmount = newAvailable;
        resource.capAmount = newCap;
        resource.storedDays = newDays;

        resource.regenRate = newRegen != null ? (newRegen / 86400) : null;
        storedDaysBadge.innerText = `${Math.round(newDays)}`;
        applyPulseSettings(storedDaysBadge, newDays);
    };

    if (playerDataManager?.on && (availableAmountPath || capAmountPath || storedDaysPath)) {
        playerDataManager.on('update', updateFromPlayerData);
    }

    if (type === 'drainable' && button && regenRate) {
        setupDrainBehavior({
            resource,
            barElement: barFill,
            labelElement: rightText,
            buttonElement: button,
            soundEffectPath,
            onComplete,
        });
    }

    return {
        pause,
        resume,
        updateFromManager: updateFromPlayerData,
        updateResource: (newSettings = {}) => Object.assign(resource, newSettings),
        getCurrentState: () => ({ ...resource }),
        destroy: () => cancelAnimationFrame(animationFrame), // ✅ cleanup
        commitToPlayerData: () => {
            if (!playerDataManager?.updateByKey) return;

            if (availableAmountPath) {
                playerDataManager.updateByKey(availableAmountPath, resource.availableAmount);
            }
            if (capAmountPath) {
                playerDataManager.updateByKey(capAmountPath, resource.capAmount);
            }
            if (storedDaysPath) {
                playerDataManager.updateByKey(storedDaysPath, resource.storedDays);
            }
            if (regenRatePath && resource.regenRate !== null) {
                playerDataManager.updateByKey(regenRatePath, resource.regenRate * 86400);
            }
        },
        adjustAvailable: (delta) => {
            resource.availableAmount = Math.max(0, Math.min(resource.capAmount, resource.availableAmount + delta));
        },
        adjustStoredDays: (delta) => {
            resource.storedDays = Math.max(0, resource.storedDays + delta);
            storedDaysBadge.innerText = `${Math.round(resource.storedDays)}`;
            applyPulseSettings(storedDaysBadge, resource.storedDays);
        },
        storedDaysBadge, 
        //badgeWrapper
    };
}

function setupDrainBehavior({
    resource,
    barElement,
    labelElement,
    buttonElement,
    soundEffectPath,
    onComplete
}) {
    let isDraining = false;
    let accumulatedAmount = 0;
    let empowerLevel;
    const audio = soundEffectPath ? new Audio(soundEffectPath) : null;

    buttonElement.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const queuedEmpowerLevel = JSON.parse(localStorage.getItem('empowerLevel')) || 0;
        if (queuedEmpowerLevel >= 5 || isDraining || resource.availableAmount <= 0) return;

        isDraining = true;
        accumulatedAmount = 0;

        const drainInterval = setInterval(() => {
            const drainPerTick = resource.regenRate * 0.1;
            resource.availableAmount = Math.max(0, resource.availableAmount - drainPerTick);
            accumulatedAmount += drainPerTick;

            const unitsEarned = Math.floor(accumulatedAmount / (resource.capAmount * 0.195));
            const addToEmpowerLevel = Math.min(unitsEarned, 5 - queuedEmpowerLevel);
            empowerLevel = addToEmpowerLevel + queuedEmpowerLevel;

            // Update UI
            for (let i = 1; i <= empowerLevel; i++) {
                const el = document.getElementById(`empower-level-${i}`);
                if (el) el.classList.replace('empower-inactive', 'empower-active');
            }

            const percentage = (resource.availableAmount / resource.capAmount) * 100;
            barElement.style.width = `${percentage}%`;
            barElement.classList.toggle('glow-effect', percentage > 0);

            labelElement.innerText = `£${resource.availableAmount.toFixed(2)} / £${resource.capAmount.toFixed(2)}`;
        }, 100);

        const stopDrain = () => {
            if (!isDraining) return;
            clearInterval(drainInterval);
            isDraining = false;

            localStorage.setItem('empowerLevel', JSON.stringify(empowerLevel));
            if (onComplete) onComplete(accumulatedAmount, empowerLevel);

            // Reset bar visually
            resource.availableAmount = resource.capAmount;
            barElement.style.width = '100%';
            labelElement.innerText = `£${resource.capAmount.toFixed(2)} / £${resource.capAmount.toFixed(2)}`;
        };

        buttonElement.addEventListener('pointerup', stopDrain, { once: true });
        buttonElement.addEventListener('pointerleave', stopDrain, { once: true });
    });
}



export function setSegmentsCount(count) {
    const barStripesElements = document.querySelectorAll('.bar-stripes');
  barStripesElements.forEach(el => {
    el.style.setProperty('--segments', count);
  });
}



/* ========== Modal Helpers ========== */

export function openPaymentModal(amountSpent) {
    const modal = document.getElementById('payment-modal');
    modal.classList.remove('hidden');
    modal.style.opacity = 1;
    modal.style.visibility = 'visible';
    document.getElementById('amount').value = amountSpent;
    modal.style.display = 'block';

    const empowerBtn = document.getElementById('submit-payment');
    // or pass a specific amount if you like
    if (empowerBtn) empowerBtn.addEventListener('click', () => { submitPayment(amountSpent
    )});

}

 export async function submitPayment(amountSpent){

    const alias = loadFromLocalStorage('alias')

    const submitURL = "https://monzo.me/emkaybarrie?amount=10.00&d=MyFi_" + alias

    window.open(submitURL, '_blank');

    const modal = document.getElementById('payment-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';

    for (let i = 1; i <= 5; i++) {
                const el = document.getElementById(`empower-level-${i}`);
                if (el) {
                    el.classList.add('empower-inactive');
                    el.classList.remove('empower-active');
                }
    }


    

    

    const user = JSON.parse(localStorage.getItem('user'));
    const playerRef = doc(db, 'players', user.uid)
    const userDoc = await getDoc(playerRef);
    const playerData = userDoc.data();
    const newAmount = playerData.avatarData.avatarContribution + parseFloat(amountSpent)
    try {
    await setDoc(playerRef, {
    avatarData: {
      avatarContribution: parseFloat(newAmount),
      avatarEmpowerLevel: JSON.parse(localStorage.getItem('empowerLevel'))
    }
    }, { merge: true });

    //alert("Your energy has been added to your avatar!");
    window.localStorage.setItem('empowerLevel', JSON.stringify(0));
    fetchDataAndRenderMyFiDashboard(user.uid)
    document.addEventListener('DOMContentLoaded', () => {
    loadAttributesFromPlayerData();
    })
  } catch (err) {
    console.error("Error saving to Firestore:", err);
    alert("There was an error saving your choices.");
  }
}

export function openLinkSheetModal(amountSpent) {
    const modal = document.getElementById('google-sheet-modal');
    modal.classList.remove('hidden');
    modal.style.opacity = 1;
    modal.style.visibility = 'visible';
    document.getElementById('amount').value = amountSpent;
    modal.style.display = 'block';

}

export function closeSheetModal() {
    const modal = document.getElementById('google-sheet-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}


/* ========== Manual Entry Button Controls ========== */

export function showManualEntryButton() {
    const manualBtn = document.getElementById('manual-entry-btn');
    if (manualBtn) manualBtn.style.display = 'inline-block';
}

export function showLinkAccountButton() {
    const Btn = document.getElementById('link-sheet-btn');
    if (Btn) Btn.style.display = 'inline-block';
}

export function showUnlinkAccountButton() {
    const Btn = document.getElementById('unlink-sheet-btn');
    if (Btn) Btn.style.display = 'inline-block';
}

export function hideManualEntryButton() {
    const Btn = document.getElementById('manual-entry-btn');
    if (Btn) Btn.style.display = 'none';
}

export function hideLinkAccountButton() {
    const Btn = document.getElementById('link-sheet-btn');
    if (Btn) Btn.style.display = 'none';
}


export function hideUnlinkAccountButton() {
    const Btn = document.getElementById('unlink-sheet-btn');
    if (Btn) Btn.style.display = 'none';
}
