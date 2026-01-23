// modalManager.js — Minimal modal overlay manager for Phase 1
// Part of I2-JourneyRunner-Phase1
// Spec: /The Forge/myfi/specs/system/JOURNEYS_SPEC.md

import * as actionBus from './actionBus.js';

let modalHost = null;
let currentModal = null;

/**
 * Initialize the modal manager with a host element.
 * @param {HTMLElement} host - Container element for modal overlays
 */
export function init(host) {
  modalHost = host;
  if (modalHost) {
    modalHost.className = 'modal-host';
    modalHost.innerHTML = '';
  }
}

/**
 * Open a modal overlay.
 * @param {string} modalId - Identifier for the modal
 * @param {object} data - Data passed to the modal
 * @returns {Promise<void>}
 */
export async function openModal(modalId, data = {}) {
  if (!modalHost) {
    console.error('[ModalManager] No modal host initialized');
    return;
  }

  // Close any existing modal first
  if (currentModal) {
    await closeModal();
  }

  console.log(`[ModalManager] Opening modal: ${modalId}`, data);

  // Create modal overlay (Phase 1: minimal placeholder)
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.modalId = modalId;

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">${modalId}</span>
      <button class="modal-close" type="button" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <p>Modal: <strong>${modalId}</strong></p>
      <p class="modal-data">${data ? JSON.stringify(data, null, 2) : 'No data'}</p>
      <p class="modal-placeholder">Phase 1 placeholder content</p>
    </div>
  `;

  overlay.appendChild(content);

  // Bind close button
  const closeBtn = content.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal(modalId));
  }

  // Bind overlay click to close (click outside content)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(modalId);
    }
  });

  // Bind Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape' && currentModal?.id === modalId) {
      closeModal(modalId);
    }
  };
  document.addEventListener('keydown', escHandler);

  modalHost.appendChild(overlay);
  modalHost.hidden = false;

  currentModal = {
    id: modalId,
    data,
    overlay,
    escHandler,
  };

  // Emit modal opened event
  actionBus.emit('modal.opened', { modalId, data }, 'modalManager');
}

/**
 * Close the current or specified modal.
 * @param {string} [modalId] - Specific modal to close (default: current)
 * @returns {Promise<void>}
 */
export async function closeModal(modalId) {
  if (!currentModal) {
    console.log('[ModalManager] No modal to close');
    return;
  }

  // If modalId specified, only close if it matches
  if (modalId && currentModal.id !== modalId) {
    console.log(`[ModalManager] Modal "${modalId}" not found (current: ${currentModal.id})`);
    return;
  }

  const closingId = currentModal.id;
  console.log(`[ModalManager] Closing modal: ${closingId}`);

  // Remove escape handler
  if (currentModal.escHandler) {
    document.removeEventListener('keydown', currentModal.escHandler);
  }

  // Remove overlay
  if (currentModal.overlay && currentModal.overlay.parentNode) {
    currentModal.overlay.remove();
  }

  currentModal = null;

  // Hide host if no modals
  if (modalHost) {
    modalHost.hidden = true;
  }

  // Emit modal dismissed event (per JOURNEYS_SPEC.md §6.4)
  actionBus.emit('modal.dismissed', { modalId: closingId }, 'modalManager');
}

/**
 * Check if a modal is currently open.
 * @returns {boolean}
 */
export function isOpen() {
  return currentModal !== null;
}

/**
 * Get the current modal ID.
 * @returns {string|null}
 */
export function getCurrentModalId() {
  return currentModal?.id || null;
}

export default { init, openModal, closeModal, isOpen, getCurrentModalId };
