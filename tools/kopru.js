#!/usr/bin/env node
// ESKİ GÜNCELLEME KANALLARI KÖPRÜSÜ — ≤2.13 masaüstü ve ≤2.11 Android kurulumları için (Milen'in bilgisayarında çalışır).
//
// Eski güncelleyiciler ne yapar:
//   masaüstü (eski app.asar → updater.js): raw.githubusercontent.com/departures-mil/kitaplik/main/guncelleme/masaustu2.json okur;
//     "version" kurulu sürümden büyükse "file" paketini (gzip JSON {version, files:{yol: base64}}) indirir, SHA-256 ve ECDSA P-256
//     imzasını (guncelleme-ozel.pem'in açık anahtarı programa gömülü) doğrular, userData/guncelleme/<sürüm>/'e açar; eski başlatıcı
//     yeniden açılışta oradaki app-main.js'i çalıştırır (yalnız app.asar içeriği değişir, Electron ve başlatıcı aynı kalır).
//     → Köprü: yeni sürümün app.asar İÇERİĞİ (release'teki win-app dosyası) aynen paketlenir. Yeni app-main.js eski başlatıcıyı tanır
//       (global.kitaplik), program çalışır ve "Yeni kurulum gerekli" penceresi win-setup kurulumunu tek tıkla indirip çalıştırır.
//   Android (eski APK → Updater.java): guncelleme/android2.json; versionCode kuruludan büyükse APK'yı indirir, SHA-256 + ECDSA imzasını
//     doğrular, paket adını denetler ve Android kurulum ekranını açar → yeni APK DOĞRUDAN kurulur (aynı keystore ile imzalı olmalı).
//
// Kullanım (depo kökünde, GitHub Release yayınlandıktan SONRA):
//   node tools/kopru.js                      en son release'ten paketleri hazırlar, imzalar, guncelleme/'ye yazar, commit + push
//   node tools/kopru.js --anahtar <pem>      özel anahtar yolu (varsayılan keys/guncelleme-ozel.pem, sonra C:\Claude Programlarım\_Anahtarlar\Kitaplik\guncelleme-ozel.pem)
//   node tools/kopru.js --push-yok           yalnız dosyaları yaz
//   node tools/kopru.js --kaynak <klasör>    (test) latest.json + asset dosyalarını internet yerine bu klasörden al
//   node tools/kopru.js --acik-anahtar <pem> (test) gömülü eski açık anahtar yerine bununla doğrula
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REPO = 'departures-mil/kitaplik';
// Eski programlara gömülü açık anahtar (desktop/updater.js ≤2.13, Updater.java ≤2.11). Değişmez.
const OLD_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENsqFb/1qwh7LQ2QlrVJzQAAKU0dD\n2fjpVPn6qN9T8j/2lxWuoOLlaFa0wN01NGYsLoSZOcHhrjBzcHIqkBU1pA==\n-----END PUBLIC KEY-----\n';

function arg(name) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; }
const has = (name) => process.argv.includes(name);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const versionCode = (v) => require('./surum.js').versionCode(v);

function get(url, hops = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'kitaplik-kopru', Accept: 'application/octet-stream' }, timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 8) { res.resume(); return resolve(get(new URL(res.headers.location, url).toString(), hops + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' ' + url)); }
      const parts = []; res.on('data', (c) => parts.push(c)); res.on('end', () => resolve(Buffer.concat(parts))); res.on('error', reject);
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('zaman aşımı: ' + url)); });
  });
}

/** Bağımlılıksız asar okuyucu: {göreli/yol: Buffer} (app.asar.unpacked kullanılmıyor). */
function readAsar(buf) {
  const headerSize = buf.readUInt32LE(4);
  const strLen = buf.readUInt32LE(12);
  const header = JSON.parse(buf.slice(16, 16 + strLen).toString('utf8'));
  const base = 8 + headerSize, out = {};
  (function walk(node, pre) {
    for (const [name, e] of Object.entries(node.files || {})) {
      const rel = pre ? pre + '/' + name : name;
      if (e.files) walk(e, rel);
      else if (e.link) continue;
      else { if (e.unpacked) throw new Error('asar içinde unpacked dosya var: ' + rel); const off = base + Number(e.offset); out[rel] = buf.slice(off, off + e.size); }
    }
  })(header, '');
  return out;
}

function sign(buf, key, pub) {
  const sig = crypto.sign('sha256', buf, key);
  if (!crypto.verify('sha256', buf, pub, sig)) throw new Error('Bu özel anahtar eski programlardaki açık anahtarla EŞLEŞMİYOR — yanlış anahtar dosyası.');
  return sig.toString('base64');
}

async function main() {
  const src = arg('--kaynak');
  const fetchFile = async (name, url) => src ? fs.readFileSync(path.join(src, name)) : get(url);
  const man = JSON.parse((await fetchFile('latest.json', `https://github.com/${REPO}/releases/latest/download/latest.json`)).toString('utf8'));
  if (man.schema !== 1 || !/^\d+\.\d+\.\d+$/.test(man.version)) throw new Error('latest.json geçersiz');
  const v = man.version;
  const keyPath = [arg('--anahtar'), path.join(ROOT, 'keys', 'guncelleme-ozel.pem'), 'C:\\Claude Programlarım\\_Anahtarlar\\Kitaplik\\guncelleme-ozel.pem'].find((p) => p && fs.existsSync(p));
  if (!keyPath) throw new Error('Özel anahtar bulunamadı (keys/guncelleme-ozel.pem). --anahtar <yol> verin.');
  const key = fs.readFileSync(keyPath, 'utf8');
  const pub = arg('--acik-anahtar') ? fs.readFileSync(arg('--acik-anahtar'), 'utf8') : OLD_PUBLIC_KEY;
  const trNot = (man.notes && man.notes.tr) || '';
  const NOT = {
    masaustu2: 'Kitaplık ' + v + ' yeni kurulum programıyla gelir (GitHub Releases). Bu güncellemeden sonra program sizi tek tıkla yeni kuruluma götürür; kayıtlarınız korunur.\n' + trNot,
    android2: 'Kitaplık ' + v + ': sonraki güncellemeler GitHub sürümlerinden gelir, yalnızca değişen kısımlar indirilir. Kayıtlarınız korunur.\n' + trNot
  };
  const G = path.join(ROOT, 'guncelleme');
  const dl = async (ch) => {
    const a = man.assets && man.assets[ch];
    if (!a) return null;
    const b = await fetchFile(a.file, `https://github.com/${REPO}/releases/download/v${v}/${encodeURIComponent(a.file)}`);
    if (b.length !== a.size || sha(b) !== a.sha256) throw new Error(ch + ': indirilen dosya latest.json ile uyuşmuyor');
    return b;
  };
  const write = (kanal, pkg, extra) => {
    for (const f of fs.readdirSync(G)) if (f.startsWith(kanal + '-') && f.endsWith('.pkg')) fs.unlinkSync(path.join(G, f));
    const file = `${kanal}-${v}.pkg`;
    fs.writeFileSync(path.join(G, file), pkg);
    const meta = Object.assign({ version: v, sha256: sha(pkg), signature: sign(pkg, key, pub) }, extra || {}, { file, bytes: pkg.length, notes: NOT[kanal], publishedAt: new Date().toISOString() });
    fs.writeFileSync(path.join(G, kanal + '.json'), JSON.stringify(meta, null, 2));
    console.log(`✓ guncelleme/${kanal}.json → ${v} (${(pkg.length / 1048576).toFixed(1)} MB, imzalı)`);
  };
  const done = [];
  // masaüstü: release'teki app.asar içeriği → eski paket biçimi
  const asar = await dl('win-app');
  if (!asar) throw new Error('latest.json\'da win-app yok');
  const files = readAsar(asar);
  if (!files['app-main.js'] || !files['www/index.html'] || JSON.parse(files['package.json']).version !== v) throw new Error('app.asar beklenen düzende değil');
  const enc = {}; for (const [k, b] of Object.entries(files)) enc[k] = b.toString('base64');
  write('masaustu2', zlib.gzipSync(Buffer.from(JSON.stringify({ version: v, files: enc })), { level: 9 }));
  done.push('masaüstü');
  // Android: APK aynen (eski güncelleyici paket adını ve imzayı denetler, kurulum ekranını açar)
  const apk = await dl('android');
  if (apk) { write('android2', apk, { versionCode: versionCode(v) }); done.push('Android'); }
  else console.log('! latest.json\'da android yok: Android köprüsü atlandı (APK yayınlanınca bu komutu yeniden çalıştırın).');
  // "web" kanalı bilerek DEĞİŞMEZ: eski APK önce android2'yi denetler ve yeni APK'yı kurar.
  if (!has('--push-yok')) {
    const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: 'inherit' });
    git('add', '-A', 'guncelleme');
    git('commit', '-m', `Eski kanal köprüsü: ${done.join(' + ')} → ${v} (imzalı)`);
    git('push');
  }
  console.log('Tamam: ' + done.join(' + '));
}
module.exports = { readAsar, sign, OLD_PUBLIC_KEY };
if (require.main === module) main().catch((e) => { console.error('HATA: ' + e.message); process.exit(1); });
