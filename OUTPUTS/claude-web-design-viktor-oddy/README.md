# Làm website có chuyển động với Claude và đi tìm khách

Bộ tài liệu học từ video TikTok [@cunghocainha: "Xây dựng website chỉ với một Prompt nhờ AI, bạn đã thử chưa?"](https://www.tiktok.com/@cunghocainha/video/7704707791562214674). Đây là bản lồng tiếng Việt của video YouTube [Viktor Oddy: "I Tried the LAZIEST Way to Make Money With Claude Design"](https://www.youtube.com/watch?v=uvpKM3wel58) (04/11/2026).

## Tóm tắt

- **Quy trình:** link Pinterest → Claude vẽ 3 phương án → chọn một → Claude dựng site có chuyển động, tự kiểm tra trên desktop và điện thoại → đóng gói → đưa lên Vercel.
- **Cách bán:** quay video demo → Claude viết bài cho X, LinkedIn, Threads → đăng kèm từ khóa DM → làm bản redesign cho site thật của một doanh nghiệp → gửi email chào hàng.
- **Bí quyết thật:** "một prompt" chỉ là lệnh kích hoạt; phía sau là một session đã nạp sẵn quy trình (SOP). Bộ tài liệu này đưa SOP đó vào `templates/CLAUDE.md` để anh dùng lại.
- **Kết quả:** 12 prompt nâng cấp, điểm PromptGate trung bình **94/100**, so với **64/100** của 7 prompt gốc trong video.
- **Cần thận trọng:** các con số thu nhập trong video là tự nhận; bản lồng tiếng dịch sai một số chỗ (ví dụ "Upwork" thành "nền tảng của chúng tôi").

## Lần sau làm website: bắt đầu ở đây

1. Tạo thư mục dự án, copy `templates/CLAUDE.md` vào gốc thư mục và `templates/launch.json` vào `.claude/launch.json`.
2. Mở Claude Code tại thư mục đó, gõ `web <tên>` rồi trả lời 5 câu hỏi.
3. Điều khiển bằng lệnh tắt: `opt 1` → `ok` → `ship` → `post` → `pitch <URL>`. Chi tiết ở `05-playbook-web.md`.

Không dùng Claude Code? Copy prompt đầy đủ trong `prompts.txt` sang claude.ai.

## Thư mục này có gì

| File | Nội dung |
|---|---|
| `01-noi-dung-video.md` | Video nói gì theo từng mốc thời gian, câu gốc tiếng Anh, chỗ bản lồng tiếng dịch sai, độ tin cậy của các tuyên bố |
| `02-chu-tren-man-hinh.md` | Lệnh Viktor gõ (nguyên văn), Claude trả lời gì, bài đăng mẫu, MotionSites Studio, 7 trang tài nguyên, công cụ |
| `03-phan-tich-chuyen-gia.md` | Quy trình thật, 5 kỹ thuật đáng học, mô hình kinh doanh, điều video không nói, cách áp dụng cho khách sạn và F&B |
| `04-huong-dan-thu-vien-prompt.md` | Từ prompt gốc đến bản nâng cấp, dùng prompt nào khi nào, cách chạy test chấm điểm |
| `05-playbook-web.md` | Quy trình "Web [tên]" từ A đến Z: 5 câu hỏi, 8 bước, checklist bàn giao, lỗi hay gặp |
| `prompts.txt` | **12 prompt để copy** (W-01 đến W-12) |
| `prompts-goc.txt` | 7 prompt gốc trong video, nguyên văn |
| `scores.md` | Bảng điểm PromptGate của toàn bộ prompt |
| `templates/CLAUDE.md` | SOP cho Claude Code: lệnh tắt, dây chuyền 8 bước, tiêu chuẩn kỹ thuật |
| `templates/launch.json` | Cấu hình preview server cho Claude Code desktop (đã chạy thử) |
| `tools/score-prompts.js` | Test chấm điểm prompt bằng engine PromptGate |

## Cách bộ tài liệu được làm

| Bước | Cách làm |
|---|---|
| Lấy video | Tải bản 1080p và 540p từ TikTok |
| Chữ trên màn hình | Cắt 377 khung hình (2 giây/khung), OCR bằng Tesseract, đọc lại bằng mắt các khung có prompt |
| Lời nói | Phiên âm tiếng Việt bằng Whisper (large-v3-turbo); lấy phụ đề tiếng Anh của video gốc trên YouTube để đối chiếu |
| Kiểm chứng | Tra tài liệu chính thức của Claude Code (cấu hình Preview), tra thông tin WebMCP, chạy thử `launch.json` |
| Chất lượng prompt | Chấm bằng engine PromptGate của repo này; mọi prompt nâng cấp phải từ 80 điểm trở lên |

Transcript đầy đủ (tiếng Việt và tiếng Anh) **không** đưa vào repo vì repo đang public và đó là nội dung của tác giả khác. File được gửi riêng trong phiên làm việc.
