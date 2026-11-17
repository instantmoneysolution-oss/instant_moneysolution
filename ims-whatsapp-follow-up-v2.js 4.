/* IMS WhatsApp CRM V2 — STEP 6D: Move Chat Lead to Follow Up.
   Admin-only UI; backend action: follow_up_move.
   Does not send WhatsApp messages or change conversation_status.
   Follow Up list and Chat Leads filtering will be added separately.
*/
(() => {
  'use strict';

  if (window.__imsFollowUpV2) return;
  window.__imsFollowUpV2 = true;

  const $ = id => document.getElementById(id);

  function selectedChatId() {
    try {
      return typeof inboxState !== 'undefined'
        ? inboxState.chat?.selectedId || null
        : null;
    } catch (_) {
      return null;
    }
  }

  function getClient() {
    return typeof supabaseClient !== 'undefined'
      ? supabaseClient
      : window.supabaseClient || null;
  }

  async function api(action, payload = {}) {
    const c = getClient();
    if (!c?.functions?.invoke) throw new Error('CRM connection unavailable');

    const { data, error } = await c.functions.invoke('ims-whatsapp-admin', {
      body: { action, ...payload }
    });

    if (error) {
      let message = error.message || 'Backend request failed';
      try {
        const response = await error.context?.json?.();
        if (response?.error) message = String(response.error);
      } catch (_) { /* Keep original error message. */ }
      throw new Error(message);
    }
    if (data?.success !== true || data?.admin !== true)
      throw new Error(data?.error || 'Admin verification failed');

    return data;
  }

  function init() {
    const thread = document.querySelector('#chatTab .inbox-thread');
    if (!thread || $('ims-fu-panel')) return;

    const style = document.createElement('style');
    style.textContent = `
      #ims-fu-panel[hidden], #ims-fu-formbox[hidden] { display:none!important; }
      #ims-fu-panel { border-top:1px solid #d1d5db; padding:12px 16px; background:#fff; }
      #ims-fu-toggle { background:#eef2ff; color:#3730a3; border:1px solid #a5b4fc;
        border-radius:8px; font-weight:700; padding:10px 13px; cursor:pointer; }
      #ims-fu-formbox { margin-top:12px; padding:13px; background:#f8fafc;
        border:1px solid #e2e8f0; border-radius:9px; }
      #ims-fu-form label { display:block; font-size:12px; font-weight:700; margin:9px 0 5px; }
      #ims-fu-form input, #ims-fu-form textarea { display:block; width:100%; box-sizing:border-box;
        background:#fff; border:1px solid #cbd5e1; border-radius:7px; padding:10px;
        font:inherit; font-size:13px; }
      #ims-fu-form textarea { min-height:75px; resize:vertical; }
      #ims-fu-form button { cursor:pointer; padding:10px 13px; border-radius:8px;
        border:1px solid #94a3b8; background:#fff; margin:12px 8px 0 0; }
      #ims-fu-save { background:#047857!important; color:#fff; border-color:#047857!important;
        font-weight:700; }
      #ims-fu-panel button:disabled { opacity:.5; cursor:not-allowed; }
      #ims-fu-status { font-size:12px; color:#475569; margin:10px 0 0;
        white-space:pre-wrap; overflow-wrap:anywhere; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.id = 'ims-fu-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <button id="ims-fu-toggle" type="button" aria-expanded="false">
        📅 Move to Follow Up
      </button>
      <div id="ims-fu-formbox" hidden>
        <form id="ims-fu-form" novalidate>
          <label for="ims-fu-datetime">Follow Up Date &amp; Time (IST)</label>
          <input id="ims-fu-datetime" type="datetime-local" required />
          <label for="ims-fu-notes">Follow Up Remarks (max 1,000 characters)</label>
          <textarea id="ims-fu-notes" maxlength="1000"
            placeholder="Customer se kab aur kis baat par follow up karna hai..."></textarea>
          <div>
            <button id="ims-fu-save" type="submit">Save &amp; Move to Follow Up</button>
            <button id="ims-fu-cancel" type="button">Cancel</button>
          </div>
        </form>
        <p id="ims-fu-status" role="status" aria-live="polite"></p>
      </div>
    `;

    // Keep Customer Notes and Admin Reply scripts unchanged.
    const notesPanel = $('ims-cnotes-panel');
    if (notesPanel && notesPanel.parentElement === thread) {
      notesPanel.after(panel);
    } else {
      thread.appendChild(panel);
    }

    const toggle = $('ims-fu-toggle');
    const box = $('ims-fu-formbox');
    const form = $('ims-fu-form');
    const dateInput = $('ims-fu-datetime');
    const notesInput = $('ims-fu-notes');
    const save = $('ims-fu-save');
    const cancel = $('ims-fu-cancel');
    const status = $('ims-fu-status');
    const moved = new Set();
    const state = { id: null, revision: 0, busy: false };

    const report = msg => { status.textContent = msg; };

    function setBusy(busy) {
      state.busy = busy;
      dateInput.disabled = busy;
      notesInput.disabled = busy;
      save.disabled = busy || moved.has(state.id);
      cancel.disabled = busy;
      toggle.disabled = busy;
    }

    function syncSelected() {
      const id = selectedChatId();
      if (id === state.id) return;
      state.id = id;
      state.revision += 1;
      state.busy = false;
      panel.hidden = !id;
      box.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.disabled = !id;
      dateInput.disabled = false;
      dateInput.value = '';
      notesInput.disabled = false;
      notesInput.value = '';
      save.disabled = !id || moved.has(id);
      cancel.disabled = false;
      report('');
    }

    toggle.addEventListener('click', () => {
      syncSelected();
      if (!state.id || state.busy) return;
      box.hidden = !box.hidden;
      toggle.setAttribute('aria-expanded', String(!box.hidden));
      if (!box.hidden) {
        report(moved.has(state.id)
          ? 'This lead was moved during this session. Open the Follow Up list once available.'
          : 'Choose an IST follow-up time and remarks. No WhatsApp message will be sent.');
      }
    });

    cancel.addEventListener('click', () => {
      if (state.busy) return;
      box.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      syncSelected();
      const id = state.id;
      if (!id || state.busy || box.hidden || moved.has(id)) return;

      const localTime = dateInput.value;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localTime)) {
        report('Select a valid Follow Up date and time.');
        return;
      }
      // HTML datetime-local has no timezone: explicitly treat input as IST.
      const istTime = localTime + ':00+05:30';
      const timestamp = Date.parse(istTime);
      const now = Date.now();
      if (!Number.isFinite(timestamp) || timestamp < now + 5 * 60_000 ||
          timestamp > now + 90 * 24 * 60 * 60_000) {
        report('Choose an IST time from 5 minutes to 90 days in the future.');
        return;
      }
      const remarks = notesInput.value.trim();
      if (remarks.length > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(remarks)) {
        report('Remarks must contain at most 1,000 valid characters.');
        return;
      }

      if (!confirm('Move this customer to Follow Up for ' +
        localTime.replace('T', ' ') + ' IST?\nNo WhatsApp message will be sent.')) return;
      if (selectedChatId() !== id || state.id !== id) return;

      const revision = state.revision;
      setBusy(true);
      report('Saving Follow Up in CRM...');
      try {
        const result = await api('follow_up_move', {
          conversation_id: id,
          follow_up_at: istTime,
          follow_up_notes: remarks
        });
        if (state.id !== id || state.revision !== revision || selectedChatId() !== id) return;
        if (result.follow_up?.stage !== 'follow_up' || result.whatsapp_sent !== false)
          throw new Error('Unexpected backend response; verify before retrying.');

        moved.add(id);
        report('Follow Up saved successfully for ' + localTime.replace('T', ' ') +
          ' IST. No WhatsApp message sent.\nThe separate Follow Up list and Chat Leads filtering are still pending.');
      } catch (error) {
        if (state.id === id && state.revision === revision)
          report('Move failed: ' + error.message);
      } finally {
        if (state.id === id && state.revision === revision) setBusy(false);
      }
    });

    setInterval(syncSelected, 800);
    syncSelected();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
