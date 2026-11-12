/* IMS Mobile-only Excel/CSV addon. Compatible with the November 2026
   campaign page globals. Add after the campaign page's inline script. */
(() => {
  'use strict';
  if (window.__imsMobileOnlyUploadV1) return;
  window.__imsMobileOnlyUploadV1 = true;

  function init() {
    const el = id => document.getElementById(id);
    if (!el('sheetFile') || typeof updatePreview !== 'function' ||
        typeof normalizeMobile !== 'function' || typeof updateDraftButton !== 'function') {
      console.warn('IMS mobile-only addon: campaign page version not compatible');
      return;
    }

    // Hide the Lead ID selector, but leave optional name mapping for legacy files.
    const leadRow = el('leadColumn')?.closest('.form-row');
    if (leadRow) leadRow.style.display = 'none';
    const nameLabel = document.querySelector('label[for="nameColumn"]');
    if (nameLabel) nameLabel.textContent = 'Customer Name (optional)';
    const mapHelp = el('mapCard')?.querySelector('.help');
    if (mapHelp) mapHelp.textContent = 'Only Mobile Number is required. Customer Name can be left blank. Lead ID is not needed.';
    const variableNote = [...document.querySelectorAll('p')].find(p =>
      p.textContent?.includes('Template variable') && p.textContent?.includes('mapped Customer Name'));
    if (variableNote) variableNote.textContent = 'Use fixed-text templates for numbers-only lists. Older {{1}} templates use "Valued Customer" when no name is supplied.';
    const previewHead = el('previewTableWrap')?.querySelector('thead tr');
    if (previewHead) previewHead.innerHTML = '<th>#</th><th>Mobile (normalized)</th>';
    const pageStyles = document.createElement('style');
    pageStyles.textContent = '#mapCard .mapping {grid-template-columns:repeat(2,minmax(0,1fr))}';
    document.head.appendChild(pageStyles);

    // Replace only preview/validation logic. All existing saving, STOP checks,
    // consent checks, campaigns, and send manager remain in place.
    updatePreview = function imsMobileOnlyPreview() {
      const phone = el('phoneColumn')?.value ?? '';
      const name = el('nameColumn')?.value ?? '';
      const hasPhone = phone !== '';
      const nameMapped = name !== '' && name !== phone;
      const seen = new Set();
      const valid = [];
      let invalid = 0, duplicates = 0;
      if (hasPhone) {
        for (const row of sheetRows) {
          const mobile = normalizeMobile(row[Number(phone)]);
          if (!mobile) { invalid++; continue; }
          if (seen.has(mobile)) { duplicates++; continue; }
          seen.add(mobile);
          const possibleName = nameMapped ? String(row[Number(name)] ?? '').trim() : '';
          valid.push({ mobile, customerName: possibleName || 'Valued Customer', leadId: '' });
        }
      }
      validPreviewRecipients = valid;
      updateDraftButton();
      el('totalRows').textContent = sheetRows.length.toLocaleString('en-IN');
      el('validRows').textContent = valid.length.toLocaleString('en-IN');
      el('duplicateRows').textContent = duplicates.toLocaleString('en-IN');
      el('invalidRows').textContent = invalid.toLocaleString('en-IN');
      el('previewEmpty').classList.toggle('hide', hasPhone && valid.length > 0);
      el('previewTableWrap').classList.toggle('hide', !(hasPhone && valid.length > 0));
      if (!hasPhone) el('previewEmpty').textContent = 'Select the Mobile column above.';
      else if (!valid.length) el('previewEmpty').textContent = 'No valid mobile numbers. Check the file and column mapping.';
      const body = el('previewBody');
      body.replaceChildren();
      valid.slice(0, 100).forEach((item, i) => {
        const tr = document.createElement('tr');
        [String(i + 1), item.mobile].forEach(value => {
          const td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      el('previewNote').textContent = `Showing first ${Math.min(valid.length, 100)} of ${valid.length.toLocaleString('en-IN')} unique valid mobile numbers. Local preview only.`;
    };

    const fileInput = el('sheetFile');
    // Handle a *headerless* one-column spreadsheet, including a single mobile.
    // The original parser expects a header and can otherwise discard the first
    // number. This observer waits for it to finish before applying our parser.
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file || typeof XLSX === 'undefined') return;
      let rows;
      try {
        const workbook = XLSX.read(await file.arrayBuffer(), {type:'array'});
        const first = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(first, {header:1, raw:false, defval:'', blankrows:false});
      } catch (_) { return; } // Original importer displays relevant file errors.
      if (!rows?.length || rows[0].length !== 1 || !normalizeMobile(rows[0][0])) return;

      const info = el('fileInfo'), error = el('error');
      const isFinished = () => info?.textContent?.includes('First worksheet used') ||
        (!!error && !error.classList.contains('hide') && !!error.textContent?.trim());
      if (!isFinished()) {
        await new Promise(resolve => {
          const observer = new MutationObserver(() => {
            if (isFinished()) { observer.disconnect(); resolve(); }
          });
          observer.observe(info, {childList:true, subtree:true, characterData:true});
          if (error) observer.observe(error, {childList:true, subtree:true, characterData:true, attributes:true});
        });
      }
      if (fileInput.files?.[0] !== file) return;
      sheetHeaders = ['Mobile'];
      sheetRows = rows.map(row => [row[0]]).filter(row => String(row[0] ?? '').trim());
      currentDraft = null;
      mappingRevision++;
      fillSelect('leadColumn', -1);
      fillSelect('nameColumn', -1);
      fillSelect('phoneColumn', 0);
      el('mapCard').classList.remove('hide');
      el('fileInfo').textContent = `${file.name} · ${sheetRows.length.toLocaleString('en-IN')} mobile rows · Headerless list detected`;
      clearError();
      updatePreview();
    });
    updatePreview();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
