#!/usr/bin/env node
// Arayüz ekran görüntüleri (başsız Chromium, sahte kabuk, örnek kitaplık): node tools/ekran.js <çıktı-klasörü>
// PLAYWRIGHT_CORE=/yol/playwright-core ve PLAYWRIGHT_BROWSERS_PATH ortamdan alınır. Ağ istekleri engellenir.
'use strict';
const path = require('path');
const fs = require('fs');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const OUT = path.resolve(process.argv[2] || 'ekran');
const URL0 = 'file://' + path.join(__dirname, '..', 'web', 'index.html');
fs.mkdirSync(OUT, { recursive: true });

function sample() {
  const now = Date.now(), day = 864e5, iso = (d) => new Date(now + d * day).toISOString().slice(0, 10);
  const cat = (id, name) => ({ id, name, updatedAt: 1, deleted: false });
  const loc = (id, name, description) => ({ id, name, description: description || '', updatedAt: 1, deleted: false });
  const categories = Object.fromEntries([['cat-siyer', 'Siyer'], ['cat-tefsir', 'Tefsir'], ['cat-roman', 'Roman'], ['cat-tarih', 'Tarih'], ['cat-siir', 'Şiir']].map(([i, n]) => [i, cat(i, n)]));
  const locations = Object.fromEntries([['loc-salon', 'Salon kitaplığı', 'Büyük, camlı'], ['loc-calisma', 'Çalışma odası', '']].map(([i, n, d]) => [i, loc(i, n, d)]));
  const B = [
    ['Er-Rahîku\'l-Mahtûm', 'Safiyyurrahman Mübarekfûrî', 'cat-siyer', 'read', 1], ['Tefhimu\'l-Kur\'an', 'Mevdudi', 'cat-tefsir', 'reading', 0],
    ['Kuyucaklı Yusuf', 'Sabahattin Ali', 'cat-roman', 'read', 1], ['Osmanlı Tarihi', 'İsmail Hakkı Uzunçarşılı', 'cat-tarih', 'unread', 0],
    ['Safahat', 'Mehmet Âkif Ersoy', 'cat-siir', 'read', 1], ['Huzur', 'Ahmet Hamdi Tanpınar', 'cat-roman', 'unread', 0],
    ['Siyer-i Nebi', 'Mustafa Asım Köksal', 'cat-siyer', 'reference', 0], ['Çile', 'Necip Fazıl Kısakürek', 'cat-siir', 'read', 0]
  ];
  const books = {};
  B.forEach(([title, author, categoryId, readStatus, favorite], i) => {
    const id = 'b' + i;
    books[id] = { id, title, author, categoryId, locationId: i % 2 ? 'loc-calisma' : 'loc-salon', readStatus, favorite: !!favorite, copies: 1, pageCount: 200 + i * 37, publisher: 'Yayınevi', printYear: String(1990 + i * 3), createdAt: now - i * day, updatedAt: now - i * day, deleted: false };
  });
  books.bx = { id: 'bx', title: 'Arşivlenmiş örnek kitap', author: 'Yazar', categoryId: 'cat-tarih', archived: true, archivedAt: now - day, copies: 1, createdAt: now - 9 * day, updatedAt: now - day, deleted: false };
  const loans = {
    l1: { id: 'l1', bookId: 'b1', borrower: 'Ahmet Yılmaz', lentAt: iso(-20), dueAt: iso(-3), updatedAt: now, deleted: false },
    l2: { id: 'l2', bookId: 'b3', borrower: 'Ayşe Demir', lentAt: iso(-5), dueAt: iso(9), updatedAt: now, deleted: false }
  };
  return { books, categories, locations, loans, settings: { loanDays: 30 } };
}
const shots = [
  { name: 'tr-falcon-dark', lang: 'tr', theme: 'dark', scheme: 'falcon' },
  { name: 'ar-falcon-light', lang: 'ar', theme: 'light', scheme: 'falcon' },
  { name: 'tr-klasik', lang: 'tr', theme: 'light', scheme: 'klasik' },
  { name: 'tr-klasik-dark', lang: 'tr', theme: 'dark', scheme: 'klasik' },
  { name: 'tr-falcon-dark-kitaplar', lang: 'tr', theme: 'dark', scheme: 'falcon', tab: 'books' },
  { name: 'tr-falcon-dark-ayarlar', lang: 'tr', theme: 'dark', scheme: 'falcon', tab: 'settings', tall: true },
  { name: 'ar-falcon-light-ayarlar', lang: 'ar', theme: 'light', scheme: 'falcon', tab: 'settings', tall: true },
  { name: 'en-falcon-dark-telefon', lang: 'en', theme: 'dark', scheme: 'falcon', android: true, w: 412, h: 900 },
  { name: 'tr-eski-kabuk-kopru', lang: 'tr', theme: 'dark', scheme: 'falcon', legacy: true }
];
(async () => {
  const browser = await pw.chromium.launch();
  const errors = [];
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: s.w || 1600, height: s.tall ? 2600 : s.h || 960 }, deviceScaleFactor: 1 });
    await ctx.route(/^https?:/, (r) => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(s.name + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load/.test(m.text())) errors.push(s.name + ' console: ' + m.text()); });
    await page.addInitScript(({ s, data }) => {
      const set = (k, v) => localStorage.setItem('fc.' + k, JSON.stringify(v));
      set('lang', s.lang); set('theme', s.theme); set('scheme', s.scheme); set('onboarding.done', true); set('whatsnew.seen', '2.15.0');
      localStorage.setItem('kitaplik.dil', s.lang);
      localStorage.setItem('kitaplik.v2', JSON.stringify(data));
      const st = { fullscreen: true, half: false };
      const desk = { shell: 'fc', legacy: !!s.legacy, version: '2.14.0', setReminders() {}, notifyNow() {}, saveFile: async () => null, getDisplayMode: () => null, setDisplayMode() {}, postJson: async () => ({ status: 0, text: '' }), openUrl() {},
        onLanReq() {}, lanInfo: () => '{}', lanIps: () => '[]', lanReply() {}, lanServe: async () => '{}', lanStop: async () => '{}', lanResetKey: async () => '{}', lanHttp: async () => '{}', lanFind: async () => '{}' };
      if (s.android) {
        window.AndroidBridge = { appVersion: () => '2.14.0', moveTaskToBack() {}, openExternal() {}, toggleFullscreen() {}, updateBegin: () => true, updateChunk: () => true, updateFinish: () => '{"ok":true}', apkUpdate() {}, notify() {} };
        window.KitaplikAndroid = { setReminders() {}, notifyNow() {}, requestNotificationPermission() {}, saveFile: () => '', openUrl() {}, getDisplayMode: () => 'fullscreen', setDisplayMode() {}, postJson() {}, lanHttp() {}, lanFind() {}, lanIps: () => '[]' };
        return;
      }
      window.fcHost = { kind: 'electron', platform: 'win32', version: '2.14.0', window: { minimize: async () => {}, half: async () => {}, toggleFullscreen: async () => {}, close: async () => {}, getState: async () => st, onState: () => () => {} },
        update: { channel: 'win-app', applyPatch: async () => 'restarting', installFull: async () => 'restarting' }, net: { download: async () => { throw new Error('offline'); } }, onMainError: () => () => {}, openExternal: async () => {} };
      window.kitaplikDesktop = desk;
    }, { s, data: sample() });
    await page.goto(URL0);
    await page.waitForTimeout(1800);
    if (s.tab) { await page.evaluate((t) => document.querySelector('#nav [data-tab="' + t + '"]').click(), s.tab); await page.waitForTimeout(800); }
    await page.screenshot({ path: path.join(OUT, s.name + '.png') });
    await ctx.close();
    console.log('✓', s.name);
  }
  await browser.close();
  if (errors.length) { console.error('HATALAR:\n' + errors.join('\n')); process.exitCode = 1; }
})();
