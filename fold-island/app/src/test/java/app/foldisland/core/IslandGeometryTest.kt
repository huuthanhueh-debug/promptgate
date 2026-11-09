package app.foldisland.core

import org.junit.Assert.assertEquals
import org.junit.Test

class IslandGeometryTest {

    @Test fun centredCameraGivesZeroOffset() {
        assertEquals(0, IslandGeometry.centerOffset(screenWidth = 1080, targetX = 540, contentWidth = 300, margin = 24))
    }

    @Test fun offCentreCameraIsFollowed() {
        // Inner screen, camera right of centre
        assertEquals(400, IslandGeometry.centerOffset(screenWidth = 2000, targetX = 1400, contentWidth = 300, margin = 24))
    }

    @Test fun wideContentIsKeptOnScreen() {
        // half=1000, content half=500, margin 24 → max offset 476
        assertEquals(476, IslandGeometry.centerOffset(screenWidth = 2000, targetX = 1900, contentWidth = 1000, margin = 24))
        assertEquals(-476, IslandGeometry.centerOffset(screenWidth = 2000, targetX = 10, contentWidth = 1000, margin = 24))
    }

    @Test fun contentWiderThanScreenIsCentred() {
        assertEquals(0, IslandGeometry.centerOffset(screenWidth = 800, targetX = 700, contentWidth = 900, margin = 24))
    }

    @Test fun pillHeightWrapsCameraWithPadding() {
        assertEquals(60, IslandGeometry.pillHeight(cutoutHeight = 40, minHeight = 50, padding = 10))
        assertEquals(50, IslandGeometry.pillHeight(cutoutHeight = 20, minHeight = 50, padding = 10))
    }

    @Test fun topCentresPillOnCameraButNeverAboveScreen() {
        assertEquals(20, IslandGeometry.top(cutoutCenterY = 50, pillHeight = 60))
        assertEquals(0, IslandGeometry.top(cutoutCenterY = 10, pillHeight = 60))
    }

    @Test fun tuningIsClamped() {
        assertEquals(40, IslandGeometry.clampOffset(99, 40))
        assertEquals(-40, IslandGeometry.clampOffset(-99, 40))
        assertEquals(7, IslandGeometry.clampOffset(7, 40))
    }
}
