# Điểm PromptGate của thư viện prompt

Chấm bằng engine PromptGate (scripts/lib/engine.js), gói general, business, coding, hospitality, writing. Chạy lại: `node OUTPUTS/claude-web-design-viktor-oddy/tools/score-prompts.js --write`.

| ID | Prompt | Loại việc | Chiều sâu | Điểm | Còn thiếu |
|---|---|---|---|---|---|
| G-01 | Dán link Pinterest vào session đã có SOP (Claude Code, 02:06) | chung | chuẩn | **53** | đầu ra, ràng buộc, tiêu chí hoàn thành, mục tiêu |
| G-02 | Chọn phương án + gửi code gốc (Claude Code, 02:14) | viết | chuẩn | **70** | ràng buộc, tiêu chí hoàn thành |
| G-03 | Viết bài mạng xã hội từ video quay màn hình (Claude Code, 05:28) | viết | chuẩn | **62** | đầu ra, ràng buộc, tiêu chí hoàn thành |
| G-04 | Redesign site của một công ty thật (MotionSites Studio, 07:30) | chung | chuẩn | **46** | đầu ra, ràng buộc, tiêu chí hoàn thành, mục tiêu |
| G-05 | Tìm xu hướng mới nổi của ngành (Claude chat + web search, 10:26) | chung | chuẩn | **78** | tiêu chí hoàn thành |
| G-06 | Đổi vật thể chính trong mẫu có sẵn (MotionSites Studio, 00:38) | sửa nhỏ | nhẹ | **51** | ngữ cảnh, ràng buộc, tiêu chí hoàn thành, đầu ra |
| G-07 | Đưa ý tưởng về sản phẩm của mình (nói trong video, 11:05) | hỏi | nhẹ | **89** | đủ |
| W-01 | Phân tích ảnh tham chiếu thành DESIGN.md | xây dựng | sâu | **96** | đủ |
| W-02 | Ba phương án thiết kế trước khi viết code | viết | chuẩn | **85** | đủ |
| W-03 | Dựng phương án đã chọn thành trang chạy được | viết | chuẩn | **94** | đủ |
| W-04 | QA trước khi đưa khách xem | sửa nhỏ | nhẹ | **100** | đủ |
| W-05 | Đóng gói: file standalone, prompt tái tạo, kịch bản quay | viết | chuẩn | **93** | đủ |
| W-06 | Đưa trang lên Vercel và gắn tên miền | vận hành | nhẹ | **96** | đủ |
| W-07 | Viết bài đăng mạng xã hội để kéo khách | social | nhẹ | **96** | đủ |
| W-08 | Redesign site của khách tiềm năng để chào hàng | viết | chuẩn | **95** | đủ |
| W-09 | Kịch bản trả lời người nhắn từ khóa | viết | chuẩn | **93** | đủ |
| W-10 | Radar xu hướng mới nổi của ngành | market | sâu | **96** | đủ |
| W-11 | Đưa ý tưởng mới vào sản phẩm của mình, mở dần cho người dùng | phân tích | sâu | **100** | đủ |
| W-12 | Tùy biến một mẫu có sẵn bằng một yêu cầu | viết | chuẩn | **86** | đủ |

- Prompt gốc trong video: 7 prompt, điểm trung bình 64/100.
- Prompt nâng cấp: 12 prompt, điểm trung bình 94/100, thấp nhất 85.
- Tất cả prompt nâng cấp đạt ngưỡng 80.
