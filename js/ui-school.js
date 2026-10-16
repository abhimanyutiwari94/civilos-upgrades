/* Infra Upgrades — Home (school list), school tabs, rooms, photos, report. */
(function () {
  'use strict';
  const U = self.U, S = U.S, h = U.h;

  /* ================= HOME ================= */
  U.screens.home = async (root) => {
    await U.refreshSchools();
    const menu = U.menuButton([
      { label: 'Settings', sub: 'Company name & logo, photos, activation', run: () => U.go('/settings') },
      { label: 'Edit survey form', sub: 'Add or remove headings and boxes', run: () => U.go('/form') },
      { label: 'Back up all schools', sub: 'Save one file with all data and photos', run: () => U.backupFlow(S.schools.map((s) => s.id), 'All schools') },
      { label: 'Restore from a backup file', sub: 'Bring schools from a .cupg file', run: () => U.restoreFlow() },
      { label: 'Help', sub: 'How to use, visit rules, condition guide', run: () => U.go('/help') },
    ]);
    root.append(U.topbar({ logo: true, title: 'Infra Upgrades', sub: 'School survey · Civil, MEP & infrastructure', actions: [menu] }));
    const page = h('main.page');
    root.append(page);

    const left = U.Lock.daysLeft();
    if (left <= 5) page.append(h('div.banner.warn', U.icon('lock'), h('div', `The app will lock in ${left} day${left === 1 ? '' : 's'} (${U.fmtDate(U.Lock.state().until)}). Ask for Code ${U.Lock.state().used + 1} and type it in Settings › Activation. Your data stays safe.`)));
    const info = await U.storageInfo();
    if (!U.isInstalled()) { const ic = U.installCard(); if (ic) page.append(ic); }
    const lastB = (await U.DB.kvGet('lastBackup')) || 0;
    const unsaved = S.schools.filter((s) => (s.updated || 0) > lastB && (s.photoCount || 0) > 0);
    if (unsaved.length) {
      page.append(h('div.banner.info', U.icon('save'), h('div.grow', `${unsaved.length} school${unsaved.length > 1 ? 's have' : ' has'} new work not in a backup file yet. A backup is your safety copy.`),
        h('button.btn.small.soft', { onclick: () => U.backupFlow(unsaved.map((s) => s.id), unsaved.length === 1 ? U.schoolName(unsaved[0]) : 'Schools') }, 'Back up')));
    }

    if (!S.schools.length) {
      page.append(h('div.empty',
        h('img.big-logo', { src: U.LOGO, alt: '' }),
        h('h2', 'Welcome'),
        h('p', 'Add the first school to start the survey. Everything you type and every photo is saved on this phone at once — even without internet.'),
        h('button.btn.primary.big', { onclick: newSchool }, U.icon('plus'), 'Add a school')));
    } else {
      let q = '';
      const list = h('div');
      const drawList = () => {
        U.clear(list);
        const shown = S.schools.filter((s) => !q || (U.schoolName(s) + ' ' + U.schoolPlace(s)).toLowerCase().includes(q));
        for (const s of shown) {
          const pct = Math.round(U.progress(s) * 100);
          const status = s.data.cv_status;
          const pic = h('div.pic', U.icon('school'));
          list.append(h('button.list-card', { onclick: () => U.go('/s/' + s.id) },
            pic,
            h('div.grow',
              h('h3.ellipsis', U.schoolName(s)),
              h('div.meta.ellipsis', U.schoolPlace(s) || 'Place not entered'),
              h('div.meta', [s.data.sd_date ? U.fmtDate(s.data.sd_date) : null, `${U.liveSpaces(s).length} rooms`, `${s.photoCount || 0} photos`].filter(Boolean).join('  ·  ')),
              h('div.row', { style: { marginTop: '4px' } },
                status ? h('span.pill' + (status === 'Complete' ? '.ok' : ''), status) : null,
                h('span.small.muted', pct + '% checked')),
              h('div.bar', h('i', { style: { width: pct + '%' } })))));
          U.firstPhotoThumb(s.id).then((u) => { if (u) { U.clear(pic); pic.append(h('img', { src: u, alt: '' })); } });
        }
        if (!shown.length) list.append(h('p.muted.center', 'No school matches.'));
      };
      if (S.schools.length > 3) {
        const search = h('input.inp', { type: 'search', placeholder: 'Search school or place…', style: { marginBottom: '12px' } });
        search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); drawList(); });
        page.append(search);
      }
      page.append(h('div.section-title', `Schools (${S.schools.length})`), list);
      drawList();
      root.append(h('button.fab', { onclick: newSchool }, U.icon('plus'), 'New school'));
    }
    page.append(h('div.footer-note', `Storage used: ${U.fmtBytes(info.usage)}${info.quota ? ' of ' + U.fmtBytes(info.quota) : ''}  ·  Open till ${U.fmtDate(U.Lock.state().until)}`));

    async function newSchool() {
      const nm = h('input.inp', { placeholder: 'e.g. Primary School, village name' });
      const others = S.schools.slice();
      const sel = others.length ? h('select.inp', others.map((x, i) => h('option', { value: x.id, selected: i === 0 }, U.schoolName(x) + (x.data.sd_date ? '  (' + U.fmtDate(x.data.sd_date) + ')' : '')))) : null;
      const cb = (on) => h('input', { type: 'checkbox', checked: on });
      const cDetails = cb(true), cRooms = cb(false), cAnswers = cb(false);
      U.modal({
        title: 'New school',
        body: [h('div.field', h('label', 'School name'), nm),
          others.length ? [
            h('div.field', h('label', 'Fill from previous school'), sel),
            h('label.switch', h('span', 'Common details', h('div.small.muted', 'Block, district, state, engineer, school timings, holidays, supply… Not copied: name, GPS, staff, students, Head Master, photos and other school-only boxes.')), cDetails),
            h('label.switch', h('span', 'Room list', h('div.small.muted', 'Same room names, types and floors — without photos')), cRooms),
            h('label.switch', h('span', 'Checklist answers', h('div.small.muted', 'Conditions, counts and notes (check each one again at the new school)')), cAnswers),
          ] : null,
          h('p.small.muted', 'Copied boxes are marked “from last school” until you change them. Nothing is compulsory.')],
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Create', kind: 'primary', onClick: async () => {
          const from = sel ? others.find((x) => x.id === sel.value) : null;
          const s = U.newSchool(from, { details: cDetails.checked, rooms: cRooms.checked, answers: cAnswers.checked });
          if (nm.value.trim()) s.data.sd_name = nm.value.trim();
          await U.DB.putSchool(s);
          U.go('/s/' + s.id);
        } }],
      });
    }
  };

  const firstThumbCache = new Map();
  U.firstPhotoThumb = async (schoolId) => {
    if (firstThumbCache.has(schoolId)) return firstThumbCache.get(schoolId);
    const first = await U.DB.firstPhoto(schoolId); // reads one photo, not all of them
    const u = first ? await U.thumbURL(first.id) : '';
    firstThumbCache.set(schoolId, u);
    return u;
  };

  /* ================= SCHOOL ================= */
  const TABS = [
    { id: 'info', label: 'Details', icon: 'school' },
    { id: 'check', label: 'Checklist', icon: 'list' },
    { id: 'rooms', label: 'Rooms', icon: 'room' },
    { id: 'photos', label: 'Photos', icon: 'image' },
    { id: 'report', label: 'Report', icon: 'print' },
  ];

  U.screens.school = async (root, id, tab) => {
    const s = await U.useSchool(id);
    if (!s) { U.go('/'); return; }
    tab = tab || 'info';
    const menu = U.menuButton([
      { label: 'Back up this school', sub: 'Safety copy with all photos (.cupg file)', run: () => U.backupFlow([s.id], U.schoolName(s)) },
      { label: s.data.cv_status === 'Complete' ? 'Mark survey as in progress' : 'Mark survey as complete', run: () => { s.data.cv_status = s.data.cv_status === 'Complete' ? 'In progress' : 'Complete'; U.touch(s); U.rerender(); } },
      { label: 'Recently deleted', sub: 'Bring back removed rooms and photos', run: () => U.go(`/s/${s.id}/bin`) },
      { label: 'Erase this school', sub: 'Delete all its data and photos for ever', run: () => U.eraseSchoolFlow(s) },
    ]);
    root.append(U.topbar({
      back: '/', title: U.schoolName(s), sub: U.schoolPlace(s) || 'Tap Details to fill the school details',
      actions: [h('button.icon-btn', { 'aria-label': 'General photos', onclick: () => U.takePhotos(s, 'school', U.placeName(s, U.schoolPlace(s) || U.schoolName(s)), 'General', () => U.rerender()) }, U.icon('camera')), menu],
    }));
    const tabs = U.isQtyOn() ? TABS.slice(0, 4).concat([{ id: 'qty', label: 'Quantities', icon: 'grid' }], TABS.slice(4)) : TABS;
    root.append(h('nav.tabs', tabs.map((t) => h('button.tab' + (t.id === tab ? '.on' : ''), { onclick: () => U.go(`/s/${s.id}/${t.id}`, true) }, U.icon(t.icon), t.label))));
    const page = h('main.page');
    root.append(page);
    await ({ info: tabInfo, check: tabCheck, rooms: tabRooms, photos: tabPhotos, report: tabReport, qty: U.isQtyOn() ? U.qtyTab : null }[tab] || tabInfo)(page, s);
  };

  U.useSchool = async (id) => {
    if (!S.cur || S.cur.id !== id) {
      await U.flushSave();
      const s = await U.openSchool(id);
      if (!s) return null;
      await U.loadPhotos(s);
    }
    return S.cur;
  };

  /* ---------- Details ---------- */
  function tabInfo(page, s) {
    S.template.school.forEach((sec, k) => {
      const filled = () => sec.fields.filter((fl) => fl.type !== 'calc' && U.fieldText(fl, s.data)).length;
      const total = sec.fields.filter((fl) => fl.type !== 'calc').length;
      const acc = U.acc(sec.title, `${filled()}/${total}`, filled() === total, () => U.fieldsEl(sec.fields, s.data, () => {
        U.touch(s);
        acc.setCount(`${filled()}/${total}`, filled() === total);
        if (sec.fields.some((f) => f.id === 'sd_name')) U.$('.top h1').textContent = U.schoolName(s);
      }, s.copied || (s.copied = {})), k === 0);
      page.append(acc);
    });
    page.append(h('p.small.muted.center', 'Nothing is compulsory. Everything is saved as you type.'));
  }

  /* ---------- one checklist item (used for school and room checklists) ---------- */
  U.checkItemEl = (s, it, store, photoTarget, placeText, onChange) => {
    const rec = () => store[it.id] || {};
    const save = (patch) => {
      const r = Object.assign({}, rec(), patch);
      for (const k of Object.keys(r)) if (r[k] === '' || r[k] == null) delete r[k];
      if (Object.keys(r).length) store[it.id] = r; else delete store[it.id];
      el.classList.toggle('done', U.isAnswered(it, store[it.id]));
      U.touch(s);
      onChange && onChange();
    };
    const how = h('div.item-how', it.how || '');
    how.hidden = true;
    const chips = h('div.chips');
    /* answer buttons: the point's own choices (e.g. Yes / No), or the condition buttons */
    const options = () => {
      const list = Array.isArray(it.ans)
        ? it.ans.map((a) => ({ id: a, label: a, tone: a === 'Not applicable' ? 'mute' : (it.work || []).includes(a) ? 'warn' : 'ok' }))
        : S.template.conditions.slice();
      const cur = rec().c;
      if (cur && !list.some((o) => o.id === cur)) list.push({ id: cur, label: U.condLabel(cur), tone: 'mute', old: true }); // an earlier answer is never lost
      return list;
    };
    const drawChips = () => {
      U.clear(chips);
      for (const c of options()) {
        chips.append(h(`button.chip.c-${c.tone || 'mute'}` + (rec().c === c.id ? '.on' : ''), { type: 'button', title: c.hint || (c.old ? 'Earlier answer' : ''), onclick: () => { save({ c: rec().c === c.id ? null : c.id }); drawChips(); } }, c.label));
      }
    };
    drawChips();
    const q = h('input.inp', { placeholder: 'Count / Size (e.g. 4 nos, 12 sq.m)' });
    q.value = rec().q || '';
    q.addEventListener('input', () => save({ q: q.value }));
    const n = h('textarea.inp', { rows: 1, placeholder: 'Notes (room name, reason, problem seen)' });
    n.value = rec().n || '';
    n.addEventListener('input', () => { save({ n: n.value }); U.autosize(n); });
    setTimeout(() => U.autosize(n), 0);
    const el = h('div.item' + (U.isAnswered(it, rec()) ? '.done' : ''),
      h('div.item-head', h('span.item-no', it.no || '•'), h('div.item-what', it.what),
        it.how ? h('button.icon-btn', { type: 'button', 'aria-label': 'How to check', style: { width: '36px', height: '36px', color: 'var(--saffron-deep)' }, onclick: () => { how.hidden = !how.hidden; } }, U.icon('info')) : null),
      how, chips,
      h('div.item-row', q, n),
      U.photoStrip(s, photoTarget, placeText, `${it.no ? it.no + ' ' : ''}${it.what}`, onChange));
    return el;
  };

  /* ---------- School checklist ---------- */
  function tabCheck(page, s) {
    let filter = U.checkFilter || 'all';
    const all = U.T.allChecks();
    const prog = h('div.small.muted');
    const updProg = () => { const d = all.filter((i) => U.isAnswered(i, s.checks[i.id])).length; prog.textContent = `${d} of ${all.length} items checked`; };
    updProg();
    const fbar = h('div.chips', { style: { margin: '6px 0 12px' } });
    const list = h('div');
    const drawF = () => { U.clear(fbar); [['all', 'All'], ['todo', 'Not checked'], ['work', 'Needs work']].forEach(([k, l]) => fbar.append(h('button.chip' + (filter === k ? '.on' : ''), { onclick: () => { filter = U.checkFilter = k; drawF(); draw(); } }, l))); };
    const keep = (it) => {
      const r = s.checks[it.id];
      if (filter === 'todo') return !U.isAnswered(it, r);
      if (filter === 'work') return !!(r && U.needsWork(it, r.c));
      return true;
    };
    const draw = () => {
      U.clear(list);
      S.template.checklist.forEach((sec, k) => {
        const items = sec.items.filter(keep);
        if (!items.length) return;
        const cnt = () => `${sec.items.filter((i) => U.isAnswered(i, s.checks[i.id])).length}/${sec.items.length}`;
        const full = () => sec.items.every((i) => U.isAnswered(i, s.checks[i.id]));
        const acc = U.acc(sec.title, cnt(), full(), () => h('div', items.map((it) => U.checkItemEl(s, it, s.checks, 'item:' + it.id,
          () => U.placeName(s, `${it.no} ${it.what}`), () => { acc.setCount(cnt(), full()); updProg(); }))), filter !== 'all' || k === 0);
        list.append(acc);
      });
      if (!list.children.length) list.append(h('p.muted.center', filter === 'todo' ? 'Every item has a condition. Well done!' : 'Nothing here.'));
    };
    drawF(); draw();
    page.append(h('div.row', h('div.grow', prog)), fbar, list);
  }

  /* ---------- Rooms & spaces ---------- */
  function tabRooms(page, s) {
    const spaces = U.liveSpaces(s);
    page.append(h('div.row', h('div.grow.small.muted', `${spaces.length} room${spaces.length === 1 ? '' : 's'} / space${spaces.length === 1 ? '' : 's'}. Add each room so its name is printed on its photos.`)));
    const list = h('div', { style: { marginTop: '10px' } });
    page.append(list);
    if (!spaces.length) list.append(h('div.empty', h('p', 'No rooms yet. Add classrooms, toilets, halls, gallery, garden, play area — every place you will photograph.')));
    spaces.forEach((sp, idx) => {
      const ph = (S.photos || []).filter((p) => !p.deleted && (p.target === 'space:' + sp.id || p.target.startsWith(`si:${sp.id}:`)));
      const pic = h('div.pic', U.icon('room'));
      const wt = sp.data && Array.isArray(sp.data.sp_worktypes) ? sp.data.sp_worktypes : [];
      let checked = '';
      if (U.spaceUsesChecklist(sp)) {
        const ri = U.checksOf(sp);
        checked = `${ri.filter((i) => U.isAnswered(i, sp.checks && sp.checks[i.id])).length}/${ri.length} checked`;
      }
      list.append(h('div.row', { style: { alignItems: 'stretch', gap: '6px' } },
        h('button.list-card', { style: { flex: 1 }, onclick: () => U.go(`/s/${s.id}/room/${sp.id}`) },
          pic,
          h('div.grow',
            h('h3.ellipsis', `${idx + 1}. ${U.spaceTitle(sp)}`),
            h('div.meta.ellipsis', [U.T.type(sp.typeId).label, U.spaceWhere(sp)].filter(Boolean).join(' · ')),
            h('div.meta', [`${ph.length} photo${ph.length === 1 ? '' : 's'}`, checked, sp.data && sp.data.sp_len && sp.data.sp_bre ? `${sp.data.sp_len} × ${sp.data.sp_bre} m` : ''].filter(Boolean).join('  ·  ')),
            wt.length ? h('div', { style: { marginTop: '5px' } }, wt.slice(0, 4).map((w) => h('span.pill' + (w === 'Rebuild' ? '.bad' : w === 'No work' ? '.ok' : ''), w)), wt.length > 4 ? h('span.small.muted', '+' + (wt.length - 4)) : null) : null))));
      if (ph.length) { const im = U.lazyImg(h('img', { alt: '' }), ph.sort((a, b) => a.no - b.no)[0].id); U.clear(pic); pic.append(im); }
    });
    if (spaces.length > 1) {
      page.append(h('button.btn.ghost.small', { style: { marginTop: '4px' }, onclick: () => U.reorderSpaces(s) }, U.icon('up'), 'Change order'));
    }
    page.parentNode.append(h('button.fab', { onclick: () => U.addSpaceFlow(s) }, U.icon('plus'), 'Add room / space'));
  }

  U.addSpaceFlow = (s) => {
    let type = null;
    const nm = h('input.inp', { placeholder: 'e.g. Classroom 3' });
    const blk = h('input.inp', { placeholder: 'e.g. Main building / Block A' });
    const flr = h('input.inp', { placeholder: 'e.g. Ground floor' });
    const qty = h('input.inp', { type: 'text', inputmode: 'numeric', value: '1' });
    blk.value = U.lastBlock || ''; flr.value = U.lastFloor || '';
    const live = U.liveSpaces(s);
    const nextName = (t, k) => {
      const same = live.filter((x) => x.typeId === t.id).length;
      return `${t.label}${same + (k || 0) > 0 || /classroom|toilet|store|lab/i.test(t.label) ? ' ' + (same + 1 + (k || 0)) : ''}`;
    };
    const grid = h('div.type-grid');
    S.template.spaceTypes.forEach((t) => grid.append(h('button.chip', { type: 'button', onclick: (e) => {
      type = t;
      U.$$('.chip', grid).forEach((c) => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
      nm.value = nextName(t);
    } }, t.label)));
    U.modal({
      title: 'Add room / space',
      wide: true,
      body: [h('div.field', h('div.lbl', 'What is it?'), grid),
        h('div.field', h('label', 'Name or number (printed on photos)'), nm),
        h('div.grid2', h('div.field', h('label', 'Building / Block'), blk), h('div.field', h('label', 'Floor'), flr)),
        h('div.field', h('label', 'How many to add? (e.g. 6 classrooms at once)'), qty)],
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Add', kind: 'primary', onClick: () => {
        if (!type) type = U.T.type('other');
        const n = Math.max(1, Math.min(60, parseInt(qty.value, 10) || 1));
        U.lastBlock = blk.value.trim(); U.lastFloor = flr.value.trim();
        let first = null;
        const base = nm.value.trim();
        const m = base.match(/^(.*?)(\d+)$/);
        for (let k = 0; k < n; k++) {
          let name = base || nextName(type, k);
          if (n > 1) name = m ? `${m[1]}${Number(m[2]) + k}` : `${base || type.label} ${k + 1}`;
          const sp = { id: U.uid('r'), typeId: type.id, name, block: blk.value.trim(), floor: flr.value.trim(), data: {}, checks: {}, notes: '', created: Date.now() };
          s.spaces.push(sp);
          if (!first) first = sp;
        }
        U.touch(s);
        if (n === 1) U.go(`/s/${s.id}/room/${first.id}`); else { U.toast(n + ' rooms added'); U.rerender(); }
      } }],
    });
  };

  U.reorderSpaces = (s) => {
    const body = h('div');
    const draw = () => {
      U.clear(body);
      const live = U.liveSpaces(s);
      live.forEach((sp, i) => body.append(h('div.ed-item', h('div.txt', `${i + 1}. ${U.spaceTitle(sp)}`, h('small', U.spaceWhere(sp))),
        h('button.icon-btn', { disabled: i === 0, 'aria-label': 'Up', onclick: () => move(sp, -1) }, U.icon('up')),
        h('button.icon-btn', { disabled: i === live.length - 1, 'aria-label': 'Down', onclick: () => move(sp, 1) }, U.icon('down')))));
    };
    const move = (sp, d) => {
      const live = U.liveSpaces(s);
      const i = live.indexOf(sp), j = i + d;
      if (j < 0 || j >= live.length) return;
      const a = s.spaces.indexOf(live[i]), b = s.spaces.indexOf(live[j]);
      [s.spaces[a], s.spaces[b]] = [s.spaces[b], s.spaces[a]];
      U.touch(s); draw();
    };
    draw();
    U.modal({ title: 'Change order', body, onClose: () => U.rerender(), actions: [{ label: 'Done', kind: 'primary' }] });
  };

  /* ================= ONE ROOM / SPACE ================= */
  U.screens.space = async (root, id, sid) => {
    const s = await U.useSchool(id);
    if (!s) { U.go('/'); return; }
    const sp = s.spaces.find((x) => x.id === sid && !x.deleted);
    if (!sp) { U.go(`/s/${id}/rooms`); return; }
    sp.data = sp.data || {}; sp.checks = sp.checks || {};
    const live = U.liveSpaces(s);
    const idx = live.indexOf(sp);
    const placeOf = (extra) => U.placeName(s, [U.spaceTitle(sp) + (U.spaceWhere(sp) ? ` (${U.spaceWhere(sp)})` : ''), extra].filter(Boolean).join(' · '));
    const menu = U.menuButton([
      { label: 'Export this room', sub: 'PDF with its photos, data and remarks', run: () => U.exportRooms(s, [sp.id], Object.assign({ what: 'report', fmt: 'pdf', separate: false, data: true, remarks: true }, S.settings.roomExport || {}, { what: 'report', separate: false, brand: S.settings.brand.show && !!(S.settings.brand.company || S.settings.brand.logo), perRow: S.settings.report.photosPerRow, photoSize: S.settings.report.photoSize, appCredit: S.settings.report.appCredit })) },
      { label: 'Edit name, type, block, floor', run: () => editSpace() },
      { label: 'Duplicate this room', sub: 'Copies sizes and counts to a new room', run: () => {
        const c = JSON.parse(JSON.stringify(sp));
        c.id = U.uid('r'); c.created = Date.now(); c.checks = {}; c.notes = '';
        const m = (sp.name || '').match(/^(.*?)(\d+)$/);
        c.name = m ? `${m[1]}${Number(m[2]) + 1}` : `${U.spaceTitle(sp)} (copy)`;
        s.spaces.splice(s.spaces.indexOf(sp) + 1, 0, c);
        U.touch(s); U.go(`/s/${s.id}/room/${c.id}`);
      } },
      { label: 'Remove this room', sub: 'Goes to Recently deleted with its photos', run: async () => {
        if (!(await U.confirm(`Remove "${U.spaceTitle(sp)}"? You can bring it back from Recently deleted.`, { ok: 'Remove', danger: true }))) return;
        sp.deleted = Date.now(); U.touch(s); U.go(`/s/${s.id}/rooms`);
      } },
    ]);
    root.append(U.topbar({ back: `/s/${s.id}/rooms`, title: `${idx + 1}. ${U.spaceTitle(sp)}`, sub: [U.T.type(sp.typeId).label, U.spaceWhere(sp)].filter(Boolean).join(' · '), actions: [menu], onTitle: () => editSpace() }));
    const page = h('main.page');
    root.append(page);

    const strip = U.photoStrip(s, 'space:' + sp.id, () => placeOf(''), '', null);
    page.append(h('div.card',
      h('h2', 'Photos'), h('p.small.muted', { style: { margin: '-4px 0 10px' } }, 'Take 4–6: wide view, each wall, ceiling, floor and close-ups of damage.'),
      h('button.btn.primary.big.block', { onclick: () => U.takePhotos(s, 'space:' + sp.id, placeOf(''), '', () => strip.redraw()) }, U.icon('camera'), 'Take photos of this room'),
      strip,
      h('div.row', { style: { marginTop: '10px', gap: '8px' } },
        h('button.btn.small.soft.grow', { onclick: () => U.downloadPhotos(s, [sp.id]) }, U.icon('download'), 'Download photos'),
        h('button.btn.small.soft.grow', { onclick: () => U.roomReportNow(s, sp.id) }, U.icon('doc'), 'Room report'))));

    /* only the boxes that fit this kind of space (a toilet asks WC / urinals, an open area asks length × breadth …) */
    for (const { sec, fields } of U.fieldSectionsFor(sp)) page.append(h('div.card', h('h3', sec.title), U.fieldsEl(fields, sp.data, () => U.touch(s))));

    if (U.isQtyOn()) page.append(U.qtyCard(s, sp.id));

    const uses = U.spaceUsesChecklist(sp);
    const kindNow = U.checklistKind(Object.assign({}, sp, { useChecklist: true }));
    const sw = h('input', { type: 'checkbox', checked: uses });
    sw.addEventListener('change', () => { sp.useChecklist = sw.checked; U.touch(s); U.rerender(); });
    page.append(h('label.switch.card', { style: { padding: '12px 14px' } },
      kindNow === 'toilet'
        ? h('span', h('b', 'Toilet checklist'), h('div.small.muted', 'Building and roof, fittings, water supply, drainage, floor and wall tiles, urinals'))
        : h('span', h('b', 'Room checklist'), h('div.small.muted', 'Walls, ceiling, floor, benches, boards, almirahs, lights, fans, doors, windows, painting')), sw));
    if (uses) {
      U.checklistFor(sp).forEach((sec) => {
        const cnt = () => `${sec.items.filter((i) => U.isAnswered(i, sp.checks[i.id])).length}/${sec.items.length}`;
        const full = () => sec.items.every((i) => U.isAnswered(i, sp.checks[i.id]));
        const acc = U.acc(sec.title, cnt(), full(), () => h('div', sec.items.map((it) => U.checkItemEl(s, it, sp.checks, `si:${sp.id}:${it.id}`,
          () => placeOf(`${it.no} ${it.what}`), () => acc.setCount(cnt(), full())))), false);
        page.append(acc);
      });
    }
    const notes = h('textarea.inp', { rows: 3, placeholder: "Anything else: problems seen, 'Needs rebuild', school's request…" });
    notes.value = sp.notes || '';
    notes.addEventListener('input', () => { sp.notes = notes.value; U.touch(s); U.autosize(notes); });
    setTimeout(() => U.autosize(notes), 0);
    page.append(h('div.card', h('h3', 'Notes'), notes));
    page.append(h('div.row', { style: { marginTop: '8px' } },
      h('button.btn.grow', { disabled: idx <= 0, onclick: () => U.go(`/s/${s.id}/room/${live[idx - 1].id}`, true) }, U.icon('back'), 'Previous'),
      idx < live.length - 1
        ? h('button.btn.grow', { onclick: () => U.go(`/s/${s.id}/room/${live[idx + 1].id}`, true) }, 'Next room')
        : h('button.btn.soft.grow', { onclick: () => U.addSpaceFlow(s) }, U.icon('plus'), 'Add next room')));

    function editSpace() {
      const nm = h('input.inp'); nm.value = sp.name || '';
      const blk = h('input.inp'); blk.value = sp.block || '';
      const flr = h('input.inp'); flr.value = sp.floor || '';
      const sel = h('select.inp', S.template.spaceTypes.map((t) => h('option', { value: t.id, selected: t.id === sp.typeId }, t.label)));
      U.modal({
        title: 'Room details',
        body: [h('div.field', h('label', 'Name or number'), nm), h('div.field', h('label', 'Type'), sel),
          h('div.grid2', h('div.field', h('label', 'Building / Block'), blk), h('div.field', h('label', 'Floor'), flr)),
          h('p.small.muted', 'Photos already taken keep the name printed on them.')],
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: () => {
          sp.name = nm.value.trim(); sp.block = blk.value.trim(); sp.floor = flr.value.trim(); sp.typeId = sel.value;
          U.touch(s); U.rerender();
        } }],
      });
    }
  };

  /* ---------- Photos tab ---------- */
  function tabPhotos(page, s) {
    const live = (S.photos || []).filter((p) => !p.deleted);
    const size = live.reduce((a, p) => a + (p.size || 0), 0);
    page.append(h('div.card',
      h('div.small.muted', `${live.length} photos · about ${U.fmtBytes(size)}`),
      h('div.row.wrap', { style: { marginTop: '8px', gap: '8px' } },
        h('button.btn.primary.grow', { onclick: () => U.downloadPhotos(s) }, U.icon('download'), 'Download all photos'),
        h('button.btn.soft.grow', { onclick: () => {
          U.go(`/s/${s.id}/report`, true);
          setTimeout(() => { const c = document.getElementById('room-export'); if (c) c.scrollIntoView({ behavior: 'smooth' }); }, 400);
        } }, U.icon('doc'), 'Room-wise report')),
      h('p.small.muted', { style: { margin: '8px 0 0' } }, 'Photos come in a folder for each room, with a Remarks file in each folder.')));
    const group = (title, sub, target, place, caption) => {
      const g = h('div.card.photo-group', h('h4', title), sub ? h('div.small.muted', sub) : null, U.photoStrip(s, target, place, caption, null));
      return g;
    };
    page.append(group('General photos of the school', 'Front view, campus, approach road, surroundings', 'school', () => U.placeName(s, U.schoolPlace(s) || U.schoolName(s)), 'General'));
    for (const sp of U.liveSpaces(s)) {
      const any = live.some((p) => p.target === 'space:' + sp.id || p.target.startsWith(`si:${sp.id}:`));
      const g = group(U.spaceTitle(sp), [U.T.type(sp.typeId).label, U.spaceWhere(sp)].filter(Boolean).join(' · '), 'space:' + sp.id,
        () => U.placeName(s, U.spaceTitle(sp) + (U.spaceWhere(sp) ? ` (${U.spaceWhere(sp)})` : '')), '');
      const items = live.filter((p) => p.target.startsWith(`si:${sp.id}:`));
      if (items.length) g.append(h('div.small.muted', { style: { marginTop: '6px' } }, `+ ${items.length} photo(s) inside its checklist`));
      if (any || true) page.append(g);
    }
    const itemPhotos = S.template.checklist.flatMap((sec) => sec.items.map((it) => ({ sec, it }))).filter(({ it }) => U.photosFor('item:' + it.id).length);
    if (itemPhotos.length) page.append(h('div.section-title', 'Checklist photos'));
    for (const { sec, it } of itemPhotos) page.append(group(`${it.no} ${it.what}`, sec.title, 'item:' + it.id, () => U.placeName(s, `${it.no} ${it.what}`), `${it.no} ${it.what}`));
  }

  /* ---------- Report tab ---------- */
  function tabReport(page, s) {
    const st = S.settings, r = st.report, b = st.brand;
    let fmt = st.lastFormat || 'pdf';
    const seg = h('div.seg');
    const drawSeg = () => { U.clear(seg); [['pdf', 'PDF'], ['docx', 'Word'], ['xlsx', 'Excel']].forEach(([k, l]) => seg.append(h('button' + (fmt === k ? '.on' : ''), { onclick: () => { fmt = k; st.lastFormat = k; U.saveSettings(); drawSeg(); } }, l))); };
    drawSeg();
    const defName = U.safeFileName(`${U.schoolName(s)} - Survey Report - ${U.fmtDate(s.data.sd_date || Date.now())}`);
    const fname = h('input.inp'); fname.value = defName;
    const hasBrand = !!(b.company || b.logo);
    const opt = { docName: '', brand: true, qty: r.qty !== false, includeBlank: r.includeBlank, includeHow: r.includeHow, summary: r.summary, quantities: r.quantities, photos: true, signatures: r.signatures, appCredit: r.appCredit, perRow: r.photosPerRow, photoSize: r.photoSize };
    const sw = (key, label, sub, disabled) => {
      const c = h('input', { type: 'checkbox', checked: !!opt[key], disabled: !!disabled });
      c.addEventListener('change', () => {
        opt[key] = c.checked;
        if (key === 'brand') b.show = c.checked; else if (key in r) r[key] = c.checked;
        U.saveSettings();
      });
      return h('label.switch', h('span', label, sub ? h('div.small.muted', sub) : null), c);
    };
    const perRow = h('div.seg');
    const drawPer = () => { U.clear(perRow); [[2, '2 per row (bigger)'], [3, '3 per row']].forEach(([k, l]) => perRow.append(h('button' + (opt.perRow === k ? '.on' : ''), { onclick: () => { opt.perRow = r.photosPerRow = k; U.saveSettings(); drawPer(); } }, l))); };
    drawPer();
    const qual = h('div.seg');
    const drawQ = () => { U.clear(qual); [[900, 'Small file'], [1400, 'Standard'], [2000, 'High']].forEach(([k, l]) => qual.append(h('button' + (opt.photoSize === k ? '.on' : ''), { onclick: () => { opt.photoSize = r.photoSize = k; U.saveSettings(); drawQ(); } }, l))); };
    drawQ();
    const live = (S.photos || []).filter((p) => !p.deleted).length;

    page.append(h('div.card',
      h('h2', 'Print / save report'),
      h('div.field', h('div.lbl', 'File type'), seg),
      h('div.field', h('label', 'File name'), fname),
      h('p.small.muted', U.canPickFolder() ? 'You will choose the folder and file name in the next step.' : 'The file is saved to your Downloads. You can also send it to WhatsApp, Drive or email with “Share”.'),
      h('div.row', { style: { gap: '8px' } },
        h('button.btn.soft.big.grow', { onclick: async () => {
          await U.flushSave();
          const rep = U.buildReport(s, U.reportablePhotos(s, await U.loadPhotos(s)), Object.assign({}, opt, { docName: fname.value }));
          U.previewReport(rep, { title: fname.value, note: fmt === 'xlsx' ? 'Preview of the content. In Excel the same data comes in separate sheets (Summary, Work required, Checklist, Rooms, Photos).' : null, onSave: () => U.makeReportFlow(s, fmt, fname.value, opt) });
        } }, U.icon('doc'), 'Preview'),
        h('button.btn.primary.big.grow', { onclick: () => U.makeReportFlow(s, fmt, fname.value, opt) }, U.icon('print'), 'Save report')),
      h('div.small.muted.center', { style: { marginTop: '8px' } }, `${U.liveSpaces(s).length} rooms · ${live} photos · ${Math.round(U.progress(s) * 100)}% checked`),
      h('button.btn.ghost.block', { style: { marginTop: '6px', color: 'var(--saffron-deep)' }, onclick: () => { const c = document.getElementById('room-export'); if (c) c.scrollIntoView({ behavior: 'smooth' }); } },
        U.icon('down'), 'Room-wise export / photos only')));

    page.append(h('div.card',
      h('h3', 'What to include'),
      h('p.small.muted', { style: { margin: '0 0 6px' } }, 'Sakshham Consultants logo, colours and page format are always printed.'),
      sw('summary', 'Summary of work required'),
      sw('quantities', 'Rooms and sizes table', 'Sizes, areas and counts with totals'),
      U.isQtyOn() ? sw('qty', 'Work quantities', 'Abstract (totals) and measurement of every line') : null,
      sw('includeBlank', 'Show empty items too', 'Off = only items with an answer or photo (cleaner report)'),
      sw('includeHow', "Show 'How to check' text"),
      sw('signatures', 'Signature lines at the end'),
      sw('appCredit', "Print 'Prepared with Infra Upgrades' in the footer", 'Off = no app name anywhere in the report'),
      h('div.field', { style: { marginTop: '10px' } }, h('div.lbl', 'Photos in the report'), perRow),
      h('div.field', h('div.lbl', 'Photo quality in the report'), qual),
      h('button.btn.soft.block', { onclick: () => U.go('/settings') }, U.icon('edit'), 'Report title, project, client and report writer')));

    page.append(U.roomExportCard(s));

    page.append(h('div.card',
      h('h3', 'After the report is saved'),
      h('p.small.muted', 'Keep the data until you have the report and a backup. When this school is finished, you can erase it to free space for the next school.'),
      h('div.row.wrap',
        h('button.btn.soft', { onclick: () => U.backupFlow([s.id], U.schoolName(s)) }, U.icon('save'), 'Back up this school'),
        h('button.btn', { style: { color: 'var(--bad)' }, onclick: () => U.eraseSchoolFlow(s) }, U.icon('trash'), 'Erase & start new'))));
  }

  /* ---------- making and saving the report ---------- */
  U.makeReportFlow = async (s, fmt, name, opt) => {
    name = U.safeFileName(name || U.schoolName(s));
    const t = U.FILETYPES[fmt];
    let handle = false;
    if (U.canPickFolder()) {
      handle = await U.pickSaveTarget(name, fmt);
      if (handle === null) return; // cancelled
    }
    await U.flushSave();
    const busy = U.busy('Preparing report…');
    let blob;
    try {
      const photos = U.reportablePhotos(s, await U.loadPhotos(s));
      const rep = U.buildReport(s, photos, Object.assign({}, opt, { docName: name }));
      rep.opts = opt;
      const prog = (m, f) => busy.set(m, f);
      if (fmt === 'pdf') blob = await U.makePDF(rep, prog);
      else if (fmt === 'docx') blob = await U.makeDOCX(rep, prog);
      else blob = await U.makeXLSX(rep, s, photos, prog);
      if (handle) { busy.set('Saving to your folder…', 1); await U.writeToHandle(handle, blob); }
      s.lastOutputAt = Date.now();
      U.touch(s);
    } catch (e) {
      busy.done();
      U.alert('The report could not be made: ' + (e.message || e) + '\n\nYour data is safe. Try “Small file” photo quality, or try again.');
      return;
    }
    busy.done();
    const filename = (handle && handle.name) || name + t.ext;
    const actions = [];
    if (!handle) actions.push({ label: 'Save file', kind: 'primary', onClick: () => { U.downloadBlob(blob, filename); U.toast('Saved to Downloads: ' + filename, 4000); return false; } });
    actions.push(U.sendAction(blob, filename, t.mime, !!handle, handle ? 'primary' : ''));
    actions.push({ label: 'Close', kind: 'ghost' });
    U.modal({
      title: 'Report ready',
      body: [h('p', h('b', filename)), h('p.muted', `${t.desc} · ${U.fmtBytes(blob.size)}`),
        h('p.small.muted', handle ? 'Saved in the folder you chose.' : 'Tap “Save file” to keep it on this phone (Downloads), or “Share / Send” to save it to Drive or send on WhatsApp / email.')],
      actions,
    });
  };
  /* photos that belong to rooms which still exist */
  U.reportablePhotos = (s, photos) => {
    const dead = new Set((s.spaces || []).filter((x) => x.deleted).map((x) => x.id));
    return photos.filter((p) => {
      if (p.deleted) return false;
      const m = p.target.match(/^(?:space|si):([^:]+)/);
      return !(m && dead.has(m[1]));
    });
  };

  /* ---------- erase ---------- */
  U.eraseSchoolFlow = async (s) => {
    const nPh = (S.photos || []).filter((p) => p.schoolId === s.id && !p.deleted).length || s.photoCount || 0;
    const noOutput = !s.lastOutputAt || s.lastOutputAt < (s.updated || 0) - 60000;
    const lastB = (await U.DB.kvGet('lastBackup')) || 0;
    const inp = h('input.inp.code-inp', { placeholder: 'ERASE', autocomplete: 'off' });
    U.modal({
      title: 'Erase this school?',
      body: [
        h('p', h('b', U.schoolName(s))),
        h('p', `All its details, ${U.liveSpaces(s).length} rooms and ${nPh} photos will be deleted from this phone for ever.`),
        noOutput ? h('div.banner.bad', U.icon('info'), h('div', 'No report has been saved since the last change.')) : null,
        lastB < (s.updated || 0) ? h('div.banner.warn', U.icon('save'), h('div', 'This school is not in a backup file yet.')) : null,
        h('p', 'To confirm, type ERASE:'), inp],
      actions: [{ label: 'Keep it', kind: 'ghost' }, { label: 'Erase for ever', kind: 'danger', onClick: async () => {
        if (inp.value.trim().toUpperCase() !== 'ERASE') { U.toast('Type ERASE to confirm'); return false; }
        await U.flushSave();
        await U.DB.eraseSchool(s.id);
        U.dropMirror(s.id);
        if (S.cur && S.cur.id === s.id) { S.cur = null; S.photos = []; }
        firstThumbCache.delete(s.id);
        U.toast('School erased. Ready for a new school.');
        U.go('/');
      } }],
    });
  };

  /* ---------- recently deleted ---------- */
  U.screens.bin = async (root, id) => {
    const s = await U.useSchool(id);
    if (!s) { U.go('/'); return; }
    root.append(U.topbar({ back: `/s/${s.id}/rooms`, title: 'Recently deleted', sub: U.schoolName(s) }));
    const page = h('main.page');
    root.append(page);
    const rooms = s.spaces.filter((x) => x.deleted);
    const photos = (S.photos || []).filter((p) => p.deleted);
    if (!rooms.length && !photos.length) { page.append(h('div.empty', h('p', 'Nothing has been removed.'))); return; }
    if (rooms.length) {
      page.append(h('div.section-title', 'Rooms'));
      for (const sp of rooms) page.append(h('div.list-card', h('div.grow', h('h3', U.spaceTitle(sp)), h('div.meta', 'Removed ' + U.fmtDateTime(sp.deleted))),
        h('button.btn.small.soft', { onclick: () => { delete sp.deleted; U.touch(s); U.toast('Room is back'); U.rerender(); } }, 'Bring back')));
    }
    if (photos.length) {
      page.append(h('div.section-title', 'Photos'));
      const grid = h('div.thumbs');
      for (const p of photos) {
        const img = h('img', { alt: '' });
        U.thumbURL(p.id).then((u) => { img.src = u; });
        grid.append(h('div', h('div.thumb', img, h('span.no', U.photoNo(p))),
          h('div.row', { style: { gap: '4px', marginTop: '4px' } },
            h('button.btn.small.soft.grow', { onclick: async () => { delete p.deleted; await U.DB.updatePhotoMeta(p.id, { deleted: null }); s.photoCount = (s.photoCount || 0) + 1; U.touch(s); U.rerender(); } }, 'Back'),
            h('button.btn.small', { 'aria-label': 'Delete for ever', onclick: async () => {
              if (!(await U.confirm('Delete this photo for ever?', { ok: 'Delete', danger: true }))) return;
              await U.DB.erasePhotos([p.id]); S.photos = S.photos.filter((x) => x.id !== p.id); U.rerender();
            } }, U.icon('trash')))));
      }
      page.append(grid);
    }
  };
})();
