/* CivilOS Upgrades — camera, GPS and the photo stamp.
   Stamp = very small text, bottom-left: location name + GPS coordinates (as chosen in Settings). */
(function () {
  'use strict';
  const U = self.U;
  const h = U.h;

  /* ---------------- GPS ---------------- */
  const Geo = (U.Geo = {
    fix: null, // {lat,lng,acc,ts}
    err: null,
    watchId: null,
    users: 0,
    subs: new Set(),
    start() {
      Geo.users++;
      if (Geo.watchId != null || !navigator.geolocation) return;
      try {
        Geo.watchId = navigator.geolocation.watchPosition((p) => {
          Geo.fix = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: Date.now() };
          Geo.err = null;
          Geo.subs.forEach((f) => f());
        }, (e) => {
          Geo.err = e && e.code === 1 ? 'Location permission is off' : 'Waiting for GPS…';
          Geo.subs.forEach((f) => f());
        }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
      } catch (e) { Geo.err = 'Location not available'; }
    },
    stop() {
      Geo.users = Math.max(0, Geo.users - 1);
      if (Geo.users === 0 && Geo.watchId != null) { navigator.geolocation.clearWatch(Geo.watchId); Geo.watchId = null; }
    },
    fresh() { return Geo.fix && Date.now() - Geo.fix.ts < 3 * 60000 ? Geo.fix : null; },
    once(timeoutMs) {
      return new Promise((res) => {
        if (!navigator.geolocation) { res(null); return; }
        navigator.geolocation.getCurrentPosition(
          (p) => { Geo.fix = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: Date.now() }; res(Geo.fix); },
          () => res(Geo.fresh()),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: timeoutMs || 20000 });
      });
    },
  });

  /* ---------------- stamp + save ---------------- */
  function fitText(g, text, maxW) {
    if (g.measureText(text).width <= maxW) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (g.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1;
    }
    return text.slice(0, lo) + '…';
  }

  /* blob -> stamped JPEG. lines: array of short strings (bottom-left). */
  U.stampPhoto = async (blob, lines, opt) => {
    opt = opt || {};
    const img = await U.decodeImage(blob);
    const w0 = img.width, h0 = img.height;
    const max = opt.maxSide || 4000;
    const s = Math.min(1, max / Math.max(w0, h0));
    const w = Math.round(w0 * s), hh = Math.round(h0 * s);
    const c = document.createElement('canvas');
    c.width = w; c.height = hh;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, hh);
    if (img.close) img.close();

    lines = (lines || []).filter(Boolean);
    if (lines.length) {
      const short = Math.min(w, hh);
      const fs = Math.max(11, Math.round(short * (opt.size === 'medium' ? 0.026 : 0.0175)));
      const lh = Math.round(fs * 1.3);
      const pad = Math.round(fs * 0.5);
      const margin = Math.round(fs * 0.7);
      g.font = `600 ${fs}px "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", Arial, sans-serif`;
      g.textBaseline = 'alphabetic';
      const maxW = Math.round(w * 0.9) - pad * 2;
      const shown = lines.map((t) => fitText(g, t, maxW));
      const tw = Math.max(...shown.map((t) => g.measureText(t).width));
      const bw = Math.round(tw + pad * 2);
      const bh = Math.round(lines.length * lh + pad * 1.2);
      const x = margin, y = hh - margin - bh;
      g.fillStyle = 'rgba(0,0,0,0.48)';
      const r = Math.round(fs * 0.35);
      g.beginPath();
      g.moveTo(x + r, y); g.lineTo(x + bw - r, y); g.quadraticCurveTo(x + bw, y, x + bw, y + r);
      g.lineTo(x + bw, y + bh - r); g.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh);
      g.lineTo(x + r, y + bh); g.quadraticCurveTo(x, y + bh, x, y + bh - r);
      g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
      g.fill();
      g.fillStyle = '#fff';
      shown.forEach((t, i) => g.fillText(t, x + pad, y + pad * 0.6 + lh * (i + 1) - Math.round(lh * 0.25)));
    }
    const out = await U.canvasToBlob(c, 'image/jpeg', opt.quality || 0.9);
    // small preview for lists
    const ts = Math.min(1, 360 / Math.max(w, hh));
    const tc = document.createElement('canvas');
    tc.width = Math.round(w * ts); tc.height = Math.round(hh * ts);
    const tg = tc.getContext('2d');
    tg.imageSmoothingQuality = 'high';
    tg.drawImage(c, 0, 0, tc.width, tc.height);
    const thumb = await U.canvasToBlob(tc, 'image/jpeg', 0.72);
    c.width = c.height = 0; tc.width = tc.height = 0;
    return { blob: out, w, h: hh, thumb };
  };

  /* Text lines for the stamp, from the settings. */
  U.stampLines = (place, fix, when) => {
    const p = U.S.settings.photo;
    const out = [];
    if (p.stampPlace && place) out.push(place);
    if (p.stampCoords) out.push(fix ? U.fmtLatLng(fix.lat, fix.lng) : 'GPS: not available');
    if (p.stampTime) out.push(U.fmtDateTime(when || Date.now()));
    return out;
  };

  /* ---------------- file pickers (phone camera / gallery) ---------------- */
  U.pickImages = ({ capture, multiple }) => new Promise((res) => {
    const inp = h('input', { type: 'file', accept: 'image/*', style: { position: 'fixed', left: '-9999px' } });
    if (capture) inp.setAttribute('capture', 'environment');
    if (multiple) inp.multiple = true;
    let done = false;
    inp.addEventListener('change', () => { done = true; res(Array.from(inp.files || [])); inp.remove(); });
    // if the picker is dismissed, focus returns without a change event
    self.addEventListener('focus', function onF() {
      self.removeEventListener('focus', onF);
      setTimeout(() => { if (!done) { res([]); inp.remove(); } }, 1200);
    });
    document.body.appendChild(inp);
    inp.click();
  });

  /* ---------------- in-app camera ---------------- */
  /* opts: { place: () => string, title, tags: [], onSave: async ({blob,w,h,thumb,fix,ts,tag,source}) => void } */
  U.openCamera = async function (opts) {
    const st = U.S.settings.photo;
    let stream = null, track = null, ic = null, facing = 'environment', torch = false;
    let count = 0, queue = Promise.resolve(), busy = 0, tag = '';
    Geo.start();

    const video = h('video', { autoplay: true, playsinline: true, muted: true });
    video.setAttribute('playsinline', '');
    const placeBtn = h('button.cam-place', { title: 'Change the name stamped on photos' });
    const gpsPill = h('span.cam-gps');
    const countEl = h('span.cam-count', '0');
    const lastImg = h('img.cam-last', { alt: '' });
    const savingEl = h('span.cam-saving');
    const msg = h('div.cam-msg');
    const zoom = h('input.cam-zoom', { type: 'range', min: 1, max: 1, step: 0.1, value: 1, 'aria-label': 'Zoom' });
    const torchBtn = h('button.cam-round', { 'aria-label': 'Torch', onclick: toggleTorch, hidden: true }, U.icon('flash'));
    const flashEl = h('div.cam-flash');
    const tagsRow = h('div.cam-tags', (opts.tags || []).map((t) => h('button.chip', {
      onclick: (e) => {
        tag = tag === t ? '' : t;
        U.$$('.chip', tagsRow).forEach((b) => b.classList.toggle('on', b.textContent === tag));
        e.currentTarget.blur();
        refreshPlace();
      },
    }, t)));

    const root = h('div.camera',
      video, flashEl,
      h('div.cam-top',
        h('button.cam-round', { 'aria-label': 'Close camera', onclick: () => close() }, U.icon('x')),
        h('div.cam-top-mid', h('div.cam-title', opts.title || 'Camera'), placeBtn),
        gpsPill),
      msg,
      h('div.cam-bottom',
        tagsRow,
        h('div.cam-zoomrow', zoom),
        h('div.cam-controls',
          h('div.cam-side',
            h('button.cam-round', { 'aria-label': 'Use phone camera', title: 'Phone camera', onclick: usePhoneCamera }, U.icon('camera')),
            h('button.cam-round', { 'aria-label': 'Add from gallery', title: 'From gallery', onclick: useGallery }, U.icon('gallery'))),
          h('button.shutter', { 'aria-label': 'Take photo', onclick: shoot }, h('i')),
          h('div.cam-side',
            torchBtn,
            h('button.cam-round', { 'aria-label': 'Switch camera', onclick: flip }, U.icon('flip')),
            h('button.cam-done', { onclick: () => close() }, lastImg, countEl, savingEl)))));
    document.body.appendChild(root);
    document.body.classList.add('cam-open');
    history.pushState({ cam: 1 }, '');
    const onPop = () => close(true);
    self.addEventListener('popstate', onPop);

    placeBtn.addEventListener('click', async () => {
      const v = await U.promptText('Name stamped on photos', opts.placeOverride || opts.place(), { help: 'This short name is printed bottom-left on each photo with the GPS coordinates.' });
      if (v != null) { opts.placeOverride = v.trim(); refreshPlace(); }
    });
    function placeText() {
      const base = opts.placeOverride || opts.place();
      return tag ? `${base} · ${tag}` : base;
    }
    function refreshPlace() { placeBtn.textContent = placeText() || 'Tap to name this place'; }
    function refreshGps() {
      const f = Geo.fresh();
      gpsPill.textContent = f ? `GPS ±${Math.round(f.acc)} m` : (Geo.err || 'Finding GPS…');
      gpsPill.classList.toggle('ok', !!f && f.acc <= 30);
      gpsPill.classList.toggle('weak', !!f && f.acc > 30);
    }
    Geo.subs.add(refreshGps);
    const gpsTimer = setInterval(refreshGps, 3000);
    refreshPlace(); refreshGps();

    async function startStream() {
      stopStream();
      msg.textContent = '';
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        msg.textContent = 'This browser cannot open the camera here. Use the phone camera button (left).';
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 4096 }, height: { ideal: 3072 } },
        });
      } catch (e) {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing } }); } catch (e2) {
          msg.textContent = e2 && e2.name === 'NotAllowedError'
            ? 'Camera permission is off. Allow camera for this app in phone settings, or use the phone camera button (left).'
            : 'Camera could not start. Use the phone camera button (left).';
          return;
        }
      }
      video.srcObject = stream;
      track = stream.getVideoTracks()[0];
      ic = null;
      try { if (self.ImageCapture) ic = new ImageCapture(track); } catch (e) { ic = null; }
      try { await video.play(); } catch (e) { /* autoplay */ }
      let caps = {};
      try { caps = track.getCapabilities ? track.getCapabilities() : {}; } catch (e) { /* */ }
      torchBtn.hidden = !caps.torch;
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        zoom.min = caps.zoom.min; zoom.max = Math.min(caps.zoom.max, 10); zoom.step = caps.zoom.step || 0.1;
        zoom.value = (track.getSettings && track.getSettings().zoom) || caps.zoom.min;
        zoom.parentNode.hidden = false;
      } else zoom.parentNode.hidden = true;
    }
    function stopStream() {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null; track = null; ic = null;
    }
    zoom.addEventListener('input', () => { if (track) track.applyConstraints({ advanced: [{ zoom: Number(zoom.value) }] }).catch(() => {}); });
    async function toggleTorch() {
      if (!track) return;
      torch = !torch;
      try { await track.applyConstraints({ advanced: [{ torch }] }); torchBtn.classList.toggle('on', torch); } catch (e) { torch = false; }
    }
    async function flip() { facing = facing === 'environment' ? 'user' : 'environment'; await startStream(); }

    async function grabFrame() {
      if (ic && ic.takePhoto) {
        try {
          let o = {};
          try {
            const pc = await ic.getPhotoCapabilities();
            if (pc && pc.imageWidth && pc.imageWidth.max) o.imageWidth = pc.imageWidth.max;
            if (pc && pc.imageHeight && pc.imageHeight.max) o.imageHeight = pc.imageHeight.max;
            if (torch && pc && (pc.fillLightMode || []).includes('flash')) o.fillLightMode = 'flash';
          } catch (e) { o = {}; }
          return await ic.takePhoto(o);
        } catch (e) { /* fall back to the video frame */ }
      }
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) throw new Error('Camera is not ready yet');
      const c = document.createElement('canvas');
      c.width = vw; c.height = vh;
      c.getContext('2d').drawImage(video, 0, 0, vw, vh);
      const b = await U.canvasToBlob(c, 'image/jpeg', 0.95);
      c.width = c.height = 0;
      return b;
    }

    function process(blob, source, fixOverride, tsOverride) {
      const fix = fixOverride || Geo.fresh();
      const ts = tsOverride || Date.now();
      const place = placeText();
      const thisTag = tag;
      busy++; showBusy();
      queue = queue.then(async () => {
        try {
          const r = await U.stampPhoto(blob, U.stampLines(place, fix, ts), { maxSide: st.maxSide, quality: st.quality, size: st.stampSize });
          await opts.onSave(Object.assign(r, { fix, ts, tag: thisTag, place, source }));
          count++;
          countEl.textContent = String(count);
          const u = URL.createObjectURL(r.thumb);
          if (lastImg.dataset.u) URL.revokeObjectURL(lastImg.dataset.u);
          lastImg.dataset.u = u; lastImg.src = u;
        } catch (e) {
          U.toast('Photo not saved: ' + (e.message || e));
        } finally { busy--; showBusy(); }
      });
      return queue;
    }
    function showBusy() { savingEl.textContent = busy > 0 ? 'saving ' + busy : ''; }

    async function shoot() {
      if (!stream) { usePhoneCamera(); return; }
      flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
      try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* */ }
      try { const b = await grabFrame(); process(b, 'app'); } catch (e) { U.toast(e.message || 'Could not take photo'); }
    }
    async function usePhoneCamera() {
      stopStream();
      const files = await U.pickImages({ capture: true });
      for (const f of files) process(f, 'phone');
      if (root.isConnected) startStream();
    }
    async function useGallery() {
      const files = await U.pickImages({ multiple: true });
      for (const f of files) {
        let fix = null, ts = null;
        try { const ex = await U.readExif(f); if (ex.lat != null) fix = { lat: ex.lat, lng: ex.lng, acc: null, ts: Date.now() }; ts = ex.time || null; } catch (e) { /* */ }
        process(f, 'gallery', fix || Geo.fresh(), ts || f.lastModified);
      }
    }

    let closed = false;
    async function close(fromPop) {
      if (closed) return;
      closed = true;
      self.removeEventListener('popstate', onPop);
      if (!fromPop) history.back();
      stopStream();
      clearInterval(gpsTimer);
      Geo.subs.delete(refreshGps);
      Geo.stop();
      if (busy > 0) { const b = U.busy('Saving photos…'); await queue; b.done(); }
      root.remove();
      document.body.classList.remove('cam-open');
      if (lastImg.dataset.u) URL.revokeObjectURL(lastImg.dataset.u);
      if (opts.onClose) opts.onClose(count);
    }

    if (opts.mode === 'phone') { await startStream(); usePhoneCamera(); }
    else await startStream();
  };

  /* Quick path without the in-app camera: phone camera -> stamp -> save. */
  U.quickPhoneShot = async (opts) => {
    Geo.start();
    const files = await U.pickImages({ capture: true });
    let n = 0;
    for (const f of files) {
      const fix = Geo.fresh() || (await Geo.once(8000));
      const r = await U.stampPhoto(f, U.stampLines(opts.place(), fix, Date.now()),
        { maxSide: U.S.settings.photo.maxSide, quality: U.S.settings.photo.quality, size: U.S.settings.photo.stampSize });
      await opts.onSave(Object.assign(r, { fix, ts: Date.now(), tag: '', place: opts.place(), source: 'phone' }));
      n++;
    }
    Geo.stop();
    return n;
  };

  /* ---------------- EXIF (GPS + date) from gallery JPEGs ---------------- */
  U.readExif = async (file) => {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const dv = new DataView(buf);
    const out = {};
    if (dv.byteLength < 4 || dv.getUint16(0) !== 0xffd8) return out;
    let off = 2;
    while (off + 4 < dv.byteLength) {
      const marker = dv.getUint16(off);
      const len = dv.getUint16(off + 2);
      if (marker === 0xffe1 && dv.getUint32(off + 4) === 0x45786966) { parseTiff(dv, off + 10, out); break; }
      if ((marker & 0xff00) !== 0xff00) break;
      off += 2 + len;
    }
    return out;
  };
  function parseTiff(dv, t, out) {
    const le = dv.getUint16(t) === 0x4949;
    const u16 = (o) => dv.getUint16(o, le), u32 = (o) => dv.getUint32(o, le);
    const ifd = (o) => {
      const n = u16(o), tags = {};
      for (let i = 0; i < n; i++) {
        const e = o + 2 + i * 12;
        if (e + 12 > dv.byteLength) break;
        tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), voff: e + 8 };
      }
      return tags;
    };
    const rat = (o) => u32(o) / (u32(o + 4) || 1);
    const ascii = (tg) => {
      const o = tg.count > 4 ? t + u32(tg.voff) : tg.voff;
      let s = '';
      for (let i = 0; i < tg.count - 1 && o + i < dv.byteLength; i++) s += String.fromCharCode(dv.getUint8(o + i));
      return s;
    };
    try {
      const ifd0 = ifd(t + u32(t + 4));
      if (ifd0[0x8769]) {
        const ex = ifd(t + u32(ifd0[0x8769].voff));
        const d = ex[0x9003] || ifd0[0x0132];
        if (d) {
          const m = ascii(d).match(/(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
          if (m) out.time = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
        }
      }
      if (ifd0[0x8825]) {
        const g = ifd(t + u32(ifd0[0x8825].voff));
        const dms = (tg) => { const o = t + u32(tg.voff); return rat(o) + rat(o + 8) / 60 + rat(o + 16) / 3600; };
        if (g[2] && g[4]) {
          let lat = dms(g[2]), lng = dms(g[4]);
          if (g[1] && String.fromCharCode(dv.getUint8(g[1].voff)) === 'S') lat = -lat;
          if (g[3] && String.fromCharCode(dv.getUint8(g[3].voff)) === 'W') lng = -lng;
          if (isFinite(lat) && isFinite(lng) && (lat || lng)) { out.lat = lat; out.lng = lng; }
        }
      }
    } catch (e) { /* unreadable EXIF — ignore */ }
  }
})();
