/* IMS Bulk Prior Opt-in Attestation UI — add AFTER existing page scripts.
 * The CRM Admin confirms that every uploaded contact ALREADY opted in.
 * Server still excludes active STOP and revoked contacts.
 */
(() => {
  'use strict';
  if (window.imsBulkPriorOptinUI) return;
  window.imsBulkPriorOptinUI = true;

  function init() {
    const save = document.getElementById('saveDraftBtn');
    const sheet = document.getElementById('sheetFile');
    const progress = document.getElementById('draftProgress');
    let checkbox = document.getElementById('optInConfirm');
    if (!save || !sheet || !progress || typeof window.adminRequest !== 'function') {
      console.error('Bulk Opt-in UI requires existing IMS Campaign upload elements and global adminRequest.');
      return;
    }

    if (!checkbox) {
      const label = document.createElement('label');
      label.className = 'check';
      label.style.cssText = 'display:flex;gap:9px;align-items:flex-start;margin:12px 0';
      checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'optInConfirm';
      const text = document.createElement('span');
      label.append(checkbox, text);
      save.parentElement?.parentElement?.insertAdjacentElement('afterbegin', label);
    }
    const labelText = checkbox.closest('label')?.querySelector('span');
    if (labelText) {
      labelText.textContent = 'I confirm EVERY customer in this Excel list previously agreed to receive IMS WhatsApp marketing messages. I can provide the original opt-in evidence if requested. STOP and revoked contacts remain blocked.';
    }
    checkbox.checked = false;
    checkbox.required = true;

    const originalRequest = window.adminRequest;
    window.adminRequest = async function (action, payload = {}) {
      if (action !== 'append_recipients') return originalRequest.call(this, action, payload);
      if (!checkbox.checked) {
        throw new Error('Confirm prior WhatsApp opt-in for EVERY customer in this Excel list before saving.');
      }
      return originalRequest.call(this, action, {
        ...payload,
        existing_optin_attestation: 'CONFIRM_ALL_HAVE_PRIOR_OPTIN'
      });
    };

    if (typeof window.updateDraftButton === 'function') {
      const originalUpdate = window.updateDraftButton;
      window.updateDraftButton = function (...args) {
        const value = originalUpdate.apply(this, args);
        if (!checkbox.checked) save.disabled = true;
        return value;
      };
    }
    function updateButton() {
      if (typeof window.updateDraftButton === 'function') window.updateDraftButton();
      else if (!checkbox.checked) save.disabled = true;
    }
    checkbox.addEventListener('change', updateButton);
    sheet.addEventListener('change', () => {
      checkbox.checked = false;
      updateButton();
    }, { capture: true });
    save.addEventListener('click', (event) => {
      if (!checkbox.checked) {
        event.preventDefault();
        event.stopImmediatePropagation();
        progress.textContent = 'Confirm that every recipient already opted in before saving.';
      }
    }, { capture: true });

    // The original upload UI was written before live sending existed.
    // Remove only its outdated label; do not enable a legacy send button.
    const observer = new MutationObserver(() => {
      const old = progress.textContent || '';
      if (old.includes('Sending remains disabled; consent must be verified before sending.')) {
        progress.textContent = old.replace(
          'Sending remains disabled; consent must be verified before sending.',
          'Prior opt-in attestation saved for newly registered contacts. Use Send Manager to send eligible messages. STOP remains blocked.'
        );
      }
    });
    observer.observe(progress, { childList: true, characterData: true, subtree: true });
    updateButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
