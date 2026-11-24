# Kitaplık

Windows masaüstü programı (Electron, NSIS kurulum) ve Android uygulaması (WebView). Kayıtlar kullanıcının **kendi** Firebase
hesabı üzerinden ve aynı Wi‑Fi'da internetsiz eşitlenir; **kayıtlar bu depoda bulunmaz**.

- `web/` arayüz, `desktop/` Electron kabuğu, `android/` Android kabuğu, `cekirdek/` + `web/cekirdek/` ortak çekirdek kopyası
  (sürüm: `cekirdek/VERSION`).
- Güncellemeler: GitHub Releases + `latest.json` + delta yamalar (ortak çekirdek). Kanallar: `win-app` (app.asar),
  `win-setup` (kurulum), `android` (APK).
- `guncelleme/` — yalnız ESKİ kurulumlar (≤2.13 masaüstü, ≤2.11 Android) için imzalı köprü paketleri (`tools/kopru.js`).
- İmza anahtarları (`keys/`, keystore, `.pem`) bu depoda **yoktur**.

## Yeni sürüm
1. `node tools/surum.js X.Y.Z` + `release-notes.json` (tr/en/ar), `npm test`
2. main'e birleştir → Actions → release → Run workflow (main)
3. (Yalnız eski kurulumlar hâlâ varsa) `node tools/kopru.js` — sahibin bilgisayarında, `keys/guncelleme-ozel.pem` ile.
