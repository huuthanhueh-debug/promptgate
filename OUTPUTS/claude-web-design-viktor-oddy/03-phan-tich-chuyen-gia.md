# 03 · Phân tích chuyên gia

## Tóm tắt

1. "Một prompt" trong video là **lệnh kích hoạt ngắn**, chạy trên một session đã nạp sẵn quy trình (SOP). Giá trị thật nằm ở phần chuẩn bị đó, không nằm ở câu lệnh.
2. Quy trình có **2 điểm dừng cho người duyệt** (chọn phương án, duyệt bản dựng). Mọi bước còn lại do agent làm, kể cả tự kiểm tra trên desktop và điện thoại.
3. Mỗi site dựng xong được dùng 3 lần: làm portfolio, làm nội dung đăng mạng xã hội, và đóng gói thành prompt để bán hoặc tặng.
4. Phần bán hàng mới là trọng tâm: video demo → bài đăng có từ khóa DM → redesign site thật của khách tiềm năng → gửi email.
5. Các con số thu nhập là lời quảng cáo. Kỹ thuật thì làm lại được, và anh đã có công cụ để làm (Claude Code, file `templates/CLAUDE.md` trong thư mục này).

---

## 1. Quy trình thật phía sau "một prompt"

```
 Tham chiếu (Pinterest, Dribbble, ảnh chụp màn hình)
   │  lệnh: "Here's the next one" + link
   ▼
 [1] Claude tải và đọc ảnh tham chiếu
 [2] Vẽ 3 phương án ảnh 1K, bỏ watermark và QR      ──►  NGƯỜI CHỌN: "opt 1" + Free/Paid
 [3] Dựng HTML/CSS/JS (sửa từ code gốc nếu có)
 [4] Tự kiểm tra: chạy preview, đo ở cỡ desktop và điện thoại, mở Chrome   ──►  NGƯỜI DUYỆT: "ok"
 [5] Đóng gói: video quay · prompt · file standalone · ảnh preview → đăng lên motionsites.ai
   ▼
 [6] Video → session Claude mới → bài cho X, LinkedIn, Threads → đăng, tự trả lời có từ khóa DM
 [7] Tìm doanh nghiệp thật → "redesign for this company <URL>" → email "I built you this…" → Vercel
```

Bằng chứng trên màn hình: session tên "PROMTPS THUS" chứa hàng chục mẫu; thanh bên có các ghi chú "SOP: Website Hero Redesign…", "SOP: Pinterest Reference…"; Claude tự nhắc *"I'll wait for your OK before the recording, prompt, standalone file and preview"*; session đã bị nén một lần, tiết kiệm 355,7 nghìn token. Không người mới nào gõ "Here's the next one" vào một chat trống mà ra được kết quả như vậy.

---

## 2. Năm kỹ thuật đáng học

| # | Kỹ thuật | Trong video | Vì sao hiệu quả | Cách anh làm lại |
|---|---|---|---|---|
| 1 | **SOP cố định, lệnh siêu ngắn** | "Here's the next one", "opt 1", "opt 2 free" | Quy trình viết một lần, mỗi lượt sau chỉ còn vài chữ, kết quả đồng đều | Đặt SOP vào `CLAUDE.md` của dự án (mẫu ở `templates/CLAUDE.md`). Đặt trong file thì sau khi session bị nén hay mở session mới vẫn còn; đặt trong lịch sử chat thì có thể mất. |
| 2 | **3 phương án trước khi code** | Ảnh mockup 1K chất lượng thấp, rẻ và nhanh | Chọn hướng khi việc đổi hướng còn rẻ; tránh dựng xong mới thấy sai | Prompt W-02. Không có công cụ tạo ảnh thì làm 3 file HTML tĩnh |
| 3 | **Sửa từ code có sẵn** | "here is the original code so you won't start from scratch" | Ít token hơn, giữ được những chi tiết đã đúng | Luôn chỉ cho Claude file gốc (W-03 có sẵn dòng này) |
| 4 | **Agent tự kiểm tra** | Preview server, đo ở cỡ desktop và điện thoại, mở Chrome để duyệt | Phần lớn lỗi bị bắt trước khi người phải xem | `.claude/launch.json` + autoVerify (đã bật mặc định). Mẫu ở `templates/launch.json` |
| 5 | **Mỗi bản dựng thành 3 tài sản** | Video, prompt, file standalone | Một giờ làm việc thành portfolio, nội dung đăng và sản phẩm bán được | Prompt W-05 tạo đủ bộ trong thư mục `release/` |

Thêm hai thói quen tốt nhìn thấy trong phần bảo trì sản phẩm Studio: **có test tự động** (Claude báo 190 rồi 198 test pass) và **Claude hỏi trước khi push code** ("Push the free-designs-only rule?").

---

## 3. Mô hình kinh doanh

| Tầng | Thứ được bán | Giá thấy trong video | Vai trò |
|---|---|---|---|
| Nội dung miễn phí | Video, bài X/Instagram, mỗi ngày 2 bài | 0 | Kéo người xem |
| Prompt | motionsites.ai, có prompt miễn phí | Không thấy giá trên màn hình | Mồi thu lead, kiếm thêm |
| SaaS | MotionSites Studio | 25 đến 499 USD mỗi tháng (ngân sách AI) | Doanh thu định kỳ |
| Dịch vụ | Làm site cho thương hiệu thời trang, làm đẹp, xa xỉ | Không công bố | Hợp đồng giá trị cao |
| Quảng cáo | Banner tài trợ trên motionsites.ai | Không công bố | Kiếm tiền từ lượng truy cập |

Vòng quay: **dựng → quay → đăng → có DM → có khách hoặc người dùng → có tiền và chất liệu để dựng tiếp.** Mỗi vòng tạo thêm nội dung cho vòng sau.

---

## 4. Điều video không nói

**Chi phí.** Opus ở mức Medium, session hàng trăm nghìn token, mỗi phương án là một lần gọi tạo ảnh; tài khoản trong video là gói Ultra. "Không tốn tiền" chỉ đúng với người đã trả gói cao. Cách giảm chi phí: phương án ở độ phân giải thấp, sửa từ code có sẵn, mỗi mẫu mở một session riêng.

**Bản quyền.** Ảnh Pinterest trong video có watermark và QR của một studio khác; Claude được dặn bỏ hai thứ đó đi, rồi bản dựng được đóng gói thành prompt để phát hành. Bỏ watermark không làm thiết kế thành của mình. Nên dùng tham chiếu để học bố cục và nhịp chuyển động, thay ảnh, màu, chữ và chi tiết đủ để thành bản khác, dùng ảnh có giấy phép, và ghi nguồn khi có thể. Các prompt W-01, W-02 đã có sẵn ràng buộc này.

**Concept mang thương hiệu người khác.** Làm bản redesign cho bobobobo.com rồi gửi email là cách chào hàng mạnh, nhưng chỉ nên gửi riêng cho doanh nghiệp đó, ghi rõ "bản concept", và không đăng công khai khi chưa được đồng ý (W-08 đã có ràng buộc này).

**Từ bản nháp đến bản bàn giao.** Chính Viktor nói *"this is just a first draft"*. Một site one-shot thường còn thiếu: thẻ SEO và Open Graph, tối ưu video nền nặng, prefers-reduced-motion, chỗ cho khách tự sửa nội dung, form thu lead, analytics, chính sách quyền riêng tư. Prompt W-04 và checklist trong `05-playbook-web.md` lấp các chỗ này.

**3D không phải lúc nào cũng nên dùng.** Viktor cũng nói đa số doanh nghiệp không cần. Hiệu ứng nặng làm chậm trang và ảnh hưởng SEO. Nên chọn một hiệu ứng chủ đạo cho hero, phần còn lại giữ đơn giản.

**Mở dần tính năng (staged rollout).** Bật cho 10% người dùng trước là thông lệ chuẩn của dev chuyên nghiệp, không phải mẹo riêng của AI. Prompt W-11 đưa việc này thành feature flag có chỉ số đo.

---

## 5. Áp dụng cho ngành khách sạn và F&B

| Ý tưởng trong video | Phiên bản cho khách sạn, nhà hàng |
|---|---|
| Vòng cung thử đồ (VirtualFit) | Vòng cung các hạng phòng quanh một khung cảnh: xoay đến hạng nào thì giá, diện tích, view, nút "Đặt phòng" đổi theo |
| Hero đổi ngày sang đêm (công ty điện mặt trời) | Hero ảnh biển sáng và tối, gạt công tắc để xem không khí ban đêm, phù hợp resort hoặc rooftop bar |
| Trang chủ như sàn diễn thời trang (Runway Lookbook) | Thực đơn như sàn diễn: món sau "bước ra", phần mô tả và giá đổi theo, kèm nút đặt bàn |
| Bài đăng + từ khóa DM | Đăng LinkedIn nhắm chủ khách sạn hoặc nhà hàng: *"Comment 'MENU' để nhận 3 ý tưởng cho website của bạn"* |
| Radar xu hướng (WebMCP, agent-ready) | **Website khách sạn sẵn sàng cho AI agent**: khai báo cho agent các thao tác "xem phòng trống", "đặt phòng", "hỏi chính sách hủy". Đây là cách giữ booking trực tiếp khi khách bắt đầu nhờ AI đặt phòng thay cho OTA. WebMCP còn ở giai đoạn thử nghiệm (11/2026), nên chuẩn bị dần, chưa nên đầu tư lớn. |

---

## 6. Kết luận

Video dạy một kỹ năng thật: **dựng quy trình cho AI trước, rồi điều khiển bằng lệnh ngắn**, cộng với một cách bán hàng rõ ràng. Phần nên học: SOP trong `CLAUDE.md`, 3 phương án trước khi code, agent tự kiểm tra, mỗi bản dựng thành 3 tài sản, chào hàng bằng bản redesign. Phần nên bỏ qua: các con số "chắc chắn có khách" hay "10-20 nghìn USD trong 3 tháng". Bộ prompt W-01 đến W-12 đã đưa quy trình về dạng dùng được ngay cho bất kỳ dự án website nào, với điểm chất lượng trung bình 94/100 so với 64/100 của prompt gốc.
