# 05 · Playbook "Web [tên]": làm website có chuyển động từ A đến Z

> Dùng cho lần làm website tiếp theo. Gộp quy trình của Viktor Oddy với các bước còn thiếu để có bản bàn giao được cho khách.

## 1. Chuẩn bị (làm một lần)

| Việc | Cách làm |
|---|---|
| Công cụ | Claude desktop (tab Code, có bảng Preview) hoặc Claude Code CLI; Node.js 18 trở lên; tài khoản Vercel miễn phí |
| Tạo thư mục dự án | `mkdir web-<tên> && cd web-<tên>` |
| Nạp SOP | Copy `templates/CLAUDE.md` vào gốc thư mục dự án, giữ tên `CLAUDE.md` |
| Bật Preview | `mkdir -p .claude` rồi copy `templates/launch.json` thành `.claude/launch.json` (cú pháp theo [tài liệu chính thức](https://code.claude.com/docs/en/desktop#configure-preview-servers); đã chạy thử, trả về HTTP 200) |
| Thư mục làm việc | Mở session Claude Code ngay tại thư mục `web-<tên>` để Claude đọc được `CLAUDE.md` và `.claude/launch.json` |

## 2. Năm câu hỏi chuẩn

Gõ `web <tên>`. Claude hỏi lần lượt, mỗi lần một câu:

| # | Câu hỏi | Vì sao cần |
|---|---|---|
| 1 | Website cho ai, bán gì, hành động chính muốn khách làm là gì? | Quyết định nút CTA và thứ tự section |
| 2 | 1–3 tham chiếu (link hoặc ảnh) và anh thích gì ở từng cái? | Thay cho việc tả bằng lời; đây là chỗ Viktor dùng Pinterest |
| 3 | Cần section nào, đã có sẵn gì (logo, ảnh, chữ, giá)? | Tránh Claude bịa nội dung |
| 4 | Hiệu ứng chủ đạo muốn khách nhớ? Giới hạn gì? | Một hiệu ứng thật tốt hơn mười hiệu ứng vừa vừa |
| 5 | Ngôn ngữ, tên miền, nơi đăng, hạn chót, ai sửa nội dung sau này? | Quyết định cách bàn giao |

Trả lời xong câu 5, Claude viết `work/<slug>/SPEC.md` rồi chạy dây chuyền.

## 3. Dây chuyền 8 bước

| Bước | Việc | Lệnh tắt | Prompt đầy đủ | Ai quyết | Đầu ra |
|---|---|---|---|---|---|
| 1 | Đọc tham chiếu | `tiếp <link>` | W-01 | Claude | `DESIGN.md` |
| 2 | 3 phương án | (tự chạy sau bước 1) | W-02 | **Anh chọn** | `options/` |
| 3 | Dựng | `opt <số> free` hoặc `opt <số> paid` | W-03 | Claude | `site/` |
| 4 | Tự kiểm tra và QA | (tự chạy) | W-04 | **Anh duyệt** | link localhost, ảnh 1440px và 390px |
| 5 | Đóng gói | `ok` | W-05 | Claude | `release/` |
| 6 | Đưa lên mạng | `ship` | W-06 | Anh đăng nhập Vercel | URL production |
| 7 | Bài đăng kéo khách | `post` | W-07, W-09 | Anh bấm đăng | bài X, LinkedIn, Threads, kịch bản trả lời DM |
| 8 | Chào hàng | `pitch <URL>` | W-08 | Anh gửi | `audit.md`, `concept/`, `outreach.md` |

Lệnh tắt chỉ chạy khi `CLAUDE.md` đã nằm trong thư mục dự án. Ở chat thường (claude.ai) không có SOP, hãy dùng prompt đầy đủ trong `prompts.txt`.

## 4. Định nghĩa "xong" trước khi gửi khách

- [ ] Hiển thị đúng ở 390px, 768px, 1440px; hiệu ứng chủ đạo dùng được bằng cảm ứng
- [ ] Lighthouse Performance từ 85, Accessibility từ 95 trở lên
- [ ] Bật prefers-reduced-motion thì chuyển động dịu lại
- [ ] Console sạch, không request 404
- [ ] Có `<title>`, meta description, ảnh Open Graph, favicon
- [ ] Nút hành động chạy thật: `tel:`, `mailto:`, link đặt phòng hoặc form
- [ ] Ảnh và video có giấy phép; không còn watermark, logo hay chữ mẫu
- [ ] `standalone.html` mở được trực tiếp bằng trình duyệt
- [ ] Có ghi chú quyền riêng tư nếu form thu thập dữ liệu

## 5. Ví dụ một phiên làm việc (tên thương hiệu là giả định)

```
Anh:    web song-xanh
Claude: Câu 1/5. Website cho ai, bán gì, và hành động chính muốn khách làm là gì?
Anh:    Khách sạn boutique 24 phòng ven biển. Khách là cặp đôi và gia đình trẻ. Hành động chính: đặt phòng trực tiếp.
Claude: Câu 2/5. Gửi 1–3 tham chiếu và cho biết anh thích gì ở từng cái.
Anh:    https://www.pinterest.com/pin/... (thích vòng cung thẻ kính) · godly.website/... (thích chữ to)
Claude: Câu 3/5. ...
        (đủ 5 câu)
Claude: Đã viết work/song-xanh/SPEC.md. Đang chạy bước 1–2…
        3 phương án ở work/song-xanh/options/. Chọn phương án nào? Free hay Paid?
Anh:    opt 1 paid
Claude: Đã dựng xong, preview ở http://localhost:5571. Ảnh 1440px và 390px đính kèm.
        Người dùng làm được: xoay vòng cung hạng phòng, gạt công tắc ngày/đêm, bấm "Đặt phòng"…
Anh:    ok
Anh:    ship
Anh:    post
```

## 6. Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Site trông chung chung, "kiểu AI" | Thiếu tham chiếu, hiệu ứng chủ đạo tả mơ hồ | Thêm tham chiếu; tả hiệu ứng theo dạng kích hoạt → chuyển động → trạng thái cuối |
| Ảnh phương án không theo yêu cầu bố cục | Công cụ tạo ảnh bỏ qua chỉ dẫn (trong video Claude cũng gặp và tự báo) | Yêu cầu làm phương án đó bằng HTML tĩnh |
| Bảng Preview không lên | Sai thư mục hoặc cổng trong `launch.json` | Kiểm tra `runtimeArgs` trỏ đúng `work/<slug>/site`; để `autoPort: true` |
| Trang giật trên điện thoại | 3D hoặc video nền nặng | Giảm số vật thể, nén video, có ảnh poster, tắt hiệu ứng khi reduced-motion |
| Session dài "quên" quy trình | Quy trình chỉ nằm trong lịch sử chat, bị nén mất | Đặt quy trình trong `CLAUDE.md` (session của Viktor từng bị nén 355,7 nghìn token) |
| Tốn nhiều token | Dựng lại từ đầu, ảnh độ phân giải cao | Sửa từ code có sẵn; phương án chỉ cần ảnh 1K |
