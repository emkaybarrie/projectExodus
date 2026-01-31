// TransactionModal Part — WO-TRANSACTION-MODAL-V1
// Dev-only modal for manually creating transaction events
// Triggers narrative rendering based on current activity state
//
// Fields: type, amount, merchant, category, frequency, note
// Emits standardized transactionEvent to episodeRunner

import { ensureGlobalCSS } from '../../../core/styleLoader.js';
import { createTransactionSignal } from '../../../systems/stageSignals.js';

// Category options with episode type hints
const CATEGORIES = [
  { id: 'discretionary', label: 'Discretionary', hint: 'Combat/Autobattler', icon: '🎮' },
  { id: 'essential', label: 'Essential', hint: 'Traversal/Autobattler', icon: '🏠' },
  { id: 'subscription', label: 'Subscription', hint: 'Social/Choice', icon: '📱' },
  { id: 'food', label: 'Food & Dining', hint: 'Various', icon: '🍽️' },
  { id: 'transport', label: 'Transport', hint: 'Traversal', icon: '🚗' },
  { id: 'bills', label: 'Bills & Utilities', hint: 'Essential', icon: '📄' },
  { id: 'transfer', label: 'Transfer', hint: 'Neutral', icon: '💸' },
  { id: 'other', label: 'Other', hint: 'Variable', icon: '📦' },
];

// Transaction frequency options
const FREQUENCIES = [
  { id: 'adhoc', label: 'One-time', hint: 'Single occurrence' },
  { id: 'recurring', label: 'Recurring', hint: 'Regular payment' },
  { id: 'unknown', label: 'Unknown', hint: 'Unspecified' },
];

// Amount band thresholds
const AMOUNT_BANDS = {
  small: { min: 0, max: 25, label: 'Small' },
  medium: { min: 25, max: 100, label: 'Medium' },
  large: { min: 100, max: Infinity, label: 'Large' },
};

function getAmountBand(amount) {
  const val = Math.abs(amount);
  if (val < AMOUNT_BANDS.small.max) return 'small';
  if (val < AMOUNT_BANDS.medium.max) return 'medium';
  return 'large';
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.TransactionModal', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-TransactionModal TransactionModal';
  root.dataset.visible = data.visible ? 'true' : 'false';

  // Build modal HTML
  root.innerHTML = buildModalHTML();

  host.appendChild(root);

  // Internal state
  const state = {
    type: 'spend',
    amount: 25,
    merchant: '',
    category: 'discretionary',
    frequency: 'adhoc',
    note: '',
  };

  // Bind form interactions
  bindFormInteractions(root, state, ctx);

  // If actionBus available, subscribe to open/close events
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    unsubscribers.push(
      ctx.actionBus.subscribe('transactionModal:open', () => {
        root.dataset.visible = 'true';
      })
    );
    unsubscribers.push(
      ctx.actionBus.subscribe('transactionModal:close', () => {
        root.dataset.visible = 'false';
      })
    );
  }

  return {
    unmount() {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      root.remove();
    },
    update(newData) {
      if (newData.visible !== undefined) {
        root.dataset.visible = newData.visible ? 'true' : 'false';
      }
    },
    show() {
      root.dataset.visible = 'true';
    },
    hide() {
      root.dataset.visible = 'false';
    },
  };
}

function buildModalHTML() {
  const categoryOptions = CATEGORIES.map(cat =>
    `<option value="${cat.id}">${cat.icon} ${cat.label}</option>`
  ).join('');

  const frequencyOptions = FREQUENCIES.map(freq =>
    `<option value="${freq.id}">${freq.label}</option>`
  ).join('');

  return `
    <div class="TransactionModal__backdrop" data-action="close"></div>
    <div class="TransactionModal__dialog">
      <div class="TransactionModal__header">
        <h2 class="TransactionModal__title">New Transaction Event</h2>
        <button class="TransactionModal__close" data-action="close" aria-label="Close">&times;</button>
      </div>

      <div class="TransactionModal__body">
        <!-- Type Toggle -->
        <div class="TransactionModal__field">
          <label class="TransactionModal__label">Transaction Type</label>
          <div class="TransactionModal__toggle" data-field="type">
            <button class="TransactionModal__toggleBtn TransactionModal__toggleBtn--active" data-value="spend">
              <span class="TransactionModal__toggleIcon">💸</span>
              <span>Spend</span>
            </button>
            <button class="TransactionModal__toggleBtn" data-value="income">
              <span class="TransactionModal__toggleIcon">💰</span>
              <span>Income</span>
            </button>
          </div>
        </div>

        <!-- Amount -->
        <div class="TransactionModal__field">
          <label class="TransactionModal__label" for="txAmount">Amount</label>
          <div class="TransactionModal__amountRow">
            <span class="TransactionModal__currency">$</span>
            <input type="number" id="txAmount" class="TransactionModal__input TransactionModal__input--amount"
                   value="25" min="0.01" step="0.01" data-field="amount">
            <span class="TransactionModal__amountBand" data-bind="amountBand">Small</span>
          </div>
        </div>

        <!-- Quick Amount Buttons -->
        <div class="TransactionModal__quickAmounts">
          <button class="TransactionModal__quickBtn" data-amount="5">$5</button>
          <button class="TransactionModal__quickBtn" data-amount="15">$15</button>
          <button class="TransactionModal__quickBtn TransactionModal__quickBtn--active" data-amount="25">$25</button>
          <button class="TransactionModal__quickBtn" data-amount="50">$50</button>
          <button class="TransactionModal__quickBtn" data-amount="100">$100</button>
          <button class="TransactionModal__quickBtn" data-amount="250">$250</button>
        </div>

        <!-- Merchant -->
        <div class="TransactionModal__field">
          <label class="TransactionModal__label" for="txMerchant">Merchant / Origin</label>
          <input type="text" id="txMerchant" class="TransactionModal__input"
                 placeholder="e.g., Coffee Shop, Streaming Service" data-field="merchant">
        </div>

        <!-- Category -->
        <div class="TransactionModal__field">
          <label class="TransactionModal__label" for="txCategory">Category</label>
          <select id="txCategory" class="TransactionModal__select" data-field="category">
            ${categoryOptions}
          </select>
          <span class="TransactionModal__hint" data-bind="categoryHint">Combat/Autobattler</span>
        </div>

        <!-- Frequency -->
        <div class="TransactionModal__field">
          <label class="TransactionModal__label" for="txFrequency">Frequency</label>
          <select id="txFrequency" class="TransactionModal__select" data-field="frequency">
            ${frequencyOptions}
          </select>
        </div>

        <!-- Note -->
        <div class="TransactionModal__field">
          <label class="TransactionModal__label" for="txNote">Note (optional)</label>
          <textarea id="txNote" class="TransactionModal__textarea" rows="2"
                    placeholder="Additional context..." data-field="note"></textarea>
        </div>

        <!-- Current Context Info -->
        <div class="TransactionModal__context">
          <div class="TransactionModal__contextRow">
            <span class="TransactionModal__contextLabel">Activity State:</span>
            <span class="TransactionModal__contextValue" data-bind="activityState">--</span>
          </div>
          <div class="TransactionModal__contextRow">
            <span class="TransactionModal__contextLabel">Time:</span>
            <span class="TransactionModal__contextValue" data-bind="simTime">--</span>
          </div>
          <div class="TransactionModal__contextRow">
            <span class="TransactionModal__contextLabel">Distance:</span>
            <span class="TransactionModal__contextValue" data-bind="distance">--</span>
          </div>
        </div>
      </div>

      <div class="TransactionModal__footer">
        <button class="TransactionModal__btn TransactionModal__btn--cancel" data-action="close">Cancel</button>
        <button class="TransactionModal__btn TransactionModal__btn--submit" data-action="submit">
          <span class="TransactionModal__btnIcon">⚡</span>
          Emit Event
        </button>
      </div>
    </div>
  `;
}

function bindFormInteractions(root, state, ctx) {
  // Update context display
  updateContextDisplay(root);

  // Type toggle
  const typeToggle = root.querySelector('[data-field="type"]');
  typeToggle?.addEventListener('click', (e) => {
    const btn = e.target.closest('.TransactionModal__toggleBtn');
    if (!btn) return;

    const value = btn.dataset.value;
    state.type = value;

    // Update active state
    typeToggle.querySelectorAll('.TransactionModal__toggleBtn').forEach(b => {
      b.classList.toggle('TransactionModal__toggleBtn--active', b.dataset.value === value);
    });
  });

  // Amount input
  const amountInput = root.querySelector('[data-field="amount"]');
  const amountBandEl = root.querySelector('[data-bind="amountBand"]');
  amountInput?.addEventListener('input', (e) => {
    state.amount = parseFloat(e.target.value) || 0;
    if (amountBandEl) {
      amountBandEl.textContent = AMOUNT_BANDS[getAmountBand(state.amount)].label;
    }
    // Update quick amount buttons
    root.querySelectorAll('.TransactionModal__quickBtn').forEach(btn => {
      btn.classList.toggle('TransactionModal__quickBtn--active',
        parseFloat(btn.dataset.amount) === state.amount);
    });
  });

  // Quick amount buttons
  root.querySelectorAll('.TransactionModal__quickBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.amount);
      state.amount = amount;
      if (amountInput) amountInput.value = amount;
      if (amountBandEl) {
        amountBandEl.textContent = AMOUNT_BANDS[getAmountBand(amount)].label;
      }
      // Update active state
      root.querySelectorAll('.TransactionModal__quickBtn').forEach(b => {
        b.classList.toggle('TransactionModal__quickBtn--active', b === btn);
      });
    });
  });

  // Merchant input
  const merchantInput = root.querySelector('[data-field="merchant"]');
  merchantInput?.addEventListener('input', (e) => {
    state.merchant = e.target.value;
  });

  // Category select
  const categorySelect = root.querySelector('[data-field="category"]');
  const categoryHintEl = root.querySelector('[data-bind="categoryHint"]');
  categorySelect?.addEventListener('change', (e) => {
    state.category = e.target.value;
    const cat = CATEGORIES.find(c => c.id === state.category);
    if (categoryHintEl && cat) {
      categoryHintEl.textContent = cat.hint;
    }
  });

  // Frequency select
  const frequencySelect = root.querySelector('[data-field="frequency"]');
  frequencySelect?.addEventListener('change', (e) => {
    state.frequency = e.target.value;
  });

  // Note textarea
  const noteTextarea = root.querySelector('[data-field="note"]');
  noteTextarea?.addEventListener('input', (e) => {
    state.note = e.target.value;
  });

  // Close actions
  root.querySelectorAll('[data-action="close"]').forEach(el => {
    el.addEventListener('click', () => {
      root.dataset.visible = 'false';
      if (ctx.actionBus) {
        ctx.actionBus.emit('transactionModal:closed');
      }
    });
  });

  // Submit action
  const submitBtn = root.querySelector('[data-action="submit"]');
  submitBtn?.addEventListener('click', () => {
    submitTransaction(root, state, ctx);
  });

  // Keyboard shortcuts
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      root.dataset.visible = 'false';
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      submitTransaction(root, state, ctx);
    }
  });

  // Update context periodically
  setInterval(() => {
    if (root.dataset.visible === 'true') {
      updateContextDisplay(root);
    }
  }, 1000);
}

function updateContextDisplay(root) {
  const debug = window.__MYFI_DEBUG__;
  if (!debug) return;

  // Activity state
  const activityEl = root.querySelector('[data-bind="activityState"]');
  if (activityEl && debug.episodeRouter) {
    const state = debug.episodeRouter.currentState;
    activityEl.textContent = state?.label || '--';
  }

  // Sim time
  const timeEl = root.querySelector('[data-bind="simTime"]');
  if (timeEl && debug.episodeClock) {
    const clockState = debug.episodeClock.getState();
    timeEl.textContent = `${clockState.timeString} (${clockState.segmentLabel})`;
  }

  // Distance
  const distanceEl = root.querySelector('[data-bind="distance"]');
  if (distanceEl && debug.distanceDriver) {
    const driverState = debug.distanceDriver.getState();
    distanceEl.textContent = `${(driverState.distance01 * 100).toFixed(0)}% - ${driverState.distanceBand?.label || 'City'}`;
  }
}

function submitTransaction(root, state, ctx) {
  // Generate transaction event
  const txEvent = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    ts: Date.now(),
    type: state.type,
    amount: state.amount,
    merchant: state.merchant || `Demo ${state.type === 'spend' ? 'Purchase' : 'Deposit'}`,
    category: state.category,
    frequency: state.frequency,
    note: state.note || '',
    amountBand: getAmountBand(state.amount),
    source: 'manual_modal',
  };

  console.log('[TransactionModal] Submitting transaction:', txEvent);

  // Create signal and emit via stageSignals
  const debug = window.__MYFI_DEBUG__;
  if (debug?.stageSignals) {
    const signal = createTransactionSignal({
      amount: state.type === 'spend' ? -state.amount : state.amount,
      merchant: txEvent.merchant,
      category: state.category,
      sourceRef: 'manual_modal',
    });
    debug.stageSignals.ingest(signal);
    console.log('[TransactionModal] Signal ingested:', signal);
  }

  // Also emit raw event for logging/inspector
  if (ctx.actionBus) {
    ctx.actionBus.emit('transaction:manual', txEvent);
  }

  // Record in render inspector timeline
  if (debug?.renderInspector) {
    debug.renderInspector.addTimelineEvent('transaction:manual', {
      ...txEvent,
      activityState: debug.episodeRouter?.currentState?.id,
      dayT: debug.episodeClock?.getDayT(),
    });
  }

  // Show success feedback
  showSubmitFeedback(root);

  // Close modal after brief delay
  setTimeout(() => {
    root.dataset.visible = 'false';
  }, 600);
}

function showSubmitFeedback(root) {
  const submitBtn = root.querySelector('[data-action="submit"]');
  if (!submitBtn) return;

  submitBtn.classList.add('TransactionModal__btn--success');
  submitBtn.innerHTML = '<span class="TransactionModal__btnIcon">✓</span> Emitted!';

  setTimeout(() => {
    submitBtn.classList.remove('TransactionModal__btn--success');
    submitBtn.innerHTML = '<span class="TransactionModal__btnIcon">⚡</span> Emit Event';
  }, 1500);
}
