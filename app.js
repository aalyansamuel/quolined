/* =============================================================
   Diario de una línea · app.js
   Vanilla JS, sin dependencias.
   Datos: IndexedDB (plan B: localStorage) · PWA: sw.js
   Modelo de una entrada (la fecha es la clave única):
   { fecha: "2026-11-04", texto: "...", animo: "🙂", etiquetas: [], foto: false,
     creado: ISO, editado: ISO }   (la foto se guarda aparte, como Blob)
   ============================================================= */
(() => {
  'use strict';

  /* ---------- Constantes ---------- */
  const APP_ID = 'diario-una-linea';
  const VERSION = '1.1.0';
  const MAX = 200;
  const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
  const MOOD_NAMES = ['Mal', 'Regular', 'Normal', 'Bien', 'Genial'];
  const TABS = ['hoy', 'calendario', 'archivo', 'ajustes'];
  const PREVIEW = window.__DUL_PREVIEW === true;
  const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const media = q => (window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {} });
  const MQ_STANDALONE = media('(display-mode: standalone)');
  const MQ_COARSE = media('(pointer: coarse)');
  const MQ_DARK = media('(prefers-color-scheme: dark)');
  const MQ_REDUCE = media('(prefers-reduced-motion: reduce)');
  const isStandalone = () => MQ_STANDALONE.matches || navigator.standalone === true;

  /* ---------- Utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const NF = new Intl.NumberFormat('es-ES');
  const num = n => NF.format(n);
  const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many}`;

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(k));
    return n;
  }

  /* ---------- Iconos (trazos de 24 px) ---------- */
  const svg = (d, w = 1.8) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  const ICON = {
    hoy: svg('<path d="M4 20.5h16"/><path d="M14.7 4.3a2.1 2.1 0 0 1 3 3L9.4 15.6l-3.9.9.9-3.9z"/>'),
    calendario: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.4h.01M12 17.4h.01" stroke-width="2.6"/>'),
    archivo: svg('<path d="M5 6h14M5 10.5h14M5 15h10M5 19.5h6"/>'),
    ajustes: svg('<path d="M4 7.5h8.5M17.5 7.5H20M4 16.5h2.5M11.5 16.5H20"/><circle cx="15" cy="7.5" r="2.5"/><circle cx="9" cy="16.5" r="2.5"/>'),
    camera: svg('<path d="M4 8.6A2.6 2.6 0 0 1 6.6 6h1.6l1.4-2h4.8l1.4 2h1.6A2.6 2.6 0 0 1 20 8.6v7.8a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 16.4z"/><circle cx="12" cy="12.4" r="3.4"/>'),
    x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 2),
    chevR: svg('<path d="M9.5 5.5L16 12l-6.5 6.5"/>', 2),
    chevL: svg('<path d="M14.5 5.5L8 12l6.5 6.5"/>', 2),
    search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>'),
    sort: svg('<path d="M8 4.5v15M4.5 16l3.5 3.5 3.5-3.5M16 19.5v-15M12.5 8L16 4.5 19.5 8"/>'),
    lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>'),
    del: svg('<path d="M20.5 6.5H9.2L3.8 12l5.4 5.5h11.3z"/><path d="M12.6 9.8l4.4 4.4M17 9.8l-4.4 4.4"/>'),
    check: svg('<path d="M5 12.5l4.3 4.3L19 7.2"/>', 2),
    sparkle: svg('<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
    share: svg('<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M7 10.5H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/>'),
    copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>'),
    pencil: svg('<path d="M14.7 4.3a2.1 2.1 0 0 1 3 3L8 17l-4 1 1-4z"/>'),
    trash: svg('<path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.9 11.2a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8L17.5 7"/>')
  };

  /* ---------- Fechas ---------- */
  const pad2 = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const todayIso = () => isoOf(new Date());
  const addDays = (iso, n) => { const d = parseIso(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  const addMonths = (iso, n) => {
    const d = parseIso(iso);
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d.getDate(), last));
    return isoOf(t);
  };
  const isValidIso = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isoOf(parseIso(s)) === s;
  const diffDays = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 864e5);
  const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysInYear = y => (isLeap(y) ? 366 : 365);
  const dayOfYear = iso => diffDays(`${iso.slice(0, 4)}-01-01`, iso) + 1;

  const DTF = o => new Intl.DateTimeFormat('es-ES', o);
  const F = {
    weekday: DTF({ weekday: 'long' }),
    dm: DTF({ day: 'numeric', month: 'long' }),
    dmy: DTF({ day: 'numeric', month: 'long', year: 'numeric' }),
    full: DTF({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    short: DTF({ day: 'numeric', month: 'short' }),
    shortY: DTF({ day: 'numeric', month: 'short', year: 'numeric' }),
    month: DTF({ month: 'long' }),
    wd: DTF({ weekday: 'short' })
  };
  const MONTHS = Array.from({ length: 12 }, (_, i) => F.month.format(new Date(2026, i, 1, 12)));
  const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const RTF = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

  function fmtShort(iso) {
    const d = parseIso(iso);
    const sameYear = d.getFullYear() === parseIso(ui.today).getFullYear();
    return (sameYear ? F.short : F.shortY).format(d).replace(/\./g, '');
  }
  function relLabel(iso) {
    const n = diffDays(iso, ui.today);
    if (n <= 0) return 'Hoy';
    if (n < 7) return cap(RTF.format(-n, 'day'));
    if (n < 30) return cap(RTF.format(-Math.round(n / 7), 'week'));
    if (n < 365) return cap(RTF.format(-Math.max(1, Math.round(n / 30.44)), 'month'));
    return cap(RTF.format(-Math.max(1, Math.round(n / 365.25)), 'year'));
  }

  /* ---------- Texto ---------- */
  const SEG = Intl.Segmenter ? new Intl.Segmenter('es', { granularity: 'grapheme' }) : null;
  function glen(s) {
    if (!s) return 0;
    if (!SEG) return Array.from(s).length;
    let n = 0;
    for (const _ of SEG.segment(s)) n++; // eslint-disable-line no-unused-vars
    return n;
  }
  function gcut(s, max) {
    if (!SEG) return Array.from(s).slice(0, max).join('');
    let out = '', n = 0;
    for (const { segment } of SEG.segment(s)) { if (n++ >= max) break; out += segment; }
    return out;
  }
  const oneLine = s => String(s || '').replace(/[\r\n\t\v\f\u2028\u2029]+/g, ' ');
  const cleanText = s => oneLine(s).replace(/ {2,}/g, ' ').trim();
  const fold = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const TAG_RX = /(^|[^\p{L}\p{N}_&#])#([\p{L}\p{N}_]+(?:-[\p{L}\p{N}_]+)*)/gu;
  const WORD_RX = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

  function parseTags(t) {
    const out = [];
    for (const m of String(t || '').matchAll(TAG_RX)) {
      const tag = m[2].toLowerCase();
      if (!out.includes(tag)) out.push(tag);
    }
    return out;
  }
  function findHits(text, terms) {
    if (!terms || !terms.length) return [];
    let norm = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const f = fold(text[i]);
      for (let k = 0; k < f.length; k++) { norm += f[k]; map.push(i); }
    }
    map.push(text.length);
    const hits = [];
    for (const t of terms) {
      if (!t) continue;
      let at = norm.indexOf(t);
      while (at !== -1) {
        hits.push({ start: map[at], end: map[at + t.length - 1] + 1 });
        at = norm.indexOf(t, at + t.length);
      }
    }
    return hits;
  }
  /* Texto con #etiquetas resaltadas y coincidencias de búsqueda marcadas */
  function richText(text, terms) {
    const tags = [];
    for (const m of text.matchAll(TAG_RX)) {
      const start = m.index + m[1].length;
      tags.push({ start, end: start + 1 + m[2].length });
    }
    const hits = findHits(text, terms);
    if (!tags.length && !hits.length) return esc(text);
    const points = new Set([0, text.length]);
    for (const r of tags.concat(hits)) { points.add(r.start); points.add(r.end); }
    const cuts = Array.from(points).sort((a, b) => a - b);
    let html = '';
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (a === b) continue;
      let chunk = esc(text.slice(a, b));
      if (hits.some(r => r.start <= a && r.end >= b)) chunk = `<mark>${chunk}</mark>`;
      if (tags.some(r => r.start <= a && r.end >= b)) chunk = `<span class="tag">${chunk}</span>`;
      html += chunk;
    }
    return html;
  }

  const STOP = new Set(('a al algo alguien algun alguna algunas alguno algunos alli ante antes aqui aquel aquella aquellas aquello aquellos asi aun aunque ayer bajo bastante bien cada casi como con contra cosa cosas cual cuales cualquier cuando cuanto de del desde despues dia dias donde dos durante e el ella ellas ello ellos en entre era eramos eran eras eres es esa esas ese eso esos esta estaba estabamos estaban estado estais estamos estan estar estas este esto estos estoy estuve estuvo fue fuera fueron fui fuimos ha haber habia habian habra hace hacer hacia hago han has hasta hay haya he hecho hemos hice hizo hoy hubo ido la las le les lo los luego mas me mi mia mias mio mios mis misma mismo mucha muchas mucho muchos muy nada nadie ni no nos nosotras nosotros nuestra nuestras nuestro nuestros nunca o os otra otras otro otros para pero poco pocos por porque pues que quien quienes se sea sean segun ser si sido siempre sin sobre sois solo somos son soy su sus suya suyas suyo suyos tal tambien tan tanto tantos te tenemos tener tengo ti tiene tienen toda todas todavia todo todos tras tu tus tuve tuvo tuya tuyas tuyo tuyos un una unas uno unos usted ustedes va vamos van vez veces vosotras vosotros vuestra vuestro y ya yo manana tarde noche hoy').split(' '));

  function wordsOf(text) {
    const plain = String(text || '').replace(TAG_RX, '$1');
    const out = [];
    for (const m of plain.matchAll(WORD_RX)) {
      const w = m[0].toLowerCase();
      if (w.length < 3 || /^\d+$/.test(w) || STOP.has(fold(w))) continue;
      out.push(w);
    }
    return out;
  }
  const countWords = text => (String(text || '').replace(TAG_RX, '$1').match(WORD_RX) || []).length;

  /* ---------- Blobs y fotos ---------- */
  const blobToDataUrl = b => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
  function dataUrlToBlob(d) {
    const i = d.indexOf(',');
    const head = d.slice(0, i), body = d.slice(i + 1);
    const mime = (head.match(/^data:([^;,]+)/) || [])[1] || 'image/jpeg';
    if (!/;base64$/i.test(head)) return new Blob([decodeURIComponent(body)], { type: mime });
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    return new Blob([arr], { type: mime });
  }
  async function compressImage(file, max = 1280, quality = 0.82) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('formato'));
        i.src = url;
      });
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', quality));
      if (!blob) throw new Error('canvas');
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ---------- Almacenamiento ---------- */
  const Store = (() => {
    const DB = 'diario-una-linea';
    const VER = 2; // v2: almacén «frases» (frase del día)
    const LS_E = 'dul.entradas', LS_M = 'dul.meta', LS_F = 'dul.foto.', LS_FR = 'dul.frases';
    const mem = { entradas: new Map(), fotos: new Map(), meta: new Map(), frases: new Map() };
    let db = null;
    let mode = 'memory';
    const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const done = tx => new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error('abort'));
    });
    function open() {
      return new Promise((res, rej) => {
        let r;
        try { r = indexedDB.open(DB, VER); } catch (e) { rej(e); return; }
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('entradas')) d.createObjectStore('entradas', { keyPath: 'fecha' });
          if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos');
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
          if (!d.objectStoreNames.contains('frases')) d.createObjectStore('frases', { keyPath: 'fecha' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        // Si otra pestaña tiene abierta la versión anterior, se espera a que la cierre
        r.onblocked = () => {};
        setTimeout(() => rej(new Error('timeout')), 8000);
      });
    }
    function lsOk() {
      try { localStorage.setItem('dul.t', '1'); localStorage.removeItem('dul.t'); return true; } catch { return false; }
    }
    function lsLoad() {
      try {
        JSON.parse(localStorage.getItem(LS_E) || '[]').forEach(e => mem.entradas.set(e.fecha, e));
        Object.entries(JSON.parse(localStorage.getItem(LS_M) || '{}')).forEach(([k, v]) => mem.meta.set(k, v));
        JSON.parse(localStorage.getItem(LS_FR) || '[]').forEach(f => mem.frases.set(f.fecha, f));
      } catch { /* datos corruptos: se ignoran */ }
    }
    function lsSave() {
      if (mode !== 'local') return;
      localStorage.setItem(LS_E, JSON.stringify(Array.from(mem.entradas.values())));
      localStorage.setItem(LS_M, JSON.stringify(Object.fromEntries(mem.meta)));
      localStorage.setItem(LS_FR, JSON.stringify(Array.from(mem.frases.values())));
    }
    function lsDropPhotos() {
      try { Object.keys(localStorage).filter(k => k.startsWith(LS_F)).forEach(k => localStorage.removeItem(k)); } catch { /* nada */ }
    }
    return {
      get mode() { return mode; },
      async init() {
        try {
          if (!window.indexedDB) throw new Error('sin IndexedDB');
          db = await open();
          db.onversionchange = () => db.close();
          mode = 'idb';
        } catch {
          mode = lsOk() ? 'local' : 'memory';
          if (mode === 'local') lsLoad();
        }
        return mode;
      },
      async all() {
        if (mode === 'idb') return req(db.transaction('entradas').objectStore('entradas').getAll());
        return Array.from(mem.entradas.values());
      },
      async put(e) {
        if (mode === 'idb') { const tx = db.transaction('entradas', 'readwrite'); tx.objectStore('entradas').put(e); return done(tx); }
        mem.entradas.set(e.fecha, e); lsSave();
      },
      async del(f) {
        if (mode === 'idb') {
          const tx = db.transaction(['entradas', 'fotos'], 'readwrite');
          tx.objectStore('entradas').delete(f);
          tx.objectStore('fotos').delete(f);
          return done(tx);
        }
        mem.entradas.delete(f); mem.fotos.delete(f);
        try { localStorage.removeItem(LS_F + f); } catch { /* nada */ }
        lsSave();
      },
      async getFoto(f) {
        if (mode === 'idb') return req(db.transaction('fotos').objectStore('fotos').get(f));
        if (mem.fotos.has(f)) return mem.fotos.get(f);
        if (mode === 'local') {
          try { const d = localStorage.getItem(LS_F + f); if (d) { const b = dataUrlToBlob(d); mem.fotos.set(f, b); return b; } } catch { /* nada */ }
        }
        return null;
      },
      async putFoto(f, blob) {
        if (mode === 'idb') { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put(blob, f); return done(tx); }
        mem.fotos.set(f, blob);
        if (mode === 'local') { try { localStorage.setItem(LS_F + f, await blobToDataUrl(blob)); } catch { /* sin espacio: solo en memoria */ } }
      },
      async delFoto(f) {
        if (mode === 'idb') { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').delete(f); return done(tx); }
        mem.fotos.delete(f);
        try { localStorage.removeItem(LS_F + f); } catch { /* nada */ }
      },
      async getMeta(k) {
        if (mode === 'idb') return req(db.transaction('meta').objectStore('meta').get(k));
        return mem.meta.get(k);
      },
      async setMeta(k, v) {
        if (mode === 'idb') { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); return done(tx); }
        mem.meta.set(k, v); lsSave();
      },
      async allFrases() {
        if (mode === 'idb') return req(db.transaction('frases').objectStore('frases').getAll());
        return Array.from(mem.frases.values());
      },
      async putFrase(f) {
        if (mode === 'idb') { const tx = db.transaction('frases', 'readwrite'); tx.objectStore('frases').put(f); return done(tx); }
        mem.frases.set(f.fecha, f); lsSave();
      },
      async bulk(list, fotos, replace, frasesList = [], replaceFrases = false) {
        if (mode === 'idb') {
          const tx = db.transaction(['entradas', 'fotos', 'frases'], 'readwrite');
          const es = tx.objectStore('entradas'), fs = tx.objectStore('fotos'), frs = tx.objectStore('frases');
          if (replace) { es.clear(); fs.clear(); }
          if (replaceFrases) frs.clear();
          list.forEach(e => es.put(e));
          fotos.forEach((b, f) => fs.put(b, f));
          frasesList.forEach(f => frs.put(f));
          return done(tx);
        }
        if (replace) { mem.entradas.clear(); mem.fotos.clear(); lsDropPhotos(); }
        if (replaceFrases) mem.frases.clear();
        list.forEach(e => mem.entradas.set(e.fecha, e));
        frasesList.forEach(f => mem.frases.set(f.fecha, f));
        for (const [f, b] of fotos) await this.putFoto(f, b);
        lsSave();
      },
      async clear() {
        if (mode === 'idb') {
          const tx = db.transaction(['entradas', 'fotos', 'meta', 'frases'], 'readwrite');
          ['entradas', 'fotos', 'meta', 'frases'].forEach(s => tx.objectStore(s).clear());
          return done(tx);
        }
        mem.entradas.clear(); mem.fotos.clear(); mem.meta.clear(); mem.frases.clear();
        try { Object.keys(localStorage).filter(k => k.startsWith('dul.')).forEach(k => localStorage.removeItem(k)); } catch { /* nada */ }
      }
    };
  })();

  /* ---------- Estado ---------- */
  const DEFAULTS = {
    recordatorio: { activo: false, hora: '21:30' },
    pin: { activo: false, hash: null, salt: null, tras: 60 },
    tema: 'auto',
    modoCal: 'entradas',
    orden: 'desc',
    ultimaCopia: null,
    pistaInstalar: true,
    ejemploVisto: false,
    frase: true
  };
  let settings = clone(DEFAULTS);
  function mergeSettings(saved) {
    const out = clone(DEFAULTS);
    if (!saved || typeof saved !== 'object') return out;
    for (const k of Object.keys(out)) {
      if (!(k in saved)) continue;
      const v = saved[k];
      if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = Object.assign(out[k], v && typeof v === 'object' ? v : {});
      else out[k] = v;
    }
    return out;
  }
  async function saveSettings() {
    try { await Store.setMeta('ajustes', clone(settings)); } catch (e) { console.warn(e); }
    try {
      localStorage.setItem('dul.tema', settings.tema);
      localStorage.setItem('dul.lock', settings.pin.activo ? '1' : '0');
    } catch { /* nada */ }
  }

  const ui = {
    tab: 'hoy',
    year: new Date().getFullYear(),
    today: todayIso(),
    q: '',
    tag: '',
    demo: false,
    locked: false,
    dirty: new Set(TABS),
    scroll: {},
    updateReady: false,
    arcMode: 'lineas'
  };
  const entries = new Map();
  let realEntries = null;
  const demoPhotos = new Map();
  const frases = new Map(); // fecha → { fecha, frase, i }
  let realFrases = null;
  let swReg = null;
  let deferredInstall = null;
  let hoyEditor = null;

  const moodLevel = m => MOODS.indexOf(m) + 1;
  const moodName = m => MOOD_NAMES[MOODS.indexOf(m)] || 'Ánimo';

  /* Normaliza una entrada (de la base de datos o de un archivo importado) */
  function normEntry(raw, fallbackDate) {
    if (!raw || typeof raw !== 'object') return null;
    const fecha = String(raw.fecha || raw.date || fallbackDate || '');
    if (!isValidIso(fecha)) return null;
    const texto = cleanText(typeof raw.texto === 'string' ? raw.texto : (typeof raw.text === 'string' ? raw.text : ''));
    const animo = typeof raw.animo === 'string' ? raw.animo.trim().slice(0, 16) : '';
    const fromText = parseTags(texto);
    const given = Array.isArray(raw.etiquetas) ? raw.etiquetas.filter(t => typeof t === 'string').map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean) : [];
    const etiquetas = fromText.concat(given.filter(t => !fromText.includes(t))).slice(0, 30);
    const okDate = v => (typeof v === 'string' && !isNaN(Date.parse(v)) ? v : null);
    const e = { fecha, texto, animo, etiquetas, foto: raw.foto === true || (typeof raw.foto === 'string' && raw.foto.startsWith('data:image/')) };
    const creado = okDate(raw.creado), editado = okDate(raw.editado);
    if (creado) e.creado = creado;
    if (editado) e.editado = editado;
    if (!e.texto && !e.animo && !e.foto) return null;
    return e;
  }

  /* ---------- Fotos (Blob + URL en caché) ---------- */
  const photoURLs = new Map();
  async function getPhotoBlob(f) {
    if (ui.demo) return demoPhotos.get(f) || null;
    try { return (await Store.getFoto(f)) || null; } catch { return null; }
  }
  async function putPhoto(f, blob) {
    dropURL(f);
    if (ui.demo) { demoPhotos.set(f, blob); return; }
    await Store.putFoto(f, blob);
  }
  async function removePhoto(f) {
    dropURL(f);
    if (ui.demo) { demoPhotos.delete(f); return; }
    try { await Store.delFoto(f); } catch { /* nada */ }
  }
  async function photoURL(f) {
    if (photoURLs.has(f)) return photoURLs.get(f);
    const b = await getPhotoBlob(f);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    photoURLs.set(f, u);
    return u;
  }
  function dropURL(f) { const u = photoURLs.get(f); if (u) { URL.revokeObjectURL(u); photoURLs.delete(f); } }
  function dropAllURLs() { photoURLs.forEach(u => URL.revokeObjectURL(u)); photoURLs.clear(); }

  const thumbObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(list => list.forEach(en => { if (en.isIntersecting) { thumbObserver.unobserve(en.target); loadThumb(en.target); } }), { rootMargin: '400px 0px' })
    : null;
  function loadThumb(img) {
    photoURL(img.dataset.photo).then(u => { if (u) img.src = u; else img.remove(); });
  }
  function hydratePhotos(root, lazy) {
    $$('img[data-photo]', root).forEach(img => (lazy && thumbObserver ? thumbObserver.observe(img) : loadThumb(img)));
  }

  /* ---------- Guardar ---------- */
  function storageError(err) {
    console.error(err);
    toast('No se pudo guardar en este dispositivo. Exporta una copia por si acaso.');
  }
  let persistAsked = false;
  function requestPersist() {
    if (persistAsked || ui.demo) return;
    persistAsked = true;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* nada */ }
  }

  async function saveEntry(fecha, patch) {
    const prev = entries.get(fecha);
    const now = new Date().toISOString();
    const next = Object.assign({ fecha, texto: '', animo: '', etiquetas: [], foto: false, creado: now }, prev || {}, patch);
    next.texto = cleanText(next.texto);
    next.etiquetas = parseTags(next.texto);
    next.animo = next.animo || '';
    next.foto = !!next.foto;
    if (!next.texto && !next.animo && !next.foto) {
      if (!prev) return { changed: false };
      entries.delete(fecha);
      dropURL(fecha);
      if (!ui.demo) await Store.del(fecha).catch(storageError);
      dataChanged(fecha);
      return { changed: true, deleted: true };
    }
    if (prev && prev.texto === next.texto && prev.animo === next.animo && prev.foto === next.foto) return { changed: false };
    next.editado = now;
    entries.set(fecha, next);
    if (!ui.demo) await Store.put(next).catch(storageError);
    dataChanged(fecha);
    if (!prev && fecha === ui.today) celebrate();
    requestPersist();
    return { changed: true, created: !prev };
  }

  async function deleteEntry(fecha) {
    if (!entries.has(fecha)) return;
    entries.delete(fecha);
    dropURL(fecha);
    if (ui.demo) demoPhotos.delete(fecha);
    else await Store.del(fecha).catch(storageError);
    dataChanged(fecha);
  }

  function dataChanged(fecha) {
    invalidate('calendario', 'archivo', 'ajustes');
    if (fecha !== ui.today) invalidate('hoy');
  }

  function celebrate() {
    const { cur } = streakInfo();
    toast(cur >= 2 ? `${num(cur)} días seguidos escribiendo` : 'Línea guardada. Mañana, otra.');
  }

  /* ---------- Rachas y estadísticas ---------- */
  function streakInfo() {
    const t = ui.today;
    let cur = 0;
    let d = entries.has(t) ? t : addDays(t, -1);
    while (entries.has(d)) { cur++; d = addDays(d, -1); }
    let best = 0, run = 0, prev = null;
    for (const f of Array.from(entries.keys()).sort()) {
      if (f > t) continue;
      run = prev && addDays(prev, 1) === f ? run + 1 : 1;
      if (run > best) best = run;
      prev = f;
    }
    return { cur, best, today: entries.has(t) };
  }
  function countYear(y) {
    const p = `${y}-`;
    let n = 0;
    for (const f of entries.keys()) if (f.startsWith(p)) n++;
    return n;
  }

  /* ---------- Frase del día ----------
     Colección propia (funciona sin conexión). Cada día recibe una frase la
     primera vez que se abre la app y queda guardada con su fecha. No se
     repite ninguna dentro de una ventana de 150 días. */
  const FRASES = [
    'Hoy no hace falta que sea un gran día; basta con que sea tuyo.',
    'Un paso pequeño sigue siendo un paso.',
    'Lo que haces cada día pesa más que lo que haces de vez en cuando.',
    'No esperes a tener ganas: empieza y las ganas llegarán por el camino.',
    'Dentro de un año agradecerás haber empezado hoy.',
    'Hacerlo regular también cuenta. Lo perfecto puede esperar.',
    'Tu ritmo es válido aunque no sea el de los demás.',
    'Descansar también forma parte del plan.',
    'Hoy es una buena página para escribir algo distinto.',
    'Las cosas difíciles se vuelven fáciles a fuerza de repetirlas.',
    'Mira lo lejos que has llegado antes de mirar lo que falta.',
    'Un día malo no es una vida mala.',
    'Haz hoy algo que tu yo de mañana te agradezca.',
    'La constancia no hace ruido, pero lo cambia todo.',
    'No tienes que saberlo todo para dar el primer paso.',
    'Cada error es una nota al margen, no el final del libro.',
    'Sé amable contigo: estás aprendiendo.',
    'Lo que hoy te cuesta, mañana te saldrá solo.',
    'Pequeñas mejoras, todos los días, acaban siendo enormes.',
    'Hoy también merece ser recordado.',
    'Cambia el «tengo que» por «voy a» y mira qué pasa.',
    'No compares tu primer capítulo con el capítulo veinte de otra persona.',
    'La calma también es una forma de avanzar.',
    'Termina una cosa antes de empezar tres.',
    'Si no puedes con todo, elige una cosa y hazla bien.',
    'Lo importante rara vez es urgente. Hazle hueco igualmente.',
    'Tu atención es tu mejor recurso: ponla donde quieras crecer.',
    'Ser valiente a veces es solo intentarlo otra vez.',
    'Una conversación sincera arregla más que mil pensamientos.',
    'Hoy, déjate sorprender por algo pequeño.',
    'Lo que riegas, crece. Elige bien qué riegas hoy.',
    'No hace falta correr; hace falta no parar.',
    'Haz espacio para lo que te hace bien.',
    'Agradecer una cosa al día cambia la forma de ver todas las demás.',
    'No necesitas un plan perfecto, solo un siguiente paso claro.',
    'Hoy cuenta, aunque nadie lo vea.',
    'Dile a alguien algo bueno que pienses de él.',
    'Tu cuerpo te acompaña a todas partes: trátalo bien hoy.',
    'Bebe agua, busca la luz y respira hondo. Lo demás, después.',
    'Los grandes cambios empiezan con decisiones aburridas.',
    'Aprender algo nuevo es regalarte un futuro más amplio.',
    'Lo que te da miedo suele estar justo al lado de lo que quieres.',
    'Hoy no tienes que demostrar nada; solo hacerlo lo mejor que puedas.',
    'Escucha más de lo que hablas y aprenderás el doble.',
    'Las rachas se construyen con días normales.',
    'Si un día se tuerce, el siguiente puede enderezarse.',
    'Celebra los avances, aunque sean diminutos.',
    'Ordena tu espacio y tu cabeza te lo agradecerá.',
    'Apaga una pantalla y enciende una conversación.',
    'Haz una cosa a la vez y hazla del todo.',
    'No dejes que un mal momento escriba todo el día.',
    'Prueba algo que no hayas hecho nunca, aunque sea pequeño.',
    'Lo que hoy parece rutina, dentro de un año será un recuerdo.',
    'Tu historia se escribe línea a línea.',
    'Ser constante es más útil que ser intenso.',
    'Pedir ayuda no es debilidad, es estrategia.',
    'Las ganas van y vienen; los hábitos se quedan.',
    'Hoy, mira con atención algo que siempre pasas por alto.',
    'Que el miedo te acompañe, pero que no conduzca.',
    'Un buen día empieza por una buena decisión, no por un buen humor.',
    'Reírte de ti mismo es una forma de libertad.',
    'A veces avanzar es saber decir que no.',
    'Termina el día pensando en una cosa que salió bien.',
    'Ningún esfuerzo honesto se pierde del todo.',
    'Lo simple, hecho a diario, se vuelve extraordinario.',
    'No necesitas permiso para empezar de nuevo.',
    'Cuida a la gente que te cuida.',
    'Si te cuesta, es que estás creciendo.',
    'Respira. Esto también pasará, y tú seguirás aquí.',
    'Las mejores ideas llegan caminando. Sal a dar una vuelta.',
    'Una página en blanco es una oportunidad, no una amenaza.',
    'Haz algo hoy por la persona que quieres ser.',
    'Disfrutar del camino no es perder el tiempo.',
    'No subestimes lo que puedes hacer en quince minutos.',
    'Lo que no se empieza, no se termina.',
    'Tu mejor versión no es perfecta; es honesta.',
    'Mañana será más fácil si hoy dejas algo preparado.',
    'Lee una página, camina diez minutos o llama a alguien. Elige una.',
    'Ser feliz también se practica.',
    'Hoy es un buen día para perdonarte algo.',
    'Tus dudas no definen tus capacidades.',
    'Mira el cielo un minuto. Es gratis y siempre está ahí.',
    'Quien avanza despacio también llega.',
    'Un hábito pequeño es una promesa que te cumples.',
    'Si lo escribes, lo recuerdas; si lo recuerdas, lo vives dos veces.',
    'Lo que hoy anotas, mañana te contará quién eras.',
    'Haz las cosas con cariño, aunque sean pequeñas.',
    'La disciplina es acordarte de lo que quieres de verdad.',
    'Los días tranquilos también construyen una buena vida.',
    'Ten paciencia con los procesos lentos: suelen ser los que duran.',
    'Una sonrisa a un desconocido puede ser lo mejor de su día.',
    'Hoy, hazlo un poco mejor que ayer. Solo un poco.',
    'No todo tiene que ser productivo para ser valioso.',
    'El cansancio se cura descansando, no rindiéndose.',
    'Cada mañana trae una versión nueva de ti.',
    'Las metas grandes se alcanzan a trocitos.',
    'Si no te gusta el camino, puedes cambiar de dirección.',
    'La curiosidad te mantiene joven.',
    'Lo que le cuentas a tu cabeza, tu cabeza se lo cree. Cuéntale cosas buenas.',
    'Hoy vale la pena aunque no salga en ninguna foto.',
    'Las cosas buenas también llegan sin avisar.',
    'Haz una pausa antes de responder; casi siempre ayuda.',
    'Agradece algo de tu casa, algo de tu gente y algo de ti.',
    'Valora lo que ya sabes hacer: hubo un día en que no sabías.',
    'Si dudas entre hacer o no hacer, haz la versión pequeña.',
    'Lo que construyes despacio aguanta mejor las tormentas.',
    'Tu tiempo es tu vida: gástalo en lo que te importa.',
    'Rodéate de gente que te haga querer mejorar.',
    'Un buen libro, un buen paseo o una buena charla: hoy, al menos uno.',
    'No eres tus peores días.',
    'La motivación te pone en marcha; la costumbre te mantiene.',
    'Haz que hoy tenga al menos un momento que quieras recordar.',
    'Pregunta, aunque creas que es una pregunta tonta.',
    'Lo difícil de hoy es la anécdota de mañana.',
    'Elige la amabilidad cuando no sepas qué elegir.',
    'A veces el mejor plan es no tener ninguno.',
    'Mira hacia atrás solo para ver cuánto has crecido.',
    'Cada línea que escribes es una prueba de que estuviste aquí.',
    'No hace falta que todo salga bien para que el día merezca la pena.',
    'Comer bien, dormir bien y moverte un poco: la base de casi todo.',
    'Las respuestas llegan antes cuando dejas de forzarlas.',
    'Hoy puedes ser la razón por la que alguien sonría.',
    'Confía en el proceso, sobre todo cuando aún no ves resultados.',
    'Lo que aprendes nadie te lo puede quitar.',
    'Pon música que te guste y verás el día de otro color.',
    'Un «gracias» a tiempo vale más que muchos regalos.',
    'Volver a empezar no es retroceder: es empezar con más experiencia.',
    'Ocúpate de lo que depende de ti y suelta lo demás.',
    'Hoy, deja el móvil lejos durante una comida.',
    'Lo bonito de los días normales es que hay muchos.',
    'Cuando no sepas por dónde seguir, resuelve la siguiente cosa pequeña.',
    'No esperes al lunes, al mes que viene ni al año nuevo.',
    'Tienes más recursos de los que crees.',
    'Las amistades también se riegan: escribe a alguien.',
    'Saber parar a tiempo es una forma de ganar.',
    'Un cuaderno, una idea y diez minutos pueden cambiar tu semana.',
    'Haz las paces con lo que no puedes cambiar.',
    'Tus pequeñas rutinas son tu ancla en los días raros.',
    'Hoy, intenta escuchar sin preparar la respuesta.',
    'La alegría también está en lo sencillo: un café caliente, una ventana con sol.',
    'Lo que hoy decides repetir, mañana te define.',
    'El aburrimiento a veces es la puerta a una buena idea.',
    'Que no se te olvide jugar.',
    'No llevas retraso: llevas tu propio horario.',
    'Ser fuerte también es reconocer que algo te duele.',
    'Hoy, haz algo solo porque te apetece.',
    'Si te comparas, que sea con quien eras ayer.',
    'Cuida tus palabras, también las que te dices a ti.',
    'Una buena noche de sueño arregla más de lo que parece.',
    'Los planes cambian; tus ganas pueden quedarse.',
    'Aprovecha la luz de la mañana: el resto del día lo notará.',
    'Lo que te hace distinto es lo que te hace interesante.',
    'Una tarea temida, hecha temprano, libera todo el día.',
    'Abraza más y discute menos.',
    'Cada día trae una oportunidad pequeña. Búscala.',
    'Que tus metas te ilusionen más de lo que te presionan.',
    'Para avanzar no hace falta prisa, hace falta dirección.',
    'Lo que vale la pena casi nunca es inmediato.',
    'Escribe hoy la línea que te gustaría leer dentro de un año.',
    'Sal de tu zona cómoda con un paso, no con un salto.',
    'Hoy no se repetirá. Vívelo con atención.',
    'La paciencia es confiar en tu propio ritmo.',
    'Moverte hoy es un regalo que disfrutarás toda la semana.',
    'Un recuerdo bonito vale más que una cosa nueva.',
    'Admitir lo que no sabes es el primer paso para saberlo.',
    'Hoy es un buen día para terminar algo pendiente.',
    'Tu esfuerzo de hoy es la base de tu tranquilidad de mañana.',
    'Las mejores historias empiezan con un «¿y si…?».',
    'Cree en ti lo suficiente como para intentarlo.',
    'Lo que te ilusiona merece un hueco en tu agenda.',
    'No tienes que tenerlo todo claro para disfrutar del día.',
    'Hay alguien que está orgulloso de ti, aunque no te lo diga.',
    'Celebra que hoy has llegado hasta aquí.',
    'Una mente descansada ve soluciones que una cansada no ve.',
    'Haz que tus días se parezcan a la vida que quieres.',
    'Poco y bien hecho vale más que mucho a medias.',
    'Tus raíces te sostienen; tus ganas te mueven.',
    'Hoy, regálate cinco minutos de silencio.',
    'El progreso no siempre se nota, pero siempre suma.',
    'Escribe, aunque sea poco. Tu yo del futuro quiere leerte.'
  ];
  const FRASE_VENTANA = 150;

  function hashStr(s) {
    let h = 2166136261;
    for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  /* Elige la frase de una fecha evitando las usadas en los días anteriores más recientes */
  function nextFrase(fecha, source) {
    const recent = Array.from(source.values())
      .filter(f => f.fecha < fecha && f.i >= 0)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .slice(0, Math.min(FRASE_VENTANA, FRASES.length - 1))
      .map(f => f.i);
    const used = new Set(recent);
    const pool = FRASES.map((_, i) => i).filter(i => !used.has(i));
    const rnd = mulberry32(hashStr(fecha));
    const i = pool[Math.floor(rnd() * pool.length)];
    return { fecha, frase: FRASES[i], i };
  }
  async function ensureFrase(fecha) {
    if (frases.has(fecha)) return frases.get(fecha);
    if (!settings.frase || ui.demo) return null;
    const f = nextFrase(fecha, frases);
    frases.set(fecha, f);
    try { await Store.putFrase(f); } catch (e) { console.warn(e); }
    ui.dirty.add('archivo');
    return f;
  }
  const quoteHTML = f => `<p class="quote-label">Frase del día</p><p class="quote-text">${esc(f.frase)}</p>`;
  function quoteBlock(fecha) {
    const f = frases.get(fecha);
    return f ? el('div', { class: 'day-quote', html: quoteHTML(f) }) : null;
  }
  function renderFraseHoy() {
    const box = $('#hoy-frase');
    if (!settings.frase) { box.hidden = true; return; }
    const paint = f => { box.innerHTML = quoteHTML(f); box.hidden = false; };
    const f = frases.get(ui.today);
    if (f) { paint(f); return; }
    box.hidden = true;
    ensureFrase(ui.today).then(x => { if (x && x.fecha === ui.today && settings.frase) paint(x); });
  }

  /* ---------- Render: planificador ---------- */
  let raf = 0;
  function invalidate(...tabs) {
    (tabs.length ? tabs : TABS).forEach(t => ui.dirty.add(t));
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderTab(ui.tab); });
  }
  function renderTab(t) {
    if (!ui.dirty.has(t)) return;
    ui.dirty.delete(t);
    ({ hoy: renderHoy, calendario: renderCal, archivo: renderArchive, ajustes: renderSettings })[t]();
  }

  /* ---------- Avisos flotantes ---------- */
  let toastTimer = 0;
  function toast(msg, opts = {}) {
    const t = $('#toast'), b = $('#toast-btn');
    $('#toast-msg').textContent = msg;
    b.hidden = !opts.action;
    t.classList.toggle('has-action', !!opts.action);
    if (opts.action) {
      b.textContent = opts.action;
      b.onclick = () => { hideToast(); if (opts.onAction) opts.onAction(); };
    }
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, opts.duration || (opts.action ? 5200 : 2600));
  }
  function hideToast() { $('#toast').classList.remove('show'); }

  /* ---------- Hojas ---------- */
  const sheets = [];
  let sheetSeq = 0;
  let ignorePop = 0;
  function openSheet({ title = '', className = '' } = {}) {
    const id = ++sheetSeq;
    const layer = el('div', { class: 'sheet-layer' });
    layer.innerHTML = `<div class="scrim" data-dismiss></div><div class="sheet ${className}" role="dialog" aria-modal="true" aria-labelledby="sh${id}" tabindex="-1"><div class="grabber" aria-hidden="true"></div><header class="sheet-head"><h2 class="sheet-title" id="sh${id}"></h2><button type="button" class="sheet-x" data-dismiss aria-label="Cerrar">${ICON.x}</button></header><div class="sheet-body"></div></div>`;
    const sheet = $('.sheet', layer);
    const body = $('.sheet-body', layer);
    $('.sheet-title', layer).textContent = title;
    const closers = [];
    const prevFocus = document.activeElement;
    let closed = false, pushed = false;
    const api = {
      el: sheet, body, layer,
      onClose(fn) { closers.push(fn); return api; },
      setTitle(t) { $('.sheet-title', layer).textContent = t; },
      close
    };
    function close(fromHistory) {
      if (closed) return;
      closed = true;
      const i = sheets.indexOf(api);
      if (i >= 0) sheets.splice(i, 1);
      closers.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
      layer.classList.remove('open');
      const finish = () => layer.remove();
      if (MQ_REDUCE.matches) finish();
      else { layer.addEventListener('transitionend', finish, { once: true }); setTimeout(finish, 520); }
      if (!sheets.length) document.documentElement.classList.remove('has-sheet');
      if (pushed && fromHistory !== true) { ignorePop++; history.back(); }
      if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus) && prevFocus.tagName !== 'TEXTAREA') {
        try { prevFocus.focus({ preventScroll: true }); } catch { /* nada */ }
      }
    }
    layer.addEventListener('click', e => { if (e.target.closest('[data-dismiss]')) close(); });
    document.body.append(layer);
    document.documentElement.classList.add('has-sheet');
    sheets.push(api);
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
    setTimeout(() => { if (!sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true }); }, 40);
    if (isStandalone() && !PREVIEW) {
      try { history.pushState({ dulSheet: id }, ''); pushed = true; } catch { /* nada */ }
    }
    return api;
  }
  window.addEventListener('popstate', () => {
    if (ignorePop > 0) { ignorePop--; return; }
    const top = sheets[sheets.length - 1];
    if (top) top.close(true);
  });
  const closeAllSheets = () => sheets.slice().reverse().forEach(s => s.close());

  function askSheet({ title, message, options, cancel = 'Cancelar' }) {
    return new Promise(resolve => {
      let value = null;
      const s = openSheet({ title, className: 'ask' });
      if (message) s.body.append(el('p', { class: 'ask-msg', text: message }));
      const stack = el('div', { class: 'btn-stack' });
      options.forEach(o => stack.append(el('button', { type: 'button', class: `btn ${o.style || 'secondary'}`, onclick: () => { value = o.value; s.close(); } }, o.label)));
      if (cancel) stack.append(el('button', { type: 'button', class: 'btn plain', onclick: () => s.close() }, cancel));
      s.body.append(stack);
      s.onClose(() => resolve(value));
    });
  }
  const confirmSheet = ({ title, message, confirm, destructive }) =>
    askSheet({ title, message, options: [{ label: confirm, value: true, style: destructive ? 'destructive' : 'primary' }] }).then(v => v === true);
  const infoSheet = (title, message) => askSheet({ title, message, options: [{ label: 'Entendido', value: true, style: 'primary' }], cancel: null });

  /* ---------- Editor de una línea ---------- */
  let edSeq = 0;
  const editors = new Set();
  function createEditor({ placeholder = '¿Qué ha pasado hoy?', label = 'Tu línea de hoy' } = {}) {
    const id = `ed${++edSeq}`;
    const root = el('div', { class: 'editor' });
    root.innerHTML = `
      <label class="sr-only" for="${id}">${esc(label)}</label>
      <textarea id="${id}" class="editor-text" rows="3" placeholder="${esc(placeholder)}" enterkeyhint="done" autocomplete="off" autocapitalize="sentences" spellcheck="true"></textarea>
      <div class="editor-photo" hidden><img alt="Foto del día"><button type="button" class="photo-x" aria-label="Quitar la foto">${ICON.x}</button></div>
      <div class="editor-bar">
        <div class="moods" role="radiogroup" aria-label="Ánimo del día">${MOODS.map((m, i) => `<button type="button" class="mood" role="radio" aria-checked="false" data-mood="${m}" aria-label="${MOOD_NAMES[i]}" title="${MOOD_NAMES[i]}">${m}</button>`).join('')}</div>
        <div class="editor-end">
          <button type="button" class="icon-btn photo-add" aria-label="Añadir una foto" title="Añadir una foto">${ICON.camera}</button>
          <input type="file" class="photo-input" accept="image/*" hidden>
          <span class="counter" aria-hidden="true">0/${MAX}</span>
        </div>
      </div>`;
    const ta = $('textarea', root);
    const counter = $('.counter', root);
    const photoBox = $('.editor-photo', root);
    const photoImg = $('img', photoBox);
    const fileIn = $('.photo-input', root);
    let fecha = null, timer = 0, savedTimer = 0;

    const autosize = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; };
    function paintCounter() {
      clearTimeout(savedTimer);
      const n = glen(ta.value);
      counter.textContent = `${n}/${MAX}`;
      counter.classList.toggle('near', n >= MAX - 20 && n < MAX);
      counter.classList.toggle('full', n >= MAX);
      counter.classList.remove('saved');
    }
    function flashSaved() {
      clearTimeout(savedTimer);
      counter.textContent = 'Guardado';
      counter.classList.remove('near', 'full');
      counter.classList.add('saved');
      savedTimer = setTimeout(paintCounter, 1400);
    }
    const paintMood = m => $$('.mood', root).forEach(b => b.setAttribute('aria-checked', String(b.dataset.mood === m)));
    async function paintPhoto() {
      const f = fecha;
      const e = f && entries.get(f);
      if (e && e.foto) {
        const u = await photoURL(f);
        if (u && fecha === f) { photoImg.src = u; photoBox.hidden = false; return; }
      }
      if (fecha === f) { photoBox.hidden = true; photoImg.removeAttribute('src'); }
    }
    function load(f) {
      clearTimeout(timer);
      fecha = f;
      const e = entries.get(f);
      ta.value = e ? e.texto : '';
      paintMood(e ? e.animo : '');
      paintCounter();
      paintPhoto();
      requestAnimationFrame(autosize);
    }
    async function flush() {
      clearTimeout(timer);
      timer = 0;
      if (!fecha) return false;
      const r = await saveEntry(fecha, { texto: ta.value });
      if (r.changed) flashSaved();
      return r.changed;
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, 650); };
    function bump() { root.classList.remove('bump'); void root.offsetWidth; root.classList.add('bump'); }

    ta.addEventListener('beforeinput', e => {
      const t = e.inputType || '';
      if (t === 'insertLineBreak' || t === 'insertParagraph') { e.preventDefault(); flush(); ta.blur(); return; }
      // Al teclear en el límite se bloquea; lo pegado se deja entrar y se recorta en 'input'
      if (t.startsWith('insert') && e.data && !e.isComposing) {
        const add = glen(oneLine(e.data));
        const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
        if (add <= 2 && glen(ta.value) - glen(sel) + add > MAX) { e.preventDefault(); bump(); }
      }
    });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); flush(); ta.blur(); }
    });
    ta.addEventListener('input', () => {
      const v = ta.value;
      let out = oneLine(v);
      if (glen(out) > MAX) { out = gcut(out, MAX); bump(); }
      if (out !== v) {
        const pos = Math.min(ta.selectionStart, out.length);
        ta.value = out;
        try { ta.setSelectionRange(pos, pos); } catch { /* nada */ }
      }
      autosize();
      paintCounter();
      schedule();
    });
    ta.addEventListener('focus', () => { if (MQ_COARSE.matches) document.body.classList.add('typing'); });
    ta.addEventListener('blur', () => {
      document.body.classList.remove('typing');
      flush();
      setTimeout(checkDay, 60);
    });
    $('.moods', root).addEventListener('click', async e => {
      const b = e.target.closest('.mood');
      if (!b || !fecha) return;
      const cur = (entries.get(fecha) || {}).animo || '';
      const next = cur === b.dataset.mood ? '' : b.dataset.mood;
      paintMood(next);
      clearTimeout(timer);
      const r = await saveEntry(fecha, { texto: ta.value, animo: next });
      if (r.changed) flashSaved();
    });
    $('.photo-add', root).addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', async () => {
      const file = fileIn.files && fileIn.files[0];
      fileIn.value = '';
      if (!file || !fecha) return;
      const f = fecha;
      try {
        const blob = await compressImage(file);
        await putPhoto(f, blob);
        clearTimeout(timer);
        const r = await saveEntry(f, { texto: f === fecha ? ta.value : (entries.get(f) || {}).texto, foto: true });
        if (r.changed && fecha === f) flashSaved();
        if (fecha === f) await paintPhoto();
      } catch (err) {
        console.error(err);
        toast('No se pudo añadir la foto. Prueba con otra imagen.');
      }
    });
    $('.photo-x', root).addEventListener('click', async () => {
      const f = fecha;
      if (!f) return;
      const blob = await getPhotoBlob(f);
      await removePhoto(f);
      clearTimeout(timer);
      await saveEntry(f, { texto: ta.value, foto: false });
      paintPhoto();
      toast('Foto quitada', {
        action: 'Deshacer',
        onAction: async () => {
          if (!blob) return;
          await putPhoto(f, blob);
          await saveEntry(f, { foto: true });
          if (fecha === f) paintPhoto();
        }
      });
    });
    window.addEventListener('resize', () => { if (root.isConnected) autosize(); });

    const api = {
      el: root, load, flush,
      focus: () => ta.focus(),
      get fecha() { return fecha; },
      get focused() { return document.activeElement === ta; },
      destroy() { clearTimeout(timer); editors.delete(api); }
    };
    editors.add(api);
    return api;
  }
  const flushAll = () => Promise.all(Array.from(editors).map(e => e.flush().catch(() => false)));

  /* ---------- Hoy ---------- */
  function renderHoy() {
    const t = ui.today;
    const d = parseIso(t);
    const y = d.getFullYear();
    $('#hoy-weekday').textContent = `${cap(F.weekday.format(d))} · día ${dayOfYear(t)} de ${daysInYear(y)}`;
    $('#hoy-date').textContent = F.dm.format(d);
    renderFraseHoy();
    renderMemories();
    if (hoyEditor.fecha !== t && !hoyEditor.focused) hoyEditor.load(t);
    renderHoyExtras();
  }

  function renderMemories() {
    const t = ui.today;
    const slots = [
      { label: 'Hace un año hoy', f: addMonths(t, -12), always: true },
      { label: 'Hace un mes', f: addMonths(t, -1) },
      { label: 'Hace una semana', f: addDays(t, -7) }
    ];
    const keys = Array.from(entries.keys());
    const oldest = keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : null;
    const parts = [];
    for (const s of slots) {
      const e = entries.get(s.f);
      if (!e) {
        if (!s.always) continue;
        const msg = oldest && oldest <= s.f ? 'Ese día no escribiste nada.' : 'Dentro de un año, aquí leerás lo que escribas hoy.';
        parts.push(`<div class="memory empty"><p class="memory-meta"><span>${s.label}</span></p><p class="memory-text">${msg}</p></div>`);
        continue;
      }
      const side = (e.animo || e.foto)
        ? `<span class="memory-side">${e.animo ? `<span class="memory-mood" role="img" aria-label="${esc(moodName(e.animo))}">${esc(e.animo)}</span>` : ''}${e.foto ? `<img class="thumb" alt="" data-photo="${s.f}">` : ''}</span>`
        : '';
      parts.push(`<button type="button" class="memory" data-fecha="${s.f}"><span class="memory-meta"><span>${s.label}</span><span class="when">${esc(fmtShort(s.f))}</span></span><span class="memory-text">${e.texto ? richText(e.texto) : '<span class="muted">Sin texto</span>'}</span>${side}</button>`);
    }
    const box = $('#memories');
    box.innerHTML = parts.join('');
    hydratePhotos(box, false);
  }

  function renderHoyExtras() {
    const d = parseIso(ui.today);
    const y = d.getFullYear();
    const parts = [];
    if (d.getMonth() === 11 && countYear(y) > 0) {
      parts.push(`<button type="button" class="card-link" data-summary="${y}"><span class="card-icon">${ICON.sparkle}</span><span><b>Tu ${y} en una línea</b><small>Tus mejores días y las palabras que más usaste</small></span>${ICON.chevR}</button>`);
    }
    const hint = installHint();
    if (hint) parts.push(hint);
    const box = $('#hoy-extra');
    box.innerHTML = parts.join('');
    box.hidden = !parts.length;
  }

  function installHint() {
    if (PREVIEW || isStandalone() || !settings.pistaInstalar || !MQ_COARSE.matches) return '';
    const close = `<button type="button" class="hint-x" data-hint-close aria-label="Ocultar este aviso">${ICON.x}</button>`;
    if (IS_IOS) {
      return `<div class="hint" role="note"><div><b>Instálala en tu iPhone</b><p>En Safari, toca Compartir y elige «Añadir a pantalla de inicio». Hazlo antes de empezar: Safari y la app guardan las líneas por separado.</p></div>${close}</div>`;
    }
    if (deferredInstall) {
      return `<div class="hint" role="note"><div><b>Instala la app</b><p>Ábrela desde la pantalla de inicio y escribe aunque no tengas conexión.</p><button type="button" class="btn-inline" data-install>Instalar</button></div>${close}</div>`;
    }
    return '';
  }

  /* ---------- Calendario ---------- */
  function renderCal() {
    const t = ui.today;
    const ty = +t.slice(0, 4);
    const y = ui.year;
    const s = streakInfo();
    $('#st-cur').innerHTML = `${num(s.cur)}<small>${s.cur === 1 ? 'día' : 'días'}</small>`;
    $('#st-cur-sub').textContent = s.cur === 0 ? 'Escribe hoy para empezar una' : (s.today ? 'Hoy ya has escrito' : 'Escribe hoy para mantenerla');
    $('#st-dot').classList.toggle('off', !s.today);
    $('#st-best').innerHTML = `${num(s.best)}<small>${s.best === 1 ? 'día' : 'días'}</small>`;
    const yc = countYear(y);
    const span = y === ty ? dayOfYear(t) : (y < ty ? daysInYear(y) : 0);
    $('#st-year-k').textContent = y === ty ? 'Este año' : `En ${y}`;
    $('#st-year').innerHTML = `${num(yc)}<small>de ${num(span)} días</small>`;

    const years = Array.from(entries.keys()).map(f => +f.slice(0, 4));
    const minY = Math.min(ty, ...years);
    $('#cal-year').textContent = y;
    $('#cal-prev').disabled = y <= minY;
    $('#cal-next').disabled = y >= ty;

    const html = [];
    for (let m = 0; m < 12; m++) html.push(monthHTML(y, m, t));
    $('#months').innerHTML = html.join('');
    $('#cal').dataset.mode = settings.modoCal;
    $$('#cal-mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === settings.modoCal)));
    renderLegend();

    const btn = $('#btn-summary');
    btn.hidden = yc === 0;
    $('#btn-summary-title').textContent = `Resumen de ${y}`;
  }

  function monthHTML(y, m, t) {
    const first = new Date(y, m, 1, 12);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    let n = 0;
    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<span class="cell pad" aria-hidden="true"></span>';
    for (let d = 1; d <= days; d++) {
      const f = `${y}-${pad2(m + 1)}-${pad2(d)}`;
      if (f > t) { cells += '<span class="cell f" aria-hidden="true"></span>'; continue; }
      const e = entries.get(f);
      if (e) n++;
      const lvl = e ? moodLevel(e.animo) : 0;
      const cls = `cell${e ? ' w' : ''}${f === t ? ' t' : ''}`;
      const label = `${d} de ${MONTHS[m]}${f === t ? ', hoy' : ''}: ${e ? `escrito${lvl ? `, ánimo ${MOOD_NAMES[lvl - 1].toLowerCase()}` : ''}` : 'sin escribir'}`;
      cells += `<button type="button" class="${cls}" data-fecha="${f}"${lvl ? ` data-m="${lvl}"` : ''} aria-label="${label}"></button>`;
    }
    const wd = WD.map(w => `<span class="wd" aria-hidden="true">${w}</span>`).join('');
    return `<section class="month" aria-label="${cap(MONTHS[m])} de ${y}"><h3>${cap(MONTHS[m])}<span class="n">${n ? `${n}` : ''}</span></h3><div class="mgrid">${wd}${cells}</div></section>`;
  }

  function renderLegend() {
    const box = $('#cal-legend');
    if (settings.modoCal === 'animo') {
      box.innerHTML = `<span>Peor <span class="ramp">${[1, 2, 3, 4, 5].map(i => `<i style="background:var(--mood-${i})"></i>`).join('')}</span> Mejor</span><span><i style="background:var(--cell-nomood)"></i>Sin ánimo</span><span><i style="background:var(--cell-empty)"></i>Sin escribir</span>`;
    } else {
      box.innerHTML = '<span><i style="background:var(--cell-written)"></i>Escrito</span><span><i style="background:var(--cell-empty)"></i>Sin escribir</span><span><i style="box-shadow:inset 0 0 0 2px var(--accent-ink)"></i>Hoy</span>';
    }
  }

  /* Pista al pasar el ratón por un día */
  function showTip(cell) {
    const f = cell.dataset.fecha;
    const e = entries.get(f);
    const tip = $('#tip');
    const d = parseIso(f);
    const txt = e ? (e.texto ? (glen(e.texto) > 90 ? `${gcut(e.texto, 88)}…` : e.texto) : 'Sin texto') : 'Sin escribir';
    tip.innerHTML = `<b>${esc(cap(F.full.format(d)))}</b>${e && e.animo ? `${esc(e.animo)} ` : ''}${esc(txt)}`;
    tip.hidden = false;
    const r = cell.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    let yPos = r.top - h - 8;
    if (yPos < 8) yPos = r.bottom + 8;
    tip.style.left = `${x}px`;
    tip.style.top = `${yPos}px`;
  }
  const hideTip = () => { $('#tip').hidden = true; };

  /* ---------- Archivo ---------- */
  function renderArchive() {
    const showSeg = settings.frase || frases.size > 0;
    $('#arc-mode').hidden = !showSeg;
    if (!showSeg) ui.arcMode = 'lineas';
    $$('#arc-mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.arc === ui.arcMode)));
    $('#q').placeholder = ui.arcMode === 'frases' ? 'Buscar en las frases' : 'Buscar una palabra o #etiqueta';
    if (ui.arcMode === 'frases') { renderFrasesList(); return; }
    const terms = ui.q.trim().split(/\s+/).filter(Boolean).map(fold);
    const tagTerms = terms.filter(x => x.startsWith('#')).map(x => x.slice(1)).filter(Boolean);
    const textTerms = terms.filter(x => !x.startsWith('#'));
    renderChips();
    let list = Array.from(entries.values());
    if (ui.tag) list = list.filter(e => e.etiquetas.includes(ui.tag));
    if (terms.length) {
      list = list.filter(e => {
        const ft = fold(e.texto);
        return textTerms.every(x => ft.includes(x)) && tagTerms.every(x => e.etiquetas.some(tg => fold(tg).startsWith(x)));
      });
    }
    const asc = settings.orden === 'asc';
    list.sort((a, b) => (a.fecha < b.fecha ? (asc ? -1 : 1) : (asc ? 1 : -1)));

    const total = entries.size;
    const note = $('#arc-note');
    const filtering = terms.length || ui.tag;
    if (!total) note.textContent = '';
    else if (filtering) note.textContent = list.length ? plural(list.length, 'resultado', 'resultados') : '';
    else note.textContent = `${plural(total, 'entrada', 'entradas')} · ${asc ? 'las más antiguas primero' : 'las más recientes primero'}`;
    $('#btn-sort').setAttribute('aria-label', asc ? 'Mostrar primero las más recientes' : 'Mostrar primero las más antiguas');

    const box = $('#arc-list');
    if (!total) {
      box.innerHTML = '<div class="empty-state"><p class="empty-title">Aún no hay entradas</p><p>Lo que escribas en Hoy aparecerá aquí, ordenado por fecha.</p></div>';
      return;
    }
    if (!list.length) {
      const q = ui.q.trim();
      box.innerHTML = `<div class="empty-state"><p class="empty-title">Nada coincide${q ? ` con «${esc(q)}»` : ''}</p><p>Prueba con otra palabra${ui.tag ? ' o quita la etiqueta' : ''}.</p></div>`;
      return;
    }
    let html = '', curMonth = '';
    for (const e of list) {
      const mk = e.fecha.slice(0, 7);
      const d = parseIso(e.fecha);
      if (mk !== curMonth) {
        if (curMonth) html += '</ul></section>';
        curMonth = mk;
        html += `<section class="arc-group"><h2 class="group-head">${cap(MONTHS[d.getMonth()])} de ${d.getFullYear()}</h2><ul class="arc-list">`;
      }
      const side = (e.animo || e.foto)
        ? `<span class="arc-side">${e.animo ? `<span class="arc-mood" role="img" aria-label="${esc(moodName(e.animo))}">${esc(e.animo)}</span>` : ''}${e.foto ? `<img class="thumb" alt="" data-photo="${e.fecha}">` : ''}</span>`
        : '';
      html += `<li><button type="button" class="arc-row" data-fecha="${e.fecha}" aria-label="${esc(cap(F.full.format(d)))}"><span class="arc-date" aria-hidden="true"><b>${d.getDate()}</b><span>${esc(F.wd.format(d).replace(/\./g, ''))}</span></span><span class="arc-text">${e.texto ? richText(e.texto, textTerms) : '<span class="muted">Sin texto</span>'}</span>${side}</button></li>`;
    }
    html += '</ul></section>';
    box.innerHTML = html;
    hydratePhotos(box, true);
  }

  /* Archivo → Frases: todas las frases del día, por fecha */
  function renderFrasesList() {
    $('#chips').hidden = true;
    const terms = ui.q.trim().split(/\s+/).filter(Boolean).map(fold).map(x => x.replace(/^#/, '')).filter(Boolean);
    let list = Array.from(frases.values()).filter(f => f.fecha <= ui.today);
    const total = list.length;
    if (terms.length) list = list.filter(f => { const ff = fold(f.frase); return terms.every(x => ff.includes(x)); });
    const asc = settings.orden === 'asc';
    list.sort((a, b) => (a.fecha < b.fecha ? (asc ? -1 : 1) : (asc ? 1 : -1)));
    const note = $('#arc-note');
    if (!total) note.textContent = '';
    else if (terms.length) note.textContent = list.length ? plural(list.length, 'resultado', 'resultados') : '';
    else note.textContent = `${plural(total, 'frase', 'frases')} · ${asc ? 'las más antiguas primero' : 'las más recientes primero'}`;
    $('#btn-sort').setAttribute('aria-label', asc ? 'Mostrar primero las más recientes' : 'Mostrar primero las más antiguas');
    const box = $('#arc-list');
    if (!total) {
      box.innerHTML = `<div class="empty-state"><p class="empty-title">Aún no hay frases</p><p>${settings.frase ? 'Cada día aparece una frase nueva en Hoy y se guarda aquí.' : 'Activa la frase del día en Ajustes para empezar a guardarlas.'}</p></div>`;
      return;
    }
    if (!list.length) {
      box.innerHTML = `<div class="empty-state"><p class="empty-title">Nada coincide con «${esc(ui.q.trim())}»</p><p>Prueba con otra palabra.</p></div>`;
      return;
    }
    let html = '', curMonth = '';
    for (const f of list) {
      const mk = f.fecha.slice(0, 7);
      const d = parseIso(f.fecha);
      if (mk !== curMonth) {
        if (curMonth) html += '</ul></section>';
        curMonth = mk;
        html += `<section class="arc-group"><h2 class="group-head">${cap(MONTHS[d.getMonth()])} de ${d.getFullYear()}</h2><ul class="arc-list">`;
      }
      const wrote = entries.has(f.fecha) ? '<span class="arc-side"><i class="wdot" role="img" aria-label="Escribiste ese día" title="Escribiste ese día"></i></span>' : '';
      html += `<li><button type="button" class="arc-row quote-row" data-fecha="${f.fecha}" aria-label="${esc(cap(F.full.format(d)))}"><span class="arc-date" aria-hidden="true"><b>${d.getDate()}</b><span>${esc(F.wd.format(d).replace(/\./g, ''))}</span></span><span class="arc-text">${richText(f.frase, terms)}</span>${wrote}</button></li>`;
    }
    html += '</ul></section>';
    box.innerHTML = html;
  }

  function renderChips() {
    const counts = new Map();
    for (const e of entries.values()) for (const tg of e.etiquetas) counts.set(tg, (counts.get(tg) || 0) + 1);
    const box = $('#chips');
    if (!counts.size) { box.hidden = true; box.innerHTML = ''; ui.tag = ''; return; }
    if (ui.tag && !counts.has(ui.tag)) ui.tag = '';
    const sorted = Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 30);
    box.hidden = false;
    box.innerHTML = sorted.map(([tg, n]) => `<button type="button" class="chip" data-tag="${esc(tg)}" aria-pressed="${ui.tag === tg}">#${esc(tg)}<span class="n">${n}</span></button>`).join('');
  }

  /* ---------- Hoja de un día ---------- */
  function openDay(fecha) {
    if (fecha === ui.today) { closeAllSheets(); go('hoy'); return; }
    if (fecha > ui.today) { toast('Ese día todavía no ha llegado'); return; }
    const d = parseIso(fecha);
    const s = openSheet({ title: cap(F.full.format(d)), className: 'day' });
    let editor = null;
    s.onClose(() => { if (editor) { editor.flush(); editor.destroy(); } });

    function view() {
      const e = entries.get(fecha);
      if (editor) { editor.flush(); editor.destroy(); editor = null; }
      s.body.replaceChildren();
      if (!e) { edit(true); return; }
      const wrap = el('div', { class: 'day-view' });
      wrap.append(el('p', { class: 'kicker', text: relLabel(fecha) }));
      if (e.animo) wrap.append(el('p', { class: 'day-mood', html: `<span>${esc(e.animo)}</span><span>${esc(moodName(e.animo))}</span>` }));
      wrap.append(el('p', { class: 'day-text', html: e.texto ? richText(e.texto) : '<span class="muted">Sin texto</span>' }));
      if (e.foto) {
        const ph = el('div', { class: 'day-photo' }, el('img', { alt: `Foto del ${F.dmy.format(d)}` }));
        photoURL(fecha).then(u => { if (u) $('img', ph).src = u; else ph.remove(); });
        wrap.append(ph);
      }
      const q = quoteBlock(fecha);
      if (q) wrap.append(q);
      s.body.append(wrap, el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn secondary', onclick: () => edit(false), html: `${ICON.pencil}<span>Editar</span>` }),
        el('button', {
          type: 'button', class: 'btn destructive', html: `${ICON.trash}<span>Eliminar</span>`,
          onclick: async () => {
            const ok = await confirmSheet({ title: '¿Eliminar esta entrada?', message: `Se borrará la línea del ${F.dmy.format(d)}${e.foto ? ' y su foto' : ''}. No se puede deshacer.`, confirm: 'Eliminar', destructive: true });
            if (!ok) return;
            await deleteEntry(fecha);
            s.close();
            toast('Entrada eliminada');
          }
        })
      ));
    }
    function edit(isNew) {
      s.body.replaceChildren();
      editor = createEditor({ placeholder: '¿Qué pasó este día?', label: `Línea del ${F.dmy.format(d)}` });
      editor.load(fecha);
      const q = quoteBlock(fecha);
      s.body.append(...[
        el('p', { class: 'kicker', text: isNew ? `${relLabel(fecha)} · sin escribir todavía` : relLabel(fecha) }),
        editor.el,
        q,
        el('div', { class: 'btn-stack' }, el('button', {
          type: 'button', class: 'btn primary',
          onclick: async () => { await editor.flush(); if (entries.has(fecha)) view(); else s.close(); }
        }, 'Listo'))
      ].filter(Boolean));
      if (!MQ_COARSE.matches) setTimeout(() => editor && editor.focus(), 80);
    }
    view();
  }

  /* ---------- Resumen del año ---------- */
  function yearStats(y) {
    const list = Array.from(entries.values()).filter(e => e.fecha.startsWith(`${y}-`)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const ty = +ui.today.slice(0, 4);
    const span = y === ty ? dayOfYear(ui.today) : daysInYear(y);
    let best = 0, run = 0, prev = null;
    const months = new Array(12).fill(0);
    const moods = new Map();
    const words = new Map();
    const tags = new Map();
    let totalWords = 0;
    for (const e of list) {
      run = prev && addDays(prev, 1) === e.fecha ? run + 1 : 1;
      if (run > best) best = run;
      prev = e.fecha;
      months[+e.fecha.slice(5, 7) - 1]++;
      if (e.animo) moods.set(e.animo, (moods.get(e.animo) || 0) + 1);
      totalWords += countWords(e.texto);
      for (const w of wordsOf(e.texto)) words.set(w, (words.get(w) || 0) + 1);
      for (const tg of e.etiquetas) tags.set(tg, (tags.get(tg) || 0) + 1);
    }
    const scored = list.filter(e => moodLevel(e.animo) >= 4);
    let bestDays, bestKind;
    if (scored.length) {
      bestKind = 'animo';
      bestDays = scored.sort((a, b) => moodLevel(b.animo) - moodLevel(a.animo) || glen(b.texto) - glen(a.texto) || (a.fecha < b.fecha ? 1 : -1)).slice(0, 6);
    } else {
      bestKind = 'largos';
      bestDays = list.slice().sort((a, b) => glen(b.texto) - glen(a.texto)).slice(0, 5);
    }
    bestDays.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const topMood = Array.from(moods).sort((a, b) => b[1] - a[1])[0] || null;
    const moodTotal = Array.from(moods.values()).reduce((a, b) => a + b, 0);
    return {
      y, list, span, best, months, moods, moodTotal, topMood, totalWords,
      words: Array.from(words).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 10),
      tags: Array.from(tags).sort((a, b) => b[1] - a[1]).slice(0, 12),
      bestDays, bestKind
    };
  }

  function openSummary(y) {
    const st = yearStats(y);
    const s = openSheet({ title: `Resumen de ${y}`, className: 'full' });
    const n = st.list.length;
    const pct = st.span ? Math.round((n / st.span) * 100) : 0;
    const maxM = Math.max(...st.months);
    const maxIdx = st.months.indexOf(maxM);
    const ty = +ui.today.slice(0, 4);
    const perDay = n ? Math.round(st.totalWords / n) : 0;

    const tiles = `
      <div class="sum-tiles">
        <div class="sum-tile"><span class="k">Días escritos</span><span class="v">${num(n)}</span><span class="s">${pct} % de ${num(st.span)} días</span></div>
        <div class="sum-tile"><span class="k">Racha más larga</span><span class="v">${num(st.best)}</span><span class="s">${st.best === 1 ? 'día' : 'días seguidos'}</span></div>
        <div class="sum-tile"><span class="k">Palabras</span><span class="v">${num(st.totalWords)}</span><span class="s">unas ${num(perDay)} por línea</span></div>
        <div class="sum-tile"><span class="k">Ánimo más habitual</span><span class="v">${st.topMood ? esc(st.topMood[0]) : '—'}</span><span class="s">${st.topMood ? `${esc(moodName(st.topMood[0]))} · ${Math.round((st.topMood[1] / st.moodTotal) * 100)} %` : 'Sin datos de ánimo'}</span></div>
      </div>`;

    const best = st.bestDays.length ? `
      <section>
        <h3>${st.bestKind === 'animo' ? 'Tus mejores días' : 'Días destacados'}</h3>
        ${st.bestKind === 'animo' ? '' : '<p class="sum-note">Marca tu ánimo al escribir y aquí aparecerán tus mejores días.</p>'}
        <ul class="best">${st.bestDays.map(e => `<li><button type="button" data-fecha="${e.fecha}"><span class="d">${esc(cap(F.dm.format(parseIso(e.fecha))))}</span><span class="t">${e.texto ? richText(e.texto) : '<span class="muted">Sin texto</span>'}</span>${e.animo ? `<span class="m" role="img" aria-label="${esc(moodName(e.animo))}">${esc(e.animo)}</span>` : ''}</button></li>`).join('')}</ul>
      </section>` : '';

    const bars = `
      <section>
        <h3>Días escritos por mes</h3>
        <div class="mbars" role="img" aria-label="${st.months.map((v, i) => `${MONTHS[i]}: ${v}`).join(', ')}">
          ${st.months.map((v, i) => `<div class="mbar${v ? '' : ' zero'}" style="--h:${maxM ? (v / maxM).toFixed(3) : 0}" title="${cap(MONTHS[i])}: ${plural(v, 'día', 'días')}">${i === maxIdx && v ? `<span class="v">${v}</span>` : ''}<i></i></div>`).join('')}
        </div>
        <div class="mlabels" aria-hidden="true">${MONTHS.map(m => `<span>${m.charAt(0)}</span>`).join('')}</div>
      </section>`;

    const moodParts = MOODS.map((m, i) => ({ m, i, v: st.moods.get(m) || 0 })).filter(p => p.v);
    const moodsHTML = st.moodTotal ? `
      <section>
        <h3>Ánimo del año</h3>
        <div class="segbar" role="img" aria-label="${moodParts.map(p => `${MOOD_NAMES[p.i]}: ${p.v}`).join(', ')}">${moodParts.map(p => `<i style="flex:${p.v};background:var(--mood-${p.i + 1})" title="${MOOD_NAMES[p.i]}: ${plural(p.v, 'día', 'días')}"></i>`).join('')}</div>
        <div class="seg-legend">${moodParts.map(p => `<span><i style="background:var(--mood-${p.i + 1})"></i>${p.m} ${MOOD_NAMES[p.i]} <b>${p.v}</b></span>`).join('')}</div>
      </section>` : '';

    const top = st.words.length ? st.words[0][1] : 0;
    const wordsHTML = st.words.length ? `
      <section>
        <h3>Palabras más usadas</h3>
        <ol class="ranks">${st.words.map(([w, c]) => `<li><span class="w">${esc(w)}</span><span class="b"><i style="--p:${(c / top).toFixed(3)}"></i></span><span class="c">${c}</span></li>`).join('')}</ol>
      </section>` : '';

    const tagsHTML = st.tags.length ? `
      <section>
        <h3>Etiquetas</h3>
        <div class="tag-row">${st.tags.map(([tg, c]) => `<span class="chip">#${esc(tg)}<span class="n">${c}</span></span>`).join('')}</div>
      </section>` : '';

    const closing = y < ty ? `Así fue tu ${y}, línea a línea.` : `Gracias por escribir. Nos leemos en ${y + 1}.`;
    s.body.innerHTML = `
      <div class="sum">
        <div class="sum-hero">
          <p class="eyebrow">Tu año en una línea</p>
          <p class="sum-year">${y}</p>
          <p class="sum-lead">${plural(n, 'día escrito', 'días escritos')} y ${plural(st.totalWords, 'palabra', 'palabras')}.</p>
        </div>
        ${tiles}${best}${bars}${moodsHTML}${wordsHTML}${tagsHTML}
        <p class="sum-end">${closing}</p>
      </div>`;
    s.body.addEventListener('click', e => {
      const b = e.target.closest('.best button[data-fecha]');
      if (b) openDay(b.dataset.fecha);
    });
  }

  /* ---------- Ajustes ---------- */
  function renderSettings() {
    const r = settings.recordatorio;
    $('#sw-rem').checked = !!r.activo;
    $('#in-hora').value = r.hora;
    $('#in-hora').disabled = !r.activo;
    $('#row-hora').classList.toggle('off', !r.activo);
    $('#row-atajo').hidden = !(IS_IOS || PREVIEW);
    $('#rem-foot').textContent = reminderFoot();

    $('#sw-frase').checked = !!settings.frase;
    $('#sw-pin').checked = !!settings.pin.activo;
    $('#row-pin-change').hidden = !settings.pin.activo;
    $('#row-pin-tras').hidden = !settings.pin.activo;
    $('#sel-tras').value = String(settings.pin.tras);

    $('#backup-foot').textContent = backupFoot();
    $('#g-tema').hidden = PREVIEW;
    $$('#seg-tema button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === settings.tema)));

    $('#g-preview').hidden = !PREVIEW;
    const standalone = isStandalone();
    $('#row-install').hidden = PREVIEW || standalone || !deferredInstall;
    $('#row-install-ios').hidden = PREVIEW || standalone || !IS_IOS;
    $('#row-installed').hidden = PREVIEW || !standalone;
    $('#row-update').hidden = !ui.updateReady;
    $('#row-demo-label').textContent = ui.demo ? 'Salir del diario de ejemplo' : 'Ver un diario de ejemplo';

    const n = (ui.demo && realEntries ? realEntries.size : entries.size);
    const foot = $('#app-foot');
    foot.textContent = `Versión ${VERSION} · ${plural(n, 'entrada', 'entradas')}`;
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(est => {
        if (est && est.usage) foot.textContent = `Versión ${VERSION} · ${plural(n, 'entrada', 'entradas')} · ${fmtBytes(est.usage)}`;
      }).catch(() => {});
    }
  }
  function fmtBytes(b) {
    if (b < 1024 * 1024) return `${num(Math.max(1, Math.round(b / 1024)))} KB`;
    return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(b / 1048576)} MB`;
  }
  function reminderFoot() {
    if (PREVIEW) return 'Los avisos funcionan en la app instalada desde tu propio enlace, no en la vista previa.';
    if (IS_IOS) {
      return isStandalone()
        ? 'En iPhone, la app solo puede avisarte mientras está abierta. Para un aviso fiable cada día, crea uno con Atajos.'
        : 'En iPhone, los avisos solo funcionan con la app añadida a la pantalla de inicio. La forma fiable es un aviso con Atajos.';
    }
    const periodic = typeof ServiceWorkerRegistration !== 'undefined' && 'periodicSync' in ServiceWorkerRegistration.prototype;
    return periodic
      ? 'Llega a su hora con la app abierta. Con la app instalada y cerrada, el sistema elige el momento y puede retrasarlo.'
      : 'Llega a su hora mientras la app o el navegador estén abiertos.';
  }
  function backupFoot() {
    const n = ui.demo && realEntries ? realEntries.size : entries.size;
    if (!settings.ultimaCopia) return n ? 'Aún no has hecho ninguna copia. Tus líneas solo están en este dispositivo.' : 'Tus líneas se guardan solo en este dispositivo.';
    const days = diffDays(isoOf(new Date(settings.ultimaCopia)), ui.today);
    const when = days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${num(days)} días`;
    return `Última copia: ${when}.${days > 30 ? ' Conviene hacer una nueva.' : ''}`;
  }

  /* ---------- PIN ---------- */
  const randomHex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
  async function hashPin(pin, salt) {
    const data = new TextEncoder().encode(`${salt}:${pin}`);
    try {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      let h = 0x811c9dc5;
      for (const b of data) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
      return `fnv${h.toString(16)}`;
    }
  }
  const verifyPin = async pin => !!settings.pin.hash && (await hashPin(pin, settings.pin.salt)) === settings.pin.hash;

  function createPinPad({ title, sub = '', onComplete }) {
    const root = el('div', { class: 'pinpad' });
    root.innerHTML = `<div class="pin-icon">${ICON.lock}</div><p class="pin-title"></p><p class="pin-sub"></p><div class="pin-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p class="pin-msg" role="alert"></p><div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<button type="button" class="key" data-k="${k}">${k}</button>`).join('')}<span></span><button type="button" class="key" data-k="0">0</button><button type="button" class="key ghost" data-k="del" aria-label="Borrar la última cifra">${ICON.del}</button></div>`;
    const dots = $$('.pin-dots i', root);
    const msg = $('.pin-msg', root);
    let pin = '', busy = false, until = 0, countdown = 0;
    const setTitle = (t, s = '') => { $('.pin-title', root).textContent = t; $('.pin-sub', root).textContent = s; };
    const draw = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
    function shake() {
      const box = $('.pin-dots', root);
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      try { if (navigator.vibrate) navigator.vibrate(60); } catch { /* nada */ }
    }
    async function press(k) {
      if (busy || Date.now() < until) return;
      if (k === 'del') { pin = pin.slice(0, -1); draw(); return; }
      if (pin.length >= 4) return;
      pin += k;
      draw();
      msg.textContent = '';
      if (pin.length < 4) return;
      busy = true;
      const value = pin;
      await wait(110);
      let r;
      try { r = await onComplete(value, api); } catch (e) { console.error(e); r = 'Algo falló. Inténtalo de nuevo.'; }
      busy = false;
      if (r !== true) {
        shake();
        pin = '';
        draw();
        if (typeof r === 'string') msg.textContent = r;
      }
    }
    root.addEventListener('click', e => { const b = e.target.closest('.key'); if (b) press(b.dataset.k); });
    const onKey = e => {
      if (!root.isConnected || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('del'); }
    };
    const api = {
      el: root,
      setTitle,
      reset(m = '') { pin = ''; busy = false; draw(); msg.textContent = m; },
      activate() { window.addEventListener('keydown', onKey); },
      deactivate() { window.removeEventListener('keydown', onKey); },
      cooldown(seconds) {
        until = Date.now() + seconds * 1000;
        $$('.key', root).forEach(k => { k.disabled = true; });
        clearInterval(countdown);
        const tick = () => {
          const left = Math.ceil((until - Date.now()) / 1000);
          if (left <= 0) {
            clearInterval(countdown);
            $$('.key', root).forEach(k => { k.disabled = false; });
            msg.textContent = '';
            return;
          }
          msg.textContent = `Demasiados intentos. Espera ${left} s.`;
        };
        tick();
        countdown = setInterval(tick, 500);
      }
    };
    setTitle(title, sub);
    return api;
  }

  /* Pantalla de bloqueo */
  let lockPad = null;
  let lockFails = 0;
  function buildLock() {
    const box = $('#lock');
    lockPad = createPinPad({
      title: 'Introduce tu PIN',
      sub: 'Diario de una línea',
      onComplete: async pin => {
        if (await verifyPin(pin)) { lockFails = 0; unlock(); return true; }
        lockFails++;
        if (lockFails >= 5) { lockFails = 0; lockPad.reset(); lockPad.cooldown(30); return true; }
        return 'PIN incorrecto';
      }
    });
    const forgot = el('button', { type: 'button', class: 'lock-forgot', text: '¿Has olvidado el PIN?' });
    const reset = el('div', { class: 'lock-reset', hidden: true });
    reset.innerHTML = '<p>El PIN no se puede recuperar. Puedes borrar el diario de este dispositivo y empezar de cero; si tienes una copia en JSON, podrás importarla después.</p>';
    let armed = false, armTimer = 0;
    const wipeBtn = el('button', { type: 'button', class: 'btn destructive', text: 'Borrar el diario de este dispositivo' });
    wipeBtn.addEventListener('click', async () => {
      if (!armed) {
        armed = true;
        wipeBtn.textContent = 'Toca otra vez para borrarlo todo';
        wipeBtn.className = 'btn destructive-solid';
        clearTimeout(armTimer);
        armTimer = setTimeout(() => { armed = false; wipeBtn.textContent = 'Borrar el diario de este dispositivo'; wipeBtn.className = 'btn destructive'; }, 5000);
        return;
      }
      await wipeAll();
    });
    const back = el('button', { type: 'button', class: 'btn plain', text: 'Volver', onclick: () => { reset.hidden = true; lockPad.el.hidden = false; forgot.hidden = false; } });
    reset.append(wipeBtn, back);
    forgot.addEventListener('click', () => { reset.hidden = false; lockPad.el.hidden = true; forgot.hidden = true; });
    box.append(lockPad.el, forgot, reset);
  }
  function lockApp() {
    if (ui.locked || !settings.pin.activo || !settings.pin.hash) return;
    ui.locked = true;
    flushAll();
    hideTip();
    document.documentElement.classList.add('locked');
    const box = $('#lock');
    box.hidden = false;
    $('.lock-reset', box).hidden = true;
    lockPad.el.hidden = false;
    $('.lock-forgot', box).hidden = false;
    lockPad.reset();
    lockPad.activate();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function unlock() {
    ui.locked = false;
    $('#lock').hidden = true;
    document.documentElement.classList.remove('locked');
    lockPad.deactivate();
  }

  /* Flujos de PIN: crear, quitar y cambiar */
  function pinFlow(mode) {
    return new Promise(resolve => {
      let ok = false, first = null;
      let step = mode === 'create' ? 'new' : 'verify';
      const s = openSheet({ title: mode === 'disable' ? 'Quitar el PIN' : mode === 'change' ? 'Cambiar el PIN' : 'Bloqueo con PIN' });
      const titles = {
        verify: ['Introduce tu PIN actual', ''],
        new: ['Elige un PIN de 4 cifras', 'Lo pedirá la app al abrirse.'],
        repeat: ['Repite el PIN', 'Para comprobar que no hay errores.']
      };
      const pad = createPinPad({
        title: titles[step][0],
        sub: titles[step][1],
        onComplete: async pin => {
          if (step === 'verify') {
            if (!(await verifyPin(pin))) return 'PIN incorrecto';
            if (mode === 'disable') {
              settings.pin = Object.assign({}, settings.pin, { activo: false, hash: null, salt: null });
              await saveSettings();
              ok = true; s.close(); toast('Bloqueo con PIN desactivado');
              return true;
            }
            step = 'new'; pad.setTitle(...titles.new); pad.reset();
            return true;
          }
          if (step === 'new') { first = pin; step = 'repeat'; pad.setTitle(...titles.repeat); pad.reset(); return true; }
          if (pin !== first) { first = null; step = 'new'; pad.setTitle(...titles.new); return 'Los PIN no coinciden. Empieza de nuevo.'; }
          const salt = randomHex(16);
          settings.pin = Object.assign({}, settings.pin, { activo: true, salt, hash: await hashPin(pin, salt) });
          await saveSettings();
          ok = true; s.close(); toast(mode === 'change' ? 'PIN cambiado' : 'Bloqueo con PIN activado');
          return true;
        }
      });
      s.body.append(pad.el);
      pad.activate();
      s.onClose(() => { pad.deactivate(); resolve(ok); });
    });
  }

  /* ---------- Copias: exportar ---------- */
  async function buildExport(withPhotos) {
    const list = Array.from(entries.values()).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const out = [];
    for (const e of list) {
      const o = { fecha: e.fecha, texto: e.texto, animo: e.animo || '', etiquetas: e.etiquetas.slice() };
      if (withPhotos && e.foto) {
        const b = await getPhotoBlob(e.fecha);
        if (b) o.foto = await blobToDataUrl(b);
      }
      if (e.creado) o.creado = e.creado;
      if (e.editado) o.editado = e.editado;
      out.push(o);
    }
    const fr = Array.from(frases.values())
      .filter(f => f.fecha <= ui.today)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map(f => ({ fecha: f.fecha, frase: f.frase }));
    return { app: APP_ID, version: 1, exportado: new Date().toISOString(), total: out.length, entradas: out, frases: fr };
  }
  async function markBackup() {
    settings.ultimaCopia = new Date().toISOString();
    await saveSettings();
    invalidate('ajustes');
  }
  function downloadFile(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function doExport() {
    if (ui.demo) { toast('Sal del diario de ejemplo para exportar el tuyo.'); return; }
    if (!entries.size && !frases.size) { toast('Aún no hay nada que exportar'); return; }
    let withPhotos = true;
    const photos = Array.from(entries.values()).filter(e => e.foto).length;
    if (photos) {
      const choice = await askSheet({
        title: 'Exportar copia',
        message: `Tu diario tiene ${plural(photos, 'foto', 'fotos')}. Incluirlas hace el archivo más pesado.`,
        options: [{ label: 'Con fotos', value: 'con', style: 'primary' }, { label: 'Solo el texto', value: 'sin' }]
      });
      if (!choice) return;
      withPhotos = choice === 'con';
    }
    const data = await buildExport(withPhotos);
    const json = JSON.stringify(data, null, withPhotos && photos ? 0 : 2);
    const name = `diario-una-linea-${ui.today}.json`;
    if (PREVIEW) { exportPreviewSheet(json); return; }
    const blob = new Blob([json], { type: 'application/json' });
    let file = null;
    try { file = new File([blob], name, { type: 'application/json' }); } catch { /* Safari antiguo */ }
    if (MQ_COARSE.matches && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      const s = openSheet({ title: 'Copia lista' });
      s.body.append(
        el('p', { class: 'ask-msg', text: `${plural(data.total, 'entrada', 'entradas')} · ${fmtBytes(blob.size)}. Guárdala en Archivos, en tu nube o envíatela.` }),
        el('div', { class: 'btn-stack' },
          el('button', {
            type: 'button', class: 'btn primary', html: `${ICON.share}<span>Guardar o compartir</span>`,
            onclick: async () => {
              try { await navigator.share({ files: [file], title: 'Diario de una línea' }); s.close(); markBackup(); toast('Copia guardada'); }
              catch (err) { if (err && err.name !== 'AbortError') { downloadFile(blob, name); s.close(); markBackup(); } }
            }
          }),
          el('button', { type: 'button', class: 'btn plain', text: 'Descargar el archivo', onclick: () => { downloadFile(blob, name); s.close(); markBackup(); } })
        )
      );
      return;
    }
    downloadFile(blob, name);
    markBackup();
    toast(`Copia descargada: ${name}`);
  }
  function exportPreviewSheet(json) {
    const s = openSheet({ title: 'Copia de tu diario' });
    const area = el('textarea', { class: 'code', readonly: true, 'aria-label': 'Copia en JSON' });
    area.value = json;
    s.body.append(
      el('p', { class: 'ask-msg', text: 'En la vista previa no se pueden descargar archivos. Copia el texto y pégalo en un archivo .json, o instala la app desde tu enlace para descargarla directamente.' }),
      area,
      el('div', { class: 'btn-stack' }, el('button', {
        type: 'button', class: 'btn primary', html: `${ICON.copy}<span>Copiar</span>`,
        onclick: async () => {
          try { await navigator.clipboard.writeText(json); toast('Copia en el portapapeles'); markBackup(); }
          catch { area.focus(); area.select(); toast('Selecciona el texto y cópialo'); }
        }
      }))
    );
  }

  /* ---------- Copias: importar ---------- */
  function parseImport(data) {
    let raw = [];
    if (Array.isArray(data)) raw = data.map(x => [x, null]);
    else if (data && Array.isArray(data.entradas)) raw = data.entradas.map(x => [x, null]);
    else if (data && typeof data === 'object') raw = Object.entries(data).filter(([k]) => isValidIso(k)).map(([k, v]) => [v, k]);
    const list = new Map();
    const fotos = new Map();
    let skipped = 0;
    for (const [rawItem, key] of raw) {
      const item = typeof rawItem === 'string' ? { texto: rawItem } : rawItem;
      const e = normEntry(item, key);
      if (!e) { skipped++; continue; }
      e.foto = false;
      if (typeof item.foto === 'string' && item.foto.startsWith('data:image/')) {
        try { fotos.set(e.fecha, dataUrlToBlob(item.foto)); e.foto = true; } catch { /* foto ilegible */ }
      }
      if (!e.texto && !e.animo && !e.foto) { skipped++; continue; }
      list.set(e.fecha, e);
    }
    const fr = new Map();
    if (data && Array.isArray(data.frases)) {
      for (const x of data.frases) {
        if (!x || !isValidIso(x.fecha) || typeof x.frase !== 'string' || !x.frase.trim()) continue;
        const frase = cleanText(x.frase).slice(0, 300);
        fr.set(x.fecha, { fecha: x.fecha, frase, i: FRASES.indexOf(frase) });
      }
    }
    return { list: Array.from(list.values()), fotos, skipped, frases: Array.from(fr.values()) };
  }
  async function doImport(file) {
    if (ui.demo) { toast('Sal del diario de ejemplo para importar una copia.'); return; }
    let data;
    try { data = JSON.parse(await file.text()); }
    catch { await infoSheet('Archivo no válido', 'No es un JSON válido. Elige una copia exportada desde Diario de una línea.'); return; }
    const { list, fotos, skipped, frases: fileFrases } = parseImport(data);
    if (!list.length && !fileFrases.length) { await infoSheet('Nada que importar', 'El archivo no contiene entradas con una fecha válida (AAAA-MM-DD).'); return; }
    const clashes = list.filter(e => entries.has(e.fecha)).length;
    const parts = [`El archivo tiene ${plural(list.length, 'entrada', 'entradas')}${fileFrases.length ? ` y ${plural(fileFrases.length, 'frase del día', 'frases del día')}` : ''}`];
    if (clashes) parts.push(`${num(clashes)} ${clashes === 1 ? 'coincide' : 'coinciden'} con días que ya tienes`);
    if (skipped) parts.push(`${num(skipped)} no se ${skipped === 1 ? 'puede leer' : 'pueden leer'} y se ${skipped === 1 ? 'omitirá' : 'omitirán'}`);
    const options = [{ label: 'Combinar con mi diario', value: 'merge', style: 'primary' }];
    if (entries.size) options.push({ label: 'Reemplazar todo mi diario', value: 'replace', style: 'destructive' });
    const choice = await askSheet({
      title: 'Importar copia',
      message: `${parts.join('; ')}.${clashes ? ' Al combinar, en esos días se queda la versión editada más recientemente.' : ''}`,
      options
    });
    if (!choice) return;
    if (choice === 'replace') {
      const ok = await confirmSheet({ title: '¿Reemplazar todo?', message: `Se borrarán tus ${plural(entries.size, 'entrada', 'entradas')} actuales y se sustituirán por las del archivo.`, confirm: 'Reemplazar', destructive: true });
      if (!ok) return;
    }
    let toWrite = list, toPhotos = fotos;
    if (choice === 'merge') {
      toWrite = [];
      toPhotos = new Map();
      for (const e of list) {
        const cur = entries.get(e.fecha);
        let take = true;
        if (cur) take = !!(e.editado && (!cur.editado || e.editado > cur.editado));
        if (!take) continue;
        if (cur && cur.foto && !fotos.has(e.fecha)) e.foto = true;
        toWrite.push(e);
        if (fotos.has(e.fecha)) toPhotos.set(e.fecha, fotos.get(e.fecha));
      }
    }
    // Frases: al combinar se añaden las de días que no tienen; al reemplazar mandan las del archivo
    const replaceFrases = choice === 'replace' && fileFrases.length > 0;
    const frasesToWrite = replaceFrases ? fileFrases : fileFrases.filter(f => !frases.has(f.fecha));
    try {
      await Store.bulk(toWrite, toPhotos, choice === 'replace', frasesToWrite, replaceFrases);
    } catch (err) {
      console.error(err);
      await infoSheet('No se pudo importar', 'El dispositivo no permitió guardar la copia. Puede que no quede espacio libre.');
      return;
    }
    if (choice === 'replace') entries.clear();
    toWrite.forEach(e => entries.set(e.fecha, e));
    if (replaceFrases) frases.clear();
    frasesToWrite.forEach(f => frases.set(f.fecha, f));
    dropAllURLs();
    invalidate();
    toast(choice === 'replace' ? `Diario reemplazado: ${plural(toWrite.length, 'entrada', 'entradas')}` : `${plural(toWrite.length, 'entrada importada', 'entradas importadas')}`);
  }

  /* ---------- Borrar todo ---------- */
  async function wipeAll() {
    try { await Store.clear(); } catch (e) { console.error(e); }
    entries.clear();
    realEntries = null;
    frases.clear();
    realFrases = null;
    demoPhotos.clear();
    ui.demo = false;
    document.documentElement.classList.remove('demo');
    $('#demo-banner').hidden = true;
    dropAllURLs();
    settings = clone(DEFAULTS);
    if (PREVIEW) settings.ejemploVisto = true;
    await saveSettings();
    try { localStorage.removeItem('dul.lock'); } catch { /* nada */ }
    applyTheme();
    scheduleReminder();
    if (ui.locked) unlock();
    closeAllSheets();
    hoyEditor.load(ui.today);
    invalidate();
    go('hoy');
    toast('Diario borrado de este dispositivo');
  }

  /* ---------- Recordatorio ---------- */
  let remTimer = 0;
  function scheduleReminder() {
    clearTimeout(remTimer);
    const r = settings.recordatorio;
    if (!r.activo || PREVIEW) return;
    const now = new Date();
    const [h, m] = String(r.hora || '21:30').split(':').map(Number);
    const at = new Date(now);
    at.setHours(h || 0, m || 0, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    remTimer = setTimeout(fireReminder, Math.min(at - now, 2147000000));
  }
  async function fireReminder() {
    const t = todayIso();
    const written = ui.demo && realEntries ? realEntries.has(t) : entries.has(t);
    if (!written) {
      let last = null;
      try { last = await Store.getMeta('ultimoAviso'); } catch { /* nada */ }
      if (last !== t) {
        await notify();
        try { await Store.setMeta('ultimoAviso', t); } catch { /* nada */ }
      }
    }
    scheduleReminder();
  }
  async function notify() {
    if (document.visibilityState === 'visible') {
      toast('Aún no has escrito la línea de hoy', { action: 'Escribir', duration: 9000, onAction: () => { go('hoy'); setTimeout(() => hoyEditor.focus(), 120); } });
      return;
    }
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const opts = { body: '¿Cómo resumirías hoy en una línea?', tag: 'recordatorio', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#hoy' } };
      const reg = swReg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
      if (reg) await reg.showNotification('Diario de una línea', opts);
      else new Notification('Diario de una línea', opts);
    } catch (e) { console.warn(e); }
  }
  async function registerPeriodic() {
    try {
      if (!swReg || !('periodicSync' in swReg)) return;
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state !== 'granted') return;
      await swReg.periodicSync.register('recordatorio-diario', { minInterval: 6 * 60 * 60 * 1000 });
    } catch { /* no disponible */ }
  }
  async function unregisterPeriodic() {
    try { if (swReg && 'periodicSync' in swReg) await swReg.periodicSync.unregister('recordatorio-diario'); } catch { /* nada */ }
  }
  async function setReminder(on) {
    const sw = $('#sw-rem');
    if (!on) {
      settings.recordatorio.activo = false;
      await saveSettings();
      scheduleReminder();
      unregisterPeriodic();
      invalidate('ajustes');
      toast('Aviso diario desactivado');
      return;
    }
    if (PREVIEW) { sw.checked = false; toast('Los avisos funcionan en la app instalada, no en la vista previa.'); return; }
    if (!('Notification' in window)) {
      sw.checked = false;
      if (IS_IOS) { atajoSheet(); return; }
      toast('Este navegador no permite avisos.');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; } }
    if (perm !== 'granted') { sw.checked = false; toast('Sin permiso para avisarte. Actívalo en los ajustes del navegador.'); return; }
    settings.recordatorio.activo = true;
    await saveSettings();
    scheduleReminder();
    registerPeriodic();
    invalidate('ajustes');
    toast(`Te avisaré a las ${settings.recordatorio.hora} si aún no has escrito`);
  }
  function atajoSheet() {
    const s = openSheet({ title: 'Aviso diario con Atajos' });
    s.body.innerHTML = `
      <p class="ask-msg">El iPhone no deja que una app web se programe avisos sola. La app Atajos sí puede avisarte cada día a la misma hora:</p>
      <ol class="steps">
        <li><span>Abre <b>Atajos</b> y entra en la pestaña <b>Automatización</b>.</span></li>
        <li><span>Toca <b>+</b> y elige <b>Hora del día</b>.</span></li>
        <li><span>Pon la hora (por ejemplo, ${esc(settings.recordatorio.hora)}), marca <b>Diariamente</b> y <b>Ejecutar inmediatamente</b>.</span></li>
        <li><span>Toca <b>Siguiente</b>, crea un atajo nuevo y añade la acción <b>Mostrar notificación</b> con el texto «Escribe tu línea de hoy».</span></li>
        <li><span>Cuando llegue el aviso, abre <b>Una línea</b> desde la pantalla de inicio.</span></li>
      </ol>
      <p class="note">No uses la acción «Abrir URL»: abre la página en Safari, que guarda los datos aparte de la app instalada.</p>
      <p class="note">Otra opción: un recordatorio que se repita cada día en la app Recordatorios.</p>`;
  }
  function iosInstallSheet() {
    const s = openSheet({ title: 'Añadir a la pantalla de inicio' });
    s.body.innerHTML = `
      <ol class="steps">
        <li><span>Abre esta página en <b>Safari</b>.</span></li>
        <li><span>Toca <b>Compartir</b>. Si no lo ves, está dentro del botón <b>•••</b>.</span></li>
        <li><span>Elige <b>Añadir a pantalla de inicio</b> y confirma con <b>Añadir</b>.</span></li>
      </ol>
      <p class="note">Hazlo antes de empezar a escribir: Safari y la app instalada guardan las líneas por separado. Si ya escribiste en Safari, exporta una copia aquí e impórtala en la app.</p>`;
  }

  /* ---------- Instalación y actualizaciones ---------- */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstall = e;
    invalidate('hoy', 'ajustes');
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    toast('App instalada');
    invalidate('hoy', 'ajustes');
  });
  async function promptInstall() {
    if (!deferredInstall) return;
    const ev = deferredInstall;
    deferredInstall = null;
    ev.prompt();
    try { await ev.userChoice; } catch { /* nada */ }
    invalidate('hoy', 'ajustes');
  }
  function registerSW() {
    if (PREVIEW || !('serviceWorker' in navigator)) return;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (location.protocol !== 'https:' && !local) return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      swReg = reg;
      if (settings.recordatorio.activo) registerPeriodic();
    }).catch(err => console.warn('Service worker:', err));
    navigator.serviceWorker.addEventListener('message', e => {
      const d = e.data || {};
      if (d.type === 'UPDATED') {
        ui.updateReady = true;
        invalidate('ajustes');
        toast('Hay una versión nueva de la app', { action: 'Cargar', duration: 9000, onAction: reloadApp });
      } else if (d.type === 'GO' && TABS.includes(d.tab)) {
        go(d.tab);
      }
    });
  }
  async function reloadApp() { await flushAll(); location.reload(); }

  /* ---------- Tema ---------- */
  function applyTheme() {
    const r = document.documentElement;
    if (!PREVIEW) {
      if (settings.tema === 'claro') r.setAttribute('data-theme', 'light');
      else if (settings.tema === 'oscuro') r.setAttribute('data-theme', 'dark');
      else r.removeAttribute('data-theme');
    }
    paintThemeColor();
  }
  function paintThemeColor() {
    const forced = settings.tema === 'claro' ? '#ffffff' : settings.tema === 'oscuro' ? '#000000' : null;
    $$('meta[name="theme-color"]').forEach(m => {
      const dark = /dark/.test(m.getAttribute('media') || '');
      m.setAttribute('content', forced || (dark ? '#000000' : '#ffffff'));
    });
  }

  /* ---------- Diario de ejemplo ---------- */
  const DEMO_POOL = [
    // [texto, ánimo 1-5, estación ('' cualquiera, p primavera, v verano, o otoño, i invierno), escena de foto]
    ['Primer café en la terraza nueva. El barrio huele a pan recién hecho.', 4, ''],
    ['Videollamada larga con Sara. Parece que estuviera aquí al lado. #amigos', 4, ''],
    ['Ordené el armario y encontré fotos de hace diez años.', 4, ''],
    ['Me dolía la cabeza todo el día. Poco que contar.', 1, ''],
    ['Discusión tonta en casa. Al final pedimos perdón los dos. #familia', 2, ''],
    ['Clase de guitarra: por fin me sale el cambio de do a sol. #música', 4, ''],
    ['Corrí 5 km sin parar por primera vez. #deporte', 5, ''],
    ['Día de recados: banco, correos y farmacia. Pura logística.', 3, ''],
    ['Comida con la abuela. Me enseñó a hacer sus croquetas. #familia', 5, ''],
    ['Vi una serie entera en un domingo. Sin remordimientos. #cine', 4, ''],
    ['Entregué el trabajo a las 23:58. Al límite, pero entregado. #clase', 3, ''],
    ['No pasó nada especial, y eso también está bien.', 3, ''],
    ['Me cancelaron el plan a última hora. Aproveché para leer. #lectura', 2, ''],
    ['Mercadillo del sábado: un vinilo por dos euros. #música', 4, ''],
    ['Ayudé a un vecino con la mudanza. Agujetas aseguradas.', 4, ''],
    ['Exposición de fotografía en el museo. Salí con ganas de hacer fotos.', 4, ''],
    ['Noche de juegos de mesa. Gané al Catan por primera vez. #amigos', 5, ''],
    ['Cansancio acumulado. Necesito un fin de semana sin planes.', 1, ''],
    ['Se me rompió el móvil. Un día raro sin pantalla, casi lo agradezco.', 2, ''],
    ['Hoy aprendí a hacer pan. Quedó plano, pero rico.', 4, ''],
    ['Reunión eterna. Lo mejor del día fue el café de después.', 3, ''],
    ['Paseo por el casco antiguo con Laura. Hablamos de todo y de nada. #amigos', 4, ''],
    ['Me salió bien la presentación. Hasta me hicieron preguntas. #clase', 5, ''],
    ['Mal día. Mañana será otro.', 1, ''],
    ['Escuché un disco entero sin hacer nada más. Hacía años. #música', 4, ''],
    ['Encontré una librería escondida con un gato en el escaparate. #lectura', 5, ''],
    ['Fiesta sorpresa para Marcos. No sospechó nada. #amigos', 5, ''],
    ['Clase cancelada: tarde libre inesperada. #clase', 4, ''],
    ['Limpieza de fotos del móvil: 1.200 menos.', 3, ''],
    ['Paseo nocturno. La ciudad en silencio es otra.', 4, ''],
    ['Me equivoqué de autobús y acabé conociendo otro barrio.', 3, ''],
    ['Cena en casa con amigos: cada uno trajo un plato. #amigos', 5, ''],
    ['Lunes duro. El café no hizo efecto.', 2, ''],
    ['Llamé a mi padre solo para charlar. Deberíamos hacerlo más. #familia', 4, ''],
    ['Maratón de pelis de los noventa con palomitas. #cine', 4, ''],
    ['Terminé el curso online. Diploma en PDF y orgullo de verdad. #clase', 5, ''],
    ['Atasco de una hora. Al menos terminé un pódcast.', 2, ''],
    ['Fui a la biblioteca a estudiar y acabé leyendo poesía. #lectura', 4, ''],
    ['Corrí bajo la lluvia. Volví empapado y contento. #deporte', 5, ''],
    ['Día tranquilo. Ordené la mesa y la cabeza.', 4, ''],
    ['Pequeña victoria: arreglé el grifo yo solo.', 5, ''],
    ['Me costó levantarme. Me costó todo, en realidad.', 1, ''],
    ['Tarde de museo gratis. Mi cuadro favorito, el más pequeño.', 4, ''],
    ['Me reí muchísimo con un vídeo tonto. Me hacía falta.', 4, ''],
    ['Domingo de recetas: lasaña para toda la semana.', 4, ''],
    ['Me encontré a una amiga del colegio en el metro. Diez años sin vernos. #amigos', 5, ''],
    ['Uno de esos días que se pasan sin enterarte.', 3, ''],
    ['Película en versión original. Entendí casi todo. #cine', 4, ''],
    ['Me quedé sin batería a mitad de camino y pregunté direcciones como antes.', 3, ''],
    ['Desayuno largo, sin mirar el reloj.', 5, ''],
    ['Hoy me sentí un poco solo. Escribirlo ayuda.', 2, ''],
    ['Visité a los abuelos. El huerto está precioso. #familia', 5, ''],
    ['Tarde en el planetario. Me sentí diminuto.', 5, ''],
    ['Una hora en la cola del supermercado. Paciencia de experto.', 2, ''],
    ['El perro de la vecina me saluda cada mañana desde la ventana.', 4, ''],
    ['Plan improvisado: tapas y paseo por el puerto. #amigos', 5, '', 'puerto'],
    ['Lluvia, auriculares y un disco nuevo. #música', 4, ''],
    ['Día productivo: todo tachado de la lista.', 5, ''],
    ['Día improductivo: nada tachado de la lista. También pasa.', 3, ''],
    ['Me corté el pelo. Me lo tengo que creer.', 3, ''],
    ['Por fin llegó el paquete que esperaba desde hace un mes.', 4, ''],
    ['Volví a ver mi película favorita. Sigue funcionando. #cine', 5, ''],
    ['Tarde de estudio en la cafetería. Tres cafés después… #clase', 4, ''],
    ['Mi equipo ganó en el último minuto. Grité como nunca. #deporte', 5, ''],
    ['Mi equipo perdió. No quiero hablar de ello. #deporte', 2, ''],
    ['Una amiga me pidió consejo. Me sentí útil. #amigos', 4, ''],
    ['Escribí una carta a mano. Ya no recordaba mi letra.', 4, ''],
    ['Me equivoqué en algo importante. Lo arreglé. Aprendido.', 2, ''],
    ['El primer día en meses sin prisa.', 5, ''],
    ['Se fue la luz dos horas. Velas y conversación.', 4, ''],
    ['Taller de fotografía: aprendí a usar el modo manual.', 4, ''],
    ['Atardecer desde el mirador con un bocadillo. Plan perfecto.', 5, '', 'atardecer'],
    ['Clase de cerámica: mi taza parece un cenicero. #clase', 5, ''],
    ['Fui al gimnasio aunque no me apetecía. Salí nuevo. #deporte', 4, ''],
    ['Cocinamos juntos en casa de Ana. Sobró de todo. #amigos', 4, ''],
    ['Me perdí por el centro sin mapa, a propósito.', 4, ''],
    ['Atardecer naranja desde el puente. Me paré cinco minutos a mirarlo.', 5, '', 'atardecer'],
    ['Examen de inglés aprobado. Helado de pistacho para celebrarlo. #clase', 5, ''],
    ['Día gris. Poca energía, pero salí a caminar media hora y ayudó.', 3, ''],
    ['Cena con los primos. Mi tía sigue contando las mismas historias y siguen haciendo gracia. #familia', 5, ''],
    ['Me quedé dormido y llegué tarde a todo. Mañana, alarma doble.', 2, ''],
    ['Terminé el libro que empecé hace meses. El final me dejó pensando. #lectura', 4, ''],
    ['Partido de pádel: perdimos 6-2, 6-3 y aun así fue divertido. #deporte', 4, ''],
    ['Mucho trabajo y poca cabeza. Hoy toca dormir pronto.', 2, ''],
    ['Probé a hacer tortilla sin cebolla. Error. Nunca más.', 3, ''],
    ['Concierto pequeño en un bar del centro. Acústico, sin prisas, perfecto. #música', 5, ''],
    ['Hice una lista de lugares a los que quiero ir este año. #viaje', 4, ''],
    ['Volvió la rutina. Me gusta más de lo que admito.', 4, ''],
    ['Picnic en el parque. Las hormigas también vinieron.', 4, 'p'],
    ['Tarde de bici con Pablo. Pinchamos dos veces. #amigos #deporte', 4, 'p'],
    ['Mañana de mercado con mamá. Fruta de temporada y charla. #familia', 4, 'p'],
    ['Escapada a la sierra: almendros en flor y frío en las manos. #viaje', 5, 'p', 'montana'],
    ['Madrugón para ver amanecer en la playa. Valió cada minuto. #viaje', 5, 'v', 'playa'],
    ['Primer baño del año en el mar. El agua, helada. #viaje', 5, 'v'],
    ['Cine de verano al aire libre. Película mala, noche buenísima. #cine', 4, 'v'],
    ['Ruta en bici por el río: 30 km y un bocadillo de tortilla. #deporte', 5, 'v'],
    ['Tormenta de verano: olor a tierra mojada desde la ventana.', 4, 'v'],
    ['Día de calor insoportable. Ventilador y gazpacho.', 3, 'v'],
    ['Excursión al lago. Agua transparente y silencio. #viaje', 5, 'v', 'lago'],
    ['Festival en el pueblo: verbena hasta las tantas. #amigos', 5, 'v'],
    ['Me picó una medusa. Verano completo. #viaje', 2, 'v'],
    ['Leí en la playa hasta que se fue el sol. #lectura #viaje', 5, 'v'],
    ['Cena en una terraza con vistas a la catedral. #viaje', 5, 'v'],
    ['Concierto de jazz en el parque. Gratis y precioso. #música', 5, 'v'],
    ['Ruta por la costa: calas escondidas y agua turquesa. #viaje', 5, 'v', 'playa'],
    ['Viaje en coche con la música a todo volumen. #viaje #música', 5, 'v'],
    ['Tren a Valencia. Paella frente al mar y paseo por el Turia. #viaje', 5, 'v'],
    ['Primer frío de otoño. Saqué la chaqueta del armario.', 4, 'o'],
    ['Castañas asadas en el balcón. #familia', 5, 'o'],
    ['Hojas amarillas por todo el parque. Paseo largo.', 4, 'o'],
    ['Llovió toda la tarde y no me importó: película, manta y sopa.', 4, 'o'],
    ['Volví a la biblioteca después del verano. Huele igual. #lectura', 4, 'o'],
    ['Mercado de Navidad con luces por todas partes. #familia', 4, 'i'],
    ['Rebajas. Volví con un jersey y sin la mitad del sueldo.', 3, 'i'],
    ['Nevó un poco en la sierra. Bocadillo con vistas. #viaje', 5, 'i', 'nieve'],
    ['Escapada de fin de semana a la montaña. Casa rural y chimenea. #viaje', 5, 'i'],
    ['Resfriado: caldo, pañuelos y series. #cine', 1, 'i'],
    ['Domingo de sofá y lluvia. Necesario.', 4, 'i']
  ];
  const DEMO_PINNED = {
    '01-01': ['Año nuevo, mismo yo, pero con más ganas.', 4],
    '01-06': ['Reyes: me regalaron un libro que ya tenía. Lo cambiaré. #lectura', 4],
    '02-03': ['Semana de exámenes. Apuntes por todas partes. #clase', 2],
    '02-09': ['Exámenes aprobados. Todos. #clase', 5],
    '03-08': ['Cumpleaños de mamá. Tarta de queso y risas hasta tarde. #familia', 5],
    '03-20': ['Primer día de primavera con manga corta.', 4],
    '04-23': ['Día del Libro: tres firmas y un café con una autora. #lectura', 5],
    '05-05': ['Me regalaron una planta. Le he puesto nombre: Ramón.', 4],
    '05-12': ['Ramón sigue vivo. Primera semana superada.', 4],
    '06-23': ['Noche de San Juan en la playa. Hogueras y deseos. #amigos', 5, 'playa'],
    '07-01': ['Primer día en el trabajo de verano. Todo nuevo, todo raro.', 3],
    '07-15': ['Segunda semana en el trabajo. Ya sé dónde está la impresora.', 4],
    '08-12': ['Aprendí a hacer el nudo de la corbata para la boda de mi prima. #familia', 4],
    '08-14': ['Boda de mi prima. Bailé hasta que me dolieron los pies. #familia', 5],
    '12-24': ['Nochebuena: demasiada comida y la familia justa. #familia', 5],
    '12-31': ['Último día del año en pijama, con uvas y propósitos. #familia', 5]
  };
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const SEASON = m => (m >= 3 && m <= 5 ? 'p' : m >= 6 && m <= 8 ? 'v' : m >= 9 && m <= 11 ? 'o' : 'i');

  /* Paisajes dibujados para las fotos de ejemplo */
  const SCENES = {
    atardecer: { sky: ['#2b2d5c', '#c0566b', '#f6a55d'], sun: '#ffd8a0', sunY: 0.62, sea: '#3a2c4a', hills: '#5a3550' },
    playa: { sky: ['#7fb8e6', '#c7e2f3', '#fde6c5'], sun: '#fff4d6', sunY: 0.5, sea: '#2f86b6', sand: '#ecd3a5' },
    lago: { sky: ['#9ccbe8', '#d7ecf7', '#f2f7f5'], sun: '#ffffff', sunY: 0.32, sea: '#3f7f8f', hills: '#4f7a5a' },
    montana: { sky: ['#a9c6e8', '#e3eef8', '#f7eef2'], sun: '#fffaf0', sunY: 0.3, hills: '#7b8fa8', snow: '#ffffff' },
    nieve: { sky: ['#b8c9dc', '#e6edf3', '#f4f6f8'], sun: '#ffffff', sunY: 0.36, hills: '#d9e2ea', snow: '#ffffff' },
    puerto: { sky: ['#21385e', '#4b6a95', '#e59a6b'], sun: '#ffd28a', sunY: 0.66, sea: '#1c2e4a', hills: '#2b3550' }
  };
  function paintScene(kind, seed) {
    const sc = SCENES[kind] || SCENES.atardecer;
    const rnd = mulberry32(seed);
    const W = 960, H = 720;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, sc.sky[0]); sky.addColorStop(0.6, sc.sky[1]); sky.addColorStop(1, sc.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const sx = W * (0.3 + rnd() * 0.4), sy = H * sc.sunY;
    const glow = g.createRadialGradient(sx, sy, 10, sx, sy, 260);
    glow.addColorStop(0, sc.sun); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.fillStyle = sc.sun; g.beginPath(); g.arc(sx, sy, 58, 0, Math.PI * 2); g.fill();
    if (sc.hills) {
      g.fillStyle = sc.hills;
      g.beginPath(); g.moveTo(0, H * 0.7);
      for (let x = 0; x <= W; x += 60) g.lineTo(x, H * (0.6 + rnd() * 0.08) - (kind === 'montana' || kind === 'nieve' ? Math.sin(x / 140) * 90 : 0));
      g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      if (sc.snow) {
        g.fillStyle = sc.snow;
        g.globalAlpha = 0.85;
        for (let i = 0; i < 4; i++) { const px = rnd() * W; g.beginPath(); g.moveTo(px - 60, H * 0.56); g.lineTo(px, H * 0.47); g.lineTo(px + 60, H * 0.56); g.closePath(); g.fill(); }
        g.globalAlpha = 1;
      }
    }
    if (sc.sea) {
      const sea = g.createLinearGradient(0, H * 0.68, 0, H);
      sea.addColorStop(0, sc.sea); sea.addColorStop(1, '#0b1626');
      g.fillStyle = sea; g.fillRect(0, H * 0.68, W, H * 0.32);
      g.fillStyle = sc.sun; g.globalAlpha = 0.35;
      for (let i = 0; i < 9; i++) g.fillRect(sx - 70 + rnd() * 40, H * 0.7 + i * 22, 100 - i * 8, 3);
      g.globalAlpha = 1;
    }
    if (sc.sand) {
      g.fillStyle = sc.sand;
      g.beginPath(); g.moveTo(0, H * 0.86); g.quadraticCurveTo(W * 0.5, H * 0.8, W, H * 0.9); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    }
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.84));
  }

  async function buildDemo() {
    const rnd = mulberry32(20261104);
    const t = ui.today;
    const start = addDays(t, -420);
    const forced = new Set([addMonths(t, -12), addMonths(t, -1), addDays(t, -7)]);
    for (let i = 1; i <= 12; i++) forced.add(addDays(t, -i));
    for (let i = 150; i <= 190; i++) forced.add(addDays(t, -i));
    const gaps = new Set();
    for (const g0 of [60, 230, 300]) for (let i = 0; i < 4; i++) gaps.add(addDays(t, -(g0 + i)));
    const uses = new Map();
    const usedPinned = new Set();
    const list = [];
    const photoJobs = [];
    let photoCount = 0;
    for (let f = start; f < t; f = addDays(f, 1)) {
      if (!forced.has(f) && (gaps.has(f) || rnd() < 0.14)) continue;
      const md = f.slice(5);
      const m = +f.slice(5, 7);
      let line = null;
      if (DEMO_PINNED[md] && !usedPinned.has(md)) { line = DEMO_PINNED[md]; usedPinned.add(md); }
      else {
        const season = SEASON(m);
        const pool = DEMO_POOL.filter(l => !l[2] || l[2] === season);
        let min = Infinity;
        for (const l of pool) min = Math.min(min, uses.get(l[0]) || 0);
        const cands = pool.filter(l => (uses.get(l[0]) || 0) === min);
        const pick = cands[Math.floor(rnd() * cands.length)];
        uses.set(pick[0], (uses.get(pick[0]) || 0) + 1);
        line = [pick[0], pick[1], pick[3]];
      }
      const [texto, mood, scene] = line;
      const e = { fecha: f, texto, animo: rnd() < 0.1 ? '' : MOODS[mood - 1], etiquetas: parseTags(texto), foto: false, creado: `${f}T21:30:00.000Z`, editado: `${f}T21:30:00.000Z` };
      if (scene && photoCount < 9 && (uses.get(texto) || 1) <= 1) { e.foto = true; photoCount++; photoJobs.push([f, scene]); }
      list.push(e);
    }
    if (list.length) list[0].texto = 'Empecé un diario de una línea. Veremos si dura.';
    list[0] && (list[0].etiquetas = parseTags(list[0].texto));
    const photos = new Map();
    let seed = 7;
    for (const [f, scene] of photoJobs) {
      try { const b = await paintScene(scene, seed++); if (b) photos.set(f, b); } catch { /* sin foto */ }
    }
    for (const e of list) if (e.foto && !photos.has(e.fecha)) e.foto = false;
    const demoFrases = new Map();
    for (let f = start; f <= t; f = addDays(f, 1)) demoFrases.set(f, nextFrase(f, demoFrases));
    return { list, photos, frases: demoFrases };
  }

  async function enterDemo() {
    if (ui.demo) return;
    await flushAll();
    realEntries = new Map(entries);
    realFrases = new Map(frases);
    const { list, photos, frases: demoFrases } = await buildDemo();
    entries.clear();
    list.forEach(e => entries.set(e.fecha, e));
    frases.clear();
    demoFrases.forEach((v, k) => frases.set(k, v));
    demoPhotos.clear();
    photos.forEach((b, f) => demoPhotos.set(f, b));
    dropAllURLs();
    ui.demo = true;
    ui.year = +ui.today.slice(0, 4);
    document.documentElement.classList.add('demo');
    $('#demo-banner').hidden = false;
    hoyEditor.load(ui.today);
    invalidate();
  }
  async function exitDemo() {
    if (!ui.demo) return;
    await flushAll();
    ui.demo = false;
    entries.clear();
    (realEntries || new Map()).forEach((v, k) => entries.set(k, v));
    realEntries = null;
    frases.clear();
    (realFrases || new Map()).forEach((v, k) => frases.set(k, v));
    realFrases = null;
    demoPhotos.clear();
    dropAllURLs();
    document.documentElement.classList.remove('demo');
    $('#demo-banner').hidden = true;
    if (!settings.ejemploVisto) { settings.ejemploVisto = true; saveSettings(); }
    ui.q = ''; ui.tag = ''; $('#q').value = ''; $('#q-clear').hidden = true;
    closeAllSheets();
    hoyEditor.load(ui.today);
    invalidate();
    go('hoy');
    toast(entries.size ? 'De vuelta a tu diario' : 'Este es tu diario. Empieza por la línea de hoy.');
  }

  /* ---------- Navegación ---------- */
  const hashTab = () => { const h = (location.hash || '').slice(1); return TABS.includes(h) ? h : 'hoy'; };
  function go(tab) {
    if (!TABS.includes(tab)) return;
    if (ui.tab === tab && hashTab() === tab) {
      window.scrollTo({ top: 0, behavior: MQ_REDUCE.matches ? 'auto' : 'smooth' });
      return;
    }
    if (hashTab() === tab) { showTab(tab, true); return; }
    try { location.replace(`#${tab}`); } catch { location.hash = tab; }
    // Por si el navegador no dispara hashchange
    setTimeout(() => { if (ui.tab !== hashTab()) showTab(hashTab()); }, 50);
  }
  function showTab(tab, force) {
    if (ui.tab === tab && !force && !$(`#v-${tab}`).hidden) return;
    if (ui.tab !== tab) ui.scroll[ui.tab] = window.scrollY;
    ui.tab = tab;
    TABS.forEach(t => { $(`#v-${t}`).hidden = t !== tab; });
    $$('.tab').forEach(b => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    ui.dirty.add(tab);
    renderTab(tab);
    hideTip();
    window.scrollTo(0, ui.scroll[tab] || 0);
  }
  window.addEventListener('hashchange', () => showTab(hashTab()));

  /* ---------- Cambio de día ---------- */
  function checkDay() {
    const t = todayIso();
    if (t === ui.today) return;
    if (hoyEditor && hoyEditor.focused) return;
    const prevYear = +ui.today.slice(0, 4);
    ui.today = t;
    if (ui.year === prevYear) ui.year = +t.slice(0, 4);
    hoyEditor.load(t);
    invalidate();
  }

  /* ---------- Eventos ---------- */
  function paintIcons() {
    $$('.tab').forEach(b => { const s = $('.tab-icon', b); if (s) s.outerHTML = ICON[b.dataset.tab]; });
    $$('.chev-slot').forEach(s => {
      if (s.classList.contains('val')) s.innerHTML = ICON.chevR;
      else s.outerHTML = ICON.chevR;
    });
    $$('.check-slot').forEach(s => { s.innerHTML = ICON.check; });
    $('#cal-prev').innerHTML = ICON.chevL;
    $('#cal-next').innerHTML = ICON.chevR;
    $('#btn-sort').innerHTML = ICON.sort;
    $('#q-clear').innerHTML = ICON.x;
    $('#search-icon').outerHTML = ICON.search;
    $('#btn-summary-icon').innerHTML = ICON.sparkle;
  }

  function wire() {
    $('#tabbar').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) go(b.dataset.tab); });
    $('#btn-demo-exit').addEventListener('click', exitDemo);

    // Hoy
    $('#v-hoy').addEventListener('click', e => {
      const mem = e.target.closest('.memory[data-fecha]');
      if (mem) { openDay(mem.dataset.fecha); return; }
      const sum = e.target.closest('[data-summary]');
      if (sum) { openSummary(+sum.dataset.summary); return; }
      if (e.target.closest('[data-hint-close]')) { settings.pistaInstalar = false; saveSettings(); invalidate('hoy'); return; }
      if (e.target.closest('[data-install]')) promptInstall();
    });

    // Calendario
    $('#cal-prev').addEventListener('click', () => { ui.year--; invalidate('calendario'); });
    $('#cal-next').addEventListener('click', () => { ui.year++; invalidate('calendario'); });
    $('#cal-mode').addEventListener('click', e => {
      const b = e.target.closest('button[data-mode]');
      if (!b || settings.modoCal === b.dataset.mode) return;
      settings.modoCal = b.dataset.mode;
      saveSettings();
      $('#cal').dataset.mode = settings.modoCal;
      $$('#cal-mode button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderLegend();
    });
    const months = $('#months');
    months.addEventListener('click', e => { const c = e.target.closest('.cell[data-fecha]'); if (c) { hideTip(); openDay(c.dataset.fecha); } });
    months.addEventListener('pointerover', e => {
      if (e.pointerType !== 'mouse') return;
      const c = e.target.closest('.cell[data-fecha]');
      if (c) showTip(c); else hideTip();
    });
    months.addEventListener('pointerleave', hideTip);
    window.addEventListener('scroll', hideTip, { passive: true });
    $('#btn-summary').addEventListener('click', () => openSummary(ui.year));

    // Archivo
    let qTimer = 0;
    $('#q').addEventListener('input', e => {
      ui.q = e.target.value;
      $('#q-clear').hidden = !ui.q;
      clearTimeout(qTimer);
      qTimer = setTimeout(() => invalidate('archivo'), 120);
    });
    $('#q').addEventListener('keydown', e => {
      if (e.key === 'Escape' && ui.q) { e.preventDefault(); e.stopPropagation(); $('#q-clear').click(); }
      if (e.key === 'Enter') e.target.blur();
    });
    $('#q-clear').addEventListener('click', () => { ui.q = ''; $('#q').value = ''; $('#q-clear').hidden = true; invalidate('archivo'); $('#q').focus(); });
    $('#chips').addEventListener('click', e => {
      const c = e.target.closest('.chip');
      if (!c) return;
      ui.tag = ui.tag === c.dataset.tag ? '' : c.dataset.tag;
      invalidate('archivo');
    });
    $('#btn-sort').addEventListener('click', () => {
      settings.orden = settings.orden === 'asc' ? 'desc' : 'asc';
      saveSettings();
      invalidate('archivo');
    });
    $('#arc-list').addEventListener('click', e => { const r = e.target.closest('.arc-row'); if (r) openDay(r.dataset.fecha); });
    $('#arc-mode').addEventListener('click', e => {
      const b = e.target.closest('button[data-arc]');
      if (!b || ui.arcMode === b.dataset.arc) return;
      ui.arcMode = b.dataset.arc;
      ui.tag = '';
      invalidate('archivo');
      window.scrollTo(0, 0);
    });
    $('#sw-frase').addEventListener('change', async e => {
      settings.frase = e.target.checked;
      await saveSettings();
      invalidate('hoy', 'archivo', 'ajustes');
      toast(settings.frase ? 'Frase del día activada' : 'Frase del día desactivada');
    });

    // Ajustes
    $('#sw-rem').addEventListener('change', e => setReminder(e.target.checked));
    $('#in-hora').addEventListener('change', async e => {
      if (!/^\d{2}:\d{2}$/.test(e.target.value)) return;
      settings.recordatorio.hora = e.target.value;
      await saveSettings();
      scheduleReminder();
      toast(`Aviso a las ${settings.recordatorio.hora}`);
    });
    $('#row-atajo').addEventListener('click', atajoSheet);
    $('#sw-pin').addEventListener('change', async e => {
      const on = e.target.checked;
      const ok = await pinFlow(on ? 'create' : 'disable');
      if (!ok) e.target.checked = !on;
      invalidate('ajustes');
    });
    $('#row-pin-change').addEventListener('click', async () => { await pinFlow('change'); invalidate('ajustes'); });
    $('#sel-tras').addEventListener('change', e => { settings.pin.tras = +e.target.value; saveSettings(); });
    $('#row-export').addEventListener('click', doExport);
    $('#row-import').addEventListener('click', () => {
      if (ui.demo) { toast('Sal del diario de ejemplo para importar una copia.'); return; }
      $('#file-import').click();
    });
    $('#file-import').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) doImport(f);
    });
    $('#seg-tema').addEventListener('click', e => {
      const b = e.target.closest('button[data-tema]');
      if (!b) return;
      settings.tema = b.dataset.tema;
      saveSettings();
      applyTheme();
      invalidate('ajustes');
    });
    $('#row-install').addEventListener('click', promptInstall);
    $('#row-install-ios').addEventListener('click', iosInstallSheet);
    $('#row-update').addEventListener('click', reloadApp);
    $('#row-demo').addEventListener('click', async () => {
      if (ui.demo) { exitDemo(); return; }
      await enterDemo();
      go('hoy');
      toast('Diario de ejemplo: nada de lo que hagas aquí se guarda');
    });
    $('#row-wipe').addEventListener('click', async () => {
      if (ui.demo) { toast('Sal del diario de ejemplo antes de borrar tus datos.'); return; }
      const n = entries.size;
      const ok = await confirmSheet({
        title: '¿Borrar todos los datos?',
        message: `Se eliminarán ${plural(n, 'entrada', 'entradas')}, las fotos y los ajustes de este dispositivo. Si no tienes una copia, no se podrán recuperar.`,
        confirm: 'Borrar todo',
        destructive: true
      });
      if (ok) wipeAll();
    });

    // Teclado
    document.addEventListener('keydown', e => {
      const top = sheets[sheets.length - 1];
      if (ui.locked) return;
      if (e.key === 'Escape' && top) { e.preventDefault(); top.close(); return; }
      if (e.key === 'Tab' && top) {
        const f = $$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', top.el).filter(x => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (e.key === '/' && !top && ui.tab === 'archivo' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) {
        e.preventDefault();
        $('#q').focus();
      }
    });

    // Ciclo de vida
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        flushAll();
        hideTip();
        if (settings.pin.activo && settings.pin.tras === 0) lockApp();
      } else {
        if (settings.pin.activo && hiddenAt && Date.now() - hiddenAt >= settings.pin.tras * 1000) lockApp();
        hiddenAt = 0;
        checkDay();
        scheduleReminder();
      }
    });
    window.addEventListener('pagehide', () => { flushAll(); });
    const onScheme = () => paintThemeColor();
    if (MQ_DARK.addEventListener) MQ_DARK.addEventListener('change', onScheme);
    if (MQ_STANDALONE.addEventListener) MQ_STANDALONE.addEventListener('change', () => invalidate('hoy', 'ajustes'));
  }

  /* ---------- Arranque ---------- */
  async function boot() {
    paintIcons();
    hoyEditor = createEditor();
    $('#hoy-editor').append(hoyEditor.el);
    buildLock();
    wire();

    await Store.init();
    let saved = null;
    try { saved = await Store.getMeta('ajustes'); } catch { /* nada */ }
    settings = mergeSettings(saved);
    applyTheme();
    try {
      (await Store.all()).forEach(raw => { const e = normEntry(raw); if (e) { if (raw.creado) e.creado = raw.creado; entries.set(e.fecha, e); } });
    } catch (e) { console.error(e); }
    try {
      (await Store.allFrases()).forEach(f => {
        if (f && isValidIso(f.fecha) && typeof f.frase === 'string') frases.set(f.fecha, { fecha: f.fecha, frase: f.frase, i: Number.isInteger(f.i) ? f.i : FRASES.indexOf(f.frase) });
      });
    } catch (e) { console.error(e); }

    if (settings.pin.activo && settings.pin.hash) lockApp();
    else document.documentElement.classList.remove('locked');
    try {
      localStorage.setItem('dul.lock', settings.pin.activo ? '1' : '0');
      localStorage.setItem('dul.tema', settings.tema);
    } catch { /* nada */ }

    if (PREVIEW && !entries.size && !settings.ejemploVisto) {
      try { await enterDemo(); } catch (e) { console.error(e); }
    }

    hoyEditor.load(ui.today);
    showTab(hashTab(), true);
    document.documentElement.classList.remove('booting');

    if (Store.mode === 'memory') {
      toast('Este navegador no deja guardar datos. Exporta tu copia antes de cerrar.', { duration: 8000 });
    }
    registerSW();
    scheduleReminder();
    setInterval(checkDay, 30000);
  }

  boot().catch(err => {
    console.error(err);
    document.documentElement.classList.remove('booting', 'locked');
  });
})();
