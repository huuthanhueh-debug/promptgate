# PromptGate Pro — trang bán trên Gumroad (bản nháp)

**URL dự kiến:** https://thequietconcierge.gumroad.com/l/promptgate · **Giá:** 19 USD, mua một lần, cập nhật 12 tháng · **Loại:** digital file (zip) + license key tự sinh (bật "Generate a unique license key per sale")

## Tên sản phẩm
PromptGate Pro — stop paying for weak prompts (Claude Code plugin packs)

## Mô tả (EN)

Every weak prompt costs you twice: the tokens it wastes and the second prompt you need to fix it. PromptGate sits between your keyboard and Claude Code, scores each prompt in milliseconds, blocks the weak ones and hands them back tighter and deeper. The free plugin on GitHub does this for everyone.

**Pro adds the depth:**
- **4 domain packs** that teach the gate what a good prompt looks like in your field: *Coding* (tests, refactors, APIs, UI, data), *Writing* (email, social, long-form, translation, sales copy), *Business* (plans, finance, market, decisions, reports), *Hospitality & Service* (SOPs, pre-opening, training, guest recovery, compliance/PPM). Each pack brings its own task detection, default output formats and done-when criteria, in Vietnamese and English.
- **Tier-2 rewrite** through your own `claude -p` login. No API key, no extra bill. Only runs when the rules say a prompt is weak.
- **Full history analytics**: per-project scores, weekly trend, the 20 weakest prompts you ever typed with rewrites, and an HTML dashboard. Everything stays on your machine.
- **12 months of pack updates** as prompting practice evolves.

Install the free plugin, drop the Pro packs into one folder, run `/promptgate:activate <key>`. Two minutes.

Works on Windows, macOS, Linux. Requires Claude Code and Node.js 18+. No telemetry, no account, nothing leaves your computer.

## Mô tả (VI)

Mỗi prompt yếu làm bạn trả giá hai lần: token bị lãng phí và prompt thứ hai để sửa. PromptGate đứng giữa bàn phím và Claude Code, chấm điểm từng prompt trong vài mili-giây, chặn prompt yếu và trả lại bản gọn hơn, sâu hơn. Plugin miễn phí trên GitHub làm việc đó cho tất cả mọi người.

**Pro thêm chiều sâu:**
- **4 gói ngành**: *Lập trình* (test, refactor, API, UI, dữ liệu), *Viết* (email, mạng xã hội, bài dài, dịch, nội dung bán hàng), *Kinh doanh* (kế hoạch, tài chính, thị trường, quyết định, báo cáo), *Khách sạn & dịch vụ* (SOP, pre-opening, đào tạo, xử lý khách, tuân thủ/PPM). Mỗi gói có cách nhận diện việc, định dạng đầu ra và tiêu chí hoàn thành riêng, song ngữ Việt-Anh.
- **Tầng 2 viết lại** bằng chính đăng nhập `claude -p` của bạn. Không cần API key, không thêm hóa đơn. Chỉ chạy khi quy tắc kết luận prompt yếu.
- **Phân tích lịch sử đầy đủ**: điểm theo project, xu hướng tuần, 20 prompt yếu nhất bạn từng gõ kèm bản viết lại, dashboard HTML. Tất cả nằm trên máy bạn.
- **12 tháng cập nhật gói mẫu**.

Cài plugin miễn phí, thả gói Pro vào một thư mục, chạy `/promptgate:activate <key>`. Hai phút.

## Checklist tạo sản phẩm trên Gumroad
1. New product → Digital product → tên như trên, giá 19 USD.
2. Settings → bật **License keys** (unique per sale). Ghi lại **Product ID** (hoặc dùng permalink `promptgate`) → điền vào `scripts/lib/product.js` hoặc biến `PROMPTGATE_GUMROAD_PRODUCT_ID`.
3. Content → upload `dist/promptgate-pro-1.0.0.zip` (tạo bằng `node scripts/build-pro.js`).
4. Thumbnail 1280×720: nền tối, dòng lệnh chặn prompt + bản gợi ý. Cover thứ hai: ảnh dashboard HTML.
5. Receipt message: dán 5 bước trong README.txt của zip.
6. Publish; gắn link vào README của repo (đã có sẵn).

## Khung giá sau này
- Pro cá nhân 19 USD (hiện tại) · Team 5 máy 49 USD · Gói ngành lẻ 9 USD (nếu thấy nhu cầu tách).