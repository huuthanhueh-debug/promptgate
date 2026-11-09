package app.foldisland.core

import kotlin.math.max

/** Placement math for the island window. All values in pixels. */
object IslandGeometry {

    /**
     * Horizontal offset from the screen centre that puts content of [contentWidth] centred on
     * [targetX] (usually the camera hole) while keeping [margin] free at both screen edges.
     * Used with Gravity.CENTER_HORIZONTAL so the window stays centred while it resizes.
     */
    fun centerOffset(screenWidth: Int, targetX: Int, contentWidth: Int, margin: Int): Int {
        val half = screenWidth / 2
        val maxOffset = (half - contentWidth / 2 - margin).coerceAtLeast(0)
        return (targetX - half).coerceIn(-maxOffset, maxOffset)
    }

    fun pillHeight(cutoutHeight: Int, minHeight: Int, padding: Int): Int =
        max(cutoutHeight + 2 * padding, minHeight)

    /** Window top so the pill's vertical centre sits on the camera. */
    fun top(cutoutCenterY: Int, pillHeight: Int): Int = (cutoutCenterY - pillHeight / 2).coerceAtLeast(0)

    fun clampOffset(value: Int, limit: Int): Int = value.coerceIn(-limit, limit)
}
