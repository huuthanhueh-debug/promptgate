# PromptGate Tray (pha 2) — phím tắt toàn cục cho mọi cửa sổ Windows

> Công nghệ: **PowerShell 5.1 + WinForms** (như Claude Usage Monitor) thay vì Electron (như Teams Live Subtitles), vì người dùng chỉ cần một lệnh hoặc một file `.cmd`, không cài thêm, không build; Node.js vốn đã cần cho engine nên không phát sinh phụ thuộc mới, còn Electron nặng hơn 200 MB và phải đóng gói.

Bôi đen prompt ở **bất kỳ app nào** (Claude desktop, trình duyệt, Word, Notepad, Zalo…), nhấn **Ctrl+Alt+P**, một popup nhỏ hiện cạnh con trỏ: điểm /100, loại việc, chiều còn thiếu, và ba bản viết lại **A Gọn / B Chuẩn / C Sâu** đã được điền sẵn. Bấm một bản là chép vào clipboard (tùy chọn dán đè ngay vào chỗ bôi đen). Esc đóng. Cùng engine với plugin Claude Code, chấm xong dưới 1 ms, không gửi gì ra ngoài.

## Yêu cầu

- Windows 10/11. PowerShell 5.1 có sẵn trong Windows.
- Node.js 18+ (`node` trên PATH, hoặc khai báo `tray.node` trong config, xem dưới).
- Repo này đã clone về máy (engine nằm ở `scripts/lib/`, tray dùng trực tiếp, không copy).

## Chạy

| Cách | Lệnh | Ghi chú |
|---|---|---|
| Nhanh nhất | nháy đúp `tray\PromptGate.cmd` | chạy nền, không cửa sổ console |
| Từ terminal | `npm run tray` | console mở, tiện xem lỗi |
| Khởi động cùng Windows | menu tray → **Khởi động cùng Windows** | tạo shortcut trong thư mục Startup, bỏ tích là xóa |

Lần đầu chạy, một balloon ở góc màn hình báo "Đang chạy. Bôi đen prompt ở bất kỳ app nào rồi nhấn Ctrl+Alt+P." Icon tròn xanh chữ **P** xuất hiện ở khay hệ thống (có thể phải bấm mũi tên ^ để thấy).

## Dùng

1. Bôi đen prompt trong app đang dùng. Không bôi đen gì thì tray lấy nội dung clipboard.
2. Nhấn **Ctrl+Alt+P**.
3. Popup hiện:
   - Dòng đầu: `53/100 · xây dựng · chiều sâu sâu` (đỏ < 50, vàng < 75, xanh ≥ 75), góc phải ghi lấy "từ vùng bôi đen" hay "từ clipboard".
   - Dòng hai: **Thiếu**: mục tiêu, ngữ cảnh… · **Thừa**: câu xã giao. Dòng ba: một **Mẹo**.
   - Ba bản: nút trái là tên (bản khuyên dùng tô xanh), ô phải là toàn văn. Bấm nút hoặc ô, hoặc gõ phím **A / B / C**.
4. Bản được chọn đã nằm trong clipboard. Nếu bật **Dán đè vào chỗ bôi đen**, tray đưa cửa sổ cũ lên trước và gửi Ctrl+V thay cho bạn.
5. **Esc** hoặc bấm ra ngoài để đóng. Nhấn lại phím tắt khi popup đang mở cũng đóng.

Ba bản nghĩa là gì:

- **A · Gọn**: ý cốt lõi đã bỏ câu xã giao + một dòng đầu ra mặc định theo loại việc.
- **B · Chuẩn**: Mục tiêu / Ngữ cảnh / Đầu ra / Ràng buộc / Hoàn thành khi, mỗi dòng đã điền.
- **C · Sâu**: như B, thêm Ultrathink, lập kế hoạch ngắn, nêu ca biên và giả định, tự kiểm tra, làm trọn không dừng giữa chừng.

Tray không có Claude trong vòng lặp như plugin, nên phần "tự điền" lấy từ những gì engine nhìn thấy: đường dẫn và tên file trong prompt, URL, dòng lỗi (`TypeError: …`, `ENOENT`, `500`…), `@file`, **tiêu đề cửa sổ** đang mở (ví dụ `auth.js - Visual Studio Code` thành "đang mở: auth.js - Visual Studio Code"), và mặc định đầu ra / ràng buộc / hoàn thành theo loại việc trong gói quy tắc. Chỗ nào thật sự không biết mới để ⟨…⟩ (ví dụ độ dài khi viết email).

Ngôn ngữ popup theo ngôn ngữ prompt (VI/EN). Ngôn ngữ menu tray mặc định tiếng Việt, đổi bằng `tray.language`.

## Menu tray (chuột phải icon)

| Mục | Tác dụng |
|---|---|
| Bật PromptGate | Tích = phím tắt hoạt động; bỏ tích = tạm tắt (icon chuyển xám) |
| Đổi phím tắt… (Ctrl+Alt+P) | Mở hộp thoại, nhấn tổ hợp mới, Lưu. Không đăng ký được thì giữ tổ hợp cũ và báo lý do |
| Dán đè sau khi chọn bản | Bật/tắt Ctrl+V tự động sau khi chọn (chỉ khi lấy từ vùng bôi đen) |
| Hỏi tầng 2 (Claude) khi chấm | Mỗi lần chấm tự gọi `claude -p --model haiku` viết lại B/C |
| Mở lịch sử prompt | Chạy `scripts/history.js 30` rồi mở báo cáo Markdown mới nhất |
| Mở thư mục dữ liệu | `%USERPROFILE%\.claude\promptgate` (config, log, reports) |
| Khởi động cùng Windows | Shortcut trong thư mục Startup |
| Thoát | Gỡ phím tắt, tắt tray |

## Cấu hình

Nằm chung file với plugin: `%USERPROFILE%\.claude\promptgate\config.json`, khóa `tray`. Mọi mục đều có mặc định, chỉ ghi cái cần đổi:

```json
{
  "mode": "balanced",
  "tray": {
    "hotkey": "Ctrl+Alt+P",
    "paste": false,
    "llm": false,
    "enabled": true,
    "node": "",
    "language": "auto"
  }
}
```

| Khóa | Mặc định | Ý nghĩa |
|---|---|---|
| `hotkey` | `Ctrl+Alt+P` | Tổ hợp gồm ít nhất một trong Ctrl / Alt / Shift / Win + một phím: `Ctrl+Shift+Space`, `Win+Alt+G`, `Ctrl+Alt+F9`… |
| `paste` | `false` | Dán đè sau khi chọn bản |
| `llm` | `false` | Tự gọi tầng 2 mỗi lần chấm. `false` vẫn còn nút **Tầng 2 (Claude)** trên popup để gọi khi cần |
| `enabled` | `true` | Trạng thái bật/tắt, menu tray ghi nhớ vào đây |
| `node` | `""` | Đường dẫn `node.exe` khi không có trên PATH |
| `language` | `auto` | `auto` = popup theo ngôn ngữ prompt, menu tiếng Việt; `vi` / `en` ép cả hai |

Menu tray ghi lại file này; sửa tay thì khởi động lại tray.

## Tầng 2 (Claude)

Nút **Tầng 2 (Claude)** trên popup (hoặc `llm: true`) gọi `scripts/lib/brain-llm.js` đúng như plugin: `claude -p --model haiku` bằng tài khoản Claude của bạn, có `ANTHROPIC_API_KEY` thì dùng API. Kết quả thay bản **B**, bản **C** = kết quả đó + các dòng sâu; bản **A** giữ nguyên. Từ 1.3.0 không cần key. Tầng 2 chạy nền, popup vẫn dùng được trong lúc chờ. Lỗi mạng hay chứng chỉ (Kaspersky chặn TLS) thì giữ bản quy tắc; xem mục Khắc phục trong README gốc.

## Cách hoạt động

```
PromptGate.ps1 (WinForms, STA)             core.js (Node)                engine
  RegisterHotKey ──► WM_HOTKEY               --config / --ui               scripts/lib/engine.js
  lấy cửa sổ trước + tiêu đề                 --req req.json --out …  ──►   analyze() + cleanFiller()
  Ctrl+C giả lập → clipboard (hoặc clipboard cũ)   tray/lib/compose.js     ◄── packs/general.json
  ghi req.json (UTF-8) ──────────────────►   A/B/C + điền ngữ cảnh
  đọc JSON kết quả ◄─────────────────────    ghi log.jsonl (không có text)
  popup WinForms gần con trỏ
```

- Mọi chữ hiển thị (VI/EN) nằm trong `tray/lib/compose.js`; file `.ps1` thuần ASCII để tránh lỗi mã hóa của PowerShell 5.1.
- Text đi qua file JSON UTF-8 trong `%TEMP%\promptgate-tray\`, không qua tham số dòng lệnh.
- Log vận hành: `%USERPROFILE%\.claude\promptgate\tray.log`. Log chấm điểm chung với plugin: `log.jsonl` (`action: "tray"`, không lưu nội dung prompt), nên `/promptgate:history` và menu **Mở lịch sử** tính cả prompt chấm từ tray.
- Chỉ một instance chạy (mutex); chạy lần hai thoát im lặng.

Dùng engine từ dòng lệnh để xem popup sẽ hiện gì:

```bash
node tray/core.js "giúp tôi sửa lỗi đăng nhập trong auth.js"
```

## Khắc phục sự cố

**Không đăng ký được phím tắt (balloon báo ngay khi chạy, `tray.log` ghi `RegisterHotKey failed … 1409`).** Tổ hợp đã bị app khác giữ (nhiều app dùng Ctrl+Alt+P: trình chụp màn hình, driver card đồ họa, Zalo…). Menu tray → **Đổi phím tắt…** → nhấn tổ hợp khác (gợi ý `Ctrl+Shift+Space`, `Win+Alt+P`, `Ctrl+Alt+F9`). Không cần khởi động lại.

**Phím tắt không ăn khi đang ở một app chạy quyền Administrator** (terminal admin, Task Manager, trình cài đặt). Windows chặn tiến trình thường gửi phím vào tiến trình cao quyền (UIPI). Hai cách: chạy tray bằng quyền admin (chuột phải `PromptGate.cmd` → Run as administrator) hoặc chép prompt bằng tay rồi nhấn phím tắt ở cửa sổ khác, tray sẽ lấy từ clipboard.

**Kaspersky**: tính năng *Secure Keyboard Input* / *Safe Money* chặn phím giả lập trong trình duyệt và một số app, nên Ctrl+C tự động không chép được gì, popup báo "Không có gì được bôi đen và clipboard trống" hoặc lấy nhầm nội dung clipboard cũ. Khắc phục: Kaspersky → Settings → Privacy → Secure Keyboard Input → tắt, hoặc thêm `powershell.exe` vào Trusted applications với quyền *Do not monitor application activity*; hoặc đơn giản là **Ctrl+C tay rồi nhấn phím tắt** (luôn hoạt động vì dùng clipboard). Kaspersky chặn TLS chỉ ảnh hưởng tầng 2, không ảnh hưởng chấm điểm.

**SmartScreen / Defender hỏi khi chạy `.vbs` hoặc `.cmd`** lần đầu: chọn *More info → Run anyway*; file nằm trong repo bạn clone, mở ra đọc được. Hoặc chạy `npm run tray` (không qua `.vbs`).

**`running scripts is disabled on this system`**: launcher đã dùng `-ExecutionPolicy Bypass` cho riêng tiến trình này, không đổi policy máy. Nếu vẫn báo, chạy một lần trong PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**Popup báo "Không tìm thấy node.exe"**: cài Node.js 18+ hoặc đặt `"tray": { "node": "C:\\Program Files\\nodejs\\node.exe" }`.

**Popup không hiện, không báo gì**: xem `tray.log`. Dòng `hotkey:` có nghĩa là phím tắt đã vào; `popup shown:` là engine đã trả lời. Thiếu dòng `hotkey:` → phím tắt chưa đăng ký hoặc bị app khác nuốt. Thiếu `popup shown:` → xem dòng `node stderr`.

**Lấy nhầm nội dung**: một số app không chép bằng Ctrl+C (terminal dùng Ctrl+Shift+C, app vẽ…). Tray chờ 600 ms rồi lấy clipboard cũ, nên hãy Ctrl+C tay trước. Bản được chọn luôn thay nội dung clipboard.

**Dán đè không vào đúng chỗ**: tính năng dán chỉ chạy khi text lấy từ vùng bôi đen (không dán khi lấy từ clipboard) và cần cửa sổ gốc nhận lại focus; app chạy admin không nhận (xem UIPI ở trên).

## Giới hạn hiện tại

- Chỉ Windows. Phím Win trong hộp thoại đổi phím tắt không bắt được, gõ `Win+…` trực tiếp vào config.
- Bản A/B/C điền từ quy tắc, không hiểu ngữ cảnh hội thoại như plugin; tầng 2 bù phần này.
- Popup là cửa sổ WinForms, không theo theme sáng/tối của Windows (luôn nền tối).

## Kiểm thử

```bash
npm run test:tray      # phần không-UI: composer A/B/C, điền ngữ cảnh, core.js, log, config
npm test               # toàn bộ, gồm cả plugin
```

Phần UI (hotkey, popup, clipboard) được kiểm chứng tay với Notepad: bôi đen → Ctrl+Alt+P → popup → phím B → clipboard nhận bản B; log mẫu trong `tray.log`:

```
16:04:52 hotkey: selection, 125 chars from 'auth.js - Notepad'
16:04:53 popup shown: ok=True score=53 type=build lang=vi origin=selection
16:04:54 chose B (519 chars, score 53, selection)
```
