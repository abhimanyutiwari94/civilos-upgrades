/* CivilOS Upgrades — report preview: shows the report as pages before it is saved,
   built from the same report blocks the PDF / Word / Excel writers use, in the company format. */
(function () {
  'use strict';
  const U = self.U, h = U.h;
  const css = (rgb) => (rgb ? `rgb(${rgb.join(',')})` : '');

  /* rep: from U.buildReport / U.buildRoomReport. onSave(): called from the Save button (a tap, so folder picking works). */
  U.previewReport = (rep, { title, onSave, note } = {}) => {
    const L = rep.lh || {};
    const logo = U.LOGO_PNG || 'icons/sakshham-logo.png';
    let page = null, n = 0;
    const add = (...k) => U.append(page, k);
    const pages = h('div.pv-pages');
    const newPage = () => {
      n++;
      page = h('div.pv-page',
        h('div.pv-head',
          h('img.pv-logo', { src: logo, alt: 'Sakshham Consultants' }),
          h('div.pv-titles', h('div.pv-t1', L.title || rep.title || ''), h('div.pv-t2', L.sub || rep.school || ''), h('div.pv-t3', 'Page ' + n))));
      pages.append(page);
    };
    const table = (head, rows, opt) => h('table.pv-table' + (opt && opt.numeric ? '.num' : ''),
      head ? h('thead', h('tr', head.map((c) => h('th', c)))) : null,
      h('tbody', rows.map((r, i) => h('tr' + (opt && opt.total && i === rows.length - 1 ? '.tot' : ''), r.map((c, k) => {
        if (opt && opt.kv) return h(k % 2 === 0 ? 'th' : 'td' + (c ? '.val' : ''), c == null ? '' : String(c));
        const cf = opt && opt.cond === k ? U.condRGB(c) : null;
        return h('td', { style: cf ? { background: css(cf), textAlign: 'center' } : null }, c == null ? '' : String(c));
      })))));
    newPage();
    for (const b of rep.blocks) {
      if (b.t === 'cover') {
        const st = L.strip || [];
        if (st.length) add(h('table.pv-strip', h('tr', st.map((c) => h('th', c[0]))), h('tr', st.map((c) => h('td', c[1] || '')))));
        add(h('div.pv-school', b.school), table(null, b.meta, { kv: true }));
      } else if (b.t === 'h1') add(h('h2.pv-h1', String(b.text).toUpperCase()));
      else if (b.t === 'h2') add(h('h3.pv-h2', b.text), b.sub ? h('div.pv-muted', b.sub) : null);
      else if (b.t === 'p') add(h('p' + (b.muted ? '.pv-muted' : ''), { style: b.bold ? { fontWeight: 700 } : null }, b.text));
      else if (b.t === 'kv') {
        let rows = b.rows;
        if (b.cols === 4 && rows.length > 1) { const o = []; for (let i = 0; i < rows.length; i += 2) o.push([rows[i][0], rows[i][1], rows[i + 1] ? rows[i + 1][0] : '', rows[i + 1] ? rows[i + 1][1] : '']); rows = o; }
        add(table(null, rows, { kv: true }));
      } else if (b.t === 'table') add(h('div.pv-scroll', table(b.head, b.total ? [...b.rows, b.total] : b.rows, { numeric: b.numeric, total: !!b.total, cond: b.cond })));
      else if (b.t === 'photos') {
        const grid = h('div.pv-photos', { style: { gridTemplateColumns: `repeat(${rep.perRow || 2}, 1fr)` } });
        for (const p of b.items) {
          const img = h('img', { alt: '', loading: 'lazy' });
          U.thumbURL(p.id).then((u) => { img.src = u; });
          grid.append(h('figure', h('div.pv-imgbox', img), h('figcaption', h('b', U.photoCaption(p)), h('span', U.photoSub(p)))));
        }
        add(grid);
      } else if (b.t === 'pb') newPage();
      else if (b.t === 'sign') add(h('div.pv-sign', b.items.map((t) => h('div', h('i'), t))));
    }
    U.$$('.pv-page', pages).forEach((pg) => pg.append(h('div.pv-foot', h('span', L.footLeft || ''), h('span', [L.footRight, rep.footer, rep.credit].filter(Boolean).join('  |  ')))));

    let closed = false;
    const close = (fromPop) => {
      if (closed) return;
      closed = true;
      self.removeEventListener('popstate', onPop);
      if (!fromPop) history.back();
      root.remove();
    };
    const onPop = () => close(true);
    const root = h('div.preview',
      h('header.top',
        h('button.icon-btn', { 'aria-label': 'Back', onclick: () => close() }, U.icon('back')),
        h('div.title', h('h1', 'Preview'), h('div.sub', title || rep.title))),
      h('div.pv-note', note || 'This is how the report will look. Go back to change anything — every change is saved.'),
      pages,
      h('div.pv-bar',
        h('button.btn.grow', { onclick: () => close() }, U.icon('edit'), 'Back to edit'),
        onSave ? h('button.btn.primary.grow', { onclick: () => { close(); onSave(); } }, U.icon('save'), 'Save report') : null));
    document.body.appendChild(root);
    history.pushState({ preview: 1 }, '');
    self.addEventListener('popstate', onPop);
  };
})();
