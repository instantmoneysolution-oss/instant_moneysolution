
/* IMS WhatsApp Step 116: General Admin Chat Replies.
   Existing Call Leads and Callback remain unchanged.
   No automatic sends. Server verifies every message.
*/
(() => {
  'use strict';

  if (window.__imsGeneralChatReply116) return;
  window.__imsGeneralChatReply116 = true;

  const $ = id => document.getElementById(id);

  const state = {
    id: null,
    mobile: '',
    verified: false,
    busy: false,
    preview: null
  };

  const key = id => 'ims_wa_general_reply_unresolved_' + id;

  function isLocked(id) {
    try {
      return !!id && localStorage.getItem(key(id)) !== null;
    } catch (_) {
      return false;
    }
  }

  function selectedId() {
    try {
      return typeof inboxState !== 'undefined'
        ? inboxState.chat?.selectedId || null
        : null;
    } catch (_) {
      return null;
    }
  }

  function client() {
    if (typeof supabaseClient !== 'undefined')
      return supabaseClient;

    return window.supabaseClient || null;
  }

  async function api(action, payload = {}) {
    const c = client();

    if (!c?.functions?.invoke)
      throw new Error('Supabase connection unavailable');

    const { data, error } = await c.functions.invoke(
      'ims-whatsapp-admin',
      { body: { action, ...payload } }
    );

    if (error) {
      let msg = error.message || 'Request failed';

      try {
        const body = await error.context?.json?.();
        if (body?.error) msg = body.error;
      } catch (_) {}

      throw new Error(msg);
    }

    if (data?.success !== true || data?.admin !== true)
      throw new Error(data?.error || 'Admin verification failed');

    return data;
  }

  function init() {
    const tab = $('chatTab');
    const thread = tab?.querySelector('.inbox-thread');

    if (!tab || !thread) return;

    const style = document.createElement('style');

    style.textContent = `
      #ims-general-chat-reply[hidden] {
        display:none!important
      }

      .ims-general-chat-active .action-preview,
      .ims-general-chat-active .inbox-readonly,
      .ims-general-chat-active #ims-rp-chat {
        display:none!important
      }

      #ims-general-chat-reply {
        padding:16px;
        border-top:1px solid #cbd5e1;
        background:#f0fdf9
      }

      #ims-general-chat-reply textarea {
        display:block;
        width:100%;
        min-height:85px;
        box-sizing:border-box;
        padding:10px;
        border:1px solid #94a3b8;
        border-radius:8px;
        font:inherit
      }

      #ims-general-chat-reply button {
        padding:9px 12px;
        margin:8px 8px 8px 0;
        border:1px solid #94a3b8;
        border-radius:8px;
        cursor:pointer
      }

      #ims-general-chat-reply button:disabled {
        opacity:.45;
        cursor:not-allowed
      }

      #ims-general-chat-send {
        background:#047857;
        color:white
      }

      #ims-general-chat-status {
        white-space:pre-wrap;
        font-size:13px;
        overflow-wrap:anywhere
      }
    `;

    document.head.append(style);

    const panel = document.createElement('section');
    panel.id = 'ims-general-chat-reply';
    panel.hidden = true;

    panel.innerHTML = `
      <h4>Admin WhatsApp Chat Reply</h4>
      <p>Reply to the selected customer from CRM.</p>

      <label for="ims-general-chat-text">
        Your message
      </label>

      <textarea
        id="ims-general-chat-text"
        maxlength="1000"
        placeholder="Type your reply..."></textarea>

      <div>
        <button id="ims-general-chat-check"
                type="button" disabled>
          Check Eligibility
        </button>

        <button id="ims-general-chat-send"
                type="button" disabled>
          Send WhatsApp Reply
        </button>
      </div>

      <p id="ims-general-chat-status"
         role="status"
         aria-live="polite">
        Select a Chat Lead.
      </p>
    `;

    thread.append(panel);

    const input = $('ims-general-chat-text');
    const checkBtn = $('ims-general-chat-check');
    const sendBtn = $('ims-general-chat-send');
    const status = $('ims-general-chat-status');

    function note(msg) {
      status.textContent = msg;
    }

    function update() {
      const text = input.value.trim();
      const locked = isLocked(state.id);

      checkBtn.disabled =
        state.busy || !state.verified || locked || !text;

      sendBtn.disabled =
        state.busy ||
        !state.verified ||
        locked ||
        !state.preview ||
        state.preview.id !== state.id ||
        state.preview.text !== text;
    }

    input.addEventListener('input', () => {
      state.preview = null;
      note('Message changed. Check Eligibility again.');
      update();
    });

    async function onSelect(id) {
      state.id = id;
      state.mobile = '';
      state.verified = false;
      state.preview = null;

      input.value = '';
      panel.hidden = true;
      tab.classList.remove('ims-general-chat-active');

      update();

      if (!id) return;

      try {
        const result = await api('inbox_thread', {
          inbox_type: 'chat',
          conversation_id: id
        });

        if (selectedId() !== id || state.id !== id) return;

        const conv = result.conversation;
        const mobile = String(conv?.mobile || '');

        if (
          result.read_only !== true ||
          conv?.id !== id ||
          conv?.conversation_status !== 'chat' ||
          !/^91[6-9][0-9]{9}$/.test(mobile)
        ) return;

        state.verified = true;
        state.mobile = mobile;

        panel.hidden = false;
        tab.classList.add('ims-general-chat-active');

        note(
          isLocked(id)
            ? 'Earlier reply outcome may be uncertain. Review before resending.'
            : 'Write a reply, then Check Eligibility.'
        );

        update();

      } catch (_) {
        // Fail closed. Existing inbox remains available.
      }
    }

    checkBtn.addEventListener('click', async () => {
      const id = state.id;
      const text = input.value.trim();

      if (
        !id || !state.verified || !text ||
        state.busy || isLocked(id)
      ) return;

      state.busy = true;
      state.preview = null;
      update();

      note('Checking WhatsApp reply eligibility...');

      try {
        const r = await api('chat_reply_preview', {
          conversation_id: id,
          message: text
        });

        if (
          selectedId() !== id ||
          state.id !== id ||
          input.value.trim() !== text
        ) return;

        if (
          r.preview_only === true &&
          r.within_customer_service_window === true &&
          r.marketing_stop_blocked === false &&
          r.eligible_for_manual_review === true
        ) {
          state.preview = { id, text };

          note('Eligible. Press Send WhatsApp Reply.');
        } else {
          note(
            'Reply unavailable: customer-service window closed ' +
            'or STOP active. No message sent.'
          );
        }

      } catch (e) {
        if (state.id === id)
          note('Eligibility check failed: ' + e.message);

      } finally {
        state.busy = false;
        update();
      }
    });

    sendBtn.addEventListener('click', async () => {
      const id = state.id;
      const text = input.value.trim();

      if (
        !id ||
        !state.verified ||
        state.busy ||
        isLocked(id) ||
        state.preview?.id !== id ||
        state.preview?.text !== text
      ) return;

      if (!window.crypto?.randomUUID) {
        note('Secure request ID unavailable. No message sent.');
        return;
      }

      if (!confirm(
        `Send REAL WhatsApp reply to ****${state.mobile.slice(-4)}?`
      )) return;

      if (
        selectedId() !== id ||
        state.id !== id ||
        input.value.trim() !== text
      ) return;

      state.busy = true;
      state.preview = null;

      try {
        localStorage.setItem(key(id), new Date().toISOString());
      } catch (_) {}

      update();
      note('Submitting reply. Do not retry uncertain results.');

      try {
        const r = await api('send_chat_reply', {
          conversation_id: id,
          message: text,
          request_key: window.crypto.randomUUID()
        });

        if (
          r.provider_accepted !== true ||
          !r.attempt_id
        ) {
          throw new Error('Meta acceptance not confirmed');
        }

        try {
          localStorage.removeItem(key(id));
        } catch (_) {}

        if (state.id === id) {
          input.value = '';

          note(
            'Meta accepted your reply. Delivery not yet confirmed. ' +
            'You can compose the next different message.'
          );

          $('chatRefreshBtn')?.click();
        }

      } catch (e) {
        if (state.id === id) {
          note(
            'Reply outcome requires review: ' + e.message +
            '\nDo NOT resend this request.'
          );
        }

      } finally {
        state.busy = false;
        update();
      }
    });

    setInterval(() => {
      const id = selectedId();

      if (id !== state.id)
        onSelect(id);

    }, 850);

    onSelect(selectedId());
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
