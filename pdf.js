(function (root) {
  'use strict';

  var REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
    667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    278,278,278,469,556,333,
    556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
    334,260,334,584];
  var BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,
    722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    333,278,333,584,556,333,
    556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,
    389,280,389,584];

  var CP = {8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,
    8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,
    8482:153,353:154,8250:155,339:156,382:158,376:159};
  var SPECIAL = {'¿':611,'¡':333,'€':556,'•':350,'–':556,'—':1000,'…':1000,'“':333,'”':333,'‘':222,'’':222};

  function hexRgb(h) {
    h = h.replace('#', '');
    return [0, 2, 4].map(function (i) { return (parseInt(h.substr(i, 2), 16) / 255).toFixed(3); }).join(' ');
  }

  function toBytes(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), b;
      if (c === 160) b = 32;
      else if (CP[c] !== undefined) b = CP[c];
      else if (c < 32) b = 32;
      else if (c <= 255 && !(c >= 128 && c <= 159)) b = c;
      else b = 63;
      out += String.fromCharCode(b);
    }
    return out;
  }

  function esc(b) {
    return b.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function charW(ch, bold) {
    var t = bold ? BOLD : REG;
    var c = ch.charCodeAt(0);
    if (c >= 32 && c <= 126) return t[c - 32];
    if (SPECIAL[ch] !== undefined) return SPECIAL[ch];
    var base = ch.normalize ? ch.normalize('NFD').charAt(0) : ch;
    var bc = base.charCodeAt(0);
    if (bc >= 32 && bc <= 126) return t[bc - 32];
    return 556;
  }

  function textW(s, size, bold) {
    var w = 0;
    for (var i = 0; i < s.length; i++) w += charW(s.charAt(i), bold);
    return w * size / 1000;
  }

  function wrap(str, maxW, size, bold) {
    var lines = [];
    String(str).split(/\r?\n/).forEach(function (para) {
      if (para.trim() === '') { lines.push(''); return; }
      var words = para.split(/\s+/).filter(Boolean);
      var line = '';
      words.forEach(function (word) {
        var test = line ? line + ' ' + word : word;
        if (textW(test, size, bold) <= maxW) { line = test; return; }
        if (line) { lines.push(line); line = ''; }
        if (textW(word, size, bold) <= maxW) { line = word; return; }
        var part = '';
        for (var i = 0; i < word.length; i++) {
          if (textW(part + word.charAt(i), size, bold) > maxW) { lines.push(part); part = ''; }
          part += word.charAt(i);
        }
        line = part;
      });
      lines.push(line);
    });
    return lines;
  }

  function jpegInfo(b) {
    if (b[0] !== 0xFF || b[1] !== 0xD8) throw new Error('JPEG no válido');
    var i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xFF) { i++; continue; }
      var m = b[i + 1];
      if (m === 0xFF) { i++; continue; }
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], n: b[i + 9] };
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    throw new Error('JPEG no válido');
  }

  function hexUtf16(s) {
    var h = 'FEFF';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i).toString(16).toUpperCase();
      h += ('0000' + c).slice(-4);
    }
    return '<' + h + '>';
  }

  function build(data) {
    var PW = 595.28, PH = 841.89, MX = 48, MT = 60, MB = 58, CW = PW - 2 * MX;
    var BW = 235, BH = 176, GAP = 14, PERROW = 2;
    var COL = { text: '#1a1a1a', gray: '#666666', light: '#c8c8c8', box: '#f4f4f4', navy: '#0c447c', head: '#e9eef4' };
    var pages = [], cur = null, y = 0, images = [];

    function yy(t) { return (PH - t).toFixed(2); }
    function text(s, x, yb, size, bold, color) {
      cur.ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + hexRgb(color) + ' rg ' +
        x.toFixed(2) + ' ' + yy(yb) + ' Td (' + esc(toBytes(s)) + ') Tj ET');
    }
    function line(x1, y1, x2, y2, w, color) {
      cur.ops.push(hexRgb(color) + ' RG ' + w + ' w ' + x1.toFixed(2) + ' ' + yy(y1) + ' m ' + x2.toFixed(2) + ' ' + yy(y2) + ' l S');
    }
    function rect(x, yt, w, h, fill, stroke) {
      var op = fill && stroke ? 'B' : (fill ? 'f' : 'S');
      cur.ops.push((fill ? hexRgb(fill) + ' rg ' : '') + (stroke ? hexRgb(stroke) + ' RG 0.6 w ' : '') +
        x.toFixed(2) + ' ' + yy(yt + h) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re ' + op);
    }
    function rrect(x, yt, w, h, r, fill) {
      var k = 0.5523 * r, X = x, Y = PH - yt - h;
      function f(n) { return n.toFixed(2); }
      cur.ops.push(hexRgb(fill) + ' rg ' + f(X + r) + ' ' + f(Y) + ' m ' +
        f(X + w - r) + ' ' + f(Y) + ' l ' +
        f(X + w - r + k) + ' ' + f(Y) + ' ' + f(X + w) + ' ' + f(Y + r - k) + ' ' + f(X + w) + ' ' + f(Y + r) + ' c ' +
        f(X + w) + ' ' + f(Y + h - r) + ' l ' +
        f(X + w) + ' ' + f(Y + h - r + k) + ' ' + f(X + w - r + k) + ' ' + f(Y + h) + ' ' + f(X + w - r) + ' ' + f(Y + h) + ' c ' +
        f(X + r) + ' ' + f(Y + h) + ' l ' +
        f(X + r - k) + ' ' + f(Y + h) + ' ' + f(X) + ' ' + f(Y + h - r + k) + ' ' + f(X) + ' ' + f(Y + h - r) + ' c ' +
        f(X) + ' ' + f(Y + r) + ' l ' +
        f(X) + ' ' + f(Y + r - k) + ' ' + f(X + r - k) + ' ' + f(Y) + ' ' + f(X + r) + ' ' + f(Y) + ' c h f');
    }
    function np(first) {
      cur = { ops: [], imgs: {} };
      pages.push(cur);
      if (first) {
        rect(0, 0, PW, 86, COL.navy, null);
        text(data.titulo, MX, 40, 22, true, '#ffffff');
        text(data.subtitulo, MX, 62, 11, false, '#cfdcec');
        y = 86 + 22;
      } else {
        text(data.cabecera || data.titulo, MX, 32, 8.5, false, COL.gray);
        line(MX, 40, MX + CW, 40, 0.5, COL.light);
        y = MT;
      }
    }
    function ensure(h) { if (y + h > PH - MB) { np(false); return true; } return false; }
    function usable() { return PH - MB - MT; }
    function section(title) {
      ensure(40);
      text(title, MX, y + 12, 12.5, true, COL.navy);
      line(MX, y + 19, MX + CW, y + 19, 0.8, COL.navy);
      y += 30;
    }
    function trunc(s, maxW, size, bold) {
      s = String(s).replace(/\s+/g, ' ').trim();
      if (textW(s, size, bold) <= maxW) return s;
      while (s.length > 1 && textW(s + '…', size, bold) > maxW) s = s.slice(0, -1);
      return s.replace(/\s+$/, '') + '…';
    }

    function drawFoto(f, bx, by) {
      var info = jpegInfo(f.bytes);
      images.push({ bytes: f.bytes, info: info });
      var idx = images.length, name = 'Im' + idx;
      cur.imgs[name] = idx;
      var s = Math.min((BW - 10) / info.w, (BH - 10) / info.h);
      var w = info.w * s, h = info.h * s;
      var x = bx + (BW - w) / 2, yt = by + (BH - h) / 2;
      cur.ops.push('q ' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' + x.toFixed(2) + ' ' + yy(yt + h) + ' cm /' + name + ' Do Q');
    }

    np(true);

    var meta = data.meta || [];
    var mh = 16 + Math.ceil(meta.length / 2) * 38;
    rect(MX, y, CW, mh, '#f7f7f7', '#cccccc');
    meta.forEach(function (m, i) {
      var cx = MX + 12 + (i % 2) * (CW / 2), cy = y + 12 + Math.floor(i / 2) * 38;
      text(m.k, cx, cy + 4, 8.5, true, COL.gray);
      text(trunc(m.v, CW / 2 - 24, 10.5, false), cx, cy + 19, 10.5, false, COL.text);
    });
    y += mh + 20;

    section('Resumen por tipo');
    var res = data.resumen, n = res.length, bw = (CW - (n - 1) * 8) / n, bh = 46;
    ensure(bh + 10);
    res.forEach(function (r, i) {
      var x = MX + i * (bw + 8);
      rect(x, y, bw, bh, '#f7f7f7', '#cccccc');
      text(r.label, x + 10, y + 16, 9, false, COL.gray);
      text(String(r.n), x + 10, y + 38, 18, true, r.color);
    });
    y += bh + 22;

    section('Índice de incidencias');
    var RH = 20;
    var cN = MX + 8, cH = MX + 38, cT = MX + 88, cZ = MX + 188, cD = MX + 300, cF = MX + CW - 8;
    function indexHead() {
      rect(MX, y, CW, RH, COL.head, null);
      text('Nº', cN, y + 14, 8.5, true, COL.gray);
      text('Hora', cH, y + 14, 8.5, true, COL.gray);
      text('Tipo', cT, y + 14, 8.5, true, COL.gray);
      text('Zona', cZ, y + 14, 8.5, true, COL.gray);
      text('Descripción', cD, y + 14, 8.5, true, COL.gray);
      var ft = 'Fotos';
      text(ft, cF - textW(ft, 8.5, true), y + 14, 8.5, true, COL.gray);
      y += RH;
    }
    ensure(RH * 2);
    indexHead();
    data.incidencias.forEach(function (inc) {
      if (ensure(RH)) indexHead();
      text(String(inc.numero), cN, y + 14, 9.5, true, COL.text);
      text(inc.hora, cH, y + 14, 9.5, false, COL.text);
      text(inc.tipoLabel, cT, y + 14, 9.5, true, inc.color);
      text(trunc(inc.zona, cD - cZ - 10, 9.5, false), cZ, y + 14, 9.5, false, COL.text);
      text(trunc(inc.texto, cF - 34 - cD, 9.5, false), cD, y + 14, 9.5, false, COL.gray);
      var nf = String((inc.fotos || []).length);
      text(nf, cF - textW(nf, 9.5, false), y + 14, 9.5, false, COL.text);
      line(MX, y + RH, MX + CW, y + RH, 0.4, '#dddddd');
      y += RH;
    });

    np(false);
    section('Detalle de incidencias');

    data.incidencias.forEach(function (inc) {
      var body = wrap(inc.texto, CW, 10.5, false);
      var fotos = inc.fotos || [];
      var rows = [];
      for (var i = 0; i < fotos.length; i += PERROW) rows.push(fotos.slice(i, i + PERROW));
      var HEAD = 46, LH = 14.5, ROWH = BH + 28;
      var total = HEAD + 14 + body.length * LH + (rows.length ? 26 + rows.length * ROWH : 0) + 14;

      if (total <= usable()) ensure(total);
      else ensure(HEAD + 14 + 2 * LH);

      line(MX, y, MX + CW, y, 0.5, COL.light);
      text('Incidencia nº ' + inc.numero, MX, y + 18, 12.5, true, COL.text);
      var dt = inc.fecha + '  ·  ' + inc.hora;
      text(dt, MX + CW - textW(dt, 10, false), y + 18, 10, false, COL.gray);
      var pw = textW(inc.tipoLabel, 9.5, true) + 16;
      rrect(MX, y + 26, pw, 16, 8, inc.bg);
      text(inc.tipoLabel, MX + 8, y + 37.5, 9.5, true, inc.color);
      text(inc.zona, MX + pw + 10, y + 38, 11, true, COL.text);
      y += HEAD;

      text('Descripción', MX, y + 8, 8.5, true, COL.gray);
      y += 14;
      body.forEach(function (l) {
        ensure(LH);
        if (l) text(l, MX, y + 11, 10.5, false, COL.text);
        y += LH;
      });

      if (rows.length) {
        ensure(26 + ROWH);
        text('Fotografías (' + fotos.length + ')', MX, y + 18, 8.5, true, COL.gray);
        y += 26;
        var cnt = 0;
        rows.forEach(function (row) {
          ensure(ROWH);
          var rowW = row.length * BW + (row.length - 1) * GAP;
          var x0 = MX + (CW - rowW) / 2;
          row.forEach(function (f, k) {
            var bx = x0 + k * (BW + GAP);
            rect(bx, y, BW, BH, COL.box, '#d0d0d0');
            drawFoto(f, bx, y);
            cnt++;
            var cap = 'Foto ' + cnt + ' de ' + fotos.length;
            text(cap, bx + (BW - textW(cap, 8.5, false)) / 2, y + BH + 13, 8.5, false, COL.gray);
          });
          y += ROWH;
        });
      }
      y += 16;
    });

    var total = pages.length;
    pages.forEach(function (p, i) {
      cur = p;
      var label = 'Página ' + (i + 1) + ' de ' + total;
      line(MX, PH - 42, MX + CW, PH - 42, 0.5, COL.light);
      text(data.pie || '', MX, PH - 28, 8.5, false, COL.gray);
      text(label, MX + CW - textW(label, 8.5, false), PH - 28, 8.5, false, COL.gray);
    });

    var objs = [];
    function add(parts) { objs.push(parts); return objs.length; }
    add(null); add(null);
    var F1 = add(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
    var F2 = add(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);

    var imgIds = images.map(function (im) {
      var cs = im.info.n === 1 ? '/DeviceGray' : '/DeviceRGB';
      var extra = '';
      if (im.info.n === 4) { cs = '/DeviceCMYK'; extra = ' /Decode [1 0 1 0 1 0 1 0]'; }
      return add(['<< /Type /XObject /Subtype /Image /Width ' + im.info.w + ' /Height ' + im.info.h +
        ' /ColorSpace ' + cs + extra +
        ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n', im.bytes, '\nendstream']);
    });

    var pageIds = pages.map(function (p) {
      var content = p.ops.join('\n');
      var cid = add(['<< /Length ' + content.length + ' >>\nstream\n', content, '\nendstream']);
      var xo = Object.keys(p.imgs).map(function (k) { return '/' + k + ' ' + imgIds[p.imgs[k] - 1] + ' 0 R'; }).join(' ');
      return add(['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /Font << /F1 ' + F1 +
        ' 0 R /F2 ' + F2 + ' 0 R >> /XObject << ' + xo + ' >> >> /Contents ' + cid + ' 0 R >>']);
    });

    objs[0] = ['<< /Type /Catalog /Pages 2 0 R >>'];
    objs[1] = ['<< /Type /Pages /Kids [' + pageIds.map(function (i) { return i + ' 0 R'; }).join(' ') + '] /Count ' + pageIds.length + ' >>'];
    var info = add(['<< /Title ' + hexUtf16(data.titulo) + ' /Author ' + hexUtf16(data.autor || '') + ' /Producer ' + hexUtf16('Incidencias noche') + ' >>']);

    var chunks = [], offsets = [], len = 0;
    function push(p) {
      if (typeof p === 'string') {
        var u = new Uint8Array(p.length);
        for (var i = 0; i < p.length; i++) u[i] = p.charCodeAt(i) & 255;
        chunks.push(u); len += u.length;
      } else { chunks.push(p); len += p.length; }
    }
    push('%PDF-1.4\n%âãÏÓ\n');
    objs.forEach(function (parts, i) {
      offsets[i] = len;
      push((i + 1) + ' 0 obj\n');
      parts.forEach(push);
      push('\nendobj\n');
    });
    var xref = len;
    var x = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach(function (o) { x += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    push(x + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');

    var out = new Uint8Array(len), pos = 0;
    chunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }

  var api = { build: build, _tables: { REG: REG, BOLD: BOLD } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PdfResumen = api;
})(typeof window !== 'undefined' ? window : globalThis);
