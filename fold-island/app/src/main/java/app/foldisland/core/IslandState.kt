package app.foldisland.core

/** What the island should draw right now. */
data class IslandView(
    /** Main item in the pill (or the expanded card). */
    val primary: LiveItem?,
    /** Second persistent item, drawn as the small bubble on the right. */
    val secondary: LiveItem?,
    /** Short-lived popup (message, charging, low battery) drawn over the pill. */
    val popup: LiveItem?,
    /** Number of persistent items (calls, rides, media, ...). */
    val count: Int,
)

object IslandState {

    /** Lower = more important. */
    fun rank(item: LiveItem): Int = when (item) {
        is LiveItem.Call -> if (item.incoming) 0 else 1
        is LiveItem.Reminder -> 2
        is LiveItem.Ride -> 3
        is LiveItem.Timer -> 4
        is LiveItem.Media -> 5
        is LiveItem.Message, is LiveItem.Charging, is LiveItem.LowBattery -> 100
    }

    fun isTransient(item: LiveItem): Boolean =
        item is LiveItem.Message || item is LiveItem.Charging || item is LiveItem.LowBattery

    private fun alive(items: List<LiveItem>, now: Long) =
        items.filter { it.expiresAt == null || it.expiresAt!! > now }

    /** Persistent items in display order: most important first, newest first within a kind. */
    fun ordered(items: List<LiveItem>, now: Long): List<LiveItem> =
        alive(items, now)
            .filterNot(::isTransient)
            .sortedWith(compareBy<LiveItem> { rank(it) }.thenByDescending { it.postedAt })

    fun compute(items: List<LiveItem>, now: Long, chosenPrimaryId: String? = null): IslandView {
        val persistent = ordered(items, now)
        val top = persistent.firstOrNull()
        val chosen = chosenPrimaryId?.let { id -> persistent.firstOrNull { it.id == id } }
        val topIsIncomingCall = top is LiveItem.Call && top.incoming
        val primary = if (chosen != null && !topIsIncomingCall) chosen else top
        val secondary = persistent.firstOrNull { it !== primary }
        val popup = alive(items, now).filter(::isTransient).maxByOrNull { it.postedAt }
        return IslandView(primary, secondary, popup, persistent.size)
    }

    /** Id of the item to show after a horizontal swipe; [step] is +1 or -1. */
    fun cycle(items: List<LiveItem>, now: Long, currentId: String?, step: Int): String? {
        val persistent = ordered(items, now)
        if (persistent.isEmpty()) return null
        val index = persistent.indexOfFirst { it.id == currentId }
        if (index < 0) return persistent.first().id
        val next = Math.floorMod(index + step, persistent.size)
        return persistent[next].id
    }
}
