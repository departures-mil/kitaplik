package com.kitaplik.uygulama;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (Reminders.ACTION.equals(a)) {
            Reminders.show(c, i.getIntExtra("id", 1), i.getStringExtra("title"), i.getStringExtra("body"));
        } else if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            Reminders.restore(c);
        }
    }
}
