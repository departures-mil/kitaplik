/* Yerel zekâ — telefon / tarayıcı iş parçacığı (Web Worker). Arayüz donmaz.
   OCR: PaddleOCR PP-OCRv5 (mobil algılama + Latin/Arapça tanıma), onnxruntime-web (wasm).
   Çeviri: NLLB-200 (8 bit), transformers.js (wasm). Model baytları ana iş parçacığından Blob olarak gelir (IndexedDB).
   Mesaj: { id, op: 'ocr' | 'translate', args, files: { ad: Blob } } → { id, ok, result | error } */
'use strict';
var BASE = self.location.href.replace(/[^/]*$/, '');
importScripts(BASE + 'vendor/ort.wasm.min.js', BASE + 'fc-ocr.js', BASE + 'fc-mt.js');

var ocrP = null, mtP = null, mt = null, mtFiles = null, tessErr = null, tessOk = false;

function ab(blob) { return blob.arrayBuffer(); }

function getOcr(files) {
  if (!ocrP) ocrP = (async function () {
    var ort = self.ort;
    ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = { mjs: BASE + 'vendor/ort-wasm-simd-threaded.mjs' };
    ort.env.wasm.wasmBinary = new Uint8Array(await ab(files['ort.wasm']));
    var txt = async function (k) { return new TextDecoder().decode(await ab(files[k])); };
    var tess = await tesseract(files).catch(function (e) { tessErr = String(e && e.message || e); return null; }); tessOk = !!tess;
    return self.FCOCR.create({
      latinEngine: tess,
      ort: ort, det: new Uint8Array(await ab(files['det-mobile.onnx'])),
      rec: { latin: { model: new Uint8Array(await ab(files['rec-latin.onnx'])), dict: await txt('dict-latin.txt') },
        arabic: { model: new Uint8Array(await ab(files['rec-arabic.onnx'])), dict: await txt('dict-arabic.txt') } },
    });
  })();
  ocrP.catch(function () { ocrP = null; });
  return ocrP;
}

// Latin satırlarda Türkçe harfler (ı İ ş ğ) için Tesseract (tur+eng) ikinci okuyucu — fc-ocr.js iki okumayı uzlaştırır
async function gunzip(blob) {
  var u = new Uint8Array(await blob.arrayBuffer());
  if (!(u[0] === 0x1f && u[1] === 0x8b)) return u;
  return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
function bmp(c) {
  var w = c.width, h = c.height, row = Math.ceil(w * 3 / 4) * 4, size = 54 + row * h, b = new Uint8Array(size), v = new DataView(b.buffer);
  b[0] = 66; b[1] = 77; v.setUint32(2, size, true); v.setUint32(10, 54, true); v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, h, true);
  v.setUint16(26, 1, true); v.setUint16(28, 24, true); v.setUint32(34, row * h, true);
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var s = ((h - 1 - y) * w + x) * 4, d = 54 + y * row + x * 3; b[d] = c.data[s + 2]; b[d + 1] = c.data[s + 1]; b[d + 2] = c.data[s]; }
  return b;
}
async function tesseract(files) {
  if (!files['tur.traineddata.gz'] || !files['eng.traineddata.gz']) return null;
  importScripts(BASE + 'vendor/tesseract-core-simd-lstm.wasm.js');
  var m = await self.TesseractCore({ print: function () {}, printErr: function () {} });
  m.FS.writeFile('/tur.traineddata', await gunzip(files['tur.traineddata.gz']));
  m.FS.writeFile('/eng.traineddata', await gunzip(files['eng.traineddata.gz']));
  var api = new m.TessBaseAPI();
  if (api.Init('/', 'tur+eng', 1) !== 0) throw new Error('tesseract');
  api.SetVariable('tessedit_pageseg_mode', '7');
  return async function (c) {
    var W = c.width + 24, H = c.height + 24, p = new Uint8ClampedArray(W * H * 4).fill(255);
    for (var y = 0; y < c.height; y++) p.set(c.data.subarray(y * c.width * 4, (y + 1) * c.width * 4), ((y + 12) * W + 12) * 4);
    m.FS.writeFile('/input', bmp({ data: p, width: W, height: H }));
    if (api.SetImageFile(1, 0) === 1) return null;
    api.Recognize(null);
    var text = api.GetUTF8Text(), conf = api.MeanTextConf();
    try { api.Clear(); } catch (e) {}
    return { text: String(text || '').trim(), score: (conf || 0) / 100 };
  };
}

function getMt(files) {
  if (files) mtFiles = files;
  if (!mtP) mtP = (async function () {
    // transformers.js paketle birlikte iner (jsDelivr npm, sürüm + SHA-256 sabit) ve Blob adresinden yüklenir
    var T = await import(URL.createObjectURL(new Blob([mtFiles['transformers.min.js']], { type: 'text/javascript' })));
    var wasm = new Uint8Array(await ab(mtFiles['ort.wasm']));
    var id = 'nllb-200-distilled-600M';
    mt = self.FCMT.create({
      transformers: T, modelId: id, dtype: 'q8', devices: ['wasm'], ollama: false,
      configureEnv: function (env) {
        env.allowLocalModels = false; env.allowRemoteModels = true; env.useBrowserCache = false; env.useFSCache = false;
        env.remoteHost = 'https://yerel-zeka.invalid/'; env.remotePathTemplate = '{model}/';
        if (env.useWasmCache !== undefined) env.useWasmCache = false;
        var o = env.backends.onnx;
        o.wasm.numThreads = 1; o.wasm.proxy = false;
        o.wasm.wasmPaths = { mjs: BASE + 'vendor/ort-wasm-simd-threaded.asyncify.mjs', wasm: BASE + 'vendor/ort-wasm-simd-threaded.asyncify.wasm' };
        o.wasm.wasmBinary = wasm;
        // model dosyaları ağdan değil, IndexedDB'den gelen Blob'lardan
        env.fetch = async function (url) {
          var u = String(url), i = u.indexOf(id + '/'), k = i >= 0 ? u.slice(i) : u;
          var b = mtFiles[k];
          if (!b) return new Response('', { status: 404 });
          return new Response(b, { status: 200, headers: { 'content-length': String(b.size), 'content-type': 'application/octet-stream' } });
        };
      },
    });
    await mt.warm();
    return mt;
  })();
  mtP.catch(function () { mtP = null; mt = null; });
  return mtP;
}

var ops = {
  ocr: async function (a, files) {
    var ocr = await getOcr(files);
    var img = { data: new Uint8ClampedArray(a.data.buffer, a.data.byteOffset, a.data.byteLength), width: a.width, height: a.height };
    var r = await ocr.recognize(img, { langs: a.langs || ['tr', 'en', 'ar'] });
    return { text: r.text, lines: r.lines.map(function (l) { return { text: l.text, rtl: l.rtl }; }),
      tesseract: tessOk || tessErr, items: r.items.map(function (i) { return { text: i.text, score: +i.score.toFixed(3), script: i.script, box: i.box.map(function (p) { return [Math.round(p[0]), Math.round(p[1])]; }) }; }), ms: r.ms };
  },
  translate: async function (a, files) {
    var m = await getMt(files);
    return m.translate(a.text, a.from, a.to, { memory: a.memory, ollama: false, llm: false, domain: a.domain });
  },
};

self.onmessage = async function (e) {
  var m = e.data;
  try { self.postMessage({ id: m.id, ok: true, result: await ops[m.op](m.args || {}, m.files || {}) }); }
  catch (err) { self.postMessage({ id: m.id, ok: false, error: String(err && err.message || err) }); }
};
