// Asistan Agent (ortak-cekirdek/web/dist/fc-agent.js): bütün uygulamalardaki çalışmayı izler, öneri verir.
// Ayarlar'da "Yönetici ile İletişim" kartının hemen önüne kendi kartını koyar; ✦ düğmesi sağ altta.
(function () {
  if (!window.FCAgent) return;
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function fb() {
    try {
      var a = JSON.parse(ls('kitaplik.v2') || '{}').settings || {}, fc = a.firebaseConfig;
      if (typeof fc === 'string') fc = JSON.parse(fc);
      return fc && fc.projectId && fc.apiKey ? { projectId: fc.projectId, apiKey: fc.apiKey } : null;
    } catch (e) { return null; }
  }
  FCAgent.mount({
    app: 'kitaplik', version: window.KITAPLIK_SURUM || '',
    lang: function () { return ls('kitaplik.dil') || document.documentElement.lang || 'tr'; },
    theme: 'auto', sync: true,
    settingsBefore: ['✉️ Yönetici ile İletişim', '✉️ Contact the administrator', '✉️ التواصل مع المسؤول'],
    ai: function () { var k = ls('kitaplik.geminiKey'); return k ? { provider: 'gemini', key: k, model: 'gemini-flash-latest' } : null; },
    firebase: fb,
    notify: function (t, b) {
      if (window.KitaplikAndroid && KitaplikAndroid.notifyNow) { KitaplikAndroid.notifyNow(t, b); return true; }
      if (window.kitaplikDesktop && kitaplikDesktop.notifyNow) { kitaplikDesktop.notifyNow(t, b); return true; }
      return false;
    }
  });
})();
