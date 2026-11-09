package app.foldisland.settings

import android.Manifest
import android.app.AlarmManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import app.foldisland.overlay.IslandAccessibilityService
import app.foldisland.sources.IslandNotificationListener

/** One line of the first-run checklist. [ok] = null means "cannot be checked automatically". */
data class SetupStep(
    val key: String,
    val title: String,
    val detail: String,
    val ok: Boolean?,
    val optional: Boolean = false,
)

object Setup {

    const val RESTRICTED = "restricted"
    const val ACCESSIBILITY = "accessibility"
    const val NOTIFICATIONS_ACCESS = "notification_access"
    const val POST_NOTIFICATIONS = "post_notifications"
    const val BATTERY = "battery"
    const val CALL_PHONE = "call_phone"

    fun steps(context: Context): List<SetupStep> {
        val a11y = accessibilityEnabled(context)
        val listener = notificationAccess(context)
        return listOf(
            SetupStep(
                RESTRICTED,
                "Cho phép cài đặt hạn chế",
                "APK cài tay bị Android khoá quyền Trợ năng và Đọc thông báo. Mở Thông tin ứng dụng → ⋮ (góc trên phải) → Cho phép cài đặt hạn chế. Nếu hai mục dưới đã xanh thì bỏ qua bước này.",
                ok = if (a11y && listener) true else null,
            ),
            SetupStep(
                ACCESSIBILITY,
                "Bật Fold Island trong Trợ năng",
                "Cài đặt → Trợ năng → Ứng dụng đã cài đặt → Fold Island → Bật. Chỉ dùng để vẽ island đè lên thanh trạng thái.",
                ok = a11y,
            ),
            SetupStep(
                NOTIFICATIONS_ACCESS,
                "Cho phép đọc thông báo",
                "Để island thấy Grab, cuộc gọi, tin nhắn, nhạc và đồng hồ.",
                ok = listener,
            ),
            SetupStep(
                POST_NOTIFICATIONS,
                "Cho phép gửi thông báo",
                "Nhắc lịch luôn kèm một thông báo dự phòng.",
                ok = context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED,
            ),
            SetupStep(
                BATTERY,
                "Pin: Không hạn chế",
                "Để Samsung không tắt island khi chạy nền. Thêm nữa: Chăm sóc thiết bị → Pin → Giới hạn sử dụng nền → Ứng dụng không bao giờ ngủ → thêm Fold Island.",
                ok = context.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(context.packageName) &&
                    context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms(),
            ),
            SetupStep(
                CALL_PHONE,
                "Quyền gọi điện (tuỳ chọn)",
                "Gọi nhanh sẽ gọi luôn. Không cấp thì mở bàn phím số điền sẵn số.",
                ok = context.checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED,
                optional = true,
            ),
        )
    }

    fun accessibilityEnabled(context: Context): Boolean {
        val expected = ComponentName(context, IslandAccessibilityService::class.java)
        val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
            ?: return false
        return enabled.split(':').any { ComponentName.unflattenFromString(it) == expected }
    }

    fun notificationAccess(context: Context): Boolean =
        context.packageName in NotificationManagerCompat.getEnabledListenerPackages(context)

    fun appDetails(context: Context) =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))

    fun accessibilitySettings() = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)

    fun notificationAccessSettings(context: Context) =
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).putExtra(
            Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
            ComponentName(context, IslandNotificationListener::class.java).flattenToString(),
        )

    @android.annotation.SuppressLint("BatteryLife") // sideloaded personal app, see manifest
    fun batterySettings(context: Context) =
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.fromParts("package", context.packageName, null))
}
