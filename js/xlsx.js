/* CivilOS Upgrades — Excel (.xlsx) writer with photos placed in the Photos sheet. */
(function () {
  'use strict';
  const U = self.U;
  const S = U.S;
  const X = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const col = (n) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  /* style ids (see styles below) */
  const ST = { normal: 0, head: 1, cell: 2, title: 3, label: 4, num: 5, small: 6, totalLabel: 7, totalNum: 8, sub: 9 };

  class Sheet {
    constructor(name) { this.name = name; this.rows = []; this.widths = []; this.heights = {}; this.merges = []; this.freeze = 0; this.pics = []; }
    set(r, c, v, style) { (this.rows[r] = this.rows[r] || [])[c] = { v, s: style }; }
    rowValues(r, vals, style) { vals.forEach((v, c) => this.set(r, c, v, Array.isArray(style) ? style[c] : style)); }
    xml() {
      const out = [];
      out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
      out.push('<sheetViews><sheetView workbookViewId="0"' + (this.name === 'Summary' ? ' tabSelected="1"' : '') + '>');
      if (this.freeze) out.push(`<pane ySplit="${this.freeze}" topLeftCell="A${this.freeze + 1}" activePane="bottomLeft" state="frozen"/>`);
      out.push('</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>');
      if (this.widths.length) out.push('<cols>' + this.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>');
      out.push('<sheetData>');
      for (let r = 0; r < this.rows.length; r++) {
        const row = this.rows[r];
        const ht = this.heights[r];
        if (!row && !ht) continue;
        out.push(`<row r="${r + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>`);
        if (row) for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (!cell) continue;
          const ref = col(c) + (r + 1);
          const st = cell.s ? ` s="${cell.s}"` : '';
          if (typeof cell.v === 'number' && isFinite(cell.v)) out.push(`<c r="${ref}"${st}><v>${cell.v}</v></c>`);
          else if (cell.v == null || cell.v === '') out.push(`<c r="${ref}"${st}/>`);
          else out.push(`<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${X(cell.v)}</t></is></c>`);
        }
        out.push('</row>');
      }
      out.push('</sheetData>');
      if (this.merges.length) out.push(`<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`);
      out.push('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>');
      out.push('<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>');
      if (this.pics.length) out.push('<drawing r:id="rIdD"/>');
      out.push('</worksheet>');
      return out.join('');
    }
  }

  U.makeXLSX = async (rep, school, photos, progress) => {
    const T = S.template, b = S.settings.brand, o = rep.opts || {};
    const sheets = [];
    const media = [];

    /* 1. Summary */
    const sm = new Sheet('Summary');
    sheets.push(sm);
    sm.widths = [34, 70];
    let r = 0;
    const cover = rep.blocks.find((x) => x.t === 'cover');
    if (cover.logo) {
      try {
        const lg = await U.logoImages(cover.logo);
        const hpx = 60, wpx = Math.round((lg.w / lg.h) * hpx);
        media.push({ name: 'logo.png', bytes: lg.png });
        sm.pics.push({ media: media.length, col: 0, row: 0, w: wpx, h: hpx });
        sm.heights[0] = 50;
        if (cover.company) sm.set(0, 1, cover.company, ST.title);
        r = 2;
      } catch (e) { r = 0; }
    } else if (cover.company) { sm.set(0, 0, cover.company, ST.title); r = 2; }
    sm.set(r++, 0, cover.title, ST.title);
    sm.set(r++, 0, cover.school, ST.sub);
    r++;
    for (const [k, v] of cover.meta) { sm.rowValues(r++, [k, v], [ST.label, ST.cell]); }
    r++;
    for (const sec of T.school) {
      const rows = sec.fields.map((fl) => [fl.label, U.fieldText(fl, school.data)]).filter((x) => o.includeBlank || x[1]);
      if (!rows.length) continue;
      sm.set(r++, 0, sec.title, ST.sub);
      for (const [k, v] of rows) {
        const n = U.num(v);
        sm.rowValues(r++, [k, n != null && /^-?[\d.]+$/.test(String(v)) && String(v).length < 12 ? n : v], [ST.label, n != null ? ST.num : ST.cell]);
      }
      r++;
    }

    /* 2. Work required */
    const wk = new Sheet('Work required');
    sheets.push(wk);
    wk.widths = [26, 8, 36, 18, 22, 50];
    wk.rowValues(0, ['Location', 'No.', 'Item', 'Condition', 'Count / Size', 'Notes'], ST.head);
    wk.freeze = 1;
    rep.work.forEach((w, i) => wk.rowValues(i + 1, w, ST.cell));

    /* 3. School checklist */
    const ck = new Sheet('School checklist');
    sheets.push(ck);
    ck.widths = [30, 8, 34, 50, 18, 22, 44, 18];
    ck.rowValues(0, ['Section', 'No.', 'What to check', 'How to check', 'Condition', 'Count / Size', 'Notes', 'Photos'], ST.head);
    ck.freeze = 1;
    const groups = U.photoGroups(photos);
    const refs = (k) => (groups.get(k) || []).map(U.photoNo).join(', ');
    r = 1;
    for (const sec of T.checklist) for (const it of sec.items) {
      const v = school.checks[it.id] || {};
      if (!o.includeBlank && !v.c && !v.q && !v.n && !refs('item:' + it.id)) continue;
      ck.rowValues(r++, [sec.title, it.no, it.what, it.how, U.condLabel(v.c), v.q || '', v.n || '', refs('item:' + it.id)], ST.cell);
    }

    /* 4. Rooms & spaces (all fields as columns, totals at the bottom) */
    const spaces = U.liveSpaces(school);
    const sp = new Sheet('Rooms & spaces');
    sheets.push(sp);
    const sf = U.T.allSpaceFields();
    sp.widths = [6, 28, 22, 12, 12, ...sf.map((fl) => (fl.type === 'multi' ? 34 : 13)), 40, 14];
    sp.rowValues(0, ['No.', 'Room / space', 'Type', 'Block', 'Floor', ...sf.map((fl) => fl.label), 'Notes', 'Photos'], ST.head);
    sp.heights[0] = 45;
    sp.freeze = 1;
    spaces.forEach((s, i) => {
      const nphotos = photos.filter((p) => !p.deleted && (p.target === 'space:' + s.id || p.target.startsWith('si:' + s.id + ':'))).length;
      sp.rowValues(i + 1, [i + 1, U.spaceTitle(s), U.T.type(s.typeId).label, s.block || '', s.floor || '',
        ...sf.map((fl) => {
          if (fl.type === 'number') return U.num((s.data || {})[fl.id]) == null ? '' : U.num(s.data[fl.id]);
          if (fl.type === 'calc') { const v = U.calcValue(fl, s.data || {}); return v == null ? '' : U.round(v, 2); }
          return U.fieldText(fl, s.data || {});
        }), s.notes || '', nphotos],
      [ST.cell, ST.cell, ST.cell, ST.cell, ST.cell, ...sf.map((fl) => (fl.type === 'number' || fl.type === 'calc' ? ST.num : ST.cell)), ST.cell, ST.num]);
    });
    if (spaces.length) {
      const tr = spaces.length + 1;
      sp.set(tr, 1, 'Total', ST.totalLabel);
      sf.forEach((fl, k) => {
        if (!(fl.type === 'number' || fl.type === 'calc') || fl.id === 'sp_ht') return;
        let s = 0, any = false;
        for (const x of spaces) { const v = fl.type === 'calc' ? U.calcValue(fl, x.data || {}) : U.num((x.data || {})[fl.id]); if (v != null) { s += v; any = true; } }
        if (any) sp.set(tr, 5 + k, U.round(s, 2), ST.totalNum);
      });
    }

    /* 5. Room checklist */
    const rc = new Sheet('Room checklist');
    sheets.push(rc);
    rc.widths = [26, 30, 8, 34, 18, 22, 44, 18];
    rc.rowValues(0, ['Room / space', 'Section', 'No.', 'What to check', 'Condition', 'Count / Size', 'Notes', 'Photos'], ST.head);
    rc.freeze = 1;
    r = 1;
    for (const s of spaces) {
      if (!U.spaceUsesChecklist(s)) continue;
      for (const sec of T.roomChecklist) for (const it of sec.items) {
        const v = (s.checks && s.checks[it.id]) || {};
        const key = `si:${s.id}:${it.id}`;
        if (!o.includeBlank && !v.c && !v.q && !v.n && !refs(key)) continue;
        rc.rowValues(r++, [U.spaceTitle(s), sec.title, it.no, it.what, U.condLabel(v.c), v.q || '', v.n || '', refs(key)], ST.cell);
      }
    }

    /* 6. Photos with pictures */
    const live = photos.filter((p) => !p.deleted).sort((a, c) => (a.no || 0) - (c.no || 0));
    if (o.photos !== false && live.length) {
      const ph = new Sheet('Photos');
      sheets.push(ph);
      ph.widths = [9, 26, 30, 30, 13, 13, 17, 48];
      ph.rowValues(0, ['Photo No.', 'Room / space', 'Checklist item', 'Caption', 'Latitude', 'Longitude', 'Date / time', 'Photo'], ST.head);
      ph.freeze = 1;
      const itemName = new Map();
      for (const sec of T.checklist) for (const it of sec.items) itemName.set('item:' + it.id, `${it.no} ${it.what}`);
      const roomItem = new Map(U.T.allRoomChecks().map((it) => [it.id, `${it.no} ${it.what}`]));
      const spaceName = new Map(spaces.map((s) => [s.id, U.spaceTitle(s)]));
      for (let i = 0; i < live.length; i++) {
        const p = live[i];
        let where = 'School', item = '';
        if (p.target.startsWith('item:')) item = itemName.get(p.target) || '';
        else if (p.target.startsWith('space:')) where = spaceName.get(p.target.slice(6)) || 'Room (removed)';
        else if (p.target.startsWith('si:')) { const [, sid, iid] = p.target.split(':'); where = spaceName.get(sid) || 'Room (removed)'; item = roomItem.get(iid) || ''; }
        const rr = i + 1;
        ph.rowValues(rr, [U.photoNo(p), where, item, [p.caption || p.place, p.tag].filter(Boolean).join(' · '),
          p.lat != null ? U.round(p.lat, 6) : '', p.lng != null ? U.round(p.lng, 6) : '', U.fmtDateTime(p.ts), ''],
        [ST.cell, ST.cell, ST.cell, ST.cell, ST.num, ST.num, ST.cell, ST.cell]);
        ph.heights[rr] = 190;
        try {
          const im = await U.reportPhoto(p.id, Math.min(rep.photoSize, 1000));
          if (im) {
            media.push({ name: `photo${media.length + 1}.jpeg`, bytes: im.bytes });
            const maxW = 330, maxH = 240;
            const s = Math.min(maxW / im.w, maxH / im.h);
            ph.pics.push({ media: media.length, col: 7, row: rr, w: Math.round(im.w * s), h: Math.round(im.h * s) });
          }
        } catch (e) { /* skip */ }
        if (progress) progress('Adding photos ' + (i + 1) + ' / ' + live.length, 0.1 + 0.8 * ((i + 1) / live.length));
      }
    }

    if (progress) progress('Making the Excel file…', 0.94);
    const z = new U.ZipWriter();
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.##"/></numFmts>
<fonts count="5"><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="15"/><name val="Arial"/><family val="2"/></font><font><sz val="9"/><color rgb="FF6E6E6E"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="12"/><name val="Arial"/><family val="2"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEBEBEB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF6F6F6"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFA0A0A0"/></left><right style="thin"><color rgb="FFA0A0A0"/></right><top style="thin"><color rgb="FFA0A0A0"/></top><bottom style="thin"><color rgb="FFA0A0A0"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
    const ct = [];
    const wbSheets = [];
    const wbRels = [];
    let drawN = 0;
    for (let i = 0; i < sheets.length; i++) {
      const sh = sheets[i];
      const n = i + 1;
      await z.add(`xl/worksheets/sheet${n}.xml`, sh.xml());
      ct.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
      wbSheets.push(`<sheet name="${X(sh.name)}" sheetId="${n}" r:id="rId${n}"/>`);
      wbRels.push(`<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`);
      if (sh.pics.length) {
        drawN++;
        const d = drawN;
        await z.add(`xl/worksheets/_rels/sheet${n}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdD" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${d}.xml"/></Relationships>`);
        const anchors = sh.pics.map((p, k) => `<xdr:oneCellAnchor><xdr:from><xdr:col>${p.col}</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>${p.row}</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:ext cx="${p.w * 9525}" cy="${p.h * 9525}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${k + 2}" name="Picture ${k + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rIdP${k + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${p.w * 9525}" cy="${p.h * 9525}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`).join('');
        await z.add(`xl/drawings/drawing${d}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`);
        await z.add(`xl/drawings/_rels/drawing${d}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sh.pics.map((p, k) => `<Relationship Id="rIdP${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media[p.media - 1].name}"/>`).join('')}</Relationships>`);
        ct.push(`<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      }
    }
    for (const m of media) { await z.add('xl/media/' + m.name, m.bytes, false); m.bytes = null; }
    const ns = sheets.length;
    wbRels.push(`<Relationship Id="rId${ns + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
    await z.add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${wbSheets.join('')}</sheets></workbook>`);
    await z.add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join('')}</Relationships>`);
    await z.add('xl/styles.xml', styles);
    await z.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    await z.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ct.join('')}</Types>`);
    return z.blob(U.FILETYPES.xlsx.mime);
  };
})();
