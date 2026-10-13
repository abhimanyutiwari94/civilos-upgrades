/* CivilOS Upgrades — PDF writer (A4, real text, photos embedded). No libraries.
   English text uses the PDF's built-in Helvetica; any other script (e.g. Hindi) is drawn
   by the phone and placed as a tiny picture so it always prints correctly. */
(function () {
  'use strict';
  const U = self.U;

  /* Helvetica / Helvetica-Bold widths for ASCII 32..126 (per 1000 em) */
  const WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const SPECIAL = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
  const EXTRA_W = { 0x80: 556, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x99: 1000, 0xb0: 400, 0xb1: 584, 0xd7: 584, 0xb2: 333, 0xb3: 333, 0xbd: 834, 0xa0: 278 };
  const winCode = (cp) => {
    if (cp >= 32 && cp <= 126) return cp;
    if (cp >= 0xa0 && cp <= 0xff) return cp;
    return SPECIAL[cp] || 0;
  };
  const isWin = (s) => { for (const ch of s) if (!winCode(ch.codePointAt(0))) return false; return true; };
  const charW = (code, bold) => (code >= 32 && code <= 126 ? (bold ? WB : WR)[code - 32] : EXTRA_W[code] || (bold ? 611 : 556));

  /* canvas for measuring / drawing non-Latin text */
  let mc = null;
  const FONT = '"Segoe UI", "Nirmala UI", "Noto Sans", "Noto Sans Devanagari", Roboto, Arial, sans-serif';
  const mctx = () => { if (!mc) mc = document.createElement('canvas').getContext('2d'); return mc; };
  function width(s, size, bold) {
    if (isWin(s)) { let w = 0; for (const ch of s) w += charW(winCode(ch.codePointAt(0)), bold); return (w * size) / 1000; }
    const g = mctx(); g.font = `${bold ? 700 : 400} ${size * 4}px ${FONT}`; return g.measureText(s).width / 4;
  }
  /* word wrap into lines that fit maxW */
  function wrap(text, size, bold, maxW) {
    const out = [];
    for (const para of String(text == null ? '' : text).replace(/\r/g, '').split('\n')) {
      const words = para.split(/(\s+)/);
      let line = '';
      for (const w of words) {
        if (!w) continue;
        const test = line + w;
        if (width(test, size, bold) <= maxW || !line.trim()) {
          if (width(test, size, bold) > maxW) {
            // a single long word: break it
            let piece = '';
            for (const ch of test) {
              if (width(piece + ch, size, bold) > maxW && piece) { out.push(piece); piece = ''; }
              piece += ch;
            }
            line = piece;
          } else line = test;
        } else { out.push(line.replace(/\s+$/, '')); line = /^\s+$/.test(w) ? '' : w; }
      }
      out.push(line.replace(/\s+$/, ''));
    }
    return out.length ? out : [''];
  }
  const esc = (s) => {
    let o = '';
    for (const ch of s) {
      const c = winCode(ch.codePointAt(0)) || 63;
      if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c);
      else if (c < 32 || c > 126) o += '\\' + c.toString(8).padStart(3, '0');
      else o += String.fromCharCode(c);
    }
    return o;
  };
  const n2 = (v) => (Math.round(v * 100) / 100).toString();

  const PW = 595.28, PH = 841.89, M = 34, TOP = 84, BOT = 40, CW = PW - 2 * M;

  U.makePDF = async (rep, progress) => {
    const TH = U.THEME;
    const pages = [];
    const images = []; // {name, bytes, w, h, gray?}
    let page = null, y = 0;
    const textImgCache = new Map();

    const newPage = () => { page = { ops: [] }; pages.push(page); y = TOP; };
    const op = (s) => page.ops.push(s);
    const ensure = (hgt) => { if (y + hgt > PH - BOT) { newPage(); return true; } return false; };
    const rgb = (c) => c.map((v) => n2(v / 255)).join(' ');

    function addImage(bytes, w, h) {
      const name = 'Im' + (images.length + 1);
      images.push({ name, bytes, w, h });
      return name;
    }
    function drawImage(name, x, yy, w, h) { op(`q ${n2(w)} 0 0 ${n2(h)} ${n2(x)} ${n2(PH - yy - h)} cm /${name} Do Q`); }

    /* one line of text at (x, baseline yy) */
    async function textLine(s, x, yy, size, bold, color, bg) {
      if (!s) return;
      if (isWin(s)) {
        op(`BT /${bold === 'i' ? 'F3' : bold ? 'F2' : 'F1'} ${n2(size)} Tf ${rgb(color || [20, 20, 20])} rg ${n2(x)} ${n2(PH - yy)} Td (${esc(s)}) Tj ET`);
        return;
      }
      const key = [s, size, bold, (bg || []).join()].join('|');
      let im = textImgCache.get(key);
      if (!im) {
        const sc = 4, fs = size * sc;
        const c = document.createElement('canvas');
        const g = c.getContext('2d');
        g.font = `${bold ? 700 : 400} ${fs}px ${FONT}`;
        const w = Math.ceil(g.measureText(s).width) + 4;
        const hh = Math.ceil(fs * 1.45);
        c.width = w; c.height = hh;
        g.fillStyle = bg ? `rgb(${bg.join(',')})` : '#fff';
        g.fillRect(0, 0, w, hh);
        g.font = `${bold ? 700 : 400} ${fs}px ${FONT}`;
        g.fillStyle = `rgb(${(color || [20, 20, 20]).join(',')})`;
        g.textBaseline = 'alphabetic';
        g.fillText(s, 2, Math.round(fs * 1.08));
        const blob = await U.canvasToBlob(c, 'image/jpeg', 0.92);
        im = { name: addImage(new Uint8Array(await blob.arrayBuffer()), w, hh), w: w / sc, h: hh / sc };
        textImgCache.set(key, im);
      }
      drawImage(im.name, x - 0.5, yy - size * 1.08, im.w, im.h);
    }
    const rect = (x, yy, w, h, fill, stroke, lw) => {
      if (fill) op(`${rgb(fill)} rg ${n2(x)} ${n2(PH - yy - h)} ${n2(w)} ${n2(h)} re f`);
      if (stroke) op(`${lw || 0.5} w ${rgb(stroke)} RG ${n2(x)} ${n2(PH - yy - h)} ${n2(w)} ${n2(h)} re S`);
    };
    const hline = (x1, x2, yy, color, lw) => op(`${lw || 0.5} w ${rgb(color || [150, 150, 150])} RG ${n2(x1)} ${n2(PH - yy)} m ${n2(x2)} ${n2(PH - yy)} l S`);

    async function para(text, size, bold, color, indent, after) {
      const lh = size * 1.32;
      for (const l of wrap(text, size, bold, CW - (indent || 0))) {
        ensure(lh);
        await textLine(l, M + (indent || 0), y + size, size, bold, color);
        y += lh;
      }
      y += after == null ? 4 : after;
    }

    /* table with wrapped cells, header repeated on each page */
    async function table(head, widths, rows, opt) {
      opt = opt || {};
      const fs = rows.length && head.length > 7 ? 7.2 : 8;
      const pad = 3, lh = fs * 1.28;
      const ws = widths.map((w) => w * CW);
      const prep = (cells, bold) => cells.map((c, i) => wrap(c == null ? '' : String(c), fs, bold, ws[i] - pad * 2));
      const headL = prep(head, true);
      const headH = Math.max(...headL.map((l) => l.length)) * lh + pad * 2;
      const drawRow = async (lines, hgt, bold, fill, head, raw) => {
        let x = M;
        for (let i = 0; i < ws.length; i++) {
          const cf = !head && opt.cond === i && raw ? U.condRGB(raw[i]) : null;
          const f = cf || fill;
          rect(x, y, ws[i], hgt, f, TH.line, 0.5);
          let ty = y + pad + fs * 0.92;
          const right = opt.numeric && i >= 2;
          for (const l of lines[i] || []) {
            const tw = width(l, fs, bold);
            const tx = head ? x + (ws[i] - tw) / 2 : right ? x + ws[i] - pad - tw : x + pad;
            await textLine(l, tx, ty, fs, bold, head ? [255, 255, 255] : TH.ink, f);
            ty += lh;
          }
          x += ws[i];
        }
        y += hgt;
      };
      const drawHead = async () => { await drawRow(headL, headH, true, TH.navy, true); };
      if (y + headH + lh * 2 + pad * 2 > PH - BOT) newPage();
      await drawHead();
      const all = rows.map((r) => ({ lines: prep(r, false), bold: false, raw: r }));
      if (opt.total) all.push({ lines: prep(opt.total, true), bold: true, fill: TH.label });
      for (const r of all) {
        let lines = r.lines;
        for (;;) {
          const need = Math.max(...lines.map((l) => l.length)) * lh + pad * 2;
          if (y + need <= PH - BOT) { await drawRow(lines, need, r.bold, r.fill, false, r.raw); break; }
          const fit = Math.floor((PH - BOT - y - pad * 2) / lh);
          if (fit >= 3 || need > PH - BOT - TOP - headH) {
            const n = Math.max(1, fit);
            await drawRow(lines.map((l) => l.slice(0, n)), n * lh + pad * 2, r.bold, r.fill, false, r.raw);
            lines = lines.map((l) => l.slice(n));
            newPage(); await drawHead();
            if (lines.every((l) => !l.length)) break;
          } else { newPage(); await drawHead(); }
        }
      }
      y += 8;
    }

    async function kv(rows, cols) {
      if (cols === 4 && rows.length > 1) {
        const out = [];
        for (let i = 0; i < rows.length; i += 2) out.push([rows[i][0], rows[i][1], rows[i + 1] ? rows[i + 1][0] : '', rows[i + 1] ? rows[i + 1][1] : '']);
        await kvTable(out, [0.25, 0.25, 0.25, 0.25]);
      } else await kvTable(rows, [0.38, 0.62]);
    }
    async function kvTable(rows, widths) {
      const fs = 8.5, pad = 3, lh = fs * 1.3;
      const ws = widths.map((w) => w * CW);
      for (const r of rows) {
        const lines = r.map((c, i) => wrap(c, fs, i % 2 === 0, ws[i] - pad * 2));
        const hgt = Math.max(...lines.map((l) => l.length)) * lh + pad * 2;
        ensure(hgt);
        let x = M;
        for (let i = 0; i < ws.length; i++) {
          const isLab = i % 2 === 0;
          const fill = isLab ? TH.label : (r[i] ? TH.value : [255, 255, 255]);
          rect(x, y, ws[i], hgt, fill, TH.line, 0.5);
          let ty = y + pad + fs * 0.92;
          for (const l of lines[i]) { await textLine(l, x + pad, ty, fs, isLab, isLab ? TH.navy : TH.ink, fill); ty += lh; }
          x += ws[i];
        }
        y += hgt;
      }
      y += 8;
    }

    let photoDone = 0;
    const photoTotal = rep.blocks.filter((b) => b.t === 'photos').reduce((a, b) => a + b.items.length, 0) || 1;
    async function photos(items) {
      const per = rep.perRow, gap = 10;
      const cw = (CW - gap * (per - 1)) / per;
      const boxH = cw * 0.75;
      for (let i = 0; i < items.length; i += per) {
        const row = items.slice(i, i + per);
        const caps = row.map((p) => wrap(U.photoCaption(p), 7.6, true, cw).slice(0, 3));
        const capH = Math.max(...caps.map((c) => c.length)) * 9.6 + 11;
        ensure(boxH + capH + 6);
        for (let k = 0; k < row.length; k++) {
          const p = row[k];
          const x = M + k * (cw + gap);
          rect(x, y, cw, boxH, [242, 242, 242], null);
          try {
            const im = await U.reportPhoto(p.id, rep.photoSize);
            if (im) {
              const s = Math.min(cw / im.w, boxH / im.h);
              const w = im.w * s, hh = im.h * s;
              drawImage(addImage(im.bytes, im.w, im.h), x + (cw - w) / 2, y + (boxH - hh) / 2, w, hh);
            }
          } catch (e) { /* missing photo — leave the grey box */ }
          rect(x, y, cw, boxH, null, TH.line, 0.5);
          let ty = y + boxH + 9;
          for (const l of caps[k]) { await textLine(l, x, ty, 7.6, true, TH.navy); ty += 9.6; }
          await textLine(wrap(U.photoSub(p), 6.6, false, cw)[0], x, ty, 6.6, false, [110, 110, 110]);
          photoDone++;
          if (progress) progress('Adding photos ' + photoDone + ' / ' + photoTotal, 0.1 + 0.8 * (photoDone / photoTotal));
        }
        y += boxH + capH + 8;
      }
      y += 4;
    }

    /* ---- draw all blocks ---- */
    newPage();
    let logo = null;
    for (const b of rep.blocks) {
      if (b.t === 'cover') {
        /* Project / Client / Document / Date strip, as on the company checklist */
        const st = (rep.lh && rep.lh.strip) || [];
        if (st.length) {
          const cw4 = CW / st.length, fsH = 7, fsV = 8.6, pad = 4;
          const vals = st.map((c) => wrap(c[1] || '', fsV, true, cw4 - pad * 2));
          const hV = Math.max(...vals.map((l) => l.length)) * fsV * 1.25 + pad * 2;
          for (let i = 0; i < st.length; i++) {
            const x = M + i * cw4;
            rect(x, y, cw4, 13, TH.label, TH.line, 0.5);
            await textLine(st[i][0], x + (cw4 - width(st[i][0], fsH, true)) / 2, y + 9.2, fsH, true, TH.navy, TH.label);
            rect(x, y + 13, cw4, hV, null, TH.line, 0.5);
            let ty = y + 13 + pad + fsV * 0.92;
            for (const l of vals[i]) { await textLine(l, x + (cw4 - width(l, fsV, true)) / 2, ty, fsV, true, TH.ink); ty += fsV * 1.25; }
          }
          y += 13 + hV + 12;
        }
        await para(b.school, 13, true, TH.navy, 0, 4);
        await kvTable(b.meta, [0.25, 0.75]);
        y += 2;
      } else if (b.t === 'h1') {
        ensure(150); // keep the heading with what follows it
        y += 4;
        const t = String(b.text).toUpperCase();
        const lines = wrap(t, 9.5, true, CW - 14);
        const hh = lines.length * 12 + 7;
        rect(M, y, CW, hh, TH.orange, null);
        let ty = y + 13;
        for (const l of lines) { await textLine(l, M + 7, ty, 9.5, true, [255, 255, 255], TH.orange); ty += 12; }
        y += hh + 6;
      } else if (b.t === 'h2') {
        ensure(b.keep ? 150 : 110);
        y += 3;
        await para(b.text, 9.8, true, TH.navy, 0, b.sub ? 0 : 3);
        if (b.sub) await para(b.sub, 8, false, TH.muted, 0, 4);
      } else if (b.t === 'p') {
        await para(b.text, 8.6, !!b.bold, b.muted ? [110, 110, 110] : [25, 25, 25], 0, 5);
      } else if (b.t === 'kv') {
        await kv(b.rows, b.cols);
      } else if (b.t === 'table') {
        await table(b.head, b.widths, b.rows, { total: b.total, numeric: b.numeric, cond: b.cond });
      } else if (b.t === 'photos') {
        await photos(b.items);
      } else if (b.t === 'pb') {
        if (y > TOP + 1) newPage();
      } else if (b.t === 'sign') {
        ensure(90);
        y += 26;
        const w = (CW - 30) / 2;
        for (let i = 0; i < b.items.length; i++) {
          const x = M + i * (w + 30);
          hline(x, x + w, y + 34, [60, 60, 60], 0.6);
          await textLine(b.items[i], x, y + 46, 8, false, [60, 60, 60]);
        }
        y += 60;
      }
    }

    /* ---- company letterhead and footer on every page ---- */
    const total = pages.length;
    const lg = await U.companyLogo();
    const logoName = addImage(lg.jpg, lg.w, lg.h);
    const lw = 150, lhgt = (lg.h / lg.w) * lw;
    const L = rep.lh || {};
    for (let i = 0; i < total; i++) {
      page = pages[i];
      drawImage(logoName, M - 2, 20, lw, lhgt);
      const t1 = wrap(L.title || rep.title || '', 8.6, true, CW - lw - 20)[0];
      await textLine(t1, PW - M - width(t1, 8.6, true), 32, 8.6, true, TH.navy);
      const t2 = wrap(L.sub || rep.school || '', 8, 'i', CW - lw - 20)[0];
      await textLine(t2, PW - M - width(t2, 8, true), 45, 8, 'i', TH.orange);
      const t3 = `Page ${i + 1} of ${total}`;
      await textLine(t3, PW - M - width(t3, 6.5, false), 57, 6.5, false, TH.ink);
      hline(M, PW - M, 64, TH.orange, 1.6);
      hline(M, PW - M, PH - 32, TH.line, 0.5);
      await textLine(L.footLeft || '', M, PH - 22, 6.5, false, TH.ink);
      const pn = `Page ${i + 1} of ${total}`;
      await textLine(pn, (PW - width(pn, 6.5, false)) / 2, PH - 22, 6.5, false, TH.ink);
      const fr = wrap([L.footRight, rep.footer, rep.credit].filter(Boolean).join('  |  '), 6.5, false, CW * 0.42)[0];
      await textLine(fr, PW - M - width(fr, 6.5, false), PH - 22, 6.5, false, TH.ink);
    }

    if (progress) progress('Making the PDF file…', 0.95);
    return assemble(pages, images);
  };

  async function assemble(pages, images) {
    const enc = new TextEncoder();
    const parts = [];
    let pos = 0;
    const offs = [];
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; };
    let next = 1;
    const id = () => next++;
    const catalog = id(), pagesId = id(), f1 = id(), f2 = id(), f3 = id();
    const imgIds = images.map(() => id());
    const pageIds = pages.map(() => [id(), id()]);
    const obj = (n, body) => { offs[n] = pos; push(`${n} 0 obj\n`); if (typeof body === 'string') push(body); else body(); push('\nendobj\n'); };

    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'.replace(/[\u0080-ÿ]/g, 'x'));
    obj(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    obj(pagesId, `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((p) => p[0] + ' 0 R').join(' ')}] >>`);
    obj(f1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(f2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    obj(f3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>');
    images.forEach((im, i) => {
      obj(imgIds[i], () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
        push(im.bytes);
        push('\nendstream');
      });
      im.bytes = null;
    });
    const xobj = images.map((im, i) => `/${im.name} ${imgIds[i]} 0 R`).join(' ');
    for (let i = 0; i < pages.length; i++) {
      const [pid, cid] = pageIds[i];
      const raw = enc.encode(pages[i].ops.join('\n'));
      let data = raw, filter = '';
      try { const z = await U.deflateZlib(raw); if (z && z.length < raw.length) { data = z; filter = ' /Filter /FlateDecode'; } } catch (e) { /* plain */ }
      obj(pid, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> /XObject << ${xobj} >> >> /Contents ${cid} 0 R >>`);
      obj(cid, () => { push(`<< /Length ${data.length}${filter} >>\nstream\n`); push(data); push('\nendstream'); });
    }
    const xref = pos;
    let x = `xref\n0 ${next}\n0000000000 65535 f \n`;
    for (let n = 1; n < next; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
    push(x);
    push(`trailer\n<< /Size ${next} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }
})();
