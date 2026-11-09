package app.foldisland.overlay

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.foldisland.core.IslandState
import app.foldisland.core.IslandView
import app.foldisland.core.LiveItem
import app.foldisland.settings.AppConfig
import app.foldisland.settings.IdleStyle

/** Pixel geometry of the current screen, recomputed on fold / rotation. */
data class ScreenGeometry(
    val screenWidth: Int = 0,
    val cutoutCenterX: Int = 0,
    val cutoutCenterY: Int = 0,
    val cutoutWidth: Int = 0,
    val cutoutHeight: Int = 0,
    val landscape: Boolean = false,
    val innerScreen: Boolean = false,
)

enum class Mode { COMPACT, EXPANDED, SHORTCUTS }

/** What is on screen. Card presentations are drawn as a large rounded card. */
sealed interface Presentation {
    data object Hidden : Presentation
    data object Idle : Presentation
    data class Compact(val view: IslandView) : Presentation
    data class Popup(val item: LiveItem) : Presentation
    data class Expanded(val item: LiveItem) : Presentation
    data object Shortcuts : Presentation

    val isCard: Boolean get() = this is Popup || this is Expanded || this is Shortcuts
}

/** Compose-observable state of the overlay. Only touched on the main thread. */
class IslandUiState {
    var items by mutableStateOf<List<LiveItem>>(emptyList())
    var config by mutableStateOf(AppConfig())
    var now by mutableLongStateOf(System.currentTimeMillis())
    var mode by mutableStateOf(Mode.COMPACT)
    var chosenPrimaryId by mutableStateOf<String?>(null)
    var geometry by mutableStateOf(ScreenGeometry())
    var locked by mutableStateOf(false)

    /** Auto-expanded items (incoming call, fresh reminder) the user already collapsed. */
    private var dismissedAuto by mutableStateOf(emptySet<String>())

    fun view(): IslandView = IslandState.compute(items, now, chosenPrimaryId)

    fun presentation(): Presentation {
        if (!config.enabled) return Presentation.Hidden
        if (geometry.landscape && config.hideInLandscape) return Presentation.Hidden
        if (mode == Mode.SHORTCUTS) return Presentation.Shortcuts
        val v = view()
        val primary = v.primary
        if (primary != null && primary.id !in dismissedAuto && isAutoExpanded(primary)) {
            return Presentation.Expanded(primary)
        }
        if (mode == Mode.EXPANDED && primary != null) return Presentation.Expanded(primary)
        v.popup?.let { return Presentation.Popup(it) }
        if (primary != null) return Presentation.Compact(v)
        return if (config.idleStyle == IdleStyle.HIDDEN) Presentation.Hidden else Presentation.Idle
    }

    private fun isAutoExpanded(item: LiveItem): Boolean = when (item) {
        is LiveItem.Call -> item.incoming
        is LiveItem.Reminder -> now - item.postedAt < REMINDER_AUTO_EXPAND_MS
        else -> false
    }

    fun expand() {
        if (view().primary != null) mode = Mode.EXPANDED
    }

    fun showShortcuts() {
        mode = Mode.SHORTCUTS
    }

    fun collapse() {
        val expanded = (presentation() as? Presentation.Expanded)?.item?.id
        val alive = items.map { it.id }.toSet()
        dismissedAuto = dismissedAuto.filter { it in alive }.toSet() + listOfNotNull(expanded)
        mode = Mode.COMPACT
    }

    /** Make a specific item the main one (tap on the side bubble). */
    fun choose(id: String) {
        chosenPrimaryId = id
    }

    fun swipe(step: Int) {
        chosenPrimaryId = IslandState.cycle(items, now, view().primary?.id, step)
    }

    companion object {
        const val REMINDER_AUTO_EXPAND_MS = 20_000L
    }
}
