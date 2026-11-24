// Kitaplık masaüstü — giriş noktası (package.json "main").
// 2.14.0'dan itibaren program kurulum (NSIS) ile gelir ve GitHub Releases'tan güncellenir (ortak çekirdek:
// app.asar yaması ya da tam dosya). Eski başlatıcının userData/guncelleme/<sürüm>/ klasöründen çalıştırma düzeni
// KALDIRILDI: bu dosya doğrudan paketteki uygulamayı açar.
//
// Not: ≤2.13 kurulumlarındaki ESKİ main.js (app.asar içinde) yeni sürümü userData/guncelleme/2.14.x/app-main.js
// olarak açar ve global.kitaplik'i tanımlar; app-main.js bunu "eski kabuk" (köprü) olarak tanır.
require('./app-main.js');
