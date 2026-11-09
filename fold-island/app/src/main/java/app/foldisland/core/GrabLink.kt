package app.foldisland.core

import java.net.URLEncoder
import java.util.Locale

/**
 * Builds the Grab deep link for a saved drop-off point.
 *
 * Grab does not publish this format; it is community-documented and may change. The
 * template is user-editable in Settings → Advanced, and the app falls back to opening
 * Grab normally when the link does not resolve.
 */
object GrabLink {
    const val PACKAGE = "com.grabtaxi.passenger"

    const val DEFAULT_TEMPLATE =
        "grab://open?screenType=BOOKING&dropOffLatitude={lat}&dropOffLongitude={lng}&dropOffAddress={name}"

    fun build(template: String, lat: Double, lng: Double, name: String): String {
        val t = template.ifBlank { DEFAULT_TEMPLATE }
        return t.replace("{lat}", coord(lat))
            .replace("{lng}", coord(lng))
            .replace("{name}", encode(name))
    }

    private fun coord(v: Double): String =
        String.format(Locale.US, "%.6f", v).trimEnd('0').trimEnd('.')

    private fun encode(s: String): String =
        URLEncoder.encode(s, "UTF-8").replace("+", "%20")
}
