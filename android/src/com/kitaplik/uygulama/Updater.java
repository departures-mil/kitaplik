package com.kitaplik.uygulama;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Iterator;
import java.util.zip.GZIPInputStream;

/**
 * Otomatik güncelleme. Güncellemeler GitHub deposundan gelir (departures-mil/kitaplik):
 *
 *   guncelleme/web.json       {version, file, bytes, sha256, signature, notes}
 *   guncelleme/android2.json  {version, versionCode, file, bytes, sha256, signature, notes}
 *
 * "web" paketi arayüzü (index.html, app.js, style.css…) anında günceller: indirilir,
 * imzası doğrulanır, "Güncelle"ye basınca sayfa yeni sürümle yeniden yüklenir.
 * "android2" paketi uygulama kabuğunu (APK) günceller; Android'in kurulum ekranı açılır.
 * Her paket geliştiricideki özel anahtarla imzalanır; aşağıdaki açık anahtarla
 * doğrulanmayan paket kurulmaz.
 */
public final class Updater {
    private static final String PUBLIC_KEY =
            "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENsqFb/1qwh7LQ2QlrVJzQAAKU0dD"
            + "2fjpVPn6qN9T8j/2lxWuoOLlaFa0wN01NGYsLoSZOcHhrjBzcHIqkBU1pA==";

    public interface Listener {
        void onStatus(String statusJson);
    }

    enum Mode { STARTUP, BACKGROUND, MANUAL }

    private static volatile boolean busy = false;
    private static volatile String status = "{\"state\":\"idle\",\"text\":\"\"}";

    private Updater() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("guncelleme", Context.MODE_PRIVATE);
    }

    // ---------- sürüm bilgisi ----------
    static long currentCode(Context c) {
        try {
            PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    static String currentName(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "0";
        }
    }

    static boolean newer(String a, String b) {
        String[] x = String.valueOf(a).split("\\.");
        String[] y = String.valueOf(b).split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? num(x[i]) : 0;
            int q = i < y.length ? num(y[i]) : 0;
            if (p != q) return p > q;
        }
        return false;
    }

    private static int num(String s) {
        try {
            return Integer.parseInt(s.replaceAll("[^0-9]", ""));
        } catch (Exception e) {
            return 0;
        }
    }

    private static File webRoot(Context c) {
        return new File(c.getFilesDir(), "web");
    }

    /** Etkin (uygulanmış) web güncellemesinin klasörü; yoksa ya da APK'daki sürümden eskiyse null. */
    static File activeWebDir(Context c) {
        String v = prefs(c).getString("activeWeb", "");
        if (v.isEmpty() || !newer(v, currentName(c))) return null;
        File d = new File(webRoot(c), v);
        return new File(d, "index.html").isFile() ? d : null;
    }

    static String runningWeb(Context c) {
        File d = activeWebDir(c);
        return d != null ? d.getName() : currentName(c);
    }

    private static String readyWeb(Context c) {
        String v = prefs(c).getString("readyWeb", "");
        if (v.isEmpty() || !newer(v, runningWeb(c))) return null;
        return new File(new File(webRoot(c), v), "index.html").isFile() ? v : null;
    }

    static File apkFile(Context c, String version) {
        File d = new File(c.getCacheDir(), "guncelleme");
        d.mkdirs();
        return new File(d, "Kitaplik-" + version.replaceAll("[^0-9.]", "") + ".apk");
    }

    private static String readyApk(Context c) {
        String v = prefs(c).getString("readyApk", "");
        long code = prefs(c).getLong("readyApkCode", 0);
        if (v.isEmpty() || code <= currentCode(c)) return null;
        return apkFile(c, v).exists() ? v : null;
    }

    // ---------- durum ----------
    private static void set(Context c, Listener l, String state, String text, String version, String kind) {
        set(c, l, state, text, version, kind, null);
    }

    private static void set(Context c, Listener l, String state, String text, String version, String kind,
                            JSONObject extra) {
        try {
            JSONObject o = extra != null ? new JSONObject(extra.toString()) : new JSONObject();
            o.put("state", state);
            o.put("text", text);
            if (version != null) o.put("version", version);
            if (kind != null) o.put("kind", kind);
            status = o.toString();
        } catch (Exception ignored) {
        }
        if (l != null) l.onStatus(status);
    }

    static String info(Context c) {
        try {
            JSONObject o = new JSONObject();
            o.put("auto", prefs(c).getBoolean("auto", true));
            o.put("running", runningWeb(c));
            o.put("apk", currentName(c));
            o.put("status", new JSONObject(status));
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    static void setSource(Context c, String src) {
        prefs(c).edit().putString("source", src == null ? "" : src).apply();
    }

    static void setAuto(Context c, boolean on) {
        prefs(c).edit().putBoolean("auto", on).apply();
    }

    // ---------- GitHub ----------
    // Güncellemeler GitHub deposundan gelir (Firebase yalnızca canlı kayıt eşitlemesi içindir):
    //   guncelleme/{kanal}.json  {version, [versionCode], file, sha256, signature, bytes, notes}
    //   guncelleme/{file}        imzalı paket
    private static final String GITHUB_RAW = "https://raw.githubusercontent.com/departures-mil/kitaplik/main/guncelleme/";

    interface Prog { void on(long done, long total); }

    /** URL'yi indirir; 404 ise null. p != null ise ilerleme bildirir. */
    private static byte[] httpGet(String url, long expected, Prog p) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            int code = c.getResponseCode();
            if (code == 404) return null;
            if (code != 200) throw new Exception("Sunucu yanıtı " + code);
            long total = expected > 0 ? expected : Math.max(c.getContentLength(), 0);
            InputStream in = c.getInputStream();
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[32768];
            int n;
            long done = 0;
            while ((n = in.read(buf)) > 0) {
                b.write(buf, 0, n);
                done += n;
                if (p != null) p.on(done, Math.max(total, done));
            }
            in.close();
            if (p != null) p.on(done, done);
            return b.toByteArray();
        } catch (java.net.UnknownHostException e) {
            throw new Exception("İnternet bağlantısı yok");
        } finally {
            c.disconnect();
        }
    }

    private static JSONObject getMeta(String channel) throws Exception {
        byte[] b = httpGet(GITHUB_RAW + channel + ".json?t=" + System.currentTimeMillis(), 0, null);
        return b == null ? null : new JSONObject(new String(b, "UTF-8"));
    }

    private static String field(JSONObject meta, String name) {
        return meta == null ? "" : meta.optString(name, "");
    }

    private static String mb(long b) {
        return String.format(new java.util.Locale("tr"), "%.1f", b / 1048576.0);
    }

    /** Paketi indirir (yüzde, MB, kalan, hız gösterir), SHA-256 ve imzayı doğrular. */
    private static byte[] download(Context ctx, Listener l, String channel, String version,
                                   JSONObject meta, String kind) throws Exception {
        String file = field(meta, "file");
        if (file.isEmpty()) throw new Exception("Güncelleme eksik yayınlanmış");
        long expected = 0;
        try { expected = Long.parseLong("0" + field(meta, "bytes")); } catch (Exception ignored) {}
        final long t0 = System.currentTimeMillis();
        final long[] last = {0};
        byte[] data = httpGet(GITHUB_RAW + file, expected, (done, total) -> {
            long now = System.currentTimeMillis();
            if (now - last[0] < 300 && done < total) return;
            last[0] = now;
            double sec = Math.max((now - t0) / 1000.0, 0.001);
            double hiz = done / sec;
            String spd = hiz < 1048576 ? Math.round(hiz / 1024) + " KB/sn" : mb((long) hiz) + " MB/sn";
            int pct = total > 0 ? (int) (done * 100 / total) : 0;
            long kalanSn = hiz > 0 ? (long) Math.ceil((total - done) / hiz) : 0;
            String eta = kalanSn <= 0 ? "" : kalanSn < 60 ? kalanSn + " sn" : (kalanSn / 60) + " dk " + (kalanSn % 60) + " sn";
            try {
                JSONObject x = new JSONObject();
                x.put("pct", pct);
                x.put("doneMB", mb(done));
                x.put("totalMB", mb(total));
                x.put("leftMB", mb(total - done));
                x.put("speed", spd);
                x.put("eta", eta);
                set(ctx, l, "downloading", "Sürüm " + version + " indiriliyor: %" + pct + " — " + mb(done) + " / "
                        + mb(total) + " MB indi, kalan " + mb(total - done) + " MB, hız " + spd, version, kind, x);
            } catch (Exception ignored) {
            }
        });
        if (data == null) throw new Exception("Güncelleme eksik yayınlanmış");
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        StringBuilder hex = new StringBuilder();
        for (byte x : md.digest(data)) hex.append(String.format("%02x", x));
        if (!hex.toString().equals(field(meta, "sha256"))) throw new Exception("Güncelleme paketi bozuk indi");
        PublicKey key = KeyFactory.getInstance("EC").generatePublic(
                new X509EncodedKeySpec(Base64.decode(PUBLIC_KEY, Base64.DEFAULT)));
        Signature s = Signature.getInstance("SHA256withECDSA");
        s.initVerify(key);
        s.update(data);
        if (!s.verify(Base64.decode(field(meta, "signature"), Base64.DEFAULT))) {
            throw new Exception("Güncelleme imzası doğrulanamadı, kurulmadı");
        }
        return data;
    }

    private static void installWeb(Context c, String version, byte[] gz) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        try (GZIPInputStream in = new GZIPInputStream(new ByteArrayInputStream(gz))) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        }
        JSONObject pkg = new JSONObject(new String(b.toByteArray(), "UTF-8"));
        JSONObject files = pkg.getJSONObject("files");
        if (!version.equals(pkg.optString("version")) || !files.has("index.html")) {
            throw new Exception("Güncelleme paketi geçersiz");
        }
        File root = webRoot(c);
        File tmp = new File(root, version + ".tmp");
        File target = new File(root, version);
        deleteTree(tmp);
        String base = tmp.getCanonicalPath() + File.separator;
        for (Iterator<String> it = files.keys(); it.hasNext(); ) {
            String rel = it.next();
            File out = new File(tmp, rel);
            if (!out.getCanonicalPath().startsWith(base)) throw new Exception("Güncelleme paketi geçersiz");
            out.getParentFile().mkdirs();
            try (FileOutputStream o = new FileOutputStream(out)) {
                o.write(Base64.decode(files.getString(rel), Base64.DEFAULT));
            }
        }
        deleteTree(target);
        if (!tmp.renameTo(target)) throw new Exception("Güncelleme kaydedilemedi");
        prefs(c).edit().putString("readyWeb", version).apply();
    }

    private static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] k = f.listFiles();
        if (k != null) for (File x : k) deleteTree(x);
        f.delete();
    }

    // ---------- denetim ----------
    static void check(Context ctx, Listener l, Mode mode) {
        Context c = ctx.getApplicationContext();
        if (busy) return;
        if (mode == Mode.BACKGROUND
                && System.currentTimeMillis() - prefs(c).getLong("lastCheck", 0) < 30 * 60 * 1000L
                && readyApk(c) == null && readyWeb(c) == null) return;
        busy = true;
        new Thread(() -> {
            try {
                run(c, l, mode);
            } catch (Exception e) {
                set(c, l, "error", "Güncelleme alınamadı: " + e.getMessage(), null, null);
            } finally {
                busy = false;
            }
        }).start();
    }

    private static void ready(Context c, Listener l, Mode mode, String version, String kind) {
        String text = "apk".equals(kind)
                ? "Sürüm " + version + " indirildi. Kurmak için Güncelle'ye dokunun."
                : "Sürüm " + version + " hazır. Güncelle'ye dokunun, hemen yeni sürüme geçer.";
        set(c, l, "ready", text, version, kind);
        if (mode != Mode.MANUAL) {
            Reminders.show(c, 999998, "Kitaplık güncellemesi hazır",
                    "Sürüm " + version + " hazır. Uygulamayı açıp Güncelle'ye dokunun.");
        }
    }

    private static void run(Context c, Listener l, Mode mode) throws Exception {
        String apk = readyApk(c);
        if (apk != null) { ready(c, l, mode, apk, "apk"); return; }
        boolean auto = prefs(c).getBoolean("auto", true);
        if (mode == Mode.MANUAL) set(c, l, "checking", "Güncelleme denetleniyor…", null, null);

        // 1) Uygulama kabuğu (APK)
        JSONObject am = getMeta("android2");
        prefs(c).edit().putLong("lastCheck", System.currentTimeMillis()).apply();
        long code = 0;
        try { code = Long.parseLong("0" + field(am, "versionCode")); } catch (Exception ignored) {}
        String av = field(am, "version");
        if (am != null && !av.isEmpty() && code > currentCode(c)) {
            if (!auto && mode != Mode.MANUAL) {
                set(c, l, "available", "Yeni sürüm var: " + av + ". İndirmek için Güncellemeleri denetle'ye dokunun.", av, "apk");
                if (mode == Mode.STARTUP) Reminders.show(c, 999998, "Kitaplık güncellemesi var", "Sürüm " + av + " yayınlandı.");
                return;
            }
            byte[] data = download(c, l, "android2", av, am, "apk");
            File f = apkFile(c, av);
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
            PackageInfo pi = c.getPackageManager().getPackageArchiveInfo(f.getAbsolutePath(), 0);
            if (pi == null || !c.getPackageName().equals(pi.packageName)) {
                f.delete();
                throw new Exception("Güncelleme paketi geçersiz");
            }
            File[] old = f.getParentFile().listFiles();
            if (old != null) for (File x : old) if (!x.equals(f)) x.delete();
            prefs(c).edit().putString("readyApk", av).putLong("readyApkCode", code).apply();
            ready(c, l, mode, av, "apk");
            return;
        }

        // 2) Arayüz (web) — anında güncelleme
        String w = readyWeb(c);
        JSONObject wm = getMeta("web");
        String wv = field(wm, "version");
        if (wm != null && !wv.isEmpty() && newer(wv, runningWeb(c))) {
            if (wv.equals(w)) { ready(c, l, mode, wv, "web"); return; }
            if (!auto && mode != Mode.MANUAL) {
                set(c, l, "available", "Yeni sürüm var: " + wv + ". İndirmek için Güncellemeleri denetle'ye dokunun.", wv, "web");
                if (mode == Mode.STARTUP) Reminders.show(c, 999998, "Kitaplık güncellemesi var", "Sürüm " + wv + " yayınlandı.");
                return;
            }
            byte[] gz = download(c, l, "web", wv, wm, "web");
            installWeb(c, wv, gz);
            ready(c, l, mode, wv, "web");
            return;
        }
        if (w != null) { ready(c, l, mode, w, "web"); return; }
        String t = new java.text.SimpleDateFormat("HH:mm", new java.util.Locale("tr")).format(new java.util.Date());
        set(c, l, "uptodate", "Program güncel (son denetim " + t + ").", null, null);
    }

    // ---------- uygulama ----------
    /** "Güncelle" düğmesi. */
    static void apply(Activity a, Listener l) {
        if (readyApk(a) != null) { install(a); return; }
        String w = readyWeb(a);
        if (w != null) {
            prefs(a).edit().putString("activeWeb", w).remove("readyWeb").apply();
            File[] dirs = webRoot(a).listFiles();
            if (dirs != null) for (File d : dirs) if (!d.getName().equals(w)) deleteTree(d);
            set(a, l, "uptodate", "Sürüm " + w + " kullanılıyor.", w, "web");
            if (a instanceof MainActivity) ((MainActivity) a).reloadApp();
            return;
        }
        check(a, l, Mode.MANUAL);
    }

    static void install(Activity a) {
        String v = readyApk(a);
        if (v == null) return;
        if (!a.getPackageManager().canRequestPackageInstalls()) {
            prefs(a).edit().putBoolean("installAfterPermission", true).apply();
            a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + a.getPackageName())));
            return;
        }
        prefs(a).edit().putBoolean("installAfterPermission", false).apply();
        Uri u = Uri.parse("content://" + a.getPackageName() + ".guncelleme/" + apkFile(a, v).getName());
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(u, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        a.startActivity(i);
    }

    static void resumeInstall(Activity a) {
        if (prefs(a).getBoolean("installAfterPermission", false) && a.getPackageManager().canRequestPackageInstalls()) {
            install(a);
        }
    }
}
