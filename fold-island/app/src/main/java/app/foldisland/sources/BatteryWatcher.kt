package app.foldisland.sources

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import app.foldisland.core.LiveItem
import app.foldisland.hub.ActivityHub

/** Charging and low-battery popups. Registered by the overlay service while it runs. */
class BatteryWatcher(private val context: Context) {

    private var lastLevel = -1

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            val now = System.currentTimeMillis()
            when (intent.action) {
                Intent.ACTION_POWER_CONNECTED -> {
                    ActivityHub.remove(LiveItem.LowBattery(0, 0, null).id)
                    ActivityHub.put(LiveItem.Charging(now, percent(), now + CHARGING_POPUP_MS))
                }
                Intent.ACTION_BATTERY_CHANGED -> {
                    val level = levelOf(intent)
                    val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0
                    if (!plugged && level in 0..LOW_LEVEL && lastLevel > LOW_LEVEL) {
                        ActivityHub.put(LiveItem.LowBattery(now, level, now + LOW_POPUP_MS))
                    }
                    if (level >= 0) lastLevel = level
                }
            }
        }
    }

    fun start() {
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_BATTERY_CHANGED)
        }
        context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)?.let { lastLevel = levelOf(it) }
    }

    fun stop() {
        runCatching { context.unregisterReceiver(receiver) }
    }

    private fun percent(): Int =
        context.getSystemService(BatteryManager::class.java)
            .getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)

    private fun levelOf(intent: Intent): Int {
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        return if (level >= 0 && scale > 0) level * 100 / scale else -1
    }

    companion object {
        const val LOW_LEVEL = 15
        const val CHARGING_POPUP_MS = 3_000L
        const val LOW_POPUP_MS = 4_000L
    }
}
