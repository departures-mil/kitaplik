// Kitaplık preload: window.fcHost (ortak çekirdek: pencere düğmeleri, güncelleme, indirme) + window.kitaplikDesktop (uygulama).
// Eski güncelleme köprüsü (updateInfo / checkUpdate / restartToUpdate / windowControl / displayMode) kaldırıldı: ortak çekirdekte.
const { contextBridge, ipcRenderer } = require('electron');
require('./cekirdek/electron/fc-preload.js');

let info = {};
try { info = ipcRenderer.sendSync('kitaplik:info') || {}; } catch (e) { /* yoksay */ }
const lanSync = (name, ...a) => ipcRenderer.sendSync('lan-sync', name, ...a);
const lanAsync = (name) => (...a) => ipcRenderer.invoke('lan-async', name, ...a);

contextBridge.exposeInMainWorld('kitaplikDesktop', {
  shell: 'fc',                     // yeni kabuk
  legacy: !!info.legacy,           // eski (≤2.13) başlatıcıda çalışıyor → arayüz köprü penceresini gösterir
  version: info.version || '',
  setReminders: (list) => ipcRenderer.send('set-reminders', list),
  notifyNow: (title, body) => ipcRenderer.send('notify-now', title, body),
  saveFile: (name, text) => ipcRenderer.invoke('save-file', name, text),
  getDisplayMode: () => null,      // masaüstü her açılışta tam ekran (ortak çekirdek); eski "Görünüm" seçimi yok
  setDisplayMode: () => {},
  postJson: (url, json) => ipcRenderer.invoke('post-json', url, json),
  openUrl: (url) => ipcRenderer.send('open-url', url),
  // Wi‑Fi ile internetsiz eşitleme
  onLanReq: (fn) => ipcRenderer.on('lanReq', (_e, rid, body) => fn(rid, body)),
  lanInfo: () => lanSync('lanInfo'),
  lanIps: () => lanSync('lanIps'),
  lanReply: (rid, json) => lanSync('lanReply', rid, json),
  lanServe: lanAsync('lanServe'),
  lanStop: lanAsync('lanStop'),
  lanResetKey: lanAsync('lanResetKey'),
  lanHttp: lanAsync('lanHttp'),
  lanFind: lanAsync('lanFind'),
});

// Asistan Agent paylaşımı: ortak çekirdekte (fc-preload.js → window.fcHost.agent; fc-electron-main.js fc:agent:*).
