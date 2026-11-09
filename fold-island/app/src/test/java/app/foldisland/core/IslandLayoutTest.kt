package app.foldisland.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IslandLayoutTest {

    @Test fun rectIsCentredOnACentredCamera() {
        val r = IslandLayout.around(anchorX = 540, top = 10, width = 200, height = 60, screenWidth = 1080, margin = 24)
        assertEquals(PxRect(440, 10, 640, 70), r)
    }

    @Test fun rectFollowsAnOffCentreCamera() {
        val r = IslandLayout.around(anchorX = 1400, top = 0, width = 200, height = 60, screenWidth = 2000, margin = 24)
        assertEquals(1300, r.left)
        assertEquals(1500, r.right)
    }

    @Test fun rectStaysInsideTheScreenMargin() {
        val r = IslandLayout.around(anchorX = 1990, top = 0, width = 400, height = 60, screenWidth = 2000, margin = 24)
        assertEquals(1976, r.right)
        assertEquals(400, r.width)
    }

    @Test fun bubbleSitsRightOfThePill() {
        val pill = PxRect(400, 10, 600, 70)
        assertEquals(PxRect(612, 10, 672, 70), IslandLayout.bubble(pill, gap = 12, screenWidth = 1080, margin = 24))
    }

    @Test fun bubbleMovesLeftWhenThereIsNoRoomOnTheRight() {
        val pill = PxRect(800, 10, 1000, 70)
        assertEquals(PxRect(728, 10, 788, 70), IslandLayout.bubble(pill, gap = 12, screenWidth = 1080, margin = 24))
    }

    @Test fun settledFrameIsExactlyTheTarget() {
        val target = PxRect(440, 10, 640, 70)
        assertEquals(target, IslandLayout.windowFrame(start = null, target = target, extra = null))
    }

    @Test fun animatingFrameCoversStartAndTarget() {
        val pill = PxRect(440, 10, 640, 70)
        val card = PxRect(300, 10, 780, 400)
        assertEquals(card, IslandLayout.windowFrame(start = pill, target = card, extra = null))
        // Collapsing: the window keeps the big card size until the shape has shrunk.
        assertEquals(card, IslandLayout.windowFrame(start = card, target = pill, extra = null))
    }

    @Test fun frameIncludesTheBubble() {
        val pill = PxRect(440, 10, 640, 70)
        val bubble = PxRect(652, 10, 712, 70)
        assertEquals(PxRect(440, 10, 712, 70), IslandLayout.windowFrame(start = null, target = pill, extra = bubble))
    }

    @Test fun frameIsTheSameOnEveryFrameOfOneAnimation() {
        // The whole point: the window must not be resized while the shape morphs.
        val pill = PxRect(440, 10, 640, 70)
        val card = PxRect(300, 10, 780, 400)
        val frames = (0..10).map { IslandLayout.windowFrame(start = pill, target = card, extra = null) }
        assertEquals(1, frames.toSet().size)
    }

    @Test fun containsUsesHalfOpenBounds() {
        val r = PxRect(10, 10, 20, 20)
        assertTrue(r.contains(10, 10))
        assertTrue(r.contains(19, 19))
        assertFalse(r.contains(20, 15))
        assertFalse(r.contains(5, 15))
    }
}
