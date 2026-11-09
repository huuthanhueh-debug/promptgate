package app.foldisland.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class IslandStateTest {

    private fun ride(id: String = "ride", at: Long = 1) =
        LiveItem.Ride(id, "com.grabtaxi.passenger", at, "Grab", "Đang đến", 3, null, null)
    private fun media(at: Long = 1) = LiveItem.Media("media", "com.spotify.music", at, "Song", "Artist", true)
    private fun incoming(at: Long = 1) = LiveItem.Call("call", "dialer", at, "Vợ", incoming = true, startedAt = null)
    private fun ongoing(at: Long = 1) = LiveItem.Call("call", "dialer", at, "Vợ", incoming = false, startedAt = at)
    private fun message(at: Long, expires: Long) =
        LiveItem.Message("msg", "com.zing.zalo", at, "Mẹ", "Ăn cơm chưa", expiresAt = expires)
    private fun reminder() = LiveItem.Reminder("rem", 1, "Tiêm insulin", "r1")

    @Test fun emptyIsIdle() {
        val v = IslandState.compute(emptyList(), now = 10)
        assertNull(v.primary); assertNull(v.secondary); assertNull(v.popup)
        assertEquals(0, v.count)
    }

    @Test fun incomingCallBeatsEverything() {
        val v = IslandState.compute(listOf(media(), ride(), reminder(), incoming()), now = 10)
        assertEquals("call", v.primary?.id)
        assertEquals("rem", v.secondary?.id)
    }

    @Test fun rideBeatsMedia() {
        val v = IslandState.compute(listOf(media(at = 5), ride(at = 1)), now = 10)
        assertEquals("ride", v.primary?.id)
        assertEquals("media", v.secondary?.id)
        assertEquals(2, v.count)
    }

    @Test fun reminderBeatsOngoingRideButNotOngoingCall() {
        assertEquals("rem", IslandState.compute(listOf(ride(), reminder()), now = 10).primary?.id)
        assertEquals("call", IslandState.compute(listOf(reminder(), ongoing()), now = 10).primary?.id)
    }

    @Test fun newerItemWinsWithinSameKind() {
        val v = IslandState.compute(listOf(ride("old", at = 1), ride("new", at = 5)), now = 10)
        assertEquals("new", v.primary?.id)
        assertEquals("old", v.secondary?.id)
    }

    @Test fun transientItemsBecomePopupNotPrimary() {
        val v = IslandState.compute(listOf(ride(), message(at = 9, expires = 20)), now = 10)
        assertEquals("ride", v.primary?.id)
        assertEquals("msg", v.popup?.id)
        assertEquals(1, v.count)
    }

    @Test fun expiredItemsAreDropped() {
        val v = IslandState.compute(listOf(message(at = 1, expires = 5)), now = 10)
        assertNull(v.popup)
    }

    @Test fun userChosenPrimaryIsHonoured() {
        val v = IslandState.compute(listOf(media(), ride()), now = 10, chosenPrimaryId = "media")
        assertEquals("media", v.primary?.id)
        assertEquals("ride", v.secondary?.id)
    }

    @Test fun incomingCallOverridesUserChoice() {
        val v = IslandState.compute(listOf(media(), incoming()), now = 10, chosenPrimaryId = "media")
        assertEquals("call", v.primary?.id)
    }

    @Test fun cycleMovesThroughPersistentItems() {
        val items = listOf(media(), ride(), reminder())
        assertEquals("ride", IslandState.cycle(items, now = 10, currentId = "rem", step = 1))
        assertEquals("media", IslandState.cycle(items, now = 10, currentId = "ride", step = 1))
        assertEquals("rem", IslandState.cycle(items, now = 10, currentId = "media", step = 1))
        assertEquals("media", IslandState.cycle(items, now = 10, currentId = "rem", step = -1))
    }
}
