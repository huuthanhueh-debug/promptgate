# PromptGate — Bản đặc tả sản phẩm (v1.0, pha 1)

Ngày: 2026-11-02 · Chủ sở hữu: The Quiet Concierge (huuthanhueh-debug) · Trạng thái: đã chốt qua 5 vòng hỏi đáp, đang build pha 1.

## 1. Một câu

PromptGate là plugin Claude Code đứng giữa bàn phím và Claude: mỗi prompt bạn gõ được chấm điểm trong vài mili-giây, prompt yếu bị chặn kèm bản viết lại gọn hơn và sâu hơn, prompt tốt đi thẳng. Nó cũng đọc toàn bộ lịch sử prompt trên máy để chỉ ra thói quen xấu và theo dõi tiến bộ.

## 2. Quyết định đã chốt

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Nền tảng | Pha 1: Claude Code (CLI, desktop Code tab, VS Code) qua hook `UserPromptSubmit`. Pha 2: công cụ phím tắt Windows (phủ Claude desktop + mọi app). Pha 3: Chrome extension cho claude.ai. Điện thoại: không thể can thiệp, chỉ hưởng lợi gián tiếp qua lịch sử. |
| 2 | Cách can thiệp | Lai theo điểm. **Từ 1.1.0 (yêu cầu của chủ sản phẩm 02/11):** dưới ngưỡng → không chặn, hook chèn chỉ dẫn để Claude viết 3 bản viết lại kiểu chuyên gia (A Gọn / B Chuẩn / C Sâu) tự điền chỗ thiếu từ ngữ cảnh và hiện nút chọn (AskUserQuestion) + "Gửi nguyên bản"; không bắt gõ lại. Chế độ chặn cổ điển giữ lại qua `config block`. Vùng giữa → cho qua, hiện điểm + mẹo, chèn gợi ý chiều sâu; trên ngưỡng → im lặng. |
| 3 | Bộ não | Tầng 1: quy tắc chạy local, 0 chi phí, dưới 50 ms. Tầng 2 (Pro, tự chọn): `claude -p --model haiku` dùng tài khoản người dùng, fallback API key. Chỉ gọi tầng 2 khi tầng 1 kết luận prompt yếu. |
| 4 | "Hết công suất" | Hồ sơ chiều sâu tự nhận diện theo loại việc: light / standard / deep. Deep thêm ultrathink, lập kế hoạch ngắn, tiêu chí hoàn thành, tự kiểm tra, cấm dừng giữa chừng. Ghi đè bằng từ khóa `nhanh`/`fast` hoặc `max`. |
| 5 | Ngôn ngữ | Gợi ý theo ngôn ngữ của prompt (VI/EN, tự nhận diện). Tài liệu song ngữ. |
| 6 | Lịch sử | Quét toàn bộ `~/.claude/projects/**/*.jsonl`, lưu điểm cục bộ tại `~/.claude/promptgate/`, không gửi đi đâu. Tầng 2 không bao giờ chạy trên lịch sử. |
| 7 | Kiếm tiền | Open-core. Free trên GitHub đủ dùng; Pro 19 USD mua một lần, cập nhật 1 năm, bán trên thequietconcierge.gumroad.com. |
| 8 | License | Key Gumroad, xác thực online một lần khi `activate`, lưu cục bộ, dùng offline. |
| 9 | Độ khó tính mặc định | Balanced: chặn dưới 50/100, hiện điểm dưới 75. Chế độ `strict` (70 / luôn hiện), `gentle` (30 / không hiện), `off`. |
| 10 | Tên | PromptGate. Repo `huuthanhueh-debug/promptgate`. Lệnh `/promptgate:*`. |
| 11 | Gói Pro đầu tiên | Lập trình & xây app · Viết & nội dung · Phân tích & kế hoạch kinh doanh · Khách sạn & dịch vụ. |
| 12 | Kỹ thuật | Node.js ≥ 18, không dependency ngoài. Không telemetry. API key đọc từ `ANTHROPIC_API_KEY`. Fail-open: hook lỗi thì prompt vẫn đi qua. |

## 3. Ràng buộc kỹ thuật đã kiểm chứng (tài liệu chính thức, 2026-11-02)

- Hook `UserPromptSubmit` **không sửa được prompt**. Chỉ: chặn (`decision: "block"` + `reason`), chèn ngữ cảnh cho Claude (`additionalContext`), hiện cảnh báo cho người dùng (`systemMessage`), ẩn prompt gốc khỏi thông điệp chặn (`suppressOriginalPrompt`).
- Không có hộp thoại tương tác trong hook. UX chặn = thông điệp chứa bản viết lại, người dùng dán lại và gửi.
- Hook chạy cho cả sự kiện tự động: scheduled task, vòng `/loop`, báo cáo subagent, tin từ session khác. **Phải bỏ qua** các trường hợp này.
- Không có `matcher`; hook chạy mọi prompt. Timeout mặc định 30 s; quá hạn thì output bị bỏ, prompt vẫn đi.
- Chuỗi `additionalContext`/`systemMessage` tối đa 10.000 ký tự.
- Plugin đóng gói được hooks + commands + skills; cài từ GitHub bằng `claude plugin marketplace add owner/repo` rồi `claude plugin install promptgate@promptgate`.

## 4. Đối thủ và khoảng trống

| Repo | Điểm mạnh | Thiếu |
|---|---|---|
| hancengiz/claude-code-prompt-coach-skill (147★) | Phân tích log hay, nhiều báo cáo | Không thời gian thực, không chặn, không viết lại, không bán |
| tercel/prompt-coach (2★) | Hook thời gian thực, dùng `claude -p` | Luôn gọi model (chậm, tốn), không chấm điểm quy tắc, không hồ sơ chiều sâu, không gói ngành, không lịch sử |
| msathiyakeerthi/claude-code-prompt-coach (3★) | Subagent áp best practices | Thủ công, không hook |

PromptGate là sản phẩm duy nhất gộp: cổng thời gian thực 0 chi phí + hồ sơ chiều sâu + lịch sử toàn máy + gói chuyên ngành + mô hình bán được.

## 5. Luồng hoạt động của hook

```
prompt → [0] bỏ qua? (sự kiện tự động, lệnh /, < minWords, ack "ok/tiếp", tiền tố //, trùng bản gợi ý vừa đưa, đang cooldown)
       → [1] nhận diện ngôn ngữ (vi/en), loại việc, hồ sơ chiều sâu
       → [2] chấm 7 chiều → tổng 0–100, danh sách thiếu/thừa
       → [3] so ngưỡng theo mode
            ≥ showBelow      → exit 0, im lặng (ghi log)
            blockBelow..show → exit 0, systemMessage "PromptGate 68/100 · mẹo", additionalContext gợi ý chiều sâu nếu deep mà thiếu cue
            < blockBelow     → [4] viết lại (quy tắc; nếu Pro+llm thì gọi tầng 2, timeout 20 s, lỗi thì dùng quy tắc)
                              → decision block, reason = điểm + thiếu/thừa + bản viết lại + cách bỏ qua; lưu hash bản viết lại + mốc cooldown
```

Cooldown: sau một lần chặn, prompt kế tiếp trong cùng session trong 120 s được đi qua dù điểm thế nào (một ý tưởng chỉ bị chặn một lần). Người dùng dán đúng bản gợi ý → đi qua ngay.

## 6. Bảy chiều chấm điểm (tổng 100)

| Chiều | Điểm | Đo gì |
|---|---|---|
| Mục tiêu rõ | 25 | Có động từ hành động + đối tượng cụ thể; phạt đại từ mơ hồ ("cái này", "nó", "this") không có tham chiếu |
| Ngữ cảnh | 15 | Đường dẫn, URL, mã định danh, thông báo lỗi, nội dung dán kèm, @file; tùy loại việc |
| Đầu ra | 15 | Định dạng, độ dài, ngôn ngữ, cấu trúc, nơi lưu |
| Ràng buộc | 15 | "không được / phải / chỉ / giữ nguyên", số lượng, giới hạn |
| Tiêu chí hoàn thành | 10 | "xong khi", test pass, cách xác nhận |
| Tiết kiệm | 10 | Phạt câu xã giao, lặp từ, mật độ thông tin thấp |
| Khớp chiều sâu | 10 | Việc lớn mà thiếu cue suy nghĩ/kiểm tra → trừ; việc nhỏ mà kèm ultrathink → trừ nhẹ |

Loại việc: `question`, `edit`, `build`, `debug`, `analyze`, `write`, `review`, `ops`. Hồ sơ chiều sâu mặc định: question/edit → light; write/review/debug → standard; build/analyze/ops → deep. Gói Pro có thể định nghĩa thêm loại việc và trọng số riêng.

## 7. Bản viết lại theo quy tắc

Nguyên tắc: giữ lời của người dùng, cắt phần thừa, chỉ **thêm phần thiếu** dưới dạng dòng ngắn có chỗ trống `⟨…⟩` để điền. Không bao giờ dài gấp đôi bản gốc trừ khi bản gốc dưới 15 từ.

```
Mục tiêu: <câu gốc đã cắt xã giao>
Ngữ cảnh: ⟨file / đường dẫn / lỗi liên quan⟩          (chỉ thêm khi thiếu và loại việc cần)
Đầu ra: <mặc định theo loại việc hoặc ⟨…⟩>
Ràng buộc: ⟨điều không được đổi, giới hạn⟩              (build/debug/ops)
Hoàn thành khi: <mặc định theo loại việc>
Ultrathink. Lập kế hoạch ngắn trước khi làm, tự kiểm tra kết quả, không dừng giữa chừng.   (deep)
```

## 8. Lệnh

| Lệnh | Việc |
|---|---|
| `/promptgate:status` | Mode hiện tại, brain, license, thống kê 7 ngày |
| `/promptgate:optimize <text>` | Chấm và viết lại một prompt theo yêu cầu, không chặn |
| `/promptgate:history [days]` | Quét lịch sử toàn máy, báo cáo + lưu điểm |
| `/promptgate:config <strict\|balanced\|gentle\|off>` | Đổi mode (lưu `~/.claude/promptgate/config.json`) |
| `/promptgate:brain <rules\|llm>` | Chọn tầng 2 (llm cần Pro) |
| `/promptgate:activate <KEY>` | Kích hoạt Pro qua Gumroad |

Bỏ qua một lần: gõ prompt bắt đầu bằng `//`.

## 9. Free vs Pro

| | Free (GitHub, MIT) | Pro (Gumroad, 19 USD) |
|---|---|---|
| Hook chấm điểm + viết lại quy tắc | ✓ | ✓ |
| Gói mẫu `general` (VI/EN) | ✓ | ✓ |
| /optimize, /config, /status | ✓ | ✓ |
| /history báo cáo tổng quan | ✓ | ✓ + theo project, xu hướng tuần, 20 prompt tệ nhất kèm viết lại, dashboard HTML |
| Tầng 2 LLM (`claude -p` / API) | – | ✓ |
| Gói ngành: coding, writing, business, hospitality | – | ✓, cập nhật hàng tháng 12 tháng |
| Hồ sơ chiều sâu tùy biến theo project (`.promptgate.json`) | cơ bản | đầy đủ |

Gói Pro giao dưới dạng zip, giải nén vào `~/.claude/promptgate/packs/`. Mã nguồn Pro không nằm trong repo public.

## 10. Dữ liệu cục bộ

```
~/.claude/promptgate/
  config.json      mode, brain, language, ngưỡng
  state.json       cooldown + hash bản gợi ý theo session
  license.json     key, product, ngày xác thực, hạn cập nhật
  log.jsonl        mỗi prompt đã chấm: ts, session, score, type, action (không lưu nội dung prompt)
  history.json     điểm lịch sử sau khi quét
  reports/         báo cáo markdown/html
  packs/           gói Pro
```

## 11. Pha 2 và 3 (chưa build)

- Pha 2: ứng dụng tray Windows (PowerShell+WinForms như Claude Usage Monitor hoặc Electron như Teams Subtitles) với phím tắt toàn cục: bôi đen prompt → nhấn → popup điểm + bản viết lại → nút "Thay vào clipboard". Dùng lại `scripts/lib/engine.js` qua Node.
- Pha 3 (đã có bản thử, xem `extension/README.vi.md`): Chrome extension Manifest V3 cho claude.ai, chèn nút "PG nn" cạnh ô nhập, bảng A/B/C thay vào ô nhập (không tự gửi), popup cài đặt. Engine được bundle từ `scripts/lib/` bằng `extension/build.js`, không copy tay. Quyền tối thiểu: `storage` và claude.ai. Không gửi prompt đi đâu. Chưa lên Chrome Web Store.

## 12. Tiêu chí hoàn thành pha 1

1. Cài từ thư mục local bằng `claude plugin marketplace add` + `install`, hook chạy khi gõ prompt.
2. Prompt "làm cho tôi cái này tốt hơn" bị chặn với điểm < 40 và có bản viết lại tiếng Việt.
3. Prompt đã đầy đủ (mục tiêu, ngữ cảnh, đầu ra, ràng buộc) đi qua im lặng với điểm ≥ 75.
4. "ok", "tiếp đi", lệnh `/…`, sự kiện tự động không bị đụng.
5. `/promptgate:history` tạo báo cáo từ log thật trên máy này.
6. `node tests/run.js` xanh.
7. README EN + VI, lệnh cài một dòng, trang Gumroad nháp.
