/* IMS WhatsApp CRM V2 — Customer Notes panel (Admin-only).
   Separate from WhatsApp chat messages and sending.
   Requires ims-whatsapp-admin actions: customer_notes_get / customer_notes_save.
*/
(() => {
  'use strict';

  if (window.__imsCustomerNotesV2) return;
  window.__imsCustomerNotesV2 = true;

  const $ = id => document.getElementById(id);
  const getSelectedId = () => {
    try {
      return typeof inboxState !== 'undefined'
        ? (inboxState.chat?.selectedId || null)
        : null;
    } catch (_) {
      return null;
    }
  };
  const client = () =>
    (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);

  async function api(action, payload) {
    const c = client();
    if (!c?.functions?.invoke) throw new Error('CRM connection unavailable');

    const { data, error } = await c.functions.invoke('ims-whatsapp-admin', {
      body: { action, ...payload }
    });

    if (error) {
      let message = error.message || 'Request failed';
      try {
        const response = await error.context?.json?.();
        if (response?.error) message = String(response.error);
      } catch (_) { /* Retain original error */ }
      throw new Error(message);
    }
    if (data?.success !== true || data?.admin !== true)
      throw new Error(data?.error || 'Admin verification failed');
    return data;
  }

  function init() {
    const thread = document.querySelector('#chatTab .inbox-thread');
    if (!thread || $('ims-cnotes-panel')) return;

    const style = document.createElement('style');
    style.textContent = `
      #ims-cnotes-panel[hidden], #ims-cnotes-formbox[hidden] { display:none!important; }
      #ims-cnotes-panel { border-top:1px solid #d1d5db; padding:12px 16px; background:#fff; }
      #ims-cnotes-toggle { background:#f0fdf4; color:#065f46; border:1px solid #86efac;
        border-radius:8px; font-weight:700; padding:10px 13px; cursor:pointer; }
      #ims-cnotes-toggle:disabled { opacity:.5; cursor:not-allowed; }
      #ims-cnotes-formbox { margin-top:12px; padding:13px; background:#f8fafc;
        border:1px solid #e2e8f0; border-radius:9px; }
      #ims-cnotes-form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      #ims-cnotes-form label { display:block; font-size:12px; font-weight:700; margin-bottom:5px; }
      #ims-cnotes-form input, #ims-cnotes-form textarea { display:block; width:100%; box-sizing:border-box;
        background:#fff; border:1px solid #cbd5e1; border-radius:7px; padding:10px;
        font:inherit; font-size:13px; }
      #ims-cnotes-form textarea { min-height:90px; resize:vertical; }
      #ims-cnotes-form .ims-cnotes-wide { grid-column:1/-1; }
      #ims-cnotes-form button { cursor:pointer; padding:9px 13px; border-radius:8px;
        border:1px solid #94a3b8; background:#fff; font-weight:600; }
      #ims-cnotes-save { background:#047857!important; color:#fff; border-color:#047857!important; }
      #ims-cnotes-form button:disabled { opacity:.5; cursor:not-allowed; }
      #ims-cnotes-status { font-size:12px; color:#475569; margin:10px 0 0;
        white-space:pre-wrap; overflow-wrap:anywhere; }
      @media(max-width:600px) { #ims-cnotes-form { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.id = 'ims-cnotes-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <button id="ims-cnotes-toggle" type="button" aria-expanded="false">📝 Customer Notes</button>
      <div id="ims-cnotes-formbox" hidden>
        <form id="ims-cnotes-form" novalidate>
          <div class="ims-cnotes-wide">
            <label for="ims-cnotes-name">Customer Name</label>
            <input id="ims-cnotes-name" maxlength="160" autocomplete="off" />
          </div>
          <div>
            <label for="ims-cnotes-salary">Monthly Salary (₹)</label>
            <input id="ims-cnotes-salary" inputmode="decimal" placeholder="e.g. 85000" autocomplete="off" />
          </div>
          <div>
            <label for="ims-cnotes-emi">Existing Monthly EMI (₹)</label>
            <input id="ims-cnotes-emi" inputmode="decimal" placeholder="e.g. 18000" autocomplete="off" />
          </div>
          <div class="ims-cnotes-wide">
            <label for="ims-cnotes-stage">Customer Status (notes only)</label>
            <input id="ims-cnotes-stage" maxlength="80" list="ims-cnotes-status-choices"
                   placeholder="e.g. Interested, Follow Up, Login" autocomplete="off" />
            <datalist id="ims-cnotes-status-choices">
              <option value="Interested"></option><option value="Follow Up"></option>
              <option value="Callback"></option><option value="Login"></option>
              <option value="Disbursed"></option><option value="Not Interested"></option>
            </datalist>
          </div>
          <div class="ims-cnotes-wide">
            <label for="ims-cnotes-remarks">Remarks / Notes (maximum 3000 characters)</label>
            <textarea id="ims-cnotes-remarks" maxlength="3000"
                      placeholder="Customer ki zaroori information yahan save karo..."></textarea>
          </div>
          <div class="ims-cnotes-wide">
            <button id="ims-cnotes-save" type="submit">Save Details</button>
            <button id="ims-cnotes-reload" type="button">Reload Saved Notes</button>
          </div>
        </form>
        <p id="ims-cnotes-status" role="status" aria-live="polite"></p>
      </div>
    `;

    // Place beside the existing Admin WhatsApp Chat Reply, without editing its script.
    const replyPanel = $('ims-general-chat-reply');
    if (replyPanel && replyPanel.parentElement === thread) {
      thread.insertBefore(panel, replyPanel);
    } else {
      thread.appendChild(panel);
    }

    const toggle = $('ims-cnotes-toggle');
    const formbox = $('ims-cnotes-formbox');
    const form = $('ims-cnotes-form');
    const status = $('ims-cnotes-status');
    const save = $('ims-cnotes-save');
    const reload = $('ims-cnotes-reload');
    const fields = {
      customer_name: $('ims-cnotes-name'),
      monthly_salary: $('ims-cnotes-salary'),
      existing_emi: $('ims-cnotes-emi'),
      customer_status: $('ims-cnotes-stage'),
      remarks: $('ims-cnotes-remarks')
    };
    const state = { id: null, revision: 0, busy: false, loaded: false };

    const active = (id, revision) =>
      state.id === id && state.revision === revision && getSelectedId() === id;
    const setStatus = message => { status.textContent = message; };

    function setBusy(busy) {
      state.busy = busy;
      Object.values(fields).forEach(field => { field.disabled = busy; });
      save.disabled = busy;
      reload.disabled = busy;
      toggle.disabled = busy;
    }

    function fill(record = {}) {
      for (const [key, field] of Object.entries(fields)) {
        field.value = record[key] == null ? '' : String(record[key]);
      }
    }

    function syncSelected() {
      const id = getSelectedId();
      if (id === state.id) return;
      state.id = id;
      state.revision += 1;
      state.busy = false;
      state.loaded = false;
      panel.hidden = !id;
      formbox.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.disabled = !id;
      fill();
      setStatus('');
      Object.values(fields).forEach(field => { field.disabled = false; });
      save.disabled = !id;
      reload.disabled = !id;
    }

    function amountValid(input) {
      return !input || /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(input);
    }

    async function load() {
      syncSelected();
      const id = state.id;
      if (!id || state.busy) return;
      const revision = state.revision;
      setBusy(true);
      setStatus('Loading saved customer notes...');
      try {
        const result = await api('customer_notes_get', { conversation_id: id });
        if (!active(id, revision)) return;
        fill(result.customer_notes || {});
        state.loaded = true;
        setStatus('Saved details loaded. Notes CRM ke andar private hain; WhatsApp par nahi jayenge.');
      } catch (error) {
        if (active(id, revision)) setStatus('Could not load notes: ' + error.message);
      } finally {
        if (active(id, revision)) setBusy(false);
      }
    }

    toggle.addEventListener('click', () => {
      syncSelected();
      if (!state.id || state.busy) return;
      formbox.hidden = !formbox.hidden;
      toggle.setAttribute('aria-expanded', String(!formbox.hidden));
      if (!formbox.hidden && !state.loaded) load();
    });

    reload.addEventListener('click', () => {
      if (state.busy) return;
      if (confirm('Reload saved notes? Unsaved edits will be lost.')) load();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      syncSelected();
      const id = state.id;
      if (!id || state.busy || formbox.hidden || !state.loaded) {
        setStatus('Open and load notes before saving.');
        return;
      }

      const record = Object.fromEntries(Object.entries(fields)
        .map(([name, field]) => [name, field.value.trim()]));
      if (!amountValid(record.monthly_salary) || !amountValid(record.existing_emi)) {
        setStatus('Salary aur EMI 0 ya positive amount honi chahiye (max 2 decimals).');
        return;
      }
      if (record.customer_name.length > 160 || record.customer_status.length > 80 ||
          record.remarks.length > 3000) {
        setStatus('Customer details maximum length exceeded.');
        return;
      }
      const revision = state.revision;
      setBusy(true);
      setStatus('Saving customer notes in CRM...');
      try {
        const result = await api('customer_notes_save', {
          conversation_id: id,
          ...record
        });
        if (!active(id, revision)) return;
        fill(result.customer_notes || {});
        state.loaded = true;
        setStatus('Customer details saved successfully. Koi WhatsApp message send nahi hua.');
      } catch (error) {
        if (active(id, revision)) setStatus('Save failed: ' + error.message);
      } finally {
        if (active(id, revision)) setBusy(false);
      }
    });

    // Existing inbox changes selectedId; track selection without modifying its code.
    setInterval(syncSelected, 800);
    syncSelected();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
