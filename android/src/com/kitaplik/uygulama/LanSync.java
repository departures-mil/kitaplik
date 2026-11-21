package com.kitaplik.uygulama;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Yerel ağ eşitleme — telefon tarafı (istemci). İnternet gerekmez; telefon, aynı Wi‑Fi'deki (ya da kendi
 * hotspot'una bağlı) bilgisayardaki programa bağlanır. Uygulamadan bağımsızdır: yalnızca paket adı değişir.
 * Arayüz bu sınıfı köprüdeki lanHttp / lanGetPhoto / lanPutPhoto / lanFind / lanIps ile kullanır.
 */
public final class LanSync {
    private LanSync() {}

    static String result(int status, String body) {
        try { return new JSONObject().put("status", status).put("body", body == null ? "" : body).toString(); }
        catch (Exception e) { return "{\"status\":0,\"body\":\"\"}"; }
    }

    static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[65536];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    static HttpURLConnection open(String method, String url, int timeoutMs, String key) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(Math.max(300, Math.min(timeoutMs, 8000)));
        con.setReadTimeout(Math.max(1000, timeoutMs));
        con.setUseCaches(false);
        con.setRequestMethod(method);
        con.setRequestProperty("X-Lan-Key", key == null ? "" : key);
        return con;
    }

    /** JSON istek; {status, body} döner. */
    public static String http(String method, String url, String body, int timeoutMs, String key) {
        HttpURLConnection con = null;
        try {
            con = open(method == null ? "GET" : method.toUpperCase(), url, timeoutMs <= 0 ? 60000 : timeoutMs, key);
            if (body != null && !body.isEmpty()) {
                byte[] b = body.getBytes(StandardCharsets.UTF_8);
                con.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                con.setDoOutput(true);
                con.setFixedLengthStreamingMode(b.length);
                try (OutputStream out = con.getOutputStream()) { out.write(b); }
            }
            int st = con.getResponseCode();
            InputStream in = st >= 400 ? con.getErrorStream() : con.getInputStream();
            return result(st, in == null ? "" : new String(readAll(in), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return result(0, String.valueOf(e.getMessage()));
        } finally {
            if (con != null) con.disconnect();
        }
    }

    /** Dosyayı indirir; yerelde zaten varsa dokunmaz (üstüne yazılmaz). */
    public static String getFile(String url, File f, String key) {
        if (f.isFile() && f.length() > 0) return result(200, "");
        HttpURLConnection con = null;
        File part = new File(f.getPath() + ".part");
        try {
            con = open("GET", url, 60000, key);
            int st = con.getResponseCode();
            if (st != 200) return result(st, "");
            File dir = f.getParentFile();
            if (dir != null) dir.mkdirs();
            try (InputStream in = con.getInputStream(); FileOutputStream out = new FileOutputStream(part)) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            if (part.length() == 0 || !part.renameTo(f)) { part.delete(); return result(0, "write"); }
            return result(200, "");
        } catch (Exception e) {
            part.delete();
            return result(0, String.valueOf(e.getMessage()));
        } finally {
            if (con != null) con.disconnect();
        }
    }

    public static String putFile(String url, File f, String key) {
        if (!f.isFile()) return result(404, "");
        HttpURLConnection con = null;
        try {
            con = open("PUT", url, 60000, key);
            con.setRequestProperty("Content-Type", "application/octet-stream");
            con.setDoOutput(true);
            con.setFixedLengthStreamingMode(f.length());
            try (InputStream in = new FileInputStream(f); OutputStream out = con.getOutputStream()) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            return result(con.getResponseCode(), "");
        } catch (Exception e) {
            return result(0, String.valueOf(e.getMessage()));
        } finally {
            if (con != null) con.disconnect();
        }
    }

    /** Telefonun yerel ağ adresleri (Wi‑Fi ve hotspot). */
    public static List<String> ips() {
        List<String> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && !a.isLoopbackAddress() && !a.isLinkLocalAddress()) out.add(a.getHostAddress());
                }
            }
        } catch (Exception ignored) {}
        return out;
    }

    public static String ipsJson() {
        org.json.JSONArray a = new org.json.JSONArray();
        for (String s : ips()) a.put(s);
        return a.toString();
    }

    /** Bilgisayarın adresi değiştiyse aynı ağda (/24) eşleşmiş programı arar. */
    public static String find(int port, String key, String appId) {
        List<String> hosts = new ArrayList<>();
        List<String> mine = ips();
        for (String ip : mine) {
            String b = ip.substring(0, ip.lastIndexOf('.'));
            for (int i = 1; i < 255; i++) { String h = b + "." + i; if (!mine.contains(h) && !hosts.contains(h)) hosts.add(h); }
        }
        AtomicReference<String> found = new AtomicReference<>("");
        AtomicInteger idx = new AtomicInteger(0);
        ExecutorService ex = Executors.newFixedThreadPool(40);
        for (int t = 0; t < 40; t++) {
            ex.execute(() -> {
                int i;
                while (found.get().isEmpty() && (i = idx.getAndIncrement()) < hosts.size()) {
                    String h = hosts.get(i);
                    try {
                        JSONObject r = new JSONObject(http("GET", "http://" + h + ":" + port + "/lan/ping", null, 700, key));
                        if (r.optInt("status") == 200 && appId.equals(new JSONObject(r.optString("body")).optString("app"))) found.compareAndSet("", h);
                    } catch (Exception ignored) {}
                }
            });
        }
        ex.shutdown();
        try { ex.awaitTermination(40, TimeUnit.SECONDS); } catch (Exception ignored) {}
        try { return new JSONObject().put("ok", !found.get().isEmpty()).put("host", found.get()).toString(); }
        catch (Exception e) { return "{\"ok\":false}"; }
    }
}
