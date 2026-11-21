// Derlenmiş güncelleme paketlerini kullanıcının Firebase'ine (Firestore) yükler.
//   node tools/yayinla.js <sürüm> [web] [masaustu] [android]
// Ayarlar: keys/firebase.json  → {"projectId":"…","apiKey":"…","code":"XXXX-XXXX-XXXX"}
// Kanal adları uygulamadaki ile aynı: web, masaustu2, android2.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const [surum, ...secim] = process.argv.slice(2);
const kanallar = { web: 'web', masaustu: 'masaustu2', android: 'android2' };
const hedef = secim.length ? secim : ['web', 'masaustu'];
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'keys', 'firebase.json'), 'utf8'));
const PART = 700 * 1024;

const val = (v) => (typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) });
async function yaz(name, obj) {
  const code = encodeURIComponent(cfg.code.replace(/\//g, '_'));
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents/kitapliklar/${code}/guncelleme/${name}?key=${encodeURIComponent(cfg.apiKey)}`;
  const fields = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, val(v)]));
  const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${await r.text()}`);
}

(async () => {
  const dir = path.join(ROOT, 'cikti', surum);
  for (const t of hedef) {
    const ch = kanallar[t];
    const b64 = fs.readFileSync(path.join(dir, t + '.pkg')).toString('base64');
    const meta = JSON.parse(fs.readFileSync(path.join(dir, t + '.json'), 'utf8'));
    const n = Math.ceil(b64.length / PART);
    for (let i = 0; i < n; i++) await yaz(`${ch}_${surum}_${i}`, { data: b64.slice(i * PART, (i + 1) * PART) });
    // Üst bilgi en son yazılır: parçalar tamamlanmadan cihazlar görmez.
    await yaz(ch, { ...meta, parts: n, bytes: b64.length + n * 200, publishedAt: new Date().toISOString() });
    console.log(`${t} (${ch}) ${surum} yayınlandı: ${n} parça`);
  }
})().catch((e) => { console.error('HATA', e.message); process.exit(1); });
