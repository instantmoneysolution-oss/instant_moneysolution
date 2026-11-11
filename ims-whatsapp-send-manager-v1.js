
/* IMS WhatsApp Campaign - Step 110 Send Manager.
   Admin-authenticated calls only.
   No automatic sends on page load.
   All recipient checks remain in Supabase.
*/
(() => {
  'use strict';

  if (window.imsSendManager109) return;
  window.imsSendManager109 = true;

  const $ = id => document.getElementById(id);

  const state = {
    busy: false,
    stop: false,
    report: null,
    selected: ''
  };

  async function request(action, payload = {}) {
    if (typeof supabaseClient === 'undefined') {
      throw new Error('Supabase configuration unavailable');
    }

    const { data, error } =
      await supabaseClient.functions.invoke(
        'ims-whatsapp-admin',
        { body: { action, ...payload } }
      );

    if (error) {
      let message = error.message || 'Backend request failed';

      try {
        const details = await error.context?.json?.();
        if (details?.error) message = details.error;
      } catch (_) {}

      throw new Error(message);
    }

    if (!data || data.success !== true || data.admin !== true) {
      throw new Error(data?.error || 'Admin authorization failed');
    }

    return data;
  }

  function notice(message) {
    $('ims-send-notice').textContent = message;
  }

  function setButtons() {
    const report = state.report;
    const active = Boolean($('reportCampaign')?.value);

    $('ims-send-refresh').disabled =
      state.busy || !active;

    $('ims-send-start').disabled =
      state.busy ||
      !report?.can_start ||
      !report?.has_eligible_test;

    $('ims-send-run').disabled =
      state.busy || !report?.can_send;

    $('ims-send-stop').disabled = !state.busy;

    $('ims-send-quantity').disabled = state.busy;
  }

  async function refresh() {
    if (state.busy) return;

    const id = $('reportCampaign')?.value;

    state.selected = id || '';
    state.report = null;

    if (!id) {
      notice('Select a saved campaign first.');
      setButtons();
      return;
    }

    state.busy = true;
    setButtons();
    notice('Checking campaign status...');

    try {
      const r = await request(
        'campaign_sender_status',
        { campaign_id: id }
      );

      let eligible = false;

      if (
        r.campaign_status === 'draft' &&
        r.template_ready &&
        r.pending_contacts > 0
      ) {
        let page = 0;

        while (true) {
          const d = await request(
            'dry_run_campaign',
            { campaign_id: id, page }
          );

          if ((d.eligible_in_page_for_review || 0) > 0) {
            eligible = true;
            break;
          }

          if (!d.has_more ||
              !Number.isSafeInteger(d.next_page)) {
            break;
          }

          page = d.next_page;
        }
      }

      if ($('reportCampaign').value !== id) return;

      r.has_eligible_test = eligible;
      state.report = r;

      $('ims-send-info').textContent =
        `Campaign: ${r.campaign_name} | ` +
        `Status: ${r.campaign_status} | ` +
        `Pending: ${r.pending_contacts} | ` +
        `Unresolved: ${r.unresolved_attempts}`;

      if (!r.sending_enabled) {
        notice('Sending switch is OFF in Supabase.');
      } else if (!r.template_ready) {
        notice('Template is not ready.');
      } else if (r.unresolved_attempts) {
        notice('Unresolved send attempt. Review required.');
      } else if (r.can_start && !eligible) {
        notice('No eligible recipient found in dry run.');
      } else if (r.can_start) {
        notice('Ready. Click Start Campaign.');
      } else if (r.can_send) {
        notice('Choose quantity and click Send Selected.');
      } else {
        notice('No pending eligible messages or campaign cannot start.');
      }

    } catch (e) {
      notice('Status check failed: ' + e.message);
    } finally {
      state.busy = false;
      setButtons();
    }
  }

  async function start() {
    const id = $('reportCampaign').value;

    if (
      !state.report?.can_start ||
      !state.report?.has_eligible_test ||
      state.busy
    ) return;

    if (!confirm(
      'Start this WhatsApp campaign? No messages will be sent yet.'
    )) return;

    state.busy = true;
    setButtons();

    try {
      await request('campaign_start', {
        campaign_id: id,
        confirmation: 'START_WHATSAPP_CAMPAIGN'
      });

      notice('Campaign started. No message sent yet.');
    } catch (e) {
      notice('Start failed: ' + e.message);
    } finally {
      state.busy = false;
      await refresh();
    }
  }

  async function sendSelected() {
    const id = $('reportCampaign').value;
    const count = Number($('ims-send-quantity').value);

    if (!state.report?.can_send || state.busy) return;

    if (
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > state.report.pending_contacts
    ) {
      notice('Enter a valid quantity.');
      return;
    }

    if (!confirm(
      `Send up to ${count} REAL WhatsApp messages? ` +
      'Meta charges may apply.'
    )) return;

    state.busy = true;
    state.stop = false;
    setButtons();

    let accepted = 0;
    let reason = '';

    try {
      for (
        let i = 0;
        i < count && !state.stop;
        i++
      ) {
        notice(
          `Processing ${i + 1}/${count}. ` +
          `Meta accepted: ${accepted}`
        );

        const result = await request(
          'campaign_send_one',
          {
            campaign_id: id,
            confirmation: 'SEND_ONE_CAMPAIGN_MESSAGE'
          }
        );

        if (result.outcome === 'accepted') {
          accepted++;
          continue;
        }

        reason =
          `Stopped: ${result.outcome || 'no eligible recipient'}.`;
        break;
      }
    } catch (e) {
      reason =
        `Stopped after ${accepted} acceptance(s): ${e.message}. ` +
        'Do not retry uncertain messages.';
    } finally {
      const stopped = state.stop;

      state.busy = false;
      state.stop = false;

      await refresh();

      notice(
        `${accepted} message(s) accepted by Meta. ` +
        'Delivery not confirmed. ' +
        (reason ||
          (stopped
            ? 'Stopped by Admin.'
            : 'Selected quantity processed.'))
      );

      const btn = $('refreshReportBtn');

      if (btn && !btn.disabled) btn.click();
    }
  }

  function init() {
    const toolbar =
      document.querySelector('#campaignTab .report-toolbar');

    const campaign = $('reportCampaign');

    if (!toolbar || !campaign) return;

    const box = document.createElement('section');

    box.id = 'ims-send-manager';

    box.style.cssText =
      'margin:16px 0;padding:16px;' +
      'border:1px solid #cbd5e1;' +
      'border-radius:10px;background:#f8fafc';

    box.innerHTML = `
      <h3>WhatsApp Campaign Send Manager</h3>
      <p id="ims-send-info">
        Choose a saved campaign above.
      </p>

      <div style="display:flex;gap:9px;
                  align-items:end;flex-wrap:wrap;
                  margin:12px 0">

        <button type="button" id="ims-send-refresh">
          Check Status
        </button>

        <button type="button"
                id="ims-send-start" disabled>
          Start Campaign
        </button>

        <label>
          Messages to Send
          <input id="ims-send-quantity"
                 type="number"
                 min="1"
                 step="1"
                 value="1"
                 style="display:block;width:110px;
                        padding:8px">
        </label>

        <button type="button"
                id="ims-send-run" disabled>
          Send Selected
        </button>

        <button type="button"
                id="ims-send-stop" disabled>
          Stop After Current
        </button>
      </div>

      <p id="ims-send-notice"
         role="status"
         style="white-space:pre-wrap;font-weight:600">
        Sending remains OFF until activated.
      </p>
    `;

    toolbar.insertAdjacentElement('afterend', box);

    campaign.addEventListener('change', () => {
      state.stop = true;
      if (!state.busy) refresh();
    });

    $('ims-send-refresh').addEventListener('click', refresh);
    $('ims-send-start').addEventListener('click', start);
    $('ims-send-run').addEventListener('click', sendSelected);

    $('ims-send-stop').addEventListener('click', () => {
      state.stop = true;
      notice(
        'Stop requested. Current request may finish.'
      );
    });

    const observe = new MutationObserver(() => {
      if (
        !state.busy &&
        campaign.value &&
        campaign.value !== state.selected
      ) {
        refresh();
      }
    });

    observe.observe(campaign, { childList: true });

    refresh();
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
