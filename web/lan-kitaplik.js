// Kitaplık — Wi‑Fi ile internetsiz eşitleme (lan.js çekirdeğine uygulama bağlantısı).
// app.js ve ustcubuk.js'den SONRA yüklenir. Kayıtlar: books / categories / locations / loans
// (her kayıtta updatedAt ve silinince deleted:true; silinenler de eşitlenir, geri gelmez).
(function () {
  'use strict';
  var K = window.__kitaplikLan;
  if (!K || !window.LanCore) return;
  var AND = window.KitaplikAndroid, DESK = window.kitaplikDesktop;
  var N = AND || DESK || {};
  var seq = 0, cbs = {};
  window.__lanCb = function (id, json) { var f = cbs[id]; delete cbs[id]; if (f) f(json); };
  function call(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (DESK) return Promise.resolve(DESK[fn].apply(DESK, args)).then(function (r) { return typeof r === 'string' ? JSON.parse(r) : r; });
    return new Promise(function (resolve) {
      var id = 'l' + (++seq);
      cbs[id] = function (s) { try { resolve(JSON.parse(s)); } catch (e) { resolve(s); } };
      AND[fn].apply(AND, [id].concat(args));
    });
  }
  var lang = function () { var l = localStorage.getItem('kitaplik.dil') || 'tr'; return /^(tr|en|ar)$/.test(l) ? l : 'tr'; };
  var META = 'kitaplik.wifi';

  LanCore.init({
    app: 'kitaplik',
    native: N,
    call: call,
    lang: lang,
    isDesktop: function () { return !!DESK; },
    account: function () { var q = K.get(); return String((q.settings && q.settings.libraryCode) || ''); },
    device: function () { return { id: localStorage.getItem('kitaplik.cihaz') || '', name: DESK ? 'Bilgisayar' : 'Telefon' }; },
    exportState: function () {
      var q = K.get(), docs = {};
      K.cols.forEach(function (c) { Object.keys(q[c] || {}).forEach(function (id) { docs[c + '/' + id] = q[c][id]; }); });
      return { docs: docs, dels: {} };
    },
    stamp: function (d) { return Number(d && d.updatedAt) || 0; },
    applyState: function (merged) {
      var q = K.get();
      Object.keys(merged.docs).forEach(function (key) {
        var i = key.indexOf('/'), col = key.slice(0, i), id = key.slice(i + 1), rec = merged.docs[key];
        var cur = (q[col] || {})[id];
        if (!cur || LanCore.canon(cur) !== LanCore.canon(rec)) K.put(col, rec);
      });
      if (merged.conflicts.length) {
        try {
          var b = JSON.parse(localStorage.getItem('kitaplik.wifi.yedek') || '[]');
          merged.conflicts.forEach(function (d) { b.unshift({ at: Date.now(), d: d }); });
          localStorage.setItem('kitaplik.wifi.yedek', JSON.stringify(b.slice(0, 300)));
        } catch (e) { /* yer yoksa yedek atlanır */ }
      }
    },
    loadMeta: function () { try { return JSON.parse(localStorage.getItem(META) || '{}'); } catch (e) { return {}; } },
    saveMeta: function (m) { localStorage.setItem(META, JSON.stringify(m)); },
    refresh: function () { /* app.js kayıt değişince ekranı kendisi yeniler */ }
  });

  // Sağ üst araç çubuğuna 📶 düğmesi
  function addBtn() {
    var bar = document.getElementById('topTools');
    if (!bar || bar.querySelector('.tt-wifi')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tt-btn tt-wifi';
    var t = { tr: 'Wi‑Fi eşitleme', en: 'Wi‑Fi sync', ar: 'مزامنة Wi‑Fi' }[lang()];
    b.title = t;
    b.innerHTML = '<span aria-hidden="true">📶</span><span class="tt-label">' + t + '</span>';
    b.addEventListener('click', function () { LanCore.open(); });
    var win = bar.querySelector('#winTools');
    bar.insertBefore(b, win || null);
  }
  addBtn();
  setTimeout(addBtn, 1500);
  setTimeout(function () { LanCore.autoTry(); }, 4000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(function () { LanCore.autoTry(); }, 2000); });
})();
