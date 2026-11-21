// Firestore'daki tüm kayıtları JSON olarak yedekler: node tools/yedekle.js <çıktı.json>
'use strict';
const fs = require('fs'); const path = require('path');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'keys', 'firebase.json'), 'utf8'));
(async () => {
  const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/kitapliklar/${encodeURIComponent(cfg.code)}/kayitlar`;
  const docs = []; let tok = '';
  do {
    const r = await fetch(`${base}?pageSize=300&key=${cfg.apiKey}${tok ? '&pageToken=' + encodeURIComponent(tok) : ''}`);
    if (!r.ok) throw new Error(r.status + ' ' + await r.text());
    const j = await r.json(); docs.push(...(j.documents || [])); tok = j.nextPageToken || '';
  } while (tok);
  const out = { app: 'kitaplik', version: 2, exportedAt: new Date().toISOString(), books: [], categories: [], locations: [], loans: [], covers: [] };
  for (const d of docs) {
    const f = d.fields || {}; const col = f.col?.stringValue; const json = f.json?.stringValue;
    if (!col || !json) continue; (out[col] = out[col] || []).push(JSON.parse(json));
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
  const say = (c) => (out[c] || []).filter((x) => !x.deleted).length;
  console.log(`toplam belge ${docs.length} | kitap ${say('books')} | ödünç ${say('loans')} | kategori ${say('categories')} | konum ${say('locations')} | kapak ${say('covers')}`);
})().catch((e) => { console.error('HATA', e.message); process.exit(1); });
