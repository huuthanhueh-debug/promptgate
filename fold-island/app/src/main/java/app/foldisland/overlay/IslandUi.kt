package app.foldisland.overlay

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.RepeatMode
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.BatteryAlert
import androidx.compose.material.icons.rounded.BatteryChargingFull
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.CallEnd
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.LocalTaxi
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material.icons.rounded.Snooze
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.drawable.toBitmap
import app.foldisland.core.IslandLayout
import app.foldisland.core.IslandView
import app.foldisland.core.PxRect
import app.foldisland.core.LiveItem
import app.foldisland.hub.ActivityHub
import app.foldisland.settings.AppConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.ceil
import kotlin.math.floor

private object Palette {
    val text = Color.White
    val muted = Color(0xFFA1A1AA)
    val chip = Color(0xFF26262B)
    val green = Color(0xFF34C759)
    val red = Color(0xFFFF453A)
    val orange = Color(0xFFFF9F0A)
    val yellow = Color(0xFFFFD60A)
    val blue = Color(0xFF0A84FF)
}

/** Shape morph: no bounce (a bouncing island reads as shaking), settles in about 0.4 s. */
private val morphSpec = spring<Rect>(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 550f)
private val radiusSpec = spring<Float>(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 550f)

/** Window frame used while nothing is shown. */
private val HIDDEN_FRAME = PxRect(0, 0, 1, 1)

/** Rounded rect at an arbitrary position inside the layer, used to clip the island content. */
private data class RoundRectShape(val rect: Rect, val radius: Float) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline =
        Outline.Rounded(RoundRect(rect, CornerRadius(radius)))
}

private fun PxRect.toRect() = Rect(left.toFloat(), top.toFloat(), right.toFloat(), bottom.toFloat())

private fun Rect.toPxRect() = PxRect(floor(left).toInt(), floor(top).toInt(), ceil(right).toInt(), ceil(bottom).toInt())

/**
 * The island. The overlay window is sized to [onFrame]'s rectangle, which changes only when a
 * transition starts or ends; the black shape morphs inside it by drawing only (no layout),
 * so the system never has to move or resize the window while it animates.
 */
@Composable
fun IslandRoot(state: IslandUiState, controller: IslandController, onFrame: (PxRect) -> Unit) {
    val p = state.presentation()
    val g = state.geometry
    val density = LocalDensity.current.density
    val tuning = if (g.innerScreen) state.config.innerTuning else state.config.coverTuning
    val m = remember(g, tuning, density) { IslandMetrics(g, tuning, density) }
    val haptics = LocalHapticFeedback.current
    val touchSlop = LocalViewConfiguration.current.touchSlop

    var cardHeight by remember(p.key) { mutableIntStateOf(0) }
    val target: PxRect? = when (p) {
        Presentation.Hidden -> null
        Presentation.Idle -> m.idle
        is Presentation.Compact -> m.compact
        is Presentation.Popup, is Presentation.Expanded, Presentation.Shortcuts ->
            m.card(if (cardHeight > 0) cardHeight else m.cardEstimate)
    }
    val targetRadius = when {
        target == null -> 0f
        p.isCard -> m.cardRadius
        else -> target.height / 2f
    }
    val secondary = (p as? Presentation.Compact)?.view?.secondary
    val bubble = if (secondary != null) m.bubble else null

    val shape = remember { Animatable(Rect.Zero, Rect.VectorConverter) }
    val radius = remember { Animatable(0f) }
    val contentAlpha = remember { Animatable(1f) }
    var settledOn by remember { mutableStateOf<PxRect?>(null) }
    var shownGeometry by remember { mutableStateOf<ScreenGeometry?>(null) }

    // Shape at the moment the target changed: the window covers it and the target until settled.
    // Read without observing, so the animation does not recompose this function on every frame.
    val start = remember(target) {
        Snapshot.withoutReadObservation { shape.value }.takeIf { it != Rect.Zero }?.toPxRect()
    }
    val frame = when {
        target == null -> HIDDEN_FRAME
        settledOn == target -> IslandLayout.windowFrame(null, target, bubble)
        else -> IslandLayout.windowFrame(start, target, bubble)
    }
    // Runs in the same frame as this composition, so the window and its content move together.
    SideEffect { onFrame(frame) }
    val currentFrame by rememberUpdatedState(frame)

    LaunchedEffect(target, targetRadius) {
        if (target == null) {
            shownGeometry = null
            return@LaunchedEffect
        }
        val snap = shape.value == Rect.Zero || shownGeometry != g
        shownGeometry = g
        if (snap) {
            // First show, fold/unfold or rotation: jump, do not fly across the screen.
            shape.snapTo(target.toRect())
            radius.snapTo(targetRadius)
        } else {
            coroutineScope {
                launch { radius.animateTo(targetRadius, radiusSpec) }
                shape.animateTo(target.toRect(), morphSpec)
            }
        }
        settledOn = target
    }
    LaunchedEffect(p.key) {
        contentAlpha.snapTo(0f)
        contentAlpha.animateTo(1f, tween(durationMillis = 180, delayMillis = 70))
    }

    if (target == null) return

    fun local(r: PxRect) = IntOffset(r.left - frame.left, r.top - frame.top)
    fun insideShape(pos: Offset): Boolean {
        val f = currentFrame
        return shape.value.contains(Offset(pos.x + f.left, pos.y + f.top))
    }

    Box(
        Modifier
            .fillMaxSize()
            .drawBehind {
                val r = shape.value
                drawRoundRect(
                    color = Color.Black,
                    topLeft = Offset(r.left - frame.left, r.top - frame.top),
                    size = r.size,
                    cornerRadius = CornerRadius(radius.value),
                )
            }
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { pos -> if (insideShape(pos)) controller.onTap() else state.collapse() },
                    onLongPress = { pos ->
                        if (insideShape(pos)) {
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            controller.onLongPress()
                        }
                    },
                )
            }
            .pointerInput(Unit) {
                var dx = 0f
                var dy = 0f
                detectDragGestures(
                    onDragStart = { dx = 0f; dy = 0f },
                    onDragEnd = { controller.onDrag(dx, dy, touchSlop) },
                ) { change, amount ->
                    change.consume()
                    dx += amount.x
                    dy += amount.y
                }
            },
    ) {
        // Content layer: clipped to the morphing shape and faded in when what is shown changes.
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    val r = shape.value
                    this.shape = RoundRectShape(r.translate(-frame.left.toFloat(), -frame.top.toFloat()), radius.value)
                    clip = true
                    alpha = contentAlpha.value
                },
        ) {
            when (p) {
                is Presentation.Compact -> Box(Modifier.offset { local(m.compact) }) {
                    Compact(p.view, state.now, with(LocalDensity.current) { m.pillHeight.toDp() },
                        with(LocalDensity.current) { m.cameraGap.toDp() })
                }
                is Presentation.Popup, is Presentation.Expanded, Presentation.Shortcuts -> {
                    val card = m.card(if (cardHeight > 0) cardHeight else m.cardEstimate)
                    Box(
                        Modifier
                            .offset { local(card) }
                            .wrapContentSize(Alignment.TopStart, unbounded = true)
                            .onSizeChanged { cardHeight = it.height },
                    ) {
                        val cardW = with(LocalDensity.current) { m.cardWidth.toDp() }
                        val pillH = with(LocalDensity.current) { m.pillHeight.toDp() }
                        Card(cardW, pillH) {
                            when (p) {
                                is Presentation.Popup -> Popup(p.item, state)
                                is Presentation.Expanded -> Expanded(p.item, state, controller)
                                else -> Shortcuts(state.config, controller)
                            }
                        }
                    }
                }
                Presentation.Idle, Presentation.Hidden -> Unit
            }
        }
        if (secondary != null && bubble != null) {
            val size = with(LocalDensity.current) { bubble.height.toDp() }
            Box(
                Modifier
                    .offset { local(bubble) }
                    .size(size)
                    .graphicsLayer { alpha = contentAlpha.value }
                    .clip(CircleShape)
                    .background(Color.Black)
                    .clickable { controller.choose(secondary) },
                contentAlignment = Alignment.Center,
            ) {
                Leading(secondary, size = size * 0.58f)
            }
        }
    }
}

// ───────────────────────────── Compact ─────────────────────────────

@Composable
private fun Compact(view: IslandView, now: Long, pillH: Dp, cameraGap: Dp) {
    val item = view.primary ?: return
    Row(
        Modifier
            .height(pillH)
            .padding(horizontal = IslandDimens.SIDE_PAD_DP.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(IslandDimens.SLOT_DP.dp), contentAlignment = Alignment.CenterStart) {
            Leading(item, size = pillH * 0.62f)
        }
        Spacer(Modifier.width(cameraGap))
        Box(Modifier.width(IslandDimens.SLOT_DP.dp), contentAlignment = Alignment.CenterEnd) {
            Trailing(item, now, pillH)
        }
    }
}

@Composable
private fun Leading(item: LiveItem, size: Dp) {
    val handles = ActivityHub.handles(item.id)
    when (item) {
        is LiveItem.Call -> GlyphCircle(Icons.Rounded.Call, Palette.green, size)
        is LiveItem.Timer -> Icon(Icons.Rounded.Timer, null, tint = Palette.orange, modifier = Modifier.size(size))
        is LiveItem.Reminder -> Icon(Icons.Rounded.NotificationsActive, null, tint = Palette.yellow, modifier = Modifier.size(size))
        is LiveItem.Media -> {
            val art = handles.largeImage?.asImageBitmap()
            if (art != null) Thumb(art, size, 6.dp) else AppIcon(item.sourcePackage, size)
        }
        is LiveItem.Charging -> Icon(Icons.Rounded.BatteryChargingFull, null, tint = Palette.green, modifier = Modifier.size(size))
        is LiveItem.LowBattery -> Icon(Icons.Rounded.BatteryAlert, null, tint = Palette.red, modifier = Modifier.size(size))
        else -> AppIcon(item.sourcePackage, size)
    }
}

@Composable
private fun Trailing(item: LiveItem, now: Long, pillH: Dp) {
    val small = (pillH.value * 0.4f).sp
    when (item) {
        is LiveItem.Ride -> when {
            item.etaMinutes != null -> Label("${item.etaMinutes} phút", Palette.green, small, bold = true)
            item.plate != null -> Label(item.plate, Palette.text, small, bold = true)
            item.progress != null -> LinearProgressIndicator(
                progress = { item.progress },
                modifier = Modifier.width(48.dp).height(4.dp).clip(CircleShape),
                color = Palette.green,
                trackColor = Palette.chip,
            )
            else -> Label(item.title, Palette.text, small)
        }
        is LiveItem.Call -> if (item.incoming || item.startedAt == null) {
            Label(item.caller, Palette.green, small)
        } else {
            Label(formatDuration(now - item.startedAt), Palette.green, small, bold = true)
        }
        is LiveItem.Media -> if (item.playing) Equalizer(pillH * 0.5f) else
            Icon(Icons.Rounded.Pause, null, tint = Palette.muted, modifier = Modifier.size(pillH * 0.55f))
        is LiveItem.Timer -> Label(timerText(item, now), Palette.orange, small, bold = true)
        is LiveItem.Reminder -> Label(item.title, Palette.yellow, small)
        else -> Unit
    }
}

// ───────────────────────────── Cards ─────────────────────────────

@Composable
private fun Card(width: Dp, pillH: Dp, content: @Composable () -> Unit) {
    // Top padding leaves the camera row empty, like the expanded island on iPhone.
    Column(
        Modifier
            .width(width)
            .padding(start = 18.dp, end = 18.dp, top = pillH * 0.9f, bottom = 16.dp),
    ) { content() }
}

@Composable
private fun Popup(item: LiveItem, state: IslandUiState) {
    when (item) {
        is LiveItem.Message -> {
            val hide = state.locked && state.config.hideMessageTextOnLockScreen
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(item, 40.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Label(if (hide) appLabel(item.sourcePackage) else item.sender, Palette.text, 15.sp, bold = true)
                    Label(if (hide) "Tin nhắn mới" else item.text, Palette.muted, 14.sp, maxLines = 2)
                }
            }
        }
        is LiveItem.Charging -> StatusRow(Icons.Rounded.BatteryChargingFull, Palette.green, "Đang sạc", "${item.percent}%")
        is LiveItem.LowBattery -> StatusRow(Icons.Rounded.BatteryAlert, Palette.red, "Pin yếu", "${item.percent}%")
        else -> Unit
    }
}

@Composable
private fun Expanded(item: LiveItem, state: IslandUiState, c: IslandController) {
    val now = state.now
    when (item) {
        is LiveItem.Ride -> {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(item, 44.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Label(item.title.ifBlank { appLabel(item.sourcePackage) }, Palette.text, 16.sp, bold = true)
                    Label(item.text, Palette.muted, 13.sp, maxLines = 2)
                }
                Column(horizontalAlignment = Alignment.End) {
                    item.etaMinutes?.let { Label("$it phút", Palette.green, 22.sp, bold = true) }
                    item.plate?.let { Chip(it) }
                }
            }
            item.progress?.let {
                Spacer(Modifier.height(12.dp))
                LinearProgressIndicator(
                    progress = { it },
                    modifier = Modifier.fillMaxWidth().height(5.dp).clip(CircleShape),
                    color = Palette.green,
                    trackColor = Palette.chip,
                )
            }
            Spacer(Modifier.height(12.dp))
            PillButton("Mở ${appLabel(item.sourcePackage)}", Palette.chip) { c.open(item); state.collapse() }
        }

        is LiveItem.Call -> {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(item, 48.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Label(item.caller, Palette.text, 18.sp, bold = true)
                    val sub = when {
                        item.incoming -> "Cuộc gọi đến · ${appLabel(item.sourcePackage)}"
                        item.startedAt != null -> formatDuration(now - item.startedAt)
                        else -> "Đang gọi…"
                    }
                    Label(sub, Palette.muted, 13.sp)
                }
                if (item.incoming) {
                    RoundButton(Icons.Rounded.CallEnd, Palette.red) { c.decline(item) }
                    Spacer(Modifier.width(14.dp))
                    RoundButton(Icons.Rounded.Call, Palette.green) { c.answer(item) }
                } else {
                    RoundButton(Icons.Rounded.CallEnd, Palette.red) { c.hangUp(item) }
                }
            }
        }

        is LiveItem.Media -> {
            val art = ActivityHub.handles(item.id).largeImage?.asImageBitmap()
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (art != null) Thumb(art, 56.dp, 12.dp) else AppIcon(item.sourcePackage, 56.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Label(item.title, Palette.text, 16.sp, bold = true)
                    Label(item.artist, Palette.muted, 13.sp)
                }
                if (item.playing) Equalizer(22.dp)
            }
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                GlyphButton(Icons.Rounded.SkipPrevious, 34.dp) { c.previous(item) }
                GlyphButton(if (item.playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, 42.dp) { c.playPause(item) }
                GlyphButton(Icons.Rounded.SkipNext, 34.dp) { c.next(item) }
            }
        }

        is LiveItem.Timer -> {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Timer, null, tint = Palette.orange, modifier = Modifier.size(32.dp))
                Spacer(Modifier.width(12.dp))
                Label(item.label.ifBlank { "Đồng hồ" }, Palette.text, 16.sp, modifier = Modifier.weight(1f))
                Label(timerText(item, now), Palette.orange, 32.sp, bold = true)
            }
        }

        is LiveItem.Reminder -> {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.NotificationsActive, null, tint = Palette.yellow, modifier = Modifier.size(34.dp))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Label(item.title, Palette.text, 18.sp, bold = true)
                    Label("Nhắc lịch", Palette.muted, 13.sp)
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PillButton("Đã xong", Palette.green, Modifier.weight(1f), icon = Icons.Rounded.Check) { c.reminderDone(item) }
                PillButton("Nhắc lại 10'", Palette.chip, Modifier.weight(1f), icon = Icons.Rounded.Snooze) { c.reminderSnooze(item) }
            }
        }

        else -> Popup(item, state)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Shortcuts(config: AppConfig, c: IslandController) {
    val context = LocalContext.current
    val empty = config.places.isEmpty() && config.contacts.isEmpty() && config.pinnedApps.isEmpty()
    if (empty) {
        Label("Chưa có phím tắt. Mở Fold Island để thêm Grab, số gọi nhanh và app ghim.", Palette.muted, 14.sp, maxLines = 3)
    }
    if (config.places.isNotEmpty()) {
        Section("Đặt Grab")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            config.places.forEach { place ->
                PillButton(place.name, Palette.chip, icon = Icons.Rounded.LocalTaxi, tint = Palette.green) { c.bookGrab(place) }
            }
        }
    }
    if (config.contacts.isNotEmpty()) {
        Section("Gọi nhanh")
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            config.contacts.forEach { contact ->
                Column(
                    Modifier.width(60.dp).clip(RoundedCornerShape(12.dp)).clickable { c.call(contact) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Initials(contact.name, 46.dp, Palette.green)
                    Spacer(Modifier.height(4.dp))
                    Label(contact.name, Palette.text, 12.sp)
                }
            }
        }
    }
    if (config.pinnedApps.isNotEmpty()) {
        Section("Ứng dụng")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            config.pinnedApps.forEach { pkg ->
                Column(
                    Modifier.width(60.dp).clip(RoundedCornerShape(12.dp)).clickable { c.launch(pkg) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    AppIcon(pkg, 44.dp)
                    Spacer(Modifier.height(4.dp))
                    Label(remember(pkg) { AppIcons.label(context, pkg) }, Palette.text, 11.sp)
                }
            }
        }
    }
    Spacer(Modifier.height(8.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        GlyphButton(Icons.Rounded.Settings, 26.dp, Palette.muted) { c.openSettings() }
    }
}

// ───────────────────────────── Pieces ─────────────────────────────

@Composable
private fun Section(title: String) {
    Spacer(Modifier.height(10.dp))
    Label(title.uppercase(), Palette.muted, 11.sp, bold = true)
    Spacer(Modifier.height(8.dp))
}

@Composable
private fun Label(
    text: String,
    color: Color,
    size: TextUnit,
    modifier: Modifier = Modifier,
    bold: Boolean = false,
    maxLines: Int = 1,
) {
    Text(
        text = text,
        color = color,
        fontSize = size,
        fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal,
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier,
    )
}

@Composable
private fun StatusRow(icon: ImageVector, tint: Color, title: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(30.dp))
        Spacer(Modifier.width(12.dp))
        Label(title, Palette.text, 16.sp, bold = true, modifier = Modifier.weight(1f))
        Label(value, tint, 22.sp, bold = true)
    }
}

@Composable
private fun Chip(text: String) {
    Box(
        Modifier.clip(RoundedCornerShape(8.dp)).background(Palette.chip).padding(horizontal = 8.dp, vertical = 3.dp),
    ) { Label(text, Palette.text, 13.sp, bold = true) }
}

@Composable
private fun PillButton(
    text: String,
    background: Color,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    tint: Color = Palette.text,
    onClick: () -> Unit,
) {
    Row(
        modifier
            .clip(CircleShape)
            .background(background)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
        }
        Label(text, Palette.text, 14.sp, bold = true)
    }
}

@Composable
private fun RoundButton(icon: ImageVector, color: Color, onClick: () -> Unit) {
    Box(
        Modifier.size(48.dp).clip(CircleShape).background(color).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, null, tint = Color.White, modifier = Modifier.size(26.dp)) }
}

@Composable
private fun GlyphButton(icon: ImageVector, size: Dp, tint: Color = Palette.text, onClick: () -> Unit) {
    Box(
        Modifier.size(size + 14.dp).clip(CircleShape).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, null, tint = tint, modifier = Modifier.size(size)) }
}

@Composable
private fun GlyphCircle(icon: ImageVector, color: Color, size: Dp) {
    Box(Modifier.size(size).clip(CircleShape).background(color), contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = Color.White, modifier = Modifier.size(size * 0.62f))
    }
}

@Composable
private fun Thumb(image: ImageBitmap, size: Dp, corner: Dp) {
    Image(
        bitmap = image,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier.size(size).clip(RoundedCornerShape(corner)),
    )
}

@Composable
private fun AppIcon(packageName: String?, size: Dp) {
    val context = LocalContext.current
    // Loaded off the main thread: the first lookup of another app's icon can take a while.
    val icon by produceState(AppIcons.cached(packageName), packageName) {
        if (value == null) value = withContext(Dispatchers.Default) { AppIcons.get(context, packageName) }
    }
    val loaded = icon
    if (loaded != null) Thumb(loaded, size, size / 4) else Spacer(Modifier.size(size))
}

/** Notification picture (caller photo, driver, chat avatar) or the app icon. */
@Composable
private fun Avatar(item: LiveItem, size: Dp) {
    val context = LocalContext.current
    val largeIcon = ActivityHub.handles(item.id).largeIcon
    val picture by produceState<ImageBitmap?>(null, largeIcon) {
        value = largeIcon?.let { icon ->
            withContext(Dispatchers.Default) {
                runCatching { icon.loadDrawable(context)?.toBitmap(160, 160)?.asImageBitmap() }.getOrNull()
            }
        }
    }
    val loaded = picture
    when {
        loaded != null -> Image(
            bitmap = loaded,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.size(size).clip(CircleShape),
        )
        item is LiveItem.Call -> Initials(item.caller, size, Palette.blue)
        else -> AppIcon(item.sourcePackage, size)
    }
}

@Composable
private fun Initials(name: String, size: Dp, color: Color) {
    val letters = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        .let { parts -> (parts.lastOrNull()?.take(1) ?: "?").uppercase() }
    Box(Modifier.size(size).clip(CircleShape).background(color.copy(alpha = 0.25f)), contentAlignment = Alignment.Center) {
        Label(letters, color, (size.value * 0.42f).sp, bold = true)
    }
}

@Composable
private fun Equalizer(height: Dp) {
    val transition = rememberInfiniteTransition(label = "eq")
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
        listOf(0, 180, 90, 260).forEach { offset ->
            val f by transition.animateFloat(
                initialValue = 0.3f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(tween(420, delayMillis = offset), RepeatMode.Reverse),
                label = "bar",
            )
            Box(Modifier.width(3.dp).height(height * f).clip(CircleShape).background(Palette.green))
        }
    }
}

@Composable
private fun appLabel(packageName: String?): String {
    val context = LocalContext.current
    return remember(packageName) { packageName?.let { AppIcons.label(context, it) } ?: "" }
}

private fun timerText(item: LiveItem.Timer, now: Long): String =
    formatDuration(if (item.countDown) item.baseAt - now else now - item.baseAt)

/** 75_000 → "1:15", 3_725_000 → "1:02:05". Negative values clamp to zero. */
internal fun formatDuration(ms: Long): String {
    val total = (ms.coerceAtLeast(0) / 1000)
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}
