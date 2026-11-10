# FoodLens

App Android (APK, chạy trên Samsung và mọi máy Android 10 trở lên): chụp một món ăn, app trả về khẩu phần ước lượng (gram, calo, carb, đường, đạm, béo, chất xơ, natri) và đánh giá ảnh hưởng tới đường huyết của người tiểu đường type 2, mức low-carb và clean eating.

Giao diện có hai ngôn ngữ, **Tiếng Việt và English**: bấm nút `VI | EN` ở góc trên bên phải để đổi. Toàn bộ màn hình, kết luận, lời khuyên và câu trả lời của AI theo ngôn ngữ đã chọn; app nhớ lựa chọn cho lần mở sau.

Nằm trong repo PromptGate nhưng độc lập: không dùng chung mã với plugin, cùng stack (JavaScript thuần, không thư viện, test bằng Node).

## Cách hoạt động

| Phần | Việc |
|---|---|
| `web/` | Toàn bộ app: giao diện, gọi Claude API, tính toán. Chạy được trong trình duyệt để phát triển. |
| `web/core.js` | Luật dinh dưỡng. AI chỉ nhận diện món và ước lượng số liệu; mọi kết luận (xanh, vàng, đỏ) do app tính. |
| `web/foods.js` | Bảng 64 thực phẩm phổ biến cho tab Tra cứu, dùng offline, không cần key. |
| `android/` | Vỏ WebView: mở camera hoặc thư viện ảnh, gọi API qua HTTPS, nút Back. |
| `build-apk.js` | Đóng gói APK bằng Android SDK (aapt2, d8, zipalign, apksigner). Không cần Gradle. |

Cách đánh giá:

- **Đường huyết**: lấy mức xấu nhất trong ba chỉ số. Tải đường huyết GL (dưới 10 thấp, 10 đến 19 trung bình, từ 20 cao), carb thực so với mục tiêu mỗi bữa (mặc định 45 g: tới 30 g xanh, tới 60 g vàng), đường bổ sung (trên 10 g vàng, trên 25 g đỏ).
- **Low-carb**: carb thực tới 20 g là low-carb chặt, tới 45 g là low-carb vừa.
- **Clean eating**: điểm 0 đến 100 từ mức chế biến NOVA, đường bổ sung, natri, béo bão hòa.

## Cài lên điện thoại

1. Trên điện thoại, mở mục **Releases** của repo, chọn bản `FoodLens x.y.z (Android)` mới nhất và tải file `FoodLens-x.y.z.apk` (tải thẳng file APK, không phải zip).
2. Mở file APK trên điện thoại, cho phép "Cài ứng dụng không rõ nguồn" khi Samsung hỏi.
3. Mở FoodLens, vào **Cài đặt**, dán Anthropic API key (tạo tại console.anthropic.com), bấm Lưu.
4. Tab **Chụp**: chụp món ăn, bấm **Phân tích khẩu phần**.

Tab Tra cứu và Nhật ký dùng được không cần key. Phân tích ảnh cần mạng và tính phí theo lượng dùng API của key đó.

## Chạy và build

```bash
node tests/foodlens.js          # test luật dinh dưỡng, request/response, bảng thực phẩm
node tests/foodlens-e2e.js      # test giao diện thật trong Chromium (cần Playwright; không có thì tự bỏ qua)
node foodlens/build-apk.js      # ra dist/FoodLens.apk; cần JDK 11+ và ANDROID_HOME
```

Xem thử giao diện trên máy tính: mở `foodlens/web/index.html` bằng Chrome.

Build cần Android SDK có một bản `build-tools` và `platforms;android-34` trở lên. Lần build đầu tạo khóa ký `foodlens/android/foodlens.keystore` (không commit). Giữ file này: điện thoại chỉ nhận bản cập nhật ký cùng khóa. Bản build trên GitHub Actions dùng khóa mới mỗi lần, trừ khi repo có secret `FOODLENS_KEYSTORE_B64` (keystore mã hóa base64) và `FOODLENS_KEYSTORE_PASS`; khi khóa đổi, phải gỡ app cũ trước khi cài bản mới.

Tăng `version.json` (`code` tăng 1) trước mỗi bản phát hành.

## Riêng tư và giới hạn

- API key và nhật ký lưu trong bộ nhớ riêng của app trên máy. Ảnh chỉ gửi tới `api.anthropic.com`.
- App chỉ xin quyền Internet. Ảnh chụp qua app camera của máy được lưu vào thư viện ảnh.
- Số liệu từ ảnh là ước tính, có thể lệch 20 đến 30%, nhất là dầu mỡ và nước sốt không nhìn thấy. Không thay thế tư vấn của bác sĩ và không dùng để chỉnh liều thuốc hay insulin.
