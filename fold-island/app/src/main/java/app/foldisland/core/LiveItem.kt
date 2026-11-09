package app.foldisland.core

/**
 * One thing the island can show. Pure data: no Android types, so the selection logic
 * can be unit-tested on the JVM. Platform handles (PendingIntents, album art, media
 * controllers) live next to the item in ActivityHub, keyed by [id].
 */
sealed interface LiveItem {
    val id: String
    val sourcePackage: String?
    val postedAt: Long

    /** Epoch millis after which the item is gone; null = until removed. */
    val expiresAt: Long?

    data class Ride(
        override val id: String,
        override val sourcePackage: String?,
        override val postedAt: Long,
        val title: String,
        val text: String,
        val etaMinutes: Int?,
        val plate: String?,
        /** 0f..1f when the source notification carries a progress bar. */
        val progress: Float?,
        override val expiresAt: Long? = null,
    ) : LiveItem

    data class Call(
        override val id: String,
        override val sourcePackage: String?,
        override val postedAt: Long,
        val caller: String,
        val incoming: Boolean,
        /** Epoch millis the call was connected (for the duration counter). */
        val startedAt: Long?,
        override val expiresAt: Long? = null,
    ) : LiveItem

    data class Message(
        override val id: String,
        override val sourcePackage: String?,
        override val postedAt: Long,
        val sender: String,
        val text: String,
        override val expiresAt: Long?,
    ) : LiveItem

    data class Media(
        override val id: String,
        override val sourcePackage: String?,
        override val postedAt: Long,
        val title: String,
        val artist: String,
        val playing: Boolean,
        override val expiresAt: Long? = null,
    ) : LiveItem

    data class Timer(
        override val id: String,
        override val sourcePackage: String?,
        override val postedAt: Long,
        val label: String,
        /** Count-down: the moment it hits zero. Count-up: the moment it started. */
        val baseAt: Long,
        val countDown: Boolean,
        override val expiresAt: Long? = null,
    ) : LiveItem

    data class Charging(
        override val postedAt: Long,
        val percent: Int,
        override val expiresAt: Long?,
    ) : LiveItem {
        override val id get() = "sys:charging"
        override val sourcePackage: String? get() = null
    }

    data class LowBattery(
        override val postedAt: Long,
        val percent: Int,
        override val expiresAt: Long?,
    ) : LiveItem {
        override val id get() = "sys:low_battery"
        override val sourcePackage: String? get() = null
    }

    data class Reminder(
        override val id: String,
        override val postedAt: Long,
        val title: String,
        val reminderId: String,
        override val expiresAt: Long? = null,
    ) : LiveItem {
        override val sourcePackage: String? get() = null
    }
}
