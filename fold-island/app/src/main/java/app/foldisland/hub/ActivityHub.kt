package app.foldisland.hub

import android.app.PendingIntent
import android.graphics.Bitmap
import android.graphics.drawable.Icon
import android.media.session.MediaController
import app.foldisland.core.LiveItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** Platform objects that belong to a [LiveItem] but cannot live in the pure model. */
data class Handles(
    /** What tapping the expanded card opens (the source app's own screen). */
    val contentIntent: PendingIntent? = null,
    val answer: PendingIntent? = null,
    val decline: PendingIntent? = null,
    val hangUp: PendingIntent? = null,
    val smallIcon: Icon? = null,
    /** Avatar / driver photo / app picture from the notification. */
    val largeIcon: Icon? = null,
    /** Album art for media. */
    val largeImage: Bitmap? = null,
    val media: MediaController? = null,
)

/**
 * Process-wide store of everything the island could show. Sources write, the overlay reads.
 * The notification listener and the accessibility service run in the same process.
 */
object ActivityHub {

    private data class Entry(val item: LiveItem, val handles: Handles)

    private val entries = MutableStateFlow<Map<String, Entry>>(emptyMap())

    private val _items = MutableStateFlow<List<LiveItem>>(emptyList())
    val items: StateFlow<List<LiveItem>> = _items.asStateFlow()

    fun put(item: LiveItem, handles: Handles = Handles()) {
        entries.update { it + (item.id to Entry(item, handles)) }
        publish()
    }

    fun remove(id: String) {
        if (id !in entries.value) return
        entries.update { it - id }
        publish()
    }

    fun removeIf(predicate: (LiveItem) -> Boolean) {
        val before = entries.value
        val after = before.filterValues { !predicate(it.item) }
        if (after.size != before.size) {
            entries.value = after
            publish()
        }
    }

    fun get(id: String): LiveItem? = entries.value[id]?.item

    fun handles(id: String): Handles = entries.value[id]?.handles ?: Handles()

    /** Drops items whose expiry passed. Returns true if anything was removed. */
    fun pruneExpired(now: Long): Boolean {
        val before = entries.value
        val after = before.filterValues { e -> e.item.expiresAt?.let { it > now } ?: true }
        if (after.size == before.size) return false
        entries.value = after
        publish()
        return true
    }

    private fun publish() {
        _items.value = entries.value.values.map { it.item }
    }
}
