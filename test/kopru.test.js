// Eski kanal köprüsü (tools/kopru.js): release dosyalarından eski güncelleyicinin kabul edeceği imzalı paketler üretilir.
// Gerçek anahtar yerine test anahtarı; eski güncelleyicinin doğrulaması (desktop updater.js ≤2.13) burada aynen yapılır.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

test('kopru.js: masaüstü + Android paketleri eski biçimde, imzalı, sürüm 2.13.0 ve versionCode 10\'dan yeni', async () => {
  const asar = require('@electron/asar');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kopru-'));
  const r = require('../tools/hazirla.js').build(path.join(tmp, 'derleme'));
  const v = require('../package.json').version;
  const src = path.join(tmp, 'rel'); fs.mkdirSync(src);
  await asar.createPackage(r.app, path.join(src, 'Kitaplik-' + v + '-win-app.asar'));
  fs.writeFileSync(path.join(src, 'Kitaplik-' + v + '-android.apk'), Buffer.from('PK-sahte-apk'));
  const asset = (f) => { const b = fs.readFileSync(path.join(src, f)); return { file: f, size: b.length, sha256: sha(b) }; };
  fs.writeFileSync(path.join(src, 'latest.json'), JSON.stringify({ schema: 1, app: 'kitaplik', version: v, notes: { tr: 'not' }, assets: { 'win-app': asset('Kitaplik-' + v + '-win-app.asar'), android: asset('Kitaplik-' + v + '-android.apk') } }));
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  fs.writeFileSync(path.join(tmp, 'k.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));
  fs.writeFileSync(path.join(tmp, 'p.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
  // depo kopyasında çalıştır (guncelleme/ değişmesin)
  const repo = path.join(tmp, 'repo'); fs.mkdirSync(path.join(repo, 'guncelleme'), { recursive: true }); fs.mkdirSync(path.join(repo, 'tools'));
  for (const f of ['kopru.js', 'surum.js']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(repo, 'tools', f));
  fs.writeFileSync(path.join(repo, 'guncelleme', 'masaustu2-2.13.0.pkg'), 'eski');
  execFileSync(process.execPath, [path.join(repo, 'tools/kopru.js'), '--kaynak', src, '--anahtar', path.join(tmp, 'k.pem'), '--acik-anahtar', path.join(tmp, 'p.pem'), '--push-yok'], { stdio: 'pipe' });
  const G = path.join(repo, 'guncelleme');
  assert.ok(!fs.existsSync(path.join(G, 'masaustu2-2.13.0.pkg')), 'eski paket silindi');
  // eski masaüstü güncelleyicisinin yaptığı doğrulama
  const m = JSON.parse(fs.readFileSync(path.join(G, 'masaustu2.json'), 'utf8'));
  const buf = fs.readFileSync(path.join(G, m.file));
  assert.strictEqual(m.version, v); assert.strictEqual(m.bytes, buf.length); assert.strictEqual(sha(buf), m.sha256);
  assert.ok(crypto.verify('sha256', buf, publicKey, Buffer.from(m.signature, 'base64')));
  const p = JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
  assert.strictEqual(p.version, v); assert.ok(p.files['app-main.js'] && p.files['www/index.html'] && p.files['cekirdek/electron/fc-electron-main.js']);
  assert.match(Buffer.from(p.files['app-main.js'], 'base64').toString(), /LEGACY = !!\(global\.kitaplik/);
  // eski Android güncelleyicisinin yaptığı doğrulama (Updater.java: versionCode > kurulu, SHA, SHA256withECDSA)
  const a = JSON.parse(fs.readFileSync(path.join(G, 'android2.json'), 'utf8'));
  const apk = fs.readFileSync(path.join(G, a.file));
  assert.ok(a.versionCode > 10); assert.strictEqual(sha(apk), a.sha256);
  assert.ok(crypto.verify('sha256', apk, publicKey, Buffer.from(a.signature, 'base64')));
  // yanlış anahtar reddedilir (gömülü eski açık anahtarla eşleşmez)
  assert.throws(() => execFileSync(process.execPath, [path.join(repo, 'tools/kopru.js'), '--kaynak', src, '--anahtar', path.join(tmp, 'k.pem'), '--push-yok'], { stdio: 'pipe' }));
  fs.rmSync(tmp, { recursive: true, force: true });
});
