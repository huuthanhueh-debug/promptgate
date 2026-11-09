package app.foldisland.settings

import android.content.Context
import android.content.Intent

data class InstalledApp(val packageName: String, val label: String)

object InstalledApps {
    /** Apps with a launcher icon, sorted by name. Call off the main thread. */
    fun load(context: Context): List<InstalledApp> {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return pm.queryIntentActivities(intent, 0)
            .map { InstalledApp(it.activityInfo.packageName, it.loadLabel(pm).toString()) }
            .filter { it.packageName != context.packageName }
            .distinctBy { it.packageName }
            .sortedBy { it.label.lowercase() }
    }
}
