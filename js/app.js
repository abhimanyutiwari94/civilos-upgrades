/* Infra Upgrades — start-up, screen switching (Android back button works), lock check. */
(function () {
  'use strict';
  const U = self.U, S = U.S, h = U.h;
  self.CU_VERSION = '1.4.3';
  let root = null;
  const scrolls = new Map();
  let curKey = '';

  U.go = (path, replace) => {
    const want = '#' + path;
    if (location.hash === want) { render(); return; }
    if (replace) location.replace(want); else location.hash = path;
  };
  U.rerender = () => render(true);

  async function render(keepScroll) {
    if (!root) return;
    while (U.closeTopModal()) { /* close dialogs left open */ }
    if (curKey) scrolls.set(curKey, window.scrollY);
    const old = root.querySelector('.top');
    if (old && old._cleanup) old._cleanup();
    const keyNow = location.hash || '#/';
    const y = keepScroll ? window.scrollY : (scrolls.get(keyNow) || 0);
    U.clear(root);
    if (U.Lock.isLocked()) { curKey = ''; await U.showLock(root); return; }
    const parts = keyNow.replace(/^#\/?/, '').split('/').filter(Boolean);
    curKey = keyNow;
    U.gpsWarm(parts[0] === 's'); // GPS locks on while a school is open, ready for photos
    try {
      if (!parts.length) await U.screens.home(root);
      else if (parts[0] === 's' && parts[2] === 'room') await U.screens.space(root, parts[1], parts[3]);
      else if (parts[0] === 's' && parts[2] === 'bin') await U.screens.bin(root, parts[1]);
      else if (parts[0] === 's') await U.screens.school(root, parts[1], parts[2]);
      else if (parts[0] === 'settings') await U.screens.settings(root);
      else if (parts[0] === 'form') await U.screens.form(root, parts[1]);
      else if (parts[0] === 'help') await U.screens.help(root);
      else await U.screens.home(root);
    } catch (e) {
      console.error(e);
      root.append(h('div.page', h('div.banner.bad', U.icon('info'), h('div', 'Something went wrong on this screen: ' + (e.message || e) + '. Your data is safe.')),
        h('button.btn.primary', { onclick: () => U.go('/') }, 'Go to schools')));
    }
    requestAnimationFrame(() => window.scrollTo(0, y));
  }

  U.start = () => render();

  /* After an update: say so once, with what changed. */
  const NEWS = {
    '1.1.0': ['Sharper photos: the camera waits until the phone is steady; tap the picture to focus.',
      'Room-wise export: photos with remarks and data of each room (Report tab, or Download photos).',
      'New school starts filled from the previous school (not name, GPS, staff, students, photos).'],
    '1.2.0': ['“+ Add” button in Work needed and every choice list — add your own items (e.g. ATT).',
      'Preview the report before saving it (Report tab › Preview).',
      '“Download all photos” on the Photos tab, and “Download photos” / “Room report” in every room.',
      'The app now tells you when a new version is ready.'],
    '1.3.0': ['Every report and export now carries the Sakshham Consultants logo, colours and page format (PDF, Word, Excel, room-wise).',
      'Project / Client / Document / Date strip at the top, orange section bars, coloured condition cells.',
      'Report title, project, client and report writer: Settings › Report details.'],
    '1.3.1': ['Remove a photo easily: red bin button at the top of every photo.',
      'In the camera: “Remove last photo” undoes a blurred or wrong shot.',
      '“Select to remove” under the photos: remove several photos at once.',
      'Removed photos stay in “Recently deleted” (school menu) until you delete them for ever.'],
    '1.4.0': ['New name: Infra Upgrades.',
      'Answers that fit the question: e.g. “Can material vehicles reach?” → Yes / Small vehicles only / No. Condition questions keep Good / Repair / Replace.',
      'Each kind of space asks its own boxes: toilets ask WC, urinals, basins (with a toilet checklist); open areas ask length × breadth; walls ask length × height.',
      '“✎ Edit list” next to “+ Add”: rename, remove or move choices (e.g. Work needed).',
      'Work quantities (Settings › Work quantities): plaster, painting, waterproofing, rebuild … per room with sizes; school totals; Excel with formulas; quantity sheet alone in PDF / Word / Excel.',
      'Share / Send: PDF shares directly; for Word / Excel the app shows how to send from WhatsApp or email.',
      'More accurate GPS: the app waits a moment for a good reading and shows its accuracy (±m).',
      'Slimmer top bar on phones; tabs scroll away to give more room.'],
    '1.4.1': ['Install help on the first screen: one-tap Install in Chrome, Open in Chrome from WhatsApp / Samsung Internet, iPhone steps.'],
    '1.4.2': ['Accurate geo-tags: GPS starts as soon as you open a school; photos wait up to 10 s for the accuracy you choose (Settings › Photos: ±5 / ±10 / ±20 m).',
      'If the phone gives only approximate location (±1–3 km), a red warning shows how to turn on “Use precise location”.',
      'Good readings are averaged for a steadier position; a photo that could not get the accuracy is marked “approx.” in reports.'],
    '1.4.3': ['Much faster and smoother on every phone: photos save in the background (camera never freezes), photo previews load as you scroll, long pages draw only what is on screen.',
      'Light mode for low-cost phones (automatic, or Settings › Speed): simpler drawing, lighter camera preview, photos kept at 2048 px.'],
  };
  function showWhatsNew() {
    let seen = '';
    try { seen = localStorage.getItem('cu.version') || ''; localStorage.setItem('cu.version', self.CU_VERSION); } catch (e) { return; }
    if (seen === self.CU_VERSION || U.Lock.isLocked() || !U.Lock.state().used) return;
    const items = Object.keys(NEWS).filter((v) => (!seen || v > seen) && v <= self.CU_VERSION).flatMap((v) => NEWS[v]);
    if (!items.length) return;
    setTimeout(() => U.modal({ title: `Updated to version ${self.CU_VERSION}`, body: [h('p.muted', 'What is new:'), h('ul', items.map((t) => h('li', { style: { marginBottom: '6px' } }, t)))],
      actions: [{ label: 'OK', kind: 'primary' }] }), 700);
  }

  async function boot() {
    root = document.getElementById('app');
    try {
      await U.DB.open();
      await U.loadAll();
      await U.Lock.load();
      document.body.classList.toggle('lite', U.lite());
      const n = await U.recoverMirrors();
      if (n) await U.refreshSchools();
    } catch (e) {
      U.clear(root);
      root.append(h('div.lock', h('img.big-logo', { src: U.LOGO, alt: '' }), h('h1', 'Infra Upgrades'),
        h('div.card', h('h2', 'Storage is not available'),
          h('p', 'This page cannot save data here. Please open the app link in Google Chrome (not inside WhatsApp or a file viewer), then install it with ⋮ › Install app.'),
          h('p.small.muted', String(e && e.message || e)))));
      return;
    }
    window.addEventListener('hashchange', () => render());
    render();
    setInterval(async () => {
      await U.Lock.save();
      if (U.Lock.isLocked() && !document.querySelector('.lock')) { await U.flushSave(); render(); }
    }, 60000);
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') { await U.Lock.save(); if (U.Lock.isLocked() && !document.querySelector('.lock')) render(); }
    });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').then((reg) => {
        /* look for a newer version whenever the app comes back to the screen (if there is internet) */
        const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
        setInterval(check, 30 * 60000);
      }).catch(() => { /* offline cache not available here */ });
      /* a new version took over: offer a one-tap refresh (all work is already saved) */
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || document.querySelector('.update-bar')) return;
        const bar = h('div.update-bar', U.icon('download'), h('div.grow', 'A new version of the app is ready. Your work is saved.'),
          h('button.btn.primary.small', { onclick: async () => { await U.flushSave(); location.reload(); } }, 'Update now'));
        document.body.appendChild(bar);
      });
    }
    showWhatsNew();
    if (U.Lock.state().used) U.askPersist();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
