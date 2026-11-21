'use strict';
/*
 * Yerel ağ eşitleme — masaüstü tarafı (Electron ana süreç). İnternet gerekmez: aynı Wi‑Fi / aynı modem
 * ya da telefonun hotspot'u yeterlidir. Uygulamadan bağımsızdır; her programda aynen kullanılır.
 *
 *   const lan = require('./lan-server');
 *   lan.setup({ appId: 'ajandam', prefsGet, prefsSet, photoFile, getWindow });
 *   // ipcMain 'sync' / 'async' köprüsüne lan.syncCalls ve lan.asyncCalls eklenir (bkz. LAN-KILAVUZ.md)
 *
 * Protokol (HTTP, yalnızca yerel ağ):
 *   GET  /lan/ping                 X-Lan-Key → {ok, app, name}
 *   POST /lan/sync                 X-Lan-Key, gövde JSON → arayüzdeki (renderer) LanCore cevaplar
 *   GET  /lan/photo/<id>           X-Lan-Key → dosya
 *   PUT  /lan/photo/<id>           X-Lan-Key, gövde dosya
 * Yanlış anahtar 403 alır; 15 yanlış denemeden sonra sunucu 10 dakika kimseyi kabul etmez.
 */
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_BODY = 300 * 1024 * 1024;

let cfg = null;
let server = null;
let port = 0;
let bad = 0;
let lockedUntil = 0;
let reqSeq = 0;
const pending = new Map();

function basePort(appId) {
  let h = 0;
  for (const ch of String(appId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 47000 + (h % 900);
}

function newKey() {
  const b = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
}

function state() {
  const p = cfg.prefsGet() || {};
  if (!p.lanKey) { p.lanKey = newKey(); cfg.prefsSet(p); }
  return p;
}

/** Bu bilgisayarın yerel ağ adresleri; ev/ofis ağları (192.168.x, 10.x, 172.16-31.x) önce. */
function lanIps() {
  const out = [];
  Object.values(os.networkInterfaces()).forEach(list => (list || []).forEach(a => {
    if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address);
  }));
  const rank = ip => ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
  return [...new Set(out)].sort((a, b) => rank(a) - rank(b));
}

function send(res, status, obj, type) {
  const body = Buffer.isBuffer(obj) ? obj : Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
  res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', c => { n += c.length; if (n > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** POST /lan/sync gövdesini arayüze verir; cevap lanReply ile gelir. */
function askRenderer(body) {
  const win = cfg.getWindow();
  if (!win || win.isDestroyed()) return Promise.resolve({ ok: false, error: 'busy' });
  const rid = 'r' + (++reqSeq);
  return new Promise(resolve => {
    const timer = setTimeout(() => { pending.delete(rid); resolve({ ok: false, error: 'timeout' }); }, 120000);
    pending.set(rid, r => { clearTimeout(timer); resolve(r); });
    win.webContents.send('lanReq', rid, body);
  });
}

async function handle(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    if (Date.now() < lockedUntil) return send(res, 429, { ok: false, error: 'locked' });
    const key = req.headers['x-lan-key'] || url.searchParams.get('k') || '';
    if (key !== state().lanKey) {
      if (++bad >= 15) { bad = 0; lockedUntil = Date.now() + 10 * 60000; }
      return send(res, 403, { ok: false, error: 'key' });
    }
    bad = 0;
    const p = url.pathname;
    if (p === '/lan/ping') return send(res, 200, { ok: true, app: cfg.appId, name: os.hostname(), v: 1 });
    if (p === '/lan/sync' && req.method === 'POST') {
      const body = (await readBody(req)).toString('utf8');
      const r = await askRenderer(body);
      return send(res, r && r.ok === false && r.error === 'app' ? 409 : 200, r);
    }
    const m = p.match(/^\/lan\/photo\/([A-Za-z0-9_-]{1,80})$/);
    if (m && cfg.photoFile) {
      const f = cfg.photoFile(m[1]);
      if (req.method === 'GET') {
        if (!fs.existsSync(f)) return send(res, 404, { ok: false });
        return send(res, 200, fs.readFileSync(f), 'application/octet-stream');
      }
      if (req.method === 'PUT') {
        const data = await readBody(req);
        if (!data.length) return send(res, 400, { ok: false });
        if (!fs.existsSync(f)) { // var olan dosyanın üstüne asla yazılmaz
          fs.mkdirSync(path.dirname(f), { recursive: true });
          fs.writeFileSync(f + '.part', data);
          fs.renameSync(f + '.part', f);
        }
        return send(res, 200, { ok: true });
      }
    }
    send(res, 404, { ok: false });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e && e.message || e) });
  }
}

function listen(tryPort, left) {
  return new Promise(resolve => {
    const s = http.createServer(handle);
    s.on('error', () => { s.close(); resolve(left > 0 ? listen(tryPort + 1, left - 1) : null); });
    s.listen(tryPort, '0.0.0.0', () => resolve(s));
  });
}

async function start() {
  if (server) return info();
  const s = await listen(basePort(cfg.appId), 8);
  if (!s) return { ok: false, error: 'port' };
  server = s;
  port = s.address().port;
  const p = state();
  if (!p.lanOn) { p.lanOn = true; cfg.prefsSet(p); }
  return info();
}

function stop(remember) {
  if (server) { server.close(); server = null; }
  if (remember) { const p = state(); p.lanOn = false; cfg.prefsSet(p); }
  return { ok: true };
}

function info() {
  const p = state();
  return { ok: true, on: !!server, ips: lanIps(), port, key: p.lanKey, app: cfg.appId, name: os.hostname() };
}

/* ---------- istemci (bu bilgisayar başka bir cihaza bağlanırken) ---------- */

function rawHttp(method, url, body, timeoutMs, headers) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ status: 0, body: 'url' }); }
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: headers || {}, timeout: timeoutMs || 30000 }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
    req.on('error', e => resolve({ status: 0, body: String(e.message || e) }));
    if (body) req.write(body);
    req.end();
  });
}

async function clientHttp(method, url, body, timeoutMs, key) {
  const h = { 'X-Lan-Key': key || '' };
  if (body) { h['Content-Type'] = 'application/json; charset=utf-8'; h['Content-Length'] = Buffer.byteLength(body); }
  const r = await rawHttp(method, url, body, timeoutMs, h);
  return { status: r.status, body: r.buf ? r.buf.toString('utf8') : r.body };
}

async function getPhoto(url, id, key) {
  const f = cfg.photoFile(id);
  if (fs.existsSync(f)) return { status: 200 };
  const r = await rawHttp('GET', url, null, 60000, { 'X-Lan-Key': key || '' });
  if (r.status === 200 && r.buf && r.buf.length) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f + '.part', r.buf);
    fs.renameSync(f + '.part', f);
  }
  return { status: r.status };
}

async function putPhoto(url, id, key) {
  const f = cfg.photoFile(id);
  if (!fs.existsSync(f)) return { status: 404 };
  const data = fs.readFileSync(f);
  const r = await rawHttp('PUT', url, data, 60000, { 'X-Lan-Key': key || '', 'Content-Type': 'application/octet-stream', 'Content-Length': data.length });
  return { status: r.status };
}

/** Kayıtlı adres değiştiyse aynı ağda (/24) eşleşmiş cihazı arar. */
async function find(port0, key, appId) {
  const hosts = [];
  lanIps().forEach(ip => { const b = ip.split('.').slice(0, 3).join('.'); for (let i = 1; i < 255; i++) hosts.push(b + '.' + i); });
  const mine = new Set(lanIps());
  let found = null;
  let idx = 0;
  const worker = async () => {
    while (!found && idx < hosts.length) {
      const h = hosts[idx++];
      if (mine.has(h)) continue;
      const r = await clientHttp('GET', `http://${h}:${port0}/lan/ping`, null, 600, key);
      if (r.status === 200) { try { if (JSON.parse(r.body).app === appId) found = h; } catch (e) { /* başka program */ } }
    }
  };
  await Promise.all(Array.from({ length: 48 }, worker));
  return { ok: !!found, host: found || '' };
}

function setup(c) {
  cfg = c;
  if (state().lanOn) start();
}

/** ipcMain.on('sync') içinde çağrılanlar (eşzamanlı). */
const syncCalls = {
  lanReply: (rid, json) => { const f = pending.get(rid); if (f) { pending.delete(rid); try { f(JSON.parse(json)); } catch (e) { f({ ok: false, error: 'reply' }); } } return true; },
  lanInfo: () => JSON.stringify(info()),
  lanIps: () => JSON.stringify(lanIps())
};

/** ipcMain.handle('async') içinde çağrılanlar. */
const asyncCalls = {
  lanServe: () => start(),
  lanStop: () => stop(true),
  lanResetKey: async () => { const p = state(); p.lanKey = newKey(); cfg.prefsSet(p); return info(); },
  lanHttp: (method, url, body, timeoutMs, key) => clientHttp(method, url, body, timeoutMs, key),
  lanGetPhoto: (url, id, key) => getPhoto(url, id, key),
  lanPutPhoto: (url, id, key) => putPhoto(url, id, key),
  lanFind: (p, key, appId) => find(p, key, appId)
};

module.exports = { setup, start, stop, info, lanIps, basePort, syncCalls, asyncCalls };
