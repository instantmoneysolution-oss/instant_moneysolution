/* IMS WhatsApp CRM V2 — lead stage navigation and one-click move.
   Backend actions: lead_stage_list, lead_stage_move, inbox_thread.
   No WhatsApp messages sent. Existing chat history and customer notes retained.
   Replaces ims-whatsapp-follow-up-v2.js (old scheduled Follow Up form).
*/
(() => {
  'use strict';
  if (window.__imsLeadStagesV2) return;
  window.__imsLeadStagesV2 = true;

  const $ = id => document.getElementById(id);
  const STAGES = {
    chat: { button: 'ims-stage-chat', title: 'Chat Leads' },
    follow_up: { button: 'ims-stage-followup', title: 'Follow Up Chats' },
    not_interested: { button: 'ims-stage-ni', title: 'Not Interested Chats' }
  };

  function init() {
    const thread = document.querySelector('#chatTab .inbox-thread');
    if (!thread || !$('ims-stage-tabs') || $('ims-lead-move-panel')) return;
    if (typeof inboxState === 'undefined' || !inboxState.chat ||
        typeof adminRequest !== 'function' || typeof loadInbox !== 'function' ||
        typeof renderInboxList !== 'function' || typeof openInboxThread !== 'function' ||
        typeof inboxSetThreadPlaceholder !== 'function') return;

    const state = inboxState.chat;
    let stage = 'chat';
    let requestSeq = 0;
    let moving = false;
    let previousSelectedId = null;
    let previousStage = null;

    const panel = document.createElement('section');
    panel.id = 'ims-lead-move-panel';
    panel.hidden = true;
    panel.style.cssText = 'border-top:1px solid #d1d5db;padding:12px 16px;background:#fff;';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:9px">
        <button type="button" id="ims-move-followup"
          style="padding:10px 13px;border-radius:8px;border:1px solid #a5b4fc;background:#eef2ff;color:#3730a3;font-weight:700;cursor:pointer">
          📅 Follow Up
        </button>
        <button type="button" id="ims-move-ni"
          style="padding:10px 13px;border-radius:8px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-weight:700;cursor:pointer">
          🚫 Not Interested
        </button>
      </div>
      <p id="ims-move-status" role="status" aria-live="polite"
         style="font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0 0;color:#475569"></p>
    `;

    const notes = $('ims-cnotes-panel');
    if (notes && notes.parentElement === thread) notes.after(panel);
    else thread.appendChild(panel);

    const moveFollowUp = $('ims-move-followup');
    const moveNI = $('ims-move-ni');
    const message = $('ims-move-status');
    const buttons = Object.fromEntries(Object.keys(STAGES).map(k => [k, $(STAGES[k].button)]));

    function updateNavigation() {
      Object.entries(buttons).forEach(([key, button]) => {
        if (!button) return;
        button.disabled = moving;
        button.classList.toggle('btn-primary', key === stage);
        button.setAttribute('aria-pressed', String(key === stage));
      });
    }

    function updateMovePanel() {
      const id = state.selectedId || null;
      panel.hidden = stage !== 'chat' || !id;
      moveFollowUp.disabled = moving || stage !== 'chat' || !id;
      moveNI.disabled = moving || stage !== 'chat' || !id;
      if (id !== previousSelectedId || stage !== previousStage) {
        message.textContent = '';
        previousSelectedId = id;
        previousStage = stage;
      }
    }

    function setMoving(value) {
      moving = value;
      updateNavigation();
      updateMovePanel();
    }

    async function loadStagePage(requestedPage, preferredId = null) {
      if (stage === 'chat') return;
      const requestedStage = stage;
      const seq = ++requestSeq;
      // Invalidate an in-flight original Chat Leads response.
      ++state.listSeq;
      ++state.threadSeq;
      state.selectedId = null;
      state.page = requestedPage;
      state.hasMore = false;
      $('chatStatus').textContent = 'Loading ' + STAGES[stage].title + '...';
      $('chatRefreshBtn').disabled = true;
      $('chatPrevBtn').disabled = true;
      $('chatNextBtn').disabled = true;
      $('chatList').replaceChildren();
      inboxSetThreadPlaceholder('chat', 'Loading conversations...');
      updateMovePanel();
      try {
        const result = await adminRequest('lead_stage_list', {
          stage: requestedStage, page: requestedPage
        });
        if (seq !== requestSeq || stage !== requestedStage) return;
        if (result.read_only !== true || result.sending_enabled !== false ||
            result.stage !== requestedStage || !Array.isArray(result.conversations)) {
          throw new Error('Unexpected lead section response');
        }
        const rows = result.conversations;
        state.hasMore = result.has_more === true;
        state.selectedId = rows.some(c => c.id === preferredId) ? preferredId : (rows[0]?.id || null);
        $('chatPage').textContent = 'Page ' + (requestedPage + 1);
        $('chatPrevBtn').disabled = requestedPage === 0;
        $('chatNextBtn').disabled = !state.hasMore;
        $('chatStatus').textContent = STAGES[stage].title + ': ' + rows.length + ' conversation(s) on this page';
        renderInboxList('chat', rows);
        if (state.selectedId) await openInboxThread('chat', state.selectedId, rows);
        else {
          $('chatList').replaceChildren();
          const blank = document.createElement('div');
          blank.className = 'inbox-blank';
          blank.textContent = 'No conversations in ' + STAGES[stage].title + '.';
          $('chatList').appendChild(blank);
          inboxSetThreadPlaceholder('chat', 'No conversation selected.');
        }
      } catch (error) {
        if (seq !== requestSeq || stage !== requestedStage) return;
        state.selectedId = null;
        $('chatStatus').textContent = 'Unable to load ' + STAGES[stage].title + ': ' +
          (error.message || 'Unknown error');
        const blank = document.createElement('div');
        blank.className = 'inbox-blank';
        blank.textContent = 'Could not load conversations. Click Refresh Inbox to retry.';
        $('chatList').replaceChildren(blank);
        inboxSetThreadPlaceholder('chat', 'No conversation loaded.');
      } finally {
        if (seq === requestSeq && stage === requestedStage) {
          $('chatRefreshBtn').disabled = false;
          updateMovePanel();
        }
      }
    }

    async function chooseStage(nextStage, preferredId = null) {
      if (!(nextStage in STAGES) || moving) return;
      // Avoid a stale stage-specific request showing rows in the wrong section.
      ++requestSeq;
      stage = nextStage;
      updateNavigation();
      if (stage === 'chat') {
        state.selectedId = null;
        state.page = 0;
        updateMovePanel();
        await loadInbox('chat', 0);
      } else {
        await loadStagePage(0, preferredId);
      }
    }

    async function moveTo(targetStage) {
      const id = state.selectedId;
      if (moving || stage !== 'chat' || !id) return;
      if (!window.confirm('Move this customer to ' + STAGES[targetStage].title +
        '?\nThe WhatsApp conversation and Customer Notes will be kept. No message will be sent.')) return;
      if (stage !== 'chat' || state.selectedId !== id) return;
      setMoving(true);
      message.textContent = 'Moving conversation...';
      try {
        const result = await adminRequest('lead_stage_move', {
          conversation_id: id, target_stage: targetStage
        });
        if (result.whatsapp_sent !== false || result.lead?.stage !== targetStage ||
            result.lead?.conversation_id !== id) {
          throw new Error('Unexpected move response; refresh before trying again.');
        }
        setMoving(false);
        await chooseStage(targetStage, id);
      } catch (error) {
        setMoving(false);
        if (stage === 'chat' && state.selectedId === id) {
          message.textContent = 'Move failed: ' + (error.message || 'Unknown error');
        } else {
          $('chatStatus').textContent = 'Move or load issue: ' + (error.message || 'Unknown error');
        }
      }
    }

    Object.entries(buttons).forEach(([key, button]) => {
      if (!button) return;
      button.disabled = false;
      button.addEventListener('click', () => chooseStage(key));
    });
    moveFollowUp.addEventListener('click', () => moveTo('follow_up'));
    moveNI.addEventListener('click', () => moveTo('not_interested'));

    // The CRM's existing refresh/pagination listeners always load Chat Leads.
    // Intercept them only when viewing a stage-specific list.
    const controls = [
      ['chatRefreshBtn', () => loadStagePage(state.page)],
      ['chatPrevBtn', () => state.page > 0 && loadStagePage(state.page - 1)],
      ['chatNextBtn', () => state.hasMore && loadStagePage(state.page + 1)]
    ];
    controls.forEach(([id, handler]) => {
      $(id).addEventListener('click', event => {
        if (stage === 'chat') return;
        event.stopImmediatePropagation();
        event.preventDefault();
        handler();
      }, true);
    });

    // Reset to Chat Leads when opening the top-level Chat Leads tab again.
    const navChat = document.querySelector('.tab[data-tab="chat"]');
    if (navChat) navChat.addEventListener('click', () => {
      ++requestSeq;
      stage = 'chat';
      updateNavigation();
      updateMovePanel();
    }, true);

    // Existing CRM owns selectedId. Keep move controls in sync with it.
    window.setInterval(updateMovePanel, 500);
    updateNavigation();
    updateMovePanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
