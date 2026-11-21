// Kitaplık — sağ üst araç çubuğu: eşitleme, güncelleme ve (masaüstünde) pencere düğmeleri.
// app.js'den SONRA yüklenir; her ekranda görünür.
(function () {
  'use strict';
  var A = function () { return window.KitaplikAndroid; };
  var D = function () { return window.kitaplikDesktop; };
  var platform = A() ? 'android' : D() ? 'desktop' : 'web';
  var upd = { state: 'idle', text: '' };

  var svg = function (d) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' + d + '</svg>';
  };
  var IC = {
    sync: svg('<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7z"/>'),
    upd: svg('<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 4v10m-4-4l4 4 4-4M5 19h14"/>'),
    min: svg('<path fill="currentColor" d="M5 11h14v2H5z"/>'),
    max: svg('<path fill="none" stroke="currentColor" stroke-width="2" d="M5 5h14v14H5z"/>'),
    restore: svg('<path fill="none" stroke="currentColor" stroke-width="2" d="M8 4h12v12M4 8h12v12H4z"/>'),
    close: svg('<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>'),
  };

  // Eşitleme + güncelleme (+ masaüstünde pencere düğmeleri): ekranın sağ üst
  // köşesinde sabit duran tek araç çubuğu. Ekran değişse de yerinde kalır.
  var bar = document.createElement('div');
  bar.id = 'topTools';
  bar.className = 'top-tools ' + platform;
  bar.innerHTML =
    '<button type="button" class="tt-btn tt-sync" title="Eşitleme">' + IC.sync + '<span class="tt-label">Eşitleme</span></button>' +
    (platform !== 'web'
      ? '<button type="button" class="tt-btn tt-upd" title="Güncelleme">' + IC.upd + '<span class="tt-label">Güncelleme</span><i class="tt-dot"></i></button>'
      : '');
  document.body.appendChild(bar);
  document.body.classList.add('has-top-tools');

  // Pencere düğmeleri (yalnız masaüstü): aynı çubuğun en sağında
  var win = null;
  if (platform === 'desktop' && D().windowControl) {
    win = document.createElement('div');
    win.id = 'winTools';
    win.className = 'win-tools';
    win.innerHTML =
      '<button type="button" class="tt-win tt-min" title="Simge durumuna küçült">' + IC.min + '</button>' +
      '<button type="button" class="tt-win tt-max" title="Tam ekran / pencere">' + IC.max + '</button>' +
      '<button type="button" class="tt-win tt-close" title="Kapat (sistem tepsisinde çalışmaya devam eder)">' + IC.close + '</button>';
    bar.appendChild(win);
    document.body.classList.add('has-win-tools');
  }

  // ---- Eşitleme ----
  // app.js .sync-pill öğelerini her durum değişiminde günceller; görünmez bir tane
  // tutup oradan durumu okuyoruz.
  var probe = document.createElement('span');
  probe.id = 'topToolsSyncProbe';
  probe.className = 'sync-pill off';
  probe.hidden = true;
  document.body.appendChild(probe);
  var syncBtn = bar.querySelector('.tt-sync');
  function drawSync() {
    var st = (probe.className.match(/sync-pill\s+(\S+)/) || [])[1] || 'off';
    var text = (probe.textContent || '').trim() || 'Eşitleme kapalı';
    syncBtn.className = 'tt-btn tt-sync ' + st;
    syncBtn.title = text + (st === 'off' ? ' — kurmak için dokunun' : ' — şimdi eşitlemek için dokunun');
    var label = st === 'on' ? 'Eşitlendi' : st === 'connecting' ? 'Bağlanıyor' : st === 'error' ? 'Hata' : 'Eşitleme kapalı';
    syncBtn.querySelector('.tt-label').textContent = label;
  }
  new MutationObserver(drawSync).observe(probe, { attributes: true, childList: true, subtree: true, characterData: true });
  drawSync();
  function act(name) {
    var t = document.createElement('span');
    t.dataset.act = name;
    t.hidden = true;
    document.body.appendChild(t);
    t.click();
    setTimeout(function () { t.remove(); }, 0);
  }
  syncBtn.addEventListener('click', function () {
    var st = (probe.className.match(/sync-pill\s+(\S+)/) || [])[1] || 'off';
    if (st === 'off') {
      var tab = document.querySelector('#nav [data-tab="settings"]');
      if (tab) tab.click();
    } else {
      syncBtn.classList.add('spin');
      setTimeout(function () { syncBtn.classList.remove('spin'); }, 1200);
      act('syncNow');
    }
  });

  // ---- Güncelleme ----
  var updBtn = bar.querySelector('.tt-upd');
  function drawUpd(st) {
    if (!updBtn) return;
    upd = st || upd;
    var s = upd.state;
    updBtn.className = 'tt-btn tt-upd ' + s;
    var yuzde = s === 'downloading' && /%\s?(\d+)/.exec(upd.text || '');
    var label = s === 'ready' ? 'Güncelle' : s === 'available' ? 'Yeni sürüm'
      : s === 'downloading' ? (yuzde ? 'İndiriliyor %' + yuzde[1] : 'İndiriliyor')
      : s === 'checking' ? 'Denetleniyor' : 'Güncelleme';
    updBtn.querySelector('.tt-label').textContent = label;
    updBtn.title = upd.text || 'Güncellemeleri denetle';
  }
  if (updBtn) {
    updBtn.addEventListener('click', function () {
      if (upd.state === 'ready' || upd.state === 'available') {
        if (A() && A().installUpdate) A().installUpdate();
        else if (D() && D().restartToUpdate) D().restartToUpdate();
      } else if (upd.state === 'nosource') {
        var tab = document.querySelector('#nav [data-tab="settings"]');
        if (tab) tab.click();
      } else {
        drawUpd({ state: 'checking', text: 'Güncelleme denetleniyor…' });
        if (A() && A().checkUpdate) A().checkUpdate();
        else if (D() && D().checkUpdate) D().checkUpdate();
      }
    });
    // Durum bildirimlerini guncelleme.js üzerinden al
    var prev = window.__kitaplikGuncellemeGoster;
    window.__kitaplikGuncellemeGoster = function (st) {
      if (prev) prev(st);
      drawUpd(st);
    };
    if (D() && D().onUpdateStatus) D().onUpdateStatus(drawUpd);
    try {
      var info = A() && A().updateInfo ? JSON.parse(A().updateInfo()) : D() && D().updateInfo ? D().updateInfo() : null;
      if (info && info.status) drawUpd(info.status);
    } catch (e) { /* yoksay */ }
  }

  // ---- Pencere (masaüstü) ----
  if (win) {
    var maxBtn = win.querySelector('.tt-max');
    var drawWin = function (w) {
      var big = w && (w.fullscreen || w.maximized);
      maxBtn.innerHTML = big ? IC.restore : IC.max;
      maxBtn.title = w && w.fullscreen ? 'Tam ekrandan çık' : w && w.maximized ? 'Pencereyi küçült' : 'Büyüt';
    };
    win.querySelector('.tt-min').addEventListener('click', function () { D().windowControl('minimize'); });
    maxBtn.addEventListener('click', function () { D().windowControl('toggle'); });
    win.querySelector('.tt-close').addEventListener('click', function () { D().windowControl('close'); });
    if (D().onWindowState) D().onWindowState(drawWin);
    try { drawWin(D().windowState && D().windowState()); } catch (e) { /* yoksay */ }
  }
})();
