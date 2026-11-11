
/* IMS WhatsApp Campaign - One-click Send Manager.
   Admin-authenticated calls only.
   No automatic sends on page load.
   STOP, opt-in and duplicate checks remain in Supabase.
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
      throw new Error(
        data?.error || 'Admin authorization failed'
      );
    }

    return data;
  }

  function notice(message) {
    $('ims-send-notice').textContent = message;
  }

  function setButtons() {
    const r = state.report;
    const active = Boolean($('reportCampaign')?.value);

    $('ims-send-refresh').disabled = state.busy || !active;

    $('ims-send-start').disabled =
      state.busy || !r?.can_start || !r?.has_eligible_test;

    $('ims-send-run').disabled =
      state.busy || !r?.can_send;

    $('ims-send-stop').disabled = !state.busy;
    $('ims-send-quantity').disabled = state.busy;

    $('ims-send-oneclick').disabled =
      state.busy || !r ||
      !(r.can_send || (r.can_start && r.has_eligible_test));
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
      const r = await request('campaign_sender_status', {
        campaign_id: id
      });

      let eligible = false;

      if (
        r.campaign_status === 'draft' &&
        r.template_ready &&
        r.pending_contacts > 0
      ) {
        let page = 0;

        while (true) {
          const d = await request('dry_run_campaign', {
            campaign_id: id,
            page
          });

          if ((d.eligible_in_page_for_review || 0) > 0) {
            eligible = true;
            break;
          }

          if (
            !d.has_more ||
            !Number.isSafeInteger(d.next_page)
          ) break;

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
        notice('Unresolved message attempt. Review before sending.');
      } else if (r.can_start && !eligible) {
        notice('No eligible recipient found in dry run.');
      } else if (r.can_start) {
        notice('Ready. Click Send Now to start and send.');
      } else if (r.can_send) {
        notice('Ready. Click Send Now to process pending contacts.');
      } else if (
        r.campaign_status === 'running' &&
        r.pending_contacts === 0
      ) {
        notice(
          'All campaign contacts processed. Nothing left to send.'
        );
      } else {
        notice('No eligible pending messages to send.');
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
      'Start this WhatsApp campaign? ' +
      'No messages are sent by Start alone.'
    )) return;

    state.busy = true;
    setButtons();

    try {
      await request('campaign_start', {
        campaign_id: id,
        confirmation: 'START_WHATSAPP_CAMPAIGN'
      });

      notice('Campaign started.');

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
      notice('Enter a valid message quantity.');
      return;
    }

    if (!confirm(
      `Send up to ${count} REAL WhatsApp message(s)?`
    )) return;

    state.busy = true;
    state.stop = false;
    setButtons();

    let accepted = 0;
    let reason = '';

    try {
      for (let i = 0; i < count && !state.stop; i++) {
        notice(`Sending ${i + 1}/${count}...`);

        const r = await request('campaign_send_one', {
          campaign_id: id,
          confirmation: 'SEND_ONE_CAMPAIGN_MESSAGE'
        });

        if (r.outcome === 'accepted') {
          accepted++;
          continue;
        }

        reason = `Stopped: ${r.outcome || 'No eligible recipient'}`;
        break;
      }

    } catch (e) {
      reason = `Stopped: ${e.message}. Do not retry uncertain sends.`;
    } finally {
      const stopped = state.stop;

      state.busy = false;
      state.stop = false;

      await refresh();

      notice(
        `${accepted} accepted by Meta. ` +
        'Delivery not confirmed. ' +
        (reason || (stopped ? 'Stopped by Admin.' : 'Done.'))
      );

      $('refreshReportBtn')?.click();
    }
  }

  async function sendNow() {
    const id = $('reportCampaign')?.value;

    if (!id || state.busy) return;

    const report = state.report;

    if (
      !report ||
      !(report.can_send ||
        (report.can_start && report.has_eligible_test))
    ) {
      notice('Campaign has no sendable contacts.');
      return;
    }

    const maximum = Number(report.pending_contacts);

    if (!Number.isSafeInteger(maximum) || maximum < 1) return;

    if (!confirm(
      `Send up to ${maximum} eligible WhatsApp messages ` +
      `for ${report.campaign_name}?\n\n` +
      'This makes REAL paid Meta API requests.'
    )) return;

    state.busy = true;
    state.stop = false;
    setButtons();

    let accepted = 0;
    let reason = '';

    try {
      if (report.can_start) {
        await request('campaign_start', {
          campaign_id: id,
          confirmation: 'START_WHATSAPP_CAMPAIGN'
        });
      }

      for (let i = 0; i < maximum && !state.stop; i++) {
        if ($('reportCampaign')?.value !== id) {
          reason = 'Campaign selection changed. Stopped.';
          break;
        }

        notice(
          `Processing ${i + 1}/${maximum}. ` +
          `Meta accepted: ${accepted}. Keep this tab open.`
        );

        const r = await request('campaign_send_one', {
          campaign_id: id,
          confirmation: 'SEND_ONE_CAMPAIGN_MESSAGE'
        });

        if (
          r.outcome === 'accepted' &&
          r.sends_performed === 1
        ) {
          accepted++;
          continue;
        }

        if (r.outcome === 'no_eligible') {
          reason = 'No more eligible contacts.';
          break;
        }

        reason =
          `Stopped: ${r.outcome || 'Unverified result'}. ` +
          'No automatic retry.';
        break;
      }

    } catch (e) {
      reason =
        `Stopped: ${e.message}. ` +
        'Check send attempts before retrying.';
    } finally {
      const stopped = state.stop;

      state.stop = false;
      state.busy = false;

      await refresh();

      notice(
        `${accepted} message(s) accepted by Meta. ` +
        'Delivery not confirmed. ' +
        (reason ||
          (stopped ? 'Stopped by Admin.' : 'Processing finished.'))
      );

      $('refreshReportBtn')?.click();
    }
  }

  function init() {
    const toolbar = document.querySelector(
      '#campaignTab .report-toolbar'
    );

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

      <div style="display:flex;gap:9px;align-items:end;
                  flex-wrap:wrap;margin:12px 0">

        <button
          type="button"
          id="ims-send-oneclick"
          style="background:#047857;color:white;
                 border:0;border-radius:7px;
                 padding:10px 15px;font-weight:700"
          disabled>
          Send Now — All Eligible
        </button>

        <button type="button" id="ims-send-refresh">
          Check Status
        </button>

        <button type="button" id="ims-send-start" disabled>
          Start Campaign
        </button>

        <label>
          Messages to Send
          <input
            id="ims-send-quantity"
            type="number"
            min="1"
            step="1"
            value="1"
            style="display:block;width:110px;padding:8px">
        </label>

        <button type="button" id="ims-send-run" disabled>
          Send Selected
        </button>

        <button type="button" id="ims-send-stop" disabled>
          Stop After Current
        </button>
      </div>

      <p id="ims-send-notice"
         role="status"
         style="white-space:pre-wrap;font-weight:600">
        Checking campaign status...
      </p>
    `;

    toolbar.insertAdjacentElement('afterend', box);

    campaign.addEventListener('change', () => {
      state.stop = true;
      if (!state.busy) refresh();
    });

    $('ims-send-refresh').addEventListener('click', refresh);

    $('ims-send-oneclick').addEventListener(
      'click', sendNow
    );

    $('ims-send-start').addEventListener('click', start);

    $('ims-send-run').addEventListener(
      'click', sendSelected
    );

    $('ims-send-stop').addEventListener('click', () => {
      state.stop = true;

      notice(
        'Stop requested. Current request may finish. ' +
        'No further sends will be started.'
      );
    });

    const observer = new MutationObserver(() => {
      if (
        !state.busy &&
        campaign.value &&
        campaign.value !== state.selected
      ) refresh();
    });

    observer.observe(campaign, { childList: true });

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded', init, { once: true }
    );
  } else {
    init();
  }
})();


/* IMS WhatsApp UI Final Cleanup */
(() => {
  function fixUI() {
    const style = document.createElement('style');
    style.textContent = `
      #ims-send-oneclick:disabled {
        background: #cbd5e1 !important;
        color: #475569 !important;
        opacity: 1 !important;
        cursor: not-allowed !important;
      }
    `;
    document.head.appendChild(style);

    function watchText(id, oldText, newText) {
      const el = document.getElementById(id);
      if (!el) return;

      const rewrite = () => {
        if ((el.textContent || '').includes(oldText)) {
          el.textContent = newText;
        }
      };

      new MutationObserver(rewrite).observe(el, {
        childList: true,
        characterData: true,
        subtree: true
      });

      rewrite();
    }

    watchText(
      'reportStatus',
      'Sending remains disabled',
      'Delivery report updated. Use Send Manager above to send eligible messages.'
    );

    watchText(
      'ims-send-notice',
      'No eligible recipient found in dry run',
      'No eligible pending contacts in this campaign. No message sent.'
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixUI, {
      once: true
    });
  } else {
    fixUI();
  }
})();
