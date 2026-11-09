package app.foldisland.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RideParserTest {

    @Test fun etaVietnamese() {
        assertEquals(3, RideParser.parse("Tài xế sẽ đến trong 3 phút").etaMinutes)
    }

    @Test fun etaEnglish() {
        assertEquals(12, RideParser.parse("Your driver is arriving in 12 mins").etaMinutes)
        assertEquals(1, RideParser.parse("Arriving in 1 min").etaMinutes)
    }

    @Test fun etaNoneWhenAbsent() {
        assertNull(RideParser.parse("Tài xế đã đến điểm đón").etaMinutes)
    }

    @Test fun etaIgnoresAbsurdValues() {
        assertNull(RideParser.parse("Còn 999 phút").etaMinutes)
    }

    @Test fun carPlateWithDash() {
        assertEquals("51G-123.45", RideParser.parse("Toyota Vios · 51G-123.45").plate)
    }

    @Test fun carPlateCompact() {
        assertEquals("72A-123.45", RideParser.parse("Biển số 72A12345").plate)
    }

    @Test fun motorbikePlate() {
        assertEquals("59X1-234.56", RideParser.parse("Honda Vision 59-X1 234.56").plate)
        assertEquals("72B1-234.56", RideParser.parse("72b1 23456 đang đến").plate)
    }

    @Test fun oldFourDigitPlate() {
        assertEquals("29A-1234", RideParser.parse("Xe 29A-1234").plate)
    }

    @Test fun phoneNumberIsNotAPlate() {
        assertNull(RideParser.parse("Gọi 0911268413 để hỗ trợ").plate)
    }

    @Test fun tripDetection() {
        assertTrue(RideParser.looksLikeTrip("Nguyễn Văn A", "Tài xế đang đến"))
        assertTrue(RideParser.looksLikeTrip("GrabCar", "Arriving in 4 mins"))
        assertTrue(RideParser.looksLikeTrip("Đơn hàng", "Đơn hàng của bạn đang giao"))
        assertTrue(RideParser.looksLikeTrip("Xe đã tới", "51G-123.45 đã đến điểm đón"))
    }

    @Test fun promotionsAreNotTrips() {
        assertFalse(RideParser.looksLikeTrip("Ưu đãi hôm nay", "Giảm 50% cho chuyến đi tiếp theo"))
        assertFalse(RideParser.looksLikeTrip("Voucher", "Tài xế thân thiện, voucher 20k chờ bạn"))
        assertFalse(RideParser.looksLikeTrip("Weekend deal", "30% off your next ride"))
    }
}
