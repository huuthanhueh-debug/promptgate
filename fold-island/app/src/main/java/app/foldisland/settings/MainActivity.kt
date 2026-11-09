package app.foldisland.settings

import android.Manifest
import android.app.TimePickerDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import android.provider.ContactsContract
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.automirrored.rounded.HelpOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.foldisland.IslandApp
import app.foldisland.core.Coordinates
import app.foldisland.core.GrabLink
import app.foldisland.overlay.AppIcons
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID
import kotlin.math.roundToInt

private val Green = Color(0xFF34C759)
private val Red = Color(0xFFFF453A)
private val Card = Color(0xFF1C1C1E)
private val Muted = Color(0xFFA1A1AA)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Green, background = Color.Black, surface = Card)) {
                SettingsScreen()
            }
        }
    }
}

@Composable
private fun SettingsScreen() {
    val repo = IslandApp.instance.settings
    val config by repo.config.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val update: (AppConfig.() -> AppConfig) -> Unit = { t -> scope.launch { repo.update { it.t() } } }

    LazyColumn(
        Modifier.fillMaxSize().background(Color.Black).safeDrawingPadding().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Fold Island", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text("Dynamic Island cho Galaxy Z Fold", color = Muted, fontSize = 14.sp)
                }
                Switch(checked = config.enabled, onCheckedChange = { on -> update { copy(enabled = on) } })
            }
        }
        item { SetupSection() }
        item { PlacesSection(config, update) }
        item { ContactsSection(config, update) }
        item { PinnedAppsSection(config, update) }
        item { RemindersSection(config, update) }
        item { RideAppsSection(config, update) }
        item { AppearanceSection(config, update) }
        item { AdvancedSection(config, update) }
        item {
            Text(
                "Fold Island không có quyền Internet. Thông báo, địa điểm và số điện thoại chỉ nằm trong máy.",
                color = Muted, fontSize = 12.sp, modifier = Modifier.padding(bottom = 24.dp),
            )
        }
    }
}

// ───────────────────────────── Setup ─────────────────────────────

@Composable
private fun SetupSection() {
    val context = LocalContext.current
    var steps by remember { mutableStateOf(Setup.steps(context)) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { steps = Setup.steps(context) }
    val notifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        steps = Setup.steps(context)
    }
    val callPhone = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        steps = Setup.steps(context)
    }
    fun open(intent: Intent) {
        try { context.startActivity(intent) } catch (_: ActivityNotFoundException) { context.startActivity(Setup.appDetails(context)) }
    }
    val done = steps.filter { !it.optional }.all { it.ok != false }
    Section(if (done) "Thiết lập · xong" else "Thiết lập") {
        steps.forEach { step ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.Top) {
                val (icon, tint) = when (step.ok) {
                    true -> Icons.Rounded.CheckCircle to Green
                    false -> Icons.Rounded.ErrorOutline to if (step.optional) Muted else Red
                    null -> Icons.AutoMirrored.Rounded.HelpOutline to Muted
                }
                Icon(icon, null, tint = tint, modifier = Modifier.size(22.dp).padding(top = 2.dp))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(step.title, color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text(step.detail, color = Muted, fontSize = 13.sp)
                }
                if (step.ok != true) {
                    TextButton(onClick = {
                        when (step.key) {
                            Setup.RESTRICTED -> open(Setup.appDetails(context))
                            Setup.ACCESSIBILITY -> open(Setup.accessibilitySettings())
                            Setup.NOTIFICATIONS_ACCESS -> open(Setup.notificationAccessSettings(context))
                            Setup.POST_NOTIFICATIONS -> notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
                            Setup.BATTERY -> open(Setup.batterySettings(context))
                            Setup.CALL_PHONE -> callPhone.launch(Manifest.permission.CALL_PHONE)
                        }
                    }) { Text("Mở") }
                }
            }
        }
    }
}

// ───────────────────────────── Grab places ─────────────────────────────

@Composable
private fun PlacesSection(config: AppConfig, update: (AppConfig.() -> AppConfig) -> Unit) {
    var name by remember { mutableStateOf("") }
    var coords by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    Section("Đặt Grab nhanh (${config.places.size}/${AppConfig.MAX_PLACES})") {
        config.places.forEach { place ->
            ListRow(place.name, "%.5f, %.5f".format(place.lat, place.lng)) {
                update { copy(places = places - place) }
            }
        }
        if (config.places.size < AppConfig.MAX_PLACES) {
            Hint("Trên Google Maps: nhấn giữ điểm đến → chạm vào dòng toạ độ trên ô tìm kiếm để copy → dán vào đây. Dán link Google Maps cũng được.")
            OutlinedTextField(name, { name = it }, label = { Text("Tên (vd: Nhà, Khách sạn)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                coords, { coords = it; error = null },
                label = { Text("Toạ độ") }, placeholder = { Text("10.3460, 107.0843") },
                isError = error != null, supportingText = error?.let { { Text(it) } },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
            AddButton("Thêm địa điểm") {
                val point = Coordinates.parse(coords)
                when {
                    name.isBlank() -> error = "Nhập tên địa điểm"
                    point == null -> error = "Không đọc được toạ độ. Dạng đúng: 10.3460, 107.0843"
                    else -> {
                        update { copy(places = places + Place(UUID.randomUUID().toString(), name.trim(), point.lat, point.lng)) }
                        name = ""; coords = ""; error = null
                    }
                }
            }
        }
    }
}

// ───────────────────────────── Quick calls ─────────────────────────────

/** Opens the system phone picker; the result grants read access to that one entry only. */
private class PickPhone : ActivityResultContract<Unit, android.net.Uri?>() {
    override fun createIntent(context: android.content.Context, input: Unit) =
        Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)
    override fun parseResult(resultCode: Int, intent: Intent?) = intent?.data
}

@Composable
private fun ContactsSection(config: AppConfig, update: (AppConfig.() -> AppConfig) -> Unit) {
    val context = LocalContext.current
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    val picker = rememberLauncherForActivityResult(PickPhone()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
        )
        runCatching {
            context.contentResolver.query(uri, projection, null, null, null)?.use { c ->
                if (c.moveToFirst()) { name = c.getString(0).orEmpty(); phone = c.getString(1).orEmpty() }
            }
        }
    }
    Section("Gọi nhanh (${config.contacts.size}/${AppConfig.MAX_CONTACTS})") {
        config.contacts.forEach { contact ->
            ListRow(contact.name, contact.phone) { update { copy(contacts = contacts - contact) } }
        }
        if (config.contacts.size < AppConfig.MAX_CONTACTS) {
            TextButton(onClick = { picker.launch(Unit) }) { Text("Chọn từ danh bạ") }
            OutlinedTextField(name, { name = it }, label = { Text("Tên hiển thị") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(phone, { phone = it }, label = { Text("Số điện thoại") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            AddButton("Thêm số gọi nhanh") {
                val digits = phone.filter { it.isDigit() || it == '+' }
                if (name.isNotBlank() && digits.length >= 3) {
                    update { copy(contacts = contacts + QuickContact(UUID.randomUUID().toString(), name.trim(), digits)) }
                    name = ""; phone = ""
                }
            }
        }
    }
}

// ───────────────────────────── Apps ─────────────────────────────

@Composable
private fun PinnedAppsSection(config: AppConfig, update: (AppConfig.() -> AppConfig) -> Unit) {
    var picking by remember { mutableStateOf(false) }
    Section("App ghim (${config.pinnedApps.size}/${AppConfig.MAX_PINNED_APPS})") {
        config.pinnedApps.forEach { pkg -> AppRow(pkg) { update { copy(pinnedApps = pinnedApps - pkg) } } }
        if (config.pinnedApps.size < AppConfig.MAX_PINNED_APPS) AddButton("Ghim app") { picking = true }
    }
    if (picking) {
        AppPickerDialog(exclude = config.pinnedApps.toSet(), onDismiss = { picking = false }) { pkg ->
            update { copy(pinnedApps = (pinnedApps + pkg).take(AppConfig.MAX_PINNED_APPS)) }
            picking = false
        }
    }
}

@Composable
private fun RideAppsSection(config: AppConfig, update: (AppConfig.() -> AppConfig) -> Unit) {
    var picking by remember { mutableStateOf(false) }
    Section("App gọi xe / giao hàng") {
        Hint("Thông báo đang chạy của các app này hiện thành chuyến đi trên island (tài xế, biển số, ETA).")
        config.rideApps.forEach { pkg -> AppRow(pkg) { update { copy(rideApps = rideApps - pkg) } } }
        AddButton("Thêm app (Be, Xanh SM, ShopeeFood…)") { picking = true }
    }
    if (picking) {
        AppPickerDialog(exclude = config.rideApps.toSet(), onDismiss = { picking = false }) { pkg ->
            update { copy(rideApps = rideApps + pkg) }
            picking = false
        }
    }
}

@Composable
private fun AppPickerDialog(exclude: Set<String>, onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val context = LocalContext.current
    var apps by remember { mutableStateOf<List<InstalledApp>?>(null) }
    var query by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { apps = withContext(Dispatchers.IO) { InstalledApps.load(context) } }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Đóng") } },
        title = { Text("Chọn app") },
        text = {
            Column {
                OutlinedTextField(query, { query = it }, label = { Text("Tìm") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                val list = apps
                if (list == null) {
                    Text("Đang tải…", color = Muted)
                } else {
                    val shown = list.filter { it.packageName !in exclude && it.label.contains(query, ignoreCase = true) }
                    LazyColumn(Modifier.heightIn(max = 420.dp)) {
                        items(shown, key = { it.packageName }) { app ->
                            Row(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { onPick(app.packageName) }.padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                AppIconImage(app.packageName)
                                Spacer(Modifier.width(12.dp))
                                Text(app.label, color = Color.White)
                            }
                        }
                    }
                }
            }
        },
    )
}

// ───────────────────────────── Reminders ─────────────────────────────

private val dayLabels = listOf(1 to "T2", 2 to "T3", 3 to "T4", 4 to "T5", 5 to "T6", 6 to "T7", 7 to "CN")

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RemindersSection(config: AppConfig, update: (AppConfig.() -> AppConfig) -> Unit) {
    val context = LocalContext.current
    var title by remember { mutableStateOf("") }
    var hour by remember { mutableIntStateOf(21) }
    var minute by remember { mutableIntStateOf(0) }
    var days by remember { mutableStateOf(emptySet<Int>()) }
    Section("Nhắc lịch") {
        config.reminders.forEach { r ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(r.title, color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text("%02d:%02d · %s".format(r.hour, r.minute, daysText(r.days)), color = Muted, fontSize = 13.sp)
                }
                Switch(checked = r.enabled, onCheckedChange = { on ->
                    update { copy(reminders = reminders.map { if (it.id == r.id) it.copy(enabled = on) else it }) }
                })
                IconButton(onClick = { update { copy(reminders = reminders.filterNot { it.id == r.id }) } }) {
                    Icon(Icons.Rounded.Close, "Xoá", tint = Muted)
                }
            }
        }
        OutlinedTextField(title, { title = it }, label = { Text("Nội dung (vd: Tiêm insulin)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Giờ: ", color = Muted)
            TextButton(onClick = {
                TimePickerDialog(context, { _, h, m -> hour = h; minute = m }, hour, minute, true).show()
            }) { Text("%02d:%02d".format(hour, minute), fontSize = 18.sp) }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            dayLabels.forEach { (d, label) ->
                FilterChip(selected = d in days, onClick = { days = if (d in days) days - d else days + d }, label = { Text(label) })
            }
        }
        Hint("Không chọn ngày nào = nhắc mỗi ngày.")
        AddButton("Thêm nhắc lịch") {
            if (title.isNotBlank()) {
                update { copy(reminders = reminders + Reminder(UUID.randomUUID().toString(), title.trim(), hour, minute, days)) }
                title = ""; days = emptySet()
            }
        }
    }
}

private fun daysText(days: Set<Int>): String =
    if (days.isEmpty() || days.size == 7) "Mỗi ngày" else dayLabels.filter { it.first in days }.joinToString(" ") { it.second }

// ───────────────────────────── Appearance ─────────────────────────────

@Composable
private fun AppearanceSection(config: AppConfig, update: (AppConfig.() -> AppConfig) -> Unit) {
    val inner = LocalConfiguration.current.smallestScreenWidthDp >= 600
    val tuning = if (inner) config.innerTuning else config.coverTuning
    val setTuning: (Tuning) -> Unit = { t -> update { if (inner) copy(innerTuning = t) else copy(coverTuning = t) } }
    Section("Giao diện") {
        Text("Lúc không có gì", color = Color.White)
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf(IdleStyle.PILL to "Viên nhỏ quanh camera", IdleStyle.HIDDEN to "Ẩn").forEachIndexed { i, (style, label) ->
                SegmentedButton(
                    selected = config.idleStyle == style,
                    onClick = { update { copy(idleStyle = style) } },
                    shape = SegmentedButtonDefaults.itemShape(i, 2),
                ) { Text(label, fontSize = 13.sp) }
            }
        }
        ToggleRow("Ẩn khi xoay ngang", config.hideInLandscape) { on -> update { copy(hideInLandscape = on) } }
        ToggleRow("Ẩn nội dung tin nhắn khi khoá màn hình", config.hideMessageTextOnLockScreen) { on ->
            update { copy(hideMessageTextOnLockScreen = on) }
        }
        Spacer(Modifier.height(8.dp))
        Text("Tinh chỉnh vị trí · ${if (inner) "màn trong" else "màn ngoài"}", color = Color.White, fontWeight = FontWeight.SemiBold)
        Hint("Mỗi màn lưu riêng. Mở app trên màn kia để chỉnh màn kia. Island đổi ngay khi kéo.")
        SliderRow("Ngang", tuning.offsetX.toFloat(), -Tuning.MAX_OFFSET.toFloat()..Tuning.MAX_OFFSET.toFloat(), "${tuning.offsetX} px") {
            setTuning(tuning.copy(offsetX = it.roundToInt()))
        }
        SliderRow("Dọc", tuning.offsetY.toFloat(), -Tuning.MAX_OFFSET.toFloat()..Tuning.MAX_OFFSET.toFloat(), "${tuning.offsetY} px") {
            setTuning(tuning.copy(offsetY = it.roundToInt()))
        }
        SliderRow("Kích thước", tuning.scale, Tuning.MIN_SCALE..Tuning.MAX_SCALE, "${(tuning.scale * 100).roundToInt()}%") {
            setTuning(tuning.copy(scale = (it * 20).roundToInt() / 20f))
        }
        TextButton(onClick = { setTuning(Tuning()) }) { Text("Về mặc định") }
    }
}

@Composable
private fun AdvancedSection(config: AppConfig, update: (AppConfig.() -> AppConfig) -> Unit) {
    var template by remember(config.grabTemplate) { mutableStateOf(config.grabTemplate) }
    Section("Nâng cao") {
        Hint("Mẫu link mở Grab. Grab không công bố định dạng này; nếu Grab đổi, sửa ở đây không cần cài lại app. Dùng {lat}, {lng}, {name}.")
        OutlinedTextField(template, { template = it }, label = { Text("Mẫu deep link Grab") }, modifier = Modifier.fillMaxWidth())
        Row {
            TextButton(onClick = { update { copy(grabTemplate = template.trim()) } }) { Text("Lưu") }
            TextButton(onClick = { template = GrabLink.DEFAULT_TEMPLATE; update { copy(grabTemplate = GrabLink.DEFAULT_TEMPLATE) } }) {
                Text("Khôi phục mặc định")
            }
        }
    }
}

// ───────────────────────────── Shared pieces ─────────────────────────────

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Card).padding(16.dp)) {
        Text(title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        content()
    }
}

@Composable
private fun Hint(text: String) {
    Text(text, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(vertical = 4.dp))
}

@Composable
private fun ListRow(title: String, subtitle: String, onRemove: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = Muted, fontSize = 13.sp)
        }
        IconButton(onClick = onRemove) { Icon(Icons.Rounded.Close, "Xoá", tint = Muted) }
    }
}

@Composable
private fun AppRow(packageName: String, onRemove: () -> Unit) {
    val context = LocalContext.current
    val label = remember(packageName) { AppIcons.label(context, packageName) }
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        AppIconImage(packageName)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = Color.White)
            Text(packageName, color = Muted, fontSize = 11.sp)
        }
        IconButton(onClick = onRemove) { Icon(Icons.Rounded.Close, "Xoá", tint = Muted) }
    }
}

@Composable
private fun AppIconImage(packageName: String) {
    val context = LocalContext.current
    val icon = remember(packageName) { AppIcons.get(context, packageName) }
    if (icon != null) {
        Image(icon, null, Modifier.size(36.dp).clip(RoundedCornerShape(9.dp)))
    } else {
        Box(Modifier.size(36.dp).clip(CircleShape).background(Color.DarkGray))
    }
}

@Composable
private fun AddButton(text: String, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Icon(Icons.Rounded.Add, null)
        Spacer(Modifier.width(6.dp))
        Text(text)
    }
}

@Composable
private fun ToggleRow(text: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(text, color = Color.White, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
private fun SliderRow(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    valueText: String,
    onChange: (Float) -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Muted, modifier = Modifier.width(80.dp))
        Slider(value = value, onValueChange = onChange, valueRange = range, modifier = Modifier.weight(1f))
        Text(valueText, color = Color.White, modifier = Modifier.width(56.dp), fontSize = 13.sp)
    }
}
