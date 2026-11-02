# Bài chia sẻ ra mắt (bản nháp, chưa đăng ở đâu)

Link: https://github.com/huuthanhueh-debug/promptgate · Pro: https://thequietconcierge.gumroad.com/l/promptgate

Nơi nên đăng: r/ClaudeAI và r/ClaudeCode trên Reddit, X, nhóm Facebook về lập trình / AI tại Việt Nam, LinkedIn cá nhân. Mỗi nơi một bài, kèm một ảnh chụp bảng A/B/C.

## Facebook / LinkedIn (VI)

Mình vừa mở mã nguồn PromptGate: cánh cổng giữa bàn phím và Claude.

Mỗi prompt bạn gõ được chấm 0–100 trong vài mili-giây theo 7 chiều: mục tiêu, ngữ cảnh, đầu ra, ràng buộc, tiêu chí hoàn thành, tiết kiệm, chiều sâu. Prompt yếu không bị chặn mà được đề xuất 3 bản viết lại Gọn / Chuẩn / Sâu, tự điền chỗ thiếu, bấm một nút là dùng.

Ba nơi dùng được, cùng một engine:
• Plugin Claude Code (2 lệnh là cài xong)
• Tray Windows với phím tắt Ctrl+Alt+P, dùng cho app Claude desktop và mọi cửa sổ khác
• Chrome extension cho claude.ai

Chạy hoàn toàn trên máy, không gửi prompt đi đâu, song ngữ Việt / Anh. Miễn phí, MIT. Bản Pro 19 USD thêm 4 gói ngành (lập trình, viết, kinh doanh, khách sạn) và báo cáo lịch sử đầy đủ.

github.com/huuthanhueh-debug/promptgate

## Reddit r/ClaudeAI hoặc r/ClaudeCode (EN)

Title: I built a local prompt gate for Claude Code + claude.ai: scores your prompt in <1 ms and offers 3 filled-in rewrites

Body:

Weak prompts cost twice: a drifting answer, then a second prompt to fix it. PromptGate scores every prompt 0–100 on 7 dimensions (goal, context, output, constraints, acceptance, economy, depth) with a rule engine, no model call, under 1 ms.

Below threshold it does not block. In Claude Code it asks Claude to write three rewrites (Lean / Standard / Deep) with the gaps filled from the conversation and shows them as buttons. On claude.ai a Chrome extension shows a live score badge and the same three rewrites next to the composer. On Windows a tray hotkey does it in any app.

Everything runs locally, nothing leaves your machine, VI/EN. MIT. Install:

    claude plugin marketplace add huuthanhueh-debug/promptgate
    claude plugin install promptgate@promptgate

Repo: https://github.com/huuthanhueh-debug/promptgate

Happy to hear what dimensions you would weight differently.

## X (EN, ≤ 280 ký tự)

Weak prompts cost twice. PromptGate scores every Claude prompt 0–100 in <1 ms (rules, no API) and offers 3 filled-in rewrites as buttons. Claude Code plugin + Windows hotkey + claude.ai extension, same engine, all local, VI/EN, MIT.
github.com/huuthanhueh-debug/promptgate

## X (VI)

Prompt yếu tốn tiền hai lần. PromptGate chấm mỗi prompt 0–100 trong <1 ms, không gọi API, đề xuất 3 bản viết lại bấm là dùng. Plugin Claude Code + phím tắt Windows + extension claude.ai, chạy cục bộ, song ngữ, MIT.
github.com/huuthanhueh-debug/promptgate
