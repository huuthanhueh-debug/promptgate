# PromptGate

**Cánh cổng giữa bàn phím và Claude.** Mỗi prompt bạn gõ trong Claude Code được chấm điểm trong vài mili-giây. Prompt yếu bị chặn và trả lại cho bạn dưới dạng gọn hơn, sâu hơn. Prompt tốt đi thẳng, không ai làm phiền. Toàn bộ lịch sử prompt trên máy được quét cục bộ để bạn thấy thói quen và tiến bộ của mình.

[English](README.md) · [Đặc tả](docs/SPEC.md) · [Hướng dẫn cài cho văn phòng](docs/TEAM-INSTALL.vi.md) · [Trang Gumroad (miễn phí)](https://thequietconcierge.gumroad.com/l/promptgate)

```
PromptGate ▸ 32/100 · sửa lỗi · chiều sâu chuẩn
Thiếu: mục tiêu, ngữ cảnh, ràng buộc, tiêu chí hoàn thành · Thừa: 1 câu xã giao
Mẹo: Bắt đầu bằng một động từ + đối tượng cụ thể thay vì "cái này / nó".
──── Bản gợi ý (copy, điền ⟨…⟩, gửi lại) ────
Mục tiêu: Sửa lỗi app, nó không chạy
Ngữ cảnh: ⟨file / đường dẫn / thông báo lỗi / dữ liệu liên quan⟩
Đầu ra: nguyên nhân gốc + bản sửa + cách xác nhận đã hết lỗi
Ràng buộc: ⟨điều không được đổi, giới hạn, ưu tiên⟩
Hoàn thành khi: tái hiện được lỗi trước khi sửa, sau khi sửa không còn, test liên quan vẫn pass
Kiểm tra lại kết quả trước khi trả lời.
──────────────────────────────────────────
Gửi nguyên bản: thêm // ở đầu · Chế độ: /promptgate:config gentle | off
```

## Hai cách phản ứng (bạn chọn)

**Đề xuất (mặc định).** Prompt yếu không bị chặn. Claude viết trước ba bản viết lại kiểu chuyên gia, tự điền mọi chỗ thiếu từ ngữ cảnh hội thoại (file nào, đầu ra gì, lúc nào là xong) và hiện thành nút bấm:

```
A · Gọn     — ngắn nhất, chỉ ý định cốt lõi + 1 dòng đầu ra
B · Chuẩn   — mục tiêu, ngữ cảnh, đầu ra, ràng buộc, hoàn thành khi
C · Sâu     — như B + kế hoạch ngắn, ca biên, tự kiểm tra, làm trọn   (Khuyên dùng)
Gửi nguyên bản
```

Bấm một nút, Claude làm theo bản đó. Không phải gõ lại gì. Nút khuyên dùng theo chiều sâu nhận diện: nhẹ → A, chuẩn → B, sâu → C.

**Chặn.** `/promptgate:config block` bật lại cổng cổ điển: prompt bị dừng, bản viết lại theo quy tắc (có chỗ trống ⟨…⟩) hiện ra để bạn gửi lại.

## Vì sao

Hai thứ làm bạn tốn tiền với Claude: chữ thừa (chào hỏi, "làm ơn", lặp ý) và chữ thiếu (file nào, muốn nhận gì, lúc nào là xong). PromptGate cắt cái thứ nhất và đòi cái thứ hai. Với việc lớn, nó thêm đúng những dòng khiến Claude lập kế hoạch, tự kiểm tra và làm trọn thay vì dừng giữa chừng. Việc nhỏ thì giữ nhẹ.

## Cài đặt

```bash
claude plugin marketplace add huuthanhueh-debug/promptgate
claude plugin install promptgate@promptgate
```

Khởi động lại Claude Code. Gõ prompt như bình thường. Không cần cấu hình gì thêm.

Cần Node.js 18+ (đã có sẵn nếu bạn cài Claude Code bằng npm). Chạy trên CLI, tab Code của app Claude desktop và VS Code. Windows, macOS, Linux.

## Cách chấm điểm (0–100)

| Chiều | Điểm | Nhìn vào gì |
|---|---|---|
| Mục tiêu | 25 | động từ hành động + đối tượng cụ thể; phạt "cái này / nó" không có tham chiếu |
| Ngữ cảnh | 15 | đường dẫn, URL, tên hàm, thông báo lỗi, nội dung dán kèm, `@file` |
| Đầu ra | 15 | định dạng, độ dài, ngôn ngữ, cấu trúc, nơi lưu |
| Ràng buộc | 15 | phải / không được / chỉ / giữ nguyên / giới hạn |
| Hoàn thành | 10 | "xong khi…", test pass, cách xác nhận |
| Tiết kiệm | 10 | phạt câu xã giao và dài dòng ít thông tin |
| Khớp chiều sâu | 10 | việc lớn nên có cue lập kế hoạch/kiểm tra; việc nhỏ thì không |

Loại việc (hỏi, sửa nhỏ, xây dựng, sửa lỗi, phân tích, viết, review, vận hành) được nhận diện từ văn bản và quyết định hồ sơ chiều sâu: **nhẹ**, **chuẩn**, **sâu**. Ghi đè bằng từ `nhanh` hoặc `max` / `ultrathink` trong prompt.

## Chế độ

| Chế độ | Yếu dưới (đề xuất hoặc chặn) | Hiện điểm dưới |
|---|---|---|
| `strict` | 70 | luôn |
| `balanced` (mặc định) | 50 | 75 |
| `gentle` | 30 | không |
| `off` | – | – |

`/promptgate:config <chế độ>`. Theo project: tạo file `.promptgate.json` ở gốc repo với `mode`, `blockBelow`, `showBelow`, `minWords`, `language`.

Sau một lần chặn, prompt kế tiếp trong cùng phiên luôn được đi qua (một ý chỉ bị chặn một lần). Thêm `//` ở đầu để bỏ qua một lần. Câu ngắn kiểu "ok", "tiếp đi", lệnh `/…` và sự kiện tự động (scheduled task, vòng lặp, báo cáo subagent) không bao giờ bị đụng.

## Lệnh

| Lệnh | Việc |
|---|---|
| `/promptgate:status` | chế độ, bộ não, gói, thống kê 7 ngày |
| `/promptgate:optimize <text>` | chấm + viết lại theo yêu cầu, không chặn |
| `/promptgate:history [ngày\|--all]` | quét toàn bộ lịch sử trên máy, ra báo cáo |
| `/promptgate:config <strict\|balanced\|gentle\|off>` | độ khó tính |
| `/promptgate:doctor [--fix]` | kiểm tra cả ba phiên bản đang chạy chưa: plugin + hook, tray Windows, extension claude.ai, widget văn phòng; `--fix` bật tray và build lại extension |
| `/promptgate:brain <rules\|llm>` | bộ não viết lại (llm = tầng 2 qua `claude -p` của bạn) |

## Riêng tư

Mọi thứ chạy trên máy bạn. Hook không gửi prompt đi đâu. Log tại `~/.claude/promptgate/log.jsonl` chỉ lưu điểm và loại việc, không lưu nội dung. Báo cáo lịch sử ghi vào `~/.claude/promptgate/reports/`. Không telemetry, không tài khoản. Tầng 2 (tùy chọn) dùng chính đăng nhập `claude -p` của bạn (hoặc `ANTHROPIC_API_KEY`), chỉ chạy trên prompt bạn vừa gõ, không bao giờ chạy trên lịch sử.

## Miễn phí toàn bộ

Từ 1.3.0 không còn bản Pro. Toàn bộ sản phẩm nằm trong repo này, giấy phép MIT:

- Cổng thời gian thực với chế độ gợi ý A/B/C, viết lại theo quy tắc, VI/EN.
- **Năm gói ngành** trong [`packs/`](packs/): `general`, `coding` (lập trình), `writing` (viết), `business` (kinh doanh), `hospitality` (khách sạn & dịch vụ). Mỗi gói thêm nhận diện loại việc, định dạng đầu ra mặc định và tiêu chí hoàn thành cho ngành đó, song ngữ Việt-Anh.
- Tầng 2 viết lại bằng LLM qua chính đăng nhập `claude -p` của bạn (`/promptgate:brain llm`), không cần key.
- Báo cáo lịch sử đầy đủ: theo project, xu hướng tuần, 20 prompt yếu nhất kèm bản viết lại, dashboard HTML.
- Công cụ phím tắt Windows và extension claude.ai.

Gói riêng của bạn: thả thêm file `*.json` vào `~/.claude/promptgate/packs/`, chúng được gộp lên trên các gói có sẵn (cùng cấu trúc với `packs/general.json`).

Nếu PromptGate giúp bạn tiết kiệm token, một ngôi sao trên GitHub hoặc một lần ghé bộ công cụ khách sạn tại [thequietconcierge.gumroad.com](https://thequietconcierge.gumroad.com) là lời cảm ơn đủ rồi. PromptGate cũng được đăng miễn phí ở đó để ai mua tài liệu đều thấy.

## Lộ trình

- **Pha 1 (xong, 1.0)**: plugin Claude Code.
- **Pha 2 (xong, 1.2)**: công cụ chạy nền Windows có phím tắt toàn cục, cùng engine cho app Claude desktop và mọi cửa sổ khác. Bôi đen, nhấn Ctrl+Alt+P, chọn A/B/C. Xem [tray/README.vi.md](tray/README.vi.md); chạy `tray\PromptGate.cmd` hoặc `npm run tray`.
- **Pha 3 (đang làm)**: Chrome extension cho claude.ai. Bản thử trong [`extension/`](extension/README.vi.md): cài thủ công, chưa đăng Chrome Web Store.

MIT © The Quiet Concierge