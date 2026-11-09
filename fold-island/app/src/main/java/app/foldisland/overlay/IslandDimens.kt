package app.foldisland.overlay

import app.foldisland.core.IslandGeometry
import app.foldisland.core.IslandLayout
import app.foldisland.core.PxRect
import app.foldisland.settings.Tuning
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Sizes shared by the window placement code and the Compose UI. */
object IslandDimens {
    const val MIN_PILL_DP = 34
    const val CAMERA_PAD_DP = 6
    const val SLOT_DP = 78
    const val SIDE_PAD_DP = 8
    const val BUBBLE_GAP_DP = 6
    const val CARD_MAX_DP = 420
    const val CARD_MARGIN_DP = 12
    const val CARD_RADIUS_DP = 30
    const val CARD_ESTIMATE_DP = 160

    fun pillHeightPx(g: ScreenGeometry, t: Tuning, density: Float): Int {
        val scale = t.scale.coerceIn(Tuning.MIN_SCALE, Tuning.MAX_SCALE)
        val base = IslandGeometry.pillHeight(
            g.cutoutHeight,
            (MIN_PILL_DP * density).roundToInt(),
            (CAMERA_PAD_DP * density).roundToInt(),
        )
        return (base * scale).roundToInt()
    }

    /** Empty space kept in the middle of the pill so text never sits on the camera. */
    fun cameraGapPx(g: ScreenGeometry, density: Float): Int =
        max(g.cutoutWidth + (8 * density).roundToInt(), (16 * density).roundToInt())

    fun cardWidthPx(screenWidth: Int, density: Float): Int =
        min(screenWidth - (2 * CARD_MARGIN_DP * density).roundToInt(), (CARD_MAX_DP * density).roundToInt())
}

/** Every rectangle the island can take on the current screen, in screen pixels. */
class IslandMetrics(g: ScreenGeometry, t: Tuning, density: Float) {
    val pillHeight = IslandDimens.pillHeightPx(g, t, density)
    val cameraGap = IslandDimens.cameraGapPx(g, density)
    val cardWidth = IslandDimens.cardWidthPx(g.screenWidth, density)
    val cardRadius = IslandDimens.CARD_RADIUS_DP * density
    val cardEstimate = (IslandDimens.CARD_ESTIMATE_DP * density).roundToInt()
    private val margin = (IslandDimens.CARD_MARGIN_DP * density).roundToInt()
    private val bubbleGap = (IslandDimens.BUBBLE_GAP_DP * density).roundToInt()
    private val screenWidth = g.screenWidth
    private val anchorX = g.cutoutCenterX + IslandGeometry.clampOffset(t.offsetX, Tuning.MAX_OFFSET)
    private val top = IslandGeometry.top(g.cutoutCenterY, pillHeight) +
        IslandGeometry.clampOffset(t.offsetY, Tuning.MAX_OFFSET)
    private val maxCardHeight = max(g.screenHeight - top - margin, pillHeight)

    val idle: PxRect = around(max(cameraGap + (24 * density).roundToInt(), (pillHeight * 1.6f).roundToInt()), pillHeight)

    val compact: PxRect = around(
        (2 * (IslandDimens.SLOT_DP + IslandDimens.SIDE_PAD_DP) * density).roundToInt() + cameraGap,
        pillHeight,
    )

    val bubble: PxRect = IslandLayout.bubble(compact, bubbleGap, screenWidth, margin)

    fun card(height: Int): PxRect = around(cardWidth, height.coerceIn(pillHeight, maxCardHeight))

    private fun around(width: Int, height: Int) =
        IslandLayout.around(anchorX, top, width, height, screenWidth, margin)
}
