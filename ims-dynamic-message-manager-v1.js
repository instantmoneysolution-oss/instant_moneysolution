/* IMS WhatsApp Campaign — Dynamic Message Manager (Step 126)
 * Admin-only backend. Customer-initiated replies remain unchanged.
 * Compose & save different messages. Meta approval needed before first contact.
 */
(() => {
  'use strict';
  if (window.__imsMessageManager126) return;
  window.__imsMessageManager126 = true;

  const el = (id) => document.getElementById(id);
  const state = { drafts: [], templates: [], currentDraft: null, savedText: null, busy: false };
  const SUPPORTED_LANG = new Set(['en_US', 'en', 'hi']);

  function client() {
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    return window.supabaseClient || null;
  }
  async function request(action, args = {}) {
    const c = client();
    if (!c?.functions?.invoke) throw Error('Supabase configuration unavailable');
    const { data, error } = await c.functions.invoke('ims-whatsapp-admin', {body:{action,...args}});
    if (error) {
      let reason = error.message || 'Request failed';
      try {const d = await error.context?.json?.(); if (d?.error) reason = d.error;} catch (_) {}
      throw Error(reason);
    }
    if (data?.admin !== true || data?.success !== true) throw Error(data?.error || 'Admin check failed');
    return data;
  }
  function status(message, good) {
    const node = el('ims-mm-status');
    if (!node) return;
    node.textContent = message;
    node.style.color = good === true ? '#047857' : good === false ? '#991b1b' : '#475569';
  }
  function validate(message) {
    if (message.trim().length < 30 || message.trim().length > 1024) return 'Message must be 30–1024 characters.';
    if ((message.match(/\{\{1\}\}/g) || []).length !== 1) return 'Use {{1}} exactly once for Customer Name.';
    if (/\{\{(?!1\}\})\d+\}\}/.test(message)) return 'Only {{1}} customer-name variable is supported.';
    if (!/\bINTERESTED\b/i.test(message) || !/\bSTOP\b/i.test(message))
      return 'Include INTERESTED and STOP so the existing WhatsApp reply flow works.';
    return '';
  }
  function getForm() {
    return {
      title: el('ims-mm-title').value.trim(),
      body_text: el('ims-mm-body').value.trim(),
      language_code: el('ims-mm-language').value,
    };
  }
  function updatePreview() {
    const form = getForm();
    el('ims-mm-preview').textContent = form.body_text.replaceAll('{{1}}', 'Rahul');
    const warn = validate(form.body_text);
    el('ims-mm-counter').textContent = `${form.body_text.length} / 1024${warn ? '  ·  ' + warn : ''}`;
    el('ims-mm-save').disabled = state.busy || !!warn || form.title.length < 3 || form.title.length > 80 || !SUPPORTED_LANG.has(form.language_code);
    el('ims-mm-submit').disabled = state.busy || !state.currentDraft ||
      !!warn || state.savedText !== JSON.stringify(form) ||
      !!state.drafts.find(x => x.id === state.currentDraft)?.meta_template_name;
  }
  function refreshDraftChoices() {
    const picker = el('ims-mm-drafts');
    const old = state.currentDraft;
    picker.replaceChildren(new Option('— New message —',''));
    for(const d of state.drafts) picker.add(new Option(
      `${d.title} (${d.meta_status || 'LOCAL_DRAFT'})`, d.id));
    if (old && state.drafts.some(d => d.id === old)) picker.value = old;
    else picker.value = '';
  }
  function showDraft(id) {
    const draft = state.drafts.find(x => x.id === id);
    state.currentDraft = draft?.id || null;
    state.savedText = draft ? JSON.stringify({title:draft.title,body_text:draft.body_text,language_code:draft.language_code}) : null;
    el('ims-mm-title').value = draft?.title || '';
    el('ims-mm-body').value = draft?.body_text || 'Hello {{1}},\n\nGreetings from Instant Money Solution. Are you interested in Personal Loan or Overdraft information?\nReply INTERESTED to continue or STOP to opt out.';
    el('ims-mm-language').value = SUPPORTED_LANG.has(draft?.language_code) ? draft.language_code : 'en_US';
    const sent = !!draft?.meta_template_name;
    el('ims-mm-title').readOnly = sent;
    el('ims-mm-body').readOnly = sent;
    el('ims-mm-language').disabled = sent;
    status(sent ? `Already submitted as ${draft.meta_template_name}. To change text, click New Message.` :
      draft ? 'Saved draft loaded. You can edit and save.' : 'Write a new message, then Save Draft.');
    updatePreview();
  }
  async function loadDrafts() {
    const res = await request('message_drafts_list');
    state.drafts = res.drafts || [];
    refreshDraftChoices();
    updatePreview();
  }
  async function loadTemplates(selectName) {
    const res = await request('templates');
    state.templates = res.templates || [];
    const select = el('template');
    const old = selectName || select.value;
    select.replaceChildren(new Option('— Choose approved message —', ''));
    for(const t of state.templates) {
      select.add(new Option(
        `${t.display_name || t.template_name} · ${t.language_code} · ${t.meta_status || 'NOT VERIFIED'}${t.active ? '' : ' (not sendable)'}`,
        t.template_name));
    }
    select.disabled = !state.templates.length;
    if (state.templates.some(t => t.template_name === old)) select.value = old;
    else select.value = '';
    select.dispatchEvent(new Event('change', {bubbles:true}));
    updateTemplatePreview();
  }
  function updateTemplatePreview() {
    const selected = state.templates.find(t => t.template_name === el('template').value);
    const view = el('ims-mm-selected');
    if (!selected) {view.textContent = 'Select an approved template for your Excel campaign.'; return;}
    view.textContent = `${selected.meta_status || 'Approval not verified'} · ${selected.language_code}\n\n` +
      (selected.body_text ? selected.body_text.replaceAll('{{1}}','Rahul') :
        'Message body not synced. Click Sync from Meta to load the approved text.');
  }
  async function run(fn) {
    if (state.busy) return;
    state.busy = true;
    ['ims-mm-sync','ims-mm-new','ims-mm-submit','ims-mm-save'].forEach(id => {el(id).disabled = true;});
    try {await fn();}
    catch(e){status(String(e?.message || e), false);}
    finally {
      state.busy = false;
      el('ims-mm-sync').disabled = false;
      el('ims-mm-new').disabled = false;
      updatePreview();
    }
  }
  function create() {
    const select = el('template');
    if (!select) return;
    const card = select.closest('.card');
    if (!card) return;
    const style = document.createElement('style');
    style.textContent = `
      #ims-mm{margin-top:18px;padding:16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px}
      #ims-mm h4{font-size:16px;margin:0 0 8px}
      #ims-mm label{display:block;font-size:13px;font-weight:bold;margin:10px 0 5px}
      #ims-mm input,#ims-mm textarea,#ims-mm select{width:100%;border:1px solid #94a3b8;border-radius:7px;padding:9px;background:white;font:inherit}
      #ims-mm textarea{min-height:180px;resize:vertical}
      #ims-mm .ims-mm-actions{display:flex;gap:9px;flex-wrap:wrap;margin:12px 0}
      #ims-mm button{padding:9px 13px;border:1px solid #94a3b8;border-radius:8px;cursor:pointer;background:white}
      #ims-mm button:disabled{opacity:.45;cursor:not-allowed}
      #ims-mm button.primary{background:#047857;color:white;border-color:#047857}
      #ims-mm pre{white-space:pre-wrap;overflow-wrap:anywhere;border-radius:9px;padding:12px;background:#e8fff4;border:1px solid #bbdfce;min-height:65px;font:13px/1.6 Arial}
      #ims-mm .note{font:12px/1.5 Arial;color:#64748b}
    `;
    document.head.append(style);
    const wrap = document.createElement('section');
    wrap.id = 'ims-mm';
    wrap.innerHTML = `
      <h4>Custom WhatsApp Message Manager</h4>
      <p class="note">Different message for every campaign. Only Meta-approved marketing templates can be sent. Use {{1}} for Customer Name.</p>
      <label for="ims-mm-drafts">Saved Messages</label>
      <select id="ims-mm-drafts"><option value="">— New message —</option></select>
      <div class="ims-mm-actions"><button type="button" id="ims-mm-new">+ New Message</button><button type="button" id="ims-mm-sync">Sync Templates from Meta</button></div>
      <label for="ims-mm-title">Message title</label>
      <input id="ims-mm-title" maxlength="80" placeholder="e.g. Overdraft November Offer">
      <label for="ims-mm-language">Language</label>
      <select id="ims-mm-language"><option value="en_US">English (US)</option><option value="en">English</option><option value="hi">Hindi</option></select>
      <label for="ims-mm-body">Message body</label>
      <textarea id="ims-mm-body" maxlength="1024"></textarea>
      <div class="note" id="ims-mm-counter"></div>
      <div class="ims-mm-actions"><button type="button" id="ims-mm-save" class="primary">Save Draft</button><button type="button" id="ims-mm-submit">Submit to Meta for Approval</button></div>
      <strong>Example customer preview</strong>
      <pre id="ims-mm-preview"></pre>
      <p id="ims-mm-status" class="note" aria-live="polite" role="status"></p>
      <strong>Message selected for this Excel campaign</strong>
      <pre id="ims-mm-selected">Select an approved template above.</pre>
      <p class="note">Template changes are reviewed by Meta. Select an approved template in the main dropdown above before Save Draft / Start Campaign. CHAT/CALL handling remains unchanged.</p>
    `;
    card.append(wrap);
    el('ims-mm-new').addEventListener('click',()=>{state.currentDraft = null;state.savedText=null;el('ims-mm-drafts').value='';showDraft('');});
    el('ims-mm-drafts').addEventListener('change',e=>showDraft(e.target.value));
    ['ims-mm-title','ims-mm-body','ims-mm-language'].forEach(id=>el(id).addEventListener('input',updatePreview));
    el('template').addEventListener('change',updateTemplatePreview);
    el('ims-mm-save').addEventListener('click',()=>run(async()=>{
      const f=getForm();
      const problem=validate(f.body_text);
      if (problem) throw Error(problem);
      const current=state.drafts.find(x=>x.id===state.currentDraft);
      if (current?.meta_template_name) throw Error('Submitted messages cannot be overwritten. Click New Message.');
      const data=await request('message_draft_save',{...f,...(state.currentDraft?{draft_id:state.currentDraft}:{})});
      state.currentDraft=data.draft_id;
      state.savedText=JSON.stringify(f);
      await loadDrafts();
      status('Draft saved. You can submit this message to Meta when ready.',true);
    }));
    el('ims-mm-submit').addEventListener('click',()=>run(async()=>{
      const f=getForm();
      if (state.savedText!==JSON.stringify(f) || !state.currentDraft)
        throw Error('Save the exact current text first.');
      if (!confirm('Submit this message to Meta for approval? Submission may take time and cannot be edited in place.')) return;
      const result=await request('message_template_submit',{draft_id:state.currentDraft,confirmation:'SUBMIT_TO_META'});
      await loadDrafts();
      showDraft(state.currentDraft);
      status(`Submitted as ${result.template_name} (${result.status}). Click Sync Templates from Meta after approval.`,true);
    }));
    el('ims-mm-sync').addEventListener('click',()=>run(async()=>{
      status('Contacting Meta to read current template approvals...');
      const data=await request('message_templates_sync');
      await Promise.all([loadDrafts(),loadTemplates()]);
      status(`Meta sync complete. ${data.compatible_templates_synced} compatible templates; ${data.approved} approved. Choose a template from the main dropdown.`,true);
    }));
    showDraft('');
    Promise.all([loadDrafts(),loadTemplates()]).catch(e=>status(e.message,false));
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',create,{once:true});
  else create();
})();
