package com.kitaplik.uygulama;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Kitaplık Android kabuğu. Arayüz, https://kitaplik.local/ adresinden sunulan web uygulamasıdır (APK içindeki assets/www;
 * kayıtlar bu kaynağın localStorage/IndexedDB'sinde — adres DEĞİŞMEMELİ).
 * 2.14.0: güncelleme ortak çekirdekle (GitHub Releases latest.json → AndroidBridge / FcBridge: kurulu APK + yama → yeni APK,
 * olmazsa tam APK). Eski "web" / "android2" kanalları (raw, ECDSA) bu sürümde okunmaz; eski arayüz güncelleme klasörü silinir.
 * github.com/departures-mil/kitaplik/releases/… istekleri (latest.json) yerelde çekilip CORS başlığıyla verilir.
 */
public class MainActivity extends Activity {
    static final String HOST = "kitaplik.local";
    private static final int REQ_FILE = 10;
    private static final int REQ_NOTIF = 11;
    private static final int REQ_CAM = 12;
    private static final int REQ_CAM_FILE = 13;
    /** Kamera izni beklenirken açılacak seçici: "cam" = doğrudan kamera, "chooser" = galeri + kamera. */
    private String pendingPick = null;
    private boolean pendingImage = false;
    private android.webkit.PermissionRequest camReq = null;

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        if (req == REQ_CAM_FILE) {
            String what = pendingPick;
            pendingPick = null;
            if (fileCallback == null || what == null) return;
            boolean ok = res.length > 0 && res[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
            if (ok && "cam".equals(what)) launchCamera();
            else {
                if (!ok) camDeniedToast();
                launchChooser(pendingImage);
            }
            return;
        }
        if (req == REQ_CAM && camReq != null) {
            if (res.length > 0 && res[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) camReq.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else camReq.deny();
            camReq = null;
        }
    }

    void lanCb(String cb, String json) {
        String js = "window.__lanCb && window.__lanCb(" + JSONObject.quote(cb) + "," + JSONObject.quote(json) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    private FcBridge fc;

    /** JS çalıştır (her iş parçacığından). */
    void js(String code) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        applyDisplayMode();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "KitaplikAndroid");
        fc = new FcBridge(this);
        web.addJavascriptInterface(fc, "AndroidBridge");
        fc.cleanupIfUpdated();
        new Thread(() -> deleteTree(new File(getFilesDir(), "web"))).start();   // ≤2.13 arayüz güncellemeleri (artık kullanılmaz)
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return githubProxy(req);
                String path = u.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.contains("..")) return notFound();
                try {
                    InputStream in = getAssets().open("www" + Uri.decode(path));
                    WebResourceResponse r = new WebResourceResponse(mime(path), "utf-8", in);
                    java.util.Map<String, String> h = new java.util.HashMap<>();
                    h.put("Cache-Control", "no-cache");
                    r.setResponseHeaders(h);
                    return r;
                } catch (Exception e) {
                    return notFound();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (HOST.equals(req.getUrl().getHost())) return false;
                openExternal(req.getUrl());
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            // Wi‑Fi eşitleme: QR kodu canlı kamerayla okumak için kamera izni
            @Override
            public void onPermissionRequest(final android.webkit.PermissionRequest req) {
                runOnUiThread(() -> {
                    boolean video = false;
                    for (String r : req.getResources()) if (android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) video = true;
                    if (!video) { req.deny(); return; }
                    if (checkSelfPermission(android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        req.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        camReq = req;
                        requestPermissions(new String[]{android.Manifest.permission.CAMERA}, REQ_CAM);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                cameraUri = null;
                boolean image = false;
                for (String t : params.getAcceptTypes()) if (t != null && t.startsWith("image")) image = true;
                pendingImage = image;
                // Manifestte CAMERA izni olduğu için, izin verilmeden kamera uygulaması açılırsa Android
                // SecurityException atar ve hiçbir şey olmaz (2.16.1'e kadarki hata). Önce izni iste.
                boolean wantCam = image && params.isCaptureEnabled();
                if (image && !camGranted()) {
                    pendingPick = wantCam ? "cam" : "chooser";
                    requestPermissions(new String[]{android.Manifest.permission.CAMERA}, REQ_CAM_FILE);
                    return true;
                }
                if (wantCam) launchCamera(); else launchChooser(image);
                return true;
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl("https://" + HOST + "/index.html");

    }

    private void camDeniedToast() {
        String l = java.util.Locale.getDefault().getLanguage();
        String m = "ar".equals(l) ? "لم يُمنح إذن الكاميرا. يمكنك منحه من إعدادات الهاتف ← التطبيقات ← Kitaplık ← الأذونات."
                : "tr".equals(l) ? "Kamera izni verilmedi. Telefon Ayarları → Uygulamalar → Kitaplık → İzinler'den açabilirsiniz."
                : "Camera permission was not granted. You can allow it in phone Settings → Apps → Kitaplık → Permissions.";
        android.widget.Toast.makeText(this, m, android.widget.Toast.LENGTH_LONG).show();
    }

    private boolean camGranted() {
        return checkSelfPermission(android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    /** Doğrudan kamera; açılamazsa galeri seçicisine düşer. */
    private void launchCamera() {
        if (fileCallback == null) return;
        try {
            startActivityForResult(cameraIntent(), REQ_FILE);
        } catch (Exception e) {
            dropCameraUri();
            launchChooser(true);
        }
    }

    /** Galeri / dosya seçici; görselde kamera izni varsa kamera da seçenek olarak eklenir. */
    private void launchChooser(boolean image) {
        if (fileCallback == null) return;
        try {
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType(image ? "image/*" : "*/*");
            Intent chooser = Intent.createChooser(pick, image ? "Görsel seç" : "Yedek dosyasını seç");
            if (image && camGranted()) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent()});
            startActivityForResult(chooser, REQ_FILE);
        } catch (Exception e) {
            dropCameraUri();
            ValueCallback<Uri[]> cb = fileCallback;
            fileCallback = null;
            if (cb != null) cb.onReceiveValue(null);
        }
    }

    private void dropCameraUri() {
        if (cameraUri != null) {
            try { getContentResolver().delete(cameraUri, null, null); } catch (Exception ignored) { }
            cameraUri = null;
        }
    }

    private Intent cameraIntent() {
        Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, "kapak_" + System.currentTimeMillis() + ".jpg");
            v.put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg");
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Kitaplik");
            cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (cameraUri != null) {
                cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            }
        }
        return cam;
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
    }

    static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".txt")) return "text/plain";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception ignored) {
        }
    }

    private SharedPreferences settings() {
        return getSharedPreferences("ayarlar", MODE_PRIVATE);
    }

    private String displayMode() {
        return "window".equals(settings().getString("displayMode", "fullscreen")) ? "window" : "fullscreen";
    }

    private void applyDisplayMode() {
        boolean full = "fullscreen".equals(displayMode());
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(!full);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if (full) c.hide(WindowInsets.Type.systemBars());
                else c.show(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(full ? 5894 : View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    /** Üst çubuktaki Tam ekran düğmesi: tam ekran ↔ normal (durum çubuğu görünür); seçim kalıcıdır. */
    void toggleDisplayMode() {
        settings().edit().putString("displayMode", "fullscreen".equals(displayMode()) ? "window" : "fullscreen").apply();
        applyDisplayMode();
    }

    private static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] k = f.listFiles();
        if (k != null) for (File x : k) deleteTree(x);
        f.delete();
    }

    /** latest.json için: github.com/departures-mil/kitaplik/releases/… GET isteğini yerelde çeker, CORS başlığı ekler. */
    private WebResourceResponse githubProxy(WebResourceRequest req) {
        Uri u = req.getUrl();
        String p = u.getPath();
        if (!"GET".equalsIgnoreCase(req.getMethod()) || !"https".equals(u.getScheme()) || !"github.com".equals(u.getHost())
                || p == null || !p.startsWith("/departures-mil/kitaplik/releases/")) return null;
        java.util.Map<String, String> h = new java.util.HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-store");
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(u.toString()).openConnection();
            c.setInstanceFollowRedirects(true);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setUseCaches(false);
            c.setRequestProperty("User-Agent", "Kitaplik-Android");
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) in = new java.io.ByteArrayInputStream(new byte[0]);
            String msg = c.getResponseMessage();
            return new WebResourceResponse(p.endsWith(".json") ? "application/json" : "application/octet-stream", "utf-8",
                    code, msg == null || msg.isEmpty() ? (code < 400 ? "OK" : "Error") : msg, h, in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 502, "Bad Gateway", h, new java.io.ByteArrayInputStream(new byte[0]));
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (res == RESULT_OK) {
            if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (data != null && data.getExtras() != null && data.getExtras().get("data") instanceof Bitmap) {
                try {
                    File f = new File(getCacheDir(), "kapak.jpg");
                    try (FileOutputStream o = new FileOutputStream(f)) {
                        ((Bitmap) data.getExtras().get("data")).compress(Bitmap.CompressFormat.JPEG, 92, o);
                    }
                    result = new Uri[]{Uri.fromFile(f)};
                } catch (Exception ignored) {
                }
            } else if (cameraUri != null) {
                result = new Uri[]{cameraUri};
            }
        }
        if (cameraUri != null && (result == null || !cameraUri.equals(result[0]))) {
            try {
                getContentResolver().delete(cameraUri, null, null);
            } catch (Exception ignored) {
            }
        }
        cameraUri = null;
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyDisplayMode();
        if (fc != null) fc.resumeInstall();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        applyDisplayMode();
    }

    /** window.KitaplikAndroid — web uygulamasının kullandığı köprü. */
    class Bridge {
        @JavascriptInterface
        public void setReminders(String json) {
            Reminders.replaceAll(getApplicationContext(), json);
        }

        @JavascriptInterface
        public void notifyNow(String title, String body) {
            Reminders.show(getApplicationContext(), 999999, title, body);
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIF));
            }
        }

        @JavascriptInterface
        public String saveFile(String name, String mime, String text) {
            try {
                byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (u == null) throw new IllegalStateException("Dosya oluşturulamadı");
                    try (OutputStream o = getContentResolver().openOutputStream(u)) {
                        o.write(bytes);
                    }
                    return "İndirilenler klasörüne kaydedildi: " + name;
                }
                File f = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name);
                try (FileOutputStream o = new FileOutputStream(f)) {
                    o.write(bytes);
                }
                return "Kaydedildi: " + f.getAbsolutePath();
            } catch (Exception e) {
                return "Kaydedilemedi: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> openExternal(Uri.parse(url)));
        }

        @JavascriptInterface
        public String getDisplayMode() {
            return displayMode();
        }

        @JavascriptInterface
        public void setDisplayMode(String m) {
            settings().edit().putString("displayMode", "window".equals(m) ? "window" : "fullscreen").apply();
            runOnUiThread(MainActivity.this::applyDisplayMode);
        }

        @JavascriptInterface
        public void postJson(int id, String url, String json) {
            new Thread(() -> {
                int status = 0;
                String text = "";
                HttpURLConnection c = null;
                try {
                    if (!url.startsWith("https://")) throw new IllegalArgumentException();
                    c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    c.setRequestMethod("POST");
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", "application/json");
                    c.setRequestProperty("Accept", "application/json");
                    try (OutputStream o = c.getOutputStream()) {
                        o.write(json.getBytes(StandardCharsets.UTF_8));
                    }
                    status = c.getResponseCode();
                    InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
                    if (in != null) {
                        ByteArrayOutputStream b = new ByteArrayOutputStream();
                        byte[] buf = new byte[4096];
                        int n;
                        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
                        in.close();
                        text = new String(b.toByteArray(), StandardCharsets.UTF_8);
                    }
                } catch (Exception ignored) {
                } finally {
                    if (c != null) c.disconnect();
                }
                String js = "window.__kitaplikHttpDone(" + id + "," + status + "," + JSONObject.quote(text) + ")";
                runOnUiThread(() -> web.evaluateJavascript(js, null));
            }).start();
        }

        // ---- Wi‑Fi ile internetsiz eşitleme ----
        @JavascriptInterface
        public void lanHttp(String cb, String method, String url, String body, int timeoutMs, String key) {
            new Thread(() -> lanCb(cb, LanSync.http(method, url, body, timeoutMs, key))).start();
        }

        @JavascriptInterface
        public void lanFind(String cb, int port, String key, String appId) {
            new Thread(() -> lanCb(cb, LanSync.find(port, key, appId))).start();
        }

        @JavascriptInterface
        public String lanIps() {
            return LanSync.ipsJson();
        }

        // ---- Güncelleme: ortak çekirdek (window.AndroidBridge → FcBridge). Eski updateInfo/checkUpdate/installUpdate kaldırıldı. ----

        @JavascriptInterface
        public String shellInfo() {
            try {
                JSONObject o = new JSONObject();
                android.content.pm.PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                o.put("apk", pi.versionName);
                o.put("apkCode", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
                o.put("web", pi.versionName);
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }
    }
}
