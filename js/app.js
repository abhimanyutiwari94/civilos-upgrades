/* CivilOS Upgrades — start-up, screen switching (Android back button works), lock check. */
(function () {
  'use strict';
  const U = self.U, S = U.S, h = U.h;
  self.CU_VERSION = '1.0.0';
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

  async function boot() {
    root = document.getElementById('app');
    try {
      await U.DB.open();
      await U.loadAll();
      await U.Lock.load();
      const n = await U.recoverMirrors();
      if (n) await U.refreshSchools();
    } catch (e) {
      U.clear(root);
      root.append(h('div.lock', h('img.big-logo', { src: U.LOGO, alt: '' }), h('h1', 'CivilOS Upgrades'),
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
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache not available here */ });
    }
    if (U.Lock.state().used) U.askPersist();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
