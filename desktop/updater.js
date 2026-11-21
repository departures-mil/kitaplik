// Masaüstü otomatik güncelleme. Güncellemeler GitHub deposundan gelir
// (departures-mil/kitaplik; Firebase yalnızca canlı kayıt eşitlemesi içindir):
//   guncelleme/masaustu2.json → {version, file, bytes, sha256, signature, notes}
//   guncelleme/{file}         → imzalı paket (gzip JSON)
// Paket, yalnızca geliştiricide duran özel anahtarla imzalanır; imzası aşağıdaki
// açık anahtarla doğrulanmayan paket kurulmaz. Doğrulanan dosyalar userData/guncelleme/{sürüm}/
// klasörüne açılır; uygulama yeniden başlayınca main.js (başlatıcı) onu çalıştırır.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENsqFb/1qwh7LQ2QlrVJzQAAKU0dD
2fjpVPn6qN9T8j/2lxWuoOLlaFa0wN01NGYsLoSZOcHhrjBzcHIqkBU1pA==
-----END PUBLIC KEY-----`;
const SIX_HOURS = 6 * 3600 * 1000;
const CHANNEL = 'masaustu2';

module.exports = function createUpdater({ readState, writeState, notify, send }) {
  const k = global.kitaplik || { running: app.getVersion(), newer: () => false };
  const dir = path.join(app.getPath('userData'), 'guncelleme');
  let status = { state: 'idle', text: '' };
  let busy = false;

  const cfg = () => readState().update || {};
  const setStatus = (state, text, extra = {}) => {
    const next = { state, text, ...extra };
    if (JSON.stringify(next) === JSON.stringify(status)) return; // değişmediyse arayüzü yorma
    status = next;
    send(status);
  };

  const GITHUB_RAW = 'https://raw.githubusercontent.com/departures-mil/kitaplik/main/guncelleme/';

  // URL'yi indirir (404 → null). onData(len, toplam) ilerleme için çağrılır.
  function getBuf(url, onData) {
    const https = require('https');
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 30000, headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Kitaplik' } }, (res) => {
        if (res.statusCode === 404) { res.resume(); return resolve(null); }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`Sunucu yanıtı ${res.statusCode}`)); }
        const total = Number(res.headers['content-length'] || 0);
        const chunks = [];
        res.on('data', (c) => { chunks.push(c); if (onData) onData(c.length, total); });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('Zaman aşımı')));
      req.on('error', (e) => reject(new Error(e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN' ? 'İnternet bağlantısı yok' : e.message)));
    });
  }

  async function getMeta(channel) {
    const b = await getBuf(`${GITHUB_RAW}${channel}.json?t=${Date.now()}`);
    return b ? JSON.parse(b.toString('utf8')) : null;
  }

  const field = (meta, name) => (meta ? meta[name] : undefined);

  function readyVersion() {
    try {
      const v = JSON.parse(fs.readFileSync(path.join(dir, 'etkin.json'), 'utf8')).version;
      return k.newer(v, k.running) && fs.existsSync(path.join(dir, v, 'app-main.js')) ? v : null;
    } catch {
      return null;
    }
  }

  async function install(version, meta) {
    // İlerleme: yüzde + MB (inen / toplam, kalan) + indirme hızı
    let total = Number(field(meta, 'bytes')) || 1;
    const mb = (b) => (b / 1048576).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const t0 = Date.now();
    let got = 0;
    let last = 0;
    const show = (force) => {
      const now = Date.now();
      if (!force && now - last < 300) return;
      last = now;
      const done = Math.min(got, total);
      const sec = Math.max((now - t0) / 1000, 0.001);
      const hiz = done / sec;
      const kb = hiz < 1048576 ? `${Math.round(hiz / 1024)} KB/sn` : `${mb(hiz)} MB/sn`;
      const pct = Math.round((done / total) * 100);
      const kalanSn = hiz > 0 ? Math.ceil((total - done) / hiz) : 0;
      const eta = !kalanSn || done < 1 ? '' : kalanSn < 60 ? `${kalanSn} sn` : `${Math.floor(kalanSn / 60)} dk ${kalanSn % 60} sn`;
      setStatus(
        'downloading',
        `Sürüm ${version} indiriliyor: %${pct} — ${mb(done)} / ${mb(total)} MB indi, kalan ${mb(total - done)} MB, hız ${kb}`,
        { version, pct, doneMB: mb(done), totalMB: mb(total), leftMB: mb(total - done), speed: kb, eta }
      );
    };
    show(true);
    const buf = await getBuf(GITHUB_RAW + field(meta, 'file'), (len, tot) => {
      if (tot && tot !== total) total = tot;
      got += len;
      show(false);
    });
    if (!buf) throw new Error('Güncelleme eksik yayınlanmış');
    got = total;
    show(true);
    if (crypto.createHash('sha256').update(buf).digest('hex') !== field(meta, 'sha256')) throw new Error('Güncelleme paketi bozuk indi');
    const sig = Buffer.from(field(meta, 'signature') || '', 'base64');
    if (!sig.length || !crypto.verify('sha256', buf, PUBLIC_KEY, sig)) {
      throw new Error('Güncelleme imzası doğrulanamadı, kurulmadı');
    }
    const pkg = JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
    if (pkg.version !== version || !pkg.files || !pkg.files['app-main.js']) throw new Error('Güncelleme paketi geçersiz');
    const tmp = path.join(dir, version + '.tmp');
    const target = path.join(dir, version);
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const [rel, data] of Object.entries(pkg.files)) {
      const out = path.resolve(tmp, rel);
      if (!out.startsWith(path.resolve(tmp) + path.sep)) throw new Error('Güncelleme paketi geçersiz');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(data, 'base64'));
    }
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(tmp, target);
    fs.writeFileSync(path.join(dir, 'etkin.json'), JSON.stringify({ version }));
    // Artık kullanılmayan eski güncelleme klasörlerini sil
    for (const d of fs.readdirSync(dir)) {
      if (d !== version && d !== k.running && d !== 'etkin.json') fs.rmSync(path.join(dir, d), { recursive: true, force: true });
    }
  }

  async function check(manual = false, startup = false) {
    if (busy) return;
    const ready = readyVersion();
    if (ready) {
      setStatus('ready', `Sürüm ${ready} hazır. Güncelle'ye basınca program yeni sürümle yeniden açılır.`, { version: ready });
      if (startup) notify('Kitaplık güncellemesi hazır', `Sürüm ${ready} hazır. Programdaki Güncelle düğmesine basın.`);
      return;
    }
    busy = true;
    try {
      setStatus('checking', 'Güncelleme denetleniyor…');
      const meta = await getMeta(CHANNEL);
      const version = field(meta, 'version');
      if (!meta || !version || !k.newer(version, k.running)) {
        const t = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        return setStatus('uptodate', `Program güncel (son denetim ${t}).`);
      }
      if (!manual && cfg().auto === false) {
        setStatus('available', `Yeni sürüm var: ${version}. İndirmek için Güncellemeleri denetle'ye basın.`, { version });
        if (startup) notify('Kitaplık güncellemesi var', `Sürüm ${version} yayınlandı.`);
        return;
      }
      await install(version, meta);
      setStatus('ready', `Sürüm ${version} indirildi. Güncelle'ye basınca program yeni sürümle yeniden açılır.`, { version });
      notify('Kitaplık güncellemesi hazır', `Sürüm ${version} indirildi. Programdaki Güncelle düğmesine basın.`);
    } catch (e) {
      setStatus('error', 'Güncelleme alınamadı: ' + (e.message || e));
      if (manual) throw e;
    } finally {
      busy = false;
    }
  }

  function start() {
    // Açılışta hemen denetle (hazır ya da yeni güncelleme varsa bildirim gelir)
    setTimeout(() => check(false, true).catch(() => {}), 3000);
    setInterval(() => check().catch(() => {}), SIX_HOURS);
  }

  return {
    start,
    check: () => check(true).catch(() => {}),
    info: () => ({ auto: cfg().auto !== false, running: k.running, status }),
    setSource(src) {
      const s = readState();
      const prev = JSON.stringify((s.update || {}).source || null);
      s.update = { ...(s.update || {}), source: src || null };
      writeState(s);
      if (prev !== JSON.stringify(src || null) && s.update.auto !== false) check().catch(() => {});
    },
    setAuto(on) {
      const s = readState();
      s.update = { ...(s.update || {}), auto: !!on };
      writeState(s);
      if (on) check().catch(() => {});
    },
    restart(beforeQuit) {
      if (!readyVersion()) return check(true).catch(() => {});
      if (beforeQuit) beforeQuit();
      app.relaunch();
      app.exit(0);
    },
  };
};
