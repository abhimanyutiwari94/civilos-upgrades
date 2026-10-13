/* Infra Upgrades — app state and auto-save.
   Every change is saved within a fraction of a second, and again the moment the
   app is hidden or closed. A second copy of the open school is kept as a safety net. */
(function () {
  'use strict';
  const U = self.U;
  const S = (U.S = {
    settings: null,
    template: null,
    schools: [],
    cur: null, // the school being worked on
    saving: 0,
    lastSaved: 0,
    saveError: null,
  });

  U.defaultSettings = () => ({
    brand: {
      show: false,
      company: '',
      logo: null, // data URL
      reportTitle: 'School Site Visit Report',
      projectName: 'CSR School Renovation',
      preparedFor: '',
      writer: '',
      designation: '',
      phone: '',
      email: '',
      footerNote: '',
    },
    report: {
      includeBlank: false,
      includeHow: false,
      photosPerRow: 2,
      photoSize: 1400,
      summary: true,
      quantities: true,
      signatures: true,
      appCredit: false,
      qty: true,
    },
    qty: { on: false, fmt: 'xlsx' },
    photo: {
      maxSide: 2560, // long side in pixels — sharp but small (about 0.5–0.9 MB)
      quality: 0.82,
      camera: 'app', // 'app' = in-app camera, 'phone' = phone camera app
      stampCoords: true,
      stampPlace: true,
      stampSchool: true,
      stampTime: false,
      stampSize: 'small',
    },
    roomExport: { what: 'report', fmt: 'pdf', separate: false, data: true, remarks: true },
    lastFormat: 'pdf',
    lastSaveFolderHint: '',
  });

  function merge(def, got) {
    if (!got || typeof got !== 'object') return def;
    for (const k in def) {
      if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) def[k] = merge(def[k], got[k]);
      else if (got[k] !== undefined) def[k] = got[k];
    }
    return def;
  }

  U.loadAll = async () => {
    S.settings = merge(U.defaultSettings(), await U.DB.kvGet('settings'));
    /* older installs: move to the company report heading */
    if (S.settings.brand.reportTitle === 'School Infrastructure Survey Report') S.settings.brand.reportTitle = 'School Site Visit Report';
    if (!S.settings.brand.projectName) S.settings.brand.projectName = 'CSR School Renovation';
    S.template = (await U.DB.kvGet('template')) || self.CU_DEFAULT_TEMPLATE();
    if (U.migrateTemplate(S.template)) await U.saveTemplate();
    await U.refreshSchools();
  };
  U.saveSettings = async () => { await U.DB.kvSet('settings', S.settings); };
  U.saveTemplate = async () => { await U.DB.kvSet('template', S.template); };
  U.refreshSchools = async () => {
    const all = await U.DB.schools();
    S.schools = all.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return S.schools;
  };

  /* true = this box belongs to one school only and is never copied to the next school */
  U.isPerSchool = (fl) => (fl.perSchool != null ? !!fl.perSchool : (self.CU_PER_SCHOOL || []).includes(fl.id) || fl.type === 'gps' || fl.type === 'calc');

  /* New school. copyFrom = previous school; what = { details, rooms, answers } */
  U.newSchool = (copyFrom, what) => {
    what = what || { details: true };
    const s = {
      id: U.uid('s'),
      v: 1,
      created: Date.now(),
      updated: Date.now(),
      data: {},
      checks: {},
      spaces: [],
      photoSeq: 0,
      lastOutputAt: null,
      copied: {},
    };
    const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
    if (copyFrom && what.details) {
      for (const sec of S.template.school) for (const fl of sec.fields) {
        if (U.isPerSchool(fl)) continue;
        const v = copyFrom.data[fl.id];
        if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
        s.data[fl.id] = clone(v);
        s.copied[fl.id] = true;
      }
    }
    if (copyFrom && what.answers) s.checks = clone(copyFrom.checks || {});
    if (copyFrom && what.rooms) {
      for (const sp of U.liveSpaces(copyFrom)) {
        s.spaces.push({ id: U.uid('r'), typeId: sp.typeId, name: sp.name, block: sp.block || '', floor: sp.floor || '',
          useChecklist: sp.useChecklist, data: what.answers ? clone(sp.data || {}) : {}, checks: what.answers ? clone(sp.checks || {}) : {}, notes: '', created: Date.now() });
      }
    }
    for (const sec of S.template.school) for (const fl of sec.fields) if (fl.type === 'date' && fl.today) s.data[fl.id] = U.isoDate();
    return s;
  };
  U.schoolName = (s) => (s && s.data && String(s.data.sd_name || '').trim()) || 'School (no name yet)';
  U.schoolPlace = (s) => [s.data.sd_village, s.data.sd_block, s.data.sd_district].map((x) => String(x || '').trim()).filter(Boolean).join(', ');

  /* ---- auto-save ---- */
  const listeners = new Set();
  U.onSaveState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const emit = () => listeners.forEach((fn) => { try { fn(S); } catch (e) { /* */ } });

  const mirrorKey = (id) => 'cu.mirror.' + id;
  function mirror(s) {
    try { localStorage.setItem(mirrorKey(s.id), JSON.stringify(s)); } catch (e) { /* storage full — DB copy still holds */ }
  }

  const mirrorSoon = U.debounce((s) => mirror(s), 250);
  let pending = null;
  async function writeNow() {
    const s = pending;
    pending = null;
    if (!s) return;
    S.saving++;
    emit();
    try {
      await U.DB.putSchool(s);
      S.lastSaved = Date.now();
      S.saveError = null;
    } catch (e) {
      S.saveError = e;
      pending = pending || s; // try again
      setTimeout(() => saveDebounced(), 1500);
    } finally {
      S.saving--;
      emit();
    }
  }
  const saveDebounced = U.debounce(writeNow, 350);

  /* Call after any change to S.cur (or another school object). */
  U.touch = (s) => {
    s = s || S.cur;
    if (!s) return;
    s.updated = Date.now();
    pending = s;
    mirrorSoon(s); // safety copy a moment later (typing stays fast); written at once when the app is hidden
    S.saving++;
    emit();
    S.saving--;
    saveDebounced();
  };
  U.flushSave = async () => { if (pending) await writeNow(); };
  U.isDirty = () => !!pending || S.saving > 0;

  /* Make sure nothing is lost when the app goes to the background or closes. */
  const flushHard = () => { if (pending) { mirror(pending); saveDebounced.flush(); } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushHard(); });
  self.addEventListener('pagehide', flushHard);
  self.addEventListener('beforeunload', flushHard);

  /* On opening a school: if the safety copy is newer than the stored one, use it. */
  U.openSchool = async (id) => {
    let s = await U.DB.school(id);
    try {
      const m = JSON.parse(localStorage.getItem(mirrorKey(id)) || 'null');
      if (m && m.id === id && (!s || (m.updated || 0) > (s.updated || 0))) {
        s = m;
        await U.DB.putSchool(s);
      }
    } catch (e) { /* ignore broken mirror */ }
    if (!s) return null;
    s.data = s.data || {}; s.checks = s.checks || {}; s.spaces = s.spaces || [];
    S.cur = s;
    return s;
  };
  U.dropMirror = (id) => { try { localStorage.removeItem(mirrorKey(id)); } catch (e) { /* */ } };
  /* Any school that only exists in the safety copy (DB write never finished) comes back. */
  U.recoverMirrors = async () => {
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('cu.mirror.')) continue;
        const m = JSON.parse(localStorage.getItem(k) || 'null');
        if (!m || !m.id) continue;
        const s = await U.DB.school(m.id);
        if (!s || (m.updated || 0) > (s.updated || 0)) { await U.DB.putSchool(m); n++; }
      }
    } catch (e) { /* */ }
    return n;
  };

  /* ---- template helpers ---- */
  U.T = {
    allSchoolFields: () => S.template.school.flatMap((s) => s.fields),
    allChecks: () => S.template.checklist.flatMap((s) => s.items),
    allRoomChecks: () => S.template.roomChecklist.flatMap((s) => s.items),
    allSpaceFields: () => S.template.spaceFields.flatMap((s) => s.fields),
    type: (id) => S.template.spaceTypes.find((t) => t.id === id) || { id: id || 'other', label: 'Other', checklist: false },
    cond: (id) => S.template.conditions.find((c) => c.id === id) || null,
  };
  U.calcValue = (fl, data) => {
    const v = (fl.of || []).map((k) => U.num(data[k]));
    if (fl.calc === 'sum') { if (v.every((x) => x == null)) return null; return v.reduce((a, b) => a + (b || 0), 0); }
    if (fl.calc === 'mul') { if (v.some((x) => x == null)) return null; return v.reduce((a, b) => a * b, 1); }
    if (fl.calc === 'wall') { const [l, b, ht] = v; if (l == null || b == null || ht == null) return null; return 2 * (l + b) * ht; }
    return null;
  };
  U.T.allSpaceChecks = () => S.template.roomChecklist.concat(S.template.toiletChecklist || []).flatMap((s) => s.items);
  U.T.group = (sp) => U.T.type(sp.typeId).group || 'room';

  /* Which checklist a space uses: the room checklist, the toilet checklist, or none. */
  U.checklistKind = (sp) => {
    const t = U.T.type(sp.typeId);
    let kind = t.checklist === true ? 'room' : t.checklist || false;
    if (sp.useChecklist === false) return false;
    if (sp.useChecklist === true && !kind) kind = 'room';
    return kind;
  };
  U.checklistFor = (sp) => {
    const k = U.checklistKind(sp);
    return k === 'toilet' ? (S.template.toiletChecklist || []) : k ? S.template.roomChecklist : [];
  };
  U.checksOf = (sp) => U.checklistFor(sp).flatMap((s) => s.items);
  U.spaceUsesChecklist = (sp) => U.checklistFor(sp).length > 0;

  /* Room boxes for this kind of space. A box that already holds data always shows, so nothing is ever hidden. */
  const fits = (x, g) => !x.groups || !x.groups.length || x.groups.includes(g);
  const hasValue = (sp, fl) => fl.type !== 'calc' && sp.data && sp.data[fl.id] != null && sp.data[fl.id] !== '' && !(Array.isArray(sp.data[fl.id]) && !sp.data[fl.id].length);
  U.fieldSectionsFor = (sp) => {
    const g = U.T.group(sp);
    return S.template.spaceFields.map((sec) => ({ sec, fields: sec.fields.filter((fl) => (fits(sec, g) && fits(fl, g)) || hasValue(sp, fl)) })).filter((x) => x.fields.length);
  };
  U.fieldsOfSpace = (sp) => U.fieldSectionsFor(sp).flatMap((x) => x.fields);

  /* Does this answer mean work is needed? (condition buttons, or the point's own "work" choices) */
  const BAD = new Set(['repair', 'replace', 'notavail', 'rebuild']);
  U.needsWork = (it, v) => !!v && (BAD.has(v) || ((it && it.work) || []).includes(v));

  U.spaceTitle = (sp) => (sp.name || U.T.type(sp.typeId).label || 'Space').trim();
  U.spaceWhere = (sp) => [sp.block, sp.floor].map((x) => String(x || '').trim()).filter(Boolean).join(' · ');
  U.liveSpaces = (s) => (s.spaces || []).filter((x) => !x.deleted);

  /* Progress = points answered, out of all points (points with no answer buttons count when Count/Size or Notes is filled). */
  const answered = (it, r) => !!(r && (r.c || ((it.ans && !it.ans.length) && (r.q || r.n))));
  U.progress = (s) => {
    const items = U.T.allChecks();
    let done = items.filter((i) => answered(i, s.checks[i.id])).length;
    let total = items.length;
    for (const sp of U.liveSpaces(s)) {
      const ri = U.checksOf(sp);
      total += ri.length;
      done += ri.filter((i) => answered(i, sp.checks && sp.checks[i.id])).length;
    }
    return total ? done / total : 0;
  };
  U.isAnswered = answered;

  /* Bring a survey form saved on the phone up to the current version without losing anything
     the team added or removed. Returns true when something changed. */
  U.migrateTemplate = (T) => {
    let ch = false;
    const D = self.CU_DEFAULT_TEMPLATE();
    /* one box / point can never appear twice (same id) */
    const dedupe = (secs, key) => {
      const seen = new Set();
      for (const sec of secs || []) {
        const before = (sec[key] || []).length;
        sec[key] = (sec[key] || []).filter((x) => { if (!x || !x.id || seen.has(x.id)) return false; seen.add(x.id); return true; });
        if (sec[key].length !== before) ch = true;
      }
    };
    dedupe(T.school, 'fields'); dedupe(T.checklist, 'items'); dedupe(T.spaceFields, 'fields'); dedupe(T.roomChecklist, 'items');
    if (T.toiletChecklist) dedupe(T.toiletChecklist, 'items');
    for (const sec of T.school.concat(T.spaceFields)) for (const fl of sec.fields) if (fl.options) {
      const u = [...new Set(fl.options)];
      if (u.length !== fl.options.length) { fl.options = u; ch = true; }
    }
    if ((T.tv || 1) < 2) {
      const removed = new Set((T.removed || []).map((r) => (r.kind === 'section' ? r.section.id : r.entry && r.entry.id)));
      const defItems = new Map(D.checklist.concat(D.roomChecklist).flatMap((x) => x.items).map((i) => [i.id, i]));
      for (const it of T.checklist.concat(T.roomChecklist).flatMap((x) => x.items)) {
        const d = defItems.get(it.id);
        if (d && d.ans && it.ans === undefined) { it.ans = d.ans.slice(); it.work = d.work.slice(); }
      }
      const defF = new Map(D.spaceFields.flatMap((x) => x.fields).map((x) => [x.id, x]));
      for (const fl of T.spaceFields.flatMap((x) => x.fields)) { const d = defF.get(fl.id); if (d && d.groups && fl.groups === undefined) fl.groups = d.groups.slice(); }
      const have = new Set(T.spaceFields.flatMap((x) => x.fields).map((x) => x.id));
      const size = T.spaceFields.find((x) => x.id === 'sp_size');
      if (size && !have.has('sp_wall1') && !removed.has('sp_wall1')) {
        const i = size.fields.findIndex((x) => x.id === 'sp_wall');
        size.fields.splice(i < 0 ? size.fields.length : i + 1, 0, defF.get('sp_wall1'));
      }
      for (const id of ['sp_toilet', 'sp_water']) {
        if (T.spaceFields.some((x) => x.id === id) || removed.has(id)) continue;
        const at = T.spaceFields.findIndex((x) => x.id === 'sp_work');
        T.spaceFields.splice(at < 0 ? T.spaceFields.length : at, 0, D.spaceFields.find((x) => x.id === id));
      }
      const defT = new Map(D.spaceTypes.map((t) => [t.id, t]));
      for (const t of T.spaceTypes) {
        const d = defT.get(t.id);
        if (!t.group) t.group = d ? d.group : 'room';
        if (t.checklist === true) t.checklist = 'room';
        if (d && d.checklist === 'toilet' && t.checklist === false) t.checklist = 'toilet';
      }
      if (!T.toiletChecklist) T.toiletChecklist = D.toiletChecklist;
      if (!T.qtyCatalog) T.qtyCatalog = D.qtyCatalog;
      T.tv = 2;
      ch = true;
    }
    return ch;
  };
})();
