// Node duman testi (bağımlılıksız): sürüm, gömülü çekirdek, eşitleme kuralı, paketleme, dosya bütünlüğü, çeviriler.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const pkg = JSON.parse(R('package.json'));

test('tek semver sürüm: package.json = desktop/package.json = web/surum.js; versionCode artıyor', () => {
  const surum = require('../tools/surum.js');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.strictEqual(R('web/surum.js'), surum.render(), 'web/surum.js eski: node tools/surum.js');
  assert.strictEqual(R('desktop/package.json'), surum.desktopPkg(), 'desktop/package.json sürümü eski: node tools/surum.js');
  const ctx = { window: {} }; vm.runInNewContext(R('web/surum.js'), ctx);
  assert.strictEqual(ctx.window.APP_RELEASE.version, pkg.version);
  assert.strictEqual(ctx.window.KITAPLIK_SURUM, pkg.version);
  for (const l of ['tr', 'en', 'ar']) assert.ok(ctx.window.APP_RELEASE.notes[l].length > 40, 'not: ' + l);
  assert.ok(surum.versionCode(pkg.version) > 10, 'eski APK versionCode 10 (2.11.0) — yeni APK daha büyük olmalı');
  assert.strictEqual(surum.versionCode('2.14.0'), 21400);
  // eski güncelleyici karşılaştırması (desktop/main.js ≤2.13, Updater.java): yeni sürüm 2.13.0'dan "daha yeni" görünmeli
  const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
  assert.ok(newer(pkg.version, '2.14.1'), 'eski kanallarda yayınlanan son sürüm 2.14.1');
});

test('gömülü ortak çekirdek: sürüm kaydı, modüller, yerel düzeltmeler', () => {
  for (const f of ['cekirdek/VERSION', 'web/cekirdek/VERSION']) assert.match(R(f), /^ortak-cekirdek [0-9a-f]{40}\n/);
  assert.strictEqual(R('cekirdek/VERSION'), R('web/cekirdek/VERSION'));
  delete globalThis.FC;
  require('../web/cekirdek/fc-core.js');
  const FC = globalThis.FC;
  for (const m of ['updater', 'topbar', 'settings', 'contact', 'crash', 'look', 'onboarding', 'whatsnew', 'announcements', 'progress', 'host', 'usage', 'lanMerge', 'agent']) assert.ok(FC[m], 'FC.' + m);
  const H = (b) => crypto.createHash('sha256').update(b).digest('hex');
  const man = { schema: 1, app: 'kitaplik', version: '2.15.0', minVersion: '1.0.0', assets: {
    'win-app': { file: 'Kitaplik-2.15.0-win-app.asar', size: 100, sha256: H('a'), patches: { '2.14.0': { file: 'Kitaplik-win-app.patch-from-2.14.0.bin', size: 10, sha256: H('b') } } },
    'win-setup': { file: 'Kitaplik-2.15.0-win-setup.exe', size: 200, sha256: H('c') },
    android: { file: 'Kitaplik-2.15.0-android.apk', size: 300, sha256: H('d'), patches: { '2.14.0': { file: 'Kitaplik-android.patch-from-2.14.0.bin', size: 30, sha256: H('e') } } } } };
  const o = { repo: 'kitaplik', app: 'kitaplik', version: '2.14.0', channel: 'win-app', setupChannel: 'win-setup' };
  const p = FC.updater.plan(man, o);
  assert.strictEqual(p.mode, 'patch');
  assert.strictEqual(p.url, 'https://github.com/departures-mil/kitaplik/releases/download/v2.15.0/Kitaplik-win-app.patch-from-2.14.0.bin');
  assert.strictEqual(FC.updater.plan(Object.assign({}, man, { minVersion: '2.15.0' }), o).channel, 'win-setup');
  assert.strictEqual(FC.updater.plan(man, Object.assign({}, o, { channel: 'android' })).mode, 'patch');
  // 2.15.5: Android minVersion altındayken bile win-setup (.exe) değil, kendi APK'sını tam indirir
  const pa = FC.updater.plan(Object.assign({}, man, { minVersion: '2.15.0' }), Object.assign({}, o, { channel: 'android' }));
  assert.strictEqual(pa.channel, 'android'); assert.strictEqual(pa.mode, 'full'); assert.match(pa.full.file, /\.apk$/);
  assert.throws(() => FC.updater.plan(Object.assign({}, man, { assets: Object.assign({}, man.assets, { android: man.assets['win-setup'] }) }), Object.assign({}, o, { channel: 'android' })), /NOT_APK/);
  assert.match(R('web/kabuk.js'), /setupChannel: FC\.host\.kind === 'android' \? undefined : 'win-setup'/, 'kabuk: Android kurulum kanalı kullanmaz');
  const api = R('android/src/com/departuresmil/ortak/ApkPatchInstaller.java');
  assert.match(api, /public void verifyApk\(File apk\)/); assert.match(api, /NOT_APK/); assert.match(api, /WRONG_PACKAGE/);
  assert.match(R('android/src/com/kitaplik/uygulama/FcBridge.java'), /installer\(\)\.verifyApk\(out\)/);
  // yayın: eski Android sürümleri (2.15.1+) minVersion altında kalmamalı
  const mv = (R('.github/workflows/release.yml').match(/min_version:\s*([\d.]+)/) || [])[1];
  assert.ok(mv && FC.updater.cmp(mv, '2.15.1') <= 0, 'min_version ' + mv + ' > 2.15.1 → eski telefonlar güncellenemez');
  // yerel düzeltmeler (cekirdek/VERSION'da yazılı)
  assert.match(R('web/cekirdek/fc-core.js'), /typeof h\.update\.run === 'function'/, 'updater: kabuk-yerel güncelleme kancası');
  const em = R('cekirdek/electron/fc-electron-main.js');
  assert.match(em, /function runSetup/); assert.match(em, /isSetup\(meta\)/); assert.ok(!/tasklist \/FI/.test(em), 'güncelleme penceresiz'); assert.match(em, /typeof net\.fetch === 'function'/); assert.match(em, /o\.show === false/);
  assert.ok(!/androidx/.test(R('android/src/com/departuresmil/ortak/ApkPatchInstaller.java').replace(/\/\/.*$/gm, '')), 'androidx gerekmez');
});

test('FC.host.update.run (Android ApkPatchInstaller köprüsü): ilerleme, yama hatası → tam, sonuç', async () => {
  const FC = globalThis.FC;
  FC.updater._reset();
  const H = (b) => crypto.createHash('sha256').update(b).digest('hex');
  const man = { schema: 1, app: 'kitaplik', version: '2.15.0', assets: { android: { file: 'a.apk', size: 1000, sha256: H('x'), patches: { '2.14.0': { file: 'p.bin', size: 100, sha256: H('y') } } } } };
  const states = [];
  const host = FC.host, saved = { can: host.can, update: host.update, net: host.net };
  host.can = { update: true }; host.net = null;
  host.update = { channel: 'android', run: async (plan, ev) => {
    assert.strictEqual(plan.mode, 'patch'); assert.strictEqual(plan.full.file, 'a.apk');
    ev({ patch: true, done: 50, total: 100 }); ev({ patchFailed: true, error: 'SRC' }); ev({ patch: false, done: 1000, total: 1000, finished: true }); ev({ installing: true });
    return 'done';
  } };
  FC.updater.start({ repo: 'kitaplik', app: 'kitaplik', version: '2.14.0', autoCheck: false, fetch: async () => ({ ok: true, status: 200, json: async () => man }) });
  FC.updater.subscribe((s) => states.push(s.status + ':' + (s.mode || '') + ':' + (s.fallback ? 'F' : '')));
  assert.strictEqual(await FC.updater.run(), 'done');
  assert.ok(states.includes('downloading:patch:'), states.join(','));
  assert.ok(states.some((x) => x.startsWith('downloading:full:F')), states.join(','));
  assert.ok(states.includes('installing:full:F'));
  assert.strictEqual(FC.updater.state().status, 'done');
  Object.assign(host, saved); FC.updater._reset();
});

test('eşitleme kuralı (app.js uB): uzak silme yerelde arşivlenir, ezilen yerel hal yedeklenir, listeler arşivi göstermez', () => {
  const src = R('web/app.js');
  const pick = (name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };
  const yedek = [];
  const ctx = { Hi: ['books', 'loans', 'categories', 'locations'], qe: { books: {}, loans: {}, categories: {}, locations: {} }, Ui() {}, oB() {}, window: { __kitaplikYedek: (c, e, n) => yedek.push([c, e, n]) }, Date };
  vm.createContext(ctx);
  vm.runInContext(pick('uB') + ';' + pick('Ue') + ';this.uB=uB;this.Ue=Ue;', ctx);
  ctx.qe.books.b1 = { id: 'b1', title: 'Huzur', updatedAt: 10, deleted: false };
  assert.strictEqual(ctx.uB('books', { id: 'b1', title: 'Huzur', updatedAt: 20, deleted: true }), true);
  const b = ctx.qe.books.b1;
  assert.strictEqual(b.deleted, false, 'uzak silme yerelde SİLMEZ');
  assert.strictEqual(b.archived, true); assert.strictEqual(b.archivedAt, 20); assert.strictEqual(b.title, 'Huzur');
  assert.strictEqual(ctx.Ue('books').length, 0, 'arşivlenen listede görünmez (Ayarlar → Arşiv)');
  assert.strictEqual(ctx.uB('books', { id: 'b1', title: 'Huzur', updatedAt: 20, deleted: true }), false, 'aynı silme tekrar uygulanmaz');
  ctx.qe.books.b2 = { id: 'b2', title: 'Eski', updatedAt: 5 };
  ctx.uB('books', { id: 'b2', title: 'Yeni', updatedAt: 6 });
  assert.strictEqual(ctx.qe.books.b2.title, 'Yeni');
  assert.strictEqual(yedek.length, 1); assert.strictEqual(yedek[0][1].title, 'Eski', 'ezilen yerel hal yedeğe');
  ctx.uB('books', { id: 'b3', title: 'Yeni kayıt', updatedAt: 1 });
  assert.strictEqual(ctx.Ue('books').length, 2);
  // Wi‑Fi: aynı kural lan-kitaplik.js'te
  assert.match(R('web/lan-kitaplik.js'), /cur && !cur\.deleted && rec && rec\.deleted[\s\S]{0,200}archived: true/);
});

test('app.js kancaları ve eski kartlar', () => {
  const a = R('web/app.js');
  assert.match(a, /Kabuk\.ayarlar\(r\)/); assert.match(a, /Kabuk\.cizildi\(Le\.tab\)/);
  assert.ok(!a.includes('${M_()}') && !a.includes('${Zb()}'), 'eski güncelleme / iletişim kartı ayarlarda yok');
  assert.ok(!/kitaplik\.geminiKey['"]?\s*[:=]\s*['"]AIza/.test(a + R('web/fotokayit.js')), 'pakete gömülü AI anahtarı yok');
});

test('tüm arayüz, ana süreç ve araç dosyaları sözdizimi olarak geçerli', () => {
  const files = ['desktop/main.js', 'desktop/app-main.js', 'desktop/preload.js', 'desktop/lan-server.js', 'cekirdek/electron/fc-electron-main.js', 'cekirdek/electron/fc-preload.js', 'cekirdek/electron/fcd1.js',
    'tools/surum.js', 'tools/hazirla.js', 'tools/kopru.js', 'tools/ekran.js']
    .concat(fs.readdirSync(path.join(ROOT, 'web')).filter((f) => f.endsWith('.js')).map((f) => 'web/' + f));
  for (const f of files) assert.doesNotThrow(() => new vm.Script(R(f).replace(/^#!.*\n/, ''), { filename: f }), f);
  for (const gone of ['web/guncelleme.js', 'web/ustcubuk.js', 'web/kullanim.js', 'web/duyuru.js', 'desktop/updater.js', 'android/src/com/kitaplik/uygulama/Updater.java'])
    assert.ok(!fs.existsSync(path.join(ROOT, gone)), 'eski modül kaldırılmalı: ' + gone);
  assert.match(R('desktop/app-main.js'), /fc\.install\(win, \{ channel: 'win-app', setupChannel: 'win-setup', show \}\)/);
  assert.ok(!/raw\.githubusercontent\.com\/departures-mil\/kitaplik/.test(R('desktop/app-main.js') + R('android/src/com/kitaplik/uygulama/MainActivity.java')), 'yeni kabuk eski raw kanalı okumaz');
});

test('index.html: başvurulan her dosya var, sıra doğru', () => {
  const html = R('web/index.html');
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 8);
  for (const r of refs) assert.ok(fs.existsSync(path.join(ROOT, 'web', r)), 'eksik: ' + r);
  const pos = (s) => html.indexOf(s);
  assert.ok(pos('cekirdek/css/tokens.css') < pos('cekirdek/css/core.css') && pos('cekirdek/css/core.css') < pos('style.css'));
  assert.ok(pos('cekirdek/fc-core.js') < pos('surum.js') && pos('surum.js') < pos('kabuk.js') && pos('kabuk.js') < pos('app.js') && pos('app.js') < pos('dil.js') && pos('lan.js') < pos('lan-kitaplik.js'));
  for (const m of R('web/cekirdek/css/tokens.css').matchAll(/url\(([^)]+)\)/g)) assert.ok(fs.existsSync(path.join(ROOT, 'web/cekirdek/css', m[1].replace(/["']/g, ''))), m[1]);
});

test('çeviriler: kabuk metinlerinin tr / en / ar karşılığı var', () => {
  const src = R('web/kabuk.js');
  const block = (l, next) => src.slice(src.indexOf('\n    ' + l + ': {'), src.indexOf('\n    ' + next + ': {') > 0 ? src.indexOf('\n    ' + next + ': {') : src.indexOf('\n  });'));
  const keys = (b) => [...b.matchAll(/'(kb\.[\w.]+)'\s*:/g)].map((m) => m[1]).sort();
  const tr = keys(block('tr', 'en')), en = keys(block('en', 'ar')), ar = keys(block('ar', 'zz'));
  assert.ok(tr.length > 30);
  assert.deepStrictEqual(en, tr); assert.deepStrictEqual(ar, tr);
  for (const k of new Set([...src.matchAll(/T\('(kb\.[\w.]+)'/g)].map((m) => m[1]).filter((k) => !k.endsWith('.')))) assert.ok(tr.includes(k), 'tanımsız: ' + k);
});

test('paketleme: NSIS kullanıcı başına, kısayollar, 3 dil, kendi simgesi; veri klasörü (productName) değişmez', () => {
  const b = pkg.build;
  assert.strictEqual(b.productName, 'Kitaplık', 'productName değişirse %APPDATA% veri klasörü değişir!');
  assert.strictEqual(JSON.parse(R('desktop/package.json')).productName, 'Kitaplık');
  assert.strictEqual(JSON.parse(R('desktop/package.json')).name, 'kitaplik');
  assert.strictEqual(b.appId, 'com.kitaplik.app');
  assert.strictEqual(b.directories.app, '.derleme/app');
  assert.strictEqual(b.win.target[0].target, 'nsis');
  assert.strictEqual(b.win.icon, 'desktop/icon.ico'); assert.ok(fs.existsSync(path.join(ROOT, 'desktop/icon.ico')));
  assert.strictEqual(b.win.signAndEditExecutable, true, 'exe kendi simgesini alsın');
  assert.strictEqual(b.nsis.oneClick, true); assert.strictEqual(b.nsis.perMachine, false);
  assert.strictEqual(b.nsis.createDesktopShortcut, true); assert.strictEqual(b.nsis.createStartMenuShortcut, true);
  assert.deepStrictEqual(b.nsis.installerLanguages, ['tr_TR', 'en_US', 'ar_SA']);
  assert.strictEqual(b.nsis.deleteAppDataOnUninstall, false);
  assert.ok(!b.asarUnpack);
  assert.match(R('android/AndroidManifest.xml'), /package="com\.kitaplik\.uygulama"/, 'Android paket adı değişmez');
  assert.match(R('android/src/com/kitaplik/uygulama/MainActivity.java'), /HOST = "kitaplik\.local"/, 'WebView kaynağı (localStorage) değişmez');
  const wf = R('.github/workflows/release.yml');
  assert.match(wf, /win-app=app\.asar/); assert.match(wf, /win-setup=\*Setup\*\.exe/); assert.match(wf, /android=\*\.apk/);
  assert.match(wf, /reusable-release\.yml@main/); assert.match(wf, /needs: \[test, build-win, build-android\]/);
  for (const s of ['ANDROID_KEYSTORE_B64', 'ANDROID_KEYSTORE_PASS', 'ANDROID_KEY_ALIAS']) assert.match(wf, new RegExp('secrets\\.' + s));
  const ign = R('.gitignore');
  for (const x of ['keys/', '*.keystore', '*.pem']) assert.ok(ign.includes(x), '.gitignore: ' + x);
});

test('derleme klasörü eski başlatıcının beklediği düzende', () => {
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kitaplik-hazirla-'));
  const r = require('../tools/hazirla.js').build(tmp);
  for (const f of ['app-main.js', 'main.js', 'preload.js', 'package.json', 'icon.png', 'lan-server.js', 'www/index.html', 'www/kabuk.js', 'www/cekirdek/fc-core.js', 'cekirdek/electron/fc-electron-main.js'])
    assert.ok(fs.existsSync(path.join(r.app, f)), f);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(r.app, 'package.json'))).version, pkg.version);
  assert.ok(fs.existsSync(path.join(r.www, 'index.html')));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('2.15.2: Arapçada ödünç satırı çevrilir, firebaseConfig alanı soldan sağa', () => {
  const vm = require('vm');
  const ctx = { localStorage: { getItem: () => 'ar' }, document: { documentElement: {}, body: null, title: 'x' }, window: {},
    NodeFilter: {}, MutationObserver: class { observe() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'web', 'dil.js'), 'utf8'), ctx);
  const t = ctx.window.KitaplikDil.t;
  assert.strictEqual(t('Verildi: 24.11.2026 • Teslim: 01.12.2026'), 'أُعير: 24.11.2026 • موعد الإرجاع: 01.12.2026');
  assert.strictEqual(t('Veriliş: 24.11.2026 • Teslim: 01.12.2026'), 'أُعير: 24.11.2026 • موعد الإرجاع: 01.12.2026');
  assert.strictEqual(t('Verildi: 24.11.2026 • İade: 01.12.2026'), 'أُعير: 24.11.2026 • أُعيد: 01.12.2026');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'web', 'style.css'), 'utf8'), /#fbcfg[^{]*\{[^}]*direction: ltr/);
});
