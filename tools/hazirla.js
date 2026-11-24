#!/usr/bin/env node
// Derleme klasörlerini hazırlar (kararlı: aynı kaynaktan bayt bayt aynı çıktı → yamalar doğrulanır).
//   .derleme/app/   Electron uygulaması (electron-builder directories.app): desktop/* + www/ (= web/) + cekirdek/electron/
//                   Bu düzen eski (≤2.13) kurulumların başlatıcısının beklediğiyle aynıdır (app-main.js kökte, www/ yanında).
//   .derleme/www/   Android APK'nın assets/www klasörü (= web/)
//   node tools/hazirla.js [hedefKök]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function copyDir(src, dst, skip) {
  fs.mkdirSync(dst, { recursive: true });
  for (const n of fs.readdirSync(src).sort()) {
    if (n.startsWith('.') || (skip && skip(n))) continue;
    const s = path.join(src, n), d = path.join(dst, n);
    if (fs.statSync(s).isDirectory()) copyDir(s, d, skip);
    else fs.copyFileSync(s, d);
  }
}
function build(outRoot) {
  const out = outRoot || path.join(ROOT, '.derleme');
  const surum = require('./surum.js');
  if (fs.readFileSync(surum.OUT, 'utf8') !== surum.render()) throw new Error('web/surum.js güncel değil: node tools/surum.js');
  const app = path.join(out, 'app'), www = path.join(out, 'www');
  fs.rmSync(app, { recursive: true, force: true });
  fs.rmSync(www, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'desktop'), app, (n) => n === 'icon.ico');
  copyDir(path.join(ROOT, 'web'), path.join(app, 'www'));
  copyDir(path.join(ROOT, 'cekirdek', 'electron'), path.join(app, 'cekirdek', 'electron'));
  fs.copyFileSync(path.join(ROOT, 'cekirdek', 'VERSION'), path.join(app, 'cekirdek', 'VERSION'));
  copyDir(path.join(ROOT, 'web'), www);
  return { app, www };
}
module.exports = { build, copyDir };
if (require.main === module) {
  const r = build(process.argv[2]);
  console.log('Hazır: ' + path.relative(ROOT, r.app) + ', ' + path.relative(ROOT, r.www));
}
