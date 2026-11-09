package app.foldisland.settings

import app.foldisland.core.GrabLink
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Everything the user configures. Stored as one JSON document in DataStore. */
@Serializable
data class AppConfig(
    val enabled: Boolean = true,
    val places: List<Place> = emptyList(),
    val contacts: List<QuickContact> = emptyList(),
    /** Package names, in display order. */
    val pinnedApps: List<String> = emptyList(),
    val reminders: List<Reminder> = emptyList(),
    /** Packages whose notifications are treated as ride / delivery trips. */
    val rideApps: List<String> = listOf(GrabLink.PACKAGE),
    val idleStyle: IdleStyle = IdleStyle.PILL,
    val hideInLandscape: Boolean = true,
    val hideMessageTextOnLockScreen: Boolean = true,
    val coverTuning: Tuning = Tuning(),
    val innerTuning: Tuning = Tuning(),
    val grabTemplate: String = GrabLink.DEFAULT_TEMPLATE,
) {
    companion object {
        const val MAX_PLACES = 4
        const val MAX_CONTACTS = 4
        const val MAX_PINNED_APPS = 8

        val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

        fun decode(text: String?): AppConfig =
            if (text.isNullOrBlank()) AppConfig()
            else runCatching { json.decodeFromString(serializer(), text) }.getOrDefault(AppConfig())

        fun encode(config: AppConfig): String = json.encodeToString(serializer(), config)
    }
}

@Serializable
data class Place(val id: String, val name: String, val lat: Double, val lng: Double)

@Serializable
data class QuickContact(val id: String, val name: String, val phone: String)

@Serializable
data class Reminder(
    val id: String,
    val title: String,
    val hour: Int,
    val minute: Int,
    /** ISO day numbers 1 = Monday … 7 = Sunday. Empty = every day. */
    val days: Set<Int> = emptySet(),
    val enabled: Boolean = true,
)

/** Manual nudge per screen (cover vs. inner), in pixels / multiplier. */
@Serializable
data class Tuning(val offsetX: Int = 0, val offsetY: Int = 0, val scale: Float = 1f) {
    companion object {
        const val MAX_OFFSET = 40
        const val MIN_SCALE = 0.8f
        const val MAX_SCALE = 1.3f
    }
}

@Serializable
enum class IdleStyle { PILL, HIDDEN }
