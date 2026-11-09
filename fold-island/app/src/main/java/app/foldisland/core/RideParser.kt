package app.foldisland.core

/** Pulls the useful bits out of ride-hailing / delivery notification text. */
object RideParser {

    data class RideInfo(val etaMinutes: Int?, val plate: String?)

    private val eta = Regex(
        """(\d{1,3})\s*(?:phút|phut|mins?|minutes?)(?!\p{L})""",
        RegexOption.IGNORE_CASE,
    )

    // 51G-123.45 · 72A12345 · 59-X1 234.56 · 72B1 23456 · 29A-1234
    private val plateRegex = Regex(
        """(?<![\p{L}\d])(\d{2})[\s-]*([A-Z]{1,2}\d?)[\s-]*(\d{3})[.\s]?(\d{2})(?![\p{L}\d])""" +
            """|(?<![\p{L}\d])(\d{2})[\s-]*([A-Z]{1,2}\d?)[\s-]*(\d{4})(?![\p{L}\d.])""",
    )

    private val tripWords = listOf(
        "tài xế", "tai xe", "driver", "đang đến", "dang den", "đã đến", "arriv",
        "điểm đón", "pick-up", "pickup", "on the way", "đang trên đường",
        "đang giao", "delivering", "đơn hàng của bạn", "your order", "biển số",
    )

    private val promoWords = listOf(
        "giảm", "ưu đãi", "voucher", "khuyến mãi", "khuyen mai", "promo", "% off", "deal",
    )

    fun parse(text: String): RideInfo = RideInfo(etaMinutes(text), plate(text))

    fun etaMinutes(text: String): Int? =
        eta.find(text)?.groupValues?.get(1)?.toIntOrNull()?.takeIf { it in 0..180 }

    fun plate(text: String): String? {
        val m = plateRegex.find(text.uppercase()) ?: return null
        val g = m.groupValues
        return if (g[1].isNotEmpty()) {
            "${g[1]}${g[2]}-${g[3]}.${g[4]}"
        } else {
            "${g[5]}${g[6]}-${g[7]}"
        }
    }

    /**
     * True when a non-ongoing notification from a ride/delivery app is about an active
     * trip or order rather than marketing.
     */
    fun looksLikeTrip(title: String, text: String): Boolean {
        val all = "$title $text".lowercase()
        if (promoWords.any { it in all }) return false
        if (etaMinutes(all) != null || plate(all) != null) return true
        return tripWords.any { it in all }
    }
}
