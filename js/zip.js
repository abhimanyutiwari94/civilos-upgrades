/* Infra Upgrades — ZIP writer/reader (for .docx, .xlsx and backup files). No libraries. */
(function () {
  'use strict';
  const U = self.U;
  const CRC = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; }
  const crc32 = (u8, crc) => {
    let c = crc == null ? -1 : ~crc;
    for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return ~c >>> 0;
  };
  U.crc32 = crc32;
  const enc = new TextEncoder();
  const canDeflate = typeof CompressionStream !== 'undefined';

  async function deflateRaw(u8) {
    const cs = new CompressionStream('deflate-raw');
    const out = new Response(new Blob([u8]).stream().pipeThrough(cs));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function inflateRaw(blob) {
    const ds = new DecompressionStream('deflate-raw');
    return new Response(blob.stream().pipeThrough(ds)).blob();
  }
  U.deflateZlib = async (u8) => {
    if (!canDeflate) return null;
    const cs = new CompressionStream('deflate');
    return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer());
  };

  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  class ZipWriter {
    constructor() { this.parts = []; this.central = []; this.offset = 0; this.when = dosTime(new Date()); }
    /* data: string | Uint8Array | Blob. compress: true for text (default for strings). */
    async add(name, data, compress) {
      let raw;
      if (typeof data === 'string') { raw = enc.encode(data); if (compress == null) compress = true; }
      else if (data instanceof Blob) raw = new Uint8Array(await data.arrayBuffer());
      else raw = data;
      const crc = crc32(raw);
      let body = raw, method = 0;
      if (compress && canDeflate && raw.length > 64) {
        try { const d = await deflateRaw(raw); if (d.length < raw.length) { body = d; method = 8; } } catch (e) { /* store */ }
      }
      const nm = enc.encode(name);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true); lh.setUint16(10, this.when.time, true); lh.setUint16(12, this.when.date, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, raw.length, true);
      lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      this.parts.push(lh.buffer, nm, body);
      this.central.push({ nm, crc, csize: body.length, usize: raw.length, method, offset: this.offset });
      this.offset += 30 + nm.length + body.length;
      if (this.offset > 0xfffffff0) throw new Error('File is too big (over 4 GB). Please back up schools one by one.');
    }
    blob(type) {
      const cd = [];
      let size = 0;
      for (const e of this.central) {
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
        c.setUint16(10, e.method, true); c.setUint16(12, this.when.time, true); c.setUint16(14, this.when.date, true);
        c.setUint32(16, e.crc, true); c.setUint32(20, e.csize, true); c.setUint32(24, e.usize, true);
        c.setUint16(28, e.nm.length, true); c.setUint32(42, e.offset, true);
        cd.push(c.buffer, e.nm);
        size += 46 + e.nm.length;
      }
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, this.central.length, true); end.setUint16(10, this.central.length, true);
      end.setUint32(12, size, true); end.setUint32(16, this.offset, true);
      return new Blob([...this.parts, ...cd, end.buffer], { type: type || 'application/zip' });
    }
  }
  U.ZipWriter = ZipWriter;

  /* Read entries of a zip Blob: returns Map name -> { blob(): Promise<Blob>, text(): Promise<string> } */
  U.readZip = async (file) => {
    const tailLen = Math.min(file.size, 65557);
    const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This is not a Infra Upgrades file.');
    const count = tail.getUint16(eocd + 10, true);
    const cdSize = tail.getUint32(eocd + 12, true);
    const cdOff = tail.getUint32(eocd + 16, true);
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const dec = new TextDecoder();
    const map = new Map();
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (cd.getUint32(p, true) !== 0x02014b50) break;
      const method = cd.getUint16(p + 10, true);
      const csize = cd.getUint32(p + 20, true);
      const nlen = cd.getUint16(p + 28, true), xlen = cd.getUint16(p + 30, true), clen = cd.getUint16(p + 32, true);
      const off = cd.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nlen));
      p += 46 + nlen + xlen + clen;
      const get = async () => {
        const lh = new DataView(await file.slice(off, off + 30).arrayBuffer());
        const start = off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
        const body = file.slice(start, start + csize);
        if (method === 0) return body;
        if (method === 8) return inflateRaw(body);
        throw new Error('Unsupported file packing');
      };
      map.set(name, { blob: get, text: async () => (await get()).text() });
    }
    return map;
  };
})();
