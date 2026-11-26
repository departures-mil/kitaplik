package com.kitaplik.uygulama;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import com.departuresmil.ortak.ApkPatchInstaller;
import com.departuresmil.ortak.FcDelta;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * window.AndroidBridge — ortak çekirdeğin Android sözleşmesi (web/js/host.js):
 *   appVersion, moveTaskToBack, openExternal, toggleFullscreen, notify (Asistan Agent),
 *   updateBegin / updateChunk / updateFinish (çekirdek sözleşmesi: JS'ten gelen yama ya da tam APK baytları),
 *   apkUpdate(planJson) (YEREL EK: indirme + yama + kurulum yerelde, ortak ApkPatchInstaller ile:
 *     kurulu APK (applicationInfo.sourceDir) + FCD1 yama → yeni APK; yama yoksa/başarısızsa otomatik tam APK).
 * Olaylar JS'e window.__fcApk({type:'progress'|'patchFailed'|'installing'|'done'|'error', …}) ile gider.
 * Tüm sürümler aynı anahtarla imzalanır (CI: ANDROID_KEYSTORE_* secret'ları); aksi halde Android kurulumu reddeder.
 */
final class FcBridge {
    static final String AUTHORITY_SUFFIX = ".guncelleme";   // UpdateFileProvider (AndroidManifest.xml)
    private final MainActivity a;
    private File incoming = null;
    private FileOutputStream incomingOut = null;
    private String incomingKind = "";
    private JSONObject incomingMeta = null;
    private static volatile boolean busy = false;

    FcBridge(MainActivity a) { this.a = a; }

    private ApkPatchInstaller installer() {
        return new ApkPatchInstaller(a, a.getPackageName() + AUTHORITY_SUFFIX);
    }
    private SharedPreferences prefs() { return a.getSharedPreferences("fc_guncelleme", MainActivity.MODE_PRIVATE); }

    @JavascriptInterface
    public String appVersion() {
        try { return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
    }

    @JavascriptInterface
    public void moveTaskToBack() { a.runOnUiThread(() -> a.moveTaskToBack(true)); }

    @JavascriptInterface
    public void openExternal(String url) {
        if (url == null || !url.startsWith("https://")) return;
        a.runOnUiThread(() -> {
            try { a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
        });
    }

    @JavascriptInterface
    public void toggleFullscreen() { a.runOnUiThread(a::toggleDisplayMode); }

    @JavascriptInterface
    public void notify(String title, String body) { Reminders.show(a.getApplicationContext(), 999997, title, body); }

    // ---------- çekirdek sözleşmesi: baytlar JS'ten (base64 parçalar) ----------
    @JavascriptInterface
    public synchronized boolean updateBegin(String kind, String metaJson) {
        try {
            closeIncoming();
            incomingKind = "patch".equals(kind) ? "patch" : "full";
            incomingMeta = new JSONObject(metaJson == null ? "{}" : metaJson);
            incoming = new File(installer().updatesDir(), "patch".equals(incomingKind) ? "update.patch" : "incoming.apk");
            incomingOut = new FileOutputStream(incoming);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public synchronized boolean updateChunk(String b64) {
        try {
            incomingOut.write(Base64.decode(b64, Base64.DEFAULT));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public synchronized String updateFinish() {
        try {
            incomingOut.close();
            incomingOut = null;
            String want = incomingMeta.optString("targetSha256", "");
            File out = new File(installer().updatesDir(), "update.apk");
            if ("patch".equals(incomingKind)) {
                File installed = new File(a.getApplicationInfo().sourceDir);
                FcDelta.Header h = FcDelta.apply(installed, incoming, out, null);
                if (!want.isEmpty() && !want.equalsIgnoreCase(h.dstSha256Hex())) throw new IOException("BAD_HASH");
            } else {
                if (!want.isEmpty() && !want.equalsIgnoreCase(FcDelta.hex(FcDelta.sha256(incoming)))) throw new IOException("BAD_HASH");
                if (out.exists()) out.delete();
                if (!incoming.renameTo(out)) throw new IOException("MOVE_FAILED");
            }
            installer().verifyApk(out);
            installOnUi(out);
            return "{\"ok\":true}";
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}";
        } finally {
            if (incoming != null && incoming.getName().equals("update.patch")) incoming.delete();
            closeIncoming();
        }
    }

    private void closeIncoming() {
        if (incomingOut != null) try { incomingOut.close(); } catch (IOException ignored) { }
        incomingOut = null;
    }

    // ---------- YEREL EK: yerel indirme + ApkPatchInstaller ----------
    @JavascriptInterface
    public void apkUpdate(String planJson) {
        if (busy) { emit("{\"type\":\"error\",\"error\":\"BUSY\"}"); return; }
        busy = true;
        new Thread(() -> {
            try {
                JSONObject p = new JSONObject(planJson);
                JSONObject full = p.getJSONObject("full");
                if (!full.optString("file", "").toLowerCase(java.util.Locale.ROOT).endsWith(".apk")) throw new IOException("NOT_APK");
                JSONObject patch = p.optJSONObject("patch");
                ApkPatchInstaller up = installer();
                File apk = up.obtainApk(full.getString("url"), full.getString("sha256"), full.optLong("size", 0),
                        patch != null ? patch.optString("url", null) : null,
                        patch != null ? patch.optString("sha256", null) : null,
                        patch != null ? patch.optLong("size", 0) : 0,
                        new ApkPatchInstaller.Listener() {
                            @Override
                            public void onProgress(boolean patchMode, long done, long total, double bps) {
                                emit("{\"type\":\"progress\",\"patch\":" + patchMode + ",\"done\":" + done + ",\"total\":" + total + "}");
                            }

                            @Override
                            public void onPatchFailed(Exception e) {
                                emit("{\"type\":\"patchFailed\",\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
                            }
                        });
                emit("{\"type\":\"installing\"}");
                installOnUi(apk);
                emit("{\"type\":\"done\",\"result\":\"done\"}");
            } catch (Exception e) {
                emit("{\"type\":\"error\",\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
            } finally {
                busy = false;
            }
        }).start();
    }

    /** Paket yükleyiciyi açar; "bilinmeyen kaynaklar" izni yoksa ayar ekranı açılır ve geri dönülünce (onResume) yeniden denenir. */
    private void installOnUi(File apk) {
        a.runOnUiThread(() -> {
            boolean ok = installer().install(apk);
            prefs().edit().putBoolean("installPending", !ok).apply();
        });
    }

    /** MainActivity.onResume: izin verildiyse bekleyen kurulumu sürdür. */
    void resumeInstall() {
        if (!prefs().getBoolean("installPending", false)) return;
        File apk = new File(installer().updatesDir(), "update.apk");
        if (!apk.exists()) { prefs().edit().putBoolean("installPending", false).apply(); return; }
        if (android.os.Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) return;
        try { installer().verifyApk(apk); } catch (IOException e) { apk.delete(); prefs().edit().putBoolean("installPending", false).apply(); return; }
        installOnUi(apk);
    }

    /** Açılışta: önceki güncelleme dosyalarını sil (kurulumdan sonra yeni sürüm açıldığında). */
    void cleanupIfUpdated() {
        String v = appVersion();
        if (!v.equals(prefs().getString("lastVersion", ""))) {
            if (!busy) installer().cleanup();
            prefs().edit().putString("lastVersion", v).putBoolean("installPending", false).apply();
        }
    }

    private void emit(String json) { a.js("window.__fcApk && window.__fcApk(" + json + ")"); }
}
