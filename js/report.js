/* Infra Upgrades — the report model shared by PDF, Word and Excel,
   plus photo/logo preparation and saving files to a folder. */
(function () {
  'use strict';
  const U = self.U;
  const S = U.S;
  const BAD = new Set(['repair', 'replace', 'notavail', 'rebuild']);

  /* ---------- values as text ---------- */
  U.fieldText = (fl, data) => {
    if (fl.type === 'calc') { const v = U.calcValue(fl, data); return v == null ? '' : U.fmtNum(v); }
    const v = data[fl.id];
    if (v == null || v === '') return '';
    if (fl.type === 'multi') return Array.isArray(v) ? v.join(', ') : String(v);
    if (fl.type === 'yesno') return v === true || v === 'yes' ? 'Yes' : v === false || v === 'no' ? 'No' : String(v);
    if (fl.type === 'date') return U.fmtDate(v);
    if (fl.type === 'gps') return v && v.lat != null ? U.fmtLatLng(v.lat, v.lng) : String(v.text || '');
    return String(v);
  };
  U.condLabel = (id) => { const c = U.T.cond(id); return c ? c.label : (id || ''); };

  /* Sakshham Consultants report look — colours from the company's own checklist. */
  U.THEME = {
    navy: [33, 67, 102], orange: [242, 129, 32], ink: [51, 51, 51], muted: [110, 110, 110],
    label: [214, 228, 240], value: [255, 249, 196], grey: [242, 242, 242], line: [191, 191, 191],
    company: 'Sakshham Consultants', web: 'www.sakshham.com',
  };
  const COND_RGB = { good: [226, 239, 218], repair: [255, 230, 153], replace: [248, 203, 173], notavail: [217, 210, 233], na: [231, 230, 230], rebuild: [248, 203, 173] };
  /* fill colour for a condition cell, from its label (or null) */
  U.condRGB = (label) => {
    if (!label) return null;
    const c = (U.S.template.conditions || []).find((x) => x.label === label);
    if (!c) {
      /* a point's own answers (Yes / More needed ...): work answers in the repair colour, others green */
      const items = U.T.allChecks().concat(U.T.allSpaceChecks());
      if (items.some((it) => (it.work || []).includes(label))) return COND_RGB.repair;
      if (items.some((it) => (it.ans || []).includes(label))) return COND_RGB.good;
      return null;
    }
    return COND_RGB[c.id] || { ok: COND_RGB.good, warn: COND_RGB.repair, bad: COND_RGB.replace, new: COND_RGB.notavail, mute: COND_RGB.na }[c.tone] || null;
  };
  U.hex = (rgb) => rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  /* the fixed company logo (PNG for Word/Excel, JPEG for PDF) */
  let logoCache = null;
  U.companyLogo = async () => {
    if (logoCache) return logoCache;
    const get = async (f) => new Uint8Array(await (await fetch(f)).arrayBuffer());
    logoCache = { png: await get(U.LOGO_PNG || 'icons/sakshham-logo.png'), jpg: await get(U.LOGO_JPG || 'icons/sakshham-logo.jpg'), w: 1200, h: 252 };
    return logoCache;
  };
  /* top-of-every-page text and the Project / Client / Document / Date strip */
  U.letterhead = (school, o, kind) => {
    const b = U.S.settings.brand;
    const name = U.schoolName(school);
    const doc = U.safeFileName(o.docName || `${name} - ${kind || 'Site Visit Report'}`);
    return {
      title: `${(b.reportTitle || 'SCHOOL SITE VISIT REPORT').toUpperCase()}  |  ${(b.projectName || 'CSR SCHOOL RENOVATION').toUpperCase()}`,
      sub: [kind || 'School Site Visit', [name, school.data.sd_district].filter(Boolean).join(', ')].filter(Boolean).join('  |  '),
      strip: [['PROJECT', b.projectName || 'CSR School Renovation'], ['CLIENT', b.preparedFor || ''], ['DOCUMENT', doc], ['DATE', U.fmtDate(school.data.sd_date || Date.now())]],
      footLeft: `${U.THEME.company}  |  ${U.THEME.web}`,
      footRight: `${doc}  |  Confidential`,
    };
  };

  /* ---------- photos grouped by what they belong to ---------- */
  U.photoGroups = (photos) => {
    const g = new Map();
    for (const p of photos) {
      if (p.deleted) continue;
      if (!g.has(p.target)) g.set(p.target, []);
      g.get(p.target).push(p);
    }
    for (const a of g.values()) a.sort((x, y) => (x.no || 0) - (y.no || 0));
    return g;
  };
  U.photoNo = (p) => 'P-' + U.pad(p.no || 0, 3);
  U.targetLabel = (s, target) => {
    s = s || U.S.cur;
    if (!target || target === 'school') return 'General';
    const [kind, a, b] = String(target).split(':');
    const sp = s && (s.spaces || []).find((x) => x.id === a);
    if (kind === 'space') return sp ? U.spaceTitle(sp) : 'Room';
    if (kind === 'item') { const it = U.T.allChecks().find((x) => x.id === a); return it ? it.no + ' ' + it.what : 'Checklist'; }
    if (kind === 'si') { const it = U.T.allSpaceChecks().find((x) => x.id === b); return [sp ? U.spaceTitle(sp) : 'Room', it ? it.no + ' ' + it.what : ''].filter(Boolean).join(' · '); }
    return '';
  };
  U.photoCaption = (p, s) => [U.photoNo(p), p.caption || U.targetLabel(s, p.target), p.tag || ''].filter(Boolean).join(' · ');
  U.photoSub = (p) => (p.source === 'upload' ? 'Uploaded image  ·  ' + U.fmtDateTime(p.ts) : null) || [p.lat != null ? U.fmtLatLng(p.lat, p.lng) + (p.acc != null ? ` (${p.approx ? 'approx. ' : ''}±${Math.round(p.acc)} m)` : '') : 'No GPS', U.fmtDateTime(p.ts)].join('  ·  ');

  /* ---------- build the report as simple blocks ---------- */
  U.buildReport = (school, photos, o) => {
    const T = S.template, b = S.settings.brand;
    const blocks = [];
    const groups = U.photoGroups(photos);
    const groupOf = (k) => groups.get(k) || [];
    const name = U.schoolName(school);
    const brand = o.brand && (b.company || b.logo);
    const used = new Set();
    const takePhotos = (k) => { const a = groupOf(k); a.forEach((p) => used.add(p.id)); return a; };
    const photoRefs = (k) => groupOf(k).map(U.photoNo).join(', ');

    /* cover / heading */
    const meta = [];
    const place = U.schoolPlace(school);
    if (place) meta.push(['Location', place]);
    if (school.data.sd_date) meta.push(['Date of visit', U.fmtDate(school.data.sd_date)]);
    if (school.data.sd_udise) meta.push(['UDISE code', school.data.sd_udise]);
    if (b.writer || school.data.sd_engineer) meta.push(['Report by', [b.writer || school.data.sd_engineer, b.designation].filter(Boolean).join(', ')]);
    if (b.phone || b.email) meta.push(['Contact', [b.phone, b.email].filter(Boolean).join('  ·  ')]);
    meta.push(['Report date', U.fmtDate(Date.now())]);
    blocks.push({ t: 'cover', title: 'School Site Visit Report', school: name, meta });

    let secNo = 0;
    const H1 = (text) => blocks.push({ t: 'h1', text: `${++secNo}. ${text}` });

    /* 1. school details */
    H1('School details');
    for (const sec of T.school) {
      const rows = sec.fields.map((fl) => [fl.label, U.fieldText(fl, school.data)]).filter((r) => o.includeBlank || r[1]);
      if (!rows.length) continue;
      blocks.push({ t: 'h2', text: sec.title.replace(/^\d+\.\s*/, '') });
      blocks.push({ t: 'kv', rows });
    }

    /* work list */
    const work = [];
    for (const sec of T.checklist) for (const it of sec.items) {
      const r = school.checks[it.id];
      if (r && U.needsWork(it, r.c)) work.push(['School', it.no, it.what, U.condLabel(r.c), r.q || '', r.n || '']);
    }
    const spaces = U.liveSpaces(school);
    for (const sp of spaces) {
      const where = U.spaceTitle(sp);
      const wt = sp.data && sp.data.sp_worktypes;
      if (Array.isArray(wt) && wt.length && !(wt.length === 1 && wt[0] === 'No work')) work.push([where, '', 'Work needed', wt.filter((x) => x !== 'No work').join(', '), '', '']);
      for (const it of U.checksOf(sp)) {
        const r = sp.checks && sp.checks[it.id];
        if (r && U.needsWork(it, r.c)) work.push([where, it.no, it.what, U.condLabel(r.c), r.q || '', r.n || '']);
      }
      if (sp.notes && /rebuild/i.test(sp.notes)) work.push([where, '', 'Note', 'See notes', '', sp.notes]);
    }
    if (o.summary) {
      H1('Summary of work required');
      const counts = {};
      const all = [];
      for (const it of U.T.allChecks()) { const r = school.checks[it.id]; if (r && r.c) all.push(r.c); }
      for (const sp of spaces) for (const it of U.checksOf(sp)) { const r = sp.checks && sp.checks[it.id]; if (r && r.c) all.push(r.c); }
      all.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
      const totalItems = U.T.allChecks().length + spaces.reduce((a, sp) => a + U.checksOf(sp).length, 0);
      blocks.push({ t: 'kv', rows: [
        ['Rooms and spaces surveyed', String(spaces.length)],
        ['Photos taken', String(photos.filter((p) => !p.deleted).length)],
        ['Items checked', `${all.length} of ${totalItems}`],
        ...T.conditions.filter((c) => counts[c.id]).map((c) => [c.label, String(counts[c.id])]),
      ] });
      if (work.length) {
        blocks.push({ t: 'p', text: 'Items that need work (repair, replace, new, or rebuild):', bold: true });
        blocks.push({ t: 'table', head: ['Location', 'No.', 'Item', 'Condition', 'Count / Size', 'Notes'],
          widths: [0.17, 0.07, 0.24, 0.14, 0.14, 0.24], rows: work, cond: 3 });
      } else blocks.push({ t: 'p', text: 'No item has been marked as needing work yet.', muted: true });
    }

    /* quantities */
    if (o.quantities && spaces.length) {
      H1('Rooms and quantities');
      const numFields = U.T.allSpaceFields().filter((fl) => fl.type === 'number' || fl.type === 'calc');
      const used2 = numFields.filter((fl) => spaces.some((sp) => U.fieldText(fl, sp.data || {}) !== ''));
      const nT = Math.ceil(used2.length / 8), per = Math.ceil(used2.length / (nT || 1));
      for (let i = 0; i < used2.length; i += per) {
        const cols = used2.slice(i, i + per);
        const rows = spaces.map((sp, k) => [String(k + 1), U.spaceTitle(sp) + (U.spaceWhere(sp) ? ` (${U.spaceWhere(sp)})` : ''), ...cols.map((fl) => U.fieldText(fl, sp.data || {}))]);
        const tot = ['', 'Total', ...cols.map((fl) => {
          if (/length|breadth|width|height/i.test(fl.label) || ['sp_len', 'sp_bre', 'sp_ht'].includes(fl.id)) return '';
          let s = 0, any = false;
          for (const sp of spaces) { const v = fl.type === 'calc' ? U.calcValue(fl, sp.data || {}) : U.num((sp.data || {})[fl.id]); if (v != null) { s += v; any = true; } }
          return any ? U.fmtNum(s) : '';
        })];
        const w0 = 0.06, w1 = 0.3, wr = (1 - w0 - w1) / cols.length;
        blocks.push({ t: 'table', head: ['No.', 'Room / space', ...cols.map((c) => c.label)], widths: [w0, w1, ...cols.map(() => wr)], rows, total: tot, numeric: true });
      }
      if (!used2.length) blocks.push({ t: 'p', text: 'No sizes or counts entered yet.', muted: true });
    }

    /* work quantities (abstract + measurement) */
    if (U.isQtyOn() && o.qty !== false) {
      const qb = U.qtyBlocks(school, secNo + 1);
      if (qb.length) { blocks.push(...qb); secNo += 2; }
    }

    /* school checklist */
    H1('School checklist');
    for (const sec of T.checklist) {
      const rows = [];
      const secPhotos = [];
      for (const it of sec.items) {
        const r = school.checks[it.id] || {};
        const ph = groupOf('item:' + it.id);
        if (!o.includeBlank && !r.c && !r.q && !r.n && !ph.length) continue;
        const row = [it.no, it.what];
        if (o.includeHow) row.push(it.how || '');
        row.push(U.condLabel(r.c), r.q || '', r.n || '', photoRefs('item:' + it.id));
        rows.push(row);
        secPhotos.push(...takePhotos('item:' + it.id));
      }
      if (!rows.length) continue;
      blocks.push({ t: 'h2', text: sec.title });
      blocks.push(checkTable(rows, o.includeHow));
      if (o.photos && secPhotos.length) {
        const up = secPhotos.filter((x) => x.source === 'upload'), cam = secPhotos.filter((x) => x.source !== 'upload');
        if (up.length) blocks.push({ t: 'photos', items: up, perRow: 1 }); // plans and lists print one per row, large
        if (cam.length) blocks.push({ t: 'photos', items: cam });
      }
    }

    /* each room / space */
    if (spaces.length) {
      H1('Rooms and spaces');
      spaces.forEach((sp, k) => {
        const head = `${secNo}.${k + 1}  ${U.spaceTitle(sp)}`;
        const sub = [U.T.type(sp.typeId).label, U.spaceWhere(sp)].filter(Boolean).join(' · ');
        blocks.push({ t: 'h2', text: head, sub, keep: true });
        const rows = U.fieldsOfSpace(sp).map((fl) => [fl.label, U.fieldText(fl, sp.data || {})]).filter((r) => o.includeBlank || r[1]);
        if (rows.length) blocks.push({ t: 'kv', rows, cols: 4 });
        if (U.spaceUsesChecklist(sp)) {
          const crow = [];
          for (const sec of U.checklistFor(sp)) for (const it of sec.items) {
            const r = (sp.checks && sp.checks[it.id]) || {};
            const key = `si:${sp.id}:${it.id}`;
            if (!o.includeBlank && !r.c && !r.q && !r.n && !groupOf(key).length) continue;
            const row = [it.no, it.what];
            if (o.includeHow) row.push(it.how || '');
            row.push(U.condLabel(r.c), r.q || '', r.n || '', photoRefs(key));
            crow.push(row);
          }
          if (crow.length) blocks.push(checkTable(crow, o.includeHow));
        }
        if (sp.notes) blocks.push({ t: 'p', text: 'Notes: ' + sp.notes });
        if (o.photos) {
          const ph = [...takePhotos('space:' + sp.id)];
          for (const it of U.T.allSpaceChecks()) ph.push(...takePhotos(`si:${sp.id}:${it.id}`));
          ph.sort((a, b2) => (a.no || 0) - (b2.no || 0));
          if (ph.length) blocks.push({ t: 'photos', items: ph });
        }
      });
    }

    /* everything else */
    if (o.photos) {
      const rest = photos.filter((p) => !p.deleted && !used.has(p.id)).sort((a, b2) => (a.no || 0) - (b2.no || 0));
      if (rest.length) { H1('Other photos'); blocks.push({ t: 'photos', items: rest }); }
    }

    if (o.signatures) blocks.push({ t: 'sign', items: ['Surveyed by (name, signature, date)', 'Head Master / Principal (name, signature, date)'] });

    const lh = U.letterhead(school, o, 'School Site Visit');
    return {
      blocks,
      lh,
      title: 'School Site Visit Report',
      school: name,
      header: name,
      footer: b.footerNote || '',
      credit: o.appCredit ? 'Prepared with Infra Upgrades' : '',
      perRow: o.perRow || 2,
      photoSize: o.photoSize || 1400,
      work,
    };

    function checkTable(rows, how) {
      return how
        ? { t: 'table', head: ['No.', 'What to check', 'How to check', 'Condition', 'Count / Size', 'Notes', 'Photos'], widths: [0.06, 0.17, 0.22, 0.12, 0.12, 0.2, 0.11], rows, cond: 3 }
        : { t: 'table', head: ['No.', 'What to check', 'Condition', 'Count / Size', 'Notes', 'Photos'], widths: [0.07, 0.27, 0.15, 0.14, 0.25, 0.12], rows, cond: 2 };
    }
  };

  /* ---------- images for the writers ---------- */
  U.reportPhoto = async (id, maxSide) => {
    const p = await U.DB.photo(id);
    if (!p || !p.blob) return null;
    if (p.source === 'upload' && self.createImageBitmap) {
      /* plans and lists print large and sharp; decoded straight at print size (large files never load in full) */
      const size = Math.max(maxSide || 1400, 2200);
      try {
        const land = (p.ratio || 1) >= 1;
        const bm = await createImageBitmap(p.blob, Object.assign({ imageOrientation: 'from-image', resizeQuality: 'high' }, land ? { resizeWidth: size } : { resizeHeight: size }));
        const c = document.createElement('canvas');
        const k = Math.min(1, size / Math.max(bm.width, bm.height));
        c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bm, 0, 0, c.width, c.height);
        if (bm.close) bm.close();
        const b = await U.canvasToBlob(c, 'image/jpeg', 0.86);
        const out = { bytes: new Uint8Array(await b.arrayBuffer()), w: c.width, h: c.height, p };
        c.width = c.height = 0;
        return out;
      } catch (e) { /* fall back below */ }
    }
    const r = await U.resizeBlob(p.blob, maxSide || 1400, 0.82, 'image/jpeg');
    return { bytes: new Uint8Array(await r.blob.arrayBuffer()), w: r.w, h: r.h, p };
  };
  /* The uploaded logo as PNG (Word/Excel) and JPEG on white (PDF). */
  U.logoImages = async (dataURL) => {
    if (!dataURL) return null;
    const blob = U.dataURLToBlob(dataURL);
    const png = await U.resizeBlob(blob, 600, 0.92, 'image/png');
    const jpg = await U.resizeBlob(blob, 600, 0.92, 'image/jpeg');
    return { png: new Uint8Array(await png.blob.arrayBuffer()), jpg: new Uint8Array(await jpg.blob.arrayBuffer()), w: png.w, h: png.h };
  };

  /* ---------- saving ---------- */
  const TYPES = {
    pdf: { mime: 'application/pdf', ext: '.pdf', desc: 'PDF document' },
    docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx', desc: 'Word document' },
    xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: '.xlsx', desc: 'Excel workbook' },
    backup: { mime: 'application/octet-stream', ext: '.cupg', desc: 'Infra Upgrades backup' },
    zip: { mime: 'application/zip', ext: '.zip', desc: 'ZIP folder' },
  };
  U.FILETYPES = TYPES;
  U.canPickFolder = () => typeof self.showSaveFilePicker === 'function';
  /* Must be called straight from a tap (the browser needs it). Returns a handle, null (cancelled) or false (not supported). */
  U.pickSaveTarget = async (name, kind) => {
    if (!U.canPickFolder()) return false;
    const t = TYPES[kind];
    try {
      return await self.showSaveFilePicker({ suggestedName: name + t.ext, types: [{ description: t.desc, accept: { [t.mime]: [t.ext] } }] });
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
      return false;
    }
  };
  U.writeToHandle = async (handle, blob) => {
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
  };
  U.downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = U.h('a', { href: url, download: filename, style: { display: 'none' } });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
  };
  U.shareBlob = async (blob, filename, mime) => {
    try {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return true; }
    return false;
  };
  /* Can this phone share this exact file? (Chrome on Android shares PDF and pictures, not Word / Excel / zip.) */
  U.canShareFile = (blob, filename, mime) => {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: mime })] })); } catch (e) { return false; }
  };
  /* The "Share / Send" button, or "How to send" when the phone cannot share this kind of file directly. */
  U.sendAction = (blob, filename, mime, savedInFolder, kind) => {
    if (U.canShareFile(blob, filename, mime)) {
      return { label: 'Share / Send', kind, onClick: async () => {
        const ok = await U.shareBlob(blob, filename, mime);
        if (!ok) U.alert(U.sendHelp(filename, savedInFolder), 'How to send');
        return false;
      } };
    }
    return { label: 'How to send', kind, onClick: () => { U.alert(U.sendHelp(filename, savedInFolder), 'How to send this file'); return false; } };
  };
  U.sendHelp = (filename, savedInFolder) =>
    `This phone cannot send this kind of file straight from the app.\n\n1. ${savedInFolder ? 'The file is saved in the folder you chose' : 'Tap “Save file” — it goes to Downloads'}:\n   ${filename}\n2. Open WhatsApp › chat › 📎 › Document (or Gmail › Attach file).\n3. Pick the file from ${savedInFolder ? 'that folder' : 'Downloads'}.\n\nPDF files can be shared directly with “Share / Send”.`;
  U.canShareFiles = () => {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; }
  };
})();
