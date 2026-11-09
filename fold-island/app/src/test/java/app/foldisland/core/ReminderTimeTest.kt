package app.foldisland.core

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.DayOfWeek
import java.time.ZoneId
import java.time.ZonedDateTime

class ReminderTimeTest {

    private val zone = ZoneId.of("Asia/Ho_Chi_Minh")
    private fun at(y: Int, mo: Int, d: Int, h: Int, mi: Int) = ZonedDateTime.of(y, mo, d, h, mi, 0, 0, zone)

    @Test fun laterTodayWhenNotYetPassed() {
        // 2026-11-09 is a Monday
        val next = ReminderTime.next(21, 0, emptySet(), at(2026, 11, 9, 8, 0))
        assertEquals(at(2026, 11, 9, 21, 0), next)
    }

    @Test fun tomorrowWhenAlreadyPassed() {
        val next = ReminderTime.next(21, 0, emptySet(), at(2026, 11, 9, 21, 0))
        assertEquals(at(2026, 11, 10, 21, 0), next)
    }

    @Test fun respectsSelectedDays() {
        // Monday 22:00 → next Wednesday or Friday at 07:30 → Wednesday
        val days = setOf(DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY)
        val next = ReminderTime.next(7, 30, days, at(2026, 11, 9, 22, 0))
        assertEquals(at(2026, 11, 11, 7, 30), next)
    }

    @Test fun sameDayIfSelectedAndInFuture() {
        val next = ReminderTime.next(23, 15, setOf(DayOfWeek.MONDAY), at(2026, 11, 9, 23, 14))
        assertEquals(at(2026, 11, 9, 23, 15), next)
    }

    @Test fun wrapsToNextWeek() {
        val next = ReminderTime.next(9, 0, setOf(DayOfWeek.MONDAY), at(2026, 11, 9, 9, 1))
        assertEquals(at(2026, 11, 16, 9, 0), next)
    }
}
