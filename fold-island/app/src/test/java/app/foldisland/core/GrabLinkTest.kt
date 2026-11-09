package app.foldisland.core

import org.junit.Assert.assertEquals
import org.junit.Test

class GrabLinkTest {

    @Test fun fillsDefaultTemplate() {
        val link = GrabLink.build(GrabLink.DEFAULT_TEMPLATE, 10.3460, 107.0843, "Nhà")
        assertEquals(
            "grab://open?screenType=BOOKING&dropOffLatitude=10.346&dropOffLongitude=107.0843&dropOffAddress=Nh%C3%A0",
            link,
        )
    }

    @Test fun encodesSpacesAsPercent20() {
        val link = GrabLink.build("x?n={name}", 0.0, 0.0, "Khách sạn A B")
        assertEquals("x?n=Kh%C3%A1ch%20s%E1%BA%A1n%20A%20B", link)
    }

    @Test fun usesDotDecimalAndNegativeValues() {
        assertEquals("-33.8688,151.2093", GrabLink.build("{lat},{lng}", -33.8688, 151.2093, ""))
    }

    @Test fun roundsToSixDecimals() {
        assertEquals("10.123457", GrabLink.build("{lat}", 10.1234567, 0.0, ""))
    }

    @Test fun blankTemplateFallsBackToDefault() {
        val link = GrabLink.build("  ", 1.5, 2.5, "A")
        assertEquals(GrabLink.build(GrabLink.DEFAULT_TEMPLATE, 1.5, 2.5, "A"), link)
    }
}
