package app.foldisland.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CoordinatesTest {

    private fun assertLatLng(expectedLat: Double, expectedLng: Double, actual: LatLng?) {
        requireNotNull(actual) { "expected coordinates" }
        assertEquals(expectedLat, actual.lat, 1e-9)
        assertEquals(expectedLng, actual.lng, 1e-9)
    }

    @Test fun plainPairFromGoogleMapsLongPress() {
        assertLatLng(10.3460123, 107.0843456, Coordinates.parse("10.3460123, 107.0843456"))
    }

    @Test fun pairWithoutSpaceAndParentheses() {
        assertLatLng(10.34, 107.08, Coordinates.parse("(10.34,107.08)"))
    }

    @Test fun negativeValues() {
        assertLatLng(-33.8688, 151.2093, Coordinates.parse("-33.8688, 151.2093"))
    }

    @Test fun placeUrlWithAt() {
        assertLatLng(
            10.346, 107.0843,
            Coordinates.parse("https://www.google.com/maps/place/Foo/@10.346,107.0843,17z/data=!3m1"),
        )
    }

    @Test fun queryParameterEncodedComma() {
        assertLatLng(10.5, 107.25, Coordinates.parse("https://maps.google.com/?q=10.5%2C107.25"))
    }

    @Test fun outOfRangeIsRejected() {
        assertNull(Coordinates.parse("95.0, 107.0"))
        assertNull(Coordinates.parse("10.0, 190.0"))
    }

    @Test fun garbageIsRejected() {
        assertNull(Coordinates.parse("57A Ký Con"))
        assertNull(Coordinates.parse(""))
    }
}
