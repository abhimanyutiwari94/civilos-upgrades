/* Infra Upgrades — photo stamping in the background (Web Worker), so the camera and screen never freeze.
   Message in: { id, blob, lines, maxSide, quality, size }   Message out: { id, blob, thumb, w, h } or { id, error } */
/* eslint-disable no-restricted-globals */
'use strict';
function fitText(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (g.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}
self.onmessage = async (ev) => {
  const { id, blob, lines, maxSide, quality, size } = ev.data;
  try {
    const img = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const s = Math.min(1, (maxSide || 2560) / Math.max(img.width, img.height));
    const w = Math.round(img.width * s), hh = Math.round(img.height * s);
    const c = new OffscreenCanvas(w, hh);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, hh);
    img.close();
    const ls = (lines || []).filter(Boolean);
    if (ls.length) {
      const short = Math.min(w, hh);
      const fs = Math.max(11, Math.round(short * (size === 'medium' ? 0.026 : 0.0175)));
      const lh = Math.round(fs * 1.3), pad = Math.round(fs * 0.5), margin = Math.round(fs * 0.7);
      g.font = `600 ${fs}px "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", Arial, sans-serif`;
      g.textBaseline = 'alphabetic';
      const maxW = Math.round(w * 0.9) - pad * 2;
      const shown = ls.map((t) => fitText(g, t, maxW));
      const tw = Math.max(...shown.map((t) => g.measureText(t).width));
      const bw = Math.round(tw + pad * 2), bh = Math.round(ls.length * lh + pad * 1.2);
      const x = margin, y = hh - margin - bh, r = Math.round(fs * 0.35);
      g.fillStyle = 'rgba(0,0,0,0.48)';
      g.beginPath();
      g.moveTo(x + r, y); g.lineTo(x + bw - r, y); g.quadraticCurveTo(x + bw, y, x + bw, y + r);
      g.lineTo(x + bw, y + bh - r); g.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh);
      g.lineTo(x + r, y + bh); g.quadraticCurveTo(x, y + bh, x, y + bh - r);
      g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
      g.fill();
      g.fillStyle = '#fff';
      shown.forEach((t, i) => g.fillText(t, x + pad, y + pad * 0.6 + lh * (i + 1) - Math.round(lh * 0.25)));
    }
    const out = await c.convertToBlob({ type: 'image/jpeg', quality: quality || 0.82 });
    const ts = Math.min(1, 360 / Math.max(w, hh));
    const tc = new OffscreenCanvas(Math.round(w * ts), Math.round(hh * ts));
    const tg = tc.getContext('2d');
    tg.imageSmoothingQuality = 'high';
    tg.drawImage(c, 0, 0, tc.width, tc.height);
    const thumb = await tc.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
    self.postMessage({ id, blob: out, thumb, w, h: hh });
  } catch (e) {
    self.postMessage({ id, error: String((e && e.message) || e) });
  }
};
