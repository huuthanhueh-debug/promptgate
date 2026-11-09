package app.foldisland.sources

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.app.Notification
import app.foldisland.IslandApp
import app.foldisland.R
import app.foldisland.core.LiveItem
import app.foldisland.core.ReminderTime
import app.foldisland.hub.ActivityHub
import app.foldisland.settings.MainActivity
import app.foldisland.settings.Reminder
import java.time.DayOfWeek
import java.time.ZonedDateTime
import java.util.Locale
import androidx.core.content.edit

/**
 * Daily reminders. Each one fires through AlarmManager (works while the phone sleeps),
 * shows on the island AND posts a normal notification, so it is never missed even when
 * the island is turned off.
 */
object Reminders {

    const val CHANNEL_ID = "reminders"
    const val ACTION_FIRE = "app.foldisland.reminder.FIRE"
    const val ACTION_DONE = "app.foldisland.reminder.DONE"
    const val ACTION_SNOOZE = "app.foldisland.reminder.SNOOZE"
    const val EXTRA_ID = "reminder_id"

    const val SNOOZE_MINUTES = 10L
    const val ISLAND_TIMEOUT_MS = 30 * 60_000L

    private const val PREFS = "reminder_schedule"
    private const val KEY_SCHEDULED = "scheduled_ids"

    fun createChannel(context: Context) {
        val channel = NotificationChannel(CHANNEL_ID, "Nhắc lịch", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Nhắc lịch hằng ngày của Fold Island"
            enableVibration(true)
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    /** (Re)schedules every enabled reminder and cancels the ones that were removed or disabled. */
    fun scheduleAll(context: Context, reminders: List<Reminder>) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val previous = prefs.getStringSet(KEY_SCHEDULED, emptySet()).orEmpty()
        val active = reminders.filter { it.enabled }
        (previous - active.map { it.id }.toSet()).forEach { cancel(context, it) }
        active.forEach { scheduleNext(context, it) }
        prefs.edit { putStringSet(KEY_SCHEDULED, active.map { it.id }.toSet()) }
    }

    fun scheduleNext(context: Context, reminder: Reminder, now: ZonedDateTime = ZonedDateTime.now()) {
        val days = reminder.days.mapNotNull { d -> runCatching { DayOfWeek.of(d) }.getOrNull() }.toSet()
        val at = ReminderTime.next(reminder.hour, reminder.minute, days, now)
        setAlarm(context, reminder.id, at.toInstant().toEpochMilli())
    }

    fun snooze(context: Context, id: String) {
        clearShown(context, id)
        setAlarm(context, id, System.currentTimeMillis() + SNOOZE_MINUTES * 60_000L)
    }

    fun fire(context: Context, id: String) {
        val reminder = config().reminders.firstOrNull { it.id == id && it.enabled } ?: return
        val now = System.currentTimeMillis()
        ActivityHub.put(
            LiveItem.Reminder(
                id = islandId(id),
                postedAt = now,
                title = reminder.title,
                reminderId = id,
                expiresAt = now + ISLAND_TIMEOUT_MS,
            ),
        )
        postNotification(context, reminder)
        scheduleNext(context, reminder)
    }

    fun done(context: Context, id: String) = clearShown(context, id)

    private fun clearShown(context: Context, id: String) {
        ActivityHub.remove(islandId(id))
        context.getSystemService(NotificationManager::class.java).cancel(notificationId(id))
    }

    private fun postNotification(context: Context, reminder: Reminder) {
        val open = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_island)
            .setContentTitle(reminder.title)
            .setContentText(String.format(Locale.ROOT, "Đến giờ %02d:%02d", reminder.hour, reminder.minute))
            .setCategory(Notification.CATEGORY_REMINDER)
            .setContentIntent(open)
            .setAutoCancel(true)
            .addAction(Notification.Action.Builder(null, "Đã xong", actionIntent(context, ACTION_DONE, reminder.id)).build())
            .addAction(Notification.Action.Builder(null, "Nhắc lại 10 phút", actionIntent(context, ACTION_SNOOZE, reminder.id)).build())
            .build()
        runCatching {
            context.getSystemService(NotificationManager::class.java).notify(notificationId(reminder.id), notification)
        }
    }

    fun actionIntent(context: Context, action: String, id: String): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            (action + id).hashCode(),
            Intent(context, ReminderReceiver::class.java).setAction(action).putExtra(EXTRA_ID, id),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    private fun setAlarm(context: Context, id: String, atMillis: Long) {
        val alarms = context.getSystemService(AlarmManager::class.java)
        val pi = actionIntent(context, ACTION_FIRE, id)
        // USE_EXACT_ALARM is granted at install on Android 13+; fall back to an inexact
        // alarm if a future OS version or policy takes it away.
        try {
            if (alarms.canScheduleExactAlarms()) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi)
                return
            }
        } catch (_: SecurityException) {
        }
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi)
    }

    private fun cancel(context: Context, id: String) {
        context.getSystemService(AlarmManager::class.java).cancel(actionIntent(context, ACTION_FIRE, id))
    }

    fun islandId(id: String) = "reminder:$id"
    private fun notificationId(id: String) = ("reminder:$id").hashCode()
    private fun config() = IslandApp.instance.settings.config.value
}
