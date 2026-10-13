/* Infra Upgrades — 30-day activation.
   Code 1 opens the app for 30 days from the day it is typed. After that the app locks
   (data stays safe) until the next code is typed. Codes work only in order.
   Setting the phone's date back does not help: the app remembers the latest date it saw. */
(function () {
  'use strict';
  const U = self.U;
  const DAY = 86400000;
  const PERIOD = 30 * DAY;
  const LS = 'cu.lock';

  const blank = () => ({ used: 0, until: 0, lastSeen: 0, history: [] });
  let st = blank();

  function better(a, b) {
    if (!a) return b; if (!b) return a;
    if ((b.used || 0) !== (a.used || 0)) return (b.used || 0) > (a.used || 0) ? b : a;
    return (b.lastSeen || 0) > (a.lastSeen || 0) ? b : a;
  }
  async function persist() {
    try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* */ }
    try { await U.DB.kvSet('lock', st); } catch (e) { /* */ }
  }

  const L = (U.Lock = {
    async load() {
      let ls = null;
      try { ls = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { /* */ }
      let db = null;
      try { db = await U.DB.kvGet('lock'); } catch (e) { /* */ }
      const m = better(ls, db);
      st = Object.assign(blank(), m || {});
      // keep the larger "last seen" of both copies
      st.lastSeen = Math.max((ls && ls.lastSeen) || 0, (db && db.lastSeen) || 0, st.lastSeen || 0);
      L.tick();
      await persist();
    },
    now() { return Math.max(Date.now(), st.lastSeen || 0); },
    tick() {
      const n = Date.now();
      if (n > (st.lastSeen || 0)) st.lastSeen = n;
    },
    async save() { L.tick(); await persist(); },
    state() { return Object.assign({}, st); },
    total() { return (self.CU_CODE_FPS || []).length; },
    isLocked() { return !(st.used > 0 && L.now() < st.until); },
    daysLeft() { return Math.max(0, Math.ceil((st.until - L.now()) / DAY)); },
    clockWentBack() { return Date.now() + 5 * 60000 < (st.lastSeen || 0); },
    /* Returns { ok, msg } */
    async enter(code) {
      const clean = CUHash.normalizeCode(code);
      if (clean.length < 8) return { ok: false, msg: 'Please type the full code.' };
      const fp = CUHash.codeFingerprint(clean);
      const idx = (self.CU_CODE_FPS || []).indexOf(fp);
      if (idx < 0) return { ok: false, msg: 'This code is not correct. Check the letters and try again.' };
      if (idx < st.used) return { ok: false, msg: `Code ${idx + 1} is already used. Please type Code ${st.used + 1}.` };
      if (idx > st.used) return { ok: false, msg: `This is Code ${idx + 1}. Codes work in order — please type Code ${st.used + 1} first.` };
      const now = L.now();
      const from = Math.max(now, st.until || 0);
      st.used = idx + 1;
      st.until = from + PERIOD;
      st.history.push({ code: idx + 1, at: now, until: st.until });
      await L.save();
      return { ok: true, msg: `Code ${idx + 1} accepted. The app is open until ${U.fmtDate(st.until)}.` };
    },
  });
})();
