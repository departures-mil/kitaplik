# Kitaplık — geliştirici notları (Claude için)

Bu klasör programın kaynağıdır. **keys/ klasörü kaybolursa mevcut kurulumlara güncelleme gönderilemez.**

## Yapı
- web/        Arayüz (index.html, app.js [esbuild paketi, Firebase dahil], style.css, guncelleme.js)
- desktop/    Electron kabuğu (main.js başlatıcı, app-main.js, preload.js, updater.js)
- android/    Android kabuğu (Java kaynakları, paket: com.kitaplik.uygulama)
- tools/      derle.sh (APK + app.asar + imzalı paketler), paketle.js, yayinla.js (Firestore'a yükler)
- keys/       kitaplik.keystore + keystore-parola.txt (APK imzası), guncelleme-ozel.pem (paket imzası),
              firebase.json (projectId, apiKey, code — yayınlamak için)

## Güncelleme kanalları (GitHub: departures-mil/kitaplik → guncelleme/…; 2.11.0 öncesi Firestore)
- web        → Android'de arayüz anında güncellenir (APK kurulmadan)
- masaustu2  → Masaüstünde tüm program (www dahil) güncellenir, yeniden başlatınca
- android2   → APK güncellemesi (yalnızca Java/izin değişikliklerinde gerekir; versionCode artmalı)
Tüm paketler ECDSA P-256 (SHA256withECDSA) ile imzalı; açık anahtar Updater.java ve updater.js içinde.

## Sürüm yayınlama
1. Değişikliği web/ (ya da desktop/, android/) içinde yap.
2. tools/derle.sh <yeni-sürüm> <versionCode>   (ör. 2.6.1 9)
3. node tools/yayinla.js <yeni-sürüm> web masaustu      (APK değiştiyse: … android)
Android SDK: dl.google.com'dan build-tools_r35_linux.zip + platform-35_r02.zip → ANDROID_TOOLS/bt, /pf

## Geçmiş
- 2.5: ilk Claude Pro sürümü (paket com.kitaplik.app, eski imza anahtarları kayıp).
- 2.6.0: yeni kabuklar ve anahtarlar; paket adı com.kitaplik.uygulama (eski uygulamanın yanına kurulur,
  veriler Firebase eşitlemesiyle gelir); açılışta güncelleme bildirimi + "Güncelle" şeridi.
- 2.6.1: sağ üst araç çubuğu (ustcubuk.js): eşitleme düğmesi, güncelleme düğmesi, masaüstünde küçült / tam ekran-pencere / kapat
  (preload: windowControl, windowState, onWindowState; app-main: win-control, win-state IPC). Dashboard'daki eşitleme hapı kaldırıldı.
- NOT: Eski kanallarda (guncelleme/masaustu, guncelleme/android) önceki oturumun yayınladığı 2.7 var (eski anahtarlarla).
  Masaüstü başlatıcısı userData/guncelleme/etkin.json'daki sürüm paketteki sürümden yeniyse onu çalıştırır;
  bu yüzden yeni sürüm numaraları her zaman 2.7'den büyük olmalı. 2.6.x atlandı, 2.8.0'dan devam.
- 2.8.0: 2.6.1 içeriği + 2.7 simgesi + durum tekrarını önleme.
- 2.8.1: eşitleme/güncelleme düğmeleri başlık satırına taşındı (üstte yüzen kutu kaldırıldı); masaüstü pencere düğmeleri sağ üst köşede ince şerit.
- 2.8.2: eşitleme + güncelleme düğmeleri ekranın sağ üst köşesinde sabit araç çubuğunda (tüm ekranlarda yerinde kalır);
  masaüstünde pencere düğmeleri aynı çubuğun sağında. Masaüstü indirme ilerlemesi: yüzde, inen/toplam MB, kalan MB, hız.
  (Android'de MB/hız için Updater.java değişmeli → APK gerekir; henüz yapılmadı.) derle.sh: APK_YOK=1 ile APK'sız derleme.
- 2.8.3: indirme ilerlemesi düzenli görünüm (şerit + Ayarlar kartı): başlık + yüzde, ilerleme çubuğu, bölünmeyen bilgi parçaları
  (İnen / Kalan / Hız / Süre). updater.js yapılandırılmış alanlar gönderir (pct, doneMB, totalMB, leftMB, speed, eta);
  guncelleme.js eski/Android metnini de ayrıştırır. İndirme sırasında Güncelle düğmesi gizli.
- 2.9.0: Fotoğraftan hızlı kayıt (web/fotokayit.js, index.html'de ustcubuk.js'den sonra). Kitap formunun başına bölüm ekler:
  birden çok fotoğraf (Android: kamera intent'i; masaüstü: açık kalan getUserMedia kamerası; galeri), "Tamam, işle" →
  BarcodeDetector (varsa) + Gemini (generativelanguage.googleapis.com, modeller: gemini-flash-latest → yedekler, JSON şema) +
  ISBN ile Google Books / Open Library. Yeni kitapta alanların üzerine yazar, düzenlemede yalnız boş alanları doldurur;
  ön kapak fotoğrafı kapak görseli olur. "İşleyince otomatik kaydet" seçeneği (Kaydet + yeni). Anahtar: keys/gemini.txt →
  derle.sh @GEMINI_KEY@ yerine koyar; uygulamada ⚙ ile localStorage kitaplik.geminiKey üzerinden değiştirilebilir. Dil: TR/EN/AR (kitaplik.dil).
- 2.9.1: Önce internet (Gemini), internet yoksa/ulaşılamazsa cihazda okuma (web/cevrimdisi.js):
  barkod: BarcodeDetector, yoksa zxing-wasm (barkod.js, wasm gömülü); metin: Tesseract (ocr-cekirdek.js = tesseract.js-core 5.1.1
  simd-lstm, ocr-dil-tur.js / ocr-dil-ara.js = 4.0.0_best_int gzip+base64). Hepsi gerektiğinde <script> ile yüklenir; motor
  blob Worker'da çalışır (açılamazsa ana iş parçacığı). TSV satırlarından alan çıkarma (künye anahtar sözcükleri, en iri satır = başlık).
  İnternetsiz okunan kitaba gizli alanlar: ocrPending="1", ocrRef; fotoğraflar + o anki değerler IndexedDB "kitaplik-foto/bekleyen".
  Çevrimiçi olunca turuncu "⏳ N kitap internetsiz okundu" düğmesi: her kitabın düzenleme formunu açar, yapay zekâyla okur
  (yalnız boş ya da çevrimdışı değeriyle aynı kalan alanlar değişir), kaydeder, fotoğrafları siler. Düzenleme formunda tek tek
  "🔄 Yapay zekâyla yeniden oku" düğmesi de var. Varlıkları yeniden üretmek: /home/claude/ocr'da npm i tesseract.js-core@5
  @tesseract.js-data/tur @tesseract.js-data/ara zxing-wasm, sonra dosyaları aynı biçimde yaz.
- 2.10.0 (APK versionCode 9): 📶 Wi‑Fi ile internetsiz eşitleme. web/lan-vendor.js + lan.js (ortak çekirdek) + lan-kitaplik.js
  (adaptör: books/categories/locations/loans, updatedAt + deleted ile birleştirme). app.js'e window.__kitaplikLan eklendi
  (get / put — put buluta da gönderir). Masaüstü: desktop/lan-server.js (aynı ağdan gelen eşitleme isteklerine cevap verir,
  QR kod), app-main.js 'lan-sync'/'lan-async' IPC, preload'da lan* işlevleri. Android: LanSync.java, köprüde lanHttp/lanFind/lanIps
  (cevap window.__lanCb), kamera izni (canlı QR okuma), usesCleartextTraffic=true (yerel ağ HTTP).
- 2.11.0 (APK versionCode 10): Güncellemeler GitHub'dan (departures-mil/kitaplik, guncelleme/*.json + *.pkg). Firebase artık
  yalnızca canlı kayıt eşitlemesi için. Android'de indirme ilerlemesi de yüzde + MB + kalan + hız + süre gösterir.
  2.11.0 eski kurulumlara geçiş için son kez Firestore kanallarına da yayınlandı. Yayın: tools/github-yayinla.sh.
- 2.12.0: Ayarlar > Kullanım Limitleri (web/kullanim.js ortak istemci = departures-mil/duyurular/istemci/kullanim.js, web/kullanim-baslat.js).
  Firestore SDK sayımı app.js içinde yamayla: onSnapshot (sunucudan gelen docChanges = okuma), toplu set/commit ve setDoc = yazma,
  resource-exhausted = kota doldu. Gemini fetch'leri kendiliğinden sayılır. Yönetici Gemini anahtarı ARTIK PAKETE GÖMÜLMEZ
  (derle.sh'tan kaldırıldı): herkes ⚙ ile kendi anahtarını girer ya da kendi Firestore'unda kitapliklar/{kod}/ayarlar/yapayzeka.geminiKey.
- 2.14.0: ✦ Asistan Agent (ortak-cekirdek/web/dist/fc-agent.js + web/agent-baslat.js). Bütün uygulamalardaki çalışmayı sayılarla
  izler (içerik yok), çevrim dışı kurallar + kullanıcının kendi Gemini anahtarıyla öneri; bildirim (KitaplikAndroid/kitaplikDesktop.notifyNow)
  + sağ altta ✦ panel. Ayarlar'da "Yönetici ile İletişim"in önüne kart. Masaüstü: desktop/fc-agent-main.js + preload fcAgentHost
  (%APPDATA%/FalconCekirdek/agent ile diğer programlarla paylaşım). Güncellemek: fc-agent.js'yi çekirdekten yeniden kopyala.
- 2.14.1: fc-agent.js yenilendi (menü/yerleşim iyileştirmeleri, Gemini modeli gemini-flash-latest).
