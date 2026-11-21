// Güncelleme paketlerini hazırlar ve özel anahtarla imzalar.
// node paketle.js <sürüm> <versionCode> <wwwKlasörü> <masaüstüKlasörü> <apk> <çıktıKlasörü>
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const [surum, kod, www, desk, apk, out] = process.argv.slice(2);
const key = fs.readFileSync(path.join(__dirname, '..', 'keys', 'guncelleme-ozel.pem'), 'utf8');

function files(dir, base = dir, acc = {}) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) files(p, base, acc);
    else acc[path.relative(base, p).split(path.sep).join('/')] = fs.readFileSync(p).toString('base64');
  }
  return acc;
}

function save(name, buf, extra) {
  const sig = crypto.sign('sha256', buf, key).toString('base64');
  const pub = crypto.createPublicKey(key);
  if (!crypto.verify('sha256', buf, pub, Buffer.from(sig, 'base64'))) throw new Error('imza hatası');
  fs.writeFileSync(path.join(out, name + '.pkg'), buf);
  const meta = { version: surum, sha256: crypto.createHash('sha256').update(buf).digest('hex'), signature: sig, ...extra };
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(meta, null, 2));
}

const gz = (o) => zlib.gzipSync(Buffer.from(JSON.stringify(o)), { level: 9 });
save('web', gz({ version: surum, files: files(www) }));
save('masaustu', gz({ version: surum, files: files(desk) }));
if (apk && fs.existsSync(apk)) save('android', fs.readFileSync(apk), { versionCode: Number(kod) });
console.log('paketler hazır');
