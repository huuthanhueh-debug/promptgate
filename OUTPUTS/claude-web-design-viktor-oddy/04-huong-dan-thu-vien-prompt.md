# 04 · Hướng dẫn dùng thư viện prompt

**Nguồn để copy:** `prompts.txt` (12 prompt nâng cấp W-01 đến W-12). Prompt gốc trong video nằm ở `prompts-goc.txt`, chỉ để đối chiếu.

## 1. Cách dùng

1. Mở `prompts.txt`, copy nguyên khối giữa hai dòng `===`.
2. Điền mọi chỗ `⟨…⟩`. Chỗ nào không biết thì xóa cả dòng đó, đừng để trống.
3. Gửi cho Claude. Với Claude Code trong thư mục đã có `CLAUDE.md` (mẫu ở `templates/`), phần lớn bước chỉ cần lệnh tắt (`tiếp`, `opt 1`, `ok`, `ship`, `post`, `pitch`).

Mỗi prompt theo khung 5 phần mà engine PromptGate chấm điểm: **Mục tiêu · Ngữ cảnh · Đầu ra · Ràng buộc · Hoàn thành khi**. Việc lớn có thêm câu "lập kế hoạch… tự kiểm tra…" để Claude làm trọn thay vì dừng giữa chừng.

## 2. Từ prompt gốc đến bản nâng cấp

| Prompt gốc (điểm) | Bản nâng cấp (điểm) | Thay đổi chính |
|---|---|---|
| G-01 · link Pinterest + "Here's the next one" (53) | W-01 Phân tích tham chiếu (96) + W-02 Ba phương án (85) | Lệnh gốc chỉ chạy được trong session đã có SOP. Bản nâng cấp tự mang đủ bối cảnh: đầu ra DESIGN.md 6 mục, ràng buộc bản quyền, điểm dừng chờ chọn |
| G-02 · "opt 2 free here is the original code…" (70) | W-03 Dựng phương án đã chọn (94) | Thêm tiêu chuẩn responsive, a11y, hiệu năng; buộc tự kiểm tra ở 1440px và 390px; dừng chờ duyệt |
| (không có, Claude tự làm theo SOP) | W-04 QA (100), W-05 Đóng gói (93), W-06 Deploy Vercel (96) | Viết thành prompt riêng để dùng được cả khi không có SOP |
| G-03 · "We'll post this on Twitter, LinkedIn, and Threads…" (62) | W-07 Bài đăng kéo khách (96) | Thêm giới hạn độ dài từng nền tảng, bình luận có từ khóa DM, mẹo giờ đăng, giọng thương hiệu, cấm hứa hẹn quá đà |
| G-04 · "redesign for this comapny <URL>" (46) | W-08 Redesign chào hàng (95) | Thêm audit 3 điểm yếu có bằng chứng, email và DM 80-120 từ, ràng buộc ghi "bản concept" |
| (chỉ nói trong video: DM "RUNWAY") | W-09 Kịch bản trả lời DM (93) | Ba tin nhắn nối tiếp, mỗi tin dưới 60 từ |
| G-05 · "Give me list of the best apps for my industry…" (78) | W-10 Radar xu hướng (96) | Bảng 5 cột có nguồn kèm ngày, ít nhất 2 nguồn mỗi mục, phân biệt bản thử nghiệm với bản chính thức, cách kiếm tiền trong 30 ngày |
| G-07 · "I just got this idea from Claude…" (89) | W-11 Đưa ý tưởng vào sản phẩm (100) | Thêm feature flag 10%, chỉ số và ngưỡng mở rộng, đường lùi |
| G-06 · "change the jellyfish to be a normal fish" (51) | W-12 Tùy biến mẫu có sẵn (86) | Thêm thương hiệu, màu, thư mục asset; giữ nguyên bố cục và nhịp chuyển động; tự rà chữ mẫu sót |

**Trung bình:** prompt gốc 64/100 → bản nâng cấp 94/100 (thấp nhất 85). Bảng đầy đủ ở `scores.md`.

> G-07 được 89 điểm vì engine xếp nó vào loại câu hỏi ngắn và chấm nhẹ tay. Khi dùng để triển khai thật, W-11 vẫn cần thiết.

## 3. Mỗi prompt dùng khi nào

| ID | Dùng khi |
|---|---|
| W-01 | Vừa thấy một thiết kế ưng ý và muốn biến nó thành site của mình |
| W-02 | Trước khi code, để chọn hướng khi đổi hướng còn rẻ |
| W-03 | Đã chọn phương án, hoặc có code cũ cần nâng cấp |
| W-04 | Trước mỗi lần đưa link cho khách xem |
| W-05 | Site đã duyệt, cần bộ bàn giao: một file chạy ngay, prompt tái tạo, kịch bản quay |
| W-06 | Đưa lên mạng, gắn tên miền |
| W-07 | Có video demo, cần bài đăng để kéo khách |
| W-08 | Muốn chủ động tiếp cận một doanh nghiệp cụ thể |
| W-09 | Có người nhắn từ khóa sau bài đăng |
| W-10 | Định hướng sản phẩm hoặc dịch vụ mới cho 12-24 tháng tới (thay "web design" bằng ngành bất kỳ: khách sạn, F&B, tài chính…) |
| W-11 | Có ý tưởng hay, muốn đưa vào sản phẩm đang chạy mà không phá hỏng gì |
| W-12 | Đang dùng mẫu có sẵn (MotionSites, template mua), cần đổi thành thương hiệu của mình |

## 4. Kiểm tra chất lượng prompt (test)

```bash
node OUTPUTS/claude-web-design-viktor-oddy/tools/score-prompts.js          # in bảng điểm
node OUTPUTS/claude-web-design-viktor-oddy/tools/score-prompts.js --write  # ghi lại scores.md
node OUTPUTS/claude-web-design-viktor-oddy/tools/score-prompts.js --min 90 # đặt ngưỡng khác
```

Script dùng chính engine PromptGate của repo này. Có prompt nâng cấp nào dưới ngưỡng (mặc định 80) thì script thoát với mã 1, nên chạy được như một bài test mỗi khi anh sửa hoặc thêm prompt mới vào `prompts.txt`. Prompt mới chỉ cần đặt dưới một dòng tiêu đề dạng `=== [W-13] Tên prompt ===`.
