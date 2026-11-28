/* Yerel zekâ — telefon (Android WebView) ve tarayıcı. Masaüstü kabuğu window.fcYerelZeka'yı zaten veriyorsa hiçbir şey yapmaz.
   Aynı arayüzü (durum / kur / iptal / sil / ayar / ocr / cevir / ilerleme) tarayıcı içinde sağlar:
     · Paketler GitHub'dan (raw.githubusercontent.com, yedek jsDelivr) 19 MB'lık parçalar hâlinde iner, her parça SHA-256 ile
       doğrulanır, IndexedDB'de (fc-yerel-zeka) saklanır; yarıda kalırsa inmiş parçalar yeniden inmez. İlerleme: %, MB, kalan MB, hız, süre.
     · ocr: PaddleOCR PP-OCRv5 (mobil) · mt: NLLB-200 (8 bit). İşlem ayrı iş parçacığında (fc-yz-isci.js).
   Bu dosya ile aynı klasörde: fc-yz-isci.js, fc-ocr.js, fc-mt.js, vendor/ (ort.wasm.min.js, wasm yapıştırıcıları, tesseract çekirdeği; transformers.js paketle iner). */
(function () {
  'use strict';
  if (window.fcYerelZeka) return;
  var BRANCH = 'yerel-zeka-telefon';
  var BASES = window.FCYZ_TELEFON_KAYNAK || ['https://raw.githubusercontent.com/departures-mil/ortak-cekirdek/' + BRANCH + '/', 'https://cdn.jsdelivr.net/gh/departures-mil/ortak-cekirdek@' + BRANCH + '/'];
  var me = document.currentScript && document.currentScript.src;
  var HERE = me ? me.replace(/[^/]*$/, '') : '';
  var DB = null, manifest = null, busy = null, worker = null, seq = 0, pending = {}, listeners = [], ready = {}, memo = null, memoSent = false;

  /* ---------- IndexedDB ---------- */
  function db() {
    if (DB) return DB;
    DB = new Promise(function (res, rej) {
      var r = indexedDB.open('fc-yerel-zeka', 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('parca'); d.createObjectStore('meta'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return DB;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s);
        t.oncomplete = function () { res(out && typeof IDBRequest !== 'undefined' && out instanceof IDBRequest ? out.result : out); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); };
      });
    });
  }
  var get = function (store, k) { return tx(store, 'readonly', function (s) { return s.get(k); }); };
  var put = function (store, k, v) { return tx(store, 'readwrite', function (s) { s.put(v, k); }); };
  var del = function (store, k) { return tx(store, 'readwrite', function (s) { s.delete(k); }); };
  var keys = function (store) { return tx(store, 'readonly', function (s) { return s.getAllKeys(); }); };

  /* ---------- ağ ---------- */
  function fetchAny(rel, opts) {
    var i = 0;
    var next = function (err) {
      if (i >= BASES.length) return Promise.reject(err || new Error('ağ'));
      var u = BASES[i++] + rel;
      return fetch(u, Object.assign({ cache: 'no-store' }, opts || {})).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; }).catch(next);
    };
    return next();
  }
  function loadManifest() {
    return fetchAny('telefon.json').then(function (r) { return r.json(); }).then(function (m) { manifest = m; return put('meta', 'manifest', m).then(function () { return m; }); })
      .catch(function () { return get('meta', 'manifest').then(function (m) { manifest = m || null; return manifest; }); });
  }
  var hex = function (buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); };

  /* ---------- durum ---------- */
  function emit(ev) { listeners.slice().forEach(function (f) { try { f(ev); } catch (e) {} }); }
  function state() { return get('meta', 'durum').then(function (s) { return s || { packs: {}, settings: {} }; }); }
  function status() {
    return Promise.all([state(), manifest ? manifest : loadManifest()]).then(function (r) {
      var s = r[0], m = r[1], P = {};
      ['ocr', 'mt'].forEach(function (n) {
        var p = m && m.packs && m.packs[n], inst = s.packs[n];
        P[n] = { installed: !!inst, bytes: p ? p.bytes : null, update: !!(inst && p && inst.version !== p.version) };
        ready[n] = !!inst;
      });
      P.runtime = { installed: true, bytes: 0 };
      return { platform: 'web', supported: !!m, busy: !!busy, version: m && m.version, packs: P, ramGB: navigator.deviceMemory || null,
        ocr: !!s.packs.ocr, mt: !!s.packs.mt, llm: false, settings: s.settings || {} };
    });
  }

  /* ---------- kurulum ---------- */
  function install(names) {
    if (busy) return Promise.reject(new Error('Zaten indiriliyor'));
    var cancelled = false, ctl = null;
    busy = { cancel: function () { cancelled = true; if (ctl) ctl.abort(); } };
    return loadManifest().then(function (m) {
      if (!m) throw new Error('Paket listesine ulaşılamadı (internet gerekli)');
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      return Promise.all([state(), keys('parca')]).then(function (r) {
        var st = r[0], have = {}; r[1].forEach(function (k) { have[k] = 1; });
        var todo = names.filter(function (n) { return m.packs[n] && !(st.packs[n] && st.packs[n].version === m.packs[n].version); });
        var parts = []; todo.forEach(function (n) { m.packs[n].files.forEach(function (f) { f.parts.forEach(function (p) { parts.push({ pack: n, p: p }); }); }); });
        var total = parts.reduce(function (a, x) { return a + x.p.size; }, 0), done = 0, t0 = Date.now(), lastT = t0, lastD = 0, speed = 0, lastEmit = 0, MB = 1048576;
        var prog = function (n, pack) {
          done += n; var now = Date.now();
          if (now - lastT >= 500) { var inst = (done - lastD) / ((now - lastT) / 1000); speed = speed ? speed * 0.7 + inst * 0.3 : inst; lastT = now; lastD = done; }
          if (now - lastEmit >= 250 || done >= total) { lastEmit = now; emit({ phase: 'indiriliyor', pct: total ? Math.min(100, done / total * 100) : 100, doneMB: done / MB, totalMB: total / MB, leftMB: Math.max(0, total - done) / MB, speed: speed / MB, eta: speed > 0 ? Math.round((total - done) / speed) : null, pack: pack }); }
        };
        var i = 0;
        var step = function () {
          if (cancelled) throw new Error('iptal');
          if (i >= parts.length) return null;
          var x = parts[i++];
          if (have[x.p.name]) { prog(x.p.size, x.pack); return step(); } // daha önce inmiş (kaldığı yerden)
          ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
          var o = ctl ? { signal: ctl.signal } : {};
          return (x.p.url ? fetch(x.p.url, Object.assign({ cache: 'no-store' }, o)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; }) : fetchAny(x.p.name, o)).then(function (res) {
            var rd = res.body && res.body.getReader ? res.body.getReader() : null, chunks = [], got = 0;
            if (!rd) return res.arrayBuffer().then(function (b) { prog(b.byteLength, x.pack); return b; });
            var pump = function () { return rd.read().then(function (c) { if (c.done) return; chunks.push(c.value); got += c.value.length; prog(c.value.length, x.pack); return pump(); }); };
            return pump().then(function () { var b = new Uint8Array(got), o = 0; chunks.forEach(function (c) { b.set(c, o); o += c.length; }); return b.buffer; })
              .catch(function (e) { prog(-got, x.pack); throw e; });
          }).then(function (buf) {
            return crypto.subtle.digest('SHA-256', buf).then(function (h) {
              if (hex(h) !== x.p.sha256) throw new Error('SHA-256 tutmadı: ' + x.p.name);
              return put('parca', x.p.name, new Blob([buf]));
            });
          }).then(step);
        };
        return Promise.resolve().then(step).then(function () {
          return state().then(function (s) {
            todo.forEach(function (n) { s.packs[n] = { version: m.packs[n].version, bytes: m.packs[n].bytes, at: new Date().toISOString() }; });
            return put('meta', 'durum', s);
          });
        }).then(function () {
          // eski sürüm parçalarını temizle
          var keep = {}; Object.keys(m.packs).forEach(function (n) { m.packs[n].files.forEach(function (f) { f.parts.forEach(function (p) { keep[p.name] = 1; }); }); });
          return keys('parca').then(function (ks) { return Promise.all(ks.filter(function (k) { return !keep[k]; }).map(function (k) { return del('parca', k); })); });
        }).then(function () { stopWorker(); emit({ phase: 'bitti', pct: 100 }); return status(); });
      });
    }).catch(function (e) { emit({ phase: 'hata', error: String(e && e.message || e) }); throw e; })
      .finally(function () { busy = null; });
  }
  function remove(name) {
    if (busy) return Promise.reject(new Error('İndirme sürüyor'));
    return (manifest ? Promise.resolve(manifest) : loadManifest()).then(function (m) {
      var p = m && m.packs[name], ks = [];
      if (p) p.files.forEach(function (f) { f.parts.forEach(function (x) { ks.push(x.name); }); });
      return Promise.all(ks.map(function (k) { return del('parca', k); }));
    }).then(state).then(function (s) { delete s.packs[name]; return put('meta', 'durum', s); }).then(function () { stopWorker(); return status(); });
  }

  /* ---------- dosyalar (parçalardan) ---------- */
  var fileCache = {};
  function files(pack) {
    if (fileCache[pack]) return fileCache[pack];
    fileCache[pack] = (manifest ? Promise.resolve(manifest) : get('meta', 'manifest')).then(function (m) {
      var out = {};
      return Promise.all(m.packs[pack].files.map(function (f) {
        return Promise.all(f.parts.map(function (p) { return get('parca', p.name); })).then(function (bl) {
          if (bl.some(function (b) { return !b; })) throw new Error('Paket eksik: ' + pack);
          out[f.path] = new Blob(bl);
        });
      })).then(function () { return out; });
    });
    fileCache[pack].catch(function () { delete fileCache[pack]; });
    return fileCache[pack];
  }

  /* ---------- iş parçacığı ---------- */
  function startWorker() {
    if (worker) return worker;
    worker = new Worker(HERE + 'fc-yz-isci.js');
    worker.onmessage = function (e) { var m = e.data, p = pending[m.id]; if (!p) return; delete pending[m.id]; m.ok ? p.res(m.result) : p.rej(new Error(m.error)); };
    worker.onerror = function (e) { Object.keys(pending).forEach(function (k) { pending[k].rej(new Error(e.message || 'iş parçacığı')); delete pending[k]; }); stopWorker(); };
    memoSent = false; return worker;
  }
  function stopWorker() { if (worker) { try { worker.terminate(); } catch (e) {} } worker = null; fileCache = {}; }
  function call(op, args, f) {
    var w = startWorker(), id = ++seq;
    return new Promise(function (res, rej) { pending[id] = { res: res, rej: rej }; w.postMessage({ id: id, op: op, args: args, files: f }); });
  }

  window.fcYerelZeka = {
    telefon: true,
    durum: status,
    kur: function (names) { return install(Array.isArray(names) ? names : [names]); },
    iptal: function () { if (busy) busy.cancel(); return Promise.resolve(true); },
    sil: remove,
    ayar: function (x) { return state().then(function (s) { s.settings = Object.assign({}, s.settings || {}, x || {}); return put('meta', 'durum', s); }).then(status); },
    ilerleme: function (cb) { listeners.push(cb); return function () { listeners = listeners.filter(function (f) { return f !== cb; }); }; },
    ocr: function (a) {
      return state().then(function (s) { if (!s.packs.ocr) throw new Error('OCR paketi kurulu değil'); return files('ocr'); }).then(function (f) { return call('ocr', a, f); });
    },
    cevir: function (a) {
      return state().then(function (s) { if (!s.packs.mt) throw new Error('Çeviri paketi kurulu değil'); return files('mt'); }).then(function (f) {
        a = Object.assign({}, a);
        if (a.memory) { memo = a.memory; memoSent = false; }
        startWorker();
        if (memo && !memoSent) { a.memory = memo; memoSent = true; } else delete a.memory;
        return call('translate', a, f);
      });
    },
  };
})();
