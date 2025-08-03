

export function initManualEntryButton() {
    const manualBtn = document.getElementById('manual-entry-btn');
    if (manualBtn) {
        manualBtn.addEventListener('click', () => {
            window.location.href = 'manual-entry.html';
        });
    }
}




