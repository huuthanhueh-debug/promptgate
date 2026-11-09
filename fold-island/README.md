# Fold Island

Dynamic Island cho **Galaxy Z Fold 8** (One UI 9 / Android 17). Viên đen quanh lỗ camera hiện Grab, cuộc gọi, tin nhắn, nhạc, đồng hồ, pin và nhắc lịch; chạm để mở rộng, nhấn giữ để mở phím tắt.

Spec đầy đủ: [`docs/specs/2026-11-09-fold-island-design.md`](docs/specs/2026-11-09-fold-island-design.md)

---

## 1. Cài đặt lên Z Fold 8 (5 phút)

| Bước | Làm gì |
|---|---|
| 1 | **Tạm tắt Play Protect:** CH Play → avatar (góc trên phải) → **Play Protect** → ⚙ → tắt *Quét ứng dụng bằng Play Protect*. Lý do: tính năng chống lừa đảo của Google chặn mọi APK cài tay có quyền Trợ năng / Đọc thông báo, và chỉ có nút "Got it", không có "Vẫn cài". |
| 1b | Tải file `FoldIsland-x.y.z.apk` về máy, mở file → **Cài đặt**. Nếu máy hỏi, cho phép *Cài ứng dụng không rõ nguồn gốc* cho app đang mở file (Chrome / My Files). |
| 1c | Cài xong → **bật lại Play Protect** ngay. Nếu Play Protect hỏi gửi app đi quét, chọn gửi hoặc bỏ qua đều được. |
| 2 | Mở **Fold Island**. Màn hình **Thiết lập** liệt kê từng quyền với đèn xanh/đỏ. Bấm **Mở** ở từng dòng đỏ. |
| 3 | **Cho phép cài đặt hạn chế**: Cài đặt → Ứng dụng → Fold Island → **⋮** (góc trên phải) → *Cho phép cài đặt hạn chế*. Không làm bước này thì hai bước sau bị khoá (mục bật bị mờ). |
| 4 | **Trợ năng** → Ứng dụng đã cài đặt → **Fold Island** → Bật. |
| 5 | **Quyền truy cập thông báo** → Fold Island → Bật. |
| 6 | **Pin: Không hạn chế**, rồi Chăm sóc thiết bị → Pin → Giới hạn sử dụng nền → **Ứng dụng không bao giờ ngủ** → thêm Fold Island. |
| 7 | Thêm địa điểm Grab, số gọi nhanh, app ghim, nhắc lịch trong app. |

**Cập nhật bản mới:** cài file APK mới đè lên, không cần gỡ; cài đặt được giữ nguyên. Mỗi lần cài bản mới cũng cần tạm tắt Play Protect như bước 1.

**Cách khác, không cần tắt Play Protect:** cài qua máy tính bằng ADB. Bật *Tuỳ chọn nhà phát triển* (chạm 7 lần vào Số hiệu bản tạo) → bật *Gỡ lỗi USB* → cắm cáp → `adb install -r FoldIsland-x.y.z.apk`. Lệnh chặn của Play Protect chỉ áp dụng cho APK mở từ trình duyệt, app nhắn tin hoặc trình quản lý file.

---

## 2. Cách dùng

| Cử chỉ | Kết quả |
|---|---|
| Chạm vào island | Mở rộng (chi tiết + nút) |
| Chạm vào thẻ đang mở | Mở app nguồn (Grab, Zalo, Spotify…) |
| Vuốt lên / chạm ra ngoài | Thu gọn |
| **Nhấn giữ** | Bảng phím tắt: Đặt Grab · Gọi nhanh · App ghim · ⚙ |
| Vuốt trái/phải | Đổi hoạt động chính khi có 2 việc cùng lúc |
| Chạm bong bóng nhỏ bên phải | Đưa hoạt động phụ lên làm chính |

**Lấy toạ độ cho Đặt Grab:** Google Maps → nhấn giữ điểm đến → chạm dòng toạ độ trên ô tìm kiếm để copy → dán vào Fold Island.

---

## 3. Checklist test trên máy thật

Đánh dấu từng dòng khi test. Dòng nào sai, chụp màn hình gửi lại kèm số dòng.

| # | Kịch bản | Kết quả đúng |
|---|---|---|
| 1 | Mở máy (màn trong) và gập máy (màn ngoài) | Viên island ôm đúng lỗ camera ở **cả hai** màn. Lệch thì chỉnh ở *Giao diện → Tinh chỉnh vị trí* (mỗi màn lưu riêng). |
| 2 | Nhấn giữ island | Rung nhẹ, hiện bảng phím tắt. Chạm ra ngoài thì đóng. |
| 3 | Phím tắt Grab | Grab mở màn đặt xe, **điểm đến đã điền sẵn**. Nếu chỉ mở Grab mà chưa điền: ghi lại ở mục Ghi chú bên dưới. |
| 4 | Đặt một chuyến Grab thật | Island hiện icon Grab + ETA ("3 phút") hoặc biển số. Chạm → thẻ chi tiết. |
| 5 | Nhờ người gọi đến | Thẻ cuộc gọi tự mở với nút **Nghe** (xanh) / **Từ chối** (đỏ). Nghe máy → island đổi sang đồng hồ thời lượng. Nút đỏ kết thúc cuộc gọi. |
| 6 | Gọi Zalo / WhatsApp | Như dòng 5 (tuỳ app có dùng thông báo cuộc gọi chuẩn hay không). |
| 7 | Nhận tin Zalo / Messenger | Popup 4 giây: avatar + người gửi + nội dung. Chạm → mở đúng cuộc trò chuyện. |
| 8 | Khoá màn hình rồi nhận tin | Popup chỉ ghi "Tin nhắn mới", không lộ nội dung. |
| 9 | Phát nhạc Spotify / YouTube Music | Island hiện ảnh bìa + sóng nhạc. Mở rộng → ⏮ ⏯ ⏭ hoạt động. Tạm dừng 30 giây → island ẩn nhạc. |
| 10 | Bấm hẹn giờ 1 phút trong app Đồng hồ | Island đếm ngược màu cam. |
| 11 | Cắm sạc | Popup "Đang sạc · xx%" 3 giây. |
| 12 | Tạo nhắc lịch cách hiện tại 2 phút, khoá máy, chờ | Đúng giờ: island hiện thẻ nhắc + **có thông báo thường**. "Nhắc lại 10'" báo lại sau 10 phút. |
| 13 | Khởi động lại máy | Island tự hiện lại; nhắc lịch vẫn báo đúng giờ. |
| 14 | Bật Không làm phiền, nhận tin nhắn | Không có popup tin nhắn. |
| 15 | Xoay ngang (xem video) | Island ẩn (mặc định). |
| 16 | Dùng bình thường 1 ngày | Pin không tụt bất thường (Cài đặt → Pin → xem mức dùng của Fold Island). |

**Ghi chú test:** ……

---

## 4. Build (cho người phát triển)

```bash
cd fold-island
export ANDROID_HOME=/path/to/android-sdk   # platforms;android-36, build-tools;36.0.0
./gradlew testDebugUnitTest lintDebug assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

- Kotlin 2.2 · Jetpack Compose · AGP 8.13 · Gradle 8.14 · compileSdk/targetSdk 36 · minSdk 34
- Logic thuần (`core/`) có unit test; phần Android cần test tay theo mục 3.
- APK ký bằng keystore cố định trong `signing/` để cài đè được. Xem spec §10 về đánh đổi bảo mật.

## 5. Quyền riêng tư

- **Không có quyền Internet.** Dữ liệu chỉ nằm trong máy, không sao lưu lên đám mây.
- Trợ năng chỉ dùng để vẽ island: không đọc nội dung màn hình, không bấm thay.
