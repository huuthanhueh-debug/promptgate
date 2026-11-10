# Vision 6D (Android)

Ứng dụng điện thoại dựng bằng [three.js](https://threejs.org/): chụp một tấm ảnh rồi

- **Chế độ 6D**: biến ảnh thành khối nổi 3D và điều khiển theo **6 trục** như cánh tay robot 6 trục. J1 xoay ngang, J2 ngửa/cúi, J3 nghiêng, J4 trượt ngang, J5 trượt dọc, J6 tiến/lùi. Có ba kiểu hiển thị (ảnh nổi, kết hợp, hologram) và thanh **Tách lớp** kéo ảnh ra thành từng tầng theo độ sâu.
- **Chế độ Cơ thể**: khi ảnh có người, app phủ lên mô hình hologram gồm **xương, cơ quan, mạch máu**, chuỗi DNA và nhãn tiếng Việt. Chạm vào nhãn hoặc bộ phận để xem mô tả. Bật/tắt từng hệ, tách lớp, căn chỉnh mô hình cho khớp với người trong ảnh.

Điều khiển: 1 ngón kéo để xoay; 2 ngón chụm (tiến/lùi), xoắn (nghiêng), kéo (trượt). Thêm **Tự xoay**, **Con quay** (nghiêng điện thoại) và **Lưu ảnh**.

Giao diện **song ngữ Việt / Anh**: nút `EN` / `VI` ở góc trên của cả hai màn hình đổi toàn bộ nút bấm, nhãn giải phẫu và mô tả. App tự chọn theo ngôn ngữ máy ở lần mở đầu và nhớ lựa chọn cho lần sau.

App chạy hoàn toàn offline. APK không xin quyền Internet, chỉ xin quyền Camera; ảnh không rời khỏi máy.

## Cài lên điện thoại

1. Vào tab **Actions** của repo, mở lần chạy mới nhất của workflow `mobile-apk`, tải artifact **vision6d-apk** và giải nén lấy file `.apk`.
2. Chép file sang điện thoại Android (7.0 trở lên), mở file, cho phép "Cài ứng dụng không rõ nguồn gốc".

APK ký bằng khóa debug tạo mới mỗi lần build, nên khi cài bản mới phải gỡ bản cũ trước. Muốn cập nhật đè, hãy build với khóa riêng (biến `V6D_KEYSTORE`, `V6D_KEY_ALIAS`, `V6D_KEYSTORE_PASS`).

## Chạy và build trên máy tính

```bash
node mobile/build.js                 # dựng web app vào mobile/dist/www
npx serve mobile/dist/www            # hoặc bất kỳ static server nào, rồi mở bằng Chrome
node mobile/build.js --apk           # dựng APK (cần JDK 17+ và Android SDK, đặt ANDROID_HOME)
node tests/mobile.js                 # test (có Android SDK thì build và kiểm tra luôn APK)
node tests/mobile-e2e.js             # chạy thử trên Chromium giả lập điện thoại (cần Playwright)
```

Camera chỉ mở được trên `https://` hoặc `localhost`. Không có camera vẫn dùng được bằng **Thư viện** hoặc hai **ảnh mẫu**.

## Cấu trúc

| Đường dẫn | Vai trò |
|---|---|
| `src/lib/depth.js` | Ước lượng độ sâu và nhận diện người từ điểm ảnh |
| `src/lib/sixdof.js` | Toán 6 trục: giới hạn, cử chỉ, con quay |
| `src/lib/anatomy.js` | Dữ liệu giải phẫu (83 bộ phận, 16 nhãn) |
| `src/lib/scene.js` | Dựng mesh three.js: ảnh nổi, cơ thể, DNA |
| `src/lib/i18n.js` | Bảng chuỗi tiếng Việt và tiếng Anh |
| `src/app.js`, `src/index.html` | Giao diện, camera, vòng lặp render |
| `src/vendor/` | three.js r170 (MIT), kèm giấy phép |
| `android/` | Vỏ WebView (Java), manifest, icon, trình ghi zip |
| `build.js` | Dựng web và APK, không dùng Gradle hay npm |

## Giới hạn cần biết

- **"6D" nghĩa là 6 bậc tự do** (3 xoay + 3 tịnh tiến) của một ảnh đã dựng nổi. Đây không phải dữ liệu 6 chiều thật.
- **Độ sâu là ước lượng** từ độ nét, vị trí và độ sáng của một ảnh đơn, không dùng mô hình AI. Ảnh có chủ thể rõ nét trên nền mờ cho kết quả đẹp nhất.
- **Nhận diện người là heuristic** theo màu da và dáng đứng. Ảnh cận mặt hoặc người nằm ngang có thể không nhận ra: bấm **Cơ thể** để chuyển tay, rồi dùng tab **Căn chỉnh**.
- **Mô hình giải phẫu là hình minh họa chuẩn**, đặt chồng lên ảnh. App không nhìn xuyên được cơ thể thật và không dùng để chẩn đoán y khoa.
