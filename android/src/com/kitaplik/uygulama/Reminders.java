package com.kitaplik.uygulama;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

/** Ödünç hatırlatmalarını AlarmManager ile zamanlar ve bildirim gösterir. */
public class Reminders {
    static final String ACTION = "com.kitaplik.uygulama.REMINDER";

    private static PendingIntent pending(Context c, JSONObject r, int flags) throws Exception {
        String key = r.getString("key");
        Intent i = new Intent(c, ReminderReceiver.class);
        i.setAction(ACTION);
        i.putExtra("id", key.hashCode());
        i.putExtra("title", r.optString("title"));
        i.putExtra("body", r.optString("body"));
        i.setData(Uri.parse("kitaplik://reminder/" + key));
        return PendingIntent.getBroadcast(c, key.hashCode(), i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static synchronized void replaceAll(Context c, String json) {
        SharedPreferences p = c.getSharedPreferences("reminders", Context.MODE_PRIVATE);
        AlarmManager am = c.getSystemService(AlarmManager.class);
        try {
            JSONArray old = new JSONArray(p.getString("list", "[]"));
            for (int i = 0; i < old.length(); i++) {
                try {
                    am.cancel(pending(c, old.getJSONObject(i), PendingIntent.FLAG_UPDATE_CURRENT));
                } catch (Exception ignored) {
                }
            }
        } catch (Exception ignored) {
        }
        p.edit().putString("list", json).apply();
        schedule(c, json);
    }

    static void restore(Context c) {
        schedule(c, c.getSharedPreferences("reminders", Context.MODE_PRIVATE).getString("list", "[]"));
    }

    private static void schedule(Context c, String json) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        long now = System.currentTimeMillis();
        try {
            JSONArray a = new JSONArray(json);
            for (int i = 0; i < a.length(); i++) {
                JSONObject r = a.getJSONObject(i);
                long at = r.getLong("at");
                if (at <= now) continue;
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c, r, PendingIntent.FLAG_UPDATE_CURRENT));
            }
        } catch (Exception ignored) {
        }
    }

    static void show(Context c, int id, String title, String body) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        String ch = "loan_reminders";
        if (nm.getNotificationChannel(ch) == null) {
            NotificationChannel n = new NotificationChannel(ch, "Ödünç hatırlatmaları", NotificationManager.IMPORTANCE_HIGH);
            n.setDescription("Ödünç verilen kitapların geri alınması için hatırlatmalar");
            nm.createNotificationChannel(n);
        }
        Intent open = new Intent(c, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, ch)
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setColor(0xFF6D4C41)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        nm.notify(id, n);
    }
}
