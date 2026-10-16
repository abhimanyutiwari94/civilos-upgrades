/* Infra Upgrades — shared screen parts: top bar, form fields, photo strips, photo viewer. */
(function () {
  'use strict';
  const U = self.U, S = U.S, h = U.h;

  U.LOGO = 'icons/icon-192.png';

  /* ---------- top bar with live "Saved" state ---------- */
  U.topbar = ({ back, title, sub, actions, logo, onTitle }) => {
    const dot = h('span.save-dot', { title: 'Saved on this phone' }, '✓');
    const upd = () => {
      if (S.saveError) { dot.textContent = '!'; dot.title = 'Not saved yet — retrying'; dot.classList.add('err'); return; }
      dot.classList.remove('err');
      const busy = U.isDirty();
      dot.textContent = busy ? '…' : '✓';
      dot.title = busy ? 'Saving…' : 'Saved on this phone';
      dot.classList.toggle('busy', busy);
    };
    const off = U.onSaveState(upd);
    upd();
    const el = h('header.top',
      back ? h('button.icon-btn', { 'aria-label': 'Back', onclick: () => (typeof back === 'function' ? back() : U.go(back)) }, U.icon('back')) : null,
      logo ? h('img.logo', { src: U.LOGO, alt: '' }) : null,
      h('div.title', { onclick: onTitle || null, style: onTitle ? { cursor: 'pointer' } : null }, h('h1', title), sub ? h('div.sub', sub) : null),
      S.cur ? dot : null,
      ...(actions || []));
    el._cleanup = off;
    return el;
  };
  U.menuButton = (items) => h('button.icon-btn', {
    'aria-label': 'More',
    onclick: async () => {
      const v = await U.choose('Options', items.filter(Boolean).map((i, k) => ({ label: i.label, sub: i.sub, value: k })));
      const it = items.filter(Boolean)[v];
      if (it && it.run) it.run();
    },
  }, U.icon('more'));

  /* ---------- accordion ---------- */
  U.acc = (title, countText, full, builder, open) => {
    const body = h('div.acc-body');
    let built = false;
    const chev = U.icon('down', 'chev');
    const count = countText != null ? h('span.count' + (full ? '.full' : ''), countText) : null;
    const root = h('section.acc' + (open ? '.open' : ''),
      h('button.acc-head', { onclick: () => toggle() }, h('span.grow', title), count, chev),
      body);
    function toggle(force) {
      const on = force != null ? force : !root.classList.contains('open');
      root.classList.toggle('open', on);
      if (on && !built) { built = true; U.append(body, [builder()]); }
      body.hidden = !on;
    }
    body.hidden = !open;
    if (open) { built = true; U.append(body, [builder()]); }
    root.setCount = (t, f) => { if (count) { count.textContent = t; count.classList.toggle('full', !!f); } };
    return root;
  };

  /* ---------- fields ---------- */
  const autosize = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(400, ta.scrollHeight + 2) + 'px'; };
  U.autosize = autosize;

  /* data: object to write into; onChange(): after each change */
  U.fieldEl = (fl, data, onChange, copied) => {
    const wrap = h('div.field');
    const id = 'f_' + fl.id + '_' + Math.random().toString(36).slice(2, 6);
    const badge = copied && copied[fl.id] ? h('span.pill', { style: { marginLeft: '6px' } }, 'from last school') : null;
    wrap.appendChild(h('label', { for: id }, fl.label, badge));
    if (fl.hint) wrap.appendChild(h('div.hint', fl.hint));
    const set = (v) => {
      if (v === '' || v == null || (Array.isArray(v) && !v.length)) delete data[fl.id]; else data[fl.id] = v;
      if (badge && copied[fl.id]) { delete copied[fl.id]; badge.remove(); }
      onChange && onChange(fl, v);
    };
    const t = fl.type;
    if (t === 'calc') {
      const out = h('div.calc');
      const upd = () => { const v = U.calcValue(fl, data); out.textContent = v == null ? '—' : U.fmtNum(v); };
      upd();
      wrap._refresh = upd;
      wrap.appendChild(out);
    } else if (t === 'longtext') {
      const ta = h('textarea.inp', { id, rows: 2 });
      ta.value = data[fl.id] || '';
      ta.addEventListener('input', () => { set(ta.value); autosize(ta); });
      setTimeout(() => autosize(ta), 0);
      wrap.appendChild(ta);
    } else if (t === 'choice' || t === 'yesno') {
      if (t === 'choice' && !fl.options) fl.options = [];
      const opts = t === 'yesno' ? ['Yes', 'No'] : fl.options;
      const cur = () => (t === 'yesno' ? (data[fl.id] === true ? 'Yes' : data[fl.id] === false ? 'No' : data[fl.id]) : data[fl.id]);
      const row = h('div.chips');
      const draw = () => {
        U.clear(row);
        const shown = opts.slice();
        if (t === 'choice' && cur() && !shown.includes(cur())) shown.push(cur()); // a choice removed from the list stays visible while selected
        for (const o of shown) row.appendChild(h('button.chip' + (cur() === o ? '.on' : ''), { type: 'button', onclick: () => { set(cur() === o ? null : (t === 'yesno' ? o === 'Yes' : o)); draw(); } }, o));
        if (t === 'choice') { row.appendChild(U.addChoiceChip(fl, (v) => { set(v); draw(); })); row.appendChild(U.editChoicesChip(fl, draw)); }
      };
      draw();
      wrap.appendChild(row);
    } else if (t === 'multi') {
      const row = h('div.chips');
      const draw = () => {
        U.clear(row);
        const cur = Array.isArray(data[fl.id]) ? data[fl.id] : [];
        const shown = (fl.options || []).concat(cur.filter((x) => !(fl.options || []).includes(x))); // removed choices stay visible while selected
        for (const o of shown) {
          row.appendChild(h('button.chip' + (cur.includes(o) ? '.on' : ''), { type: 'button', onclick: () => {
            const c = Array.isArray(data[fl.id]) ? data[fl.id].slice() : [];
            const i = c.indexOf(o);
            if (i >= 0) c.splice(i, 1); else c.push(o);
            set(c); draw();
          } }, o));
        }
        row.appendChild(U.addChoiceChip(fl, (v) => {
          const c = Array.isArray(data[fl.id]) ? data[fl.id].slice() : [];
          if (!c.includes(v)) c.push(v);
          set(c); draw();
        }));
        row.appendChild(U.editChoicesChip(fl, draw));
      };
      draw();
      wrap.appendChild(row);
    } else if (t === 'gps') {
      const out = h('div.calc');
      const show = () => { const v = data[fl.id]; out.textContent = v && v.lat != null ? `${U.fmtLatLng(v.lat, v.lng)}${v.acc ? `  (±${Math.round(v.acc)} m)` : ''}` : 'Not taken yet'; };
      show();
      const btn = h('button.btn.soft.small', { type: 'button', onclick: async () => {
        btn.disabled = true; btn.textContent = 'Finding accurate location…';
        /* listen up to 30 s and keep the most accurate reading (stops early at ±5 m) */
        if (U.Geo.approximate()) U.alert(U.preciseHelp(), 'Turn on precise location');
        const f = await U.Geo.once(30000, (b) => { btn.textContent = `Improving… ±${Math.round(b.acc)} m`; });
        btn.disabled = false; btn.textContent = 'Use my location now';
        if (!f) { U.toast('Location not found. Turn on GPS / location and try in open sky.'); return; }
        set({ lat: U.round(f.lat, 6), lng: U.round(f.lng, 6), acc: Math.round(f.acc) }); show();
        if (f.acc >= 1000) U.alert(U.preciseHelp(), 'Turn on precise location');
        else if (f.acc > U.gpsTarget()) U.toast(`Location is ±${Math.round(f.acc)} m. Stand in the open for 30 s and tap again.`, 5000);
      } }, 'Use my location now');
      const edit = h('button.btn.ghost.small', { type: 'button', onclick: async () => {
        const v = data[fl.id];
        const s = await U.promptText('Type latitude, longitude', v && v.lat != null ? `${v.lat}, ${v.lng}` : '', { placeholder: '26.846700, 80.946200', inputmode: 'decimal' });
        if (s == null) return;
        if (!s.trim()) { set(null); show(); return; }
        const m = s.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
        if (!m) { U.toast('Please type like: 26.8467, 80.9462'); return; }
        set({ lat: Number(m[1]), lng: Number(m[2]) }); show();
      } }, 'Type');
      wrap.appendChild(out);
      wrap.appendChild(h('div.row', { style: { marginTop: '8px' } }, btn, edit));
    } else {
      const inp = h('input.inp', { id });
      if (t === 'number') { inp.type = 'text'; inp.inputMode = 'decimal'; }
      else if (t === 'phone') { inp.type = 'tel'; inp.inputMode = 'tel'; }
      else if (t === 'date') inp.type = 'date';
      else inp.type = 'text';
      inp.value = data[fl.id] != null ? data[fl.id] : '';
      inp.addEventListener('input', () => {
        let v = inp.value;
        if (t === 'number') v = v.replace(/[^\d.\-]/g, '');
        set(v);
      });
      wrap.appendChild(inp);
    }
    return wrap;
  };
  /* '+ Add' chip: a new choice is added to the survey form for every school, then selected. */
  U.addChoiceChip = (fl, pick) => h('button.chip.chip-add', { type: 'button', onclick: async () => {
    const v = await U.promptText('Add to “' + fl.label + '”', '', { placeholder: 'e.g. ATT (anti-termite treatment)', help: 'It is added to this list for every school. Remove it later in Menu › Edit survey form.' });
    const t = v && v.trim();
    if (!t) return;
    fl.options = fl.options || [];
    const same = fl.options.find((o) => o.toLowerCase() === t.toLowerCase());
    if (!same) { fl.options.push(t); await U.saveTemplate(); }
    pick(same || t);
    U.toast('Added: ' + (same || t));
  } }, '+ Add');

  /* 'Edit list' chip: rename, remove or move the choices of a box (for every school).
     Answers already given are kept: a removed choice stays visible where it was selected. */
  U.editChoicesChip = (fl, redraw) => h('button.chip.chip-add', { type: 'button', onclick: () => U.editChoices(fl, redraw) }, '✎ Edit list');
  U.editChoices = (fl, redraw) => {
    fl.options = fl.options || [];
    const body = h('div');
    const draw = () => {
      U.clear(body);
      fl.options.forEach((o, i) => body.append(h('div.ed-item', h('div.txt', o),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Rename', onclick: async () => {
          const v = await U.promptText('Rename choice', o);
          const t = v && v.trim();
          if (!t || t === o) return;
          if (fl.options.includes(t)) { U.toast('That choice is already in the list'); return; }
          fl.options[i] = t; await U.saveTemplate(); draw();
          U.toast('Renamed. Schools that already chose “' + o + '” keep that answer.');
        } }, U.icon('edit')),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: async () => { [fl.options[i - 1], fl.options[i]] = [fl.options[i], fl.options[i - 1]]; await U.saveTemplate(); draw(); } }, U.icon('up')),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Remove', style: { color: 'var(--bad)' }, onclick: async () => {
          if (!(await U.confirm(`Remove “${o}” from the list? Schools where it is already chosen keep it.`, { ok: 'Remove', danger: true }))) return;
          fl.options.splice(i, 1); await U.saveTemplate(); draw();
        } }, U.icon('trash')))));
      body.append(h('button.btn.soft.small', { type: 'button', style: { marginTop: '10px' }, onclick: async () => {
        const v = await U.promptText('Add a choice', '', { placeholder: 'e.g. ATT (anti-termite treatment)' });
        const t = v && v.trim();
        if (!t) return;
        if (!fl.options.includes(t)) { fl.options.push(t); await U.saveTemplate(); }
        draw();
      } }, U.icon('plus'), 'Add a choice'));
    };
    draw();
    U.modal({ title: fl.label, body: [h('p.small.muted', 'Changes apply to every school.'), body], onClose: () => redraw && redraw(), actions: [{ label: 'Done', kind: 'primary' }] });
  };

  /* A group of fields; calc fields refresh when their inputs change. */
  U.fieldsEl = (fields, data, onChange, copied) => {
    const els = fields.map((fl) => U.fieldEl(fl, data, () => { els.forEach((e) => e._refresh && e._refresh()); onChange && onChange(); }, copied));
    return h('div', els);
  };

  /* ---------- photos ---------- */
  const thumbUrls = new Map();
  U.thumbURL = async (id) => {
    if (thumbUrls.has(id)) return thumbUrls.get(id);
    let t = await U.DB.thumb(id);
    if (!t || !t.blob) {
      const p = await U.DB.photo(id);
      if (!p || !p.blob) return '';
      const r = await U.resizeBlob(p.blob, 360, 0.72);
      t = { blob: r.blob };
    }
    const u = URL.createObjectURL(t.blob);
    thumbUrls.set(id, u);
    return u;
  };

  /* photo metas of the open school (no image data) */
  U.loadPhotos = async (school) => {
    const all = await U.DB.photosOf(school.id);
    S.photos = all.map((p) => { const m = Object.assign({}, p); delete m.blob; return m; });
    const live = S.photos.filter((p) => !p.deleted).length;
    if (school.photoCount !== live) { school.photoCount = live; U.touch(school); }
    return S.photos;
  };
  U.photosFor = (target) => (S.photos || []).filter((p) => p.target === target && !p.deleted).sort((a, b) => (a.no || 0) - (b.no || 0));

  /* Save one camera result as a photo of `target`. */
  U.addPhoto = async (school, target, r, caption) => {
    school.photoSeq = Math.max(school.photoSeq || 0, ...(S.photos || []).map((p) => p.no || 0)) + 1;
    const p = {
      id: U.uid('p'), schoolId: school.id, target, no: school.photoSeq,
      caption: caption || '', tag: r.tag || '', place: r.place || '',
      lat: r.fix ? U.round(r.fix.lat, 7) : null, lng: r.fix ? U.round(r.fix.lng, 7) : null, acc: r.fix && r.fix.acc != null ? Math.round(r.fix.acc) : null, approx: !r.fix || (r.fix.acc != null && r.fix.acc > U.gpsTarget()),
      ts: r.ts || Date.now(), w: r.w, h: r.h, size: r.blob.size, source: r.source || 'app', blob: r.blob,
    };
    await U.DB.putPhoto(p, r.thumb);
    const meta = Object.assign({}, p); delete meta.blob;
    S.photos = S.photos || [];
    S.photos.push(meta);
    school.photoCount = (school.photoCount || 0) + 1;
    U.touch(school);
    await U.flushSave();
    return meta;
  };

  /* Start taking photos for a target. place(): stamp name. */
  U.takePhotos = (school, target, place, caption, onDone) => {
    const opts = {
      title: caption || place,
      place: () => place,
      tags: S.template.photoTags || [],
      onSave: (r) => U.addPhoto(school, target, r, caption || ''),
      onClose: () => onDone && onDone(),
    };
    if (S.settings.photo.camera === 'phone') {
      U.quickPhoneShot(opts).then((n) => { if (n) U.toast(n + ' photo saved'); onDone && onDone(); }, (e) => U.alert(e.message || String(e)));
    } else U.openCamera(opts);
  };

  /* Remove photos: they go to "Recently deleted" (school menu) and can be brought back. */
  U.removePhotos = async (ids) => {
    const at = Date.now();
    for (const id of ids) {
      await U.DB.updatePhotoMeta(id, { deleted: at });
      const m = (S.photos || []).find((x) => x.id === id);
      if (m) m.deleted = at;
    }
    if (S.cur) { S.cur.photoCount = (S.photos || []).filter((p) => !p.deleted).length; U.touch(S.cur); }
  };

  /* Thumbnails + add button, with "Select" to remove several photos at once. */
  U.photoStrip = (school, target, place, caption, onChange) => {
    const box = h('div.thumbs');
    const bar = h('div.strip-bar');
    const wrap = h('div.strip', box, bar);
    let selecting = false;
    const chosen = new Set();
    const changed = () => { draw(); onChange && onChange(); };
    const drawBar = (count) => {
      U.clear(bar);
      if (!count) return;
      if (!selecting) {
        bar.append(h('button.btn.small.ghost', { type: 'button', onclick: () => { selecting = true; chosen.clear(); draw(); } }, U.icon('check'), 'Select to remove'));
        return;
      }
      bar.append(
        h('span.small.grow', chosen.size ? `${chosen.size} selected` : 'Tap photos to select'),
        h('button.btn.small.ghost', { type: 'button', onclick: () => { selecting = false; chosen.clear(); draw(); } }, 'Cancel'),
        h('button.btn.small.danger', { type: 'button', disabled: !chosen.size, onclick: async () => {
          const n = chosen.size;
          if (!(await U.confirm(`Remove ${n} photo${n > 1 ? 's' : ''}? They go to "Recently deleted" in the school menu, where you can bring them back.`, { ok: 'Remove', danger: true }))) return;
          await U.removePhotos([...chosen]);
          selecting = false; chosen.clear();
          U.toast(`${n} photo${n > 1 ? 's' : ''} removed`);
          changed();
        } }, U.icon('trash'), 'Remove'));
    };
    const draw = async () => {
      U.clear(box);
      if (!selecting) box.appendChild(h('button.add-photo', { type: 'button', onclick: () => U.takePhotos(school, target, place(), caption, changed) }, U.icon('camera'), 'Add photo'));
      const list = U.photosFor(target);
      for (const p of list) {
        const img = h('img', { alt: U.photoNo(p), loading: 'lazy' });
        const tick = h('span.pick', U.icon('check'));
        const t = h('button.thumb' + (chosen.has(p.id) ? '.picked' : ''), { type: 'button', onclick: () => {
          if (!selecting) { U.viewPhoto(list, list.indexOf(p), changed); return; }
          if (chosen.has(p.id)) chosen.delete(p.id); else chosen.add(p.id);
          t.classList.toggle('picked', chosen.has(p.id));
          drawBar(list.length);
        } }, img, h('span.no', U.photoNo(p)), selecting ? tick : null);
        box.appendChild(t);
        U.thumbURL(p.id).then((u) => { img.src = u; });
      }
      if (selecting && !list.length) selecting = false;
      drawBar(list.length);
    };
    draw();
    wrap.redraw = draw;
    return wrap;
  };

  /* Full-screen photo viewer with caption, tag, move and delete. */
  U.viewPhoto = (list, index, onChange) => {
    let i = index, url = null, closed = false;
    const img = h('img', { alt: '' });
    const title = h('div.cam-title');
    const sub = h('div.small', { style: { opacity: 0.85 } });
    const panel = h('div.viewer-panel');
    const root = h('div.viewer',
      h('div.cam-top', h('button.cam-round', { 'aria-label': 'Close', onclick: () => close() }, U.icon('x')), h('div.cam-top-mid', title, sub),
        h('button.cam-round.cam-del', { 'aria-label': 'Remove this photo', title: 'Remove this photo', onclick: () => removeCurrent() }, U.icon('trash'))),
      h('div.viewer-img', img,
        h('button.cam-round.viewer-nav.prev', { 'aria-label': 'Previous', onclick: () => go(-1) }, U.icon('back')),
        h('button.cam-round.viewer-nav.next', { 'aria-label': 'Next', onclick: () => go(1) }, h('span', { style: { transform: 'scaleX(-1)', display: 'inline-flex' } }, U.icon('back')))),
      panel);
    document.body.appendChild(root);
    history.pushState({ viewer: 1 }, '');
    const onPop = () => close(true);
    self.addEventListener('popstate', onPop);

    async function show() {
      const p = list[i];
      if (!p) { close(); return; }
      title.textContent = U.photoCaption(p);
      sub.textContent = U.photoSub(p) + (p.w ? `  ·  ${p.w}×${p.h}` : '') + (p.size ? `  ·  ${U.fmtBytes(p.size)}` : '');
      root.querySelector('.prev').hidden = i <= 0;
      root.querySelector('.next').hidden = i >= list.length - 1;
      const full = await U.DB.photo(p.id);
      if (closed) return;
      if (url) URL.revokeObjectURL(url);
      url = full && full.blob ? URL.createObjectURL(full.blob) : '';
      img.src = url;
      U.clear(panel);
      const cap = h('input.inp', { placeholder: 'Caption (what this photo shows)' });
      cap.value = p.caption || '';
      cap.addEventListener('change', async () => { p.caption = cap.value.trim(); await U.DB.updatePhotoMeta(p.id, { caption: p.caption }); title.textContent = U.photoCaption(p); onChange && onChange(); });
      const tags = h('div.chips', { style: { margin: '8px 0' } }, (S.template.photoTags || []).map((t) => h('button.chip.small' + (p.tag === t ? '.on' : ''), { onclick: async (e) => {
        p.tag = p.tag === t ? '' : t;
        await U.DB.updatePhotoMeta(p.id, { tag: p.tag });
        U.$$('.chip', tags).forEach((c) => c.classList.toggle('on', c.textContent === p.tag));
        title.textContent = U.photoCaption(p); onChange && onChange();
        e.currentTarget.blur();
      } }, t)));
      panel.append(
        h('div.row.wrap', { style: { marginBottom: '10px', gap: '8px' } },
          h('button.btn.small.danger', { onclick: () => removeCurrent() }, U.icon('trash'), 'Remove photo'),
          h('button.btn.small', { onclick: () => movePhoto(p) }, U.icon('room'), 'Move to…'),
          h('button.btn.small', { onclick: async () => { const f = await U.DB.photo(p.id); if (!f) return; const nm = U.safeFileName(U.photoCaption(p)) + '.jpg'; if (!(await U.shareBlob(f.blob, nm, 'image/jpeg'))) U.downloadBlob(f.blob, nm); } }, U.icon('share'), 'Share')),
        h('div.field', h('label', 'Caption'), cap),
        h('div.lbl.small.muted', 'Tag'), tags);
    }
    async function removeCurrent() {
      const p = list[i];
      if (!p) return;
      if (!(await U.confirm('Remove this photo? It goes to "Recently deleted" in the school menu, where you can bring it back.', { ok: 'Remove', danger: true }))) return;
      await U.removePhotos([p.id]);
      list.splice(i, 1);
      onChange && onChange();
      U.toast('Photo removed');
      if (!list.length) close(); else { i = Math.min(i, list.length - 1); show(); }
    }
    async function movePhoto(p) {
      const s = S.cur;
      const items = [{ label: 'School — general photos', value: 'school' }];
      for (const sp of U.liveSpaces(s)) items.push({ label: U.spaceTitle(sp), sub: U.T.type(sp.typeId).label, value: 'space:' + sp.id });
      for (const sec of S.template.checklist) for (const it of sec.items) items.push({ label: `${it.no} ${it.what}`, sub: sec.title, value: 'item:' + it.id });
      const v = await U.choose('Move photo to…', items);
      if (!v) return;
      p.target = v;
      await U.DB.updatePhotoMeta(p.id, { target: v });
      const m = (S.photos || []).find((x) => x.id === p.id); if (m) m.target = v;
      U.toast('Photo moved');
      list.splice(i, 1);
      onChange && onChange();
      if (!list.length) close(); else { i = Math.min(i, list.length - 1); show(); }
    }
    function go(d) { const n = i + d; if (n >= 0 && n < list.length) { i = n; show(); } }
    function close(fromPop) {
      if (closed) return;
      closed = true;
      self.removeEventListener('popstate', onPop);
      if (!fromPop) history.back();
      if (url) URL.revokeObjectURL(url);
      root.remove();
    }
    let sx = null;
    root.querySelector('.viewer-img').addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    root.querySelector('.viewer-img').addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); sx = null; });
    show();
  };

  /* Stamp text for a place inside the open school */
  U.placeName = (school, part) => {
    const s = S.settings.photo;
    const nm = U.schoolName(school);
    const bits = [part];
    if (s.stampSchool && nm && part !== nm) bits.push(nm);
    return bits.filter(Boolean).join(' · ');
  };
})();
