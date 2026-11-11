
/* IMS WhatsApp Campaign - Step 107: Admin-only owner reply UI.
 * Applies ONLY to TEST002 / mobile ending 3794, in Chat Leads or Call Leads.
 * Actual eligibility and recipient are ALWAYS rechecked by ims-whatsapp-admin.
 * No automatic sending, no bulk campaigns, no employee/customer reminders.
 */
(() => {
  'use strict';
  if (window.__imsStep107OwnerReplyLoaded) return;
  window.__imsStep107OwnerReplyLoaded = true;

  const $ = (id) => document.getElementById(id);
  const view = { chat: null, call: null };
  const state = {
    enabled: false,
    verified: { chat: null, call: null },
    lastSelected: { chat: null, call: null },
    pending: { chat: false, call: false },
    previewed: { chat: null, call: null },
  };
  const css = document.createElement('style');
  css.textContent = `
    .ims-rp-panel{margin:14px;padding:15px;border:1px solid #99d5c7;border-radius:12px;background:#f7fffc;color:#0f172a;font:14px/1.5 Arial,sans-serif}
    .ims-rp-panel[hidden]{display:none!important}
    #chatTab .action-preview[hidden]{display:none!important}
    .ims-rp-panel h4{font-size:16px;margin:0 0 6px}
    .ims-rp-help{color:#475569;font-size:12px;margin:0 0 12px}
    .ims-rp-panel textarea{display:block;width:100%;box-sizing:border-box;min-height:85px;resize:vertical;border:1px solid #94a3b8;border-radius:8px;padding:10px;font:inherit;background:#fff}
    .ims-rp-counter{font-size:12px;color:#64748b;text-align:right;margin:3px 0 10px}
    .ims-rp-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center}
    .ims-rp-btn{padding:9px 13px;border:1px solid #a5b4c2;border-radius:8px;background:white;cursor:pointer;font:600 13px Arial,sans-serif}
    .ims-rp-send{background:#087b69;color:white;border-color:#087b69}
    .ims-rp-btn:disabled{opacity:.48;cursor:not-allowed}
    .ims-rp-status{white-space:pre-wrap;overflow-wrap:anywhere;margin:9px 0 0;font-size:12px;color:#334155}
    .ims-rp-warn{background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:8px;margin-top:9px;font-size:12px}
    .ims-rp-status[data-tone="error"]{color:#991b1b}
    .ims-rp-status[data-tone="success"]{color:#047857;font-weight:700}
  `;
  document.head.appendChild(css);

  function getClient() {
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    return window.supabaseClient || null;
  }
  function selectedId(type) {
    try {
      if (typeof inboxState === 'undefined') return null;
      return inboxState?.[type]?.selectedId || null;
    } catch (_) { return null; }
  }
  function isOwnerTest(conversation) {
    const m = String(conversation?.mobile || '').replace(/\D/g, '');
    return String(conversation?.lead_id || '').trim().toUpperCase() === 'TEST002' &&
      /^91[6-9][0-9]{9}$/.test(m) && m.endsWith('3794');
  }
  function keyFor(id) { return 'ims_wa_step107_reply_attempt_' + id; }
  function previousAttempt(id) {
    try { return localStorage.getItem(keyFor(id)) !== null; }
    catch (_) { return false; }
  }
  function rememberAttempt(id) {
    // Written before sending. If server outcome is uncertain, this prevents a
    // second accidental click/reload resend until the admin reconciles manually.
    try {
      localStorage.setItem(keyFor(id), JSON.stringify({attempted_at:new Date().toISOString()}));
    } catch (_) { /* In-memory state still blocks repeats in this tab. */ }
  }
  async function invoke(action, payload = {}) {
    const client = getClient();
    if (!client?.functions?.invoke) throw new Error('Supabase configuration is unavailable');
    const { data, error } = await client.functions.invoke('ims-whatsapp-admin', {
      body: { action, ...payload },
    });
    if (error) {
      let message = error.message || 'Request failed';
      try { const json = await error.context?.json?.(); if (json?.error) message = String(json.error); }
      catch (_) { /* Generic HTTP error */ }
      throw new Error(message);
    }
    if (!data || data.success !== true || data.admin !== true) {
      throw new Error(data?.error || 'Server did not verify Admin access');
    }
    return data;
  }
  function el(tag, klass, text) {
    const node = document.createElement(tag);
    if (klass) node.className = klass;
    if (text != null) node.textContent = text;
    return node;
  }
  function setStatus(type, message, tone = '') {
    const p = view[type]?.status;
    if (!p) return;
    p.textContent = message;
    p.dataset.tone = tone;
  }
  function resetPreview(type) {
    state.previewed[type] = null;
    updateButtons(type);
  }
  function updateButtons(type) {
    const v = view[type];
    if (!v || v.panel.hidden) return;
    const id = selectedId(type);
    const text = v.textarea.value.trim();
    const locked = previousAttempt(id) || state.pending[type] || (Boolean(v.attemptedId) && v.attemptedId === id);
    v.counter.textContent = `${v.textarea.value.length} / 1000`;
    v.preview.disabled = locked || !id || !text || text.length > 1000;
    v.send.disabled = locked || !state.enabled || !id ||
      !state.previewed[type] || state.previewed[type].id !== id ||
      state.previewed[type].text !== text;
    if (locked) {
      v.send.disabled = true;
      v.preview.disabled = true;
    }
  }
  function setOwnerPanel(type, verified) {
    const v = view[type];
    if (!v) return;
    const id = selectedId(type);
    v.panel.hidden = !verified;
    const oldChatPreview = type === 'chat' ? $('chatTab')?.querySelector('.action-preview') : null;
    if (oldChatPreview) oldChatPreview.hidden = !!verified;
    if (!verified) {
      resetPreview(type);
      return;
    }
    if (previousAttempt(id) || v.attemptedId === id) {
      setStatus(type, 'A reply attempt has already been made for TEST002 from this browser. Do NOT resend until the attempt is reconciled.', 'error');
    } else if (!state.enabled) {
      setStatus(type, 'Owner reply is OFF in Supabase secrets. Preview works, but live sending stays disabled.');
    } else {
      setStatus(type, 'TEST002 selected. Write a message, check eligibility, and manually confirm to send one real WhatsApp reply.');
    }
    updateButtons(type);
  }

  async function onSelectionChanged(type, id) {
    state.lastSelected[type] = id;
    state.verified[type] = null;
    state.previewed[type] = null;
    const v = view[type];
    if (v) { v.textarea.value = ''; v.attemptedId = null; }
    setOwnerPanel(type, false);
    if (!id) return;
    try {
      const answer = await invoke('inbox_thread', { inbox_type:type, conversation_id:id });
      if (selectedId(type) !== id || state.lastSelected[type] !== id) return;
      if (answer.read_only !== true || !answer.conversation) return;
      if (!isOwnerTest(answer.conversation)) return;
      state.verified[type] = id;
      setOwnerPanel(type, true);
    } catch (_) {
      // Fail closed. Other customers and expired sessions never get the send UI.
    }
  }
  async function checkPreview(type) {
    const v = view[type];
    const id = selectedId(type);
    const message = v.textarea.value.trim();
    if (state.verified[type] !== id || !id || !message || message.length > 1000) return;
    resetPreview(type);
    state.pending[type] = true;
    updateButtons(type);
    setStatus(type, 'Checking customer-service window and STOP eligibility...');
    try {
      const result = await invoke('chat_reply_preview', {conversation_id:id, message});
      if (selectedId(type) !== id || v.textarea.value.trim() !== message) return;
      if (result.preview_only !== true || result.sending_enabled !== false) throw new Error('Unexpected preview response');
      const eligible = result.eligible_for_manual_review === true &&
        result.within_customer_service_window === true &&
        result.marketing_stop_blocked === false;
      if (!eligible) {
        setStatus(type, 'Not eligible: STOP active or verified 24-hour customer-service window is closed. No reply will be sent.', 'error');
        return;
      }
      state.previewed[type] = {id, text:message};
      setStatus(type, state.enabled ?
        'Eligible for owner TEST002 test. Press Send Reply and confirm to send a REAL WhatsApp message.' :
        'Eligibility OK, but owner-test sending is OFF in Supabase. No message will be sent.', state.enabled ? 'success' : '');
    } catch (err) {
      if (selectedId(type) === id) setStatus(type, 'Preview failed: ' + err.message, 'error');
    } finally {
      state.pending[type] = false;
      updateButtons(type);
    }
  }
  async function sendOnce(type) {
    const v = view[type];
    const id = selectedId(type);
    const message = v.textarea.value.trim();
    const preview = state.previewed[type];
    if (!state.enabled || state.pending[type] || state.verified[type] !== id ||
      !preview || preview.id !== id || preview.text !== message ||
      previousAttempt(id) || v.attemptedId === id) return;
    if (!window.crypto?.randomUUID) {
      setStatus(type, 'Secure browser UUID generation unavailable. Sending blocked.', 'error');
      return;
    }
    if (!window.confirm('Send this REAL WhatsApp reply to TEST002 (****3794)? This cannot be undone.')) return;
    if (selectedId(type) !== id || v.textarea.value.trim() !== message) return;
    const requestKey = window.crypto.randomUUID();
    v.attemptedId = id;
    rememberAttempt(id);
    state.pending[type] = true;
    resetPreview(type);
    updateButtons(type);
    setStatus(type, 'One-time reply request submitted. Do not retry if the result is uncertain...');
    try {
      // The server independently verifies Admin JWT, TEST002 allowlist,
      // Meta 24-hour window, STOP status and unique request_key.
      const answer = await invoke('send_chat_reply', {
        conversation_id:id, message, request_key:requestKey,
      });
      if (answer.provider_accepted !== true || !answer.attempt_id) {
        throw new Error('Meta acceptance was not confirmed');
      }
      setStatus(type, 'Meta ACCEPTED this WhatsApp reply. Delivery is NOT confirmed. Use Refresh Inbox to see it; do not send again.', 'success');
    } catch (err) {
      setStatus(type, 'Reply outcome needs review: ' + err.message + '\nDo NOT retry. Check Admin reply attempts and Meta delivery first.', 'error');
    } finally {
      state.pending[type] = false;
      updateButtons(type);
    }
  }
  function createPanel(type) {
    const tab = $(type + 'Tab');
    const thread = tab?.querySelector('.inbox-thread');
    if (!thread) return;
    const panel = el('section', 'ims-rp-panel');
    panel.id = `ims-rp-${type}`;
    panel.hidden = true;
    panel.append(
      el('h4', '', 'Admin WhatsApp Reply — TEST002 Only'),
      el('p', 'ims-rp-help', 'Owner test only (mobile ****3794). This sends a REAL free-form message only inside Meta\'s verified 24-hour window. No bulk send or employee access.'),
    );
    const label = el('label', '', 'Your reply (1–1000 characters)');
    const textarea = el('textarea');
    textarea.maxLength = 1000;
    textarea.placeholder = 'Type an Admin reply to TEST002...';
    label.append(textarea);
    const counter = el('div', 'ims-rp-counter', '0 / 1000');
    const actions = el('div', 'ims-rp-actions');
    const preview = el('button', 'ims-rp-btn', 'Check Eligibility');
    preview.type = 'button';
    preview.disabled = true;
    const send = el('button', 'ims-rp-btn ims-rp-send', 'Send Reply (TEST002)');
    send.type = 'button';
    send.disabled = true;
    actions.append(preview,send);
    const status = el('p', 'ims-rp-status', 'Select TEST002 to begin.');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const warn = el('div', 'ims-rp-warn', 'No automatic retry. A timeout might still mean Meta accepted the message. This page only supports the verified TEST002 owner test.');
    panel.append(label,counter,actions,status,warn);
    thread.append(panel);
    view[type] = {panel,textarea,counter,preview,send,status,attemptedId:null};
    textarea.addEventListener('input', () => {
      resetPreview(type);
      setStatus(type, 'Message changed. Check eligibility again before sending.');
      updateButtons(type);
    });
    preview.addEventListener('click',()=>checkPreview(type));
    send.addEventListener('click',()=>sendOnce(type));
  }
  async function initialize() {
    if (!$('chatTab') || !$('callTab')) return;
    createPanel('chat');
    createPanel('call');
    try {
      const client = getClient();
      if (!client?.auth?.getUser) return;
      const {data, error} = await client.auth.getUser();
      if (error || !data?.user) return;
      const status = await invoke('status');
      state.enabled = status.owner_test_reply_enabled === true;
      // The selected Inbox is controlled by the existing CRM. Observe it
      // without changing any of the CRM's existing event listeners.
      for (const type of ['chat','call']) {
        onSelectionChanged(type,selectedId(type));
      }
      setInterval(() => {
        for (const type of ['chat','call']) {
          const id = selectedId(type);
          if (id !== state.lastSelected[type]) onSelectionChanged(type,id);
        }
      }, 1000);
    } catch (_) {
      // Server-verified Admin access is required. Fail closed.
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
