# DECISIONS · Exchangethings.vn

> Nhật ký quyết định. Mỗi mục: bối cảnh, quyết định, hệ quả. "Chủ dự án" là lựa chọn anh đã bấm ngày 22/11/2026; "Thiết kế" là quyết định kỹ thuật đề xuất trong M0, chờ anh duyệt cùng SPEC.

## Do chủ dự án chọn

| # | Quyết định | Bối cảnh | Hệ quả |
|---|---|---|---|
| D-01 | Tên thương hiệu **Exchangethings.vn** | Tên tạm "Swap & Buy" là từ chung, khó đăng ký nhãn hiệu. Tên "Keo.vn" bị loại vì chữ "kèo" trên mạng gắn với cá cược bóng đá, dễ bị quảng cáo và cổng thanh toán soi kỹ | Cần kiểm tra và đăng ký tên miền exchangethings.vn và nhãn hiệu trước khi ra mắt |
| D-02 | **Miễn phí** giai đoạn đầu | Sàn hai chiều cần đủ người đăng và người quẹt trước | Phí đặt 0% trong `platform_settings`; giao diện ghi "Miễn phí"; cơ chế phí vẫn được code và test |
| D-03 | Đổi **mọi thứ hợp pháp**: 5 loại chính + loại "khác" | Chủ dự án muốn sàn không giới hạn loại món | Loại "khác" phải chờ admin duyệt; danh sách hàng cấm áp dụng cho mọi loại |
| D-04 | Giao hàng vật lý bằng **cả gặp trực tiếp và vận chuyển** | Linh hoạt, phủ toàn quốc | Cần cơ chế cọc và thứ tự gửi cho kiểu vận chuyển |
| D-05 | **Cọc theo điểm uy tín**: mới 20%, thường 10%, uy tín cao 0% | Thưởng người làm ăn sòng phẳng, gây khó cho tài khoản mới lập để lừa | Cần định nghĩa hạng rõ ràng (SPEC mục 3) và test cho cả ba mức |
| D-06 | Đối tác thanh toán ưu tiên **PayOS (VietQR)**; MVP dùng mock | Người dùng Việt quen chuyển khoản bằng mã QR | Phải xác nhận PayOS cung cấp được ký quỹ cho mô hình sàn trước khi bật; giữ interface để thay đối tác nếu cần |
| D-17 | **Duyệt M0**: SPEC giữ nguyên phạm vi (6 loại món, 5 kịch bản), màu A Xanh ngọc | Chủ dự án duyệt ngày 22/11/2026 | Bắt đầu M1 trong repo riêng của dự án |

## Quyết định thiết kế (đã được duyệt cùng M0)

| # | Quyết định | Lý do | Hệ quả |
|---|---|---|---|
| D-07 | Nền tảng **không tự giữ tiền**; dùng trung gian thanh toán có ký quỹ | Giữ tiền người dùng cần giấy phép của Ngân hàng Nhà nước | Mọi khoản tiền đi qua `PaymentProvider`; MVP là mock |
| D-08 | **Chỉ VND** trên giao diện | Thông tư 32/2013/TT-NHNN hạn chế niêm yết và thanh toán bằng ngoại tệ trong nước | Ví dụ "100 USD" của chủ dự án thành 2.600.000 ₫ trong dữ liệu mẫu |
| D-09 | Địa chỉ theo **34 tỉnh/thành, 2 cấp** | Cải cách hành chính có hiệu lực từ 01/07/2025, không còn cấp huyện | Bảng mã tỉnh và phường/xã theo danh mục mới; form địa chỉ 2 bước |
| D-10 | **Két số** với luật mở theo kiểu giao dịch | Chống nhận mã đã dùng, chống lấy mã rồi bỏ đi | Nội dung mã hóa, signed URL 10 phút, ghi log mỗi lần xem |
| D-11 | **Bên uy tín thấp hơn gửi trước** | Giảm rủi ro mà không cần cọc bằng toàn bộ giá trị món | Cần trạng thái "đã lấy hàng" từ vận chuyển (mock: nhập tay) |
| D-12 | **Giới hạn 5.000.000 ₫** mỗi giao dịch cho Thành viên mới | Kẻ gian thường dùng tài khoản mới | Người dùng thật vẫn giao dịch nhỏ ngay; dữ liệu mẫu kịch bản 1 và 2 dùng tài khoản đã đủ điều kiện |
| D-13 | Stack **Next.js + Supabase** (Postgres, Auth, Storage, Realtime, RLS) | Một nền tảng có sẵn chat realtime, lưu ảnh và phân quyền ở tầng dữ liệu; đi nhanh cho MVP | Phụ thuộc Supabase; nếu cần đổi thì giữ lớp truy cập dữ liệu tách riêng |
| D-14 | Hiệu ứng chủ đạo **"cán cân công bằng"** | Cho hai bên thấy ngay chênh lệch giá trị và mức bù hợp lý; khác biệt so với các app quẹt thẻ khác | Màn đề nghị là màn quan trọng nhất về thiết kế; cần test cách tính độ lệch |
| D-15 | Font **Be Vietnam Pro** | Thiết kế cho tiếng Việt, dấu hiển thị chuẩn ở mọi cỡ chữ | Nạp qua next/font, tự host |
| D-16 | Hai phương án màu: **A Xanh ngọc** (#0F766E) và **B Cam đất** (#C2410C) | A gợi cảm giác tin cậy và tái sử dụng; B năng động, gợi cảm giác săn deal. Đã tránh tím kiểu AI và màu nhận diện của Tinder, Shopee, Chợ Tốt | **Chủ dự án chọn A Xanh ngọc** (22/11/2026). Tương phản chữ trên nút đo được 5,4:1 (A) và 5,0:1 (B) ở chế độ sáng, 7,3:1 và 6,9:1 ở chế độ tối; mọi cặp màu chữ/nền chính đều từ 4,5:1 trở lên (chuẩn WCAG AA) |

## Quyết định khi xây M1 (22/11/2026)

| # | Quyết định | Bối cảnh | Hệ quả |
|---|---|---|---|
| D-18 | Dữ liệu riêng tư **tách bảng**: `profile_private` (số điện thoại, địa chỉ), `item_private` (IMEI đầy đủ) | RLS chặn theo dòng, không chặn theo cột; để chung bảng thì ai đọc được hồ sơ cũng đọc được số điện thoại | Chỉ chủ sở hữu và admin đọc được. **Lệch SPEC mục 11**: số điện thoại và IMEI chưa mã hóa ở tầng ứng dụng (Supabase đã mã hóa ổ đĩa). Kế hoạch: mã hóa cùng hạ tầng khóa của két số ở M4; khi đó chưa ra mắt nên chưa có dữ liệu thật phải chuyển |
| D-19 | Dữ liệu mẫu: **10 người dùng cho hai phía của 5 kịch bản** (Giang là tài khoản mới) và 1 admin; IMEI mẫu hợp lệ theo thuật toán Luhn | PLAN cũ ghi "8 mẫu + 1 mới", không đủ người cho cả hai phía của 5 kịch bản | Seed sinh từ script; test kiểm tra file seed khớp script từng byte và chạy lại cho cùng kết quả |
| D-20 | **Chỉ server ghi ảnh**: xoay đúng chiều, xóa toàn bộ EXIF, GPS, XMP, lưu WebP 1600px kèm bản 480px cho lưới món | Nếu người dùng tự ghi bảng ảnh thì có thể bỏ qua bước xóa vị trí | Bảng `item_media` không cấp quyền ghi cho người dùng; trình duyệt thu nhỏ ảnh trước khi gửi để tải nhanh trên 4G; ảnh chứng từ chỉ chủ món và admin xem |
| D-21 | Bộ lọc từ khóa **so khớp nguyên từ, giữ dấu** | So khớp chuỗi con bỏ dấu bắt nhầm: "đạn" khớp "Đàn", "chó" khớp "cho", "thuốc" khớp "thuộc" | Từ đơn có dấu chỉ khớp khi giữ dấu; cụm nhiều từ và từ không dấu khớp cả khi gõ không dấu ("hang fake", "ma tuy") |
| D-22 | **Chống lách kiểm duyệt** | Khi viết test tìm ra 4 cách lách | Không đổi danh mục khi món đã đăng (tránh đăng ở danh mục dễ rồi chuyển sang hàng hiệu); món bị admin từ chối, đăng lại vẫn phải chờ duyệt; lọc từ khóa cả khi món chờ duyệt và kiểm lại lúc admin bấm duyệt; người dùng không tự ghi 4 số cuối IMEI |
| D-23 | **Lớp dữ liệu server dùng `pg`**: mỗi request đặt vai trò và JWT claims trong transaction, như Supabase/PostgREST | Theo D-13 (giữ lớp truy cập dữ liệu tách riêng); test RLS và app dùng chung một cơ chế | RLS áp dụng y hệt khi app chạy; chạy được với Postgres local và Supabase (qua pooler). Đăng nhập thật: Supabase Auth (link qua email, Google). Máy dev có `AUTH_MODE=dev` để đăng nhập bằng người dùng mẫu; chế độ này tự từ chối khi database không ở localhost hoặc khi chạy trên Vercel |
| D-24 | Tên ngắn 6 thành phố trực thuộc trung ương: Hà Nội, Hải Phòng, Huế, Đà Nẵng, Cần Thơ, **TP.HCM** | Dữ liệu gốc để tên ngắn trùng tên đầy đủ ("Thành phố Hà Nội") nên thẻ món bị cắt chữ | Script sinh migration tự rút gọn; dữ liệu gốc giữ nguyên để truy nguồn |
| D-25 | Mọi phần đọc phiên đăng nhập nằm trong `<Suspense>` và gọi `connection()` trước | Next.js 16 bật Cache Components và Partial Prefetching: đọc cookie hay giờ hệ thống ngoài Suspense làm hỏng build | Trang có khung tĩnh hiện ngay, phần riêng của từng người tải sau; build không cần biến môi trường; điều hướng thanh dưới chỉ gồm mục đã chạy được (Quẹt, Khớp vào ở M2) |
