const { contextBridge, ipcRenderer } = require('electron');

const lanSync = (name, ...a) => ipcRenderer.sendSync('lan-sync', name, ...a);
const lanAsync = (name) => (...a) => ipcRenderer.invoke('lan-async', name, ...a);

contextBridge.exposeInMainWorld('kitaplikDesktop', {
  setReminders: (list) => ipcRenderer.send('set-reminders', list),
  notifyNow: (title, body) => ipcRenderer.send('notify-now', title, body),
  saveFile: (name, text) => ipcRenderer.invoke('save-file', name, text),
  getDisplayMode: () => ipcRenderer.sendSync('get-display-mode'),
  setDisplayMode: (m) => ipcRenderer.send('set-display-mode', m),
  postJson: (url, json) => ipcRenderer.invoke('post-json', url, json),
  updateInfo: () => ipcRenderer.sendSync('update-info'),
  setUpdateSource: (src) => ipcRenderer.send('update-source', src),
  setAutoUpdate: (on) => ipcRenderer.send('update-auto', on),
  checkUpdate: () => ipcRenderer.send('update-check'),
  restartToUpdate: () => ipcRenderer.send('update-restart'),
  onUpdateStatus: (fn) => ipcRenderer.on('update-status', (_e, st) => fn(st)),
  openUrl: (url) => ipcRenderer.send('open-url', url),
  windowControl: (action) => ipcRenderer.send('win-control', action),
  windowState: () => ipcRenderer.sendSync('win-state'),
  onWindowState: (fn) => ipcRenderer.on('win-state', (_e, st) => fn(st)),
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

// Asistan Agent: aynı bilgisayardaki uygulamalarla sayaç paylaşımı (fc-agent-main.js)
const fcAgentUnwrap = (p) => p.then((r) => { if (r && r.ok) return r.data; throw new Error((r && r.error) || 'ERR'); });
contextBridge.exposeInMainWorld('fcAgentHost', {
  read: () => fcAgentUnwrap(ipcRenderer.invoke('fc:agent:read')),
  write: (key, json) => fcAgentUnwrap(ipcRenderer.invoke('fc:agent:write', key, json)),
  remove: (key) => fcAgentUnwrap(ipcRenderer.invoke('fc:agent:remove', key))
});
