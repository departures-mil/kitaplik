// Ayarlar > Kullanım Limitleri (kendi Firebase hesabınızın günlük sınırı + fotoğraftan okumadaki yapay zekâ kullanımı)
(function () {
  if (!window.Kullanim) return;
  function ayar() { try { return JSON.parse(localStorage.getItem('kitaplik.v2') || '{}').settings || {}; } catch (e) { return {}; } }
  Kullanim.baslat({
    uygulama: 'kitaplik', bulut: true, ai: true, aiAd: 'Gemini', sinif: 'card',
    dil: function () { var l = ''; try { l = localStorage.getItem('kitaplik.dil') || ''; } catch (e) {} return l || document.documentElement.lang; },
    proje: function () { var a = ayar(), fc = a.firebaseConfig; try { if (typeof fc === 'string') fc = JSON.parse(fc); } catch (e) { fc = null; } return (a.libraryCode && fc && fc.projectId) || ''; }
  });
  Kullanim.yerlestir(function () {
    var h = Kullanim.metindenBul(['Firebase eşitleme'], 'details.card');
    return h;
  });
})();
