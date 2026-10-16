/* Infra Upgrades — Settings, survey-form editor, Help, lock screen, backup/restore flows. */
(function () {
  'use strict';
  const U = self.U, S = U.S, h = U.h;

  /* ================= SETTINGS ================= */
  U.screens.settings = async (root) => {
    S.cur = null;
    root.append(U.topbar({ back: '/', title: 'Settings', sub: 'Report details, photos, backup, activation' }));
    const page = h('main.page');
    root.append(page);
    const st = S.settings, b = st.brand, p = st.photo;
    const save = U.debounce(() => U.saveSettings(), 300);

    /* report details */
    const txt = (key, label, ph) => {
      const i = h('input.inp', { placeholder: ph || '' });
      i.value = b[key] || '';
      i.addEventListener('input', () => { b[key] = i.value; save(); });
      return h('div.field', h('label', label), i);
    };
    const logoBox = h('div.row');
    const drawLogo = () => {
      U.clear(logoBox);
      if (b.logo) logoBox.append(h('img', { src: b.logo, alt: 'Logo', style: { maxHeight: '64px', maxWidth: '160px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' } }),
        h('button.btn.small', { onclick: () => { b.logo = null; save(); drawLogo(); } }, U.icon('trash'), 'Remove'));
      logoBox.append(h('button.btn.small.soft', { onclick: async () => {
        const f = (await U.pickImages({}))[0];
        if (!f) return;
        try { const r = await U.resizeBlob(f, 600, 0.92, 'image/png'); b.logo = await U.blobToDataURL(r.blob); save(); drawLogo(); } catch (e) { U.toast('This picture could not be read'); }
      } }, U.icon('upload'), b.logo ? 'Change logo' : 'Upload logo'));
    };
    drawLogo();
    const show = h('input', { type: 'checkbox', checked: b.show });
    show.addEventListener('change', () => { b.show = show.checked; save(); });
    page.append(h('div.card',
      h('h2', 'Report details'),
      h('div.row', { style: { gap: '12px', margin: '4px 0 10px' } }, h('img', { src: U.LOGO_PNG || 'icons/sakshham-logo.png', alt: 'Sakshham Consultants', style: { height: '40px', maxWidth: '60%' } })),
      h('p.small.muted', 'Every report and export always carries the Sakshham Consultants logo, colours and page format. The details below are printed in the report heading.'),
      txt('reportTitle', 'Report title', 'School Site Visit Report'),
      txt('projectName', 'Project', 'CSR School Renovation'),
      txt('preparedFor', 'Client'),
      h('div.grid2', txt('writer', 'Report writer name'), txt('designation', 'Designation')),
      h('div.grid2', txt('phone', 'Phone'), txt('email', 'Email')),
      txt('footerNote', 'Footer note (every page)', 'e.g. Draft for internal use')));

    /* photos */
    const qual = h('div.choose-list');
    const QUAL = [
      { k: 2560, q: 0.82, label: 'High quality, small file (recommended)', sub: 'Sharp photos · about 0.5–0.9 MB each' },
      { k: 4000, q: 0.88, label: 'Best quality', sub: 'Full camera detail · about 2–3 MB each' },
      { k: 1920, q: 0.8, label: 'Space saver', sub: 'Good for reports · about 0.3–0.5 MB each' },
    ];
    const drawQ = () => { U.clear(qual); QUAL.forEach((o) => qual.append(h('button.choose-item', { style: p.maxSide === o.k ? { borderColor: 'var(--saffron)', background: 'var(--saffron-soft)' } : null, onclick: () => { p.maxSide = o.k; p.quality = o.q; save(); drawQ(); } }, h('span', (p.maxSide === o.k ? '● ' : '○ ') + o.label), h('small.muted', o.sub)))); };
    drawQ();
    const camSeg = h('div.seg');
    const drawCam = () => { U.clear(camSeg); [['app', 'In-app camera (fast, many photos)'], ['phone', 'Phone camera app']].forEach(([k, l]) => camSeg.append(h('button' + (p.camera === k ? '.on' : ''), { onclick: () => { p.camera = k; save(); drawCam(); } }, l))); };
    drawCam();
    const psw = (key, label, sub) => { const c = h('input', { type: 'checkbox', checked: !!p[key] }); c.addEventListener('change', () => { p[key] = c.checked; save(); }); return h('label.switch', h('span', label, sub ? h('div.small.muted', sub) : null), c); };
    const gpsSeg = h('div.seg');
    const drawGps = () => { U.clear(gpsSeg); [[5, '±5 m (best, slower)'], [10, '±10 m'], [20, '±20 m (faster)']].forEach(([k, l]) => gpsSeg.append(h('button' + (Number(p.gpsTarget || 20) === k ? '.on' : ''), { onclick: () => { p.gpsTarget = k; save(); drawGps(); } }, l))); };
    drawGps();
    const sizeSeg = h('div.seg');
    const drawSize = () => { U.clear(sizeSeg); [['small', 'Very small'], ['medium', 'Medium']].forEach(([k, l]) => sizeSeg.append(h('button' + (p.stampSize === k ? '.on' : ''), { onclick: () => { p.stampSize = k; save(); drawSize(); } }, l))); };
    drawSize();
    /* speed: light mode for low-cost phones */
    const perfSeg = h('div.seg');
    const drawPerf = () => {
      U.clear(perfSeg);
      [['auto', 'Automatic'], ['lite', 'Light (fast)'], ['full', 'Full']].forEach(([k, l]) => perfSeg.append(h('button' + ((st.perf || 'auto') === k ? '.on' : ''), { onclick: () => { st.perf = k; save(); document.body.classList.toggle('lite', U.lite()); drawPerf(); } }, l)));
    };
    drawPerf();
    page.append(h('div.card',
      h('h2', 'Speed'),
      h('div.field', perfSeg),
      h('p.small.muted', `Light mode makes the app smoother on low-cost phones: simpler drawing, lighter camera preview, photos kept at 2048 px (still sharp, smaller files). Automatic picks Light on phones with little memory. This phone: ${U.lite() ? 'Light' : 'Full'} now${navigator.deviceMemory ? ` · about ${navigator.deviceMemory} GB memory` : ''}.`)));
    page.append(h('div.card',
      h('h2', 'Photos'),
      h('div.field', h('div.lbl', 'Photo quality'), qual),
      h('div.field', h('div.lbl', 'Camera'), camSeg),
      h('div.lbl.small', { style: { marginTop: '10px', fontWeight: 700 } }, 'Stamp at bottom-left of each photo'),
      psw('stampPlace', 'Location name (room / item name)'),
      psw('stampSchool', 'Add school name to the location name'),
      psw('stampCoords', 'GPS coordinates'),
      psw('stampTime', 'Date and time', 'Off by default'),
      h('div.field', { style: { marginTop: '8px' } }, h('div.lbl', 'Stamp size'), sizeSeg),
      h('div.field', h('div.lbl', 'GPS accuracy for photos'), gpsSeg, h('div.small.muted', { style: { marginTop: '6px' } }, 'The camera waits up to 10 s for this accuracy. Needs phone Location ON with “Use precise location”.')),
      h('button.btn.soft.small', { onclick: () => U.alert(U.preciseHelp(), 'Get accurate GPS') }, U.icon('pin'), 'How to get accurate GPS')));

    /* survey form */
    page.append(h('div.card',
      h('h2', 'Work quantities'),
      h('p.small.muted', 'When on, every room and space can collect repair / new work quantities (plaster, painting, waterproofing, rebuild …) with sizes. The app adds up the total of every item for the school. Excel gets real formulas. A “Quantities” tab appears in each school.'),
      (() => { const c = h('input', { type: 'checkbox', checked: U.isQtyOn() }); c.addEventListener('change', () => { S.settings.qty.on = c.checked; save(); U.toast(c.checked ? 'Work quantities on' : 'Work quantities off'); }); return h('label.switch', h('span', h('b', 'Collect work quantities')), c); })(),
      h('button.btn.soft.small', { style: { marginTop: '6px' }, onclick: () => U.go('/form/qtyCatalog') }, U.icon('edit'), 'Edit quantity items')));
    page.append(h('div.card',
      h('h2', 'Survey form'),
      h('p.small.muted', 'Add, rename or remove headings and boxes. Changes apply to all schools. Data already typed is never deleted.'),
      h('div.row.wrap',
        h('button.btn.primary', { onclick: () => U.go('/form') }, U.icon('edit'), 'Edit survey form'),
        h('button.btn.soft', { onclick: () => U.saveBlobFlow(U.templateFile(), 'Infra Upgrades - survey form', 'json') }, U.icon('share'), 'Share form file'),
        h('button.btn.soft', { onclick: () => U.loadFormFlow() }, U.icon('upload'), 'Load form file'))));

    /* backup */
    const lastB = (await U.DB.kvGet('lastBackup')) || 0;
    const info = await U.storageInfo();
    page.append(h('div.card',
      h('h2', 'Backup and storage'),
      h('dl.kv', h('dt', 'Last backup'), h('dd', lastB ? U.fmtDateTime(lastB) : 'Never'),
        h('dt', 'Storage used'), h('dd', `${U.fmtBytes(info.usage)}${info.quota ? ' of ' + U.fmtBytes(info.quota) : ''}`),
        h('dt', 'Protected storage'), h('dd', info.persisted ? 'Yes — the phone will not clear it' : 'Not yet')),
      h('div.row.wrap', { style: { marginTop: '12px' } },
        h('button.btn.primary', { onclick: async () => { await U.refreshSchools(); U.backupFlow(S.schools.map((x) => x.id), 'All schools'); } }, U.icon('save'), 'Back up all schools'),
        h('button.btn.soft', { onclick: () => U.restoreFlow() }, U.icon('upload'), 'Restore backup'),
        !info.persisted ? h('button.btn.soft', { onclick: async () => { const ok = await U.askPersist(); U.toast(ok ? 'Storage protected' : 'Install the app on the home screen, then try again'); U.rerender(); } }, U.icon('lock'), 'Protect storage') : null),
      h('p.small.muted', { style: { marginTop: '10px' } }, 'Data is lost only if you erase it, clear the browser’s site data, or uninstall the app. A backup file keeps a safe copy anywhere (Drive, laptop, pen drive).')));

    /* activation */
    const L = U.Lock.state();
    page.append(h('div.card',
      h('h2', 'Activation'),
      h('dl.kv', h('dt', 'Code in use'), h('dd', L.used ? `Code ${L.used} of ${U.Lock.total()}` : 'None'),
        h('dt', 'Open until'), h('dd', L.until ? U.fmtDate(L.until) : '—'),
        h('dt', 'Days left'), h('dd', String(U.Lock.daysLeft()))),
      L.used < U.Lock.total() ? h('button.btn.soft', { style: { marginTop: '10px' }, onclick: () => U.enterCodeFlow() }, U.icon('key'), `Enter Code ${L.used + 1} now (adds 30 days)`) : h('p.small.muted', 'All codes are used.')));

    page.append(h('div.card',
      h('h2', 'Danger zone'),
      h('button.btn', { style: { color: 'var(--bad)' }, onclick: () => eraseAll() }, U.icon('trash'), 'Erase ALL schools on this phone')));
    page.append(h('div.footer-note', `Infra Upgrades · version ${self.CU_VERSION || ''}`));

    async function eraseAll() {
      const inp = h('input.inp.code-inp', { placeholder: 'ERASE ALL' });
      U.modal({ title: 'Erase all schools?', body: [h('p', 'Every school, room and photo on this phone will be deleted for ever. Make a backup first.'), h('p', 'Type ERASE ALL to confirm:'), inp],
        actions: [{ label: 'Keep', kind: 'ghost' }, { label: 'Erase all', kind: 'danger', onClick: async () => {
          if (inp.value.trim().toUpperCase() !== 'ERASE ALL') { U.toast('Type ERASE ALL to confirm'); return false; }
          await U.DB.eraseAll();
          try { Object.keys(localStorage).filter((k) => k.startsWith('cu.mirror.')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* */ }
          S.cur = null; S.photos = [];
          U.toast('All schools erased'); U.go('/');
        } }] });
    }
  };

  U.enterCodeFlow = () => {
    const inp = h('input.inp.code-inp', { placeholder: 'UP00-XXXX-XXXX', autocomplete: 'off', autocapitalize: 'characters' });
    const msg = h('p.small');
    U.modal({ title: `Enter Code ${U.Lock.state().used + 1}`, body: [inp, msg],
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Use code', kind: 'primary', onClick: async () => {
        const r = await U.Lock.enter(inp.value);
        msg.textContent = r.msg;
        msg.style.color = r.ok ? 'var(--ok)' : 'var(--bad)';
        if (!r.ok) return false;
        U.toast(r.msg, 4000);
        U.rerender();
      } }] });
  };

  /* ================= SURVEY FORM EDITOR ================= */
  const TYPES = [
    ['text', 'Short text'], ['longtext', 'Long text'], ['number', 'Number'], ['choice', 'Choose one (chips)'],
    ['multi', 'Choose many (chips)'], ['yesno', 'Yes / No'], ['date', 'Date'], ['phone', 'Phone number'], ['gps', 'GPS location'],
  ];
  const GROUPS = { room: 'Rooms', toilet: 'Toilets', corridor: 'Corridors / verandahs', open: 'Open areas', wall: 'Walls / gates', water: 'Water points' };
  const PARTS = [
    { id: 'school', label: 'School details', kind: 'fields', help: 'Boxes filled once per school (name, address, students…).' },
    { id: 'checklist', label: 'School checklist', kind: 'items', help: 'Points checked once per school with Condition, Count/Size, Notes and photos.' },
    { id: 'spaceFields', label: 'Room boxes', kind: 'fields', help: 'Sizes and counts asked in rooms / spaces. Each box shows only in the kinds of space ticked for it (edit a box to change).' },
    { id: 'roomChecklist', label: 'Room checklist', kind: 'items', help: 'Points checked in every room that uses the room checklist.' },
    { id: 'toiletChecklist', label: 'Toilet checklist', kind: 'items', help: 'Points checked in every toilet (boys, girls, staff, disabled).' },
    { id: 'spaceTypes', label: 'Room types', kind: 'types', help: 'Kinds of rooms and spaces you can add, which boxes they show and which checklist they use.' },
    { id: 'qtyCatalog', label: 'Quantity items', kind: 'qty', help: 'Work items for Work quantities (Settings): category, item, unit and how the quantity is worked out.' },
    { id: 'other', label: 'Conditions & tags', kind: 'other', help: 'Condition buttons and photo tags.' },
  ];

  U.screens.form = async (root, part) => {
    S.cur = null;
    part = part || 'school';
    const T = S.template;
    T.removed = T.removed || [];
    const save = () => U.saveTemplate();
    root.append(U.topbar({ back: '/settings', title: 'Edit survey form', sub: 'Changes apply to every school' }));
    root.append(h('nav.tabs', PARTS.map((p) => h('button.tab' + (p.id === part ? '.on' : ''), { onclick: () => U.go('/form/' + p.id, true) }, p.label))));
    const page = h('main.page');
    root.append(page);
    const P = PARTS.find((p) => p.id === part) || PARTS[0];
    page.append(h('p.small.muted', P.help));

    const iconBtn = (name, label, fn, dis) => h('button.icon-btn', { 'aria-label': label, title: label, disabled: !!dis, onclick: fn }, U.icon(name));
    const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; save(); U.rerender(); };

    if (P.kind === 'fields' || P.kind === 'items') {
      const secs = T[part];
      secs.forEach((sec, si) => {
        const list = P.kind === 'fields' ? sec.fields : sec.items;
        const card = h('div.card',
          h('div.ed-sec-head', h('h3', sec.title),
            iconBtn('edit', 'Rename heading', async () => { const v = await U.promptText('Heading name', sec.title); if (v && v.trim()) { sec.title = v.trim(); save(); U.rerender(); } }),
            iconBtn('up', 'Move heading up', () => move(secs, si, -1), si === 0),
            iconBtn('down', 'Move heading down', () => move(secs, si, 1), si === secs.length - 1),
            iconBtn('trash', 'Remove heading', async () => {
              if (!(await U.confirm(`Remove the heading “${sec.title}” and its ${list.length} boxes from the form?\n\nData already typed stays saved, and you can bring the heading back at the bottom of this page.`, { ok: 'Remove', danger: true }))) return;
              T.removed.push({ part, kind: 'section', at: Date.now(), section: sec });
              secs.splice(si, 1); save(); U.rerender();
            })));
        list.forEach((it, ii) => {
          card.append(h('div.ed-item',
            h('div.txt', P.kind === 'fields' ? it.label : `${it.no ? it.no + '  ' : ''}${it.what}`,
              h('small', P.kind === 'fields' ? (TYPES.find((t) => t[0] === it.type) || [, it.type === 'calc' ? 'Auto (calculated)' : it.type])[1] + (it.options ? ': ' + it.options.join(', ') : '') + (part === 'school' ? (U.isPerSchool(it) ? '  ·  one school only' : '  ·  copied to next school') : '') : it.how)),
            iconBtn('edit', 'Edit', () => (P.kind === 'fields' ? editField(it) : editItem(it))),
            iconBtn('up', 'Up', () => move(list, ii, -1), ii === 0),
            iconBtn('down', 'Down', () => move(list, ii, 1), ii === list.length - 1),
            iconBtn('trash', 'Remove', async () => {
              if (!(await U.confirm(`Remove “${P.kind === 'fields' ? it.label : it.what}”?\n\nData already typed stays saved; you can bring it back at the bottom of this page.`, { ok: 'Remove', danger: true }))) return;
              T.removed.push({ part, kind: 'entry', at: Date.now(), secId: sec.id, secTitle: sec.title, entry: it });
              list.splice(ii, 1); save(); U.rerender();
            })));
        });
        card.append(h('button.btn.soft.small', { style: { marginTop: '10px' }, onclick: () => (P.kind === 'fields' ? editField(null, list) : editItem(null, list, sec)) }, U.icon('plus'), P.kind === 'fields' ? 'Add box' : 'Add point'));
        page.append(card);
      });
      page.append(h('button.btn.primary.block', { onclick: async () => {
        const v = await U.promptText('New heading', '', { placeholder: 'e.g. Solar panels' });
        if (!v || !v.trim()) return;
        const sec = P.kind === 'fields' ? { id: U.uid('xs'), title: v.trim(), fields: [] } : { id: U.uid('xs'), title: v.trim(), items: [] };
        secs.push(sec); save(); U.rerender();
      } }, U.icon('plus'), 'Add heading'));
    } else if (P.kind === 'types') {
      const card = h('div.card');
      T.spaceTypes.forEach((t, i) => {
        const gsel = h('select.inp.small-sel', Object.entries(GROUPS).map(([k, l]) => h('option', { value: k, selected: (t.group || 'room') === k }, l)));
        gsel.addEventListener('change', () => { t.group = gsel.value; save(); });
        const ksel = h('select.inp.small-sel', [['room', 'Room checklist'], ['toilet', 'Toilet checklist'], ['', 'No checklist']].map(([k, l]) => h('option', { value: k, selected: (t.checklist === true ? 'room' : t.checklist || '') === k }, l)));
        ksel.addEventListener('change', () => { t.checklist = ksel.value || false; save(); });
        card.append(h('div.ed-item.wrap', h('div.txt', t.label, h('div.row', { style: { gap: '6px', marginTop: '4px' } }, gsel, ksel)),
          iconBtn('edit', 'Rename', async () => { const v = await U.promptText('Room type name', t.label); if (v && v.trim()) { t.label = v.trim(); save(); U.rerender(); } }),
          iconBtn('up', 'Up', () => move(T.spaceTypes, i, -1), i === 0),
          iconBtn('trash', 'Remove', async () => { if (await U.confirm(`Remove room type “${t.label}”? Rooms already added keep their data.`, { ok: 'Remove', danger: true })) { T.removed.push({ part, kind: 'type', at: Date.now(), entry: t }); T.spaceTypes.splice(i, 1); save(); U.rerender(); } })));
      });
      card.append(h('button.btn.soft.small', { style: { marginTop: '10px' }, onclick: async () => {
        const v = await U.promptText('New room type', '', { placeholder: 'e.g. Smart class' });
        if (v && v.trim()) { T.spaceTypes.push({ id: U.uid('t'), label: v.trim(), group: 'room', checklist: 'room' }); save(); U.rerender(); }
      } }, U.icon('plus'), 'Add room type'));
      page.append(card);
    } else if (P.kind === 'qty') {
      T.qtyCatalog = T.qtyCatalog || [];
      T.qtyCatalog.forEach((cat, ci) => {
        const card = h('div.card', h('div.ed-sec-head', h('h3', cat.name),
          iconBtn('edit', 'Rename category', async () => { const v = await U.promptText('Category name', cat.name); if (v && v.trim()) { cat.name = v.trim(); save(); U.rerender(); } }),
          iconBtn('up', 'Move up', () => move(T.qtyCatalog, ci, -1), ci === 0),
          iconBtn('trash', 'Remove category', async () => { if (await U.confirm(`Remove the category “${cat.name}” and its ${cat.items.length} items? Quantities already entered are kept.`, { ok: 'Remove', danger: true })) { T.qtyCatalog.splice(ci, 1); save(); U.rerender(); } })));
        cat.items.forEach((it, ii) => card.append(h('div.ed-item', h('div.txt', it.name, h('small', `${it.unit} · ${(U.QTY_CALC[it.calc] || {}).label || it.calc}`)),
          iconBtn('edit', 'Edit', () => editQtyItem(it, cat.items)),
          iconBtn('up', 'Up', () => move(cat.items, ii, -1), ii === 0),
          iconBtn('trash', 'Remove', async () => { if (await U.confirm(`Remove “${it.name}”? Quantities already entered are kept.`, { ok: 'Remove', danger: true })) { cat.items.splice(ii, 1); save(); U.rerender(); } }))));
        card.append(h('button.btn.soft.small', { style: { marginTop: '10px' }, onclick: () => editQtyItem(null, cat.items) }, U.icon('plus'), 'Add item'));
        page.append(card);
      });
      page.append(h('button.btn.primary.block', { onclick: async () => {
        const v = await U.promptText('New category', '', { placeholder: 'e.g. Solar' });
        if (v && v.trim()) { T.qtyCatalog.push({ id: U.uid('qc'), name: v.trim(), items: [] }); save(); U.rerender(); }
      } }, U.icon('plus'), 'Add category'));
    } else {
      const cards = h('div.card', h('h3', 'Condition buttons'));
      T.conditions.forEach((c) => cards.append(h('div.ed-item', h('div.txt', c.label, h('small', c.hint || '')),
        iconBtn('edit', 'Edit', async () => { const v = await U.promptText('Condition name', c.label); if (v && v.trim()) { c.label = v.trim(); const hh = await U.promptText('What it means', c.hint || '', { multiline: true }); if (hh != null) c.hint = hh.trim(); save(); U.rerender(); } }))));
      page.append(cards);
      const tags = h('textarea.inp', { rows: 4 });
      tags.value = (T.photoTags || []).join(', ');
      tags.addEventListener('change', () => { T.photoTags = tags.value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean); save(); U.toast('Photo tags saved'); });
      page.append(h('div.card', h('h3', 'Photo tags'), h('p.small.muted', 'Quick labels shown in the camera, separated by commas.'), tags));
      page.append(h('div.card', h('h3', 'Start again'), h('p.small.muted', 'Put back the original form. Data already typed is kept.'),
        h('button.btn', { onclick: async () => { if (await U.confirm('Replace your form with the original one?', { ok: 'Reset form', danger: true })) { S.template = self.CU_DEFAULT_TEMPLATE(); await U.saveTemplate(); U.toast('Original form restored'); U.rerender(); } } }, U.icon('restore'), 'Reset to original form')));
    }

    /* removed things can come back */
    const gone = (T.removed || []).filter((r) => r.part === part);
    if (gone.length) {
      const card = h('div.card', h('h3', 'Removed — tap to bring back'));
      gone.forEach((r) => {
        const label = r.kind === 'section' ? `Heading: ${r.section.title}` : r.kind === 'type' ? `Room type: ${r.entry.label}` : `${r.entry.label || r.entry.what}  (in ${r.secTitle})`;
        card.append(h('div.ed-item', h('div.txt', label, h('small', 'Removed ' + U.fmtDateTime(r.at))),
          h('button.btn.small.soft', { onclick: (e) => {
            e.currentTarget.disabled = true;
            if (!T.removed.includes(r)) return; // already brought back (double tap)
            const exists = (arr, id) => (arr || []).some((x) => x && x.id === id);
            if (r.kind === 'section') { if (!exists(T[part], r.section.id)) T[part].push(r.section); }
            else if (r.kind === 'type') { if (!exists(T.spaceTypes, r.entry.id)) T.spaceTypes.push(r.entry); }
            else {
              let sec = T[part].find((x) => x.id === r.secId);
              if (!sec) { sec = P.kind === 'fields' ? { id: r.secId, title: r.secTitle, fields: [] } : { id: r.secId, title: r.secTitle, items: [] }; T[part].push(sec); }
              const arr = P.kind === 'fields' ? sec.fields : sec.items;
              const all = T[part].flatMap((x) => (P.kind === 'fields' ? x.fields : x.items));
              if (!exists(all, r.entry.id)) arr.push(r.entry);
            }
            T.removed.splice(T.removed.indexOf(r), 1);
            save(); U.rerender();
          } }, 'Bring back')));
      });
      page.append(card);
    }

    function editField(fl, list) {
      const isNew = !fl;
      fl = fl || { id: U.uid('xf'), label: '', type: 'text' };
      const lab = h('input.inp'); lab.value = fl.label;
      const sel = h('select.inp', TYPES.map(([k, l]) => h('option', { value: k, selected: fl.type === k }, l)));
      if (fl.type === 'calc') { sel.disabled = true; sel.append(h('option', { value: 'calc', selected: true }, 'Auto (calculated)')); }
      const opts = h('textarea.inp', { rows: 3, placeholder: 'One choice per line' }); opts.value = (fl.options || []).join('\n');
      const hint = h('input.inp', { placeholder: 'Small help text (optional)' }); hint.value = fl.hint || '';
      const optWrap = h('div.field', h('label', 'Choices'), opts);
      const sync = () => { optWrap.hidden = !(sel.value === 'choice' || sel.value === 'multi'); };
      sel.addEventListener('change', sync); sync();
      const per = h('input', { type: 'checkbox', checked: isNew ? false : U.isPerSchool(fl) });
      const perRow = part === 'school' ? h('label.switch', h('span', 'Belongs to one school only', h('div.small.muted', 'On = left empty in a new school. Off = copied from the previous school.')), per) : null;
      const gboxes = {};
      const groupsRow = part === 'spaceFields' ? h('div.field', h('div.lbl', 'Show this box in'), h('div.chips', Object.entries(GROUPS).map(([k, l]) => {
        const c = h('input', { type: 'checkbox', checked: !fl.groups || !fl.groups.length || fl.groups.includes(k) });
        gboxes[k] = c;
        return h('label.chip', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, c, l);
      }))) : null;
      U.modal({ title: isNew ? 'Add box' : 'Edit box', body: [h('div.field', h('label', 'Box name (question)'), lab), h('div.field', h('label', 'Type of answer'), sel), optWrap, h('div.field', h('label', 'Help text'), hint), perRow, groupsRow],
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: () => {
          if (!lab.value.trim()) { U.toast('Please type the box name'); return false; }
          fl.label = lab.value.trim();
          if (fl.type !== 'calc') fl.type = sel.value;
          if (fl.type === 'choice' || fl.type === 'multi') fl.options = opts.value.split('\n').map((x) => x.trim()).filter(Boolean); else delete fl.options;
          if (hint.value.trim()) fl.hint = hint.value.trim(); else delete fl.hint;
          if (part === 'school') fl.perSchool = per.checked;
          if (part === 'spaceFields') { const g = Object.keys(gboxes).filter((k) => gboxes[k].checked); fl.groups = g.length === Object.keys(GROUPS).length ? undefined : g; if (!fl.groups) delete fl.groups; }
          if (isNew) list.push(fl);
          save(); U.rerender();
        } }] });
    }
    function editQtyItem(it, list) {
      const isNew = !it;
      it = it || { id: U.uid('qi'), name: '', unit: 'sq.m', calc: 'area' };
      const nm = h('input.inp'); nm.value = it.name;
      const un = h('input.inp', { placeholder: 'sq.m / cu.m / m / nos / kg / litre' }); un.value = it.unit;
      const cs = h('select.inp', Object.keys(U.QTY_CALC).map((k) => h('option', { value: k, selected: it.calc === k }, U.QTY_CALC[k].label)));
      U.modal({ title: isNew ? 'Add quantity item' : 'Edit quantity item', body: [h('div.field', h('label', 'Item'), nm), h('div.field', h('label', 'Unit'), un), h('div.field', h('label', 'How the quantity is worked out'), cs)],
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: () => {
          if (!nm.value.trim()) { U.toast('Please type the item'); return false; }
          it.name = nm.value.trim(); it.unit = un.value.trim() || 'nos'; it.calc = cs.value;
          if (isNew) list.push(it);
          save(); U.rerender();
        } }] });
    }
    function editItem(it, list, sec) {
      const isNew = !it;
      if (isNew) {
        const last = list[list.length - 1];
        let no = '';
        if (last && /^(.*?)(\d+)$/.test(last.no || '')) { const m = last.no.match(/^(.*?)(\d+)$/); no = m[1] + (Number(m[2]) + 1); }
        else { const sn = (sec.title.match(/^(\d+|[A-Z])\./) || [])[1]; if (sn) no = sn + '.' + (list.length + 1); }
        it = { id: U.uid('xi'), no, what: '', how: '' };
      }
      const no = h('input.inp'); no.value = it.no || '';
      const what = h('input.inp'); what.value = it.what || '';
      const how = h('textarea.inp', { rows: 3 }); how.value = it.how || '';
      const own = h('input', { type: 'checkbox', checked: Array.isArray(it.ans) });
      const ansT = h('textarea.inp', { rows: 4, placeholder: 'One answer per line, e.g.\nYes\nNo\nNot applicable' }); ansT.value = (it.ans || []).join('\n');
      const workT = h('textarea.inp', { rows: 2, placeholder: 'Answers that mean work is needed (one per line)' }); workT.value = (it.work || []).join('\n');
      const ansBox = h('div', h('div.field', h('label', 'Answer buttons'), ansT), h('div.field', h('label', 'These answers mean work is needed (go to the work list)'), workT));
      const syncA = () => { ansBox.hidden = !own.checked; };
      own.addEventListener('change', syncA); syncA();
      U.modal({ title: isNew ? 'Add point' : 'Edit point', body: [h('div.field', h('label', 'No.'), no), h('div.field', h('label', 'What to check'), what), h('div.field', h('label', 'How to check (guidance)'), how),
        h('label.switch', h('span', 'Own answer buttons', h('div.small.muted', 'Off = Good / Repair needed / Replace needed / Not available / Not applicable / Needs rebuild')), own), ansBox],
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: () => {
          if (!what.value.trim()) { U.toast('Please type what to check'); return false; }
          it.no = no.value.trim(); it.what = what.value.trim(); it.how = how.value.trim();
          if (own.checked) {
            it.ans = [...new Set(ansT.value.split('\n').map((x) => x.trim()).filter(Boolean))];
            it.work = workT.value.split('\n').map((x) => x.trim()).filter((x) => x && it.ans.includes(x));
          } else { delete it.ans; delete it.work; }
          if (isNew) list.push(it);
          save(); U.rerender();
        } }] });
    }
  };

  U.loadFormFlow = async () => {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        const t = await U.readTemplateFile(f);
        if (!(await U.confirm('Use the survey form from this file? Your current form will be replaced. Data already typed is kept.', { ok: 'Use this form' }))) return;
        S.template = t; await U.saveTemplate(); U.toast('Survey form loaded'); U.rerender();
      } catch (e) { U.alert(e.message || String(e)); }
    });
    inp.click();
  };

  /* ================= BACKUP / RESTORE ================= */
  U.saveBlobFlow = async (blob, name, kind) => {
    name = U.safeFileName(name);
    const ext = kind === 'json' ? '.json' : U.FILETYPES[kind].ext;
    if (U.canPickFolder()) {
      try {
        const hd = await self.showSaveFilePicker({ suggestedName: name + ext });
        await U.writeToHandle(hd, blob); U.toast('Saved: ' + hd.name); return true;
      } catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    U.modal({ title: 'File ready', body: [h('p', h('b', name + ext)), h('p.muted', U.fmtBytes(blob.size))],
      actions: [
        { label: 'Save file', kind: 'primary', onClick: () => { U.downloadBlob(blob, name + ext); U.toast('Saved to Downloads', 3500); return false; } },
        U.sendAction(blob, name + ext, blob.type || 'application/octet-stream', false, ''),
        { label: 'Close', kind: 'ghost' },
      ].filter(Boolean) });
    return true;
  };

  U.backupFlow = async (ids, label) => {
    if (!ids.length) { U.toast('No school to back up yet'); return; }
    const name = U.safeFileName(`Infra Upgrades backup - ${label} - ${U.isoDate()}`);
    let handle = false;
    if (U.canPickFolder()) {
      handle = await U.pickSaveTarget(name, 'backup');
      if (handle === null) return;
    }
    await U.flushSave();
    const busy = U.busy('Making backup…');
    let blob;
    try {
      blob = await U.makeBackup(ids, (m, f) => busy.set(m, f));
      if (handle) await U.writeToHandle(handle, blob);
      await U.DB.kvSet('lastBackup', Date.now());
    } catch (e) { busy.done(); U.alert('Backup failed: ' + (e.message || e)); return; }
    busy.done();
    if (handle) { U.toast('Backup saved: ' + handle.name, 4000); return; }
    const fn = name + '.cupg';
    U.modal({ title: 'Backup ready', body: [h('p', h('b', fn)), h('p.muted', U.fmtBytes(blob.size)), h('p.small.muted', 'Save it to Downloads, or Share it to Google Drive / your laptop. Keep it until the work is finished.')],
      actions: [
        { label: 'Save file', kind: 'primary', onClick: () => { U.downloadBlob(blob, fn); U.toast('Saved to Downloads', 3500); return false; } },
        U.sendAction(blob, fn, 'application/octet-stream', false, ''),
        { label: 'Close', kind: 'ghost' },
      ].filter(Boolean), onClose: () => U.rerender() });
  };

  U.restoreFlow = () => {
    const inp = h('input', { type: 'file', accept: '.cupg,application/octet-stream,application/zip' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const busy = U.busy('Reading backup…');
      try {
        const r = await U.restoreBackup(f, async (name) => {
          busy.set('Waiting for your answer…');
          const v = await U.choose(`“${name}” is already on this phone`, [
            { label: 'Keep both (add as a copy)', value: 'copy' },
            { label: 'Replace with the backup', sub: 'The phone’s copy of this school is removed', value: 'replace' },
            { label: 'Skip this school', value: 'skip' },
          ]);
          return v || 'skip';
        }, (m, fr) => busy.set(m, fr));
        busy.done();
        S.cur = null;
        await U.alert(`Restored ${r.schools} school(s) and ${r.photos} photo(s).`, 'Backup restored');
        U.go('/');
        U.rerender();
      } catch (e) { busy.done(); U.alert(e.message || String(e)); }
    });
    inp.click();
  };

  /* ================= HELP ================= */
  U.screens.help = (root) => {
    root.append(U.topbar({ back: '/', title: 'Help', sub: 'How to use Infra Upgrades' }));
    const page = h('main.page.help');
    root.append(page);
    page.append(h('div.card',
      h('h3', 'At each school'),
      h('ol',
        h('li', 'Tap “New school” and type the school name.'),
        h('li', 'Details tab: fill what you can (nothing is compulsory). Tap “Use my location now” at the gate for the school GPS.'),
        h('li', 'Rooms tab: add every room and space — classrooms, toilets, hall, gallery, garden, play area. You can add 6 classrooms at once.'),
        h('li', 'Open a room, tap “Take photos of this room”. Take a wide photo, each wall, ceiling, floor and close-ups of damage. The room name and GPS are printed small at the bottom-left of each photo.'),
        h('li', 'Fill sizes and counts, and the room checklist (condition buttons, count/size, notes).'),
        h('li', 'Checklist tab: go point by point (terrace, painting, toilets, water, gates, boundary wall…). Each point can have its own photos.'),
        h('li', 'Report tab: choose PDF, Word or Excel, choose the file name and folder, and save.'),
        h('li', 'Make a backup (menu › Back up this school). Erase the school only after the report and backup are saved.'))),
      h('div.card', h('h3', 'Condition guide'), h('ul', S.template.conditions.map((c) => h('li', h('b', c.label + ': '), c.hint || '')))),
      h('div.card', h('h3', 'Rules for the visit'), h('ol', (self.CU_VISIT_RULES || []).map((r) => h('li', r)))),
      h('div.card', h('h3', 'Your data is safe'), h('ul',
        h('li', 'Everything is saved on the phone the moment you type or take a photo. The top bar shows “Saved ✓”.'),
        h('li', 'Closing the app, a call, or a dead battery does not lose saved work. Open the app again and continue.'),
        h('li', 'Removed rooms and photos go to “Recently deleted” first.'),
        h('li', 'Data is deleted only when you choose “Erase”, or if the browser’s site data is cleared / the app is uninstalled. Keep backup files.'))),
      h('div.card', h('h3', 'Install on the phone'), h('ul',
        h('li', 'Open the app link in Google Chrome. Tap ⋮ › “Install app” (or “Add to Home screen”).'),
        h('li', 'After the first open, it works fully offline — no internet needed at the school.'),
        h('li', 'Allow Camera and Location when asked. Turn on phone GPS for coordinates on photos.'))),
      h('div.footer-note', `Infra Upgrades · version ${self.CU_VERSION || ''}`));
  };

  /* ================= LOCK ================= */
  U.showLock = async (root) => {
    const L = U.Lock.state();
    const first = !L.used;
    const done = L.used >= U.Lock.total();
    const inp = h('input.inp.code-inp', { placeholder: 'UP00-XXXX-XXXX', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
    const msg = h('p.small', { style: { minHeight: '20px' } });
    const go = async () => {
      btn.disabled = true; msg.textContent = 'Checking…'; msg.style.color = '';
      await U.sleep(30);
      const r = await U.Lock.enter(inp.value);
      btn.disabled = false;
      msg.textContent = r.msg; msg.style.color = r.ok ? 'var(--ok)' : 'var(--bad)';
      if (r.ok) { await U.askPersist(); setTimeout(() => U.start(), 700); }
    };
    const btn = h('button.btn.primary.big.block', { onclick: go }, U.icon('key'), 'Open app');
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    const schools = await U.DB.schools().catch(() => []);
    root.append(h('div.lock',
      h('img.big-logo', { src: U.LOGO, alt: '' }),
      h('h1', 'Infra Upgrades'),
      h('div.tag', 'School survey · Civil, MEP & infrastructure'),
      U.isInstalled() ? null : U.installCard(),
      h('div.card',
        h('h2', first ? 'Activate the app' : done ? 'All codes used' : 'The 30 days are over'),
        h('p.muted', first ? 'Type Code 1 to open the app for 30 days.'
          : done ? 'All activation codes have been used. Please ask the owner for new codes.'
            : `Type Code ${L.used + 1} to open the app for the next 30 days. ${schools.length ? `Your ${schools.length} school(s) and photos are safe.` : ''}`),
        U.Lock.clockWentBack() ? h('div.banner.warn', U.icon('info'), h('div', 'The phone date looks earlier than before. Please set the correct date and time.')) : null,
        done ? null : [inp, msg, btn],
        schools.length && !first ? h('button.btn.ghost.block', { style: { marginTop: '8px' }, onclick: () => U.backupFlow(schools.map((s) => s.id), 'All schools') }, U.icon('save'), 'Save a backup of my data') : null)));
    if (!U.isInstalled()) setTimeout(() => inp.focus(), 100);
  };

  /* ================= INSTALL HELP =================
     People often open the link inside WhatsApp or Samsung Internet, where "Install" is not offered.
     This card gives a one-tap Install in Chrome, an "Open in Chrome" button elsewhere, and iPhone steps. */
  let deferredInstall = null;
  self.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; document.querySelectorAll('.install-now').forEach((b) => { b.hidden = false; }); });
  self.addEventListener('appinstalled', () => { deferredInstall = null; document.querySelectorAll('.install-card').forEach((c) => c.remove()); U.toast('App installed — open it from the home screen'); });
  U.isInstalled = () => (self.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  U.browserKind = () => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return /CriOS/i.test(ua) ? 'ios-chrome' : 'ios';
    if (/SamsungBrowser/i.test(ua)) return 'samsung';
    if (/WhatsApp|FBAN|FBAV|Instagram|Line\/|; wv\)|Telegram/i.test(ua)) return 'inapp';
    if (/Android/i.test(ua) && /Chrome\//i.test(ua) && !/EdgA|OPR|Firefox|MiuiBrowser|HeyTap|UCBrowser|YaBrowser/i.test(ua)) return 'chrome';
    if (/Android/i.test(ua)) return 'other-android';
    return 'desktop';
  };
  U.appLink = () => location.origin + location.pathname.replace(/index\.html$/, '');
  U.installCard = () => {
    if (U.isInstalled()) return null;
    const kind = U.browserKind();
    const link = U.appLink();
    const chromeIntent = `intent://${link.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    const copy = h('button.btn.ghost.small', { onclick: async () => { try { await navigator.clipboard.writeText(link); U.toast('Link copied'); } catch (e) { U.promptText('Copy this link', link); } } }, U.icon('copy'), 'Copy link');
    const installBtn = h('button.btn.primary.block.install-now', { hidden: !deferredInstall, onclick: async () => {
      if (!deferredInstall) { U.alert('In Chrome tap ⋮ (top right) › “Install app” or “Add to Home screen”.', 'Install'); return; }
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch (e) { /* */ }
      deferredInstall = null;
    } }, U.icon('download'), 'Install app');
    let steps;
    if (kind === 'chrome') steps = [installBtn, h('ol.small', h('li', 'If the button does not appear: tap ⋮ (top right in Chrome) › “Install app” or “Add to Home screen”.'), h('li', 'Then open Infra Upgrades from the home screen.'))];
    else if (kind === 'ios' || kind === 'ios-chrome') steps = [h('ol.small', h('li', kind === 'ios-chrome' ? 'Open this link in Safari.' : 'Tap the Share button (square with arrow) at the bottom.'), h('li', '“Add to Home Screen” › Add.'), h('li', 'Open Infra Upgrades from the home screen.'))];
    else if (kind === 'desktop') steps = [installBtn, h('p.small.muted', 'On a computer, Chrome or Edge shows an install icon in the address bar.')];
    else steps = [h('p.small', kind === 'samsung' ? 'Samsung Internet cannot install this app. Please open it in Google Chrome:' : 'This link opened inside another app (e.g. WhatsApp), where apps cannot be installed. Please open it in Google Chrome:'),
      h('a.btn.primary.block', { href: chromeIntent }, U.icon('share'), 'Open in Chrome'),
      h('ol.small', h('li', 'In Chrome tap “Install app” (or ⋮ › Install app / Add to Home screen).'), h('li', 'If “Open in Chrome” does not work: tap ⋮ › “Open in Chrome” / “Open in browser”, or copy the link into Chrome.'))];
    return h('div.card.install-card', { style: { textAlign: 'left', marginBottom: '12px', width: 'min(420px, 100%)' } },
      h('h2', 'Install the app on this phone'),
      h('p.small.muted', 'Install first, then open it from the home screen and type the code. The installed app works without internet and keeps data safe.'),
      ...steps, h('div.row', { style: { marginTop: '6px' } }, copy, h('span.small.muted.ellipsis', link)));
  };
})();
