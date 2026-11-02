# Nộp PromptGate for claude.ai lên Chrome Web Store (bạn bấm, 10 phút)

Chrome không cho phần mềm tự động thao tác trên Developer Console, nên phần này làm tay. Mọi giá trị dưới đây dán được thẳng.

## File cần dùng
- Gói nộp: `D:\PERSONAL\MY CLAUDE\promptgate\dist\promptgate-extension-0.1.2.zip`
- Ảnh 1280×800 (3 file): `D:\PERSONAL\MY CLAUDE\promptgate\extension\store\1-score-badge.png`, `2-panel-abc.png`, `3-after-choose-b.png`
- Icon 128: đã nằm trong zip, không cần tải riêng.

## Bước 1 · Tài khoản nhà phát triển
Mở https://chrome.google.com/webstore/devconsole (tài khoản huuthanhueh@gmail.com, đã xác minh selfie).
- Nếu hiện trang **Register as a Chrome Web Store developer**: tích đồng ý điều khoản, trả phí 5 USD một lần, Developer name: `The Quiet Concierge`, email liên hệ: huuthanhueh@gmail.com (bấm Verify email nếu được hỏi).
- Nếu đã vào bảng điều khiển: sang bước 2.

## Bước 2 · Tạo item
**Items → New item** → kéo file zip ở trên vào → Upload.

## Bước 3 · Store listing (tab Store listing)
| Trường | Dán |
|---|---|
| Title | `PromptGate for claude.ai` |
| Summary (≤132) | `Scores your prompt as you type on claude.ai and offers 3 rewrites: Lean / Standard / Deep. Runs locally, sends nothing.` |
| Description | Dán phần **Description → EN** rồi một dòng trống rồi phần **VI** trong `extension/STORE-LISTING.md` |
| Category | Productivity → Workflow & Planning |
| Language | English; thêm Vietnamese nếu có nút Add language |
| Store icon | lấy từ zip, hoặc `extension/dist/icons/128.png` |
| Screenshots | 3 file PNG ở trên, theo thứ tự 1, 2, 3 |
| Official URL / Homepage | `https://github.com/huuthanhueh-debug/promptgate` |
| Support URL | `https://github.com/huuthanhueh-debug/promptgate/issues` |

## Bước 4 · Privacy practices (tab Privacy)
| Trường | Dán |
|---|---|
| Single purpose | `Scores the prompt in the claude.ai composer and offers three rewrites the user can place into the composer. Nothing is sent or blocked.` |
| Permission `storage` | `Stores the user's own settings (on/off, threshold, depth profile, language) locally.` |
| Host `https://claude.ai/*` | `Shows the score badge and the rewrite panel next to the claude.ai composer. The extension reads the composer text in memory only.` |
| Remote code | **No**, không dùng mã từ xa |
| Data usage | Tích **"I do not collect or use any user data"** (không chọn loại dữ liệu nào) |
| Certify | tích 3 ô cam kết |
| Privacy policy URL | `https://github.com/huuthanhueh-debug/promptgate/blob/main/extension/PRIVACY.md` |

## Bước 5 · Distribution
Visibility **Public** · Regions **All regions** · Free (không bật thanh toán).

## Bước 6 · Submit for review
Bấm **Submit for review**. Để nguyên tùy chọn "Publish automatically after review passes" (bật). Duyệt thường 1 đến 3 ngày; kết quả về email.

## Sau khi duyệt
- Dán link store vào README (mục Phase 3) và đổi dòng "Preview, manual install" trong `extension/README.md`.
- Cập nhật CHANGELOG: "0.1.2 published on the Chrome Web Store".
- Lần cập nhật sau: `npm run build:ext -- --zip`, tăng version trong `extension/src/manifest.json`, upload zip mới ở tab Package.
