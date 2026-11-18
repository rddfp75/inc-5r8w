(function () {
  'use strict';

  var AUTOR = 'Rubén';
  var TIPOS = [
    { id: 'incidencia', label: 'Incidencia', color: '#a32d2d', bg: '#fcebeb' },
    { id: 'limpieza', label: 'Limpieza', color: '#185fa5', bg: '#e6f1fb' },
    { id: 'procedimiento', label: 'Procedimiento', color: '#854f0b', bg: '#faeeda' },
    { id: 'informacion', label: 'Información', color: '#3b6d11', bg: '#eaf3de' }
  ];
  var MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var ZONAS = ['Despiece', 'DACOR', 'Matadero', 'Vísceras rojas', 'Vísceras blancas', 'Zona limpia',
    'Accesos', 'Vestuarios', 'Lavadoras', 'CS3', 'Expedición'];
  var OTRA = 'Otra…';
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    camera: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    check: '<path d="M5 12l5 5 9-10"/>'
  };

  var app = document.getElementById('app');
  var state = { view: 'list', incs: [], draft: null, cierre: null, error: null };

  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  function icon(name) {
    var s = h('span', { class: 'svg', 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';
    return s;
  }
  function tipo(id) { return TIPOS.filter(function (t) { return t.id === id; })[0] || TIPOS[0]; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ts) { var d = new Date(ts); return p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function ddmmyyyy(ts) { var d = new Date(ts); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function isoDate(ts) { var d = new Date(ts); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }

  function nightLabel(incs) {
    if (!incs.length) return 'Noche nueva';
    var first = incs.reduce(function (m, i) { return Math.min(m, i.ts); }, Infinity);
    var d = new Date(first), hr = d.getHours();
    var noche = hr >= 18 || hr < 6;
    if (hr < 6) d = new Date(first - 24 * 3600 * 1000);
    return (noche ? 'Noche del ' : 'Turno del ') + d.getDate() + ' ' + MESES[d.getMonth()];
  }
  function nightTitle(incs) {
    var first = incs.reduce(function (m, i) { return Math.min(m, i.ts); }, Infinity);
    var d = new Date(first), hr = d.getHours();
    var noche = hr >= 18 || hr < 6;
    if (hr < 6) d = new Date(first - 24 * 3600 * 1000);
    return (noche ? 'Noche del ' : 'Turno del ') + d.getDate() + ' de ' + MESES_LARGO[d.getMonth()] + ' de ' + d.getFullYear();
  }
  function countFotos(incs) { return incs.reduce(function (n, i) { return n + (i.fotos || []).length; }, 0); }

  var dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise(function (res, rej) {
        if (!window.indexedDB) { rej(new Error('Este navegador no permite guardar datos.')); return; }
        var r = indexedDB.open('incidencias-noche', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('inc', { keyPath: 'id' }); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    }
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('inc', mode), out = fn(t.objectStore('inc'));
        t.oncomplete = function () { res(out && 'result' in out ? out.result : undefined); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error || new Error('No se pudo guardar.')); };
      });
    });
  }
  function loadAll() {
    return tx('readonly', function (s) { return s.getAll(); }).then(function (all) {
      state.incs = (all || []).sort(function (a, b) { return a.ts - b.ts; });
    });
  }

  function procesarFoto(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1280, w = img.naturalWidth, hh = img.naturalHeight, s = Math.min(1, max / Math.max(w, hh));
        var cw = Math.round(w * s), ch = Math.round(hh * s);
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        var g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, cw, ch);
        g.drawImage(img, 0, 0, cw, ch);
        c.toBlob(function (b) {
          URL.revokeObjectURL(url);
          if (!b) { rej(new Error('No se pudo procesar la foto.')); return; }
          b.arrayBuffer().then(function (buf) { res({ buf: buf, w: cw, h: ch }); }, rej);
        }, 'image/jpeg', 0.72);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la foto.')); };
      img.src = url;
    });
  }
  function fotoUrl(f) { return URL.createObjectURL(new Blob([f.buf], { type: 'image/jpeg' })); }

  function go(view) { state.view = view; state.error = null; render(); window.scrollTo(0, 0); }

  function render() {
    app.innerHTML = '';
    if (state.view === 'form') app.appendChild(viewForm());
    else if (state.view === 'close') app.appendChild(viewClose());
    else app.appendChild(viewList());
  }

  function viewList() {
    var incs = state.incs;
    var root = h('div', { class: 'list', style: 'display:flex;flex-direction:column;flex:1' });
    root.appendChild(h('div', { class: 'top' },
      h('h1', { text: nightLabel(incs) }),
      h('span', { class: 'sub', text: incs.length + (incs.length === 1 ? ' incidencia' : ' incidencias') })));
    var body;
    if (!incs.length) {
      body = h('div', { class: 'card empty' },
        h('h2', { text: 'Todavía no hay nada apuntado' }),
        h('div', { text: 'Pulsa "Añadir incidencia" cuando veas algo. Se guarda en el móvil con su hora.' }));
    } else {
      body = h('div', { class: 'card', style: 'padding:6px 12px' }, incs.map(function (i) {
        var t = tipo(i.tipo), nf = (i.fotos || []).length;
        return h('div', { class: 'row', onclick: function () { openForm(i); } },
          h('div', { class: 'hora', text: hhmm(i.ts) }),
          h('div', { class: 'main' },
            h('div', { class: 'l1' }, h('span', { class: 'badge t-' + t.id, text: t.label }), h('span', { class: 'zona', text: i.zona })),
            h('div', { class: 'txt', text: i.texto })),
          nf ? h('div', { class: 'ph' }, icon('image'), String(nf)) : null);
      }));
    }
    root.appendChild(body);
    if (state.error) root.appendChild(h('div', { class: 'msg warn', text: state.error }));
    root.appendChild(h('div', { style: 'flex:1' }));
    root.appendChild(h('div', { class: 'bar' },
      h('button', { class: 'primary', onclick: function () { openForm(null); } }, icon('plus'), 'Añadir incidencia'),
      h('button', { onclick: function () {
        if (!state.incs.length) { state.error = 'No hay incidencias que enviar.'; render(); return; }
        state.cierre = { fase: 'inicio', msg: null }; go('close');
      } }, icon('file'), 'Cerrar noche')));
    return root;
  }

  function openForm(rec) {
    var last = '';
    try { last = localStorage.getItem('ultimaZona') || ''; } catch (e) { }
    if (rec) {
      state.draft = { id: rec.id, ts: rec.ts, tipo: rec.tipo, zona: rec.zona, texto: rec.texto, fotos: (rec.fotos || []).slice() };
    } else {
      state.draft = { id: null, ts: Date.now(), tipo: 'incidencia', zona: last || ZONAS[0], texto: '', fotos: [] };
    }
    go('form');
  }

  function viewForm() {
    var d = state.draft, editing = !!d.id;
    var urls = [];
    var enZonas = ZONAS.indexOf(d.zona) >= 0;
    var root = h('div', { style: 'flex:1;display:flex;flex-direction:column' });

    var errBox = h('div', { class: 'err' });
    var chips = h('div', { class: 'chips' });
    function drawChips() {
      chips.innerHTML = '';
      TIPOS.forEach(function (t) {
        chips.appendChild(h('span', { class: 'chip t-' + t.id + (d.tipo === t.id ? ' on' : ''), text: t.label, role: 'button',
          onclick: function () { d.tipo = t.id; drawChips(); } }));
      });
    }
    drawChips();

    var time = h('input', { type: 'time', value: hhmm(d.ts) });
    var sel = h('select', {}, ZONAS.concat([OTRA]).map(function (z) {
      return h('option', { value: z, text: z, selected: (enZonas ? z === d.zona : z === OTRA) ? 'selected' : false });
    }));
    var otra = h('input', { type: 'text', placeholder: 'Escribe la zona', value: enZonas ? '' : d.zona, style: enZonas ? 'display:none;margin-top:8px' : 'margin-top:8px' });
    sel.addEventListener('change', function () { otra.style.display = sel.value === OTRA ? '' : 'none'; });
    var txt = h('textarea', { placeholder: 'Qué has visto y dónde' });
    txt.value = d.texto;

    var thumbs = h('div', { class: 'thumbs' });
    var status = h('div', { class: 'sub' });
    function drawThumbs() {
      urls.forEach(function (u) { URL.revokeObjectURL(u); });
      urls = [];
      thumbs.innerHTML = '';
      d.fotos.forEach(function (f, i) {
        var u = fotoUrl(f); urls.push(u);
        thumbs.appendChild(h('div', { class: 'thumb' }, h('img', { src: u, alt: 'Foto ' + (i + 1) }),
          h('button', { 'aria-label': 'Quitar foto', onclick: function () { d.fotos.splice(i, 1); drawThumbs(); } }, icon('x'))));
      });
    }
    drawThumbs();

    function addFiles(files) {
      var list = Array.prototype.slice.call(files || []);
      if (!list.length) return;
      status.textContent = 'Procesando fotos…';
      var chain = Promise.resolve();
      list.forEach(function (f) {
        chain = chain.then(function () { return procesarFoto(f).then(function (r) { d.fotos.push(r); drawThumbs(); }); });
      });
      chain.then(function () { status.textContent = ''; }, function (e) { status.textContent = ''; errBox.textContent = e.message; });
    }
    var inCam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
    var inGal = h('input', { type: 'file', accept: 'image/*', multiple: 'multiple', style: 'display:none' });
    inCam.addEventListener('change', function () { addFiles(inCam.files); inCam.value = ''; });
    inGal.addEventListener('change', function () { addFiles(inGal.files); inGal.value = ''; });

    var saving = false;
    var saveBtn = h('button', { class: 'primary full', onclick: function () {
      if (saving) return;
      var texto = txt.value.trim();
      if (!texto) { errBox.textContent = 'Escribe qué has visto.'; txt.focus(); return; }
      var zona = sel.value === OTRA ? otra.value.trim() : sel.value;
      if (!zona) { errBox.textContent = 'Escribe la zona.'; otra.focus(); return; }
      var parts = (time.value || hhmm(d.ts)).split(':');
      var dt = new Date(d.ts);
      dt.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      var ts = dt.getTime();
      if (!editing && ts > Date.now() + 5 * 60 * 1000) ts -= 24 * 3600 * 1000;
      var rec = { id: d.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)), ts: ts, tipo: d.tipo, zona: zona, texto: texto, fotos: d.fotos };
      saving = true;
      tx('readwrite', function (s) { return s.put(rec); }).then(loadAll).then(function () {
        try { localStorage.setItem('ultimaZona', zona); } catch (e) { }
        urls.forEach(function (u) { URL.revokeObjectURL(u); });
        saving = false; go('list');
      }, function (e) { saving = false; errBox.textContent = 'No se pudo guardar: ' + (e && e.message ? e.message : 'error'); });
    } }, icon('check'), 'Guardar incidencia');

    root.appendChild(h('div', { class: 'top' },
      h('button', { class: 'link back', onclick: function () { urls.forEach(function (u) { URL.revokeObjectURL(u); }); go('list'); } }, icon('back'), 'Volver'),
      h('h2', { text: editing ? 'Editar incidencia' : 'Nueva incidencia' }),
      h('span', { style: 'min-width:60px' })));
    root.appendChild(h('div', { class: 'card' },
      h('label', { text: 'Hora', style: 'margin-top:0' }), time,
      h('label', { text: 'Tipo' }), chips,
      h('label', { text: 'Zona' }), sel, otra,
      h('label', { text: 'Descripción' }), txt,
      h('label', { text: 'Fotos' }), thumbs,
      h('div', { class: 'two' },
        h('button', { onclick: function () { inCam.click(); } }, icon('camera'), 'Hacer foto'),
        h('button', { onclick: function () { inGal.click(); } }, icon('image'), 'Galería')),
      inCam, inGal, status, errBox));
    root.appendChild(h('div', { class: 'gap' }));
    root.appendChild(saveBtn);
    if (editing) {
      root.appendChild(h('button', { class: 'link danger full', style: 'margin-top:8px', onclick: function () {
        if (!window.confirm('¿Eliminar esta incidencia?')) return;
        tx('readwrite', function (s) { return s.delete(d.id); }).then(loadAll).then(function () { go('list'); });
      } }, icon('trash'), 'Eliminar incidencia'));
    }
    root.appendChild(h('div', { style: 'height:24px' }));
    return root;
  }

  function buildPdf() {
    var incs = state.incs.slice().sort(function (a, b) { return a.ts - b.ts; });
    var first = incs[0].ts, last = incs[incs.length - 1].ts;
    var counts = {};
    incs.forEach(function (i) { counts[i.tipo] = (counts[i.tipo] || 0) + 1; });
    var nf = countFotos(incs);
    var ahora = Date.now();
    var data = {
      titulo: 'Resumen de incidencias',
      subtitulo: nightTitle(incs),
      cabecera: 'Resumen de incidencias · ' + ddmmyyyy(first),
      autor: AUTOR,
      pie: 'Incidencias noche · ' + AUTOR,
      meta: [
        { k: 'Periodo', v: ddmmyyyy(first) + ' ' + hhmm(first) + ' – ' + ddmmyyyy(last) + ' ' + hhmm(last) },
        { k: 'Elaborado por', v: AUTOR },
        { k: 'Generado el', v: ddmmyyyy(ahora) + ' ' + hhmm(ahora) },
        { k: 'Contenido', v: incs.length + (incs.length === 1 ? ' incidencia' : ' incidencias') + ' · ' + nf + (nf === 1 ? ' foto' : ' fotos') }
      ],
      resumen: TIPOS.map(function (t) { return { label: t.label, n: counts[t.id] || 0, color: t.color }; }),
      incidencias: incs.map(function (i, idx) {
        var t = tipo(i.tipo);
        return { numero: idx + 1, fecha: ddmmyyyy(i.ts), hora: hhmm(i.ts), tipoLabel: t.label, color: t.color, bg: t.bg,
          zona: i.zona, texto: i.texto,
          fotos: (i.fotos || []).map(function (f) { return { bytes: new Uint8Array(f.buf) }; }) };
      })
    };
    var bytes = window.PdfResumen.build(data);
    return new File([bytes], 'Incidencias_noche_' + isoDate(first) + '.pdf', { type: 'application/pdf' });
  }

  function descargar(file) {
    var u = URL.createObjectURL(file), a = document.createElement('a');
    a.href = u; a.download = file.name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 4000);
  }

  function nuevaNoche() {
    return tx('readwrite', function (s) { return s.clear(); }).then(loadAll).then(function () { state.cierre = null; go('list'); });
  }

  function viewClose() {
    var incs = state.incs, c = state.cierre || { fase: 'inicio' };
    var counts = {};
    incs.forEach(function (i) { counts[i.tipo] = (counts[i.tipo] || 0) + 1; });
    var root = h('div', { style: 'flex:1;display:flex;flex-direction:column' });
    root.appendChild(h('div', { class: 'top' },
      h('button', { class: 'link back', onclick: function () { go('list'); } }, icon('back'), 'Volver'),
      h('h2', { text: 'Cerrar noche' }), h('span', { style: 'min-width:60px' })));

    var card = h('div', { class: 'card' });
    card.appendChild(h('div', { class: 'sub', text: nightLabel(incs) }));
    card.appendChild(h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('div', { class: 'k', text: 'Incidencias' }), h('div', { class: 'n', text: String(incs.length) })),
      h('div', { class: 'stat' }, h('div', { class: 'k', text: 'Fotos' }), h('div', { class: 'n', text: String(countFotos(incs)) }))));
    card.appendChild(h('div', { class: 'chips', style: 'margin-bottom:12px' }, TIPOS.map(function (t) {
      return h('span', { class: 'badge t-' + t.id, text: t.label + ' ' + (counts[t.id] || 0) });
    })));
    card.appendChild(h('div', { class: 'sub', text: 'Se genera un PDF con todas las incidencias, sus horas y sus fotos. Se abre el menú de compartir con el PDF adjunto para que lo mandes por correo.' }));
    root.appendChild(card);

    if (c.msg) root.appendChild(h('div', { class: 'msg' + (c.warn ? ' warn' : ''), text: c.msg }));

    if (c.fase === 'confirmar') {
      root.appendChild(h('div', { class: 'card', style: 'margin-top:12px' },
        h('h2', { text: '¿Has enviado el correo?' }),
        h('div', { class: 'sub', style: 'margin:6px 0 12px', text: 'La noche no se borra hasta que lo confirmes.' }),
        h('div', { class: 'two' },
          h('button', { class: 'primary', onclick: function () { nuevaNoche(); } }, 'Sí, noche nueva'),
          h('button', { onclick: function () { state.cierre = { fase: 'inicio', msg: 'La noche sigue guardada.' }; render(); } }, 'No, conservar'))));
    }

    root.appendChild(h('div', { style: 'flex:1;min-height:12px' }));
    root.appendChild(h('button', { class: 'primary full', style: 'margin-top:12px', onclick: function () {
      var file;
      try { file = buildPdf(); } catch (e) { state.cierre = { fase: 'inicio', msg: 'No se pudo crear el PDF: ' + e.message, warn: true }; render(); return; }
      var canShare = navigator.canShare && navigator.share && navigator.canShare({ files: [file] });
      if (canShare) {
        navigator.share({ files: [file], title: 'Resumen de incidencias', text: 'Resumen de incidencias de la noche' }).then(function () {
          state.cierre = { fase: 'confirmar', msg: null }; render();
        }, function (e) {
          if (e && e.name === 'AbortError') state.cierre = { fase: 'inicio', msg: 'No se ha enviado. La noche sigue guardada.', warn: true };
          else { descargar(file); state.cierre = { fase: 'confirmar', msg: 'No se pudo abrir el menú de compartir. Se ha descargado el PDF.', warn: true }; }
          render();
        });
      } else {
        descargar(file);
        state.cierre = { fase: 'confirmar', msg: 'Este navegador no permite compartir. Se ha descargado el PDF.', warn: true }; render();
      }
    } }, icon('mail'), 'Generar PDF y enviar por correo'));
    root.appendChild(h('div', { class: 'two', style: 'margin-top:8px' },
      h('button', { onclick: function () {
        try { descargar(buildPdf()); state.cierre = { fase: 'inicio', msg: 'PDF guardado en el móvil.' }; }
        catch (e) { state.cierre = { fase: 'inicio', msg: 'No se pudo crear el PDF: ' + e.message, warn: true }; }
        render();
      } }, icon('download'), 'Guardar PDF'),
      h('button', { class: 'danger', onclick: function () {
        if (window.confirm('¿Borrar todas las incidencias y empezar una noche nueva?')) nuevaNoche();
      } }, icon('trash'), 'Borrar noche')));
    root.appendChild(h('div', { style: 'height:calc(env(safe-area-inset-bottom) + 20px)' }));
    return root;
  }

  function init() {
    if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { } }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
    }
    loadAll().then(render, function (e) {
      app.innerHTML = '';
      app.appendChild(h('div', { class: 'card', style: 'margin-top:20px' }, h('h2', { text: 'No se puede guardar aquí' }),
        h('div', { class: 'sub', text: (e && e.message) || 'Abre la app desde Safari o desde el icono de la pantalla de inicio.' })));
    });
  }
  init();
})();
