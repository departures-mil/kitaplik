#!/usr/bin/env node
// Tek sürüm kaynağı: kök package.json "version" (semver X.Y.Z) + release-notes.json →
//   web/surum.js (window.APP_RELEASE, window.KITAPLIK_SURUM), desktop/package.json "version".
// Android versionName = aynı sürüm, versionCode = major*10000 + minor*100 + patch (2.14.0 → 21400; eski APK'lar ≤10).
//   node tools/surum.js            → dosyaları package.json'dan yeniden yazar
//   node tools/surum.js 2.15.0     → package.json sürümünü değiştirir, sonra yazar
//   node tools/surum.js --check    → güncel değilse hata (npm test)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PKG = path.join(ROOT, 'package.json');
const DPKG = path.join(ROOT, 'desktop', 'package.json');
const NOTES = path.join(ROOT, 'release-notes.json');
const OUT = path.join(ROOT, 'web', 'surum.js');
const SEMVER = /^\d+\.\d+\.\d+$/;

function version() {
  const v = JSON.parse(fs.readFileSync(PKG, 'utf8')).version;
  if (!SEMVER.test(v)) throw new Error('package.json version X.Y.Z olmalı: ' + v);
  return v;
}
function versionCode(v) {
  const [a, b, c] = String(v).split('.').map(Number);
  if (b > 99 || c > 99) throw new Error('minor/patch 99\'u geçemez (versionCode): ' + v);
  return a * 10000 + b * 100 + c;
}
function render() {
  const v = version();
  const notes = JSON.parse(fs.readFileSync(NOTES, 'utf8'));
  for (const l of ['tr', 'en', 'ar']) if (typeof notes[l] !== 'string' || !notes[l].trim()) throw new Error('release-notes.json: "' + l + '" eksik');
  return '/* OTOMATİK: node tools/surum.js (kaynak: package.json + release-notes.json). Elle düzenlemeyin. */\n' +
    'window.APP_RELEASE = ' + JSON.stringify({ version: v, notes: { tr: notes.tr, en: notes.en, ar: notes.ar } }, null, 1) + ';\n' +
    'window.KITAPLIK_SURUM = window.APP_RELEASE.version;\n';
}
function desktopPkg() {
  const d = JSON.parse(fs.readFileSync(DPKG, 'utf8'));
  d.version = version();
  return JSON.stringify(d, null, 2) + '\n';
}
module.exports = { render, version, versionCode, desktopPkg, OUT };
if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--check') {
    const errs = [];
    if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== render()) errs.push('web/surum.js güncel değil');
    if (fs.readFileSync(DPKG, 'utf8') !== desktopPkg()) errs.push('desktop/package.json sürümü güncel değil');
    if (errs.length) { console.error(errs.join('\n') + '\n→ node tools/surum.js'); process.exit(1); }
    console.log('sürüm dosyaları güncel (' + version() + ', versionCode ' + versionCode(version()) + ')'); process.exit(0);
  }
  if (arg) {
    if (!SEMVER.test(arg)) { console.error('Sürüm X.Y.Z olmalı'); process.exit(1); }
    const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8')); pkg.version = arg;
    fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
    try {
      const lf = path.join(ROOT, 'package-lock.json'), lock = JSON.parse(fs.readFileSync(lf, 'utf8'));
      lock.version = arg; if (lock.packages && lock.packages['']) lock.packages[''].version = arg;
      fs.writeFileSync(lf, JSON.stringify(lock, null, 2) + '\n');
    } catch (e) { /* kilit dosyası yok */ }
  }
  fs.writeFileSync(OUT, render());
  fs.writeFileSync(DPKG, desktopPkg());
  console.log('Sürüm ' + version() + ' (versionCode ' + versionCode(version()) + ') → web/surum.js, desktop/package.json');
}
