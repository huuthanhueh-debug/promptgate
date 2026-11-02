# Cài PromptGate cho cả văn phòng (5 phút / máy)

PromptGate chạy trong Claude Code của từng người, chấm điểm prompt trước khi gửi và chặn prompt yếu kèm bản viết lại. Không cần tài khoản, không gửi dữ liệu ra ngoài.

## Điều kiện
- Đã cài Claude Code (terminal, app Claude desktop tab Code, hoặc VS Code) và đăng nhập.
- Có Node.js 18 trở lên. Kiểm tra: mở terminal, gõ `node --version`. Chưa có thì tải tại https://nodejs.org (bản LTS).

## Cài (mỗi máy, 2 lệnh)
Mở terminal (Windows: PowerShell hoặc Git Bash), gõ:

```bash
claude plugin marketplace add huuthanhueh-debug/promptgate
```

```bash
claude plugin install promptgate@promptgate
```

Đóng và mở lại Claude Code. Xong.

## Kiểm tra
Trong Claude Code gõ:

```
/promptgate:status
```

Phải thấy `mode: balanced`. Thử gõ một prompt cẩu thả như `làm cho tôi cái này tốt hơn đi` để xem nó bị chặn và nhận bản gợi ý.

## Dùng hằng ngày
- Prompt bị chặn: copy khối gợi ý, điền các chỗ `⟨…⟩`, gửi lại.
- Muốn gửi nguyên bản một lần: thêm `//` ở đầu.
- Thấy phiền: `/promptgate:config gentle` (chỉ chặn prompt rất tệ) hoặc `off`.
- Xem mình tiến bộ: `/promptgate:history 7`.

## Gói Pro cho văn phòng (tùy chọn)
Gói Pro (19 USD/máy, 12 tháng cập nhật) thêm bộ mẫu ngành **Khách sạn & dịch vụ** (SOP, pre-opening, đào tạo, xử lý khách, tuân thủ/PPM), Lập trình, Viết, Kinh doanh. Mua tại https://thequietconcierge.gumroad.com/l/promptgate. Sau khi mua:
1. Giải nén file zip, copy các file trong `packs/` vào `%USERPROFILE%\.claude\promptgate\packs\` (Mac/Linux: `~/.claude/promptgate/packs/`).
2. Trong Claude Code gõ `/promptgate:activate <KEY>` (key nằm trong email biên nhận của Gumroad).
3. `/promptgate:status` phải liệt kê `coding, writing, business, hospitality`.

Cài cho nhiều máy một lúc: mua số lượng tương ứng, mỗi máy một key.

## Gỡ
```bash
claude plugin uninstall promptgate@promptgate
```

Hỗ trợ: huuthanhueh@gmail.com