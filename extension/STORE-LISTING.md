# Chrome Web Store listing (chuẩn bị sẵn, chưa đăng)

Mọi thứ dưới đây dán được thẳng vào Chrome Web Store Developer Dashboard. Việc còn phải tự làm: tài khoản nhà phát triển (phí 5 USD một lần), ảnh chụp màn hình, và bấm Submit.

## Gói nộp

```bash
npm run build:ext -- --zip
```

Tạo `dist/promptgate-extension-<version>.zip` với `manifest.json` ở gốc. Upload file này ở bước "Package".

## Các bước trên Dashboard

1. https://chrome.google.com/webstore/devconsole → đăng ký tài khoản nhà phát triển (5 USD, một lần).
2. **New item** → upload zip ở trên.
3. **Store listing**: điền theo phần dưới. Category: Productivity → Workflow & Planning. Language: Vietnamese, thêm English.
4. **Privacy practices**: Single purpose = "Scores the prompt in the claude.ai composer and offers rewrites". Permission justification: `storage` = lưu cài đặt người dùng; host `claude.ai` = hiện nút và bảng cạnh ô nhập. Data usage: chọn "Does not collect user data". Privacy policy URL: https://github.com/huuthanhueh-debug/promptgate/blob/main/extension/PRIVACY.md
5. **Distribution**: Public, mọi khu vực, miễn phí.
6. Submit for review. Thường 1 đến 3 ngày.

## Ảnh cần chụp (chưa có)

- 1280×800 (hoặc 640×400), tối thiểu 1, tối đa 5: (a) nút PG cạnh ô nhập claude.ai, (b) bảng mở với ba bản A/B/C, (c) sau khi bấm B, ô nhập đã thay nội dung, (d) popup cài đặt.
- Small promo tile 440×280 (tùy chọn).
- Icon 128×128: đã sinh tự động, `extension/dist/icons/128.png`.

## Name

PromptGate for claude.ai

## Summary (≤ 132 ký tự)

VI: Chấm điểm prompt khi gõ trên claude.ai, gợi ý 3 bản viết lại Gọn / Chuẩn / Sâu. Chạy cục bộ, không gửi dữ liệu.

EN: Scores your prompt as you type on claude.ai and offers 3 rewrites: Lean / Standard / Deep. Runs locally, sends nothing.

## Description

### VI

Mỗi prompt yếu làm bạn trả giá hai lần: câu trả lời lệch và prompt thứ hai để sửa. PromptGate đứng cạnh ô nhập của claude.ai, chấm prompt từ 0 đến 100 theo 7 chiều (mục tiêu, ngữ cảnh, đầu ra, ràng buộc, tiêu chí hoàn thành, tiết kiệm, chiều sâu) ngay khi bạn gõ.

Bấm nút PG hoặc Ctrl+Shift+P để xem:
• Điểm, loại việc, chiều sâu, các chiều còn thiếu.
• Ba bản viết lại: A · Gọn, B · Chuẩn, C · Sâu, tự điền ngữ cảnh từ hội thoại.
• Bấm một bản để thay vào ô nhập. Không tự gửi. Bạn luôn là người bấm gửi.

Riêng tư: mọi thứ chạy trong trình duyệt. Không gọi mạng, không tài khoản, không telemetry. Quyền duy nhất là lưu cài đặt và chạy trên claude.ai.

Song ngữ Việt / Anh theo ngôn ngữ prompt. Mã nguồn mở (MIT): github.com/huuthanhueh-debug/promptgate. Cùng engine với plugin PromptGate cho Claude Code.

### EN

Every weak prompt costs you twice: a drifting answer and a second prompt to fix it. PromptGate sits next to the claude.ai composer and scores your prompt from 0 to 100 on 7 dimensions (goal, context, output, constraints, acceptance, economy, depth) as you type.

Click the PG badge or press Ctrl+Shift+P to see:
• Score, task type, depth, and what is still missing.
• Three rewrites: A · Lean, B · Standard, C · Deep, with context filled from the chat.
• Click one to place it in the composer. Nothing is sent. You always press send.

Privacy: everything runs in your browser. No network calls, no accounts, no telemetry. The only permissions are storing settings and running on claude.ai.

Vietnamese / English, following the prompt's language. Open source (MIT): github.com/huuthanhueh-debug/promptgate. Same engine as the PromptGate plugin for Claude Code.
