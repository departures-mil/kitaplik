// Kitaplık masaüstü kabuğu (Electron). Arayüz www/ klasöründeki web uygulamasıdır.
// Pencere kapatılınca uygulama sistem tepsisinde çalışmaya devam eder,
// böylece ödünç hatırlatmaları zamanında gelir.

const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, dialog, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const createUpdater = require('./updater.js');
try { require('./fc-agent-main.js').install(); } catch (e) { console.error('fc-agent', e); }

const APP_ID = 'com.kitaplik.app';
app.setAppUserModelId(APP_ID);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let tray = null;
let quitting = false;
let timers = [];
const stateFile = () => path.join(app.getPath('userData'), 'reminders.json');
const iconPath = path.join(__dirname, 'icon.png');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return { list: [], lastRun: Date.now() };
  }
}
function writeState(s) {
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(s));
  } catch {
    /* yoksay */
  }
}

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
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 380,
    minHeight: 500,
    show,
    title: 'Kitaplık',
    icon: iconPath,
    backgroundColor: '#fbf6f3',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.removeMenu();
  applyDisplayMode(readState().displayMode);
  // F11: tam ekranı aç/kapat, Esc: tam ekrandan çık
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.key === 'Escape' && win.isFullScreen() && readState().displayMode === 'window') {
      win.setFullScreen(false);
    }
  });
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
  for (const ev of ['enter-full-screen', 'leave-full-screen', 'maximize', 'unmaximize', 'restore']) {
    win.on(ev, () => win && !win.isDestroyed() && win.webContents.send('win-state', winState()));
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
    const s = readState();
    if (!s.trayHintShown) {
      notify('Kitaplık arka planda çalışıyor', 'Hatırlatmalar için sistem tepsisinde açık kalır. Kapatmak için tepsi simgesine sağ tıklayıp Çık deyin.');
      s.trayHintShown = true;
      writeState(s);
    }
  });
}

/** Görünüm: 'fullscreen' (varsayılan), 'maximized' ya da 'window'. */
function displayMode(m) {
  return ['fullscreen', 'maximized', 'window'].includes(m) ? m : 'fullscreen';
}
function applyDisplayMode(m) {
  if (!win) return;
  m = displayMode(m);
  if (m === 'fullscreen') {
    win.setFullScreen(true);
  } else {
    if (win.isFullScreen()) win.setFullScreen(false);
    if (m === 'maximized') win.maximize();
    else if (win.isMaximized()) win.unmaximize();
  }
}

const updater = createUpdater({
  readState,
  writeState,
  notify,
  send: (st) => win && !win.isDestroyed() && win.webContents.send('update-status', st),
});

function showWindow() {
  if (!win) createWindow();
  win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
}

app.on('second-instance', showWindow);

app.whenReady().then(() => {
  const hidden = process.argv.includes('--hidden');
  createWindow(!hidden);

  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  tray.setToolTip('Kitaplık');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Kitaplık\'ı aç', click: showWindow },
    { type: 'separator' },
    { label: 'Çık', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);

  // Windows açılışında arka planda başlasın (hatırlatmalar kaçmasın)
  if (app.isPackaged && process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  }

  // Uygulama kapalıyken zamanı geçmiş hatırlatmaları göster
  const s = readState();
  const now = Date.now();
  const missed = (s.list || []).filter((r) => r.at > (s.lastRun || 0) && r.at <= now);
  for (const r of missed.slice(0, 5)) notify(r.title, r.body);
  s.lastRun = now;
  writeState(s);
  schedule(s.list || []);
  updater.start();
});

app.on('before-quit', () => {
  quitting = true;
});
app.on('window-all-closed', () => {
  /* tepside çalışmaya devam */
});

ipcMain.on('set-reminders', (_e, list) => {
  const s = readState();
  s.list = Array.isArray(list) ? list : [];
  s.lastRun = Date.now();
  writeState(s);
  schedule(s.list);
});
ipcMain.on('get-display-mode', (e) => {
  e.returnValue = displayMode(readState().displayMode);
});
ipcMain.on('set-display-mode', (_e, m) => {
  const s = readState();
  s.displayMode = displayMode(m);
  writeState(s);
  applyDisplayMode(s.displayMode);
});
ipcMain.on('update-info', (e) => {
  e.returnValue = updater.info();
});
ipcMain.on('update-source', (_e, src) => updater.setSource(src));
ipcMain.on('update-auto', (_e, on) => updater.setAuto(on));
ipcMain.on('update-check', () => updater.check());
ipcMain.on('update-restart', () => {
  updater.restart(() => { quitting = true; });
});
function winState() {
  return win && !win.isDestroyed() ? { fullscreen: win.isFullScreen(), maximized: win.isMaximized() } : {};
}
ipcMain.on('win-state', (e) => {
  e.returnValue = winState();
});
// Sağ üstteki pencere düğmeleri
ipcMain.on('win-control', (_e, action) => {
  if (!win || win.isDestroyed()) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'close') win.close(); // tepsiye gizlenir (hatırlatmalar sürer)
  else if (action === 'toggle') {
    if (win.isFullScreen()) {
      win.setFullScreen(false);
      win.maximize();
    } else if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.setFullScreen(true);
    }
  }
});
ipcMain.on('notify-now', (_e, title, body) => notify(title, body));
ipcMain.on('open-url', (_e, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
});
// Yönetici iletişim formu: istek ana süreçten gönderilir (file:// kaynağı CORS'a takılmasın)
ipcMain.handle('post-json', (_e, url, json) => new Promise((resolve) => {
  if (!/^https:\/\//.test(url)) return resolve({ status: 0, text: '' });
  const https = require('https');
  const req = https.request(url, {
    method: 'POST',
    timeout: 20000,
    // FormSubmit, Referer/Origin'siz isteği reddeder ve gönderen siteyi bir kez etkinleştirmeyi ister: etkin site gönderilir
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
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), name),
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, text, 'utf8');
  return 'Kaydedildi: ' + r.filePath;
});

// ---- Wi‑Fi ile internetsiz eşitleme (aynı ağdaki telefonla) ----
const lan = require('./lan-server.js');
const lanFile = () => path.join(app.getPath('userData'), 'wifi-esitleme.json');
const lanPrefs = () => { try { return JSON.parse(fs.readFileSync(lanFile(), 'utf8')); } catch { return {}; } };
const lanSave = (p) => { try { fs.mkdirSync(path.dirname(lanFile()), { recursive: true }); fs.writeFileSync(lanFile(), JSON.stringify(p)); } catch { /* yoksay */ } };
app.whenReady().then(() => lan.setup({ appId: 'kitaplik', prefsGet: lanPrefs, prefsSet: lanSave, photoFile: null, getWindow: () => win }));
ipcMain.on('lan-sync', (e, name, ...args) => {
  try { e.returnValue = lan.syncCalls[name](...args); } catch { e.returnValue = ''; }
});
ipcMain.handle('lan-async', (_e, name, ...args) => lan.asyncCalls[name](...args));
