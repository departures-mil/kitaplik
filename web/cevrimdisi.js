// Kitaplık — çevrimdışı okuma: barkod (zxing-wasm) + metin (Tesseract, Türkçe+Arapça) + alan çıkarma.
// İnternet yokken fotokayit.js tarafından kullanılır. Ağır dosyalar (ocr-*.js, barkod.js) yalnız
// gerektiğinde <script> ile yüklenir; her şey uygulamanın içinde gelir, internet gerekmez.
(function () {
  'use strict';

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = function () { res(); }; s.onerror = function () { rej(new Error(src + ' yüklenemedi')); };
      document.head.appendChild(s);
    });
  }
  function b64ToU8(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  async function gunzip(u8) {
    var ds = new DecompressionStream('gzip');
    var buf = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }

  // ---------- Barkod ----------
  var zxReady = null;
  function zxing() {
    if (!zxReady) zxReady = (async function () {
      if (!window.ZXingWASM) await loadScript('barkod.js');
      var bin = b64ToU8(window.__zxingWasm);
      window.__zxingWasm = null;
      await window.ZXingWASM.prepareZXingModule({ overrides: { wasmBinary: bin.buffer }, fireImmediately: true });
      return window.ZXingWASM;
    })().catch(function (e) { zxReady = null; throw e; });
    return zxReady;
  }
  function imageData(im, max) {
    var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    var x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
    return x.getImageData(0, 0, c.width, c.height);
  }
  async function readBarcodes(imgs) {
    var out = [];
    var Z = await zxing();
    for (var i = 0; i < imgs.length; i++) {
      try {
        var r = await Z.readBarcodes(imageData(imgs[i], 2000), { formats: ['EAN13'], tryHarder: true, maxNumberOfSymbols: 2 });
        r.forEach(function (b) { if (b.isValid !== false && b.text) out.push(b.text); });
      } catch (e) {}
    }
    return out;
  }

  // ---------- Tesseract motoru ----------
  // Aynı kod hem Web Worker'da hem (worker açılamazsa) ana iş parçacığında çalışır.
  function ENGINE(G) {
    var api = null, mod = null;
    G.__ocrInit = async function (coreSrc, langs) {
      (0, eval)(coreSrc);
      mod = await G.TesseractCore();
      var names = Object.keys(langs);
      names.forEach(function (n) { mod.FS.writeFile(n + '.traineddata', langs[n]); });
      api = new mod.TessBaseAPI();
      var st = api.Init(null, names.join('+'), 1);
      if (st !== 0) throw new Error('Tesseract başlatılamadı');
      api.SetVariable('tessedit_pageseg_mode', '3');
      api.SetVariable('preserve_interword_spaces', '1');
      return true;
    };
    G.__ocrRun = function (bytes) {
      mod.FS.writeFile('/input', bytes);
      if (api.SetImageFile(1, 0) === 1) throw new Error('Görsel okunamadı');
      api.Recognize(null);
      return api.GetTSVText();
    };
  }
  var ENGINE_SRC = '(' + ENGINE.toString() + ')(self);' +
    'self.onmessage=async function(e){var d=e.data;try{' +
    'if(d.t==="init"){await self.__ocrInit(d.core,d.langs);postMessage({id:d.id,ok:true});}' +
    'else{postMessage({id:d.id,ok:true,r:self.__ocrRun(d.bytes)});}' +
    '}catch(x){postMessage({id:d.id,ok:false,e:String(x&&x.message||x)});}};';

  var eng = null;
  function engine() {
    if (!eng) eng = (async function () {
      var need = [];
      if (!window.__ocrCoreSrc) need.push('ocr-cekirdek.js');
      if (!window.__ocrLang || !window.__ocrLang.tur) need.push('ocr-dil-tur.js');
      if (!window.__ocrLang || !window.__ocrLang.ara) need.push('ocr-dil-ara.js');
      for (var i = 0; i < need.length; i++) await loadScript(need[i]);
      var langs = { tur: await gunzip(b64ToU8(window.__ocrLang.tur)), ara: await gunzip(b64ToU8(window.__ocrLang.ara)) };
      var core = window.__ocrCoreSrc;
      // 1) Worker (arayüz donmaz)
      try {
        var w = new Worker(URL.createObjectURL(new Blob([ENGINE_SRC], { type: 'text/javascript' })));
        var seq = 0, waits = {};
        w.onmessage = function (e) { var p = waits[e.data.id]; delete waits[e.data.id]; if (p) e.data.ok ? p.res(e.data.r) : p.rej(new Error(e.data.e)); };
        var call = function (msg, tr, ms) {
          return new Promise(function (res, rej) {
            var id = ++seq; msg.id = id; waits[id] = { res: res, rej: rej };
            w.postMessage(msg, tr || []);
            if (ms) setTimeout(function () { if (waits[id]) { delete waits[id]; rej(new Error('zaman aşımı')); } }, ms);
          });
        };
        await call({ t: 'init', core: core, langs: langs }, [], 90000);
        return { run: function (bytes) { return call({ t: 'run', bytes: bytes }, [bytes.buffer]); } };
      } catch (e) { /* worker açılamadı → ana iş parçacığı */ }
      ENGINE(window);
      await window.__ocrInit(core, langs);
      return { run: function (bytes) { return new Promise(function (res, rej) { setTimeout(function () { try { res(window.__ocrRun(bytes)); } catch (x) { rej(x); } }, 30); }); } };
    })().catch(function (e) { eng = null; throw e; });
    return eng;
  }

  function jpegBytes(im, max) {
    var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    return b64ToU8(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
  }

  // TSV → satırlar [{text, h, conf, top}]
  function lines(tsv, imgH) {
    var map = {}, order = [];
    String(tsv || '').split('\n').forEach(function (row) {
      var c = row.split('\t'); if (c.length < 12 || c[0] !== '5') return;
      var conf = Number(c[10]), txt = c[11];
      if (!txt || !txt.trim() || conf < 30) return;
      var k = c[2] + '.' + c[3] + '.' + c[4];
      if (!map[k]) { map[k] = { words: [], hs: [], top: Number(c[7]), conf: [] }; order.push(k); }
      map[k].words.push(txt); map[k].hs.push(Number(c[9])); map[k].conf.push(conf);
    });
    return order.map(function (k) {
      var m = map[k], hs = m.hs.slice().sort(function (a, b) { return a - b; });
      return {
        text: m.words.join(' ').replace(/\s+/g, ' ').trim(),
        h: (hs[Math.floor(hs.length / 2)] || 0) / (imgH || 1000) * 1000,
        top: m.top, conf: m.conf.reduce(function (a, b) { return a + b; }, 0) / m.conf.length
      };
    }).filter(function (l) { return l.text.replace(/[^\p{L}\p{N}]/gu, '').length >= 2; });
  }

  // ---------- Alan çıkarma ----------
  var AR = /[؀-ۿ]/g;
  function titleCase(s) {
    if (AR.test(s)) { AR.lastIndex = 0; return s; }
    AR.lastIndex = 0;
    var letters = s.replace(/[^\p{L}]/gu, '');
    if (!letters || letters !== letters.toLocaleUpperCase('tr')) return s;
    var small = { ve: 1, ile: 1, veya: 1, de: 1, da: 1, ki: 1, of: 1, the: 1, and: 1 };
    return s.toLocaleLowerCase('tr').split(' ').map(function (w, i) {
      if (i && small[w]) return w;
      return w.charAt(0).toLocaleUpperCase('tr') + w.slice(1);
    }).join(' ');
  }
  function clean(s) { return String(s || '').replace(/^[\s:;,.\-–—|]+|[\s:;,.\-–—|]+$/g, '').replace(/\s{2,}/g, ' ').trim(); }

  function isbn13ok(d) { var s = 0; for (var i = 0; i < 13; i++) s += Number(d[i]) * (i % 2 ? 3 : 1); return s % 10 === 0; }
  function isbn10ok(d) { var s = 0; for (var i = 0; i < 10; i++) s += (d[i] === 'X' ? 10 : Number(d[i])) * (10 - i); return s % 11 === 0; }
  function findIsbn(text) {
    var t = text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
    var re = /(97[89][\d\s\-–]{10,17})|(\b\d[\d\s\-–]{8,12}[\dXx]\b)/g, m;
    while ((m = re.exec(t))) {
      var d = m[0].toUpperCase().replace(/[^0-9X]/g, '');
      if (d.length >= 13 && /^97[89]/.test(d) && isbn13ok(d.slice(0, 13))) return d.slice(0, 13);
      if (d.length === 10 && isbn10ok(d)) return d;
    }
    return '';
  }

  var KEY = {
    translator: /(?:Çeviren(?:ler)?|Çeviri|Türkçesi|Tercüme(?: eden)?|Mütercim|Translated by|Translator|ترجمة|ترجمه|نقله إلى العربية)\s*[:\-–]?\s*(.+)/i,
    editor: /(?:Yayına Hazırlayan(?:lar)?|Hazırlayan(?:lar)?|Editör(?:ler)?|Editor|Edited by|Redaksiyon|Tahkik(?: eden)?|Muhakkik|Sadeleştiren|تحقيق|حققه|إعداد|اعتنى به)\s*[:\-–]?\s*(.+)/i,
    author: /(?:Yazar(?:lar)?ı?|Author|Müellif|Written by|تأليف|المؤلف|بقلم)\s*[:\-–]?\s*(.+)/i,
    title: /(?:Kitab(?:ın|ın Adı)|Kitap Adı|Eserin Adı|Eser Adı|Title|عنوان الكتاب|اسم الكتاب)\s*[:\-–]\s*(.+)/i,
    originalTitle: /(?:Orijinal Ad[ıi]|Özgün Ad[ıi]|Asl[ıi]n[ıi]n Ad[ıi]|Original Title)\s*[:\-–]?\s*(.+)/i,
    series: /(?:Dizi|Seri|Series|سلسلة)\s*[:\-–]\s*(.+)/i,
    printPlace: /(?:Basım Yeri|Baskı Yeri|Place of Publication|مكان الطبع)\s*[:\-–]\s*(.+)/i
  };
  var PUB = /(Yayın(?:ları|evi|cılık|lar[ıi])|Yayınevi|Kitapları|Kitabevi|Neşriyat|Publish(?:ing|ers)|Press|Books|Yay\.|دار\s+\S+|مكتبة\s+\S+|منشورات|للنشر)/i;
  var CITY = /(İstanbul|Istanbul|Ankara|İzmir|Izmir|Konya|Bursa|Kayseri|Erzurum|Diyarbakır|Gaziantep|Trabzon|Beyrut|Kahire|Şam|Halep|Bağdat|Medine|Mekke|Riyad|Amman|Tahran|Kum|Bakü|London|Londra|دمشق|بيروت|القاهرة|حلب|بغداد|الرياض|المدينة المنورة|مكة|عمان|طهران)/i;

  function extract(perImage) {
    var d = {}, all = [];
    perImage.forEach(function (p) { all = all.concat(p.lines); });
    var text = all.map(function (l) { return l.text; }).join('\n');

    // Anahtar sözcüklü künye satırları
    all.forEach(function (l) {
      Object.keys(KEY).forEach(function (k) {
        if (d[k]) return;
        var m = KEY[k].exec(l.text);
        if (m && clean(m[1]).length >= 2) d[k] = clean(m[1]);
      });
    });

    d.isbn = findIsbn(text);

    var ed = /(\d{1,2})\s*\.?\s*(?:Baskı|Basım|Edition|ed\.)/i.exec(text) || /(?:Baskı|Basım)\s*[:\-–]?\s*(\d{1,2})\b/i.exec(text);
    if (ed) d.edition = Number(ed[1]) + '. Baskı';
    var ar = /الطبعة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة)/.exec(text);
    if (!ed && ar) d.edition = (['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'].indexOf(ar[1]) + 1) + '. Baskı';

    var nowY = new Date().getFullYear(), years = [];
    all.forEach(function (l) {
      var re = /\b(1[5-9]\d\d|20\d\d)\b/g, m;
      while ((m = re.exec(l.text))) {
        var y = Number(m[1]); if (y > nowY) continue;
        var w = /(Baskı|Basım|Tarih|©|Copyright|Yayın|Printed|Edition|الطبعة|طبع)/i.test(l.text) ? 2 : 1;
        years.push({ y: y, w: w });
      }
    });
    if (years.length) { years.sort(function (a, b) { return b.w - a.w || b.y - a.y; }); d.printYear = String(years[0].y); }

    var pg = /(\d{2,4})\s*(?:s\.|sayfa|sayfadır|sahife|syf\.?|pages|pp\.?|صفحة|ص\b)/i.exec(text) || /(?:Sayfa(?: Sayısı)?|Pages)\s*[:\-–]?\s*(\d{2,4})/i.exec(text);
    if (pg) d.pageCount = pg[1];

    var vol = /(\d{1,2})\s*\.?\s*Cilt\b/i.exec(text) || /Cilt\s*[:\-–]?\s*(\d{1,2}(?:\s*\/\s*\d{1,2})?)/i.exec(text);
    if (vol) d.volume = vol[1].replace(/\s/g, '');

    if (!d.publisher) {
      var pl = all.filter(function (l) { return PUB.test(l.text) && l.text.length <= 60; }).sort(function (a, b) { return b.h - a.h; })[0];
      if (pl) d.publisher = titleCase(clean(pl.text.replace(/^(Yayınevi|Publisher|الناشر)\s*[:\-–]\s*/i, '')));
    }
    if (!d.printPlace) {
      var cl = all.filter(function (l) { return /(Basım|Baskı|Matbaa|Printed|طبع)/i.test(l.text) && CITY.test(l.text); })[0];
      var cm = cl && CITY.exec(cl.text); if (cm) d.printPlace = cm[1];
    }

    // Kapak: en iri yazılı fotoğraf. Başlık = en iri satır(lar), yazar = isme benzeyen ikinci belirgin satır.
    var cover = -1, best = 0;
    perImage.forEach(function (p, i) {
      var mx = Math.max.apply(null, p.lines.map(function (l) { return l.h; }).concat([0]));
      var score = mx / Math.sqrt(1 + p.lines.length);
      if (score > best) { best = score; cover = i; }
    });
    d.coverPhoto = cover >= 0 ? cover + 1 : 0;
    if (cover >= 0) {
      var cls = perImage[cover].lines.filter(function (l) {
        return l.conf >= 50 && !PUB.test(l.text) && !/\d{4}|ISBN|www\.|http/i.test(l.text);
      });
      var sorted = cls.slice().sort(function (a, b) { return b.h - a.h; });
      if (!d.title && sorted.length) {
        var top = sorted[0];
        var group = cls.filter(function (l) { return l.h >= top.h * 0.8; }).sort(function (a, b) { return a.top - b.top; });
        d.title = titleCase(clean(group.map(function (l) { return l.text; }).join(' ')));
        var rest = sorted.filter(function (l) { return group.indexOf(l) < 0; });
        var sub = rest.filter(function (l) { return l.h >= top.h * 0.45 && l.text.split(' ').length >= 3; })[0];
        if (sub && !d.subtitle) d.subtitle = titleCase(clean(sub.text));
        if (!d.author) {
          var nm = rest.filter(function (l) {
            var w = l.text.split(' ');
            return l !== sub && w.length >= 2 && w.length <= 5 && !/[\d!?]/.test(l.text);
          })[0];
          if (nm) d.author = titleCase(clean(nm.text));
        }
      }
    }
    if (d.title) d.title = titleCase(d.title);
    if (d.author) d.author = titleCase(d.author);

    var arN = (text.match(AR) || []).length, ltN = (text.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) || []).length;
    d.language = arN > ltN ? 'Arapça' : (/[ğışĞİŞ]/.test(text) || /\b(ve|bir|ile|için)\b/i.test(text) ? 'Türkçe' : '');
    return d;
  }

  // Yerel zekâ (masaüstü, paket kuruluysa): PaddleOCR PP-OCRv5 + Tesseract — eğik kapak fotoğrafları ve Arapça için çok daha doğru
  async function ocrYerel(imgs, onStep) {
    var per = [];
    for (var i = 0; i < imgs.length; i++) {
      onStep && onStep('read', i + 1, imgs.length);
      var im = imgs[i], s = Math.min(1, 4000 / Math.max(im.naturalWidth, im.naturalHeight)), H = Math.round(im.naturalHeight * s) || 1000;
      var r = await FCYZ.ocr(im, { langs: ['tr', 'en', 'ar'] });
      per.push({ lines: (r.items || []).map(function (it) {
        var ys = it.box.map(function (p) { return p[1]; }), top = Math.min.apply(null, ys), bot = Math.max.apply(null, ys);
        return { text: it.text.replace(/\s+/g, ' ').trim(), h: (bot - top) * 0.75 / H * 1000, top: top, conf: it.score * 100 };
      }).filter(function (l) { return l.text.replace(/[^\p{L}\p{N}]/gu, '').length >= 2; }).sort(function (a, b) { return a.top - b.top; }) });
    }
    return extract(per);
  }
  async function ocr(imgs, onStep) {
    if (window.FCYZ && await FCYZ.ready('ocr')) { try { onStep && onStep('load'); return await ocrYerel(imgs, onStep); } catch (e) { console.warn('yerel OCR', e); } }
    onStep && onStep('load');
    var E = await engine();
    var per = [];
    for (var i = 0; i < imgs.length; i++) {
      onStep && onStep('read', i + 1, imgs.length);
      var bytes = jpegBytes(imgs[i], 2000);
      var h = Math.round(imgs[i].naturalHeight * Math.min(1, 2000 / Math.max(imgs[i].naturalWidth, imgs[i].naturalHeight)));
      var tsv = await E.run(bytes);
      per.push({ lines: lines(tsv, h) });
    }
    return extract(per);
  }

  window.KitaplikOCR = { readBarcodes: readBarcodes, ocr: ocr, findIsbn: findIsbn, _extract: extract };
})();
