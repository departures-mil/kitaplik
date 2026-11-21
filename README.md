# Kitaplık

Windows masaüstü programı (Electron) ve Android uygulaması. Kayıtlar kullanıcının Firebase hesabı üzerinden ve
aynı Wi‑Fi'da internetsiz eşitlenir; **kayıtlar bu depoda bulunmaz**.

- `web/`, `desktop/`, `android/` — kaynak. `tools/derle.sh` APK + app.asar + imzalı paketleri üretir.
- `guncelleme/` — imzalı (ECDSA P-256) güncelleme paketleri: `web.json` (telefon arayüzü), `masaustu2.json`
  (masaüstü), `android2.json` (APK). Programlar buradan indirir, imzası tutmayan paketi kurmaz.
- İmza anahtarları (`keys/`) bu depoda **yoktur**; geliştiricinin bilgisayarında durur.

## Yeni sürüm
1. `tools/derle.sh <sürüm> <versionCode>` (keys/ klasörü gerekir)
2. `bash tools/github-yayinla.sh <sürüm> "notlar" web masaustu [android]`
