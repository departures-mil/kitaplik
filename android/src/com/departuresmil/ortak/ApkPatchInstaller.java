package com.departuresmil.ortak;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Android güncelleme yardımcısı: kurulu APK + FCD1 yama → yeni APK → paket yükleyici.
 * Yama yoksa ya da herhangi bir adım başarısız olursa otomatik olarak tam APK indirilir.
 *
 * ARKA PLAN İŞ PARÇACIĞINDA çağırın (ağ + disk). install() ana iş parçacığından çağrılabilir.
 * Ayrıntılar: ApkUpdater-notes.md
 */
public final class ApkPatchInstaller {

    /** İndirme/yama ilerlemesi. patchMode=true iken "yalnızca değişen kısımlar" gösterin. */
    public interface Listener {
        void onProgress(boolean patchMode, long done, long total, double bytesPerSec);
        /** Yama denendi ama başarısız oldu, tam dosyaya geçiliyor (günlük/telemetri için). */
        void onPatchFailed(Exception e);
    }

    private final Context ctx;
    private final String authority; // ör. context.getPackageName() + ".fileprovider"

    public ApkPatchInstaller(Context ctx, String authority) {
        this.ctx = ctx.getApplicationContext();
        this.authority = authority;
    }

    /** Güncelleme dosyalarının tutulduğu klasör (file_paths.xml: <cache-path name="updates" path="updates/"/>). */
    public File updatesDir() {
        File d = new File(ctx.getCacheDir(), "updates");
        if (!d.isDirectory()) d.mkdirs();
        return d;
    }

    /**
     * Yeni APK'yı hazırlar. patchUrl null olabilir. Başarılıysa SHA-256'sı fullSha256 olan dosyayı döndürür.
     *
     * @param fullUrl    latest.json → assets.android.file için indirme adresi
     * @param fullSha256 latest.json → assets.android.sha256 (hex)
     * @param fullSize   latest.json → assets.android.size
     * @param patchUrl   latest.json → assets.android.patches[kuruluSürüm].file adresi (yoksa null)
     * @param patchSha256 patches[kuruluSürüm].sha256 (yama dosyasının kendi özeti)
     * @param patchSize  patches[kuruluSürüm].size
     */
    public File obtainApk(String fullUrl, String fullSha256, long fullSize,
                          String patchUrl, String patchSha256, long patchSize,
                          Listener listener) throws IOException {
        // YEREL DÜZELTME (Kitaplık 2.15.5): Android'e yalnız .apk indirilir (eskiden 2.15.3 altı sürümlerde Windows kurulum
        // dosyası seçiliyordu → "There's a problem with the app file").
        String fullPath = fullUrl == null ? "" : Uri.parse(fullUrl).getPath();
        if (fullPath == null || !fullPath.toLowerCase(java.util.Locale.ROOT).endsWith(".apk")) throw new IOException("NOT_APK");
        File dir = updatesDir();
        File out = new File(dir, "update.apk");
        if (out.exists() && fullSha256.equalsIgnoreCase(FcDelta.hex(FcDelta.sha256(out)))) {   // önceden hazır
            try { verifyApk(out); return out; } catch (IOException e) { out.delete(); }
        }

        if (patchUrl != null && canPatch()) {
            File patch = new File(dir, "update.patch");
            try {
                download(patchUrl, patch, patchSize, true, listener);
                if (patchSha256 != null && !patchSha256.equalsIgnoreCase(FcDelta.hex(FcDelta.sha256(patch))))
                    throw new IOException("yama dosyası bozuk indi");
                File installed = new File(ctx.getApplicationInfo().sourceDir);
                FcDelta.Header h = FcDelta.apply(installed, patch, out, null);
                if (!fullSha256.equalsIgnoreCase(h.dstSha256Hex()))
                    throw new IOException("yama başka bir sürüm üretiyor");
                if (!fullSha256.equalsIgnoreCase(FcDelta.hex(FcDelta.sha256(out))))
                    throw new IOException("yamalı APK SHA-256 uyuşmuyor");
                verifyApk(out);
                return out;
            } catch (Exception e) {
                out.delete();
                if (listener != null) listener.onPatchFailed(e);
            } finally {
                patch.delete();
            }
        }

        // Tam APK'ya geri dönüş
        download(fullUrl, out, fullSize, false, listener);
        if (!fullSha256.equalsIgnoreCase(FcDelta.hex(FcDelta.sha256(out)))) {
            out.delete();
            throw new IOException("indirilen APK SHA-256 uyuşmuyor");
        }
        try {
            verifyApk(out);
        } catch (IOException e) {
            out.delete();
            throw e;
        }
        return out;
    }

    /**
     * Kurulumdan önce son denetim: dosya bir APK (ZIP) olmalı, Android onu okuyabilmeli, paket adı bu uygulamanınki ve
     * sürüm kodu kurulu olandan büyük olmalı. Aksi hâlde paket yükleyici hiç açılmaz ("problem with the app file" yerine
     * anlaşılır bir hata ve tam dosyaya geri dönüş).
     */
    public void verifyApk(File apk) throws IOException {
        if (apk == null || !apk.isFile() || apk.length() < 1024) throw new IOException("NOT_APK: dosya yok ya da çok küçük");
        byte[] m = new byte[4];
        FileInputStream in = new FileInputStream(apk);
        try {
            if (in.read(m) != 4 || m[0] != 'P' || m[1] != 'K' || m[2] != 3 || m[3] != 4) throw new IOException("NOT_APK: ZIP değil");
        } finally {
            try { in.close(); } catch (IOException ignored) { }
        }
        PackageManager pm = ctx.getPackageManager();
        PackageInfo pi = pm.getPackageArchiveInfo(apk.getPath(), 0);
        if (pi == null) throw new IOException("NOT_APK: Android dosyayı okuyamadı");
        if (!ctx.getPackageName().equals(pi.packageName)) throw new IOException("WRONG_PACKAGE: " + pi.packageName);
        try {
            PackageInfo cur = pm.getPackageInfo(ctx.getPackageName(), 0);
            long nv = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
            long cv = Build.VERSION.SDK_INT >= 28 ? cur.getLongVersionCode() : cur.versionCode;
            if (nv <= cv) throw new IOException("OLD_VERSION: " + nv + " <= " + cv);
        } catch (PackageManager.NameNotFoundException ignored) { }
    }

    /** Split APK (App Bundle) kurulumlarında tek sourceDir yeni APK'yı temsil etmez → yama kullanılamaz. */
    public boolean canPatch() {
        ApplicationInfo ai = ctx.getApplicationInfo();
        if (ai.sourceDir == null || !new File(ai.sourceDir).canRead()) return false;
        return Build.VERSION.SDK_INT < 21 || ai.splitSourceDirs == null || ai.splitSourceDirs.length == 0;
    }

    /**
     * Paket yükleyiciyi açar. Android 8+ "bilinmeyen kaynaklardan yükleme" izni yoksa önce ayarlar
     * ekranını açar ve false döndürür (kullanıcı izin verip geri dönünce tekrar çağırın).
     */
    public boolean install(File apk) {
        if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + ctx.getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(s);
            return false;
        }
        Uri uri;
        Intent i = new Intent(Intent.ACTION_VIEW);
        if (Build.VERSION.SDK_INT >= 24) {
            // YEREL DÜZELTME (Kitaplık): androidx'siz (Gradle'sız) kabuk — uygulamanın kendi ContentProvider'ı
            // content://<authority>/updates/<dosya> adresinden cacheDir/updates/<dosya> dosyasını verir.
            uri = Uri.parse("content://" + authority + "/updates/" + Uri.encode(apk.getName()));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            uri = Uri.fromFile(apk);
        }
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(i);
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    /** Eski güncelleme dosyalarını temizler (uygulama açılışında çağırın). */
    public void cleanup() {
        File[] fs = updatesDir().listFiles();
        if (fs != null) for (File f : fs) f.delete();
    }

    private void download(String url, File dest, long expectedSize, boolean patchMode, Listener l) throws IOException {
        File part = new File(dest.getPath() + ".part");
        HttpURLConnection c = null;
        InputStream in = null;
        OutputStream out = null;
        try {
            URL u = new URL(url);
            // GitHub release adresleri başka bir alana (objects.githubusercontent.com) yönlendirir;
            // https→https yönlendirmeyi HttpURLConnection kendisi izler.
            c = (HttpURLConnection) u.openConnection();
            c.setInstanceFollowRedirects(true);
            c.setConnectTimeout(20000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "ortak-cekirdek-updater");
            int code = c.getResponseCode();
            if (code != 200) throw new IOException("HTTP " + code + " " + url);
            long total = c.getContentLength() > 0 ? c.getContentLength() : expectedSize;
            in = c.getInputStream();
            out = new FileOutputStream(part);
            byte[] buf = new byte[64 * 1024];
            long done = 0, t0 = System.nanoTime(), lastReport = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                done += n;
                long now = System.nanoTime();
                if (l != null && (now - lastReport > 200_000_000L || done == total)) {
                    double secs = Math.max(1e-3, (now - t0) / 1e9);
                    l.onProgress(patchMode, done, total, done / secs);
                    lastReport = now;
                }
            }
            out.close();
            out = null;
            if (expectedSize > 0 && part.length() != expectedSize) throw new IOException("eksik indirme");
            if (dest.exists()) dest.delete();
            if (!part.renameTo(dest)) throw new IOException("taşınamadı: " + dest);
        } finally {
            if (in != null) try { in.close(); } catch (IOException ignored) { }
            if (out != null) try { out.close(); } catch (IOException ignored) { }
            if (c != null) c.disconnect();
            part.delete();
        }
    }
}
