package app.foldisland.overlay

import android.content.Context
import android.util.LruCache
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.graphics.drawable.toBitmap

/** Small cache of launcher icons as Compose bitmaps. */
object AppIcons {
    private val cache = LruCache<String, ImageBitmap>(48)
    private val labels = LruCache<String, String>(96)

    fun cached(packageName: String?): ImageBitmap? = packageName?.let { cache.get(it) }

    fun get(context: Context, packageName: String?, sizePx: Int = 96): ImageBitmap? {
        if (packageName.isNullOrBlank()) return null
        cache.get(packageName)?.let { return it }
        val bitmap = runCatching {
            context.packageManager.getApplicationIcon(packageName).toBitmap(sizePx, sizePx).asImageBitmap()
        }.getOrNull() ?: return null
        cache.put(packageName, bitmap)
        return bitmap
    }

    fun label(context: Context, packageName: String): String {
        labels.get(packageName)?.let { return it }
        val label = runCatching {
            val pm = context.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
        }.getOrDefault(packageName)
        labels.put(packageName, label)
        return label
    }
}
