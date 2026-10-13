/* CivilOS Upgrades — offline engine. After the first open, the app works with no internet. */
const VERSION = 'cu-1.3.0-202610130637';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/logo.svg', 'icons/sakshham-logo.png', 'icons/sakshham-logo.jpg',
  'js/sha256.js', 'js/codes.js', 'js/template.js', 'js/util.js', 'js/db.js', 'js/store.js', 'js/lock.js',
  'js/camera.js', 'js/zip.js', 'js/report.js', 'js/pdf.js', 'js/docx.js', 'js/xlsx.js', 'js/backup.js', 'js/export-rooms.js', 'js/preview.js',
  'js/ui-common.js', 'js/ui-school.js', 'js/ui-admin.js', 'js/app.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const idx = await c.match('index.html'); if (idx) return idx; }
    return fetch(req);
  }));
});
