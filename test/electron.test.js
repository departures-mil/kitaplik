// Electron açılış testi: gerçek ana süreç + preload + arayüz (.derleme/app). Pencere açılır, ortak çekirdek başlar, tam ekran,
// üst çubuk ve pencere düğmeleri dolu. Linux'ta ekran yoksa xvfb-run ile (CI: ubuntu-latest). Electron yoksa atlanır.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let electron = null;
try { electron = require('electron'); } catch (e) { }
const needX = process.platform === 'linux' && !process.env.DISPLAY;
const hasXvfb = !needX || spawnSync('sh', ['-c', 'command -v xvfb-run'], { encoding: 'utf8' }).status === 0;

test('Electron: pencere yüklenir, çekirdek başlar, tam ekran', { skip: !electron || typeof electron !== 'string' ? 'electron yok' : !hasXvfb ? 'xvfb-run yok' : false, timeout: 150000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kitaplik-smoke-'));
  const r = require('../tools/hazirla.js').build(path.join(tmp, 'derleme'));
  const args = [r.app, '--no-sandbox', '--disable-gpu', '--user-data-dir=' + path.join(tmp, 'ud')];
  const cmd = needX ? 'xvfb-run' : electron;
  const full = needX ? ['-a', '-s', '-screen 0 1600x1000x24', electron].concat(args) : args;
  const res = spawnSync(cmd, full, { encoding: 'utf8', timeout: 120000, env: Object.assign({}, process.env, { KITAPLIK_SMOKE: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }) });
  const line = String(res.stdout || '').split('\n').find((l) => l.startsWith('KITAPLIK_SMOKE '));
  assert.ok(line, 'çıktı yok: ' + (res.stdout || '') + String(res.stderr || '').slice(-2000));
  const o = JSON.parse(line.slice('KITAPLIK_SMOKE '.length));
  console.log(o);
  assert.deepStrictEqual(o.errors, []);
  assert.strictEqual(o.fc, true, 'FC çekirdeği yüklü');
  assert.strictEqual(o.host, 'electron', 'fcHost tanındı');
  assert.strictEqual(o.desk, true); assert.strictEqual(o.legacy, false);
  assert.strictEqual(o.version, require('../package.json').version);
  assert.strictEqual(o.appVersion, require('../package.json').version);
  assert.strictEqual(o.topbar, true);
  assert.strictEqual(o.winBtns, 4, 'Küçült · Orta · Tam ekran · Kapat');
  assert.strictEqual(o.nav, 4);
  assert.strictEqual(o.scheme, 'falcon');
  assert.strictEqual(o.fullscreen, true, 'her açılışta tam ekran');
  assert.strictEqual(o.ok, true);
  fs.rmSync(tmp, { recursive: true, force: true });
});
