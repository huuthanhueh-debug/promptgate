package app.foldisland.core

data class LatLng(val lat: Double, val lng: Double)

/** Reads coordinates copied from Google Maps (long-press value or a full maps URL). */
object Coordinates {

    private const val NUM = """-?\d{1,3}(?:\.\d+)?"""
    private const val DEC = """-?\d{1,3}\.\d+"""

    private val atPattern = Regex("""@($NUM),($NUM)""")
    private val queryPattern = Regex("""[?&](?:q|query|ll|destination|daddr)=($NUM),($NUM)""")
    private val plainPattern = Regex("""^\(?\s*($DEC)\s*,\s*($DEC)\s*\)?$""")

    fun parse(input: String): LatLng? {
        val s = input.trim().replace("%2C", ",", ignoreCase = true)
        if (s.isEmpty()) return null
        val match = atPattern.find(s) ?: queryPattern.find(s) ?: plainPattern.find(s) ?: return null
        val lat = match.groupValues[1].toDoubleOrNull() ?: return null
        val lng = match.groupValues[2].toDoubleOrNull() ?: return null
        if (lat !in -90.0..90.0 || lng !in -180.0..180.0) return null
        return LatLng(lat, lng)
    }
}
