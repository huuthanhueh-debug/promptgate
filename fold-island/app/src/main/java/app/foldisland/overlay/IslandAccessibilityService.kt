package app.foldisland.overlay

import android.accessibilityservice.AccessibilityService
import android.content.res.Configuration
import android.view.accessibility.AccessibilityEvent
import app.foldisland.sources.BatteryWatcher

/**
 * Hosts the island. Accessibility is used only for its overlay window type, which is drawn
 * above the status bar and the lock screen; the service does not read screen content
 * (canRetrieveWindowContent=false) and never performs gestures.
 */
class IslandAccessibilityService : AccessibilityService() {

    private var overlay: OverlayWindow? = null
    private var battery: BatteryWatcher? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        overlay = OverlayWindow(this).also { it.attach() }
        battery = BatteryWatcher(this).also { it.start() }
        running = true
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        overlay?.onScreenChanged()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        running = false
        battery?.stop()
        overlay?.detach()
        battery = null
        overlay = null
        super.onDestroy()
    }

    companion object {
        @Volatile var running: Boolean = false
            private set
    }
}
