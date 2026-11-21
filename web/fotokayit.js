// Kitaplık — Fotoğraftan hızlı kitap kaydı.
// Kitap formuna "Fotoğraftan doldur" bölümü ekler: birkaç fotoğraf çekilir/seçilir,
// "Tamam, işle" deyince fotoğraflar okunur (barkod + yapay zekâ + ISBN sorgusu) ve
// bilgiler ilgili alanlara yazılır. app.js'den SONRA yüklenir.
(function () {
  'use strict';

  // ---- Dil (TR / EN / AR) ----
  var LANG = (function () {
    var l = '';
    try { l = localStorage.getItem('kitaplik.dil') || ''; } catch (e) {}
    l = (l || 'tr').slice(0, 2).toLowerCase();
    return l === 'ar' || l === 'en' ? l : 'tr';
  })();
  var T = {
    tr: {
      legend: '📸 Fotoğraftan hızlı kayıt',
      hint: 'Kapak, arka kapak, künye sayfası ve barkodun fotoğraflarını ekleyin, sonra "Tamam, işle" deyin.',
      shot: '📷 Fotoğraf çek', gallery: '🖼 Galeriden ekle', process: '✓ Tamam, işle',
      none: 'Henüz fotoğraf yok.', count: function (n) { return n + ' fotoğraf'; },
      auto: 'İşleyince otomatik kaydet ve yeni kitaba geç',
      remove: 'Kaldır', camDone: 'Bitti', camShot: '📷 Çek', camCancel: 'Vazgeç',
      camFail: 'Kamera açılamadı. Galeriden ekleyebilirsiniz.',
      needPhoto: 'Önce en az bir fotoğraf ekleyin.',
      prep: 'Fotoğraflar hazırlanıyor…', barcode: 'Barkod aranıyor…', ai: 'Yapay zekâ fotoğrafları okuyor…',
      lookup: 'ISBN ile kitap bilgisi aranıyor…',
      done: function (n) { return n + ' alan dolduruldu. Kontrol edip kaydedebilirsiniz.'; },
      nothing: 'Fotoğraflardan bilgi çıkarılamadı. Daha net/yakın bir fotoğraf deneyin.',
      offline: 'İnternet bağlantısı yok; fotoğraflar okunamadı.',
      aiFail: 'Yapay zekâ okuması yapılamadı: ',
      key: 'Yapay zekâ anahtarı', keyAsk: 'Gemini API anahtarını girin (boş bırakılırsa varsayılan kullanılır):',
      saved: 'Kaydedildi, sıradaki kitap için fotoğraf ekleyin.', noKey: 'yapay zekâ anahtarı henüz tanımlı değil (barkod/ISBN ile dolduruldu)', offPrep: 'İnternet yok — cihazda okunuyor (ilk seferde birkaç saniye sürer)…', offRead: function (i, n) { return 'Metin okunuyor (' + i + '/' + n + ')…'; }, offDone: function (n) { return n + ' alan internetsiz okundu. İnternet gelince yapay zekâyla yeniden okutabilirsiniz.'; }, aiDown: 'Yapay zekâya ulaşılamadı — cihazda okunuyor…', reread: '🔄 Yapay zekâyla yeniden oku', rereadInfo: 'Bu kitap internetsiz okundu; fotoğrafları bu cihazda saklı.', pending: function (n) { return '⏳ ' + n + ' kitap internetsiz okundu — yapay zekâyla oku'; }, batchDone: function (n) { return n + ' kitap yapay zekâyla yeniden okundu.'; }, batchStep: function (i, n) { return 'Yeniden okunuyor ' + i + '/' + n + '…'; }
    },
    en: {
      legend: '📸 Quick add from photos',
      hint: 'Add photos of the cover, back cover, copyright page and barcode, then tap "OK, process".',
      shot: '📷 Take photo', gallery: '🖼 Add from gallery', process: '✓ OK, process',
      none: 'No photos yet.', count: function (n) { return n + ' photo' + (n === 1 ? '' : 's'); },
      auto: 'Save automatically after processing and start a new book',
      remove: 'Remove', camDone: 'Done', camShot: '📷 Shoot', camCancel: 'Cancel',
      camFail: 'Camera could not be opened. You can add from the gallery.',
      needPhoto: 'Add at least one photo first.',
      prep: 'Preparing photos…', barcode: 'Looking for a barcode…', ai: 'AI is reading the photos…',
      lookup: 'Looking up the book by ISBN…',
      done: function (n) { return n + ' fields filled. Check them and save.'; },
      nothing: 'No information could be read. Try a sharper / closer photo.',
      offline: 'No internet connection; photos could not be read.',
      aiFail: 'AI reading failed: ',
      key: 'AI key', keyAsk: 'Enter a Gemini API key (leave empty for the default):',
      saved: 'Saved — add photos for the next book.', noKey: 'AI key not set yet (filled from barcode/ISBN)', offPrep: 'No internet — reading on the device (first time takes a few seconds)…', offRead: function (i, n) { return 'Reading text (' + i + '/' + n + ')…'; }, offDone: function (n) { return n + ' fields read offline. Re-read with AI when online.'; }, aiDown: 'AI unreachable — reading on the device…', reread: '🔄 Re-read with AI', rereadInfo: 'This book was read offline; its photos are kept on this device.', pending: function (n) { return '⏳ ' + n + ' book(s) read offline — read with AI'; }, batchDone: function (n) { return n + ' book(s) re-read with AI.'; }, batchStep: function (i, n) { return 'Re-reading ' + i + '/' + n + '…'; }
    },
    ar: {
      legend: '📸 إضافة سريعة من الصور',
      hint: 'أضف صور الغلاف والغلاف الخلفي وصفحة البيانات والباركود، ثم اضغط "تم، عالِج".',
      shot: '📷 التقاط صورة', gallery: '🖼 إضافة من المعرض', process: '✓ تم، عالِج',
      none: 'لا توجد صور بعد.', count: function (n) { return n + ' صورة'; },
      auto: 'احفظ تلقائياً بعد المعالجة وابدأ كتاباً جديداً',
      remove: 'إزالة', camDone: 'انتهيت', camShot: '📷 التقط', camCancel: 'إلغاء',
      camFail: 'تعذّر فتح الكاميرا. يمكنك الإضافة من المعرض.',
      needPhoto: 'أضف صورة واحدة على الأقل أولاً.',
      prep: 'جارٍ تجهيز الصور…', barcode: 'جارٍ البحث عن الباركود…', ai: 'الذكاء الاصطناعي يقرأ الصور…',
      lookup: 'جارٍ البحث عن الكتاب بالرقم الدولي…',
      done: function (n) { return 'تم ملء ' + n + ' حقلاً. راجِعها ثم احفظ.'; },
      nothing: 'تعذّر استخراج معلومات. جرّب صورة أوضح أو أقرب.',
      offline: 'لا يوجد اتصال بالإنترنت؛ تعذّرت قراءة الصور.',
      aiFail: 'تعذّرت القراءة بالذكاء الاصطناعي: ',
      key: 'مفتاح الذكاء الاصطناعي', keyAsk: 'أدخل مفتاح Gemini API (اتركه فارغاً لاستخدام الافتراضي):',
      saved: 'تم الحفظ — أضف صور الكتاب التالي.', noKey: 'مفتاح الذكاء الاصطناعي غير مُعرّف بعد', offPrep: 'لا يوجد إنترنت — تتم القراءة على الجهاز…', offRead: function (i, n) { return 'قراءة النص (' + i + '/' + n + ')…'; }, offDone: function (n) { return 'تمت قراءة ' + n + ' حقلاً دون إنترنت. أعد القراءة بالذكاء الاصطناعي عند الاتصال.'; }, aiDown: 'تعذّر الوصول إلى الذكاء الاصطناعي — تتم القراءة على الجهاز…', reread: '🔄 أعد القراءة بالذكاء الاصطناعي', rereadInfo: 'قُرئ هذا الكتاب دون إنترنت؛ صوره محفوظة على هذا الجهاز.', pending: function (n) { return '⏳ ' + n + ' كتاب قُرئ دون إنترنت — اقرأ بالذكاء الاصطناعي'; }, batchDone: function (n) { return 'أُعيدت قراءة ' + n + ' كتاب.'; }, batchStep: function (i, n) { return 'إعادة القراءة ' + i + '/' + n + '…'; }
    }
  }[LANG];

  // ---- Yapay zekâ ayarları ----
  var DEFAULT_KEY = '@GEMINI_KEY@';
  var MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'];
  // Anahtar sırası: cihazda elle girilen → Firestore (kitapliklar/{kod}/ayarlar/yapayzeka.geminiKey) → paketteki.
  var remoteKey = null;
  async function apiKey() {
    var k = '';
    try { k = localStorage.getItem('kitaplik.geminiKey') || ''; } catch (e) {}
    if (k) return k;
    if (remoteKey === null) {
      remoteKey = '';
      try {
        var st = JSON.parse(localStorage.getItem('kitaplik.v2') || '{}').settings || {};
        var fc = st.firebaseConfig, code = st.libraryCode;
        if (typeof fc === 'string') fc = JSON.parse(fc);
        if (fc && fc.projectId && fc.apiKey && code) {
          var u = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(fc.projectId) +
            '/databases/(default)/documents/kitapliklar/' + encodeURIComponent(String(code).replace(/\//g, '_')) +
            '/ayarlar/yapayzeka?key=' + encodeURIComponent(fc.apiKey);
          var r = await fetch(u);
          if (r.ok) { var j = await r.json(); remoteKey = ((j.fields || {}).geminiKey || {}).stringValue || ''; }
        }
      } catch (e) {}
    }
    if (remoteKey) return remoteKey;
    return DEFAULT_KEY.indexOf('@') === 0 ? '' : DEFAULT_KEY;
  }

  // Formdaki alanlar (app.js ile aynı adlar)
  var FIELDS = ['title', 'subtitle', 'originalTitle', 'author', 'translator', 'editor', 'publisher', 'series',
    'edition', 'printYear', 'printPlace', 'isbn', 'volume', 'pageCount', 'language', 'coverType'];
  var COVER_TYPES = ['Karton kapak', 'Ciltli (sert kapak)', 'Şömizli', 'Deri cilt', 'Spiralli'];
  var LANGS = ['Türkçe', 'Osmanlıca', 'Arapça', 'Farsça', 'İngilizce', 'Almanca', 'Fransızca'];

  var isAndroid = !!window.KitaplikAndroid;
  var photos = [];          // {blob, url}
  var autoSave = false;
  try { autoSave = localStorage.getItem('kitaplik.fotoOtoKaydet') === '1'; } catch (e) {}
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ---- Form algılama ----
  var obs = new MutationObserver(function () {
    var form = document.getElementById('bookForm');
    if (form && !form.querySelector('.photo-fill')) inject(form);
  });
  obs.observe(document.body, { childList: true, subtree: true });

  function isNew(form) { return !!form.querySelector('[name="andNew"]'); }

  function inject(form) {
    clearPhotos();
    var fs = document.createElement('fieldset');
    fs.className = 'photo-fill';
    fs.innerHTML =
      '<legend>' + T.legend + '</legend>' +
      '<p class="muted small full">' + T.hint + '</p>' +
      '<div class="full pf-thumbs" id="pfThumbs"></div>' +
      '<div class="full btns pf-btns">' +
      '<button type="button" class="btn ghost" id="pfShot">' + T.shot + '</button>' +
      '<label class="btn ghost filebtn">' + T.gallery + '<input type="file" id="pfFile" accept="image/*" ' + (isAndroid ? '' : 'multiple') + ' hidden></label>' +
      '<input type="file" id="pfCam" accept="image/*" capture="environment" hidden>' +
      '<button type="button" class="btn" id="pfGo" disabled>' + T.process + '</button>' +
      '</div>' +
      (isNew(form) ? '<label class="check full"><input type="checkbox" id="pfAuto" ' + (autoSave ? 'checked' : '') + '> ' + T.auto + '</label>' : '') +
      '<p class="full small pf-status" id="pfStatus"></p>' +
      '<button type="button" class="pf-key" id="pfKey" title="' + T.key + '">⚙ ' + T.key + '</button>';
    var head = form.querySelector('.sheet-head');
    if (head && head.nextSibling) form.insertBefore(fs, head.nextSibling); else form.prepend(fs);

    var q = function (s) { return fs.querySelector(s); };
    q('#pfShot').addEventListener('click', async function () {
      if (isAndroid || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return q('#pfCam').click();
      await desktopCamera();
    });
    ['#pfFile', '#pfCam'].forEach(function (id) {
      q(id).addEventListener('change', function (e) {
        Array.prototype.forEach.call(e.target.files || [], addPhoto);
        e.target.value = '';
      });
    });
    q('#pfThumbs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]'); if (!b) return;
      var i = Number(b.dataset.rm); URL.revokeObjectURL(photos[i].url); photos.splice(i, 1); render();
    });
    var au = q('#pfAuto');
    if (au) au.addEventListener('change', function () {
      autoSave = au.checked; try { localStorage.setItem('kitaplik.fotoOtoKaydet', autoSave ? '1' : '0'); } catch (e) {}
    });
    q('#pfKey').addEventListener('click', function () {
      var cur = ''; try { cur = localStorage.getItem('kitaplik.geminiKey') || ''; } catch (e) {}
      var v = window.prompt(T.keyAsk, cur);
      if (v === null) return;
      try { v.trim() ? localStorage.setItem('kitaplik.geminiKey', v.trim()) : localStorage.removeItem('kitaplik.geminiKey'); } catch (e) {}
    });
    q('#pfGo').addEventListener('click', function () { processAll(form); });
    render();
    afterInject(form, fs);
  }

  function addPhoto(blob) {
    if (!blob || !/^image\//.test(blob.type || 'image/')) return;
    photos.push({ blob: blob, url: URL.createObjectURL(blob) });
    render();
  }
  function clearPhotos() { photos.forEach(function (p) { URL.revokeObjectURL(p.url); }); photos = []; }

  function render() {
    var box = document.getElementById('pfThumbs'); if (!box) return;
    box.innerHTML = photos.length
      ? photos.map(function (p, i) {
        return '<div class="pf-thumb"><img src="' + p.url + '" alt=""><button type="button" data-rm="' + i + '" title="' + T.remove + '">×</button></div>';
      }).join('') + '<span class="muted small pf-count">' + T.count(photos.length) + '</span>'
      : '<span class="muted small">' + T.none + '</span>';
    var go = document.getElementById('pfGo'); if (go) go.disabled = !photos.length;
  }

  function status(t, kind) {
    var s = document.getElementById('pfStatus'); if (!s) return;
    s.innerHTML = t ? (kind === 'busy' ? '<span class="pf-spin"></span>' : '') + esc(t) : '';
    s.className = 'full small pf-status ' + (kind || '');
  }

  // Masaüstü: kamera açık kalır, art arda birden çok fotoğraf çekilir.
  async function desktopCamera() {
    var stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false }); }
    catch (e) { return toast(T.camFail); }
    var el = document.createElement('div');
    el.className = 'cam pf-cam';
    el.innerHTML = '<video autoplay playsinline muted></video><div class="pf-cam-n"></div>' +
      '<div class="btns"><button type="button" class="btn ghost" data-c="x">' + T.camDone + '</button>' +
      '<button type="button" class="btn" data-c="s">' + T.camShot + '</button></div>';
    document.body.appendChild(el);
    var v = el.querySelector('video'); v.srcObject = stream;
    var n = 0;
    await new Promise(function (res) {
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-c]'); if (!b) return;
        if (b.dataset.c === 'x') return res();
        var c = document.createElement('canvas');
        c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(function (bl) {
          if (bl) { addPhoto(new File([bl], 'foto_' + Date.now() + '.jpg', { type: 'image/jpeg' })); n++; el.querySelector('.pf-cam-n').textContent = T.count(n); }
        }, 'image/jpeg', 0.92);
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      });
    });
    stream.getTracks().forEach(function (t) { t.stop(); });
    el.remove();
  }

  function toast(t) {
    var el = document.getElementById('toast');
    if (!el) return alert(t);
    el.textContent = t; el.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('show'); }, 3500);
  }

  // ---- Görüntü hazırlama ----
  function loadImg(blob) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { res(im); setTimeout(function () { URL.revokeObjectURL(u); }, 0); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('img')); };
      im.src = u;
    });
  }
  function toJpeg(im, max, q) {
    var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s));
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q).split(',')[1];
  }

  // ---- ISBN ----
  function normIsbn(s) {
    var d = String(s || '').toUpperCase().replace(/[^0-9X]/g, '');
    if (d.length === 13 && /^97[89]/.test(d) && isbn13ok(d)) return d;
    if (d.length === 10 && isbn10ok(d)) return d;
    return '';
  }
  function isbn13ok(d) { var s = 0; for (var i = 0; i < 13; i++) s += Number(d[i]) * (i % 2 ? 3 : 1); return s % 10 === 0; }
  function isbn10ok(d) { var s = 0; for (var i = 0; i < 10; i++) s += (d[i] === 'X' ? 10 : Number(d[i])) * (10 - i); return s % 11 === 0; }

  async function findBarcode(imgs) {
    if ('BarcodeDetector' in window) {
      try {
        var det = new window.BarcodeDetector({ formats: ['ean_13'] });
        for (var i = 0; i < imgs.length; i++) {
          var codes = await det.detect(imgs[i]);
          for (var j = 0; j < codes.length; j++) { var n = normIsbn(codes[j].rawValue); if (n) return n; }
        }
      } catch (e) {}
    }
    if (window.KitaplikOCR) {
      try {
        var r = await window.KitaplikOCR.readBarcodes(imgs);
        for (var k = 0; k < r.length; k++) { var n2 = normIsbn(r[k]); if (n2) return n2; }
      } catch (e) {}
    }
    return '';
  }

  async function lookupIsbn(isbn) {
    var out = {};
    try {
      var r = await fetch('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn);
      var j = await r.json();
      var v = j.items && j.items[0] && j.items[0].volumeInfo;
      if (v) {
        out.title = v.title; out.subtitle = v.subtitle;
        out.author = (v.authors || []).join(', ');
        out.publisher = v.publisher;
        var y = /\d{4}/.exec(v.publishedDate || ''); if (y) out.printYear = y[0];
        if (v.pageCount) out.pageCount = String(v.pageCount);
        out.language = ({ tr: 'Türkçe', ar: 'Arapça', fa: 'Farsça', en: 'İngilizce', de: 'Almanca', fr: 'Fransızca', ota: 'Osmanlıca' })[v.language] || '';
      }
    } catch (e) {}
    if (!out.title) {
      try {
        var r2 = await fetch('https://openlibrary.org/api/books?format=json&jscmd=data&bibkeys=ISBN:' + isbn);
        var b = (await r2.json())['ISBN:' + isbn];
        if (b) {
          out.title = b.title; out.subtitle = b.subtitle;
          out.author = (b.authors || []).map(function (a) { return a.name; }).join(', ');
          out.publisher = (b.publishers || []).map(function (a) { return a.name; }).join(', ');
          var y2 = /\d{4}/.exec(b.publish_date || ''); if (y2) out.printYear = y2[0];
          if (b.number_of_pages) out.pageCount = String(b.number_of_pages);
          out.printPlace = (b.publish_places || []).map(function (a) { return a.name; }).join(', ');
        }
      } catch (e) {}
    }
    return out;
  }

  // ---- Yapay zekâ (Gemini) ----
  var PROMPT =
    'Bu fotoğraflar TEK bir kitaba aittir (ön kapak, arka kapak, sırt, iç kapak, künye/baskı bilgisi sayfası veya barkod olabilir). ' +
    'Fotoğraflardaki yazıları dikkatle oku ve kitabın kütüphane kaydı için bilgileri çıkar. Kurallar:\n' +
    '- Değerleri kitapta yazdığı dil ve yazıyla yaz (Arapça/Osmanlıca başlıkları Arap harfleriyle bırak, Türkçeye çevirme). Büyük harfle basılmış başlıkları normal yazım düzenine getir.\n' +
    '- Emin olmadığın veya fotoğrafta olmayan alanı boş bırak; tahmin uydurma.\n' +
    '- author: yazar(lar), birden çoksa virgülle. translator: çevirmen/mütercim. editor: editör, hazırlayan, tahkik eden, muhakkik, sadeleştiren.\n' +
    '- originalTitle: kitap çeviriyse eserin orijinal adı. publisher: yayınevi (basımevi değil; yoksa basımevi). series: dizi/seri adı ve numarası.\n' +
    '- edition: baskı bilgisi, Türkçe biçimde (ör. "3. Baskı"). printYear: basım yılı (4 haneli miladi yıl; yalnız hicri yazıyorsa miladiye çevir). printPlace: basım yeri şehir.\n' +
    '- isbn: yalnız rakamlar (ve X). volume: cilt numarası (ör. "2" veya "2/5"). pageCount: toplam sayfa sayısı (yalnız sayı).\n' +
    '- language: kitabın metin dili; şunlardan biri: ' + LANGS.join(', ') + ' (başka bir dilse Türkçe adını yaz).\n' +
    '- coverType: fotoğraflardan anlaşılıyorsa şunlardan biri: ' + COVER_TYPES.join(', ') + '; anlaşılmıyorsa boş.\n' +
    '- coverPhoto: ön kapağı en iyi gösteren fotoğrafın sıra numarası (1\'den başlar); ön kapak yoksa 0.\n' +
    '- notes: kısa ve yararlı ek bilgi (ör. eksik cilt, ithaf, tıpkıbasım); yoksa boş.';

  var SCHEMA = { type: 'OBJECT', properties: {} };
  FIELDS.concat(['notes']).forEach(function (f) { SCHEMA.properties[f] = { type: 'STRING' }; });
  SCHEMA.properties.coverPhoto = { type: 'INTEGER' };

  async function askAI(b64s) {
    var key = await apiKey();
    if (!key) { remoteKey = null; throw new Error(T.noKey); }
    var parts = [{ text: PROMPT }];
    b64s.forEach(function (d, i) { parts.push({ text: 'Fotoğraf ' + (i + 1) + ':' }); parts.push({ inline_data: { mime_type: 'image/jpeg', data: d } }); });
    var body = JSON.stringify({
      contents: [{ role: 'user', parts: parts }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA }
    });
    var lastErr = '';
    for (var i = 0; i < MODELS.length; i++) {
      try {
        var r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODELS[i] + ':generateContent', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: body
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) {
          lastErr = (j.error && j.error.message) || ('HTTP ' + r.status);
          if (r.status === 400 && /API key/i.test(lastErr)) break;
          continue; // 404 (model yok), 429 (kota), 5xx → sıradaki model
        }
        var txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(function (p) { return p.thought ? '' : (p.text || ''); }).join('');
        txt = txt.replace(/^```(?:json)?\s*|\s*```$/g, '');
        return JSON.parse(txt);
      } catch (e) { lastErr = e.message; }
    }
    throw new Error(lastErr || 'bilinmeyen hata');
  }

  // ---- Forma yazma ----
  // mode: 'over' (yeni kitap: hepsinin üzerine yaz), 'empty' (yalnız boşlar), 'merge' (boş ya da çevrimdışı değerle aynıysa)
  function setField(form, name, val, mode, prev) {
    var el = form.elements[name]; if (!el) return false;
    val = val == null ? '' : String(val).trim();
    if (name === 'printYear' || name === 'pageCount') { var m = /\d+/.exec(val); val = m ? m[0] : ''; }
    if (name === 'coverType' && COVER_TYPES.indexOf(val) < 0) val = '';
    var cur = String(el.value || '').trim();
    if (!val) { if (mode === 'over' && name !== 'language') { el.value = ''; } return false; }
    if (mode === 'empty' && cur) return false;
    if (mode === 'merge' && cur && cur !== String((prev || {})[name] || '').trim()) return false;
    if (cur === val) return false;
    el.value = val;
    el.classList.add('pf-filled');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  function setHidden(form, name, val) {
    var el = form.querySelector('input[type=hidden][name="' + name + '"]');
    if (!el) { el = document.createElement('input'); el.type = 'hidden'; el.name = name; form.appendChild(el); }
    el.value = val;
  }

  // ---- Cihazda saklanan fotoğraflar (internetsiz okunan kitaplar için) ----
  var DB = null;
  function db() {
    if (!DB) DB = new Promise(function (res, rej) {
      var r = indexedDB.open('kitaplik-foto', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('bekleyen'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return DB;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction('bekleyen', mode), st = tx.objectStore('bekleyen'), out;
        var q = fn(st); if (q) q.onsuccess = function () { out = q.result; };
        tx.oncomplete = function () { res(out); }; tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  var store = {
    put: function (ref, v) { return idb('readwrite', function (s) { return s.put(v, ref); }); },
    get: function (ref) { return idb('readonly', function (s) { return s.get(ref); }); },
    del: function (ref) { return idb('readwrite', function (s) { return s.delete(ref); }); },
    keys: function () { return idb('readonly', function (s) { return s.getAllKeys(); }); }
  };

  function books() {
    try { return JSON.parse(localStorage.getItem('kitaplik.v2') || '{}').books || {}; } catch (e) { return {}; }
  }
  async function pendingBooks() {
    var keys = [];
    try { keys = await store.keys(); } catch (e) { return []; }
    var b = books();
    return Object.keys(b).map(function (id) { return b[id]; }).filter(function (r) {
      return r && !r.deleted && r.ocrPending === '1' && r.ocrRef && keys.indexOf(r.ocrRef) >= 0;
    });
  }

  // Düzenlenen kitabı tanımak için: "Düzenle" tıklamasını app.js'den önce yakala
  var lastEdit = { id: null, at: 0 };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act="editBook"]');
    if (b) lastEdit = { id: b.dataset.id, at: Date.now() };
  }, true);

  // Form açıldığında: düzenlenen kitap internetsiz okunduysa "yeniden oku" düğmesi
  var rereadQueue = null; // toplu yeniden okuma sırasında {id, resolve}
  async function afterInject(form, fs) {
    if (isNew(form)) return;
    var id = Date.now() - lastEdit.at < 3000 ? lastEdit.id : null;
    var rec = id && books()[id];
    if (!rec || rec.ocrPending !== '1' || !rec.ocrRef) return;
    var saved = null;
    try { saved = await store.get(rec.ocrRef); } catch (e) {}
    if (!saved || !saved.photos || !saved.photos.length) return;
    var box = document.createElement('div');
    box.className = 'full pf-reread';
    box.innerHTML = '<span class="muted small">' + T.rereadInfo + '</span> <button type="button" class="btn" id="pfReread">' + T.reread + '</button>';
    fs.insertBefore(box, fs.querySelector('.pf-thumbs'));
    var run = async function () {
      clearPhotos();
      saved.photos.forEach(function (b) { addPhoto(b); });
      var ok = await processAll(form, { mode: 'merge', prev: saved.values || {}, aiOnly: true, ref: rec.ocrRef });
      if (ok) box.remove();
      return ok;
    };
    fs.querySelector('#pfReread').addEventListener('click', run);
    if (rereadQueue && rereadQueue.id === id) {
      var q = rereadQueue;
      var ok = await run();
      if (ok) {
        var btn = form.querySelector('.sheet-head button[type=submit]:not([name=andNew])');
        btn ? btn.click() : form.requestSubmit();
      }
      q.resolve(ok);
    }
  }

  // Kayıt edilince (yeniden okuma başarılıysa) saklanan fotoğrafları sil
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.id !== 'bookForm') return;
    var done = form.dataset.pfClearRef;
    if (done) store.del(done).catch(function () {}).then(refreshChip);
    else setTimeout(refreshChip, 500);
  }, true);

  // ---- Toplu yeniden okuma düğmesi ----
  var chip = null, batchBusy = false;
  async function refreshChip() {
    if (batchBusy) return;
    var list = navigator.onLine && apiKeyCached() ? await pendingBooks() : [];
    if (!list.length) { if (chip) { chip.remove(); chip = null; } return; }
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'pf-chip';
      chip.addEventListener('click', runBatch);
      document.body.appendChild(chip);
    }
    chip.textContent = T.pending(list.length);
  }
  var keyKnown = null;
  function apiKeyCached() {
    if (keyKnown === null) { keyKnown = false; apiKey().then(function (k) { keyKnown = !!k; if (k) refreshChip(); }); }
    return keyKnown;
  }
  async function runBatch() {
    if (batchBusy) return;
    batchBusy = true;
    var list = await pendingBooks(), n = 0;
    for (var i = 0; i < list.length; i++) {
      if (chip) chip.textContent = T.batchStep(i + 1, list.length);
      var ok = await new Promise(function (res) {
        rereadQueue = { id: list[i].id, resolve: res };
        var b = document.createElement('button');
        b.dataset.act = 'editBook'; b.dataset.id = list[i].id; b.hidden = true;
        document.body.appendChild(b); b.click(); b.remove();
        setTimeout(function () { res(false); }, 120000);
      });
      rereadQueue = null;
      if (ok) n++;
      await new Promise(function (r) { setTimeout(r, 700); });
    }
    batchBusy = false;
    toast(T.batchDone(n));
    refreshChip();
  }
  window.addEventListener('online', refreshChip);
  window.addEventListener('offline', refreshChip);
  setTimeout(refreshChip, 4000);

  // ---- İşleme ----
  var busy = false;
  async function processAll(form, opts) {
    opts = opts || {};
    if (busy) return false;
    if (!photos.length) { status(T.needPhoto, 'err'); return false; }
    busy = true;
    var go = document.getElementById('pfGo'); if (go) go.disabled = true;
    var result = false;
    try {
      status(T.prep, 'busy');
      var imgs = [];
      for (var i = 0; i < photos.length; i++) { try { imgs.push(await loadImg(photos[i].blob)); } catch (e) {} }

      status(T.barcode, 'busy');
      var isbn = await findBarcode(imgs);

      var ai = null, aiErr = '';
      if (navigator.onLine) {
        status(T.ai, 'busy');
        try { ai = await askAI(imgs.map(function (im) { return toJpeg(im, 1600, 0.85); })) || {}; } catch (e) { aiErr = e.message; ai = null; }
      } else aiErr = T.offline;

      var offline = false;
      if (!ai) {
        if (opts.aiOnly) { status(T.aiFail + aiErr, 'err'); return false; }
        if (!window.KitaplikOCR) { status(aiErr ? T.aiFail + aiErr : T.nothing, 'err'); return false; }
        offline = true;
        status(navigator.onLine ? T.aiDown : T.offPrep, 'busy');
        ai = await window.KitaplikOCR.ocr(imgs, function (step, k, n) {
          status(step === 'read' ? T.offRead(k, n) : (navigator.onLine ? T.aiDown : T.offPrep), 'busy');
        });
      }

      isbn = isbn || normIsbn(ai.isbn);
      var ext = {};
      var weak = !ai.title || !ai.author || !ai.publisher || !ai.printYear || !ai.pageCount;
      if (isbn && weak && navigator.onLine) { status(T.lookup, 'busy'); ext = await lookupIsbn(isbn); }

      var data = {};
      FIELDS.forEach(function (f) { data[f] = (offline ? ext[f] || ai[f] : ai[f] || ext[f]) || ''; });
      if (isbn) data.isbn = isbn;
      if (offline && ext.title) offline = false; // ISBN sorgusu kaliteli bilgi getirdi

      var fresh = isNew(form);
      var mode = opts.mode || (fresh ? 'over' : 'empty');
      var n = 0;
      FIELDS.forEach(function (f) { if (setField(form, f, data[f], mode, opts.prev)) n++; });
      if (!offline && ai.notes && form.elements.notes && !String(form.elements.notes.value).trim()) { form.elements.notes.value = String(ai.notes).trim(); form.elements.notes.classList.add('pf-filled'); n++; }

      // Kapak görseli
      var ci = Number(ai.coverPhoto) || 0;
      var coverIdx = ci >= 1 && ci <= photos.length ? ci - 1 : (ai.coverPhoto === 0 ? -1 : 0);
      var hasCover = form.querySelector('#coverPreview img');
      if (coverIdx >= 0 && (fresh || !hasCover)) {
        try {
          var dt = new DataTransfer();
          var pb = photos[coverIdx].blob;
          dt.items.add(pb instanceof File ? pb : new File([pb], 'kapak.jpg', { type: pb.type || 'image/jpeg' }));
          var inp = form.querySelector('#coverFile');
          inp.files = dt.files;
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
      }

      if (offline) {
        // İnternetsiz okundu: kitabı işaretle, fotoğrafları bu cihazda sakla
        var ref = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        setHidden(form, 'ocrPending', '1');
        setHidden(form, 'ocrRef', ref);
        var vals = {}; FIELDS.forEach(function (f) { vals[f] = form.elements[f] ? String(form.elements[f].value || '').trim() : ''; });
        try { await store.put(ref, { photos: photos.map(function (p) { return p.blob; }), values: vals, at: Date.now() }); } catch (e) {}
        delete form.dataset.pfClearRef;
      } else {
        if (opts.ref) { setHidden(form, 'ocrPending', ''); form.dataset.pfClearRef = opts.ref; }
        else { var pend = form.querySelector('input[type=hidden][name="ocrRef"]'); if (pend) { store.del(pend.value).catch(function () {}); pend.remove(); var pp = form.querySelector('input[type=hidden][name="ocrPending"]'); if (pp) pp.remove(); } }
      }

      if (!n && !(opts.mode === 'merge')) {
        status(offline ? T.nothing : (aiErr ? T.aiFail + aiErr : T.nothing), 'err');
      } else {
        result = true;
        status(offline ? T.offDone(n) : T.done(n) + (aiErr && !offline ? ' (' + T.aiFail + aiErr + ')' : ''), 'ok');
        var title = form.elements.title;
        if (fresh && autoSave && title && title.value.trim()) {
          setTimeout(function () {
            var b = form.querySelector('[name="andNew"]');
            clearPhotos();
            if (b) b.click(); else form.requestSubmit();
            setTimeout(function () { toast(T.saved); }, 400);
          }, 900);
        }
      }
    } catch (e) {
      status(T.aiFail + e.message, 'err');
    } finally {
      busy = false;
      var g = document.getElementById('pfGo'); if (g) g.disabled = !photos.length;
    }
    return result;
  }
})();
