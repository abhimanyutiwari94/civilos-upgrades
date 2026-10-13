/* Infra Upgrades — small helpers shared by every screen. */
(function () {
  'use strict';
  const U = (self.U = self.U || {});
  U.screens = U.screens || {};

  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* h('div.card', {onclick}, children...) — builds DOM safely (text is never parsed as HTML). */
  U.h = function h(tag, props, ...kids) {
    const m = String(tag).match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, n) => {
      if (t === '.') el.classList.add(n); else el.id = n;
    });
    if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
      kids.unshift(props);
      props = null;
    }
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') String(v).split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v; /* only ever used with our own constant markup */
        else if (k in el && typeof v !== 'string') el[k] = v;
        else if (k === 'value') el.value = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    U.append(el, kids);
    return el;
  };
  U.append = function append(el, kids) {
    for (const k of kids) {
      if (k == null || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  };
  U.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  U.uid = (p) => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.debounce = (fn, ms) => {
    let t = 0;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    return d;
  };
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  U.pad = (n, w) => String(n).padStart(w || 2, '0');

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  U.fmtDate = (v) => {
    if (!v) return '';
    const d = typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v);
    if (isNaN(d)) return String(v);
    return `${U.pad(d.getDate())}-${MON[d.getMonth()]}-${d.getFullYear()}`;
  };
  U.fmtDateTime = (v) => {
    const d = new Date(v);
    if (isNaN(d)) return '';
    return `${U.fmtDate(d)} ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`;
  };
  U.isoDate = (d) => {
    d = d ? new Date(d) : new Date();
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  };
  U.fmtBytes = (n) => {
    if (!(n > 0)) return '0 MB';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };
  U.num = (v) => {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  };
  U.round = (n, d) => { const p = Math.pow(10, d == null ? 2 : d); return Math.round(n * p) / p; };
  U.fmtNum = (n) => (n == null ? '' : String(U.round(n, 2)));
  U.fmtLatLng = (lat, lng) => {
    if (lat == null || lng == null) return '';
    return `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(6)}° ${lng >= 0 ? 'E' : 'W'}`;
  };
  U.safeFileName = (s) => String(s || 'report').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'report';

  /* ---------- icons (our own constant SVG) ---------- */
  const P = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
    gallery: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 012 2v10"/><path d="M17 17l-4-4-6 6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    more: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    school: '<path d="M3 10l9-6 9 6"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    room: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 12h7M14 4v9h6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    flash: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
    flip: '<path d="M4 12a8 8 0 0114-5l2 2M20 12a8 8 0 01-14 5l-2-2"/><path d="M20 4v5h-5M4 20v-5h5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    restore: '<path d="M4 12a8 8 0 108-8H8"/><path d="M8 1v6h6" transform="translate(-4 0)"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  };
  U.icon = (name, cls) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = P[name] || '';
    return s;
  };

  /* ---------- toast ---------- */
  let toastEl = null, toastT = 0;
  U.toast = (msg, ms) => {
    if (!toastEl) { toastEl = U.h('div.toast', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), ms || 2600);
  };

  /* ---------- modal dialogs ---------- */
  const stack = [];
  U.modal = function ({ title, body, actions, wide, onClose, sheet }) {
    const card = U.h('div.modal' + (wide ? '.wide' : '') + (sheet ? '.sheet' : ''), { role: 'dialog', 'aria-modal': 'true' });
    const back = U.h('div.backdrop', card);
    const close = (v) => {
      if (!back.isConnected) return;
      back.remove();
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (onClose) onClose(v);
    };
    const entry = { close };
    if (title) card.appendChild(U.h('div.modal-head', U.h('h2', title),
      U.h('button.icon-btn', { 'aria-label': 'Close', onclick: () => close(null) }, U.icon('x'))));
    const bodyWrap = U.h('div.modal-body');
    if (body) U.append(bodyWrap, [body]);
    card.appendChild(bodyWrap);
    if (actions && actions.length) {
      const bar = U.h('div.modal-actions');
      for (const a of actions) {
        bar.appendChild(U.h('button.btn' + (a.kind ? '.' + a.kind : ''), {
          onclick: async () => {
            const r = a.onClick ? await a.onClick() : a.value;
            if (r !== false) close(r === undefined ? a.value : r);
          },
        }, a.label));
      }
      card.appendChild(bar);
    }
    back.addEventListener('click', (e) => { if (e.target === back && !sheet) close(null); });
    document.body.appendChild(back);
    stack.push(entry);
    const first = card.querySelector('input,textarea,select');
    if (first && !sheet) setTimeout(() => first.focus(), 60);
    return { close, el: card, body: bodyWrap };
  };
  U.closeTopModal = () => { const e = stack[stack.length - 1]; if (e) { e.close(null); return true; } return false; };
  U.hasModal = () => stack.length > 0;

  U.confirm = (msg, opts) => new Promise((res) => {
    opts = opts || {};
    U.modal({
      title: opts.title || 'Please confirm',
      body: U.h('p.pre', msg),
      onClose: (v) => res(v === true),
      actions: [
        { label: opts.cancel || 'Cancel', kind: 'ghost', value: false },
        { label: opts.ok || 'OK', kind: opts.danger ? 'danger' : 'primary', value: true },
      ],
    });
  });
  U.alert = (msg, title) => new Promise((res) => {
    U.modal({ title: title || 'Note', body: U.h('p.pre', msg), onClose: () => res(), actions: [{ label: 'OK', kind: 'primary', value: true }] });
  });
  U.promptText = (title, value, opts) => new Promise((res) => {
    opts = opts || {};
    const inp = opts.multiline
      ? U.h('textarea.inp', { rows: 4, placeholder: opts.placeholder || '' })
      : U.h('input.inp', { type: opts.type || 'text', placeholder: opts.placeholder || '', inputmode: opts.inputmode || null });
    inp.value = value || '';
    const m = U.modal({
      title,
      body: [opts.help ? U.h('p.muted', opts.help) : null, inp],
      onClose: (v) => res(v),
      actions: [
        { label: 'Cancel', kind: 'ghost', value: null },
        { label: opts.ok || 'OK', kind: 'primary', onClick: () => inp.value },
      ],
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); m.close(inp.value); } });
  });
  /* Choose one from a list. items: [{label, value, sub}] */
  U.choose = (title, items) => new Promise((res) => {
    let m = null;
    const list = U.h('div.choose-list', items.map((i) => U.h('button.choose-item', { onclick: () => m.close(i.value) },
      U.h('span', i.label), i.sub ? U.h('small.muted', i.sub) : null)));
    m = U.modal({ title, body: list, onClose: (v) => res(v) });
  });

  /* Busy overlay for long jobs (reports, backups). */
  U.busy = (msg) => {
    const txt = U.h('div.busy-text', msg || 'Working…');
    const bar = U.h('div.busy-bar', U.h('i'));
    const el = U.h('div.busy', U.h('div.busy-card', U.h('div.spinner'), txt, bar));
    document.body.appendChild(el);
    return {
      set: (m, frac) => { if (m) txt.textContent = m; if (frac != null) bar.firstChild.style.width = Math.round(Math.min(1, frac) * 100) + '%'; },
      done: () => el.remove(),
    };
  };

  /* Blob helpers */
  U.blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  U.dataURLToBlob = (d) => {
    const [h, b] = String(d).split(',');
    const mime = (h.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: mime });
  };
  U.loadImage = (src) => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Image could not be read'));
    i.src = src;
  });
  /* Decode a blob into something drawable, honouring the photo's EXIF rotation. */
  U.decodeImage = async (blob) => {
    if (self.createImageBitmap) {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { /* fall back */ }
    }
    const url = URL.createObjectURL(blob);
    try { return await U.loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  };
  U.canvasToBlob = (c, type, q) => new Promise((res, rej) => {
    if (c.convertToBlob) { c.convertToBlob({ type, quality: q }).then(res, rej); return; }
    c.toBlob((b) => (b ? res(b) : rej(new Error('Could not make image'))), type, q);
  });
  /* Scale an image blob so its long side is at most `max`, return {blob,w,h}. */
  U.resizeBlob = async (blob, max, q, type) => {
    const img = await U.decodeImage(blob);
    const w0 = img.width, h0 = img.height;
    const s = Math.min(1, max / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if ((type || 'image/jpeg') === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    if (img.close) img.close();
    const out = await U.canvasToBlob(c, type || 'image/jpeg', q || 0.85);
    c.width = c.height = 0;
    return { blob: out, w, h };
  };
})();
