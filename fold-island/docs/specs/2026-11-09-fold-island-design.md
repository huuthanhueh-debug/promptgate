# Fold Island – Spec v1

> Dynamic Island cho Galaxy Z Fold 8 (One UI 9 / Android 17). App cá nhân, cài bằng APK.
> Ngày: 2026-11-09 · Trạng thái: **v1.0.0 đã build** (chờ anh test trên máy thật).

---

## 1. Mục tiêu

| | Nội dung |
|---|---|
| **Vấn đề** | Android không có Dynamic Island. Thông tin quan trọng (Grab, cuộc gọi, nhạc, nhắc lịch) nằm rải rác trong thanh thông báo, phải kéo xuống mới thấy. |
| **Kết quả mong muốn** | Một "viên thuốc" đen nằm quanh lỗ camera, tự đổi hình để hiện trạng thái realtime, chạm để mở rộng, nhấn giữ để mở phím tắt. Chạy ngầm cả ngày, không làm hao pin đáng kể. |
| **Người dùng** | Một người (anh), một máy: Galaxy Z Fold 8, cả màn ngoài lẫn màn trong. |
| **Thành công khi** | (1) Đặt Grab → island hiện tài xế/ETA mà không cần kéo thông báo. (2) Cuộc gọi đến → nghe/từ chối ngay trên island. (3) Nhạc → play/pause/next trên island. (4) Nhắc lịch hằng ngày hiện đúng giờ, kể cả khi máy ngủ. (5) Gập/mở máy → island tự canh đúng lỗ camera của màn đang dùng. |

### Anh đã chốt (5 câu hỏi)
1. Hướng sản phẩm: **Hiển thị trạng thái + phím tắt** (không tự động bấm thay trong Grab).
2. Thiết bị: **Galaxy Z Fold 8**.
3. Nội dung: **Grab & giao hàng · Cuộc gọi & tin nhắn · Hệ thống & nhắc lịch · Nhạc & media**.
4. Phím tắt: **Đặt Grab nhanh · Gọi nhanh người thân · Mở app tùy chọn**.
5. Cài đặt: **APK cài tay**, build trên cloud. Repo riêng tính sau. Tạm thời code nằm trong thư mục `fold-island/` trên nhánh làm việc của repo PromptGate.

### Giả định của mình (anh sửa nếu sai)
- Không cần đưa lên Google Play.
- Giao diện kiểu iPhone: nền đen, chữ trắng, bo tròn, chuyển động mềm. Không cần theme sáng.
- Ngôn ngữ giao diện: tiếng Việt.
- Địa chỉ, số điện thoại, giờ nhắc **anh nhập trong app**; không có trong code.

---

## 2. Giới hạn kỹ thuật (nói rõ trước)

| Giới hạn | Hệ quả | Cách xử lý |
|---|---|---|
| Grab không có API công khai cho người dùng | Không đặt xe "ngầm" được | Island mở Grab bằng deep link điền sẵn điểm đến; anh bấm xác nhận trong Grab |
| Deep link Grab là **không chính thức** (cộng đồng tìm ra) | Grab đổi định dạng là link thôi điền sẵn điểm đến | Tự fallback: mở Grab bình thường. Mẫu link sửa được trong *Cài đặt → Nâng cao* mà không cần build lại |
| Thông tin Grab lấy từ **thông báo** của Grab | Grab không thông báo thì island không có gì để hiện | Hiện đúng những gì Grab đưa lên thông báo (tài xế, biển số, ETA, tiến trình) |
| APK cài tay trên Android 13+ bị chặn "cài đặt hạn chế" | Không bật được quyền Trợ năng / Đọc thông báo ngay | Màn hình *Thiết lập* hướng dẫn: Thông tin ứng dụng → ⋮ → **Cho phép cài đặt hạn chế** |
| Cloud không có máy Android thật/giả lập | Mình không chạy thử giao diện trên Fold 8 được | Logic được kiểm bằng unit test; phần giao diện anh test thật theo checklist trong `README.md` |

---

## 3. Phương án kiến trúc

| Phương án | Ưu | Nhược | Chọn |
|---|---|---|---|
| **A. Kotlin native + overlay qua Accessibility Service** | Vẽ được **đè lên thanh trạng thái** và màn hình khóa; chạm vào island không bị kéo nhầm thanh thông báo; hệ thống giữ service sống, Samsung ít "giết" | Phải bật quyền Trợ năng (cần bước "cho phép cài đặt hạn chế") | ✅ |
| B. Kotlin native + overlay `SYSTEM_ALERT_WINDOW` + foreground service | Quyền đơn giản hơn | Cửa sổ nằm **dưới** thanh trạng thái: chạm vào island dễ kéo nhầm thanh thông báo; không hiện trên màn hình khóa; Samsung hay tắt service chạy nền | ✗ |
| C. Flutter / React Native | Đa nền tảng | Không cần đa nền tảng; overlay và đọc thông báo vẫn phải viết native | ✗ |

**Quyền Trợ năng chỉ dùng để vẽ island.** Service khai báo `canRetrieveWindowContent=false`: không đọc nội dung màn hình, không giả lập chạm.

**Quyền riêng tư:** app **không xin quyền INTERNET**. Mọi dữ liệu (thông báo, cài đặt) chỉ nằm trong máy.

---

## 4. Stack

| Thành phần | Lựa chọn |
|---|---|
| Ngôn ngữ / UI | Kotlin 2.2 · Jetpack Compose (BOM 2025.12) |
| Build | Gradle 8.14 · Android Gradle Plugin 8.13 · compileSdk/targetSdk 36 · minSdk 34 (Android 14+) |
| Lưu cài đặt | DataStore + kotlinx.serialization (một object `AppConfig` dạng JSON) |
| Test | JUnit 4 cho phần logic thuần Kotlin |
| Tên app / package | **Fold Island** · `app.foldisland` |

targetSdk 36 (Android 16) chạy bình thường trên Android 17; nâng lên 37 khi bộ công cụ ổn định.

---

## 5. Kiến trúc & thành phần

```
Nguồn dữ liệu                         Lõi (thuần Kotlin, có test)         Hiển thị
──────────────                        ───────────────────────────         ─────────
IslandNotificationListener ─┐
  (Grab, gọi, tin nhắn,     │
   timer)                   ├──► ActivityHub ──► IslandState ──► OverlayWindow (Compose)
MediaWatcher (nhạc) ────────┤    (StateFlow     (chọn item chính,   trong IslandAccessibilityService
BatteryWatcher (pin) ───────┤     các item)      item phụ, popup)   │
ReminderReceiver (nhắc) ────┘                                       └─► ShortcutActions
                                                                         (Grab, gọi, mở app)
MainActivity (Thiết lập + Cài đặt) ──► SettingsRepository (DataStore) ──► mọi thành phần đọc AppConfig
```

| Unit | Việc duy nhất | Phụ thuộc |
|---|---|---|
| `core/LiveItem` | Model: `Ride`, `Call`, `Message`, `Media`, `Timer`, `Charging`, `LowBattery`, `Reminder` | — |
| `core/IslandState` | Từ danh sách item → chọn **item chính**, **item phụ**, **popup tạm** theo độ ưu tiên | LiveItem |
| `core/RideParser` | Tách ETA (phút), biển số VN, tên tài xế từ chữ trong thông báo | — |
| `core/GrabLink` | Dựng deep link Grab từ toạ độ + mẫu link | — |
| `core/Coordinates` | Đọc toạ độ dán từ Google Maps (`10.34, 107.08` hoặc link có `@lat,lng` / `q=lat,lng`) | — |
| `core/ReminderTime` | Tính lần báo kế tiếp theo giờ + ngày trong tuần | java.time |
| `hub/ActivityHub` | Kho item dùng chung trong process, tự hết hạn item tạm | coroutines |
| `sources/*` | Chuyển dữ liệu Android (thông báo, media session, pin, báo thức) thành `LiveItem` | Android SDK |
| `overlay/*` | Cửa sổ overlay, canh lỗ camera, cử chỉ, giao diện Compose | Android SDK, Compose |
| `actions/ShortcutActions` | Mở Grab, gọi điện, mở app; mở `contentIntent` của thông báo | Android SDK |
| `settings/*` | DataStore + màn hình Thiết lập/Cài đặt | Compose |

---

## 6. Hành vi island

### 6.1 Trạng thái hiển thị

| Trạng thái | Hình dạng | Khi nào |
|---|---|---|
| **Nghỉ** | Viên đen nhỏ ôm lỗ camera (có thể chọn *Ẩn*) | Không có hoạt động nào |
| **Thu gọn** | Viên rộng ra: trái = icon, phải = thông tin ngắn (ETA `3'`, đếm giờ, sóng nhạc, thời lượng gọi) | Có ≥1 hoạt động |
| **Chia đôi** | Viên chính + bong bóng tròn nhỏ bên phải | Có ≥2 hoạt động cùng lúc |
| **Mở rộng** | Thẻ bo tròn lớn, đầy đủ chi tiết + nút hành động | Chạm vào island |
| **Phím tắt** | Thẻ lớn: hàng Grab · hàng Gọi nhanh · lưới app ghim | Nhấn giữ island |
| **Popup tạm** | Viên mở rộng vừa phải trong vài giây rồi thu lại | Tin nhắn mới (4 giây), cắm sạc (3 giây), pin yếu (4 giây) |

### 6.2 Cử chỉ

| Cử chỉ | Hành động |
|---|---|
| Chạm (thu gọn) | Mở rộng |
| Chạm vào thẻ mở rộng | Mở app nguồn (Grab, Zalo, Spotify…) và thu lại |
| Vuốt lên trên thẻ / chạm ra ngoài | Thu lại |
| Nhấn giữ | Mở bảng phím tắt |
| Vuốt trái/phải (thu gọn, có ≥2 item) | Đổi item chính |

### 6.3 Ưu tiên item chính
`Cuộc gọi đến` > `Đang gọi` > `Nhắc lịch đến giờ` > `Grab/giao hàng` > `Đồng hồ đếm` > `Nhạc`.
Popup tạm (tin nhắn, sạc, pin yếu) hiện đè trong vài giây rồi trả lại item chính.

### 6.4 Chi tiết từng loại

| Loại | Lấy từ đâu | Thu gọn | Mở rộng / nút |
|---|---|---|---|
| **Grab & giao hàng** | Thông báo của app trong danh sách *App gọi xe/giao hàng* (mặc định Grab; anh thêm Be, Xanh SM, ShopeeFood… từ danh sách app đã cài). Chỉ nhận thông báo **đang diễn ra** / có thanh tiến trình / có từ khoá chuyến đi; bỏ qua khuyến mãi | Icon app + ETA hoặc biển số | Tiêu đề, nội dung, biển số, ETA, thanh tiến trình · nút **Mở app** |
| **Cuộc gọi** | Thông báo loại `call` / `CallStyle` (điện thoại Samsung, Zalo, WhatsApp…) | Cuộc gọi đến: tên + chấm xanh. Đang gọi: đồng hồ thời lượng | **Nghe / Từ chối / Kết thúc** (dùng chính nút trong thông báo gốc) |
| **Tin nhắn** | Thông báo loại `message` / `MessagingStyle`. Tôn trọng **Không làm phiền** và kênh thông báo im lặng | Popup 4 giây: icon app + người gửi | Nội dung tin. **Trên màn hình khóa: ẩn nội dung**, chỉ hiện "Tin nhắn mới" |
| **Nhạc** | `MediaSessionManager` (Spotify, YouTube Music, Zing…) | Ảnh bìa nhỏ + sóng nhạc | Tên bài, ca sĩ, ảnh bìa · **⏮ ⏯ ⏭**. Tạm dừng quá 30 giây thì ẩn |
| **Đồng hồ đếm** | Thông báo đang chạy có đồng hồ đếm ngược/đếm lên (app Đồng hồ) | Thời gian còn lại | Như thu gọn, chữ lớn |
| **Pin** | Sự kiện cắm sạc / pin ≤ 15% | Popup: % pin + biểu tượng | — |
| **Nhắc lịch** | Nhắc lịch anh tạo trong app (tên, giờ, các ngày trong tuần), báo bằng `AlarmManager` chính xác, chạy cả khi máy ngủ | Chuông + tên nhắc | **Đã xong** (tắt) · **Nhắc lại 10 phút**. Tự ẩn sau 30 phút. **Luôn kèm một thông báo thường** để không lỡ nếu island đang tắt |

### 6.5 Vị trí trên Z Fold 8
- Đọc vùng lỗ camera của màn hiện tại qua `DisplayCutout`. Viên island căn giữa theo lỗ camera.
- Gập/mở máy, xoay màn hình → tính lại vị trí ngay.
- Thẻ mở rộng / phím tắt: căn giữa màn hình, tránh tràn mép khi camera màn trong nằm lệch phải.
- **Tinh chỉnh tay** X/Y (±40 px) và kích thước, **lưu riêng cho màn ngoài và màn trong**.
- Xoay ngang: mặc định ẩn (bật lại được trong Cài đặt).
- Màn không có lỗ camera ở cạnh trên: đặt giữa mép trên.

---

## 7. Phím tắt (nhấn giữ island)

| Nhóm | Tối đa | Cách nhập | Hành động |
|---|---|---|---|
| **Đặt Grab nhanh** | 4 địa điểm | Tên + toạ độ. Trên Google Maps: nhấn giữ một điểm → copy toạ độ → dán vào app | Mở Grab với điểm đến điền sẵn (deep link). Lỗi thì mở Grab thường. Chưa cài Grab thì mở trang Grab trên CH Play |
| **Gọi nhanh** | 4 người | Chọn từ danh bạ (không cần quyền đọc toàn bộ danh bạ) | Có quyền gọi điện → gọi luôn. Không có → mở bàn phím số điền sẵn số |
| **App ghim** | 8 app | Chọn từ danh sách app đã cài | Mở app |

---

## 8. Cài đặt & thiết lập lần đầu

**Màn hình Thiết lập** (checklist có đèn xanh/đỏ cho từng mục, bấm là nhảy tới đúng trang cài đặt):
1. Cho phép cài đặt hạn chế (hướng dẫn bằng chữ; Android không cho kiểm tra tự động).
2. Bật **Trợ năng → Fold Island**.
3. Bật **Quyền truy cập thông báo**.
4. Cho phép **gửi thông báo** (dùng cho nhắc lịch dự phòng).
5. **Pin: Không hạn chế** + hướng dẫn thêm vào *Ứng dụng không bao giờ ngủ* của Samsung.
6. (Tuỳ chọn) Quyền **gọi điện** cho Gọi nhanh.

**Màn hình Cài đặt:** Bật/tắt island · Địa điểm Grab · Gọi nhanh · App ghim · Nhắc lịch · App gọi xe/giao hàng · Giao diện (kiểu lúc nghỉ, tinh chỉnh vị trí từng màn, ẩn khi xoay ngang) · Nâng cao (mẫu deep link Grab).

---

## 9. Kiểm thử

| Lớp | Cách kiểm | Ai |
|---|---|---|
| Logic thuần (`core/*`) | Unit test JUnit: tách ETA/biển số, dựng link Grab, đọc toạ độ, chọn ưu tiên, tính giờ nhắc kế tiếp | Mình, chạy trên cloud mỗi lần build |
| Biên dịch + lint | `./gradlew testDebugUnitTest lintDebug assembleRelease` | Mình |
| Trên máy thật | Checklist trong `fold-island/README.md`: cài APK, cấp quyền, đặt thử Grab, gọi thử, phát nhạc, gập/mở máy, nhắc lịch sau 2 phút, khoá màn hình | Anh trên Z Fold 8 |

---

## 10. Phát hành & chữ ký APK

- Bản cài lên máy: APK `release` thu gọn bằng R8 (~2,6 MB), ký bằng keystore cố định trong `fold-island/signing/`, để các bản cập nhật **cài đè được** mà không mất cài đặt.
- **Đánh đổi:** keystore nằm trong repo nên ai có repo cũng ký được một APK "cùng chữ ký". Rủi ro thấp vì chỉ cài tay, nhưng khi chuyển sang repo riêng nên để **private**, hoặc chuyển keystore vào GitHub Secrets.
- Mình gửi file APK trực tiếp trong phiên này; anh tải về Fold 8 và cài.

---

## 11. Ngoài phạm vi v1 (YAGNI)
Lên Google Play · tự động bấm trong Grab · trợ lý giọng nói · widget màn hình chính · theme sáng · đồng bộ đám mây · hỗ trợ máy khác ngoài Z Fold 8 (vẫn chạy được nhưng không tối ưu riêng).
