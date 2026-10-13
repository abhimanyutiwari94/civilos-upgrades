/* CivilOS Upgrades — Word (.docx) writer. Opens in Microsoft Word, WPS and Google Docs. */
(function () {
  'use strict';
  const U = self.U;
  const X = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const PAGE_W = 11906, PAGE_H = 16838, MAR = 720;
  const CW = PAGE_W - 2 * MAR; // twips
  const EMU = 635; // per twip

  function runs(text, o) {
    o = o || {};
    const rpr = `<w:rPr>${o.bold ? '<w:b/><w:bCs/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : ''}</w:rPr>`;
    return String(text == null ? '' : text).split('\n').map((line, i) =>
      `<w:r>${rpr}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${X(line)}</w:t></w:r>`).join('');
  }
  const P = (text, o) => {
    o = o || {};
    const ppr = `<w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.keep ? '<w:keepNext/>' : ''}${o.after != null ? `<w:spacing w:after="${o.after}" w:before="${o.before || 0}"/>` : ''}${o.align ? `<w:jc w:val="${o.align}"/>` : ''}</w:pPr>`;
    return `<w:p>${ppr}${runs(text, o)}</w:p>`;
  };
  const cell = (content, w, o) => {
    o = o || {};
    return `<w:tc><w:tcPr><w:tcW w:w="${Math.round(w)}" w:type="dxa"/>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}${o.noBorder ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>' : ''}</w:tcPr>${content}</w:tc>`;
  };
  const cellP = (text, o) => P(text, Object.assign({ style: 'Cell' }, o));
  function tbl(rowsXml, widths, o) {
    o = o || {};
    const borders = o.noBorder ? '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
      : '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="A0A0A0"/><w:left w:val="single" w:sz="4" w:color="A0A0A0"/><w:bottom w:val="single" w:sz="4" w:color="A0A0A0"/><w:right w:val="single" w:sz="4" w:color="A0A0A0"/><w:insideH w:val="single" w:sz="4" w:color="A0A0A0"/><w:insideV w:val="single" w:sz="4" w:color="A0A0A0"/></w:tblBorders>';
    return `<w:tbl><w:tblPr><w:tblW w:w="${CW}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${borders}<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${Math.round(w)}"/>`).join('')}</w:tblGrid>${rowsXml}</w:tbl>${P('', { after: 60 })}`;
  }
  const row = (cells, o) => `<w:tr>${o && o.head ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${cells}</w:tr>`;

  U.makeDOCX = async (rep, progress) => {
    const z = new U.ZipWriter();
    const media = []; // {rid, name, bytes}
    let picId = 0;
    const addMedia = (bytes, ext) => {
      const rid = 'rIdM' + (media.length + 1);
      const name = `media/image${media.length + 1}.${ext}`;
      media.push({ rid, name, bytes, ext });
      return rid;
    };
    const drawing = (rid, cx, cy) => {
      picId++;
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${picId}" name="Picture ${picId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${picId}" name="Picture ${picId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    };

    const body = [];
    const photoTotal = rep.blocks.filter((b) => b.t === 'photos').reduce((a, b) => a + b.items.length, 0) || 1;
    let photoDone = 0;

    for (const b of rep.blocks) {
      if (b.t === 'cover') {
        if (b.logo || b.company) {
          let left = '';
          if (b.logo) {
            try {
              const lg = await U.logoImages(b.logo);
              const hT = 900, wT = Math.min(3200, (lg.w / lg.h) * hT);
              left = `<w:p>${drawing(addMedia(lg.png, 'png'), Math.round(wT * EMU), Math.round((wT / lg.w) * lg.h * EMU))}</w:p>`;
            } catch (e) { left = ''; }
          }
          const lw = left ? 3400 : 0;
          body.push(tbl(row(cell(left || P(''), lw || 1, { noBorder: true }) + cell(P(b.company || '', { bold: true, size: 28 }), CW - (lw || 1), { noBorder: true })), [lw || 1, CW - (lw || 1)], { noBorder: true }));
        }
        body.push(P(b.title, { style: 'Title' }));
        body.push(P(b.school, { style: 'Subtitle' }));
        body.push(kvTable(b.meta, [0.25, 0.75]));
      } else if (b.t === 'h1') body.push(P(b.text, { style: 'Heading1' }));
      else if (b.t === 'h2') { body.push(P(b.text, { style: 'Heading2' })); if (b.sub) body.push(P(b.sub, { style: 'Small', keep: true })); }
      else if (b.t === 'p') body.push(P(b.text, { bold: b.bold, color: b.muted ? '6E6E6E' : null }));
      else if (b.t === 'kv') {
        if (b.cols === 4 && b.rows.length > 1) {
          const rows = [];
          for (let i = 0; i < b.rows.length; i += 2) rows.push([b.rows[i][0], b.rows[i][1], b.rows[i + 1] ? b.rows[i + 1][0] : '', b.rows[i + 1] ? b.rows[i + 1][1] : '']);
          body.push(kvTable(rows, [0.25, 0.25, 0.25, 0.25]));
        } else body.push(kvTable(b.rows, [0.38, 0.62]));
      } else if (b.t === 'table') {
        const ws = b.widths.map((w) => w * CW);
        let xml = row(b.head.map((hd, i) => cell(cellP(hd, { bold: true }), ws[i], { fill: 'EBEBEB' })).join(''), { head: true });
        for (const r of b.rows) xml += row(r.map((c, i) => cell(cellP(c, { align: b.numeric && i >= 2 ? 'right' : null }), ws[i])).join(''));
        if (b.total) xml += row(b.total.map((c, i) => cell(cellP(c, { bold: true, align: b.numeric && i >= 2 ? 'right' : null }), ws[i], { fill: 'F5F5F5' })).join(''));
        body.push(tbl(xml, ws));
      } else if (b.t === 'photos') {
        const per = rep.perRow;
        const cw = CW / per;
        const imgW = cw - 200;
        let xml = '';
        for (let i = 0; i < b.items.length; i += per) {
          const cells = [];
          for (let k = 0; k < per; k++) {
            const p = b.items[i + k];
            if (!p) { cells.push(cell(P(''), cw, { noBorder: true })); continue; }
            let pic = '';
            try {
              const im = await U.reportPhoto(p.id, rep.photoSize);
              if (im) {
                const boxH = imgW * 0.75;
                const s = Math.min(imgW / im.w, boxH / im.h);
                pic = `<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr>${drawing(addMedia(im.bytes, 'jpeg'), Math.round(im.w * s * EMU), Math.round(im.h * s * EMU))}</w:p>`;
              }
            } catch (e) { pic = ''; }
            photoDone++;
            if (progress) progress('Adding photos ' + photoDone + ' / ' + photoTotal, 0.1 + 0.8 * (photoDone / photoTotal));
            cells.push(cell((pic || P('(photo missing)')) + P(U.photoCaption(p), { style: 'Caption' }) + P(U.photoSub(p), { style: 'Small', after: 160 }), cw, { noBorder: true }));
          }
          xml += row(cells.join(''));
        }
        body.push(tbl(xml, Array(per).fill(cw), { noBorder: true }));
      } else if (b.t === 'pb') {
        body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      } else if (b.t === 'sign') {
        const w = CW / 2;
        const sc = (t) => cell(P('', { after: 600 }) + P('______________________________', { after: 40 }) + P(t, { style: 'Small' }), w, { noBorder: true });
        body.push(tbl(row(b.items.map(sc).join('')), [w, w], { noBorder: true }));
      }
    }

    function kvTable(rows, fr) {
      const ws = fr.map((f) => f * CW);
      const xml = rows.map((r) => row(r.map((c, i) => cell(cellP(c, { bold: i % 2 === 0 }), ws[i], { fill: i % 2 === 0 ? 'F6F6F6' : null })).join(''))).join('');
      return tbl(xml, ws);
    }

    if (progress) progress('Making the Word file…', 0.93);
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/><w:footerReference w:type="first" r:id="rIdF1"/><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/><w:pgMar w:top="900" w:right="${MAR}" w:bottom="900" w:left="${MAR}" w:header="400" w:footer="400" w:gutter="0"/><w:titlePg/></w:sectPr>`;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${body.join('')}${sect}</w:body></w:document>`;

    const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS}><w:p><w:pPr><w:pStyle w:val="Small"/><w:tabs><w:tab w:val="right" w:pos="${CW}"/></w:tabs></w:pPr>${runs(rep.header || '')}<w:r><w:tab/></w:r>${runs(rep.header === rep.school ? '' : rep.school)}</w:p></w:hdr>`;
    const left = [rep.footer, rep.credit].filter(Boolean).join('   ·   ');
    const pageField = `<w:r><w:t xml:space="preserve">Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> of </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple>`;
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Small"/><w:tabs><w:tab w:val="right" w:pos="${CW}"/></w:tabs></w:pPr>${runs(left)}<w:r><w:tab/></w:r>${pageField}</w:p></w:ftr>`;
    // first page: footer only (no running header above the title)
    const footerFirst = footer;

    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Nirmala UI"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="en-IN" w:bidi="hi-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="160"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="3C3C3C"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="5A5A5A"/></w:pBdr><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="25"/><w:szCs w:val="25"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Cell"><w:name w:val="Table text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Small text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:color w:val="6E6E6E"/><w:sz w:val="14"/><w:szCs w:val="14"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rIdF1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/><Relationship Id="rIdSet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${media.map((m) => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.name}"/>`).join('')}</Relationships>`;

    const docFinal = doc;

    await z.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    await z.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    await z.add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(rep.title + ' — ' + rep.school)}</dc:title><dc:creator></dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    await z.add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>`);
    await z.add('word/document.xml', docFinal);
    await z.add('word/styles.xml', styles);
    await z.add('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="false"/><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
    await z.add('word/header1.xml', header);
    await z.add('word/footer1.xml', footer);
    await z.add('word/footer2.xml', footerFirst);
    await z.add('word/_rels/document.xml.rels', rels);
    for (const m of media) { await z.add('word/' + m.name, m.bytes, false); m.bytes = null; }
    return z.blob(U.FILETYPES.docx.mime);
  };
})();
