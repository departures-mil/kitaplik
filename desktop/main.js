// Başlatıcı: updater.js'nin indirip imzasını doğruladığı daha yeni bir sürüm
// varsa onu, yoksa paketteki uygulamayı (app-main.js) çalıştırır.
// Bu dosya güncellemelerle değişmez.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const bundled = require('./package.json').version;
const parts = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
function newer(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

const own = path.join(__dirname, 'app-main.js');
let entry = own;
let running = bundled;
try {
  const dir = path.join(app.getPath('userData'), 'guncelleme');
  const cur = JSON.parse(fs.readFileSync(path.join(dir, 'etkin.json'), 'utf8'));
  const d = path.join(dir, cur.version);
  if (newer(cur.version, bundled) && fs.existsSync(path.join(d, 'app-main.js'))) {
    entry = path.join(d, 'app-main.js');
    running = cur.version;
  }
} catch {
  /* indirilmiş güncelleme yok */
}

global.kitaplik = { bundled, running, newer };
try {
  require(entry);
} catch (e) {
  if (entry === own) throw e;
  // Güncelleme açılamadı: paketteki sürümle devam et
  global.kitaplik.running = bundled;
  require(own);
}
