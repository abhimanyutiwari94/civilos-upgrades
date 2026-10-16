/* Infra Upgrades — camera, GPS and the photo stamp.
   Stamp = very small text, bottom-left: location name + GPS coordinates (as chosen in Settings). */
(function () {
  'use strict';
  const U = self.U;
  const h = U.h;

  /* ---------------- GPS ----------------
     Accurate location, step by step:
     • GPS starts as soon as a school is opened (warm-up), so it has locked on before photos are taken.
     • Only real readings are used (maximumAge 0), the best of the last 30 s.
     • Readings close to the best one are averaged (weighted by accuracy) for a steadier position.
     • Before stamping a photo the camera waits up to 10 s for the accuracy chosen in Settings (5 / 10 / 20 m).
     • A phone that only gives ±1000 m or worse has "Approximate location" on — the app says how to fix it. */
  const target = () => Number((U.S.settings && U.S.settings.photo && U.S.settings.photo.gpsTarget) || 20);
  const Geo = (U.Geo = {
    fix: null, // most recent {lat,lng,acc,ts}
    recent: [], // readings of the last 30 s
    err: null,
    watchId: null,
    users: 0,
    startedAt: 0,
    subs: new Set(),
    add(p) {
      const f = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: Date.now() };
      if (!isFinite(f.lat) || !isFinite(f.lng) || !isFinite(f.acc)) return;
      Geo.fix = f;
      Geo.recent = Geo.recent.filter((x) => f.ts - x.ts < 30000).concat(f);
      Geo.err = null;
      Geo.subs.forEach((fn) => fn());
    },
    start() {
      Geo.users++;
      if (Geo.watchId != null || !navigator.geolocation) return;
      Geo.startedAt = Date.now();
      try {
        Geo.watchId = navigator.geolocation.watchPosition((p) => Geo.add(p), (e) => {
          Geo.err = e && e.code === 1 ? 'Location permission is off' : 'Waiting for GPS…';
          Geo.subs.forEach((f) => f());
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
      } catch (e) { Geo.err = 'Location not available'; }
    },
    stop() {
      Geo.users = Math.max(0, Geo.users - 1);
      if (Geo.users === 0 && Geo.watchId != null) { navigator.geolocation.clearWatch(Geo.watchId); Geo.watchId = null; }
    },
    /* the position to use: best reading of the last 30 s, averaged with readings almost as good */
    fresh() {
      const now = Date.now();
      const r = Geo.recent.filter((x) => now - x.ts < 30000);
      if (!r.length) return Geo.fix && now - Geo.fix.ts < 3 * 60000 ? Geo.fix : null;
      const best = r.reduce((x, y) => (y.acc < x.acc || (y.acc === x.acc && y.ts > x.ts) ? y : x));
      const near = r.filter((x) => x.acc <= Math.max(best.acc * 1.5, best.acc + 3));
      if (near.length < 2) return best;
      let w = 0, lat = 0, lng = 0;
      for (const x of near) { const k = 1 / (x.acc * x.acc); w += k; lat += x.lat * k; lng += x.lng * k; }
      return { lat: lat / w, lng: lng / w, acc: best.acc, ts: best.ts, n: near.length };
    },
    /* the phone only gives a rough network position ("Approximate location" is on, or GPS is off) */
    approximate() {
      const best = Geo.fresh();
      return !!best && Date.now() - Geo.startedAt > 8000 && best.acc >= 1000;
    },
    /* wait up to ms for a reading within the target; returns the best position seen */
    good(ms, want) {
      want = want || target();
      const f = Geo.fresh();
      if (f && f.acc <= want && Date.now() - f.ts < 15000) return Promise.resolve(f);
      return new Promise((res) => {
        const done = () => { Geo.subs.delete(chk); clearTimeout(t); res(Geo.fresh()); };
        const chk = () => { const x = Geo.fresh(); if (x && x.acc <= want) done(); };
        Geo.subs.add(chk);
        const t = setTimeout(done, ms || 10000);
      });
    },
    /* a careful single location (school GPS): listen up to timeoutMs, stop early at ±5 m, keep the best */
    once(timeoutMs, onProgress) {
      Geo.start();
      return new Promise((res) => {
        const finish = () => { Geo.subs.delete(chk); clearTimeout(t); Geo.stop(); res(Geo.fresh()); };
        const chk = () => { const b = Geo.fresh(); if (b && onProgress) onProgress(b); if (b && b.acc <= 5) finish(); };
        Geo.subs.add(chk);
        const t = setTimeout(finish, timeoutMs || 30000);
        chk();
      });
    },
  });
  U.gpsQuality = (f) => (!f ? 'none' : f.acc <= target() ? 'good' : f.acc <= 50 ? 'fair' : 'poor');
  U.gpsTarget = target;
  U.preciseHelp = () => 'The phone is giving only an approximate location (±1–3 km).\n\nTo get ±5–20 m:\n1. Swipe down › turn on Location.\n2. Phone Settings › Apps › Chrome (and Infra Upgrades, if listed) › Permissions › Location › “Allow only while using” and turn ON “Use precise location”.\n3. Settings › Location › Location services › Google Location Accuracy › ON.\n4. Stand in the open (near a door or window) for 20–30 seconds the first time.';
  /* GPS warm-up while a school is open */
  let warm = false;
  U.gpsWarm = (on) => {
    if (on && !warm) { warm = true; Geo.start(); }
    else if (!on && warm) { warm = false; Geo.stop(); }
  };

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
    let count = 0, queue = Promise.resolve(), busy = 0, tag = '', photoCaps = null, shooting = false;
    Geo.start();

    const video = h('video', { autoplay: true, playsinline: true, muted: true });
    video.setAttribute('playsinline', '');
    const placeBtn = h('button.cam-place', { title: 'Change the name stamped on photos' });
    const gpsPill = h('span.cam-gps');
    const countEl = h('span.cam-count', '0');
    const lastImg = h('img.cam-last', { alt: '' });
    const savingEl = h('span.cam-saving');
    const msg = h('div.cam-msg');
    const gpsWarnEl = h('button.cam-gpswarn', { type: 'button', onclick: () => U.alert(U.preciseHelp(), 'Turn on precise location') }, '⚠ Location is approximate (±1–3 km). Tap to fix');
    gpsWarnEl.hidden = true;
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

    const ring = h('div.cam-focus');
    /* "Remove last photo": undo a blurred or wrong shot without leaving the camera */
    const taken = []; // [{ id, url }] photos saved in this camera session, newest last
    const undoBtn = h('button.cam-undo', { type: 'button', onclick: () => undoLast() }, U.icon('trash'), 'Remove last photo');
    const undoRow = h('div.cam-undo-row', undoBtn);
    undoRow.hidden = true;
    const showLast = () => {
      const last = taken[taken.length - 1];
      lastImg.src = last ? last.url : '';
      if (!last) lastImg.removeAttribute('src');
      countEl.textContent = String(count);
      undoRow.hidden = !taken.length;
    };
    async function undoLast() {
      const last = taken[taken.length - 1];
      if (!last || busy > 0) { if (busy > 0) U.toast('Wait — the photo is still saving'); return; }
      await U.removePhotos([last.id]);
      taken.pop();
      URL.revokeObjectURL(last.url);
      count = Math.max(0, count - 1);
      showLast();
      U.toast('Last photo removed — take it again');
    }
    const shutterBtn = h('button.shutter', { 'aria-label': 'Take photo', onclick: () => shoot() }, h('i'));
    const hint = h('div.cam-hint', 'Hold still · tap the picture to focus');
    const root = h('div.camera',
      video, flashEl, hint,
      h('div.cam-top',
        h('button.cam-round', { 'aria-label': 'Close camera', onclick: () => close() }, U.icon('x')),
        h('div.cam-top-mid', h('div.cam-title', opts.title || 'Camera'), placeBtn),
        gpsPill),
      msg, gpsWarnEl,
      h('div.cam-bottom',
        tagsRow,
        h('div.cam-zoomrow', zoom),
        h('div.cam-controls',
          h('div.cam-side',
            h('button.cam-round', { 'aria-label': 'Use phone camera', title: 'Phone camera', onclick: usePhoneCamera }, U.icon('camera')),
            h('button.cam-round', { 'aria-label': 'Add from gallery', title: 'From gallery', onclick: useGallery }, U.icon('gallery'))),
          shutterBtn,
          h('div.cam-side',
            torchBtn,
            h('button.cam-round', { 'aria-label': 'Switch camera', onclick: flip }, U.icon('flip')),
            h('button.cam-done', { onclick: () => close() }, lastImg, countEl, savingEl))),
        undoRow));
    root.appendChild(ring);
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
      const q = U.gpsQuality(f);
      gpsPill.textContent = !f ? (Geo.err || 'Finding GPS…') : q === 'good' ? `GPS ±${Math.round(f.acc)} m ✓` : `GPS ±${Math.round(f.acc)} m — waiting for ±${U.gpsTarget()} m`;
      gpsWarnEl.hidden = !Geo.approximate();
      gpsPill.classList.toggle('ok', q === 'good');
      gpsPill.classList.toggle('weak', q === 'fair');
      gpsPill.classList.toggle('poor', q === 'poor');
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
      /* keep focus, exposure and colour adjusting by themselves */
      try {
        const adv = {};
        if ((caps.focusMode || []).includes('continuous')) adv.focusMode = 'continuous';
        if ((caps.exposureMode || []).includes('continuous')) adv.exposureMode = 'continuous';
        if ((caps.whiteBalanceMode || []).includes('continuous')) adv.whiteBalanceMode = 'continuous';
        if (Object.keys(adv).length) await track.applyConstraints({ advanced: [adv] });
      } catch (e) { /* not supported */ }
      photoCaps = null;
      if (ic && ic.getPhotoCapabilities) ic.getPhotoCapabilities().then((pc) => { photoCaps = pc; }, () => {});
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

    /* ---- sharp photos: steady wait + real still capture, else the sharpest of a short burst ---- */
    let motion = 0, motionTs = 0;
    const onMotion = (e) => {
      const r = e.rotationRate;
      if (r) { motion = Math.abs(r.alpha || 0) + Math.abs(r.beta || 0) + Math.abs(r.gamma || 0); motionTs = Date.now(); }
    };
    self.addEventListener('devicemotion', onMotion);
    async function waitSteady() {
      await U.sleep(90); // let the tap's own shake pass
      if (!motionTs) return;
      const t0 = Date.now();
      while (Date.now() - t0 < 650) { if (motion < 14) return; await U.sleep(30); }
    }
    let stillOK = true; // becomes false if takePhoto fails or is slow on this phone
    function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), ms))]); }
    async function grabFrame() {
      if (ic && ic.takePhoto && stillOK) {
        try {
          const o = {};
          const pc = photoCaps;
          if (pc && pc.imageWidth && pc.imageWidth.max) { o.imageWidth = pc.imageWidth.max; if (pc.imageHeight && pc.imageHeight.max) o.imageHeight = pc.imageHeight.max; }
          if (torch && pc && (pc.fillLightMode || []).includes('flash')) o.fillLightMode = 'flash';
          return await withTimeout(ic.takePhoto(o), 4000);
        } catch (e) { stillOK = false; /* use the burst below from now on */ }
      }
      return burstSharpest();
    }
    /* sharpness = variance of the Laplacian on a small grey copy (higher = sharper) */
    function sharpness(src, w, h) {
      const sw = 320, sh = Math.max(1, Math.round((h / w) * sw));
      const c = document.createElement('canvas'); c.width = sw; c.height = sh;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(src, 0, 0, sw, sh);
      const d = g.getImageData(0, 0, sw, sh).data;
      const gr = new Float32Array(sw * sh);
      for (let i = 0; i < sw * sh; i++) gr[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
      let s = 0, s2 = 0, n = 0;
      for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        const l = gr[i - 1] + gr[i + 1] + gr[i - sw] + gr[i + sw] - 4 * gr[i];
        s += l; s2 += l * l; n++;
      }
      c.width = c.height = 0;
      return n ? s2 / n - (s / n) * (s / n) : 0;
    }
    async function burstSharpest() {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) throw new Error('Camera is not ready yet');
      let best = null, bestScore = -1;
      for (let k = 0; k < 4; k++) {
        const c = document.createElement('canvas');
        c.width = vw; c.height = vh;
        c.getContext('2d').drawImage(video, 0, 0, vw, vh);
        const sc = sharpness(c, vw, vh);
        if (sc > bestScore) { if (best) best.width = best.height = 0; best = c; bestScore = sc; } else c.width = c.height = 0;
        if (k < 3) await U.sleep(70);
      }
      const b = await U.canvasToBlob(best, 'image/jpeg', 0.95);
      best.width = best.height = 0;
      return b;
    }
    /* tap the picture to focus there */
    video.addEventListener('click', async (e) => {
      if (!track) return;
      const r = video.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
      ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
      let caps = {};
      try { caps = track.getCapabilities ? track.getCapabilities() : {}; } catch (er) { /* */ }
      try {
        const adv = { pointsOfInterest: [{ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }] };
        if ((caps.focusMode || []).includes('single-shot')) adv.focusMode = 'single-shot';
        await track.applyConstraints({ advanced: [adv] });
        setTimeout(() => { if (track && (caps.focusMode || []).includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {}); }, 2500);
      } catch (er) { /* this phone cannot focus on a point */ }
    });

    function process(blob, source, fixOverride, tsOverride) {
      const ts = tsOverride || Date.now();
      const place = placeText();
      const thisTag = tag;
      busy++; showBusy();
      const fixP = fixOverride ? Promise.resolve(fixOverride) : Geo.good(10000); // wait up to 10 s for the accuracy set in Settings
      queue = queue.then(async () => {
        try {
          const fix = await fixP;
          if (!fixOverride && (!fix || fix.acc > U.gpsTarget())) U.toast(fix ? `GPS was ±${Math.round(fix.acc)} m for this photo (wanted ±${U.gpsTarget()} m). It is marked approximate.` : 'No GPS for this photo — check Location is on.', 4500);
          const r = await U.stampPhoto(blob, U.stampLines(place, fix, ts), { maxSide: st.maxSide, quality: st.quality, size: st.stampSize });
          const meta = await opts.onSave(Object.assign(r, { fix, ts, tag: thisTag, place, source }));
          count++;
          if (meta && meta.id) taken.push({ id: meta.id, url: URL.createObjectURL(r.thumb) });
          showLast();
        } catch (e) {
          U.toast('Photo not saved: ' + (e.message || e));
        } finally { busy--; showBusy(); }
      });
      return queue;
    }
    function showBusy() { savingEl.textContent = busy > 0 ? 'saving ' + busy : ''; }

    async function shoot() {
      if (!stream) { usePhoneCamera(); return; }
      if (shooting) return; // one capture at a time keeps every photo sharp
      shooting = true;
      shutterBtn.classList.add('wait');
      try {
        await waitSteady();
        const p = grabFrame();
        flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
        try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* */ }
        process(await p, 'app');
      } catch (e) { U.toast(e.message || 'Could not take photo'); } finally { shooting = false; shutterBtn.classList.remove('wait'); }
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
      self.removeEventListener('devicemotion', onMotion);
      clearInterval(gpsTimer);
      Geo.subs.delete(refreshGps);
      Geo.stop();
      if (busy > 0) { const b = U.busy('Saving photos…'); await queue; b.done(); }
      root.remove();
      document.body.classList.remove('cam-open');
      taken.forEach((t) => URL.revokeObjectURL(t.url));
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
      const fix = await Geo.good(10000) || (await Geo.once(10000));
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
