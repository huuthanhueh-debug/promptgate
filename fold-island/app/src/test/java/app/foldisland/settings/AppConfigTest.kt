package app.foldisland.settings

import app.foldisland.core.GrabLink
import org.junit.Assert.assertEquals
import org.junit.Test

class AppConfigTest {

    @Test fun emptyOrBrokenInputGivesDefaults() {
        assertEquals(AppConfig(), AppConfig.decode(null))
        assertEquals(AppConfig(), AppConfig.decode(""))
        assertEquals(AppConfig(), AppConfig.decode("{not json"))
    }

    @Test fun defaultsIncludeGrab() {
        assertEquals(listOf(GrabLink.PACKAGE), AppConfig().rideApps)
    }

    @Test fun roundTrip() {
        val config = AppConfig(
            places = listOf(Place("p1", "Nhà", 10.346, 107.0843)),
            contacts = listOf(QuickContact("c1", "Vợ", "0900000000")),
            pinnedApps = listOf("com.zing.zalo"),
            reminders = listOf(Reminder("r1", "Tiêm insulin", 21, 0, setOf(1, 2, 3))),
            innerTuning = Tuning(offsetX = -6, offsetY = 2, scale = 1.1f),
        )
        assertEquals(config, AppConfig.decode(AppConfig.encode(config)))
    }

    @Test fun unknownKeysFromNewerVersionsAreIgnored() {
        val decoded = AppConfig.decode("""{"enabled":false,"someFutureField":42}""")
        assertEquals(false, decoded.enabled)
    }
}
