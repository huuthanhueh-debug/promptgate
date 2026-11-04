# PromptGate cho claude.ai (Chrome extension)

[English](README.md) · [Về PromptGate](../README.vi.md)

Chấm điểm prompt của bạn trên claude.ai ngay khi gõ, từ 0 đến 100. Khi bấm nút hoặc nhấn **Ctrl+Shift+P**, một bảng hiện ra với ba bản viết lại: **A · Gọn**, **B · Chuẩn**, **C · Sâu**. Bấm một bản là nó thay vào ô nhập. Không có gì tự gửi, và không có prompt nào bị chặn.

```
[ PG 32 ]   ← nút cạnh ô nhập, đỏ / vàng / xanh theo điểm
```

## Trạng thái

Bản thử, cài thủ công. Chưa đăng Chrome Web Store.

- Đã kiểm thử: engine chạy trong môi trường không có Node (bundle trong sandbox), điểm khớp với bản Claude Code, mô phỏng DOM claude.ai (nút hiện, điểm đổi khi gõ, bấm B thay đúng nội dung ô nhập, không gửi).
- Đã kiểm chứng trên claude.ai thật (Chrome, Load unpacked, bản 0.1.1, ngày 2026-11-02): nút hiện, điểm đổi khi gõ, bảng mở, bấm bản B thay đúng nội dung ô nhập. Giao diện claude.ai đổi thường xuyên; nếu nút không hiện, xem mục "Khi claude.ai đổi giao diện" bên dưới.

## Cài đặt (cho máy có Node.js 18+ và Chrome)

1. Lấy mã nguồn và build:

   ```bash
   git clone https://github.com/huuthanhueh-debug/promptgate.git
   cd promptgate
   npm run build:ext
   ```

   Lệnh này tạo thư mục `extension/dist/`. Engine được đóng gói trực tiếp từ `scripts/lib/`, không có bản sao tay.

2. Mở Chrome, vào `chrome://extensions`, bật **Developer mode** (góc trên bên phải).
3. Bấm **Load unpacked** và chọn thư mục `extension/dist`.
4. Mở [claude.ai](https://claude.ai), gõ một prompt, bạn sẽ thấy nút `PG ...` cạnh ô nhập.

Khi build lại, bấm nút tải lại (↻) của extension trong `chrome://extensions`.

## Cách dùng

- **Nút PG**: hiện điểm, đổi màu theo ngưỡng. Bấm để mở bảng gợi ý.
- **Ctrl+Shift+P**: mở hoặc đóng bảng gợi ý khi đang ở claude.ai.
- **Bảng gợi ý**: điểm /100, loại việc, chiều sâu, các chiều còn thiếu, và ba bản viết lại. Bản khuyên dùng được đánh dấu.
- **Thay vào ô nhập**: thay toàn bộ nội dung ô nhập bằng bản đã chọn. Bạn tự kiểm tra rồi bấm gửi của claude.ai.
- **Gửi nguyên bản**: giữ prompt gốc, đóng bảng, con trỏ về ô nhập.
- **Popup** (biểu tượng extension): bật/tắt, ngưỡng (nghiêm / cân bằng / nhẹ / tắt), hồ sơ chiều sâu, ngôn ngữ gợi ý.

Ngôn ngữ của bảng theo ngôn ngữ prompt. Prompt tiếng Việt thì bảng tiếng Việt.

## Điền chi tiết thiếu như thế nào

Extension không gọi mô hình nào. Các bản A, B, C được dựng bằng cùng bộ quy tắc của bản Claude Code:

- Ngữ cảnh: nếu prompt chưa nêu file hoặc URL, extension lấy tối đa ba đường dẫn hoặc URL xuất hiện gần nhất trong hội thoại trên màn hình.
- Ràng buộc và tiêu chí hoàn thành: dùng mặc định theo loại việc (ví dụ "giữ nguyên phần không liên quan").
- Đầu ra: dùng mặc định theo loại việc.
- Phần không có nguồn sẽ để ô `⟨…⟩` để bạn điền.

Vì vậy bản gợi ý không "thông minh" bằng tầng 2 trong Claude Code (gọi LLM). Nó nhanh, không tốn token, và không rời máy.

## Riêng tư

- Prompt, lịch sử hội thoại và bản gợi ý không gửi ra ngoài trình duyệt. Extension không có quyền mạng và không gọi API nào.
- Thứ duy nhất được lưu là cài đặt, trong `chrome.storage.local` của chính trình duyệt bạn.
- Đường dẫn và URL lấy từ hội thoại chỉ dùng để dựng bản gợi ý trong bộ nhớ, không lưu lại.
- Quyền xin: `storage` và script chạy trên `https://claude.ai/*`. Không có quyền truy cập tab khác.


## Khi claude.ai đổi giao diện

Nút tìm ô nhập theo thứ tự: `div.ProseMirror[contenteditable="true"]`, rồi `div[contenteditable="true"][role="textbox"]`, rồi `fieldset [contenteditable="true"]`, rồi `textarea`. Nếu nhóm đầu không khớp, extension thử nhóm sau. Danh sách nằm trong `extension/src/core.js` (`COMPOSER_SELECTORS`). Khi nó lệch, sửa danh sách và chạy lại `npm run build:ext`.

Nếu không tìm thấy ô nhập nào, nút PG ẩn đi và trang không bị ảnh hưởng.

## Chrome Web Store

Trang sản phẩm: https://chromewebstore.google.com/detail/ohfifdheanlidimoffbkbkednifkpiae

Tài liệu nguồn cho listing: [chính sách riêng tư](PRIVACY.md), [nội dung listing và các bước nộp](STORE-LISTING.md), và gói zip từ `npm run build:ext -- --zip`.

## Phát triển

```bash
npm run build:ext      # bundle engine + copy file vào extension/dist
npm test               # gồm tests/extension.js (bundle không Node, khớp điểm, mock DOM claude.ai)
```

Mã nguồn:

| File | Vai trò |
|---|---|
| `build.js` | bundle `scripts/lib/` thành một script trình duyệt (IIFE), thay `fs`/`path`/`os` bằng shim |
| `src/core.js` | logic thuần: chấm điểm, A/B/C, tìm và ghi ô nhập (nhận document làm tham số) |
| `src/content.js` | glue DOM: nút, bảng, phím tắt, theo dõi thay đổi giao diện |
| `src/popup.*` | cài đặt |
| `src/manifest.json` | Manifest V3 |
| `src/shims/` | thay thế `fs`, `path`, `os` cho trình duyệt |

MIT, như phần còn lại của repo.
