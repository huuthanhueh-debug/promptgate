package app.foldisland.core

import kotlin.math.max
import kotlin.math.min

/** Integer rectangle in screen pixels. Right/bottom are exclusive. */
data class PxRect(val left: Int, val top: Int, val right: Int, val bottom: Int) {
    val width: Int get() = right - left
    val height: Int get() = bottom - top

    fun union(other: PxRect) = PxRect(
        min(left, other.left),
        min(top, other.top),
        max(right, other.right),
        max(bottom, other.bottom),
    )

    fun contains(x: Int, y: Int): Boolean = x in left until right && y in top until bottom
}

/**
 * Where the island shape and its window go.
 *
 * The overlay window is resized only when a transition starts (grow to cover both the start
 * and end shape) and when it ends (shrink to the end shape). Everything in between is drawn
 * inside a window of constant size, which is what keeps the morph smooth: resizing a window
 * on every animation frame goes through the system window manager and makes it shake.
 */
object IslandLayout {

    /** A [width] x [height] rect centred on [anchorX] as far as the screen margins allow. */
    fun around(anchorX: Int, top: Int, width: Int, height: Int, screenWidth: Int, margin: Int): PxRect {
        val offset = IslandGeometry.centerOffset(screenWidth, anchorX, width, margin)
        val left = screenWidth / 2 + offset - width / 2
        return PxRect(left, top, left + width, top + height)
    }

    /** Round bubble for the second activity: right of the pill, or left if it would leave the screen. */
    fun bubble(pill: PxRect, gap: Int, screenWidth: Int, margin: Int): PxRect {
        val size = pill.height
        val rightSide = PxRect(pill.right + gap, pill.top, pill.right + gap + size, pill.bottom)
        if (rightSide.right <= screenWidth - margin) return rightSide
        return PxRect(pill.left - gap - size, pill.top, pill.left - gap, pill.bottom)
    }

    /**
     * Window frame for the current moment. [start] is the shape when the running transition
     * began (null once it has settled); [extra] is anything drawn next to the shape (the bubble).
     */
    fun windowFrame(start: PxRect?, target: PxRect, extra: PxRect?): PxRect {
        var frame = if (start == null) target else start.union(target)
        if (extra != null) frame = frame.union(extra)
        return frame
    }
}
