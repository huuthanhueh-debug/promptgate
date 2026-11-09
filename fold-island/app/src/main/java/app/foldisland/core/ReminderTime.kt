package app.foldisland.core

import java.time.DayOfWeek
import java.time.ZonedDateTime

object ReminderTime {

    /**
     * The first moment strictly after [now] at [hour]:[minute] on one of [days]
     * (empty = every day).
     */
    fun next(hour: Int, minute: Int, days: Set<DayOfWeek>, now: ZonedDateTime): ZonedDateTime {
        var candidate = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
        if (!candidate.isAfter(now)) candidate = candidate.plusDays(1)
        repeat(7) {
            if (days.isEmpty() || candidate.dayOfWeek in days) return candidate
            candidate = candidate.plusDays(1)
        }
        return candidate
    }
}
