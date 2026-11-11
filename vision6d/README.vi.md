# Vision 6D

Bóc tách bất kỳ hình ảnh nào thành file **3D, 4D và 6D** trên máy tính, và khám phá ảnh theo 6 trục trên điện thoại. Dựng bằng [three.js](https://threejs.org/), không cần cài thêm thư viện, chạy hoàn toàn trên máy của anh/chị: ảnh không được gửi đi đâu.

[English](README.md)

## Ứng dụng máy tính

### Cách 1 (khuyên dùng, không cài gì): mở `Vision6D.html`

Tải riêng file [`Vision6D.html`](Vision6D.html) (hoặc cả repo), bấm đúp để mở bằng **Edge hoặc Chrome**. Không cần Node.js, không chạy script, không cài đặt, nên **Windows Smart App Control không chặn** (nó chỉ chặn chương trình và script không có chữ ký, không chặn trang web). Trang chạy hoàn toàn trong trình duyệt và không có quyền truy cập mạng.

Khi bấm **Bóc tách**, Edge/Chrome hỏi chọn thư mục để lưu (chỉ hỏi một lần mỗi lần mở). Trình duyệt không hỗ trợ chọn thư mục (Firefox, Safari) sẽ nhận một file `Vision6D.zip` trong Tải xuống, bên trong có cùng cấu trúc thư mục.

### Cách 2: chạy bằng Node.js (cần [Node.js](https://nodejs.org) 18 trở lên)

| Hệ điều hành | Cách mở |
|---|---|
| Mọi máy (gõ trong terminal; `node.exe` có chữ ký nên không bị chặn) | `node tools/desktop.js` |
| Windows | Bấm đúp `Vision6D.cmd` (có thể bị Smart App Control chặn, khi đó dùng cách 1 hoặc dòng lệnh trên) |
| macOS, Linux | `./vision6d.sh` |

Cách này mở cửa sổ riêng và ghi file thẳng vào thư mục `Vision6D` trong thư mục người dùng (đổi bằng `--out`).

Cửa sổ app: Kéo thả một hoặc nhiều ảnh vào (JPG, PNG, WebP, GIF, BMP, AVIF), xem trước ở bốn chế độ **3D / 4D / 6D / Điểm**, rồi bấm **Bóc tách tất cả**. Mỗi ảnh được ghi vào một thư mục riêng trong `Vision6D` ở thư mục người dùng (đổi bằng `--out <thư mục>`).

**Mỗi ảnh cho ra:**

| File | Nội dung | Mở bằng |
|---|---|---|
| `model-3d.glb` | Khối nổi 3D có ảnh phủ | 3D Viewer của Windows, Blender, PowerPoint, trình xem glTF bất kỳ |
| `model-4d.glb` | 3D + thời gian: hoạt ảnh nổi lên từ ảnh phẳng rồi tách lớp, lặp 8 giây | như trên (bật phát hoạt ảnh) |
| `model-6d.glb` | Mỗi lớp độ sâu là một phần riêng; hoạt ảnh tách các lớp rồi đưa cả khối qua 6 trục J1–J6 | như trên |
| `points-6d.ply` | Đám mây điểm, mỗi điểm 6 giá trị: X Y Z R G B | MeshLab, CloudCompare, Blender |
| `layers/layer-N.png` | Từng lớp ảnh trong suốt, xếp từ xa đến gần | phần mềm ảnh bất kỳ |
| `depth.png`, `normal.png` | Bản đồ độ sâu (trắng = gần) và bản đồ pháp tuyến | phần mềm ảnh, phần mềm 3D |
| `anatomy.glb` | Xương, cơ quan, mạch máu khớp theo người trong ảnh (chỉ khi ảnh có người) | như file GLB |
| `photo.jpg`, `scene.json` | Ảnh gốc đã chuẩn hóa và bản mô tả thông số, danh sách file | |

**Thiết lập:** độ chi tiết lưới (128–512), độ sâu, số lớp (2–12), đảo chiều sâu, có xuất mô hình giải phẫu hay không. Nút **Nạp depth map riêng** cho phép dùng ảnh độ sâu từ công cụ khác để có kết quả chính xác hơn. Nút `EN` / `VI` đổi ngôn ngữ.

## Ứng dụng điện thoại (Android)

Chụp hoặc chọn một tấm ảnh rồi xoay, trượt, tách lớp theo 6 trục bằng ngón tay, thanh trượt hoặc con quay. Ảnh có người thì hiện mô hình xương, cơ quan, mạch máu kèm nhãn và mô tả. App không xin quyền Internet, chỉ xin quyền Camera.

Tải APK ở tab **Actions** của repo: mở lần chạy mới nhất, tải artifact **vision6d-apk**, giải nén rồi cài lên máy Android 7.0 trở lên. APK ký bằng khóa debug tạo mới mỗi lần build, nên cài bản mới phải gỡ bản cũ trước (hoặc build với khóa riêng qua `V6D_KEYSTORE`, `V6D_KEY_ALIAS`, `V6D_KEYSTORE_PASS`).

## Các con số "D" nghĩa là gì

- **3D:** lưới tam giác có tọa độ x, y, z, phủ bằng chính bức ảnh.
- **4D:** 3D cộng thêm thời gian. File chứa hai biến dạng ("flatten" và "teardown") được điều khiển theo một dòng thời gian lặp.
- **6D:** sáu bậc tự do, gồm ba hướng xoay (J1 xoay ngang, J2 ngửa/cúi, J3 nghiêng) và ba hướng tịnh tiến (J4 ngang, J5 dọc, J6 tiến/lùi), bố trí như cánh tay robot sáu trục. File point cloud cũng mang sáu giá trị cho mỗi điểm.

## Giới hạn cần biết

- **Độ sâu là ước lượng** từ độ nét, vị trí và độ sáng của một ảnh đơn, không phải đo thật và không dùng mô hình AI. Ảnh có chủ thể rõ trên nền mờ cho kết quả tốt nhất; ảnh phẳng, ít chi tiết sẽ cho khối nổi mang tính trang trí. Muốn chính xác, hãy nạp depth map riêng.
- **Nhận diện người là heuristic** theo màu da và dáng đứng; ảnh cận mặt hoặc người nằm có thể không nhận ra. Khi đó chọn "Luôn xuất" ở mục Mô hình giải phẫu.
- **Mô hình giải phẫu là hình minh họa chuẩn** đặt khớp theo khung người. Nó không lấy từ cơ thể thật trong ảnh và không dùng để chẩn đoán y khoa.
- Bản `Vision6D.html` cần Edge hoặc Chrome để chọn thư mục lưu (trình duyệt khác vẫn dùng được nhưng nhận file `.zip`). Cách 2 cần thêm Node.js. Chưa có bản cài đặt `.exe` (một `.exe` không ký cũng sẽ bị Smart App Control chặn).

## Dành cho người phát triển

```bash
node tests/run.js           # mọi test chỉ cần Node (có Android SDK thì build và kiểm tra luôn APK)
node tests/desktop-e2e.js   # chạy thật app máy tính trên Chromium (cần Playwright)
node tests/mobile-e2e.js    # chạy thật app điện thoại trên Chromium (cần Playwright)
node tests/standalone-e2e.js # chạy thật Vision6D.html mở từ ổ đĩa (cần Playwright)
node tools/build.js --standalone   # dựng lại Vision6D.html sau khi sửa mã nguồn
node tools/build.js --apk   # dựng APK (cần JDK 17+ và Android SDK, đặt ANDROID_HOME)
```

| Thư mục | Vai trò |
|---|---|
| `core/` | Dùng chung: ước lượng độ sâu, nhận diện người, toán 6 trục, dữ liệu giải phẫu, dựng scene three.js, three.js r170 |
| `desktop/` | Cửa sổ app máy tính; `lib/glb.js` ghi file glTF, `lib/extract.js` bóc tách |
| `mobile/` | Giao diện app điện thoại |
| `android/` | Vỏ WebView (Java), manifest, icon |
| `tools/` | `desktop.js` mở app, `server.js` server cục bộ, `bundle.js` gộp module thành một script, `build.js` dựng `Vision6D.html` và APK |
| `tests/` | Test Node và test trên trình duyệt |

Server cục bộ chỉ nghe ở `127.0.0.1`, yêu cầu mã bí mật tạo mới mỗi lần mở, và chỉ ghi file vào thư mục xuất.

Giấy phép MIT. three.js © các tác giả three.js, giấy phép MIT (`core/vendor/THREE-LICENSE`).
