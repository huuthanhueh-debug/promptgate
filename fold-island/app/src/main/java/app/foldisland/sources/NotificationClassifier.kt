package app.foldisland.sources

import android.app.Notification
import android.app.PendingIntent
import android.app.Person
import android.os.Bundle
import android.os.Parcelable
import android.service.notification.StatusBarNotification
import app.foldisland.core.LiveItem
import app.foldisland.core.RideParser
import app.foldisland.hub.Handles
import app.foldisland.settings.AppConfig

/** Turns a system notification into something the island can show, or null to ignore it. */
object NotificationClassifier {

    data class Classified(val item: LiveItem, val handles: Handles)

    private const val CALL_STYLE = "android.app.Notification\$CallStyle"
    private const val MESSAGING_STYLE = "android.app.Notification\$MessagingStyle"
    private const val MEDIA_STYLE = "android.app.Notification\$MediaStyle"
    private const val DECORATED_MEDIA_STYLE = "android.app.Notification\$DecoratedMediaCustomViewStyle"

    /** Android 16 Live Updates put a very short status here (e.g. "3 min"). */
    private const val EXTRA_SHORT_CRITICAL_TEXT = "android.shortCriticalText"

    const val MESSAGE_POPUP_MS = 4_000L
    const val RIDE_STALE_MS = 15 * 60_000L

    fun idFor(sbn: StatusBarNotification) = "n:${sbn.key}"

    fun classify(sbn: StatusBarNotification, config: AppConfig, ownPackage: String, now: Long): Classified? {
        if (sbn.packageName == ownPackage) return null
        val n = sbn.notification ?: return null
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return null
        val extras = n.extras ?: Bundle.EMPTY
        val template = extras.getString(Notification.EXTRA_TEMPLATE)
        if (template == MEDIA_STYLE || template == DECORATED_MEDIA_STYLE) return null // MediaWatcher

        val ongoing = n.flags and Notification.FLAG_ONGOING_EVENT != 0
        val title = extras.text(Notification.EXTRA_TITLE)
        val text = extras.text(Notification.EXTRA_BIG_TEXT).ifBlank { extras.text(Notification.EXTRA_TEXT) }
        val chronometer = extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER)
        val id = idFor(sbn)
        val base = Handles(contentIntent = n.contentIntent, smallIcon = n.smallIcon)

        // 1. Calls
        if (n.category == Notification.CATEGORY_CALL || template == CALL_STYLE) {
            val callType = extras.getInt(Notification.EXTRA_CALL_TYPE, 0)
            val incoming = callType == Notification.CallStyle.CALL_TYPE_INCOMING ||
                (callType == 0 && n.fullScreenIntent != null && !chronometer)
            val person = extras.parcelable<Person>(Notification.EXTRA_CALL_PERSON)
            val caller = person?.name?.toString()?.takeIf { it.isNotBlank() } ?: title.ifBlank { text }
            val handles = base.copy(
                answer = extras.parcelable(Notification.EXTRA_ANSWER_INTENT)
                    ?: findAction(n, "trả lời", "nghe", "answer", "accept"),
                decline = extras.parcelable(Notification.EXTRA_DECLINE_INTENT)
                    ?: findAction(n, "từ chối", "decline", "reject"),
                hangUp = extras.parcelable(Notification.EXTRA_HANG_UP_INTENT)
                    ?: findAction(n, "kết thúc", "gác máy", "end", "hang up"),
            )
            val item = LiveItem.Call(
                id = id,
                sourcePackage = sbn.packageName,
                postedAt = sbn.postTime,
                caller = caller,
                incoming = incoming,
                startedAt = if (!incoming && chronometer) n.`when` else null,
            )
            return Classified(item, handles)
        }

        // 2. Ride-hailing & delivery
        if (sbn.packageName in config.rideApps) {
            val progressMax = extras.getInt(Notification.EXTRA_PROGRESS_MAX, 0)
            val indeterminate = extras.getBoolean(Notification.EXTRA_PROGRESS_INDETERMINATE)
            val progress = if (progressMax > 0 && !indeterminate) {
                (extras.getInt(Notification.EXTRA_PROGRESS, 0).toFloat() / progressMax).coerceIn(0f, 1f)
            } else null
            if (ongoing || progress != null || RideParser.looksLikeTrip(title, text)) {
                val shortText = extras.text(EXTRA_SHORT_CRITICAL_TEXT)
                val info = RideParser.parse("$shortText $title $text")
                val item = LiveItem.Ride(
                    id = id,
                    sourcePackage = sbn.packageName,
                    postedAt = sbn.postTime,
                    title = title,
                    text = text,
                    etaMinutes = info.etaMinutes,
                    plate = info.plate,
                    progress = progress,
                    expiresAt = if (ongoing) null else now + RIDE_STALE_MS,
                )
                return Classified(item, base.copy(largeIcon = n.getLargeIcon()))
            }
            return null
        }

        // 3. Timers & stopwatches (e.g. Samsung Clock)
        if (ongoing && chronometer) {
            val item = LiveItem.Timer(
                id = id,
                sourcePackage = sbn.packageName,
                postedAt = sbn.postTime,
                label = title.ifBlank { text },
                baseAt = n.`when`,
                countDown = extras.getBoolean(Notification.EXTRA_CHRONOMETER_COUNT_DOWN),
            )
            return Classified(item, base)
        }

        // 4. Messages (short popup)
        if (!ongoing && (n.category == Notification.CATEGORY_MESSAGE || template == MESSAGING_STYLE)) {
            val (sender, body) = lastMessage(extras) ?: (title to text)
            if (body.isBlank() && sender.isBlank()) return null
            val item = LiveItem.Message(
                id = id,
                sourcePackage = sbn.packageName,
                postedAt = now,
                sender = sender.ifBlank { title },
                text = body,
                expiresAt = now + MESSAGE_POPUP_MS,
            )
            return Classified(item, base.copy(largeIcon = n.getLargeIcon()))
        }

        return null
    }

    private fun lastMessage(extras: Bundle): Pair<String, String>? {
        @Suppress("DEPRECATION")
        val messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES) ?: return null
        val last = messages.lastOrNull() as? Bundle ?: return null
        val text = last.getCharSequence("text")?.toString().orEmpty()
        val sender = last.parcelable<Person>("sender_person")?.name?.toString()
            ?: last.getCharSequence("sender")?.toString()
            ?: ""
        return sender to text
    }

    private fun findAction(n: Notification, vararg keywords: String): PendingIntent? =
        n.actions?.firstOrNull { action ->
            val label = action.title?.toString()?.lowercase().orEmpty()
            keywords.any { it in label }
        }?.actionIntent

    private fun Bundle.text(key: String): String = getCharSequence(key)?.toString()?.trim().orEmpty()

    private inline fun <reified T : Parcelable> Bundle.parcelable(key: String): T? =
        getParcelable(key, T::class.java)
}
