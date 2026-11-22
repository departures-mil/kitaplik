// Admin duyuruları (https://github.com/departures-mil/duyurular)
Duyuru.baslat({
  uygulama: 'kitaplik',
  surum: '2.11.1',
  dil: function () { var l = ''; try { l = localStorage.getItem('kitaplik.dil') || ''; } catch (e) {} return l || document.documentElement.lang; }
});
