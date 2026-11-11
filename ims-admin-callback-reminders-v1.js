/* IMS WhatsApp Campaign V1 — Admin-only callback list + 5-minute in-CRM reminders.
 * Add after supabase-config.js on dashboard.html and whatsapp-campaign.html.
 * Notifications work while a CRM page with this script is open; no background push.
 * No employee assignment; no WhatsApp sends; no customer notifications.
 */
(() => {
  'use strict';
  if (window.__imsCallbackV1Loaded) return;
  window.__imsCallbackV1Loaded = true;

  const CSS = `
  #ims-ca-root{position:fixed;bottom:16px;right:16px;z-index:99998;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#14223a}
  #ims-ca-root *{box-sizing:border-box}
  #ims-ca-root button{font:inherit;cursor:pointer}
  #ims-ca-root button:disabled{cursor:not-allowed;opacity:.55}
  #ims-ca-bell{border:0;border-radius:30px;padding:12px 18px;background:#0e7666;color:white;font-weight:700;box-shadow:0 6px 22px #193f4760}
  #ims-ca-panel{display:none;width:min(380px,calc(100vw - 32px));max-height:min(620px,75vh);overflow:auto;background:white;border:1px solid #cbd5e1;border-radius:14px;margin-bottom:10px;box-shadow:0 14px 50px #15293c40}
  #ims-ca-panel.ims-ca-open{display:block}
  #ims-ca-panel-header{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 8px;gap:10px}
  #ims-ca-panel-title{font-size:16px;font-weight:800}
  #ims-ca-close{border:0;background:transparent;font-size:21px}
  #ims-ca-help{padding:0 14px 12px;color:#64748b;font-size:12px}
  #ims-ca-status{padding:0 14px 8px;font-size:12px;color:#475569}
  #ims-ca-list{padding:0 10px 12px}
  .ims-ca-card{border:1px solid #dce4ec;border-radius:10px;padding:11px;margin:7px 0;background:#fff;overflow-wrap:anywhere}
  .ims-ca-card.ims-ca-due{border-color:#d97706;background:#fffaf0}
  .ims-ca-card.ims-ca-overdue{border-color:#dc2626;background:#fff5f5}
  .ims-ca-title{font-weight:800;margin-bottom:4px}
  .ims-ca-meta{color:#475569;font-size:12px;margin:2px 0}
  .ims-ca-tag{font-size:11px;font-weight:700;padding:3px 6px;border-radius:8px;background:#e2e8f0;display:inline-block;margin:4px 0}
  .ims-ca-buttons{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
  .ims-ca-small-btn{border:1px solid #cbd5e1;border-radius:7px;padding:7px 10px;background:#fff;color:#0f172a;text-decoration:none;font-size:12px}
  .ims-ca-small-btn.ims-ca-primary{background:#0e7666;border-color:#0e7666;color:white}
  #ims-ca-toast{display:none;width:min(380px,calc(100vw - 32px));padding:15px;border:2px solid #d97706;border-radius:12px;background:#fff8e6;box-shadow:0 7px 25px #15293c50;margin-bottom:10px;overflow-wrap:anywhere}
  #ims-ca-toast.ims-ca-show{display:block}
  #ims-ca-toast strong{display:block;font-size:16px;margin-bottom:4px}
  #ims-ca-toast-message{font-size:13px}
  #ims-ca-toast-actions{display:flex;gap:7px;margin-top:10px}
  #ims-ca-toast-actions button{padding:6px 10px;border:1px solid #b45309;border-radius:6px;background:#fff}
  #ims-ca-schedule-info{font-size:12px;color:#475569;margin:7px 0}
  #ims-ca-schedule-status{font-size:12px;margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}
  @media(max-width:480px){#ims-ca-root{right:8px;bottom:8px}}
  `;
  const style = document.createElement('style');
  style.id = 'ims-ca-style';
  style.textContent = CSS;
  document.head.appendChild(style);

  const state = { callbacks: [], alerted: new Set(), displayedSignature: '', toastId: null,
    fetching: false, marking: false, scheduling: false, visible: false };
  const elem = (tag, className, content) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (content !== undefined && content !== null) n.textContent = String(content);
    return n;
  };
  const own = (id) => document.getElementById(id);
  const mins = 5 * 60 * 1000;
  const fmt = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Invalid date';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(d) + ' IST';
  };
  const classify = (x, now = Date.now()) => {
    if (x.status !== 'scheduled') return x.status;
    const remaining = Date.parse(x.scheduled_for) - now;
    if (remaining <= 0) return 'overdue';
    if (remaining <= mins) return 'due';
    return 'upcoming';
  };
  const getClient = () => {
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    return window.supabaseClient || null;
  };
  async function adminCall(action, payload = {}) {
    const client = getClient();
    if (!client?.functions?.invoke) throw new Error('CRM Supabase configuration unavailable');
    const { data, error } = await client.functions.invoke('ims-whatsapp-admin', {body:{action,...payload}});
    if (error) {
      let msg = error.message || 'Backend request failed';
      try {
        const result = await error.context?.json?.();
        if (result?.error) msg = result.error;
      } catch (_) { /* Ignore non-JSON HTTP responses. */ }
      throw new Error(msg);
    }
    if (!data || data.success !== true || data.admin !== true) {
      throw new Error(data?.error || 'Admin authorization could not be verified');
    }
    return data;
  }

  const root = elem('aside'); root.id = 'ims-ca-root'; root.hidden = true;
  const toast = elem('section'); toast.id = 'ims-ca-toast'; toast.setAttribute('role','alert');
  const toastTitle = elem('strong', '', 'Callback Reminder');
  const toastMessage = elem('div'); toastMessage.id = 'ims-ca-toast-message';
  const toastActions = elem('div'); toastActions.id = 'ims-ca-toast-actions';
  const toastView = elem('button', '', 'View callback');
  const toastDismiss = elem('button', '', 'Dismiss');
  toastActions.append(toastView, toastDismiss);
  toast.append(toastTitle, toastMessage, toastActions);
  const panel = elem('section'); panel.id = 'ims-ca-panel';
  panel.setAttribute('aria-label','My callback reminders');
  const header = elem('div'); header.id = 'ims-ca-panel-header';
  const title = elem('span', '', 'My Callback Reminders'); title.id = 'ims-ca-panel-title';
  const close = elem('button', '', '×'); close.id = 'ims-ca-close'; close.title='Close callback panel';
  header.append(title, close);
  const help = elem('div', '', 'Admin only · 5-minute CRM alert · No customer message. Keep CRM open to receive reminders.'); help.id='ims-ca-help';
  const status = elem('div', '', 'Connecting…'); status.id = 'ims-ca-status';
  const list = elem('div'); list.id = 'ims-ca-list';
  panel.append(header, help, status, list);
  const bell = elem('button', '', '🔔 Callbacks'); bell.id = 'ims-ca-bell'; bell.type='button';
  root.append(toast, panel, bell);

  close.addEventListener('click', () => panel.classList.remove('ims-ca-open'));
  bell.addEventListener('click', () => panel.classList.toggle('ims-ca-open'));
  toastDismiss.addEventListener('click', () => { toast.classList.remove('ims-ca-show'); state.toastId = null; });
  toastView.addEventListener('click', () => {
    toast.classList.remove('ims-ca-show'); state.toastId = null;
    panel.classList.add('ims-ca-open');
  });

  function addCallbackCard(x, now) {
    const stateName = classify(x,now);
    const card = elem('article', 'ims-ca-card' + (stateName==='due'?' ims-ca-due':stateName==='overdue'?' ims-ca-overdue':''));
    const name = String(x.customer_name || x.lead_id || 'Customer');
    card.append(elem('div','ims-ca-title',name));
    const safeMobile = /^91[6-9]\d{9}$/.test(String(x.customer_mobile)) ? x.customer_mobile : '';
    card.append(elem('div','ims-ca-meta', 'Lead: ' + (x.lead_id || '—') + ' · ' + (safeMobile ? '+' + safeMobile : 'Mobile unavailable')));
    card.append(elem('div','ims-ca-meta', 'Callback: ' + fmt(x.scheduled_for)));
    if (x.admin_note) card.append(elem('div','ims-ca-meta','Note: ' + String(x.admin_note)));
    const tag = elem('span','ims-ca-tag',
      stateName==='due'?'Due within 5 min':stateName==='overdue'?'Overdue':stateName==='upcoming'?'Scheduled':stateName==='completed'?'Completed':'Cancelled');
    card.append(tag);
    if (x.status === 'scheduled') {
      const buttons=elem('div','ims-ca-buttons');
      if (safeMobile) {
        const call = elem('a','ims-ca-small-btn','Call customer');
        call.href='tel:+'+safeMobile;
        buttons.append(call);
      }
      // Current rollout remains strictly TEST002 owner-test only.
      if (safeMobile) {
        const completed=elem('button','ims-ca-small-btn ims-ca-primary','Mark Completed');
        completed.type='button';
        completed.addEventListener('click',()=>completeCallback(x));
        buttons.append(completed);
      }
      card.append(buttons);
    }
    return card;
  }
  function render(force = false) {
    if (!state.visible) return;
    const now=Date.now();
    const pending=state.callbacks.filter(x=>x.status==='scheduled');
    const due=pending.filter(x=>['due','overdue'].includes(classify(x,now)));
    bell.textContent = '🔔 Callbacks' + (due.length?' ('+due.length+')':'');
    const signature=JSON.stringify(state.callbacks.map(x=>[x.id,x.status,classify(x,now)]));
    if (!force && signature===state.displayedSignature) return;
    state.displayedSignature=signature;
    list.replaceChildren();
    if (!state.callbacks.length) {
      list.append(elem('p','ims-ca-meta','No callbacks for this Admin account.'));
      return;
    }
    const top = [...pending].sort((a,b)=>Date.parse(a.scheduled_for)-Date.parse(b.scheduled_for));
    const past=state.callbacks.filter(x=>x.status!=='scheduled');
    for (const x of [...top,...past].slice(0,100)) list.append(addCallbackCard(x,now));
  }
  function checkAlerts() {
    if (!state.visible) return;
    const now=Date.now();
    const candidate=state.callbacks.find(x=>x.status==='scheduled' &&
      classify(x,now)!=='upcoming' && !state.alerted.has(x.id));
    if (!candidate) return;
    state.alerted.add(candidate.id);
    state.toastId=candidate.id;
    toastTitle.textContent=classify(candidate,now)==='overdue'?'⚠️ Overdue Callback':'🔔 Callback in 5 Minutes';
    toastMessage.textContent=(candidate.customer_name||'Customer')+' · '+fmt(candidate.scheduled_for)+
      ' · '+(candidate.customer_mobile ? '+'+candidate.customer_mobile:'No mobile');
    toast.classList.add('ims-ca-show');
  }
  async function refresh() {
    if (!state.visible || state.fetching) return;
    state.fetching=true;
    try {
      const response=await adminCall('callback_list');
      if (!Array.isArray(response.callbacks)) throw new Error('Invalid callback list response');
      state.callbacks=response.callbacks;
      status.textContent='My scheduled callbacks: '+state.callbacks.filter(x=>x.status==='scheduled').length+
        (response.scheduled_result_limit_reached?' · Showing first 200 scheduled callbacks':'');
      render(true);
      checkAlerts();
      updateScheduleButton();
    } catch(error) {
      const message=String(error.message || 'Unknown error');
      if (/login required|invalid login session|admin access required|unable to verify admin access|authorization.*invalid/i.test(message)) {
        // Hide previously fetched customer details after session/role loss.
        state.callbacks=[];
        state.visible=false;
        root.hidden=true;
      } else {
        status.textContent='Cannot refresh callbacks: '+message;
      }
    } finally { state.fetching=false; }
  }
  async function completeCallback(x) {
    if (state.marking || !window.confirm('Mark callback completed for '+(x.customer_name||'customer')+'? This cannot be undone from this panel.')) return;
    state.marking=true;
    status.textContent='Marking callback completed…';
    try {
      await adminCall('callback_complete',{callback_id:x.id});
      await refresh();
    } catch(error) {
      status.textContent='Completion failed: '+error.message;
    } finally { state.marking=false; }
  }

  let scheduleButton=null;
  let scheduleStatus=null;
  function selectedCallId() {
    if (typeof inboxState === 'undefined') return null;
    return inboxState?.call?.selectedId || null;
  }
  function selectedIsCall() {
  const id = selectedCallId();

  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
 }
  function updateScheduleButton() {
    if (!scheduleButton) return;
    const existing=state.callbacks.some(x=>x.status==='scheduled' && x.conversation_id===selectedCallId());
    scheduleButton.disabled=state.scheduling || !selectedIsCall() || !!own('callCallbackWhen')?.disabled || existing;
    if (existing) scheduleStatus.textContent='An active callback is already scheduled for this conversation.';
    else if (!selectedIsCall()) scheduleStatus.textContent='Select a Call Lead to schedule a callback.';
    else if (!state.scheduling && scheduleStatus.textContent.startsWith('An active')) scheduleStatus.textContent='';
  }
  function installScheduleUI() {
    const whenInput=own('callCallbackWhen');
    const noteInput=own('callCallbackNote');
    if (!whenInput || !noteInput || !whenInput.closest('.action-preview')) return;
    const card=whenInput.closest('.action-preview');
    const heading=card.querySelector('h4');
    if (heading) heading.textContent='Schedule Callback — Call Leads';
    const explanation=card.querySelector('p.muted');
    if (explanation) explanation.textContent='Schedule a callback for the selected Call Lead (IST). No WhatsApp message will be sent.';
    const lock=card.parentElement?.querySelector('.inbox-readonly');
    if (lock) lock.textContent='Admin-only callback scheduling. Existing CRM Follow-Up records stay unchanged.';
    scheduleButton=elem('button','btn btn-primary','Schedule Callback');
    scheduleButton.id='ims-ca-schedule-btn'; scheduleButton.type='button'; scheduleButton.disabled=true;
    scheduleStatus=elem('div'); scheduleStatus.id='ims-ca-schedule-status';
    card.append(scheduleButton,scheduleStatus);
    const head=own('callThreadHead');
    if (head) new MutationObserver(updateScheduleButton).observe(head,{subtree:true,childList:true,characterData:true});
    new MutationObserver(updateScheduleButton).observe(whenInput,{attributes:true,attributeFilter:['disabled']});
    scheduleButton.addEventListener('click',async()=>{
      if (!selectedIsCall() || state.scheduling) return;
      const when=whenInput.value;
      const note=noteInput.value.trim();
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) {
        scheduleStatus.textContent='Select a valid date and time (IST).'; return;
      }
      if (note.length>1000) {scheduleStatus.textContent='Note is too long (max 1,000 characters).';return;}
      const iso=when+':00+05:30';
      const ms=Date.parse(iso);
      if (!Number.isFinite(ms)||ms<Date.now()+5*60000||ms>Date.now()+90*86400000) {
        scheduleStatus.textContent='Choose a time between 5 minutes and 90 days ahead.';return;
      }
      if (!window.confirm('Schedule callback for selected Call Lead at '+fmt(iso)+'?')) return;
      state.scheduling=true; updateScheduleButton();
      scheduleStatus.textContent='Saving callback…';
      try {
        const answer=await adminCall('schedule_callback',{
          conversation_id:selectedCallId(),scheduled_for:iso,admin_note:note
        });
        if (answer.scheduled!==true || !answer.callback?.id) throw new Error('Callback not confirmed by backend');
        scheduleStatus.textContent='Callback saved: '+fmt(iso)+'. You will see the reminder in CRM 5 minutes before.';
        await refresh();
      } catch(error) {scheduleStatus.textContent='Scheduling failed: '+error.message;}
      finally {state.scheduling=false;updateScheduleButton();}
    });
    updateScheduleButton();
  }

  async function initialize() {
    const client=getClient();
    if (!client?.auth?.getUser) return;
    try {
      const { data, error }=await client.auth.getUser();
      if (error || !data?.user) return;
      // Do not expose the callback widget until server-verified Admin role succeeds.
      await adminCall('status');
      state.visible=true;
      document.body.appendChild(root);
      root.hidden=false;
      installScheduleUI();
      await refresh();
      setInterval(refresh,45000);
      setInterval(()=>{render();checkAlerts();},10000);
      document.addEventListener('visibilitychange',()=>{
        if (!document.hidden) {refresh();render(true);checkAlerts();}
      });
    } catch (error) {
      // Non-Admin/expired sessions intentionally have no callback widget.
      console.info('IMS callback reminders unavailable:',error.message);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',initialize,{once:true});
  } else initialize();
})();
