/* Kitaplık — ortak çekirdek kabuğu (web/cekirdek/fc-core.js). app.js'ten ÖNCE yüklenir; app.js'e yalnız kancalarla bağlanır
   (Kabuk.ayarlar(view), Kabuk.cizildi(sekme), window.__kitaplikYedek, window.__kitaplikLan).
   Burada: sağ üst sıra (Eşitle · Wi‑Fi · Güncelle · Tema · Dil | Küçült · Orta · Tam ekran · Kapat), "klasik" renk şeması
   (2.13'e kadarki kahverengi görünüm), ayarlar düzeni (Görünüm · uygulama kartları · Arşiv · Yapay zekâ · … · Admin ile iletişim EN SON),
   Kullanım Limitleri (eski window.Kullanim sayaçları → FC.usage), ilk açılış rehberi, "neler yeni", duyurular, çökme raporu,
   uzak silme → arşiv / çakışma → yedek, Android güncellemesi (ApkPatchInstaller köprüsü) ve ESKİ KABUK KÖPRÜSÜ.

   Eski kabuk köprüsü (masaüstü): ≤2.13 kurulumlarının başlatıcısı imzalı "masaustu2" paketini userData/guncelleme/<sürüm>/'den açar
   (desktop/app-main.js → LEGACY). Program olduğu gibi çalışır; bu dosya "Yeni kurulum gerekli" penceresini gösterir ve kurulum dosyasını
   (latest.json → win-setup) tek tıkla indirip çalıştırır. Kayıtlar (localStorage / IndexedDB, %APPDATA%\Kitaplık) aynı yerde kalır. */
(function () {
  'use strict';
  var OWNER = 'departures-mil', REPO = 'kitaplik', APP = 'kitaplik';
  var REL = window.APP_RELEASE || { version: '0.0.0', notes: {} };
  var VER = REL.version;
  var DESK = window.kitaplikDesktop || null, AND = window.KitaplikAndroid || null, AB = window.AndroidBridge || null;
  var LEGACY = !!(DESK && (DESK.legacy || DESK.shell !== 'fc'));          // eski masaüstü başlatıcısı
  var LEGACY_ANDROID = !!(AND && !AB);                                     // eski APK kabuğu (yeni arayüz normalde oraya gitmez)
  var ui = FC.ui;
  window.__kitaplikErrors = [];
  window.addEventListener('error', function (e) { if (e && e.message && !/ResizeObserver/.test(e.message)) window.__kitaplikErrors.push(String(e.message)); });

  /* ---------- metinler ---------- */
  FC.i18n.add({
    tr: {
      'kb.arsiv': 'Arşiv ve silinenler', 'kb.arsiv.desc': 'Başka cihazda silinen kayıtlar bu cihazda silinmez, burada arşivlenir. Kendi sildikleriniz de burada durur; istediğinizi geri alabilirsiniz.',
      'kb.arsiv.bos': 'Arşivde kayıt yok.', 'kb.arsiv.geri': 'Geri al', 'kb.arsiv.geriAlindi': 'Geri alındı: {s}', 'kb.arsiv.uzak': 'başka cihazda silindi', 'kb.arsiv.yerel': 'bu cihazda silindi',
      'kb.arsiv.yedek': 'Çakışma yedeği: {n} kayıt', 'kb.arsiv.yedekIndir': 'Yedekleri indir (JSON)', 'kb.arsiv.fazla': '… ve {n} kayıt daha',
      'kb.col.books': 'Kitaplar', 'kb.col.loans': 'Ödünçler', 'kb.col.categories': 'Kategoriler', 'kb.col.locations': 'Konumlar',
      'kb.ai': 'Yapay zekâ (fotoğraftan okuma)', 'kb.ai.desc': 'Kitap fotoğrafından bilgileri internette Google Gemini ile okur; internet yoksa cihazda (çevrimdışı) okur. Gemini için kendi ücretsiz anahtarınızı girin — anahtar yalnız bu cihazda saklanır.',
      'kb.ai.var': 'Gemini anahtarı girildi.', 'kb.ai.yok': 'Anahtar yok: yalnız çevrimdışı okuma kullanılır.', 'kb.ai.kaydet': 'Kaydet', 'kb.ai.sil': 'Anahtarı sil', 'kb.ai.al': 'Anahtar al', 'kb.ai.kaydedildi': 'Kaydedildi.', 'kb.ai.yalnizGemini': 'Fotoğraftan okuma şimdilik yalnız Google Gemini anahtarıyla çalışır.',
      'kb.fb.doldur': 'Firebase bilgileri Ayarlar\'a yazıldı. Kitaplık kodunu kontrol edip "Eşitlemeyi başlat"a basın (ikinci cihazda ilk cihazın kodunu yazın).',
      'kb.kurulum': 'Yeni kurulum gerekli', 'kb.kurulum.p1': 'Kitaplık {v} yeni bir kurulum programıyla gelir: tam ekran açılış, tek tuşla güncelleme (yalnızca değişen kısımlar indirilir) ve yeni görünüm. Bir kez kurun; sonraki güncellemeler kendiliğinden gelir.',
      'kb.kurulum.p2': 'Kayıtlarınız korunur: kitaplar, ödünçler, ayarlar ve eşitleme bilgileri aynı yerde kalır, yeni sürüm onları kendiliğinden açar.',
      'kb.kurulum.p3': '"İndir ve kur" düğmesi kurulum dosyasını indirir, bu pencereyi kapatır ve kurulumu başlatır; birkaç saniye sonra Kitaplık yeniden açılır. Masaüstüne yeni "Kitaplık" kısayolu eklenir; eski kısayolu silebilirsiniz.',
      'kb.kurulum.kur': 'İndir ve kur', 'kb.kurulum.sayfa': 'Sürümler sayfası', 'kb.kurulum.sonra': 'Daha sonra', 'kb.kurulum.iniyor': 'Kurulum dosyası indiriliyor', 'kb.kurulum.hata': 'Kurulum dosyası indirilemedi ({e}). Sürümler sayfasından indirebilirsiniz.',
      'kb.apk': 'Yeni uygulama sürümü gerekli', 'kb.apk.p1': 'Kitaplık {v} için uygulamanın yeni sürümünü (APK) kurun; kayıtlarınız korunur.'
    },
    en: {
      'kb.arsiv': 'Archive and deleted', 'kb.arsiv.desc': 'Records deleted on another device are not deleted here; they are archived. Records you deleted yourself are kept here too, and you can restore any of them.',
      'kb.arsiv.bos': 'The archive is empty.', 'kb.arsiv.geri': 'Restore', 'kb.arsiv.geriAlindi': 'Restored: {s}', 'kb.arsiv.uzak': 'deleted on another device', 'kb.arsiv.yerel': 'deleted on this device',
      'kb.arsiv.yedek': 'Conflict backup: {n} records', 'kb.arsiv.yedekIndir': 'Download backups (JSON)', 'kb.arsiv.fazla': '… and {n} more',
      'kb.col.books': 'Books', 'kb.col.loans': 'Loans', 'kb.col.categories': 'Categories', 'kb.col.locations': 'Locations',
      'kb.ai': 'AI (reading from photos)', 'kb.ai.desc': 'Reads book details from a photo with Google Gemini when online, and on the device (offline) otherwise. Enter your own free Gemini key — it is stored only on this device.',
      'kb.ai.var': 'A Gemini key is set.', 'kb.ai.yok': 'No key: only offline reading is used.', 'kb.ai.kaydet': 'Save', 'kb.ai.sil': 'Remove key', 'kb.ai.al': 'Get a key', 'kb.ai.kaydedildi': 'Saved.', 'kb.ai.yalnizGemini': 'Reading from photos currently works only with a Google Gemini key.',
      'kb.fb.doldur': 'The Firebase details were filled in Settings. Check the library code and press "Start sync" (on a second device enter the first device\'s code).',
      'kb.kurulum': 'New installer required', 'kb.kurulum.p1': 'Kitaplık {v} comes with a new installer: full-screen start, one-click updates (only the changed parts are downloaded) and a new look. Install it once; later updates arrive automatically.',
      'kb.kurulum.p2': 'Your records are kept: books, loans, settings and sync details stay where they are and the new version opens them automatically.',
      'kb.kurulum.p3': '"Download and install" downloads the installer, closes this window and starts the installation; Kitaplık reopens a few seconds later. A new "Kitaplık" desktop shortcut is added; you may delete the old one.',
      'kb.kurulum.kur': 'Download and install', 'kb.kurulum.sayfa': 'Releases page', 'kb.kurulum.sonra': 'Later', 'kb.kurulum.iniyor': 'Downloading the installer', 'kb.kurulum.hata': 'The installer could not be downloaded ({e}). You can download it from the releases page.',
      'kb.apk': 'New app version required', 'kb.apk.p1': 'Install the new app version (APK) for Kitaplık {v}; your records are kept.'
    },
    ar: {
      'kb.arsiv': 'الأرشيف والمحذوفات', 'kb.arsiv.desc': 'السجلات المحذوفة على جهاز آخر لا تُحذف هنا بل تُؤرشف. وتبقى هنا أيضاً السجلات التي حذفتها بنفسك، ويمكنك استعادة أيٍّ منها.',
      'kb.arsiv.bos': 'الأرشيف فارغ.', 'kb.arsiv.geri': 'استعادة', 'kb.arsiv.geriAlindi': 'تمت الاستعادة: {s}', 'kb.arsiv.uzak': 'حُذف على جهاز آخر', 'kb.arsiv.yerel': 'حُذف على هذا الجهاز',
      'kb.arsiv.yedek': 'نسخة احتياطية للتعارضات: {n} سجل', 'kb.arsiv.yedekIndir': 'تنزيل النسخ الاحتياطية (JSON)', 'kb.arsiv.fazla': '… و{n} سجلات أخرى',
      'kb.col.books': 'الكتب', 'kb.col.loans': 'الإعارات', 'kb.col.categories': 'التصنيفات', 'kb.col.locations': 'المواقع',
      'kb.ai': 'الذكاء الاصطناعي (القراءة من الصور)', 'kb.ai.desc': 'يقرأ بيانات الكتاب من الصورة عبر Google Gemini عند الاتصال بالإنترنت، وعلى الجهاز (دون اتصال) خلاف ذلك. أدخل مفتاح Gemini المجاني الخاص بك — يُحفظ على هذا الجهاز فقط.',
      'kb.ai.var': 'تم إدخال مفتاح Gemini.', 'kb.ai.yok': 'لا يوجد مفتاح: تُستخدم القراءة دون اتصال فقط.', 'kb.ai.kaydet': 'حفظ', 'kb.ai.sil': 'حذف المفتاح', 'kb.ai.al': 'الحصول على مفتاح', 'kb.ai.kaydedildi': 'تم الحفظ.', 'kb.ai.yalnizGemini': 'القراءة من الصور تعمل حالياً بمفتاح Google Gemini فقط.',
      'kb.fb.doldur': 'كُتبت بيانات Firebase في الإعدادات. تحقّق من رمز المكتبة ثم اضغط «بدء المزامنة» (على الجهاز الثاني أدخل رمز الجهاز الأول).',
      'kb.kurulum': 'يلزم مثبّت جديد', 'kb.kurulum.p1': 'يأتي Kitaplık {v} بمثبّت جديد: فتح بملء الشاشة، وتحديث بضغطة واحدة (تُنزَّل الأجزاء المتغيرة فقط)، ومظهر جديد. ثبّته مرة واحدة؛ وستصل التحديثات التالية تلقائياً.',
      'kb.kurulum.p2': 'سجلاتك محفوظة: الكتب والإعارات والإعدادات وبيانات المزامنة تبقى في مكانها ويفتحها الإصدار الجديد تلقائياً.',
      'kb.kurulum.p3': 'زر «تنزيل وتثبيت» ينزّل ملف التثبيت ويغلق هذه النافذة ويبدأ التثبيت؛ ثم يُعاد فتح Kitaplık بعد ثوانٍ. يُضاف اختصار جديد باسم «Kitaplık» على سطح المكتب، ويمكنك حذف الاختصار القديم.',
      'kb.kurulum.kur': 'تنزيل وتثبيت', 'kb.kurulum.sayfa': 'صفحة الإصدارات', 'kb.kurulum.sonra': 'لاحقاً', 'kb.kurulum.iniyor': 'جارٍ تنزيل ملف التثبيت', 'kb.kurulum.hata': 'تعذّر تنزيل ملف التثبيت ({e}). يمكنك تنزيله من صفحة الإصدارات.',
      'kb.apk': 'يلزم إصدار جديد من التطبيق', 'kb.apk.p1': 'ثبّت الإصدار الجديد من التطبيق (APK) لـ Kitaplık {v}؛ سجلاتك محفوظة.'
    }
  });
  var T = function (k, v) { return FC.t(k, v); };

  /* ---------- "klasik" şema: 2.13'e kadarki style.css renkleri (açık = :root, koyu = prefers-color-scheme: dark) ---------- */
  FC.look.registerScheme('klasik', {
    label: { tr: 'Klasik (eski görünüm)', en: 'Classic (previous look)', ar: 'الكلاسيكي (المظهر السابق)' },
    light: {
      '--bg': '#fbf6f3', '--bg-grid': '#0000', '--panel': '#ffffff', '--panel-solid': '#ffffff', '--panel-hover': '#f3ebe6',
      '--border': '#e3d6cf', '--border-strong': '#a1887f', '--border-w': '1px', '--text': '#2b211d', '--muted': '#7b6a62', '--label': '#4e3f39',
      '--nav-text': '#7b6a62', '--nav-title': '#9a8a82', '--accent': '#6d4c41', '--accent-2': '#8d6e63', '--on-accent': '#ffffff',
      '--primary-1': '#6d4c41', '--primary-2': '#6d4c41', '--active-1': '#6d4c4129', '--active-2': '#6d4c4114', '--active-line': '#6d4c4166',
      '--accent-soft': '#efe0d9', '--accent-line': '#6d4c4159', '--focus': '#6d4c41', '--focus-w': '2px', '--focus-ring': '#6d4c4126',
      '--danger': '#b3261e', '--warn': '#8a5a00', '--ok': '#2e6b30', '--ok-text': '#2e6b30', '--danger-text': '#b3261e', '--warn-text': '#8a5a00',
      '--ok-soft': '#dcefdc', '--ok-line': '#2e6b3059', '--danger-soft': '#fbe3e0', '--danger-line': '#b3261e59', '--warn-soft': '#fbecc9', '--warn-line': '#8a5a0059',
      '--sidebar-bg': '#ffffff', '--topbar-bg': '#fbf6f3e6', '--modal-bg': '#fbf6f3', '--modal-border': '#e3d6cf', '--backdrop': '#00000073',
      '--toast-bg': '#322825', '--toast-text': '#ffffff', '--toast-line': '#322825', '--toast-err-bg': '#b3261e', '--toast-err-text': '#ffffff', '--toast-err-line': '#b3261e',
      '--badge-text': '#4e3f39', '--badge-bg': '#efe0d9', '--badge-line': '#e3d6cf', '--on-badge': '#ffffff',
      '--bar-track': '#f3ebe6', '--scroll-thumb': '#7b6a6259', '--glow-1': '#0000', '--glow-2': '#0000',
      '--shadow-pop': '0 8px 24px #3c1e1426', '--shadow-modal': '0 20px 60px #3c1e1440', '--shadow-toast': '0 8px 24px #0000004d'
    },
    dark: {
      '--bg': '#1a1513', '--bg-grid': '#0000', '--panel': '#241d1a', '--panel-solid': '#241d1a', '--panel-hover': '#2f2622',
      '--border': '#3d322d', '--border-strong': '#d7a48f73', '--border-w': '1px', '--text': '#efe5df', '--muted': '#b3a39b', '--label': '#d8cbc4',
      '--nav-text': '#b3a39b', '--nav-title': '#8f7f77', '--accent': '#d7a48f', '--accent-2': '#c08a74', '--on-accent': '#2b1a13',
      '--primary-1': '#d7a48f', '--primary-2': '#d7a48f', '--active-1': '#d7a48f33', '--active-2': '#d7a48f1a', '--active-line': '#d7a48f66',
      '--accent-soft': '#3d2d27', '--accent-line': '#d7a48f59', '--focus': '#d7a48f', '--focus-w': '2px', '--focus-ring': '#d7a48f33',
      '--danger': '#ffb4ab', '--warn': '#f2c46b', '--ok': '#9ed39f', '--ok-text': '#9ed39f', '--danger-text': '#ffb4ab', '--warn-text': '#f2c46b',
      '--ok-soft': '#1f3a20', '--ok-line': '#9ed39f59', '--danger-soft': '#4a1f1b', '--danger-line': '#ffb4ab59', '--warn-soft': '#463614', '--warn-line': '#f2c46b59',
      '--sidebar-bg': '#241d1a', '--topbar-bg': '#1a1513e6', '--modal-bg': '#1a1513', '--modal-border': '#3d322d', '--backdrop': '#000000a6',
      '--toast-bg': '#322825', '--toast-text': '#ffffff', '--toast-line': '#3d322d', '--toast-err-bg': '#4a1f1b', '--toast-err-text': '#ffffff', '--toast-err-line': '#ffb4ab59',
      '--badge-text': '#efe5df', '--badge-bg': '#3d2d27', '--badge-line': '#3d322d', '--on-badge': '#2b1a13',
      '--bar-track': '#2f2622', '--scroll-thumb': '#b3a39b40', '--glow-1': '#0000', '--glow-2': '#0000',
      '--shadow-pop': '0 8px 24px #00000080', '--shadow-modal': '0 20px 60px #000000a6', '--shadow-toast': '0 8px 24px #00000080'
    }
  });

  /* ---------- dil: çekirdek (fc.lang) ↔ uygulama (kitaplik.dil; dil.js sayfa yüklenirken çevirir) ---------- */
  function appLang() { try { var l = localStorage.getItem('kitaplik.dil') || ''; return /^(tr|en|ar)$/.test(l) ? l : ''; } catch (e) { return ''; } }
  if (FC.storage.get('lang', null) == null && appLang()) FC.i18n.set(appLang());
  try { if (appLang() !== FC.i18n.lang()) localStorage.setItem('kitaplik.dil', FC.i18n.lang()); } catch (e) { /* yoksay */ }
  FC.i18n.onChange(function (l) {
    try { if (localStorage.getItem('kitaplik.dil') === l) return; localStorage.setItem('kitaplik.dil', l); } catch (e) { /* yoksay */ }
    setTimeout(function () { location.reload(); }, 50);   // dil.js metinleri yüklenirken çevirir
  });

  /* ---------- kullanım sayaçları: eski window.Kullanim (app.js Firestore SDK sayımı) → FC.usage ---------- */
  window.Kullanim = {
    say: function (tur, n) { FC.usage.count(tur === 'okuma' ? 'firebase.read' : tur === 'silme' ? 'firebase.delete' : 'firebase.write', n || 1); },
    kotaDoldu: function (ne) { FC.usage.count(ne === 'ai' ? 'ai.gemini.full' : 'firebase.full'); }
  };
  FC.usage.wrapFetch();   // Gemini (fotoğraftan okuma) çağrıları kendiliğinden sayılır

  /* ---------- eşitleme kuralı: Firebase'den gelen değişiklik yerel kaydın üstüne yazılırken eski hal yedeklenir ---------- */
  var YEDEK = 'kitaplik.cakisma.yedek';
  window.__kitaplikYedek = function (col, eski, yeni) {
    if (!eski || !yeni || FC.lanMerge.canon(eski, ['updatedAt']) === FC.lanMerge.canon(yeni, ['updatedAt'])) return;
    try {
      var b = JSON.parse(localStorage.getItem(YEDEK) || '[]');
      b.unshift({ at: Date.now(), col: col, kaynak: 'firebase', d: eski });
      localStorage.setItem(YEDEK, JSON.stringify(b.slice(0, 200)));
    } catch (e) { /* yer yoksa yedek atlanır */ }
  };

  /* ---------- Android: güncelleme yerel tarafta (kurulu APK + yama → yeni APK, ortak ApkPatchInstaller; hata → tam APK) ---------- */
  if (FC.host.kind === 'android' && AB && typeof AB.apkUpdate === 'function') {
    FC.host.update.run = function (plan, onEv) {
      return new Promise(function (resolve, reject) {
        window.__fcApk = function (ev) {
          if (!ev) return;
          if (ev.type === 'progress') onEv({ patch: !!ev.patch, done: ev.done, total: ev.total, finished: !!ev.finished });
          else if (ev.type === 'patchFailed') onEv({ patchFailed: true, error: ev.error });
          else if (ev.type === 'installing') onEv({ installing: true });
          else if (ev.type === 'done') resolve(ev.result || 'done');
          else if (ev.type === 'error') reject(Object.assign(new Error(ev.error || 'FAILED'), { code: ev.error || 'FAILED' }));
        };
        try {
          AB.apkUpdate(JSON.stringify({ version: plan.version, full: plan.full, patch: plan.mode === 'patch' ? { url: plan.url, sha256: plan.sha256, size: plan.size } : null }));
        } catch (e) { reject(e); }
      });
    };
    FC.host.can.update = true;
  }

  /* ---------- çekirdeği başlat ---------- */
  // 2.13'ten gelen kullanıcı: "neler yeni" ilk açılışta gösterilsin, ilk açılış rehberi gösterilmesin
  var ESKI = (function () { try { return !!localStorage.getItem('kitaplik.v2'); } catch (e) { return false; } })();
  try { if (FC.storage.get('whatsnew.seen', null) == null && ESKI) FC.storage.set('whatsnew.seen', '2.13.0'); } catch (e) { /* yoksay */ }
  try { if (ESKI && FC.storage.get('onboarding.done', null) == null) FC.storage.set('onboarding.done', true); } catch (e) { /* yoksay */ }
  // Kendi Gemini anahtarı: çekirdek (fc.ai) ↔ uygulama (kitaplik.geminiKey)
  try { var gk = localStorage.getItem('kitaplik.geminiKey'); if (gk && !FC.storage.get('ai', null)) FC.storage.set('ai', { provider: 'gemini', key: gk }); } catch (e) { /* yoksay */ }
  FC.init({ app: APP, repo: REPO, version: VER, setupChannel: FC.host.kind === 'android' ? undefined : 'win-setup', announcements: true, whatsnew: false, onboarding: false });

  function ayar() { try { return JSON.parse(localStorage.getItem('kitaplik.v2') || '{}').settings || {}; } catch (e) { return {}; } }
  function projeId() { var a = ayar(), fc = a.firebaseConfig; try { if (typeof fc === 'string') fc = JSON.parse(fc); } catch (e) { fc = null; } return (a.libraryCode && fc && fc.projectId) || ''; }
  var bekleyenFb = null;
  function OB() {
    return {
      firebase: !projeId(), ai: true,
      onFirebase: function (cfg) { bekleyenFb = cfg; },
      onAi: function (a) {
        if (!a || !a.key) return;
        if (a.provider === 'gemini') { try { localStorage.setItem('kitaplik.geminiKey', a.key); } catch (e) { /* yoksay */ } }
        else ui.toast(T('kb.ai.yalnizGemini'), 'info');
      },
      onClose: function () {
        if (!bekleyenFb) return;
        var cfg = bekleyenFb; bekleyenFb = null;
        sekme('settings');
        setTimeout(function () {
          var ta = document.getElementById('fbcfg');
          if (ta) { ta.value = JSON.stringify(cfg, null, 2); var d = ta.closest('details'); if (d) d.open = true; ta.scrollIntoView({ block: 'center' }); }
          ui.toast(T('kb.fb.doldur'), 'info', 9000);
        }, 120);
      }
    };
  }

  /* ---------- yardımcılar ---------- */
  function sekme(t) { var b = document.querySelector('#nav [data-tab="' + t + '"]'); if (b) b.click(); }
  function act(name) {   // app.js'in [data-act] tıklama işleyicisini tetikler
    var t = document.createElement('span'); t.dataset.act = name; t.hidden = true; document.body.appendChild(t); t.click();
    setTimeout(function () { t.remove(); }, 0);
  }
  function kaydetDosya(ad, metin) {
    if (AND && AND.saveFile) return Promise.resolve(AND.saveFile(ad, 'application/json', metin));
    if (DESK && DESK.saveFile) return DESK.saveFile(ad, metin);
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([metin], { type: 'application/json' })); a.download = ad;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return Promise.resolve(ad);
  }

  /* ---------- üst çubuk ---------- */
  var tb = null, probe = null;
  var DURUM = { on: 'idle', connecting: 'syncing', error: 'error', off: 'off' };
  function syncDurum() {
    var st = ((probe && probe.className.match(/sync-pill\s+(\S+)/)) || [])[1] || 'off';
    if (st !== 'off' && navigator.onLine === false) return 'offline';
    return DURUM[st] || 'off';
  }
  function ustCubuk() {
    var bar = document.getElementById('topbar'); if (!bar || tb) return;
    tb = FC.topbar.mount(bar, {
      before: [FC.announcements.button()],
      sync: { state: 'off', onClick: function (st) { if (st === 'off') { sekme('settings'); } else act('syncNow'); } },
      lan: AND || DESK ? { onClick: function () { if (window.LanCore) LanCore.open(); } } : false
    });
    // app.js her durum değişiminde tüm .sync-pill öğelerini günceller; gizli bir tanesinden okunur
    probe = document.createElement('span'); probe.className = 'sync-pill off'; probe.hidden = true; probe.setAttribute('data-notr', '');
    document.body.appendChild(probe);
    var ciz = function () { tb.setSync(syncDurum()); };
    new MutationObserver(ciz).observe(probe, { attributes: true, childList: true, subtree: true, characterData: true });
    window.addEventListener('online', ciz); window.addEventListener('offline', ciz);
    ciz();
  }

  /* ---------- sayfa başlığı üst çubukta ---------- */
  function cizildi(tab) {
    var h = document.querySelector('#view > .bar-top > h1'), pt = document.getElementById('pageTitle'), ps = document.getElementById('pageSub');
    if (h && pt) pt.textContent = h.textContent;
    if (ps) ps.textContent = 'Kitaplık · v' + VER;
    if (tab) document.documentElement.setAttribute('data-sekme', tab);
  }

  /* ---------- ayarlar: Görünüm · uygulama kartları · Arşiv · Yapay zekâ · Asistan · Kullanım · Hata raporu · Hakkında · İletişim (SON) ---------- */
  var grid = null;
  function ayarlar(view) {
    if (!grid) {
      var holder = document.createElement('div');
      grid = FC.settings.build(holder, { cards: [], usage: { project: projeId }, about: { version: VER }, onboarding: OB() }).el;
      grid.id = 'fcSettings';
    }
    Array.prototype.slice.call(grid.querySelectorAll(':scope > [data-kitaplik-kart]')).forEach(function (n) { n.remove(); });
    var kartlar = Array.prototype.slice.call(view.children).filter(function (n) { return n.classList && n.classList.contains('card'); });
    kartlar.push(arsivKart(), aiKart());
    if (window.FCYZ && FCYZ.available()) { // çevrimdışı yapay zekâ: kitap fotoğrafından okuma (OCR) + çeviri paketleri
      var lg = document.documentElement.lang || 'tr', yz = ui.card({ key: 'kitaplik-yerel-zeka', title: FCYZ.title({ lang: lg }), icon: 'cloud' });
      yz.appendChild(FCYZ.card({ lang: lg, packs: ['ocr'] })); kartlar.push(yz);
    }
    var look = grid.querySelector(':scope > [data-fc-card="look"]');
    var ref = look ? look.nextSibling : grid.firstChild;
    kartlar.forEach(function (k) { k.setAttribute('data-kitaplik-kart', ''); grid.insertBefore(k, ref); });
    view.appendChild(grid);
  }

  var COLS = ['books', 'loans', 'categories', 'locations'];
  function etiket(col, r, q) {
    if (col === 'books') return [r.title || '—', r.author || ''];
    if (col === 'loans') { var b = (q.books || {})[r.bookId]; return [(r.borrower || '—') + ' · ' + ((b && b.title) || ''), r.lentAt || '']; }
    return [r.name || '—', r.description || ''];
  }
  function arsivKart() {
    var c = ui.card({ key: 'kitaplik-arsiv', title: T('kb.arsiv'), icon: 'box', desc: T('kb.arsiv.desc') });
    var K = window.__kitaplikLan, q = K ? K.get() : {}, toplam = 0;
    COLS.forEach(function (col) {
      var list = Object.keys(q[col] || {}).map(function (id) { return q[col][id]; }).filter(function (r) { return r && (r.archived || r.deleted); });
      if (!list.length) return;
      toplam += list.length;
      list.sort(function (a, b) { return (Number(b.archivedAt || b.updatedAt) || 0) - (Number(a.archivedAt || a.updatedAt) || 0); });
      c.appendChild(ui.el('h4', { text: T('kb.col.' + col) + ' (' + list.length + ')', style: 'margin:12px 0 4px' }));
      list.slice(0, 40).forEach(function (r) {
        var e = etiket(col, r, q);
        var b = ui.el('button.btn.small', { type: 'button', html: ui.icon('sync') + ui.esc(T('kb.arsiv.geri')) });
        b.addEventListener('click', function () {
          var yeni = Object.assign({}, r, { archived: false, deleted: false, updatedAt: Date.now() }); delete yeni.archivedAt;
          K.put(col, yeni);
          ui.toast(T('kb.arsiv.geriAlindi', { s: e[0] }), 'ok');
        });
        c.appendChild(ui.el('div.arsiv-row', null, [
          ui.el('div.grow', null, [ui.el('span', { text: e[0], dir: 'auto' }), ui.el('small', { text: (r.archived ? T('kb.arsiv.uzak') : T('kb.arsiv.yerel')) + (e[1] ? ' · ' + e[1] : ''), dir: 'auto' })]), b]));
      });
      if (list.length > 40) c.appendChild(ui.el('p.card-desc', { text: T('kb.arsiv.fazla', { n: list.length - 40 }) }));
    });
    if (!toplam) c.appendChild(ui.el('p.card-desc', { text: T('kb.arsiv.bos') }));
    var y = []; try { y = JSON.parse(localStorage.getItem(YEDEK) || '[]').concat(JSON.parse(localStorage.getItem('kitaplik.wifi.yedek') || '[]')); } catch (e) { /* yoksay */ }
    if (y.length) {
      c.appendChild(ui.el('p.card-desc', { text: T('kb.arsiv.yedek', { n: y.length }), style: 'margin-top:10px' }));
      c.appendChild(ui.el('button.btn.small', { type: 'button', html: ui.icon('download') + ui.esc(T('kb.arsiv.yedekIndir')), onclick: function () {
        kaydetDosya('kitaplik-cakisma-yedekleri-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(y, null, 1)).then(function (m) { if (m) ui.toast(String(m), 'ok'); });
      } }));
    }
    return c;
  }
  function aiKart() {
    var c = ui.card({ key: 'kitaplik-ai', title: T('kb.ai'), icon: 'sparkles', desc: T('kb.ai.desc') });
    var cur = ''; try { cur = localStorage.getItem('kitaplik.geminiKey') || ''; } catch (e) { /* yoksay */ }
    var durum = ui.el('div.notice' + (cur ? '.ok' : ''), { text: cur ? T('kb.ai.var') : T('kb.ai.yok') });
    var inp = ui.el('input', { type: 'password', autocomplete: 'off', placeholder: 'AIza…', value: cur ? '••••••••' + cur.slice(-4) : '', style: 'width:100%;margin:8px 0', dir: 'ltr' });
    inp.addEventListener('focus', function () { if (/^•/.test(inp.value)) inp.value = ''; });
    var kaydet = function (k) {
      try { k ? localStorage.setItem('kitaplik.geminiKey', k) : localStorage.removeItem('kitaplik.geminiKey'); } catch (e) { /* yoksay */ }
      FC.storage.set('ai', k ? { provider: 'gemini', key: k } : null);
      ui.toast(T('kb.ai.kaydedildi'), 'ok');
      var yeni = aiKart(); yeni.setAttribute('data-kitaplik-kart', ''); c.replaceWith(yeni);
    };
    c.appendChild(durum); c.appendChild(inp);
    c.appendChild(ui.el('div.fc-row', null, [
      ui.el('button.btn.small.primary', { type: 'button', text: T('kb.ai.kaydet'), onclick: function () { var v = inp.value.trim(); if (v && !/^•/.test(v)) kaydet(v); } }),
      cur ? ui.el('button.btn.small.ghost', { type: 'button', text: T('kb.ai.sil'), onclick: function () { kaydet(''); } }) : null,
      ui.el('button.btn.small', { type: 'button', text: T('kb.ai.al'), onclick: function () { ui.openUrl('https://aistudio.google.com/app/apikey'); } })
    ].filter(Boolean)));
    return c;
  }

  /* ---------- eski kabuk köprüsü ---------- */
  function relUrl() { return 'https://github.com/' + OWNER + '/' + REPO + '/releases/latest'; }
  async function kurulumIndir(box, ilerleme) {
    var h = FC.host;
    var man = JSON.parse(new TextDecoder().decode(await h.net.download(FC.updater.manifestUrl({ repo: REPO }), function () {})));
    var a = man && man.assets && man.assets['win-setup'];
    if (!a || !a.file || !/^[0-9a-f]{64}$/i.test(a.sha256 || '')) throw Object.assign(new Error('NO_SETUP'), { code: 'NO_SETUP' });
    var url = FC.updater.assetUrl({ repo: REPO }, man.version, a.file), tr = FC.progress.tracker(+a.size);
    ilerleme.title(T('kb.kurulum.iniyor') + ' — Kitaplık ' + man.version);
    var bytes = await h.net.download(url, function (d) { ilerleme.set(tr.update(d.done != null ? d.done : d, d.finished)); });
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (bytes.length !== +a.size || (await FC.updater.sha256(bytes)) !== String(a.sha256).toLowerCase()) throw Object.assign(new Error('BAD_HASH'), { code: 'BAD_HASH' });
    ilerleme.busy(FC.t('fc.update.installing'));
    return h.update.installFull(bytes, { channel: 'win-setup', version: man.version, targetSha256: String(a.sha256).toLowerCase(), targetSize: +a.size, file: a.file });
  }
  var kopruAcik = false;
  function bridge() {
    if (kopruAcik) return; kopruAcik = true;
    var body = ui.el('div');
    if (LEGACY_ANDROID) {
      body.appendChild(ui.el('p', { text: T('kb.apk.p1', { v: VER }) }));
      ui.modal({ title: T('kb.apk'), icon: 'download', body: body, onClose: function () { kopruAcik = false; }, buttons: [
        { label: T('kb.kurulum.sonra'), cls: 'ghost' }, 'spacer',
        { label: T('kb.kurulum.sayfa'), icon: 'download', cls: 'primary', onClick: function () { if (AND.openUrl) AND.openUrl(relUrl()); else ui.openUrl(relUrl()); return false; } }
      ] });
      return;
    }
    body.appendChild(ui.el('p', { text: T('kb.kurulum.p1', { v: VER }) }));
    body.appendChild(ui.el('div.notice.ok', null, [ui.el('span', { html: ui.icon('check') }), ui.el('span', { text: T('kb.kurulum.p2') })]));
    body.appendChild(ui.el('p.muted', { text: T('kb.kurulum.p3'), style: 'margin-top:12px' }));
    var pb = FC.progress.box(); pb.el.hidden = true; body.appendChild(pb.el);
    var calisiyor = false;
    ui.modal({ title: T('kb.kurulum'), icon: 'download', body: body, onClose: function () { kopruAcik = false; }, buttons: [
      { label: T('kb.kurulum.sonra'), cls: 'ghost' }, 'spacer',
      { label: T('kb.kurulum.sayfa'), onClick: function () { ui.openUrl(relUrl()); return false; } },
      { label: T('kb.kurulum.kur'), icon: 'download', cls: 'primary', onClick: function () {
        if (calisiyor) return false; calisiyor = true; pb.el.hidden = false;
        kurulumIndir(body, pb).catch(function (e) {
          calisiyor = false; pb.el.hidden = true;
          ui.toast(T('kb.kurulum.hata', { e: (e && (e.code || e.message)) || 'ERR' }), 'error', 9000);
        });
        return false;
      } }
    ] });
  }
  if (LEGACY || LEGACY_ANDROID) {
    FC.updater.run = function () { bridge(); return Promise.resolve('legacy'); };
  }

  /* ---------- açılış ---------- */
  function basla() {
    ustCubuk(); cizildi();
    if (LEGACY || LEGACY_ANDROID) { setTimeout(bridge, 900); return; }
    var wn = FC.whatsnew.start({ version: VER, notes: function (v) { return v === VER ? REL.notes : null; } });
    if (!wn) setTimeout(function () { FC.onboarding.maybeStart(OB()); }, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla); else setTimeout(basla, 0);

  window.Kabuk = { ayarlar: ayarlar, cizildi: cizildi, bridge: bridge, legacy: LEGACY || LEGACY_ANDROID, esitlendi: function () { if (tb) tb.setSync(syncDurum()); }, sekme: sekme };
})();
