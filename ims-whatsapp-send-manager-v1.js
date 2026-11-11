/* IMS WhatsApp Campaign - Step 109 CRM Send Manager.
   Admin-authenticated calls only; no automatic sends on page load.
   All recipient checks and duplicate protection remain in Supabase.
*/
(() => {
  'use strict';
  if (window.imsSendManager109) return;
  window.imsSendManager109 = true;

  const $ = id => document.getElementById(id);
  const state = { busy: false, stop: false, report: null, selected: '' };

  async function request(action, payload = {}) {
    if (typeof supabaseClient === 'undefined') throw new Error('Supabase configuration unavailable');
    const { data, error } = await supabaseClient.functions.invoke('ims-whatsapp-admin', {
      body: { action, ...payload }
    });
    if (error) {
      let message = error.message || 'Backend request failed';
      try { const details = await error.context?.json?.(); if (details?.error) message = details.error; }
      catch (_) { /* Use original SDK error. */ }
      throw new Error(message);
    }
    if (!data || data.success !== true || data.admin !== true) {
      throw new Error(data?.error || 'Admin authorization failed');
    }
    return data;
  }

  function notice(message) { $('ims-send-notice').textContent = message; }
  function setButtons() {
    const report = state.report;
    const active = Boolean($('reportCampaign')?.value);
    $('ims-send-refresh').disabled = state.busy || !active;
    $('ims-send-start').disabled = state.busy || !report?.can_start || !report?.has_eligible_test;
    $('ims-send-run').disabled = state.busy || !report?.can_send;
    $('ims-send-stop').disabled = !state.busy;
    $('ims-send-quantity').disabled = state.busy;
    $('ims-send-oneclick').disabled = state.busy || !report ||
      !(report.can_send || (report.can_start && report.has_eligible_test));
  }

  async function refresh() {
    if (state.busy) return;
    const id = $('reportCampaign')?.value;
    state.selected = id || '';
    state.report = null;
    if (!id) { notice('Select a saved campaign first.'); setButtons(); return; }
    state.busy = true; setButtons(); notice('Checking campaign status...');
    try {
      const r = await request('campaign_sender_status', { campaign_id: id });
      // A dry run checks recipients without sending or changing campaign state.
      // The server already matches saved opt-in evidence and the STOP list.
      // Show the actual dry-run breakdown; never treat 'pending' as 'eligible'.
      let eligible = false;
      const excluded = {};
      let scanned = 0;
      let eligibleCount = 0;
      let partialScan = false;
      if (r.campaign_status === 'draft' && r.template_ready && r.pending_contacts > 0) {
        let page = 0;
        while (true) {
          const d = await request('dry_run_campaign', { campaign_id: id, page });
          const e = Number(d.eligible_in_page_for_review || 0);
          eligibleCount += e;
          scanned += Number(d.page_contacts || 0);
          for (const [reason, count] of Object.entries(d.excluded_in_page || {})) {
            excluded[reason] = (excluded[reason] || 0) + Number(count || 0);
          }
          if (e > 0) eligible = true;
          // Once an eligible record is confirmed, further pages need not be scanned
          // to enable a send. Report this as a partial sample, not a full count.
          if (eligible && d.has_more) { partialScan = true; break; }
          if (!d.has_more || !Number.isSafeInteger(d.next_page)) break;
          page = d.next_page;
        }
      }
      if ($('reportCampaign').value !== id) return;
      r.has_eligible_test = eligible;
      r.dry_run_counts = { eligibleCount, scanned, excluded, partialScan };
      state.report = r;
      $('ims-send-info').textContent =
        `Campaign: ${r.campaign_name} | Status: ${r.campaign_status} | Pending: ${r.pending_contacts} | Unresolved: ${r.unresolved_attempts}`;
      const stopped = excluded.stop_blocked || 0;
      const withoutProof = (excluded.missing_consent || 0) +
        (excluded.consent_evidence_incomplete || 0) + (excluded.consent_revoked || 0);
      const other = Math.max(0, scanned - eligibleCount - stopped - withoutProof);
      const summary = scanned > 0
        ? `${partialScan ? `Sample of ${scanned}` : `Checked ${scanned}`} | Eligible: ${eligibleCount}${partialScan ? '+' : ''} | STOP blocked: ${stopped} | Missing/invalid permission: ${withoutProof}` +
          (other ? ` | Other exclusions: ${other}` : '')
        : '';
      if (!r.sending_enabled) notice('Campaign sending is OFF in backend. ' + summary);
      else if (!r.template_ready) notice('Approved template is not ready. ' + summary);
      else if (r.unresolved_attempts) notice('An earlier send needs review; no automatic retries.');
      else if (r.can_start && !eligible) notice(summary + '. Nothing can be sent from this draft.');
      else if (r.can_start) notice(summary + '. Ready: click Send Now.');
      else if (r.can_send) notice('Campaign running. Click Send Now for remaining eligible contacts.');
      else if (r.campaign_status === 'running' && r.pending_contacts === 0)
        notice('All campaign contacts processed. Meta acceptance does not mean delivery.');
      else notice('No pending eligible contacts or campaign is not ready.');
    } catch (e) { notice('Status check failed: ' + e.message); }
    finally { state.busy = false; setButtons(); }
  }

  async function start() {
    const id = $('reportCampaign').value;
    if (!state.report?.can_start || !state.report?.has_eligible_test || state.busy) return;
    if (!confirm('Start this saved WhatsApp campaign? This changes DRAFT to RUNNING, but does not send messages yet.')) return;
    state.busy = true; setButtons();
    try {
      await request('campaign_start', { campaign_id: id, confirmation: 'START_WHATSAPP_CAMPAIGN' });
      notice('Campaign started. No message has been sent yet.');
    } catch (e) { notice('Start failed: ' + e.message); }
    finally { state.busy = false; await refresh(); }
  }

  async function sendSelected() {
    const id = $('reportCampaign').value;
    const count = Number($('ims-send-quantity').value);
    if (!state.report?.can_send || state.busy) return;
    if (!Number.isSafeInteger(count) || count < 1 || count > state.report.pending_contacts) {
      notice('Enter a valid quantity between 1 and the pending contact count.'); return;
    }
    if (!confirm(`Send up to ${count} WhatsApp template message(s) for this campaign? This makes REAL paid Meta API requests.`)) return;
    state.busy = true; state.stop = false; setButtons();
    let accepted = 0;
    let reason = '';
    try {
      for (let i = 0; i < count && !state.stop; i++) {
        notice(`Sending ${i + 1}/${count}... Meta accepted ${accepted} so far.`);
        const result = await request('campaign_send_one', {
          campaign_id: id, confirmation: 'SEND_ONE_CAMPAIGN_MESSAGE'
        });
        if (result.outcome === 'accepted') { accepted++; continue; }
        reason = `Stopped: ${result.outcome || 'no eligible recipient'}. No automatic retries.`;
        break;
      }
    } catch (e) { reason = `Stopped after ${accepted} Meta acceptance(s): ${e.message}. Do not retry uncertain messages.`; }
    finally {
      const stopped = state.stop;
      state.busy = false; state.stop = false;
      await refresh();
      notice(`${accepted} message(s) accepted by Meta (delivery not confirmed). ` +
        (reason || (stopped ? 'Stopped by Admin.' : 'Selected quantity processed.')));
      const btn = $('refreshReportBtn'); if (btn && !btn.disabled) btn.click();
    }
  }


  async function sendNow() {
    const id = $('reportCampaign')?.value;
    if (!id || state.busy) return;
    const report = state.report;
    if (!report || !(report.can_send || (report.can_start && report.has_eligible_test))) {
      notice('This campaign has no sendable contacts or is not ready.');
      return;
    }
    const maximum = Number(report.pending_contacts);
    if (!Number.isSafeInteger(maximum) || maximum < 1) return;
    if (!confirm(`Process up to ${maximum} eligible WhatsApp contact(s) in ${report.campaign_name}? This sends REAL paid messages. STOP and opt-in checks remain active.`)) return;

    state.busy = true;
    state.stop = false;
    setButtons();
    let accepted = 0;
    let processed = 0;
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
          reason = 'Selected campaign changed; stopped before next send.';
          break;
        }
        notice(`Processing ${i + 1}/${maximum}. Meta accepted: ${accepted}. Keep this tab open.`);
        const r = await request('campaign_send_one', {
          campaign_id: id,
          confirmation: 'SEND_ONE_CAMPAIGN_MESSAGE'
        });
        processed++;
        if (r.outcome === 'accepted' && r.sends_performed === 1) {
          accepted++;
          continue;
        }
        if (r.outcome === 'no_eligible') {
          reason = 'No more eligible contacts. Remaining contacts were not sent.';
          break;
        }
        reason = `Stopped on outcome ${r.outcome || 'unverified'}. No automatic retry.`;
        break;
      }
    } catch (e) {
      reason = `Stopped: ${e.message}. Check send attempts before retrying.`;
    } finally {
      const stopped = state.stop;
      state.stop = false;
      state.busy = false;
      await refresh();
      notice(`${accepted} accepted by Meta (delivery not confirmed). ` +
        (reason || (stopped ? 'Stopped by Admin.' : 'Selected contacts processed.')));
      const btn = $('refreshReportBtn');
      if (btn && !btn.disabled) btn.click();
    }
  }

  function init() {
    const toolbar = document.querySelector('#campaignTab .report-toolbar');
    const campaign = $('reportCampaign');
    if (!toolbar || !campaign) return;
    const box = document.createElement('section');
    box.id = 'ims-send-manager';
    box.style.cssText = 'margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc';
    box.innerHTML = `
      <h3 style="margin:0 0 8px">WhatsApp Campaign Send Manager</h3>
      <p id="ims-send-info">Choose a saved campaign above.</p>
      <div style="display:flex;gap:9px;align-items:end;flex-wrap:wrap;margin:12px 0">
        <button type="button" id="ims-send-oneclick" style="background:#047857;color:#fff;border:0;border-radius:7px;padding:10px 15px;font-weight:700" disabled>Send Now — All Eligible</button>
        <button type="button" id="ims-send-refresh">Check Status</button>
        <button type="button" id="ims-send-stop" disabled>Stop After Current</button>
        <details style="flex-basis:100%;font-size:13px">
          <summary style="cursor:pointer">Advanced controls (optional)</summary>
          <div style="display:flex;gap:9px;align-items:end;flex-wrap:wrap;margin-top:8px">
            <button type="button" id="ims-send-start" disabled>Start Campaign Only</button>
            <label>Messages to Send
              <input id="ims-send-quantity" type="number" min="1" step="1" value="1" style="display:block;width:110px;padding:8px">
            </label>
            <button type="button" id="ims-send-run" disabled>Send Selected</button>
          </div>
        </details>
      </div>
      <p id="ims-send-notice" role="status" style="white-space:pre-wrap;font-weight:600">Checking campaign eligibility...</p>`;
    toolbar.insertAdjacentElement('afterend', box);
    const st = document.createElement('style');
    st.textContent = '#ims-send-oneclick:disabled{background:#cbd5e1!important;color:#475569!important;cursor:not-allowed!important}';
    document.head.appendChild(st);
    // Legacy report text is read-only, but it must not claim the live sender is disabled.
    const legacy = $('reportStatus');
    if (legacy) {
      const clean = () => {
        if ((legacy.textContent || '').includes('Sending remains disabled')) {
          legacy.textContent = 'Delivery report updated. Use Send Manager to send eligible messages.';
        }
      };
      new MutationObserver(clean).observe(legacy, { childList: true, characterData: true, subtree: true });
      clean();
    }
    campaign.addEventListener('change', () => { state.stop = true; if (!state.busy) refresh(); });
    $('ims-send-refresh').addEventListener('click', refresh);
    $('ims-send-oneclick').addEventListener('click', sendNow);
    $('ims-send-start').addEventListener('click', start);
    $('ims-send-run').addEventListener('click', sendSelected);
    $('ims-send-stop').addEventListener('click', () => {
      state.stop = true; notice('Stop requested. The current request may finish; no further messages will be started.');
    });
    const observe = new MutationObserver(() => {
      if (!state.busy && campaign.value && campaign.value !== state.selected) refresh();
    });
    observe.observe(campaign, { childList: true });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
