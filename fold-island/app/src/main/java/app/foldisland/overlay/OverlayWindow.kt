package app.foldisland.overlay

import android.app.KeyguardManager
import android.content.Context
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import app.foldisland.IslandApp
import app.foldisland.core.PxRect
import app.foldisland.hub.ActivityHub
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * The island window: an accessibility overlay (drawn above the status bar and lock screen)
 * that hosts the Compose UI. Its position and size come from [IslandRoot] through
 * [applyFrame] and change only when a transition starts or ends, never per animation frame.
 */
class OverlayWindow(private val context: Context) {

    private val wm = context.getSystemService(WindowManager::class.java)
    private val keyguard = context.getSystemService(KeyguardManager::class.java)
    private val displays = context.getSystemService(DisplayManager::class.java)
    private val handler = Handler(Looper.getMainLooper())
    private val scope = MainScope()
    private val owner = OverlayLifecycleOwner()
    private var root: OutsideTouchLayout? = null
    private var frame = PxRect(0, 0, 1, 1)

    val state = IslandUiState()

    private val params = WindowManager.LayoutParams(
        1,
        1,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
            WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
        PixelFormat.TRANSLUCENT,
    ).apply {
        gravity = Gravity.TOP or Gravity.START
        layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        title = "FoldIsland"
    }

    private val displayListener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) = Unit
        override fun onDisplayRemoved(displayId: Int) = Unit
        override fun onDisplayChanged(displayId: Int) = onScreenChanged()
    }

    fun attach() {
        owner.start()
        val compose = ComposeView(context).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
            val controller = IslandController(context, state)
            setContent { IslandRoot(state, controller, ::applyFrame) }
        }
        root = OutsideTouchLayout(context) { state.collapse() }.apply {
            addView(compose)
            setViewTreeLifecycleOwner(owner)
            setViewTreeSavedStateRegistryOwner(owner)
        }
        state.config = IslandApp.instance.settings.config.value
        state.geometry = measureScreen()
        wm.addView(root, params)
        displays.registerDisplayListener(displayListener, handler)

        scope.launch {
            IslandApp.instance.settings.config.collect { state.config = it }
        }
        scope.launch {
            ActivityHub.items.collect {
                state.now = System.currentTimeMillis()
                state.items = it
            }
        }
        scope.launch {
            while (isActive) {
                delay(if (state.items.isEmpty()) IDLE_TICK_MS else TICK_MS)
                val now = System.currentTimeMillis()
                ActivityHub.pruneExpired(now)
                state.now = now
                state.locked = keyguard.isKeyguardLocked
            }
        }
    }

    fun detach() {
        scope.cancel()
        runCatching { displays.unregisterDisplayListener(displayListener) }
        root?.let { runCatching { wm.removeView(it) } }
        root = null
        owner.stop()
    }

    /**
     * Fold / unfold, rotation, resolution change. Display callbacks also fire for refresh-rate
     * switches on the 120 Hz panel, so only act when the geometry really changed.
     */
    fun onScreenChanged() {
        val next = measureScreen()
        if (next == state.geometry) return
        state.geometry = next
        state.collapse()
    }

    /** Moves/resizes the window. Called by [IslandRoot] only when the frame really changes. */
    private fun applyFrame(next: PxRect) {
        if (next == frame) return
        frame = next
        params.x = next.left
        params.y = next.top
        params.width = next.width.coerceAtLeast(1)
        params.height = next.height.coerceAtLeast(1)
        root?.takeIf { it.isAttachedToWindow }?.let { wm.updateViewLayout(it, params) }
    }

    private fun measureScreen(): ScreenGeometry {
        val metrics = wm.currentWindowMetrics
        val bounds = metrics.bounds
        val insets = metrics.windowInsets
        val config = context.resources.configuration
        val landscape = config.orientation == Configuration.ORIENTATION_LANDSCAPE
        val inner = config.smallestScreenWidthDp >= 600
        val rect = insets.displayCutout?.boundingRectTop?.takeIf { !it.isEmpty }
        return if (rect != null) {
            ScreenGeometry(
                screenWidth = bounds.width(),
                screenHeight = bounds.height(),
                cutoutCenterX = rect.centerX(),
                cutoutCenterY = rect.centerY(),
                cutoutWidth = rect.width(),
                cutoutHeight = rect.height(),
                landscape = landscape,
                innerScreen = inner,
            )
        } else {
            val statusBar = insets.getInsets(WindowInsets.Type.statusBars()).top
            ScreenGeometry(
                screenWidth = bounds.width(),
                screenHeight = bounds.height(),
                cutoutCenterX = bounds.width() / 2,
                cutoutCenterY = statusBar / 2,
                landscape = landscape,
                innerScreen = inner,
            )
        }
    }

    private class OutsideTouchLayout(context: Context, val onOutside: () -> Unit) : FrameLayout(context) {
        override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
            if (ev.actionMasked == MotionEvent.ACTION_OUTSIDE) {
                onOutside()
                return true
            }
            return super.dispatchTouchEvent(ev)
        }
    }

    /** Minimal lifecycle so Compose can run inside a service window. */
    private class OverlayLifecycleOwner : LifecycleOwner, SavedStateRegistryOwner {
        private val registry = LifecycleRegistry(this)
        private val savedState = SavedStateRegistryController.create(this)
        override val lifecycle: Lifecycle get() = registry
        override val savedStateRegistry: SavedStateRegistry get() = savedState.savedStateRegistry

        fun start() {
            savedState.performRestore(null)
            registry.currentState = Lifecycle.State.RESUMED
        }

        fun stop() {
            registry.currentState = Lifecycle.State.DESTROYED
        }
    }

    companion object {
        private const val TICK_MS = 1_000L
        private const val IDLE_TICK_MS = 5_000L
    }
}
