/*
 * Yerel ağ eşitleme (internetsiz Wi‑Fi eşitleme) — arayüz çekirdeği. Uygulamadan bağımsızdır.
 * Gerekenler: lan-vendor.js (QR üretme + okuma) önce yüklenir, sonra bu dosya, sonra uygulama
 * window.LanCore.init(adapter) çağırır. Adaptörün alanları LAN-KILAVUZ.md içinde anlatılır.
 *
 * Birleştirme kuralları (iki tarafta da aynı sonuç çıkar, hiçbir kayıt kaybolmaz):
 *  - Kayıt yalnızca bir tarafta varsa eklenir; ancak öbür tarafta o kayıttan SONRA silinmişse silinir.
 *  - İki tarafta da varsa ve farklıysa daha yeni değiştirilen kalır, eskisi "çakışma yedeği"ne yazılır.
 *  - Silme kayıtları birleştirilir; silmeden sonra düzenlenen kayıt geri gelir (veri kaybı olmaz).
 *  - Fotoğraf / dosya: yalnızca eksik olan taraf alır; var olan dosyanın üstüne asla yazılmaz.
 */
(function () {
  'use strict';

  const TXT = {
    tr: {
      title: 'Wi‑Fi ile eşitleme (internetsiz)', open: 'Wi‑Fi eşitlemeyi aç', stop: 'Wi‑Fi eşitlemeyi kapat',
      desk_on: 'Telefonda bu programı açın → 📶 → "QR kodu okut". Kod bir kez okutulur, sonra tek tuşla eşitlenir.',
      desk_off: 'Açınca bu bilgisayar aynı Wi‑Fi\'deki telefonlarınızla internetsiz eşitlenir. Windows "erişime izin ver" sorarsa İzin ver deyin.',
      code: 'Bağlantı kodu', reset: 'Eşleşmeyi sıfırla', reset_q: 'Eşleşmiş cihazlar yeniden QR okutmak zorunda kalır. Devam?',
      scan: 'QR kodu okut', scan_hint: 'Bilgisayardaki QR kodu çerçeveye getirin', photo: 'Fotoğrafını çek',
      manual: 'Kod ile bağlan', manual_ph: 'ör. 192.168.1.5:47123-ABCD2345', connect: 'Bağlan',
      paired: 'Eşleşmiş cihazlar', sync: 'Eşitle', forget: 'Unut', none: 'Henüz eşleşmiş cihaz yok.',
      finding: 'Cihaz aranıyor…', sending: 'Kayıtlar gönderiliyor…', merging: 'Kayıtlar birleştiriliyor…', photos: 'Fotoğraflar',
      done: 'Eşitlendi', added: 'yeni', updated: 'güncellendi', removed: 'silindi', conflicts: 'çakışma yedeklendi', files: 'dosya',
      nochange: 'Her şey zaten aynı.',
      e_find: 'Cihaz bulunamadı. İkisi aynı Wi‑Fi\'de mi (ya da bilgisayar telefonun hotspot\'una bağlı mı) ve bilgisayarda program açık mı?',
      e_key: 'Eşleşme geçersiz. Bilgisayardaki QR kodu yeniden okutun.', e_app: 'Bu kod başka bir programa ait.',
      e_acc: 'Bu iki cihaz farklı hesaplarda. Aynı hesaptaki cihazlar eşitlenebilir.', e_qr: 'QR kod okunamadı. Yeniden deneyin.',
      e_cam: 'Kamera açılamadı, fotoğrafını çekerek deneyin.', e_old: 'Bu özellik için önce uygulamayı güncelleyin (Ayarlar → Güncelle).',
      e_net: 'Bağlantı koptu', tip: 'İnternet ya da modem yoksa: telefonun hotspot\'unu açın, bilgisayarı ona bağlayın, sonra eşitleyin.',
      this_pc: 'Bu bilgisayar', other: 'Başka bir bilgisayara bağlan', from: 'ile eşitlendi', last: 'Son', auto: 'Aynı ağdayken otomatik eşitle',
      close: 'Kapat', busy: 'Eşitleme sürüyor…'
    },
    en: {
      title: 'Wi‑Fi sync (no internet)', open: 'Turn on Wi‑Fi sync', stop: 'Turn off Wi‑Fi sync',
      desk_on: 'On the phone open this app → 📶 → "Scan QR code". Scan once, then sync with one tap.',
      desk_off: 'When on, this computer syncs with your phones on the same Wi‑Fi without internet. If Windows asks to allow access, choose Allow.',
      code: 'Connection code', reset: 'Reset pairing', reset_q: 'Paired devices will have to scan the QR code again. Continue?',
      scan: 'Scan QR code', scan_hint: 'Point the camera at the QR code on the computer', photo: 'Take a photo of it',
      manual: 'Connect with code', manual_ph: 'e.g. 192.168.1.5:47123-ABCD2345', connect: 'Connect',
      paired: 'Paired devices', sync: 'Sync', forget: 'Forget', none: 'No paired devices yet.',
      finding: 'Looking for the device…', sending: 'Sending records…', merging: 'Merging records…', photos: 'Photos',
      done: 'Synced', added: 'new', updated: 'updated', removed: 'deleted', conflicts: 'conflicts backed up', files: 'files',
      nochange: 'Everything is already the same.',
      e_find: 'Device not found. Are both on the same Wi‑Fi (or the computer on the phone\'s hotspot), and is the app open on the computer?',
      e_key: 'Pairing is no longer valid. Scan the QR code on the computer again.', e_app: 'This code belongs to another app.',
      e_acc: 'These two devices use different accounts. Only devices on the same account can sync.', e_qr: 'Could not read the QR code. Try again.',
      e_cam: 'Camera could not start; try taking a photo instead.', e_old: 'Please update the app first (Settings → Update).',
      e_net: 'Connection lost', tip: 'No internet or router? Turn on the phone\'s hotspot, connect the computer to it, then sync.',
      this_pc: 'This computer', other: 'Connect to another computer', from: 'synced', last: 'Last', auto: 'Sync automatically on the same network',
      close: 'Close', busy: 'Sync in progress…'
    },
    ar: {
      title: 'المزامنة عبر Wi‑Fi (بدون إنترنت)', open: 'تشغيل مزامنة Wi‑Fi', stop: 'إيقاف مزامنة Wi‑Fi',
      desk_on: 'على الهاتف افتح هذا البرنامج ← 📶 ← "مسح رمز QR". يُمسح الرمز مرة واحدة ثم تتم المزامنة بلمسة واحدة.',
      desk_off: 'عند التشغيل يتزامن هذا الحاسوب مع هواتفك على نفس شبكة Wi‑Fi بدون إنترنت. إذا سأل Windows عن السماح بالوصول فاختر سماح.',
      code: 'رمز الاتصال', reset: 'إعادة تعيين الاقتران', reset_q: 'ستحتاج الأجهزة المقترنة إلى مسح رمز QR من جديد. متابعة؟',
      scan: 'مسح رمز QR', scan_hint: 'وجّه الكاميرا إلى رمز QR على الحاسوب', photo: 'التقط صورة له',
      manual: 'الاتصال بالرمز', manual_ph: 'مثال 192.168.1.5:47123-ABCD2345', connect: 'اتصال',
      paired: 'الأجهزة المقترنة', sync: 'مزامنة', forget: 'إزالة', none: 'لا توجد أجهزة مقترنة بعد.',
      finding: 'جارٍ البحث عن الجهاز…', sending: 'جارٍ إرسال السجلات…', merging: 'جارٍ دمج السجلات…', photos: 'الصور',
      done: 'تمت المزامنة', added: 'جديد', updated: 'محدَّث', removed: 'محذوف', conflicts: 'تعارضات محفوظة احتياطياً', files: 'ملفات',
      nochange: 'كل شيء متطابق مسبقاً.',
      e_find: 'لم يُعثر على الجهاز. هل الجهازان على نفس شبكة Wi‑Fi (أو الحاسوب متصل بنقطة اتصال الهاتف) والبرنامج مفتوح على الحاسوب؟',
      e_key: 'الاقتران لم يعد صالحاً. امسح رمز QR على الحاسوب من جديد.', e_app: 'هذا الرمز يخص برنامجاً آخر.',
      e_acc: 'هذان الجهازان على حسابين مختلفين. لا تتزامن إلا أجهزة الحساب نفسه.', e_qr: 'تعذّرت قراءة رمز QR. حاول مجدداً.',
      e_cam: 'تعذّر تشغيل الكاميرا، جرّب التقاط صورة.', e_old: 'يرجى تحديث التطبيق أولاً (الإعدادات ← تحديث).',
      e_net: 'انقطع الاتصال', tip: 'لا يوجد إنترنت أو موجّه؟ شغّل نقطة اتصال الهاتف وصِل الحاسوب بها ثم زامن.',
      this_pc: 'هذا الحاسوب', other: 'الاتصال بحاسوب آخر', from: 'تمت المزامنة مع', last: 'آخر مرة', auto: 'مزامنة تلقائية على نفس الشبكة',
      close: 'إغلاق', busy: 'المزامنة جارية…'
    }
  };

  let A = null;
  let running = false;
  const tt = k => { const l = (A && A.lang && A.lang()) || 'tr'; return (TXT[l] || TXT.tr)[k] || TXT.tr[k] || k; };
  const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const nat = () => A.native;
  const has = fn => typeof nat()[fn] === 'function';
  const isDesk = () => !!A.isDesktop();
  const locTag = () => { const l = (A.lang && A.lang()) || 'tr'; return l === 'ar' ? 'ar-u-nu-latn' : l === 'en' ? 'en-GB' : 'tr-TR'; };

  /* ---------------- birleştirme ---------------- */

  function canon(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x);
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
  }
  const stamp = d => (A && A.stamp ? A.stamp(d) : Number(d && (d.ua || d.updatedAt || d.ca) || 0)) || 0;

  /** Her iki tarafta aynı sonucu veren birleştirme. state = {docs: {id: kayıt}, dels: {id: silinme zamanı}} */
  function merge(a, b) {
    const da = (a && a.docs) || {}, db = (b && b.docs) || {};
    const dels = Object.assign({}, (a && a.dels) || {});
    Object.entries((b && b.dels) || {}).forEach(([id, ts]) => { if (!(dels[id] >= ts)) dels[id] = ts; });
    const docs = {}, conflicts = [];
    new Set(Object.keys(da).concat(Object.keys(db))).forEach(id => {
      const x = da[id], y = db[id];
      if (x && y) {
        const cx = canon(x), cy = canon(y);
        if (cx === cy) { docs[id] = x; return; }
        const sx = stamp(x), sy = stamp(y);
        const xWins = sx > sy || (sx === sy && cx > cy);
        docs[id] = xWins ? x : y;
        conflicts.push(xWins ? y : x);
        return;
      }
      const d = x || y;
      if (dels[id] && dels[id] >= stamp(d)) return; // silindikten sonra değişmemiş: silinir
      docs[id] = d;
    });
    return { docs, dels, conflicts };
  }

  function summary(before, merged) {
    const r = { added: 0, updated: 0, removed: 0, conflicts: merged.conflicts.length };
    Object.keys(merged.docs).forEach(id => {
      if (!before.docs[id]) r.added++;
      else if (canon(before.docs[id]) !== canon(merged.docs[id])) r.updated++;
    });
    Object.keys(before.docs).forEach(id => { if (!merged.docs[id]) r.removed++; });
    return r;
  }

  function pruneDels(dels) {
    const old = Date.now() - 400 * 86400000;
    Object.keys(dels).forEach(id => { if (dels[id] < old) delete dels[id]; });
    return dels;
  }

  const photoIds = st => (A.photoIds ? A.photoIds(st) : []);
  const hasPhoto = id => (A.hasPhoto ? A.hasPhoto(id) : false);
  const waitIdle = async () => { for (let i = 0; i < 120 && A.busy && A.busy(); i++) await new Promise(r => setTimeout(r, 250)); };

  /* ---------------- sunucu tarafı (bilgisayar) ---------------- */

  async function serverHandle(text) {
    let p;
    try { p = JSON.parse(text); } catch (e) { return { ok: false, error: 'json' }; }
    if (p.app !== A.app) return { ok: false, error: 'app' };
    const mine = A.account ? A.account() : '';
    if (p.account && mine && p.account !== mine) return { ok: false, error: 'account', account: mine };
    await waitIdle();
    running = true;
    try {
      const local = A.exportState();
      const merged = merge(local, p.state);
      merged.dels = pruneDels(merged.dels);
      const rep = summary(local, merged);
      const ids = photoIds(merged);
      const photos = ids.filter(id => hasPhoto(id));
      A.applyState(merged, rep);
      const dev = (p.dev && p.dev.name) || '';
      const m = meta(); m.lastIn = { at: Date.now(), dev }; saveMeta(m);
      toast('📶 ' + (dev ? dev + ' ' : '') + tt('from') + ' ✓');
      return { ok: true, v: 1, account: mine, dev: A.device(), state: local, photos };
    } finally { running = false; }
  }

  /* ---------------- istemci tarafı ---------------- */

  function parseTarget(text) {
    const s = String(text || '').trim();
    try {
      const j = JSON.parse(s);
      if (j && j.t === 'lan1' && j.k) return { app: j.a, hosts: j.h || [], port: j.p, key: j.k, name: j.n || '' };
    } catch (e) { /* elle yazılmış kod olabilir */ }
    const m = s.match(/(\d{1,3}(?:\.\d{1,3}){3})\s*:\s*(\d{2,5})\s*[-–·\s]\s*([A-Za-z2-9]{8})/);
    if (m) return { app: A.app, hosts: [m[1]], port: +m[2], key: m[3].toUpperCase(), name: m[1] };
    return null;
  }

  const call = (fn, ...a) => A.call(fn, ...a);
  const base = (h, p) => `http://${h}:${p}`;

  async function ping(h, t) {
    const r = await call('lanHttp', 'GET', base(h, t.port) + '/lan/ping', '', 1800, t.key);
    if (r.status === 403) return 'key';
    if (r.status !== 200) return '';
    try { const j = JSON.parse(r.body); return j.app === A.app ? 'ok' : 'app'; } catch (e) { return ''; }
  }

  async function locate(t, quiet, step) {
    for (const h of t.hosts) {
      const r = await ping(h, t);
      if (r === 'ok') return h;
      if (r === 'key' || r === 'app') throw new Error(r === 'key' ? 'e_key' : 'e_app');
    }
    if (quiet || !has('lanFind')) return '';
    step(tt('finding'));
    const f = await call('lanFind', t.port, t.key, A.app);
    return f && f.ok ? f.host : '';
  }

  async function connect(t, opts) {
    opts = opts || {};
    const step = opts.step || (() => {});
    if (!has('lanHttp')) throw new Error('e_old');
    if (t.app && t.app !== A.app) throw new Error('e_app');
    if (running || (A.busy && A.busy())) throw new Error('busy');
    running = true;
    try {
      step(tt('finding'));
      const host = await locate(t, opts.quiet, step);
      if (!host) throw new Error('e_find');
      step(tt('sending'));
      const local = A.exportState();
      const body = JSON.stringify({ v: 1, app: A.app, account: A.account ? A.account() : '', dev: A.device(), state: local });
      const r = await call('lanHttp', 'POST', base(host, t.port) + '/lan/sync', body, 180000, t.key);
      if (r.status === 403) throw new Error('e_key');
      let j = null;
      try { j = JSON.parse(r.body); } catch (e) { /* */ }
      if (!j) throw new Error(tt('e_net') + (r.body ? ': ' + String(r.body).slice(0, 80) : ''));
      if (!j.ok) throw new Error(j.error === 'account' ? 'e_acc' : j.error === 'app' ? 'e_app' : String(j.error || 'error'));
      step(tt('merging'));
      const merged = merge(local, j.state);
      merged.dels = pruneDels(merged.dels);
      const now = A.exportState(); // gönderim sırasında değişen olduysa onu da katar
      const final = canon(now.docs) === canon(local.docs) ? merged : merge(now, j.state);
      const rep = summary(now, final);
      A.applyState(final, rep);
      // fotoğraflar / dosyalar: yalnızca eksik taraf alır
      const remote = new Set(j.photos || []);
      const ids = photoIds(final);
      const todo = ids.filter(id => (!hasPhoto(id) && remote.has(id)) || (hasPhoto(id) && !remote.has(id)));
      let n = 0;
      for (const id of todo) {
        step(`${tt('photos')}: ${++n} / ${todo.length}`);
        const fn = hasPhoto(id) ? 'lanPutPhoto' : 'lanGetPhoto';
        await call(fn, base(host, t.port) + '/lan/photo/' + encodeURIComponent(id), id, t.key);
      }
      rep.files = todo.length;
      if (todo.length && A.photosChanged) A.photosChanged();
      // eşleşmeyi hatırla (adres en başta)
      const m = meta();
      const name = (j.dev && j.dev.name) || t.name || host;
      m.pairs = (m.pairs || []).filter(x => x.key !== t.key);
      m.pairs.unshift({ app: A.app, key: t.key, port: t.port, hosts: [host].concat(t.hosts.filter(h => h !== host)).slice(0, 4), name, last: Date.now() });
      saveMeta(m);
      return rep;
    } finally { running = false; }
  }

  function repText(r) {
    const parts = [];
    if (r.added) parts.push(`${r.added} ${tt('added')}`);
    if (r.updated) parts.push(`${r.updated} ${tt('updated')}`);
    if (r.removed) parts.push(`${r.removed} ${tt('removed')}`);
    if (r.files) parts.push(`${r.files} ${tt('files')}`);
    if (r.conflicts) parts.push(`${r.conflicts} ${tt('conflicts')}`);
    return '✅ ' + tt('done') + ' — ' + (parts.join(', ') || tt('nochange'));
  }

  const errText = e => { const k = String(e && e.message || e); return TXT.tr[k] ? tt(k) : k; };

  /* ---------------- kayıtlı eşleşmeler ---------------- */

  function meta() { try { return Object.assign({ pairs: [], auto: true }, A.loadMeta() || {}); } catch (e) { return { pairs: [], auto: true }; } }
  function saveMeta(m) { A.saveMeta(m); }

  /** Uygulama açılınca / öne gelince sessizce dener (yalnızca kayıtlı adresler, hızlı). */
  async function autoTry() {
    if (!A || isDesk() || !has('lanHttp') || running) return;
    const m = meta();
    if (!m.auto || !m.pairs.length) return;
    if (m.lastAuto && Date.now() - m.lastAuto < 90000) return;
    m.lastAuto = Date.now(); saveMeta(m);
    for (const p of m.pairs) {
      try { const r = await connect({ app: p.app, hosts: p.hosts, port: p.port, key: p.key, name: p.name }, { quiet: true }); if (r) { if (r.added || r.updated || r.removed || r.files) toast('📶 ' + repText(r)); A.refresh && A.refresh(); return; } }
      catch (e) { /* sessiz */ }
    }
  }

  /* ---------------- QR ---------------- */

  function qrSvg(text) {
    const q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
  }

  function decodeImage(img) {
    const c = document.createElement('canvas');
    const sc = Math.min(1, 1400 / Math.max(img.naturalWidth || img.videoWidth || 1, img.naturalHeight || img.videoHeight || 1));
    c.width = Math.round((img.naturalWidth || img.videoWidth) * sc);
    c.height = Math.round((img.naturalHeight || img.videoHeight) * sc);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height);
    const r = window.jsQR(d.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
    return r ? r.data : '';
  }

  /** Kamera / dosya seçici ile resim alır (uygulamaya özel yol verilmemişse). */
  function pickImage() {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
      inp.style.display = 'none';
      inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); resolve(f ? URL.createObjectURL(f) : ''); };
      document.body.appendChild(inp);
      inp.click();
    });
  }

  /** Canlı kamera ile okur; açılamazsa fotoğraf çekerek okur. */
  function scan() {
    return new Promise((resolve, reject) => {
      const box = document.createElement('div');
      box.className = 'lanx-scan';
      box.innerHTML = `<video playsinline muted></video><div class="lanx-frame"></div>
        <p>${escH(tt('scan_hint'))}</p><div class="lanx-row"><button class="lanx-btn" data-x="photo">📷 ${escH(tt('photo'))}</button><button class="lanx-btn" data-x="close">✕ ${escH(tt('close'))}</button></div>`;
      document.body.appendChild(box);
      const video = box.querySelector('video');
      let stream = null, done = false;
      const end = (v, err) => {
        if (done) return; done = true;
        if (stream) stream.getTracks().forEach(t => t.stop());
        box.remove();
        if (err) reject(err); else resolve(v);
      };
      const fromPhoto = async () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
        try {
          const url = A.capturePhoto ? await A.capturePhoto() : await pickImage();
          if (!url) return end('');
          const img = new Image();
          img.onload = () => { const v = decodeImage(img); A.capturedDone && A.capturedDone(); v ? end(v) : end(null, new Error('e_qr')); };
          img.onerror = () => end(null, new Error('e_qr'));
          img.src = url;
        } catch (e) { end(null, new Error('e_qr')); }
      };
      box.addEventListener('click', e => {
        const x = e.target.closest('[data-x]');
        if (!x) return;
        if (x.dataset.x === 'close') end('');
        if (x.dataset.x === 'photo') fromPhoto();
      });
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fromPhoto(); return; }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }).then(s => {
        stream = s;
        video.srcObject = s;
        video.play().catch(() => {});
        const tick = () => {
          if (done) return;
          if (video.readyState >= 2 && video.videoWidth) {
            const v = decodeImage(video);
            if (v) return end(v);
          }
          setTimeout(tick, 180);
        };
        tick();
      }).catch(() => { toast(tt('e_cam')); fromPhoto(); });
    });
  }

  /* ---------------- ekran ---------------- */

  function css() {
    if (document.getElementById('lanx-css')) return;
    const st = document.createElement('style');
    st.id = 'lanx-css';
    st.textContent = `
.lanx-back{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:12px}
.lanx{background:var(--card,#fff);color:var(--text,#222);border-radius:16px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.3);font:inherit}
.lanx h3{margin:0 0 10px;font-size:1.15em;display:flex;align-items:center;gap:8px}.lanx h3 .x{margin-inline-start:auto}
.lanx h4{margin:16px 0 6px;font-size:1em}.lanx p{margin:6px 0;line-height:1.45}.lanx .mut{opacity:.7;font-size:.9em}
.lanx-btn{border:1px solid rgba(0,0,0,.15);background:var(--btn,#f3f4f1);color:inherit;border-radius:10px;padding:10px 14px;font:inherit;cursor:pointer}
.lanx-btn.pri{background:var(--accent,#2f7d5b);color:#fff;border-color:transparent}.lanx-btn.wide{width:100%;margin:6px 0}
.lanx-btn.sm{padding:6px 10px;font-size:.9em}.lanx-btn.dan{color:#b3261e}
.lanx-qr{background:#fff;border-radius:12px;padding:10px;margin:8px auto;width:260px;max-width:80%}.lanx-qr svg{display:block;width:100%;height:auto}
.lanx-code{text-align:center;font-family:monospace;font-size:1.05em;user-select:all;direction:ltr;background:rgba(0,0,0,.05);border-radius:8px;padding:8px;margin:6px 0}
.lanx-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.lanx-row input{flex:1;min-width:150px;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.2);font:inherit;direction:ltr}
.lanx-pair{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.08)}.lanx-pair b{flex:1}
.lanx-st{margin:10px 0;padding:10px;border-radius:10px;background:rgba(0,0,0,.05);white-space:pre-wrap}.lanx-st.err{background:#fde8e6;color:#8c1d13}.lanx-st.ok{background:#e5f4ea;color:#1d5e36}
.lanx-scan{position:fixed;inset:0;background:#000;z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center}
.lanx-scan video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lanx-frame{position:relative;width:64vmin;height:64vmin;border:3px solid #4fd18b;border-radius:16px;box-shadow:0 0 0 2000px rgba(0,0,0,.35)}
.lanx-scan p,.lanx-scan .lanx-row{position:relative;margin-top:16px}.lanx-scan .lanx-btn{background:rgba(255,255,255,.9);color:#111}
.lanx-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#222;color:#fff;padding:10px 16px;border-radius:20px;z-index:9600;max-width:90vw;font-size:.95em}
.lanx label{display:flex;flex-direction:row;gap:8px;align-items:center;justify-content:flex-start;margin:10px 0;text-align:start;width:auto}.lanx label input{width:auto;flex:none;margin:0}`;
    document.head.appendChild(st);
  }

  function toast(s) {
    css();
    const el = document.createElement('div');
    el.className = 'lanx-toast';
    el.textContent = s;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  let dlg = null;
  async function open() {
    css();
    close();
    dlg = document.createElement('div');
    dlg.className = 'lanx-back';
    dlg.dir = (A.lang && A.lang()) === 'ar' ? 'rtl' : 'ltr';
    dlg.innerHTML = `<div class="lanx"><h3>📶 ${escH(tt('title'))}<button class="lanx-btn sm x" data-x="close">✕</button></h3><div class="lanx-body"></div><div class="lanx-st" hidden></div></div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('mousedown', e => { if (e.target === dlg) close(); });
    await paint();
  }

  function close() { if (dlg) { dlg.remove(); dlg = null; } }

  function status(text, cls) {
    if (!dlg) { if (cls) toast(text); return; }
    const el = dlg.querySelector('.lanx-st');
    el.hidden = !text;
    el.className = 'lanx-st' + (cls ? ' ' + cls : '');
    el.textContent = text || '';
  }

  function pairsHtml() {
    const m = meta();
    const list = m.pairs.map((p, i) => `<div class="lanx-pair"><span>${isDesk() ? '🖥️' : '💻'}</span><b>${escH(p.name || p.hosts[0])}<br><span class="mut">${p.last ? escH(tt('last')) + ': ' + new Date(p.last).toLocaleString(locTag()) : ''}</span></b>
      <button class="lanx-btn sm pri" data-x="sync" data-i="${i}">🔄 ${escH(tt('sync'))}</button><button class="lanx-btn sm dan" data-x="forget" data-i="${i}">✕</button></div>`).join('');
    return `<h4>${escH(tt('paired'))}</h4>${list || `<p class="mut">${escH(tt('none'))}</p>`}
      <label><input type="checkbox" data-x="auto" ${m.auto ? 'checked' : ''}> ${escH(tt('auto'))}</label>`;
  }

  async function paint() {
    if (!dlg) return;
    const body = dlg.querySelector('.lanx-body');
    if (!has('lanHttp')) { body.innerHTML = `<p>${escH(tt('e_old'))}</p>`; return; }
    let html = '';
    if (isDesk()) {
      const info = JSON.parse(nat().lanInfo());
      if (info.on) {
        const payload = JSON.stringify({ t: 'lan1', a: A.app, h: info.ips, p: info.port, k: info.key, n: A.deviceName ? A.deviceName() : info.name });
        html += `<h4>${escH(tt('this_pc'))}</h4><p>${escH(tt('desk_on'))}</p><div class="lanx-qr">${qrSvg(payload)}</div>
          <div class="lanx-code">${escH((info.ips[0] || '?') + ':' + info.port + '-' + info.key)}</div>
          ${info.ips.length > 1 ? `<p class="mut" style="text-align:center;direction:ltr">${escH(info.ips.join('  ·  '))}</p>` : ''}
          <div class="lanx-row"><button class="lanx-btn sm" data-x="reset">♻️ ${escH(tt('reset'))}</button><button class="lanx-btn sm dan" data-x="stop">⏻ ${escH(tt('stop'))}</button></div>`;
      } else {
        html += `<p>${escH(tt('desk_off'))}</p><button class="lanx-btn pri wide" data-x="serve">📶 ${escH(tt('open'))}</button>`;
      }
      html += `<h4>${escH(tt('other'))}</h4><div class="lanx-row"><input data-x="code" placeholder="${escH(tt('manual_ph'))}"><button class="lanx-btn pri" data-x="go">${escH(tt('connect'))}</button></div>`;
      if (meta().pairs.length) html += pairsHtml();
    } else {
      html += pairsHtml();
      html += `<button class="lanx-btn pri wide" data-x="scan">📷 ${escH(tt('scan'))}</button>
        <h4>${escH(tt('manual'))}</h4><div class="lanx-row"><input data-x="code" placeholder="${escH(tt('manual_ph'))}"><button class="lanx-btn" data-x="go">${escH(tt('connect'))}</button></div>`;
    }
    html += `<p class="mut">💡 ${escH(tt('tip'))}</p>`;
    body.innerHTML = html;
  }

  async function run(t) {
    try {
      const rep = await connect(t, { step: s => status('⏳ ' + s) });
      status(repText(rep), 'ok');
      A.refresh && A.refresh();
      await paint();
    } catch (e) {
      status('⚠️ ' + (String(e.message) === 'busy' ? tt('busy') : errText(e)), 'err');
    }
  }

  async function onClick(e) {
    const x = e.target.closest('[data-x]');
    if (!x) return;
    const m = meta();
    switch (x.dataset.x) {
      case 'close': close(); break;
      case 'serve': { const r = await call('lanServe'); if (!r.ok) status('⚠️ ' + (r.error || 'port'), 'err'); await paint(); break; }
      case 'stop': await call('lanStop'); await paint(); break;
      case 'reset': if (confirm(tt('reset_q'))) { await call('lanResetKey'); await paint(); } break;
      case 'scan': {
        try {
          const text = await scan();
          if (!text) break;
          const t = parseTarget(text);
          if (!t) { status('⚠️ ' + tt('e_qr'), 'err'); break; }
          await run(t);
        } catch (err) { status('⚠️ ' + errText(err), 'err'); }
        break;
      }
      case 'go': {
        const t = parseTarget(dlg.querySelector('input[data-x="code"]').value);
        if (!t) { status('⚠️ ' + tt('e_qr'), 'err'); break; }
        await run(t);
        break;
      }
      case 'sync': { const p = m.pairs[+x.dataset.i]; if (p) await run({ app: p.app, hosts: p.hosts, port: p.port, key: p.key, name: p.name }); break; }
      case 'forget': m.pairs.splice(+x.dataset.i, 1); saveMeta(m); await paint(); break;
      case 'auto': m.auto = x.checked; saveMeta(m); break;
    }
  }

  function init(adapter) {
    A = adapter;
    if (typeof nat().onLanReq === 'function') nat().onLanReq((rid, body) => window.__lanReq && window.__lanReq(rid, body));
    window.__lanReq = async (rid, body) => {
      let r;
      try { r = await serverHandle(body); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      try { nat().lanReply(rid, JSON.stringify(r)); } catch (e) { /* */ }
    };
  }

  window.LanCore = { init, open, close, autoTry, merge, canon, parseTarget, available: () => !!(A && has('lanHttp')), busy: () => running };
})();
