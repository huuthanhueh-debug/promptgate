# PLAN · Exchangethings.vn

> MVP chạy thật với thanh toán và vận chuyển giả lập (mock), đủ 5 kịch bản mẫu, sẵn sàng gắn PayOS và đơn vị vận chuyển khi có hợp đồng. Ước lượng tính theo ngày làm việc của một người điều phối Claude Code và tự duyệt kết quả.

## 1. Các mốc

| Mốc | Phạm vi | Đầu ra | Xong khi | Ước lượng |
|---|---|---|---|---|
| **M0** | Kế hoạch, đặc tả, wireframe | `PLAN.md`, `SPEC.md`, `DECISIONS.md`, `wireframes/` (4 màn, 2 phương án màu) | Chủ dự án duyệt SPEC và chọn phương án màu | **Đã duyệt 22/11/2026**, chọn màu A Xanh ngọc |
| **M1** | Nền móng | Repo Next.js + Supabase; migration toàn bộ bảng + RLS; đăng nhập email/Google; hồ sơ; địa chỉ 34 tỉnh/thành; đăng món 6 loại; tải ảnh có xóa EXIF; seed 30 món, 10 người dùng cho hai phía của 5 kịch bản (có 1 tài khoản mới), 1 admin | Test RLS cho profiles, items, item_media pass; seed chạy lại cho cùng kết quả | **Đã duyệt 22/11/2026**. Sau đợt rà soát độc lập 23/11/2026 (DECISIONS D-27): 225 test tự động và 20 bước kiểm thử đầu cuối đạt; cài database không cần token (D-30) |
| **M2** | Quẹt, khớp, chat | Chồng thẻ, bộ lọc, điểm gợi ý; tạo match; hiệu ứng khớp; chat realtime có che SĐT và số tài khoản | Unit test điểm gợi ý pass; e2e "hai người thích nhau thì khớp" pass | 2 ngày |
| **M3** | Đề nghị | Màn đề nghị hai cột; phiên bản đề nghị; phản đề nghị; hết hạn 48 giờ; cán cân công bằng; mức bù gợi ý | Unit test độ lệch và mức bù pass; e2e phần thương lượng của kịch bản 1 pass | 2 ngày |
| **M4** | Giao dịch | State machine; ký quỹ mock; cọc theo uy tín; thứ tự gửi; vận chuyển mock; gặp trực tiếp; két số; tự hoàn tất 72 giờ | Test mọi chuyển trạng thái (cả chuyển sai bị từ chối); e2e đủ 5 kịch bản pass | 3-4 ngày |
| **M5** | Uy tín và kiểm duyệt | Đánh giá; điểm uy tín và hạng; báo cáo; chặn; khiếu nại; trang admin; cấu hình `platform_settings` | Test RLS cho két, chat, địa chỉ, khiếu nại pass; admin xử lý trọn một khiếu nại mẫu | 2-3 ngày |
| **M6** | Hoàn thiện | Song ngữ VI/EN; PWA; tối ưu hiệu năng; bản nháp văn bản pháp lý; README; deploy Vercel preview | Lighthouse mobile đạt ngưỡng; không lỗi console; không sót chữ chưa dịch | 2 ngày |

Tổng ước lượng cho M1 đến M6: khoảng **13-16 ngày làm việc**. Mỗi mốc mở một session Claude Code mới, bắt đầu bằng: *"Đọc PLAN.md, SPEC.md, DECISIONS.md, làm tiếp mốc Mx"*.

## 2. Việc của chủ dự án (làm song song, không chặn M1-M6)

| Việc | Cần trước khi | Ghi chú |
|---|---|---|
| Kiểm tra và đăng ký tên miền exchangethings.vn, nhãn hiệu | Ra mắt | Tra tại nhà đăng ký tên miền .vn được VNNIC công nhận |
| Chọn pháp nhân vận hành sàn | Ký hợp đồng thanh toán | Cần cho đăng ký sàn thương mại điện tử và ký với PayOS |
| Hỏi PayOS về ký quỹ cho mô hình sàn | Bật thanh toán thật | Hỏi rõ: giữ tiền đến khi hai bên xác nhận, hoàn tiền, phí, hạn mức |
| Chọn đơn vị vận chuyển | Bật vận chuyển thật | So sánh API trạng thái "đã lấy hàng", phí, độ phủ |
| Nhà cung cấp SMS OTP (tin nhắn thương hiệu) | Bật xác minh SĐT thật | Tin nhắn thương hiệu cần đăng ký tên gửi |
| Luật sư rà soát Điều khoản, Chính sách quyền riêng tư, Quy chế sàn | Ra mắt | Bản nháp có ở M6 |
| Người trực kiểm duyệt và khiếu nại | Ra mắt | Cam kết xử lý khiếu nại trong 48 giờ |

## 3. Sau MVP (M7 trở đi)

1. Gắn PayOS thật (sau khi xác nhận ký quỹ), giữ mock cho môi trường test.
2. Gắn đơn vị vận chuyển thật, đồng bộ trạng thái vận đơn tự động.
3. SMS OTP thật.
4. Ra mắt thử ở 1-2 thành phố, mời người dùng từ các hội nhóm đổi đồ, điện thoại, thời trang.
5. Nội dung giới thiệu: quay màn quẹt thẻ và cán cân công bằng làm video ngắn (theo cách Viktor Oddy làm trong bài học trước).

## 4. Rủi ro chính

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Không tìm được đối tác ký quỹ phù hợp | Cao | Bắt đầu hỏi PayOS ngay; giữ interface để thay đối tác; giai đoạn đầu ưu tiên đổi ngang và gặp trực tiếp (không cần ký quỹ) |
| Lừa đảo bằng tài khoản mới | Cao | Cọc 20%, giới hạn 5 triệu, gửi trước, khiếu nại có bằng chứng |
| Hàng giả, hàng cấm | Cao | Chứng từ bắt buộc với hàng hiệu, lọc từ khóa, duyệt loại "khác", báo cáo |
| Mã/voucher đã dùng | Vừa | Két số, 72 giờ khiếu nại, trừ uy tín nặng khi thua |
| Ít người dùng lúc đầu, quẹt không có gì | Vừa | Ra mắt theo thành phố; seed món thật từ cộng đồng; miễn phí |
| Quy định thương mại điện tử mới | Vừa | Luật sư rà soát trước ra mắt; theo dõi văn bản hướng dẫn Luật 122/2025/QH15 |

## 5. Chỉ số cần theo dõi sau ra mắt

Đặt mục tiêu cụ thể sau 2 tuần chạy thử, khi đã có số liệu thật.

| Chỉ số | Cách tính |
|---|---|
| Món đăng mới mỗi tuần | Số `items` chuyển sang active |
| Tỉ lệ khớp | Số match / số lượt thích |
| Tỉ lệ khớp thành giao dịch | Số giao dịch locked / số match |
| Tỉ lệ hoàn tất | Số completed / số locked |
| Tỉ lệ khiếu nại | Số disputed / số locked |
| Thời gian phản hồi trung vị | Từ tin nhắn đầu của một bên tới tin trả lời của bên kia |
