/* Infra Upgrades — work quantities (optional: Settings › Work quantities).
   Each line: item + Nos × L × B × H as its kind needs. The school total of every item is worked out,
   and Excel gets real formulas (PRODUCT per line, SUMIFS in the abstract). */
(function () {
  'use strict';
  const U = self.U, S = U.S, h = U.h;

  const CALC = {
    area: { label: 'Area — Nos × Length × Breadth', need: ['l', 'b'], dims: ['nos', 'l', 'b'] },
    wall: { label: 'Wall / vertical area — Nos × Length × Height', need: ['l', 'h'], dims: ['nos', 'l', 'h'] },
    vol: { label: 'Volume — Nos × Length × Breadth × Height/Depth', need: ['l', 'b', 'h'], dims: ['nos', 'l', 'b', 'h'] },
    len: { label: 'Length — Nos × Length', need: ['l'], dims: ['nos', 'l'] },
    nos: { label: 'Count — Nos', need: ['nos'], dims: ['nos'] },
  };
  U.QTY_CALC = CALC;
  const DIM_LABEL = { nos: 'Nos', l: 'Length (m)', b: 'Breadth (m)', h: 'Height / depth (m)' };

  U.isQtyOn = () => !!(S.settings.qty && S.settings.qty.on);
  U.qtyCatalog = () => S.template.qtyCatalog || [];
  U.qtyLines = (s, loc) => (s.qty || []).filter((x) => !x.deleted && (loc == null || x.loc === loc));

  /* the quantity of one line, or null when a needed size is missing */
  U.qtyValue = (ln) => {
    const c = CALC[ln.calc] || CALC.nos;
    for (const d of c.need) if (U.num(ln[d]) == null) return null;
    let v = 1;
    for (const d of c.dims) { const n = U.num(ln[d]); if (n != null) v *= n; }
    return v;
  };
  U.qtyFormulaText = (ln) => {
    const c = CALC[ln.calc] || CALC.nos;
    const parts = c.dims.filter((d) => U.num(ln[d]) != null).map((d) => U.fmtNum(U.num(ln[d])));
    const v = U.qtyValue(ln);
    return v == null ? 'size missing' : `${parts.join(' × ') || '1'} = ${U.fmtNum(U.round(v, 3))} ${ln.unit}`;
  };
  U.qtyWhere = (s, ln) => {
    if (ln.loc === 'school') return ln.where || 'School (general)';
    const sp = (s.spaces || []).find((x) => x.id === ln.loc);
    return sp ? U.spaceTitle(sp) + (U.spaceWhere(sp) ? ` (${U.spaceWhere(sp)})` : '') : 'Room (removed)';
  };
  /* rows for reports: lines of live rooms + school-level lines, in room order */
  U.qtyRows = (s) => {
    const live = new Set(U.liveSpaces(s).map((x) => x.id));
    const order = ['school'].concat(U.liveSpaces(s).map((x) => x.id));
    return U.qtyLines(s).filter((ln) => ln.loc === 'school' || live.has(ln.loc))
      .sort((a, b) => order.indexOf(a.loc) - order.indexOf(b.loc) || (a.ts || 0) - (b.ts || 0));
  };
  /* totals by item + unit, in catalogue order */
  U.qtyAbstract = (s) => {
    const rows = U.qtyRows(s);
    const map = new Map();
    const catOrder = U.qtyCatalog().map((c) => c.name);
    for (const ln of rows) {
      const key = ln.name + '|' + ln.unit;
      if (!map.has(key)) map.set(key, { cat: ln.cat || 'Other works', name: ln.name, unit: ln.unit, total: 0, lines: 0, missing: 0 });
      const g = map.get(key);
      const v = U.qtyValue(ln);
      g.lines++;
      if (v == null) g.missing++; else g.total += v;
    }
    return [...map.values()].sort((a, b) => (catOrder.indexOf(a.cat) + 99) % 99 - (catOrder.indexOf(b.cat) + 99) % 99 || a.name.localeCompare(b.name));
  };

  /* sizes of the room, offered with one tap */
  function roomSize(s, loc, calc) {
    const sp = (s.spaces || []).find((x) => x.id === loc);
    if (!sp) return null;
    const L = U.num(sp.data && sp.data.sp_len), B = U.num(sp.data && sp.data.sp_bre), H = U.num(sp.data && sp.data.sp_ht);
    const g = U.T.group(sp);
    if (calc === 'area' && L != null && B != null) return { l: L, b: B, note: 'floor / ceiling area' };
    if (calc === 'wall' && H != null && L != null) return g === 'wall' ? { l: L, h: H, note: 'one face' } : (B != null ? { l: U.round(2 * (L + B), 3), h: H, note: 'all walls (perimeter × height)' } : null);
    if (calc === 'vol' && L != null && B != null && H != null) return { l: L, b: B, h: H, note: 'room volume' };
    if (calc === 'len' && L != null) return { l: L, note: 'length' };
    return null;
  }

  /* add / edit one line */
  U.qtyEdit = (s, loc, line, onDone) => {
    const isNew = !line;
    const cats = U.qtyCatalog();
    line = line ? Object.assign({}, line) : { id: U.uid('q'), loc, cat: cats[0] ? cats[0].name : 'Other works', item: '', name: '', unit: 'sq.m', calc: 'area', nos: '', l: '', b: '', h: '', rem: '', where: '' };
    const catSel = h('select.inp', cats.map((c) => h('option', { value: c.id, selected: c.name === line.cat }, c.name)), h('option', { value: '_own', selected: !cats.some((c) => c.name === line.cat) }, 'Other (type your own)'));
    const itemSel = h('select.inp');
    const name = h('input.inp', { placeholder: 'Work item' }); name.value = line.name;
    const unit = h('input.inp', { placeholder: 'sq.m / cu.m / m / nos / kg' }); unit.value = line.unit;
    const calcSel = h('select.inp', Object.keys(CALC).map((k) => h('option', { value: k, selected: line.calc === k }, CALC[k].label)));
    const ownBox = h('div', h('div.field', h('label', 'Work item'), name), h('div.grid2', h('div.field', h('label', 'Unit'), unit), h('div.field', h('label', 'How to work out'), calcSel)));
    const dimBox = h('div.qty-dims');
    const ins = {};
    for (const d of ['nos', 'l', 'b', 'h']) { ins[d] = h('input.inp', { inputmode: 'decimal', placeholder: d === 'nos' ? '1' : '' }); ins[d].value = line[d] != null ? line[d] : ''; }
    const result = h('div.qty-result');
    const where = h('input.inp', { placeholder: 'e.g. Terrace, Boundary wall north side' }); where.value = line.where || '';
    const rem = h('input.inp', { placeholder: 'Remarks (optional)' }); rem.value = line.rem || '';
    const fromRoom = h('button.btn.small.soft', { type: 'button' }, U.icon('room'), 'Use room size');
    const cat = () => cats.find((c) => c.id === catSel.value);
    const fillItems = () => {
      U.clear(itemSel);
      const c = cat();
      if (c) for (const it of c.items) itemSel.append(h('option', { value: it.id, selected: it.id === line.item }, `${it.name} (${it.unit})`));
      itemSel.append(h('option', { value: '_own', selected: !c || !c.items.some((it) => it.id === line.item) && !!line.name }, 'Other (type your own)'));
      sync();
    };
    const picked = () => { const c = cat(); return c && c.items.find((it) => it.id === itemSel.value); };
    const sync = () => {
      const it = picked();
      ownBox.hidden = !!it;
      if (it) { line.item = it.id; line.name = it.name; line.unit = it.unit; line.calc = it.calc; } else { line.item = ''; line.name = name.value.trim(); line.unit = unit.value.trim() || 'nos'; line.calc = calcSel.value; }
      line.cat = cat() ? cat().name : 'Other works';
      U.clear(dimBox);
      for (const d of (CALC[line.calc] || CALC.nos).dims) dimBox.append(h('div.field', h('label', DIM_LABEL[d]), ins[d]));
      const rs = loc !== 'school' ? roomSize(s, loc, line.calc) : null;
      fromRoom.hidden = !rs;
      fromRoom.title = rs ? rs.note : '';
      calc();
    };
    const calc = () => { for (const d of ['nos', 'l', 'b', 'h']) line[d] = ins[d].value.replace(/[^\d.\-]/g, ''); result.textContent = U.qtyFormulaText(line); };
    fromRoom.addEventListener('click', () => { const rs = roomSize(s, loc, line.calc); if (!rs) return; for (const d of ['l', 'b', 'h']) if (rs[d] != null) ins[d].value = rs[d]; calc(); U.toast('Filled from room size: ' + rs.note); });
    catSel.addEventListener('change', fillItems); itemSel.addEventListener('change', sync);
    [name, unit].forEach((x) => x.addEventListener('input', sync)); calcSel.addEventListener('change', sync);
    for (const d of ['nos', 'l', 'b', 'h']) ins[d].addEventListener('input', calc);
    fillItems();
    U.modal({ title: isNew ? 'Add work quantity' : 'Edit work quantity', wide: true,
      body: [h('div.grid2', h('div.field', h('label', 'Category'), catSel), h('div.field', h('label', 'Item'), itemSel)), ownBox,
        loc === 'school' ? h('div.field', h('label', 'Where'), where) : null,
        h('div.row', { style: { justifyContent: 'space-between' } }, h('b', 'Measurements'), fromRoom), dimBox, result, h('div.field', h('label', 'Remarks'), rem)],
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: isNew ? 'Add' : 'Save', kind: 'primary', onClick: () => {
        sync();
        if (!line.name) { U.toast('Choose or type the work item'); return false; }
        line.rem = rem.value.trim(); line.where = where.value.trim(); line.ts = line.ts || Date.now();
        s.qty = s.qty || [];
        const i = s.qty.findIndex((x) => x.id === line.id);
        if (i >= 0) s.qty[i] = line; else s.qty.push(line);
        U.touch(s);
        onDone && onDone();
      } }] });
  };

  /* the card in a room (loc = space id) or on the Quantities tab (loc = 'school') */
  U.qtyCard = (s, loc) => {
    const list = h('div');
    const draw = () => {
      U.clear(list);
      const lines = U.qtyLines(s, loc);
      if (!lines.length) list.append(h('p.small.muted', { style: { margin: '0 0 8px' } }, 'No quantities yet. Add plaster, painting, flooring, waterproofing, rebuild … with sizes.'));
      for (const ln of lines) {
        const v = U.qtyValue(ln);
        list.append(h('div.qty-line',
          h('div.grow', h('b', ln.name), h('div.small.muted', [ln.loc === 'school' && ln.where ? ln.where : null, ln.cat].filter(Boolean).join(' · ')),
            h('div.small' + (v == null ? '.qty-miss' : ''), U.qtyFormulaText(ln)), ln.rem ? h('div.small.muted', ln.rem) : null),
          h('button.icon-btn', { 'aria-label': 'Edit', onclick: () => U.qtyEdit(s, loc, ln, draw) }, U.icon('edit')),
          h('button.icon-btn', { 'aria-label': 'Copy', title: 'Copy this line', onclick: () => { const c = Object.assign({}, ln, { id: U.uid('q'), ts: Date.now() }); s.qty.push(c); U.touch(s); draw(); } }, U.icon('copy')),
          h('button.icon-btn', { 'aria-label': 'Remove', style: { color: 'var(--bad)' }, onclick: async () => {
            if (!(await U.confirm(`Remove “${ln.name}”?`, { ok: 'Remove', danger: true }))) return;
            const x = s.qty.find((y) => y.id === ln.id); if (x) x.deleted = Date.now();
            U.touch(s); draw();
          } }, U.icon('trash'))));
      }
    };
    draw();
    return h('div.card', h('div.row', h('h3.grow', 'Work quantities'), h('button.btn.small.primary', { onclick: () => U.qtyEdit(s, loc, null, draw) }, U.icon('plus'), 'Add')), list);
  };

  /* ---------- Quantities tab ---------- */
  U.qtyTab = (page, s) => {
    page.append(U.qtyCard(s, 'school'));
    const ab = U.qtyAbstract(s);
    const card = h('div.card', h('h3', 'Total quantities of this school'));
    if (!ab.length) card.append(h('p.small.muted', 'Add work quantities in each room (Rooms tab › open a room) or above for terrace, boundary wall and other school-level work.'));
    else {
      let cat = '';
      const tb = h('table.qty-table', h('thead', h('tr', h('th', 'Item'), h('th', 'Unit'), h('th', 'Total'))));
      const body = h('tbody');
      for (const g of ab) {
        if (g.cat !== cat) { cat = g.cat; body.append(h('tr.cat', h('td', { colspan: 3 }, cat))); }
        body.append(h('tr', h('td', g.name, g.missing ? h('div.small.qty-miss', `${g.missing} line(s) need a size`) : null), h('td', g.unit), h('td.num', U.fmtNum(U.round(g.total, 3)))));
      }
      tb.append(body);
      card.append(h('div.pv-scroll', tb));
    }
    page.append(card);
    const fmt = { v: (S.settings.qty && S.settings.qty.fmt) || 'xlsx' };
    const seg = h('div.seg');
    const drawSeg = () => { U.clear(seg); [['xlsx', 'Excel'], ['pdf', 'PDF'], ['docx', 'Word']].forEach(([k, l]) => seg.append(h('button' + (fmt.v === k ? '.on' : ''), { onclick: () => { fmt.v = k; S.settings.qty.fmt = k; U.saveSettings(); drawSeg(); } }, l))); };
    drawSeg();
    page.append(h('div.card', h('h3', 'Quantity sheet only'),
      h('p.small.muted', 'Measurement sheet (every line, room by room) and abstract (totals). In Excel every quantity and total is a formula.'),
      h('div.field', seg),
      h('button.btn.primary.block', { onclick: () => U.exportQty(s, fmt.v) }, U.icon('download'), 'Save quantity sheet'),
      h('button.btn.ghost.block', { style: { marginTop: '6px' }, onclick: () => U.go('/form/qtyCatalog') }, U.icon('edit'), 'Edit quantity items, categories and units')));
  };

  /* ---------- outputs ---------- */
  /* blocks added to a report (and the whole quantity-only report) */
  U.qtyBlocks = (s, numbered) => {
    const rows = U.qtyRows(s);
    if (!rows.length) return [];
    const meas = rows.map((ln, i) => {
      const v = U.qtyValue(ln);
      return [String(i + 1), ln.cat || '', ln.name, U.qtyWhere(s, ln), ln.nos || '', ln.l || '', ln.b || '', ln.h || '', v == null ? 'size missing' : U.fmtNum(U.round(v, 3)), ln.unit, ln.rem || ''];
    });
    const ab = U.qtyAbstract(s).map((g, i) => [String(i + 1), g.cat, g.name, g.unit, U.fmtNum(U.round(g.total, 3)), String(g.lines) + (g.missing ? ` (${g.missing} missing size)` : '')]);
    return [
      { t: 'h1', text: `${numbered ? numbered + '. ' : ''}Work quantities — abstract` },
      { t: 'table', head: ['No.', 'Category', 'Item', 'Unit', 'Total qty', 'Lines'], widths: [0.06, 0.18, 0.4, 0.1, 0.12, 0.14], rows: ab },
      { t: 'h1', text: `${numbered ? numbered + 1 + '. ' : ''}Work quantities — measurement` },
      { t: 'table', head: ['No.', 'Category', 'Item', 'Location', 'Nos', 'L (m)', 'B (m)', 'H/D (m)', 'Qty', 'Unit', 'Remarks'], widths: [0.045, 0.1, 0.19, 0.15, 0.055, 0.065, 0.065, 0.07, 0.08, 0.06, 0.12], rows: meas },
    ];
  };

  U.buildQtyReport = (s, o) => {
    const meta = [];
    const place = U.schoolPlace(s);
    if (place) meta.push(['Location', place]);
    if (s.data.sd_date) meta.push(['Date of visit', U.fmtDate(s.data.sd_date)]);
    if (S.settings.brand.writer || s.data.sd_engineer) meta.push(['Prepared by', [S.settings.brand.writer || s.data.sd_engineer, S.settings.brand.designation].filter(Boolean).join(', ')]);
    meta.push(['Report date', U.fmtDate(Date.now())]);
    const blocks = [{ t: 'cover', title: 'Work Quantities', school: U.schoolName(s), meta }].concat(U.qtyBlocks(s, 1));
    if (blocks.length === 1) blocks.push({ t: 'p', text: 'No work quantities have been entered yet.', muted: true });
    blocks.push({ t: 'sign', items: ['Measured by (name, signature, date)', 'Checked by (name, signature, date)'] });
    return { blocks, lh: U.letterhead(s, o, 'Work Quantities'), title: 'Work Quantities', school: U.schoolName(s), header: U.schoolName(s), footer: S.settings.brand.footerNote || '', credit: '', perRow: 2, photoSize: 1200, work: [] };
  };

  /* Excel sheets with formulas: added to the main workbook, or a workbook of their own */
  U.qtySheets = (s, Sheet, ST) => {
    const rows = U.qtyRows(s);
    if (!rows.length) return [];
    const MS = 'Quantity measurement';
    const ms = new Sheet(MS);
    ms.widths = [6, 18, 36, 28, 8, 9, 9, 9, 12, 8, 30];
    ms.rowValues(0, ['No.', 'Category', 'Item', 'Location', 'Nos', 'L (m)', 'B (m)', 'H/D (m)', 'Qty', 'Unit', 'Remarks'], ST.head);
    ms.freeze = 1;
    rows.forEach((ln, i) => {
      const r = i + 1;
      const v = U.qtyValue(ln);
      const n = (x) => (U.num(x) == null ? '' : U.num(x));
      ms.rowValues(r, [i + 1, ln.cat || '', ln.name, U.qtyWhere(s, ln), n(ln.nos), n(ln.l), n(ln.b), n(ln.h), v == null ? 'size missing' : { f: 'PRODUCT(E{r}:H{r})', v }, ln.unit, ln.rem || ''],
        [ST.cell, ST.cell, ST.cell, ST.cell, ST.num, ST.num, ST.num, ST.num, ST.num, ST.cell, ST.cell]);
    });
    const ab = new Sheet('Quantity abstract');
    ab.widths = [6, 22, 44, 10, 14, 10];
    ab.rowValues(0, ['No.', 'Category', 'Item', 'Unit', 'Total qty', 'Lines'], ST.head);
    ab.freeze = 1;
    U.qtyAbstract(s).forEach((g, i) => {
      const r = i + 1;
      ab.rowValues(r, [i + 1, g.cat, g.name, g.unit,
        { f: `SUMIFS('${MS}'!$I:$I,'${MS}'!$C:$C,C{r},'${MS}'!$J:$J,D{r})`, v: U.round(g.total, 6) },
        { f: `COUNTIFS('${MS}'!$C:$C,C{r},'${MS}'!$J:$J,D{r})`, v: g.lines }],
      [ST.cell, ST.cell, ST.cell, ST.cell, ST.totalNum, ST.num]);
    });
    return [ab, ms];
  };

  U.exportQty = async (s, fmt) => {
    const name = `${U.schoolName(s)} - Work Quantities`;
    await U.saveGenerated(fmt, name, async (prog) => {
      const rep = U.buildQtyReport(s, { docName: name });
      if (fmt === 'pdf') return U.makePDF(rep, prog);
      if (fmt === 'docx') return U.makeDOCX(rep, prog);
      return U.makeXLSX(Object.assign(rep, { opts: { qtyOnly: true } }), s, [], prog);
    });
  };
})();
