package app.foldisland.overlay

import android.content.Context
import app.foldisland.actions.ShortcutActions
import app.foldisland.core.LiveItem
import app.foldisland.hub.ActivityHub
import app.foldisland.settings.Place
import app.foldisland.settings.QuickContact
import app.foldisland.sources.Reminders
import kotlin.math.abs

/** Turns gestures and button presses on the island into actions. */
class IslandController(private val context: Context, private val state: IslandUiState) {

    fun onTap() {
        when (val p = state.presentation()) {
            is Presentation.Compact -> state.expand()
            is Presentation.Popup -> {
                if (p.item is LiveItem.Message) open(p.item)
                ActivityHub.remove(p.item.id)
            }
            is Presentation.Expanded -> {
                if (p.item !is LiveItem.Reminder) open(p.item)
                state.collapse()
            }
            Presentation.Shortcuts -> state.collapse()
            Presentation.Idle, Presentation.Hidden -> Unit
        }
    }

    fun onLongPress() = state.showShortcuts()

    /** [dx]/[dy] in pixels, [touchSlop] from the view configuration. */
    fun onDrag(dx: Float, dy: Float, touchSlop: Float) {
        val threshold = touchSlop * 3
        val p = state.presentation()
        when {
            dy < -threshold && abs(dy) > abs(dx) -> state.collapse()
            dy > threshold && abs(dy) > abs(dx) && p is Presentation.Compact -> state.expand()
            abs(dx) > threshold && p is Presentation.Compact -> state.swipe(if (dx < 0) 1 else -1)
        }
    }

    fun choose(item: LiveItem) = state.choose(item.id)

    fun open(item: LiveItem) {
        val h = ActivityHub.handles(item.id)
        ShortcutActions.openSource(context, h.contentIntent, item.sourcePackage)
    }

    fun answer(item: LiveItem.Call) {
        ActivityHub.handles(item.id).answer?.let { ShortcutActions.send(context, it) } ?: open(item)
    }

    fun decline(item: LiveItem.Call) {
        val h = ActivityHub.handles(item.id)
        (h.decline ?: h.hangUp)?.let { ShortcutActions.send(context, it) } ?: open(item)
        state.collapse()
    }

    fun hangUp(item: LiveItem.Call) {
        val h = ActivityHub.handles(item.id)
        (h.hangUp ?: h.decline)?.let { ShortcutActions.send(context, it) } ?: open(item)
        state.collapse()
    }

    fun playPause(item: LiveItem.Media) {
        val controls = ActivityHub.handles(item.id).media?.transportControls ?: return
        if (item.playing) controls.pause() else controls.play()
    }

    fun next(item: LiveItem.Media) {
        ActivityHub.handles(item.id).media?.transportControls?.skipToNext()
    }

    fun previous(item: LiveItem.Media) {
        ActivityHub.handles(item.id).media?.transportControls?.skipToPrevious()
    }

    fun reminderDone(item: LiveItem.Reminder) {
        Reminders.done(context, item.reminderId)
        state.collapse()
    }

    fun reminderSnooze(item: LiveItem.Reminder) {
        Reminders.snooze(context, item.reminderId)
        state.collapse()
    }

    fun bookGrab(place: Place) {
        state.collapse()
        ShortcutActions.bookGrab(context, place, state.config.grabTemplate)
    }

    fun call(contact: QuickContact) {
        state.collapse()
        ShortcutActions.call(context, contact)
    }

    fun launch(packageName: String) {
        state.collapse()
        ShortcutActions.launchApp(context, packageName)
    }

    fun openSettings() {
        state.collapse()
        ShortcutActions.openSettings(context)
    }
}
