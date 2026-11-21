// Kitaplık — sürüm bilgisi ve açılışta güncelleme uyarısı.
// app.js'den ÖNCE yüklenir. Güncelleme hazır olduğunda ekranın üstünde
// "Güncelle" düğmeli bir şerit gösterir; tek dokunuşla güncellenir.
(function () {
  'use strict';
  window.KITAPLIK_SURUM = '@SURUM@';

  var A = function () { return window.KitaplikAndroid; };
  var D = function () { return window.kitaplikDesktop; };
  var gizlenen = null;

  // ---- İndirme ilerlemesi: düzenli, satırları bölünmeyen görünüm ----
  // Masaüstü yapılandırılmış alanlar gönderir (pct, doneMB…); eski sürümler ve
  // Android yalnız metin gönderir, o yüzden metinden de ayrıştırıyoruz.
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function ayristir(st) {
    st = st || {};
    var t = st.text || '';
    var m;
    var o = {
      version: st.version || ((m = /Sürüm\s+(\S+)/.exec(t)) ? m[1] : ''),
      pct: typeof st.pct === 'number' ? st.pct : ((m = /%\s?(\d+)/.exec(t)) ? +m[1] : null),
      doneMB: st.doneMB || null, totalMB: st.totalMB || null, leftMB: st.leftMB || null, speed: st.speed || null, eta: st.eta || null,
    };
    if (!o.doneMB && (m = /([\d.,]+)\s*\/\s*([\d.,]+)\s*MB/.exec(t))) { o.doneMB = m[1]; o.totalMB = m[2]; }
    if (!o.leftMB && (m = /kalan\s+([\d.,]+)\s*MB/i.exec(t))) o.leftMB = m[1];
    if (!o.speed && (m = /([\d.,]+\s*[KM]B\/sn)/.exec(t))) o.speed = m[1];
    if (o.pct != null) o.pct = Math.max(0, Math.min(100, Math.round(o.pct)));
    return o;
  }
  function ilerlemeHTML(st, koyu) {
    var o = ayristir(st);
    var baslik = 'Kitaplık ' + (o.version ? o.version + ' ' : '') + 'indiriliyor';
    var bilgi = [];
    if (o.doneMB && o.totalMB) bilgi.push('<span><em>İnen</em> ' + esc(o.doneMB) + ' / ' + esc(o.totalMB) + ' MB</span>');
    if (o.leftMB) bilgi.push('<span><em>Kalan</em> ' + esc(o.leftMB) + ' MB</span>');
    if (o.speed) bilgi.push('<span><em>Hız</em> ' + esc(o.speed) + '</span>');
    if (o.eta) bilgi.push('<span><em>Süre</em> yaklaşık ' + esc(o.eta) + '</span>');
    return '<div class="upd-prog' + (koyu ? ' koyu' : '') + '">' +
      '<div class="up-head"><span class="up-title">' + esc(baslik) + '</span>' +
      (o.pct != null ? '<b class="up-pct">%' + o.pct + '</b>' : '') + '</div>' +
      '<div class="up-bar' + (o.pct == null ? ' belirsiz' : '') + '"><i style="width:' + (o.pct == null ? 35 : o.pct) + '%"></i></div>' +
      (bilgi.length ? '<div class="up-meta">' + bilgi.join('') + '</div>' : '') +
      '</div>';
  }
  window.__kitaplikIlerleme = ilerlemeHTML;

  function serit() {
    var el = document.getElementById('updBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'updBanner';
      el.className = 'upd-banner';
      el.innerHTML = '<span class="upd-text"></span>' +
        '<button type="button" class="btn upd-go">Güncelle</button>' +
        '<button type="button" class="icon-btn upd-x" title="Sonra">✕</button>';
      document.body.appendChild(el);
      el.querySelector('.upd-go').addEventListener('click', uygula);
      el.querySelector('.upd-x').addEventListener('click', function () {
        gizlenen = el.dataset.version || '';
        el.classList.remove('show');
      });
    }
    return el;
  }

  function uygula() {
    var el = serit();
    el.querySelector('.upd-go').disabled = true;
    el.querySelector('.upd-text').textContent = 'Güncelleniyor…';
    try {
      if (A() && A().installUpdate) A().installUpdate();
      else if (D() && D().restartToUpdate) D().restartToUpdate();
    } catch (e) { /* yoksay */ }
    setTimeout(function () { el.querySelector('.upd-go').disabled = false; }, 4000);
  }

  function goster(st) {
    if (!st || !document.body) return;
    var el = serit();
    var v = st.version || '';
    if (st.state === 'ready' && gizlenen !== v) {
      el.dataset.version = v;
      el.querySelector('.upd-text').textContent =
        '🔄 Kitaplık ' + v + ' hazır.' + (st.kind === 'apk' ? ' Kurulum ekranı açılacak.' : '');
      el.querySelector('.upd-go').hidden = false;
      el.querySelector('.upd-go').disabled = false;
      el.classList.add('show');
    } else if (st.state === 'available' && gizlenen !== v) {
      el.dataset.version = v;
      el.querySelector('.upd-text').textContent = '🔄 Yeni sürüm var: ' + v;
      el.querySelector('.upd-go').hidden = false;
      el.classList.add('show');
    } else if (st.state === 'downloading' && el.classList.contains('show')) {
      el.querySelector('.upd-text').innerHTML = ilerlemeHTML(st, true);
      el.querySelector('.upd-go').hidden = true;
    } else if (st.state === 'uptodate' || st.state === 'idle') {
      el.classList.remove('show');
    }
  }
  window.__kitaplikGuncellemeGoster = goster;

  // Android: yerel kod window.__kitaplikUpdate(durum) çağırır. app.js de bu
  // işlevi atar; ikisi birlikte çalışsın diye araya giriyoruz.
  var appHandler = null;
  try {
    Object.defineProperty(window, '__kitaplikUpdate', {
      configurable: true,
      get: function () {
        return function (st) {
          try { goster(st); } catch (e) { /* yoksay */ }
          if (appHandler) appHandler(st);
        };
      },
      set: function (fn) { appHandler = fn; },
    });
  } catch (e) { /* yoksay */ }

  function basla() {
    if (D() && D().onUpdateStatus) D().onUpdateStatus(goster);
    // Açılışta mevcut durumu göster (güncelleme önceden inmiş olabilir)
    try {
      var info = A() && A().updateInfo ? JSON.parse(A().updateInfo())
        : D() && D().updateInfo ? D().updateInfo() : null;
      if (info && info.status) goster(info.status);
    } catch (e) { /* yoksay */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
  else basla();
})();
