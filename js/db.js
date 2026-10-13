/* Infra Upgrades — storage on the phone (IndexedDB).
   Every write waits until the phone has really saved it ("strict" durability),
   so closing the app or a dead battery cannot lose what was already shown as saved. */
(function () {
  'use strict';
  const U = self.U;
  const NAME = 'civilos-upgrades';
  const VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!self.indexedDB) { rej(new Error('This browser cannot store data. Please open the installed app in Chrome.')); return; }
      const rq = indexedDB.open(NAME, VERSION);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('schools')) db.createObjectStore('schools', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('photos')) {
          const s = db.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('school', 'schoolId');
        }
        if (!db.objectStoreNames.contains('thumbs')) db.createObjectStore('thumbs', { keyPath: 'id' });
      };
      rq.onsuccess = () => {
        const db = rq.result;
        db.onversionchange = () => { db.close(); dbp = null; };
        res(db);
      };
      rq.onerror = () => rej(rq.error || new Error('Storage could not open'));
      rq.onblocked = () => rej(new Error('Storage is busy — close other copies of the app and try again.'));
    });
    return dbp;
  }

  async function tx(stores, mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      let t;
      try { t = db.transaction(stores, mode, { durability: 'strict' }); } catch (e) { t = db.transaction(stores, mode); }
      let out;
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error || new Error('Save failed'));
      t.onabort = () => rej(t.error || new Error('Save stopped — phone storage may be full'));
      const r = fn(t);
      if (r && typeof r.then === 'function') r.then((v) => { out = v; }, (e) => { try { t.abort(); } catch (x) { /* */ } rej(e); });
      else out = r;
    });
  }
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  const DB = (U.DB = {
    open,
    kvGet: (k) => tx(['kv'], 'readonly', (t) => req(t.objectStore('kv').get(k))),
    kvSet: (k, v) => tx(['kv'], 'readwrite', (t) => { t.objectStore('kv').put(v, k); }),
    kvDel: (k) => tx(['kv'], 'readwrite', (t) => { t.objectStore('kv').delete(k); }),

    schools: () => tx(['schools'], 'readonly', (t) => req(t.objectStore('schools').getAll())),
    school: (id) => tx(['schools'], 'readonly', (t) => req(t.objectStore('schools').get(id))),
    putSchool: (s) => tx(['schools'], 'readwrite', (t) => { t.objectStore('schools').put(s); }),

    photosOf: (schoolId) => tx(['photos'], 'readonly', (t) => req(t.objectStore('photos').index('school').getAll(schoolId))),
    /* Photo meta without loading every full image into memory at once is not possible
       with getAll, so list screens use thumbs; full images are read one by one. */
    photo: (id) => tx(['photos'], 'readonly', (t) => req(t.objectStore('photos').get(id))),
    thumb: (id) => tx(['thumbs'], 'readonly', (t) => req(t.objectStore('thumbs').get(id))),
    putPhoto: (p, thumb) => tx(['photos', 'thumbs'], 'readwrite', (t) => {
      t.objectStore('photos').put(p);
      if (thumb) t.objectStore('thumbs').put({ id: p.id, blob: thumb });
    }),
    updatePhotoMeta: async (id, patch) => {
      return tx(['photos'], 'readwrite', async (t) => {
        const s = t.objectStore('photos');
        const p = await req(s.get(id));
        if (!p) return null;
        Object.assign(p, patch);
        s.put(p);
        return p;
      });
    },
    /* Removes the school and all its photos for ever. Only called from "Erase". */
    eraseSchool: async (id) => {
      const photos = await DB.photosOf(id);
      return tx(['schools', 'photos', 'thumbs'], 'readwrite', (t) => {
        t.objectStore('schools').delete(id);
        for (const p of photos) { t.objectStore('photos').delete(p.id); t.objectStore('thumbs').delete(p.id); }
      });
    },
    erasePhotos: (ids) => tx(['photos', 'thumbs'], 'readwrite', (t) => {
      for (const id of ids) { t.objectStore('photos').delete(id); t.objectStore('thumbs').delete(id); }
    }),
    eraseAll: () => tx(['schools', 'photos', 'thumbs'], 'readwrite', (t) => {
      t.objectStore('schools').clear(); t.objectStore('photos').clear(); t.objectStore('thumbs').clear();
    }),
  });

  /* Ask the phone to keep our data even when storage runs low. */
  U.askPersist = async () => {
    try {
      if (navigator.storage && navigator.storage.persist) {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }
    } catch (e) { /* not supported */ }
    return false;
  };
  U.storageInfo = async () => {
    const out = { usage: 0, quota: 0, persisted: false };
    try {
      if (navigator.storage && navigator.storage.estimate) Object.assign(out, await navigator.storage.estimate());
      if (navigator.storage && navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
    } catch (e) { /* */ }
    return out;
  };
})();
