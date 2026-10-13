/* Infra Upgrades — room-wise export: photos with remarks and data, per room.
   One file with each room on its own page, a separate file per room, or just the photos (JPG) in a folder per room. */
(function () {
  'use strict';
  const U = self.U, S = U.S, h = U.h;
  const BAD = new Set(['repair', 'replace', 'notavail', 'rebuild']);

  /* groups: 'school' or a space id, in order */
  U.exportGroups = (s) => {
    const out = [];
    const ph = (S.photos || []).filter((p) => !p.deleted);
    const nSchool = ph.filter((p) => p.target === 'school' || p.target.startsWith('item:')).length;
    out.push({ key: 'school', name: 'School — general & checklist photos', photos: nSchool });
    for (const sp of U.liveSpaces(s)) {
      out.push({ key: sp.id, name: U.spaceTitle(sp), sub: [U.T.type(sp.typeId).label, U.spaceWhere(sp)].filter(Boolean).join(' · '),
        photos: ph.filter((p) => p.target === 'space:' + sp.id || p.target.startsWith(`si:${sp.id}:`)).length });
    }
    return out;
  };
  const photosOfGroup = (photos, key) => photos.filter((p) => !p.deleted && (key === 'school'
    ? p.target === 'school' || p.target.startsWith('item:')
    : p.target === 'space:' + key || p.target.startsWith(`si:${key}:`))).sort((a, b) => (a.no || 0) - (b.no || 0));
  const groupName = (s, key) => (key === 'school' ? 'School — general and checklist photos' : U.spaceTitle(s.spaces.find((x) => x.id === key) || {}));

  /* remarks rows [No, Item, Condition, Count/Size, Notes, Photos] for a group */
  function remarks(s, key, photos, onlyWithPhotos) {
    const rows = [];
    const refs = (t) => photos.filter((p) => p.target === t).map(U.photoNo).join(', ');
    if (key === 'school') {
      for (const it of U.T.allChecks()) {
        const r = s.checks[it.id] || {};
        const pr = refs('item:' + it.id);
        if (onlyWithPhotos ? !pr : !(r.c || r.q || r.n || pr)) continue;
        rows.push([it.no, it.what, U.condLabel(r.c), r.q || '', r.n || '', pr]);
      }
    } else {
      const sp = s.spaces.find((x) => x.id === key);
      if (sp) for (const it of U.checksOf(sp)) {
        const r = (sp.checks && sp.checks[it.id]) || {};
        const pr = refs(`si:${key}:${it.id}`);
        if (!(r.c || r.q || r.n || pr)) continue;
        rows.push([it.no, it.what, U.condLabel(r.c), r.q || '', r.n || '', pr]);
      }
    }
    return rows;
  }

  U.buildRoomReport = (s, photos, keys, o) => {
    const b = S.settings.brand;
    const meta = [];
    const place = U.schoolPlace(s);
    if (place) meta.push(['Location', place]);
    if (s.data.sd_date) meta.push(['Date of visit', U.fmtDate(s.data.sd_date)]);
    if (b.writer || s.data.sd_engineer) meta.push(['Report by', [b.writer || s.data.sd_engineer, b.designation].filter(Boolean).join(', ')]);
    meta.push(['Report date', U.fmtDate(Date.now())]);
    if (keys.length === 1) meta.unshift(['Room / space', groupName(s, keys[0])]);
    const blocks = [{ t: 'cover', title: 'Room-wise Photos and Remarks', school: U.schoolName(s), meta }];
    keys.forEach((key, i) => {
      if (i > 0) blocks.push({ t: 'pb' });
      const ph = photosOfGroup(photos, key);
      if (key === 'school') {
        blocks.push({ t: 'h1', text: `${i + 1}. School — general and checklist photos` });
      } else {
        const sp = s.spaces.find((x) => x.id === key);
        blocks.push({ t: 'h1', text: `${i + 1}. ${U.spaceTitle(sp)}` });
        const sub = [U.T.type(sp.typeId).label, U.spaceWhere(sp)].filter(Boolean).join(' · ');
        if (sub) blocks.push({ t: 'p', text: sub, muted: true });
        if (o.data) {
          const rows = U.fieldsOfSpace(sp).map((fl) => [fl.label, U.fieldText(fl, sp.data || {})]).filter((r) => r[1]);
          if (rows.length) blocks.push({ t: 'kv', rows, cols: 4 });
        }
      }
      if (o.remarks) {
        const rows = remarks(s, key, ph, key === 'school');
        if (rows.length) blocks.push({ t: 'table', head: ['No.', 'Item', 'Condition', 'Count / Size', 'Remarks', 'Photos'], widths: [0.07, 0.25, 0.14, 0.14, 0.28, 0.12], rows, cond: 2 });
        const sp = s.spaces.find((x) => x.id === key);
        if (sp && sp.notes) blocks.push({ t: 'p', text: 'Remarks: ' + sp.notes });
      }
      if (ph.length) blocks.push({ t: 'photos', items: ph });
      else blocks.push({ t: 'p', text: 'No photos.', muted: true });
    });
    return {
      blocks, title: 'Room-wise Photos and Remarks', school: U.schoolName(s), lh: U.letterhead(s, o, 'Room-wise Photos and Remarks'),
      header: U.schoolName(s), footer: b.footerNote || '',
      credit: o.appCredit ? 'Prepared with Infra Upgrades' : '', perRow: o.perRow || 2, photoSize: o.photoSize || 1400, work: [],
    };
  };

  /* Just the photos, a folder per room, with a remarks text file in each folder and one list for all. */
  U.makePhotosZip = async (s, photos, keys, o, progress) => {
    const z = new U.ZipWriter();
    const csv = [['Folder', 'Photo No.', 'Location', 'Caption', 'Tag', 'Latitude', 'Longitude', 'Date / time', 'File']];
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    let done = 0;
    const total = keys.reduce((a, k) => a + photosOfGroup(photos, k).length, 0) || 1;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const folder = `${U.pad(i + 1)} ${U.safeFileName(groupName(s, key))}`;
      const ph = photosOfGroup(photos, key);
      const lines = [U.schoolName(s), groupName(s, key), ''];
      if (key !== 'school') {
        const sp = s.spaces.find((x) => x.id === key);
        const where = [U.T.type(sp.typeId).label, U.spaceWhere(sp)].filter(Boolean).join(' · ');
        if (where) lines.push(where, '');
        if (o.data) for (const fl of U.fieldsOfSpace(sp)) { const v = U.fieldText(fl, sp.data || {}); if (v) lines.push(`${fl.label}: ${v}`); }
        if (sp.notes) lines.push('', 'Remarks: ' + sp.notes);
      }
      if (o.remarks) {
        const rows = remarks(s, key, ph, key === 'school');
        if (rows.length) { lines.push('', 'Checklist remarks:'); for (const r of rows) lines.push(`  ${r[0]} ${r[1]} — ${[r[2], r[3], r[4]].filter(Boolean).join(' · ')}${r[5] ? '  [' + r[5] + ']' : ''}`); }
      }
      lines.push('', 'Photos:');
      for (const p of ph) {
        const full = await U.DB.photo(p.id);
        const label = U.safeFileName([U.photoNo(p), p.caption || U.targetLabel(s, p.target), p.tag].filter(Boolean).join(' - ')).slice(0, 90);
        const file = `${label}.jpg`;
        if (full && full.blob) await z.add(`${folder}/${file}`, full.blob, false);
        lines.push(`  ${U.photoNo(p)}  ${p.caption || U.targetLabel(s, p.target)}${p.tag ? ' · ' + p.tag : ''}  |  ${U.photoSub(p)}`);
        csv.push([folder, U.photoNo(p), U.targetLabel(s, p.target), p.caption || '', p.tag || '', p.lat != null ? p.lat : '', p.lng != null ? p.lng : '', U.fmtDateTime(p.ts), file]);
        done++;
        if (progress) progress(`Adding photos ${done} / ${total}`, done / total);
      }
      await z.add(`${folder}/Remarks.txt`, '﻿' + lines.join('\r\n'));
    }
    await z.add('Photo list.csv', '﻿' + csv.map((r) => r.map(q).join(',')).join('\r\n'));
    return z.blob('application/zip');
  };

  /* Pick folder/name first (needs the tap), then build, then save or offer Save / Share. */
  U.saveGenerated = async (kind, name, make) => {
    name = U.safeFileName(name);
    const t = U.FILETYPES[kind];
    let handle = false;
    if (U.canPickFolder()) {
      handle = await U.pickSaveTarget(name, kind);
      if (handle === null) return;
    }
    await U.flushSave();
    const busy = U.busy('Preparing…');
    let blob;
    try {
      blob = await make((m, f) => busy.set(m, f));
      if (handle) { busy.set('Saving to your folder…', 1); await U.writeToHandle(handle, blob); }
    } catch (e) {
      busy.done();
      U.alert('The file could not be made: ' + (e.message || e) + '\n\nYour data is safe. Try fewer rooms or “Small file” photo quality.');
      return;
    }
    busy.done();
    const filename = (handle && handle.name) || name + t.ext;
    const actions = [];
    if (!handle) actions.push({ label: 'Save file', kind: 'primary', onClick: () => { U.downloadBlob(blob, filename); U.toast('Saved to Downloads: ' + filename, 4000); return false; } });
    actions.push(U.sendAction(blob, filename, t.mime, !!handle, handle ? 'primary' : ''));
    actions.push({ label: 'Close', kind: 'ghost' });
    U.modal({ title: 'File ready', body: [h('p', h('b', filename)), h('p.muted', `${t.desc} · ${U.fmtBytes(blob.size)}`),
      kind === 'zip' ? h('p.small.muted', 'This is a .zip folder. On the phone, open it in the Files app and tap “Extract”. On a laptop, right-click › Extract all.') : null], actions });
  };

  /* what: 'report' | 'photos'; fmt: 'pdf' | 'docx'; separate: one file per room (inside a zip) */
  U.exportRooms = async (s, keys, o) => {
    if (!keys.length) { U.toast('Choose at least one room'); return; }
    const one = keys.length === 1 ? U.safeFileName(groupName(s, keys[0])) : 'Room-wise';
    const base = `${U.schoolName(s)} - ${one} - ${o.what === 'photos' ? 'Photos' : 'Photos and remarks'}`;
    const make = async (prog) => {
      const photos = U.reportablePhotos(s, await U.loadPhotos(s));
      if (o.what === 'photos') return U.makePhotosZip(s, photos, keys, o, prog);
      const writer = o.fmt === 'docx' ? U.makeDOCX : U.makePDF;
      if (!o.separate || keys.length === 1) return writer(U.buildRoomReport(s, photos, keys, Object.assign({}, o, { docName: base })), prog);
      const z = new U.ZipWriter();
      for (let i = 0; i < keys.length; i++) {
        prog(`Room ${i + 1} of ${keys.length}: ${groupName(s, keys[i])}`, i / keys.length);
        const blob = await writer(U.buildRoomReport(s, photos, [keys[i]], Object.assign({}, o, { docName: U.safeFileName(U.schoolName(s) + ' - ' + groupName(s, keys[i])) })));
        await z.add(`${U.pad(i + 1)} ${U.safeFileName(groupName(s, keys[i]))}${U.FILETYPES[o.fmt].ext}`, blob, false);
      }
      return z.blob('application/zip');
    };
    const kind = o.what === 'photos' || (o.separate && keys.length > 1) ? 'zip' : o.fmt;
    await U.saveGenerated(kind, base, make);
  };

  /* Photos only (JPG, a folder per room) — all rooms with photos, or the given ones */
  U.downloadPhotos = (s, keys) => U.exportRooms(s, keys || U.exportGroups(s).filter((g) => g.photos > 0).map((g) => g.key),
    Object.assign({}, S.settings.roomExport || {}, { what: 'photos', data: true, remarks: true }));
  U.roomReportNow = (s, key) => U.exportRooms(s, [key], Object.assign({}, S.settings.roomExport || {}, {
    what: 'report', separate: false, fmt: (S.settings.roomExport || {}).fmt || 'pdf', data: true, remarks: true,
    brand: S.settings.brand.show && !!(S.settings.brand.company || S.settings.brand.logo),
    perRow: S.settings.report.photosPerRow, photoSize: S.settings.report.photoSize, appCredit: S.settings.report.appCredit }));

  /* The card on the Report tab */
  U.roomExportCard = (s) => {
    const r = S.settings.report;
    const st = S.settings.roomExport = S.settings.roomExport || { what: 'report', fmt: 'pdf', separate: false, data: true, remarks: true };
    const groups = U.exportGroups(s);
    const opts = () => Object.assign({}, st, { brand: S.settings.brand.show && !!(S.settings.brand.company || S.settings.brand.logo), perRow: r.photosPerRow, photoSize: r.photoSize, appCredit: r.appCredit });
    const chosen = new Set(groups.filter((g) => g.photos > 0 || g.key !== 'school').map((g) => g.key));
    const seg = (items, key, redraw) => {
      const el = h('div.seg');
      const draw = () => { U.clear(el); items.forEach(([k, l]) => el.append(h('button' + (st[key] === k ? '.on' : ''), { onclick: () => { st[key] = k; U.saveSettings(); draw(); redraw && redraw(); } }, l))); };
      draw();
      return el;
    };
    const fmtRow = h('div.field', h('div.lbl', 'File type'), seg([['pdf', 'PDF'], ['docx', 'Word']], 'fmt'));
    const sepRow = h('div.field', h('div.lbl', 'Files'), seg([[false, 'One file (each room on new page)'], [true, 'Separate file per room']], 'separate'));
    const showHide = () => { fmtRow.hidden = sepRow.hidden = st.what === 'photos'; };
    const whatRow = h('div.field', h('div.lbl', 'What to export'), seg([['report', 'Photos + remarks report'], ['photos', 'Photos only (JPG folders)']], 'what', showHide));
    showHide();
    const sw = (key, label) => { const c = h('input', { type: 'checkbox', checked: !!st[key] }); c.addEventListener('change', () => { st[key] = c.checked; U.saveSettings(); }); return h('label.switch', h('span', label), c); };
    const list = h('div');
    const drawList = () => {
      U.clear(list);
      const all = h('input', { type: 'checkbox', checked: groups.every((g) => chosen.has(g.key)) });
      all.addEventListener('change', () => { groups.forEach((g) => (all.checked ? chosen.add(g.key) : chosen.delete(g.key))); drawList(); });
      list.append(h('label.switch', h('span', h('b', 'All rooms and spaces')), all));
      for (const g of groups) {
        const c = h('input', { type: 'checkbox', checked: chosen.has(g.key) });
        c.addEventListener('change', () => { if (c.checked) chosen.add(g.key); else chosen.delete(g.key); });
        list.append(h('label.switch', h('span', g.name, h('div.small.muted', [g.sub, `${g.photos} photo${g.photos === 1 ? '' : 's'}`].filter(Boolean).join(' · '))), c));
      }
    };
    drawList();
    return h('div.card#room-export',
      h('h3', 'Room-wise export'),
      h('p.small.muted', 'Photos with remarks and data of each room — all together, or a separate file for each room.'),
      whatRow, fmtRow, sepRow,
      sw('data', 'Include room data (sizes, counts, work needed)'),
      sw('remarks', 'Include remarks (checklist notes and room remarks)'),
      h('div.lbl.small', { style: { margin: '12px 0 4px', fontWeight: 700 } }, 'Rooms'),
      list,
      h('div.row', { style: { marginTop: '12px', gap: '8px' } },
        h('button.btn.soft.grow', { onclick: async () => {
          const keys = groups.map((g) => g.key).filter((k) => chosen.has(k));
          if (!keys.length) { U.toast('Choose at least one room'); return; }
          const o = opts();
          const rep = U.buildRoomReport(s, U.reportablePhotos(s, await U.loadPhotos(s)), keys, o);
          U.previewReport(rep, { title: 'Room-wise export', note: st.what === 'photos' ? 'Preview of the photos and remarks. The export gives the JPG files in a folder per room.' : null, onSave: () => U.exportRooms(s, keys, o) });
        } }, U.icon('doc'), 'Preview'),
        h('button.btn.primary.grow', { onclick: () => {
          const keys = groups.map((g) => g.key).filter((k) => chosen.has(k));
          U.exportRooms(s, keys, opts());
        } }, U.icon('download'), 'Export')));
  };
})();
