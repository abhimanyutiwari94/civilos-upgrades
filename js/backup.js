/* Infra Upgrades — backup files (.cupg). One file holds schools + all their photos.
   Used to keep a safe copy, to move data to a laptop, or to combine the team's surveys. */
(function () {
  'use strict';
  const U = self.U;
  const S = U.S;

  U.makeBackup = async (schoolIds, progress) => {
    const z = new U.ZipWriter();
    const out = { app: 'civilos-upgrades', kind: 'backup', v: 1, created: Date.now(), schools: [], photos: [], template: S.template };
    let done = 0, total = 0;
    const lists = [];
    for (const id of schoolIds) {
      const s = await U.DB.school(id);
      if (!s) continue;
      const ph = await U.DB.photosOf(id);
      lists.push([s, ph]);
      total += ph.length;
    }
    for (const [s, ph] of lists) {
      out.schools.push(s);
      for (const p of ph) {
        const meta = Object.assign({}, p);
        delete meta.blob;
        out.photos.push(meta);
        if (p.blob) await z.add(`photos/${p.id}.jpg`, p.blob, false);
        const t = await U.DB.thumb(p.id);
        if (t && t.blob) await z.add(`thumbs/${p.id}.jpg`, t.blob, false);
        done++;
        if (progress) progress(`Packing photos ${done} / ${total}`, done / (total || 1));
      }
    }
    await z.add('data.json', JSON.stringify(out));
    return z.blob('application/octet-stream');
  };

  /* Returns {schools, photos} counts. ask(schoolName) -> 'replace' | 'copy' | 'skip' when the school already exists. */
  U.restoreBackup = async (file, ask, progress) => {
    const zip = await U.readZip(file);
    const dataEntry = zip.get('data.json');
    if (!dataEntry) throw new Error('This file is not a Infra Upgrades backup.');
    const data = JSON.parse(await dataEntry.text());
    if (data.app !== 'civilos-upgrades') throw new Error('This file is not a Infra Upgrades backup.');
    let nS = 0, nP = 0;
    const total = (data.photos || []).length || 1;
    for (const s of data.schools || []) {
      const origId = s.id;
      const existing = await U.DB.school(s.id);
      let mode = 'new';
      if (existing) mode = await ask(U.schoolName(s), existing, s);
      if (mode === 'skip') continue;
      let sid = s.id;
      const idMap = new Map();
      if (mode === 'copy') {
        sid = U.uid('s');
        s.id = sid;
        s.data.sd_name = (s.data.sd_name || 'School') + ' (copy)';
      } else if (mode === 'replace') {
        await U.DB.eraseSchool(sid);
        U.dropMirror(sid);
      }
      // spaces keep their ids (they are unique per school)
      s.updated = Date.now();
      await U.DB.putSchool(s);
      nS++;
      for (const meta of (data.photos || []).filter((p) => p.schoolId === origId)) {
        const pe = zip.get(`photos/${meta.id}.jpg`);
        if (!pe) continue;
        const blob = new Blob([await pe.blob()], { type: 'image/jpeg' });
        const te = zip.get(`thumbs/${meta.id}.jpg`);
        const thumb = te ? new Blob([await te.blob()], { type: 'image/jpeg' }) : null;
        const p = Object.assign({}, meta, { blob, schoolId: sid });
        if (mode === 'copy') { const nid = U.uid('p'); idMap.set(meta.id, nid); p.id = nid; }
        await U.DB.putPhoto(p, thumb);
        nP++;
        if (progress) progress(`Restoring photos ${nP} / ${total}`, nP / total);
      }
    }
    return { schools: nS, photos: nP, template: data.template || null };
  };

  /* Survey form (template) on its own, to give the same form to every phone. */
  U.templateFile = () => new Blob([JSON.stringify({ app: 'civilos-upgrades', kind: 'form', v: 1, created: Date.now(), template: S.template }, null, 1)], { type: 'application/json' });
  U.readTemplateFile = async (file) => {
    const d = JSON.parse(await file.text());
    const t = d && (d.template || d);
    if (!t || !Array.isArray(t.checklist) || !Array.isArray(t.school)) throw new Error('This file is not a Infra Upgrades survey form.');
    return t;
  };
})();
