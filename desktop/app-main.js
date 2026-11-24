// Kitaplık masaüstü kabuğu (Electron). Arayüz www/ klasöründeki web uygulamasıdır.
// Ortak çekirdek (cekirdek/electron/fc-electron-main.js): çerçevesiz pencere, her açılışta tam ekran, sağ üst pencere
// düğmeleri (Küçült · Orta · Tam ekran · Kapat), GitHub Releases güncellemesi (app.asar yaması, olmazsa tam dosya,
// eski kurulumda win-setup), ana süreç hata raporu. Burada yalnız uygulamaya özgü işler kalır: sistem tepsisi
// (Kapat → tepsiye; ödünç hatırlatmaları sürer), hatırlatmalar, Wi‑Fi eşitleme sunucusu, dosya kaydetme, iletişim POST'u.
//
// ESKİ KABUK KÖPRÜSÜ: ≤2.13 kurulumlarının başlatıcısı (eski app.asar → main.js) imzalı "masaustu2" paketini
// userData/guncelleme/<sürüm>/ altına açıp bu dosyayı oradan çalıştırır ve global.kitaplik = {bundled, running, newer}
// tanımlar. O durumda LEGACY=true: program aynen çalışır, arayüz "yeni kurulum gerekli" penceresiyle kurulum dosyasını
// (win-setup) tek tıkla indirip çalıştırır. Kullanıcı verisi (userData = %APPDATA%\Kitaplık) değişmez.

const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, dialog, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const fc = require('./cekirdek/electron/fc-electron-main');

const VERSION = require('./package.json').version;
const LEGACY = !!(global.kitaplik && typeof global.kitaplik === 'object' && 'bundled' in global.kitaplik);
const SMOKE = !!process.env.KITAPLIK_SMOKE;
const APP_ID = 'com.kitaplik.app';
app.setAppUserModelId(APP_ID);

const gotLock = SMOKE || app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let win = null;
let tray = null;
let quitting = false;
let shown = false;
let timers = [];
const stateFile = () => path.join(app.getPath('userData'), 'reminders.json');
const iconPath = path.join(__dirname, 'icon.png');

function readState() {
  for (const f of [stateFile(), stateFile() + '.bak']) {
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* sıradaki */ }
  }
  return { list: [], lastRun: Date.now() };
}
/** Atomik yazma: .tmp → yeniden adlandırma; önceki dosya .bak olarak kalır. */
function writeJsonAtomic(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj));
    if (fs.existsSync(file)) { try { fs.copyFileSync(file, file + '.bak'); } catch { /* önemli değil */ } }
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}
const writeState = (s) => writeJsonAtomic(stateFile(), s);

function notify(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: iconPath });
  n.on('click', showWindow);
  n.show();
}

function schedule(list) {
  for (const t of timers) clearTimeout(t);
  timers = [];
  const now = Date.now();
  for (const r of list) {
    const ms = r.at - now;
    if (ms <= 0 || ms > 2 ** 31 - 1) continue;
    timers.push(setTimeout(() => {
      notify(r.title, r.body);
      const s = readState();
      s.lastRun = Date.now();
      writeState(s);
    }, ms));
  }
}

function createWindow(show = true) {
  win = new BrowserWindow(fc.windowOptions({
    minWidth: 380,
    minHeight: 500,
    title: 'Kitaplık',
    icon: iconPath,
    backgroundColor: '#070b14',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: false },
  }));
  shown = show;
  fc.install(win, { channel: 'win-app', setupChannel: 'win-setup', show });
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); if (/^https:\/\//i.test(url)) shell.openExternal(url); }
  });
  // Kapat (sağ üst ya da Alt+F4): program sistem tepsisinde çalışmaya devam eder (ödünç hatırlatmaları, Wi‑Fi eşitleme)
  win.on('close', (e) => {
    if (quitting || SMOKE) return;
    e.preventDefault();
    win.hide();
    const s = readState();
    if (!s.trayHintShown) {
      notify('Kitaplık arka planda çalışıyor', 'Hatırlatmalar için sistem tepsisinde açık kalır. Kapatmak için tepsi simgesine sağ tıklayıp Çık deyin.');
      s.trayHintShown = true;
      writeState(s);
    }
  });
  if (SMOKE) smoke();
}

function showWindow() {
  if (!win) createWindow(true);
  if (!shown) { shown = true; win.setFullScreen(true); }   // tepside başladıysa ilk gösterimde tam ekran
  win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
}

// Electron açılış testi (test/electron.test.js): pencere yüklendi mi, ortak çekirdek başladı mı?
function smoke() {
  const out = (o) => { process.stdout.write('KITAPLIK_SMOKE ' + JSON.stringify(o) + '\n'); };
  const consoleErrors = [];
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) consoleErrors.push(String(message).slice(0, 300)); });
  const fail = setTimeout(() => { out({ ok: false, error: 'timeout' }); app.exit(2); }, 60000);
  win.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const r = await win.webContents.executeJavaScript(`({
          fc: !!(window.FC && FC.updater && FC.topbar && FC.settings), host: window.FC && FC.host.kind, fcHost: !!window.fcHost,
          desk: !!window.kitaplikDesktop, legacy: !!(window.Kabuk && Kabuk.legacy),
          version: window.APP_RELEASE && APP_RELEASE.version, scheme: document.documentElement.dataset.scheme,
          topbar: !!document.querySelector('#topbar .topbar-actions'), winBtns: document.querySelectorAll('#topbar .win-controls button').length,
          nav: document.querySelectorAll('#nav .navbtn').length, title: document.title,
          errors: (window.__kitaplikErrors || []).slice(0, 5)
        })`);
        r.fullscreen = win.isFullScreen();
        r.appVersion = VERSION;
        r.errors = r.errors.concat(consoleErrors.filter((m) => !/net::|Failed to load resource|ERR_|firestore|Firebase/i.test(m)));
        clearTimeout(fail);
        out(Object.assign({ ok: r.fc && r.host === 'electron' && r.topbar && r.nav > 0 && !r.errors.length }, r));
        app.exit(0);
      } catch (e) {
        out({ ok: false, error: String((e && e.message) || e) });
        app.exit(3);
      }
    }, 3000);
  });
}

app.on('second-instance', () => showWindow());

app.whenReady().then(() => {
  if (!gotLock) return;
  const hidden = process.argv.includes('--hidden') && !SMOKE;
  createWindow(!hidden);
  if (SMOKE) return;

  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  tray.setToolTip('Kitaplık');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Kitaplık\'ı aç', click: showWindow },
    { type: 'separator' },
    { label: 'Çık', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);

  // Windows açılışında arka planda başlasın (hatırlatmalar kaçmasın). Kayıt adı AppUserModelId: eski kurulumun kaydının yerine geçer.
  if (app.isPackaged && process.platform === 'win32') {
    try { app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] }); } catch { /* yoksay */ }
  }

  // Uygulama kapalıyken zamanı geçmiş hatırlatmaları göster
  const s = readState();
  const now = Date.now();
  const missed = (s.list || []).filter((r) => r.at > (s.lastRun || 0) && r.at <= now);
  for (const r of missed.slice(0, 5)) notify(r.title, r.body);
  s.lastRun = now;
  writeState(s);
  schedule(s.list || []);
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (SMOKE) app.quit(); /* yoksa tepside çalışmaya devam */ });

ipcMain.on('kitaplik:info', (e) => {
  e.returnValue = { version: VERSION, legacy: LEGACY, platform: process.platform, packaged: app.isPackaged };
});
ipcMain.on('set-reminders', (_e, list) => {
  const s = readState();
  s.list = Array.isArray(list) ? list : [];
  s.lastRun = Date.now();
  writeState(s);
  schedule(s.list);
});
ipcMain.on('notify-now', (_e, title, body) => notify(title, body));
ipcMain.on('open-url', (_e, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
});
// İletişim/duyuru POST'ları ana süreçten (file:// kaynağı CORS'a takılmasın; FormSubmit Referer ister)
ipcMain.handle('post-json', (_e, url, json) => new Promise((resolve) => {
  if (!/^https:\/\//.test(url)) return resolve({ status: 0, text: '' });
  const https = require('https');
  const req = https.request(url, {
    method: 'POST',
    timeout: 20000,
    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json', 'Content-Length': Buffer.byteLength(json) },
      /formsubmit\.co\//.test(url) ? { Referer: 'https://formsubmit.co/', Origin: 'https://formsubmit.co', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Kitaplik' } : {}),
  }, (res) => {
    let text = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { text += c; });
    res.on('end', () => resolve({ status: res.statusCode, text }));
  });
  req.on('timeout', () => req.destroy());
  req.on('error', () => resolve({ status: 0, text: '' }));
  req.end(json);
}));
ipcMain.handle('save-file', async (_e, name, text) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name) });
  if (r.canceled || !r.filePath) return null;
  const tmp = r.filePath + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, r.filePath);
  return 'Kaydedildi: ' + r.filePath;
});

// ---- Wi‑Fi ile internetsiz eşitleme (aynı ağdaki telefonla) ----
const lan = require('./lan-server.js');
const lanFile = () => path.join(app.getPath('userData'), 'wifi-esitleme.json');
const lanPrefs = () => { try { return JSON.parse(fs.readFileSync(lanFile(), 'utf8')); } catch { return {}; } };
const lanSave = (p) => writeJsonAtomic(lanFile(), p);
app.whenReady().then(() => { if (!SMOKE) lan.setup({ appId: 'kitaplik', prefsGet: lanPrefs, prefsSet: lanSave, photoFile: null, getWindow: () => win }); });
ipcMain.on('lan-sync', (e, name, ...args) => {
  try { e.returnValue = lan.syncCalls[name](...args); } catch { e.returnValue = ''; }
});
ipcMain.handle('lan-async', (_e, name, ...args) => lan.asyncCalls[name](...args));
