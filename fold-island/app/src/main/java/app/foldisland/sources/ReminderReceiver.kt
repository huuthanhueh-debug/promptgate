package app.foldisland.sources

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(Reminders.EXTRA_ID) ?: return
        when (intent.action) {
            Reminders.ACTION_FIRE -> Reminders.fire(context, id)
            Reminders.ACTION_DONE -> Reminders.done(context, id)
            Reminders.ACTION_SNOOZE -> Reminders.snooze(context, id)
        }
    }
}

/** Alarms are wiped on reboot, app update and clock changes: put them back. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // IslandApp.onCreate already schedules reminders whenever the process starts;
        // this receiver exists so the process starts after boot / update / time change.
        val app = context.applicationContext as app.foldisland.IslandApp
        Reminders.scheduleAll(context, app.settings.config.value.reminders)
    }
}
