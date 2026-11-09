package app.foldisland.sources

import android.app.NotificationManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import app.foldisland.IslandApp
import app.foldisland.core.LiveItem
import app.foldisland.hub.ActivityHub

/**
 * Receives every notification on the phone (once the user grants Notification access)
 * and feeds the ones the island cares about into [ActivityHub].
 */
class IslandNotificationListener : NotificationListenerService() {

    /** Last message text per notification key, so updates to the same chat do not re-popup. */
    private val lastMessage = HashMap<String, Int>()
    private var media: MediaWatcher? = null

    override fun onListenerConnected() {
        super.onListenerConnected()
        connected = true
        runCatching { activeNotifications }.getOrNull()?.forEach { handle(it, initial = true) }
        media = MediaWatcher(this).also { it.start() }
    }

    override fun onListenerDisconnected() {
        connected = false
        media?.stop()
        media = null
        ActivityHub.removeIf { it.id.startsWith("n:") }
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        handle(sbn, initial = false)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        lastMessage.remove(sbn.key)
        val id = NotificationClassifier.idFor(sbn)
        // Messages are short popups that expire on their own.
        if (ActivityHub.get(id) !is LiveItem.Message) ActivityHub.remove(id)
    }

    private fun handle(sbn: StatusBarNotification, initial: Boolean) {
        val config = IslandApp.instance.settings.config.value
        val now = System.currentTimeMillis()
        val classified = NotificationClassifier.classify(sbn, config, packageName, now)
        val id = NotificationClassifier.idFor(sbn)
        if (classified == null) {
            if (ActivityHub.get(id) !is LiveItem.Message) ActivityHub.remove(id)
            return
        }
        val item = classified.item
        if (item is LiveItem.Message) {
            if (initial) return // do not replay old chats when the listener (re)connects
            if (!shouldPopUp(sbn)) return
            val fingerprint = (item.sender + "\u0000" + item.text).hashCode()
            if (lastMessage[sbn.key] == fingerprint) return
            lastMessage[sbn.key] = fingerprint
        }
        ActivityHub.put(item, classified.handles)
    }

    /** Respect Do Not Disturb and silent / low-importance channels for message popups. */
    private fun shouldPopUp(sbn: StatusBarNotification): Boolean {
        val ranking = Ranking()
        val ranked = runCatching { currentRanking.getRanking(sbn.key, ranking) }.getOrDefault(false)
        if (!ranked) return true
        return ranking.matchesInterruptionFilter() &&
            ranking.importance >= NotificationManager.IMPORTANCE_DEFAULT
    }

    companion object {
        @Volatile var connected: Boolean = false
            private set
    }
}
