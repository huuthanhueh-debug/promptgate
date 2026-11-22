# 02 · Chữ trên màn hình

> Rút từ 377 khung hình (2 giây/khung, bản 1080p) bằng OCR rồi kiểm lại bằng mắt ở các khung quan trọng. Prompt giữ nguyên văn, kể cả lỗi chính tả. Email cá nhân hiện trên màn hình đã được lược bỏ.

## 1. Các lệnh Viktor gõ cho AI

| Mốc | Ứng dụng | Lệnh (nguyên văn) | Để làm gì |
|---|---|---|---|
| 00:38 | MotionSites Studio | `change the jellyfish to be a normal fish` | Đổi vật thể chính trong mẫu "Jellyfish Scroll" |
| 02:00 | Claude Code, session "PROMTPS THUS" | `ok keep uploading … free` (đang gõ, một phần bị con trỏ che) | Duyệt, cho phép đóng gói và đăng lên thư viện dưới dạng miễn phí |
| 02:06 | Claude Code, session "PROMTPS THUS" | `https://www.pinterest.com/pin/743234744804756299/`<br>`Here's the next one` | Đưa tham chiếu tiếp theo vào dây chuyền đã có SOP |
| 02:14 | như trên | `opt 2 free here is the original code so you won't start fro mscratch` + dán nguyên file HTML `Leon Vasari: Filmography` | Chọn phương án 2, gắn nhãn Free, buộc Claude sửa từ code cũ |
| 03:02 | như trên | `opt 1` | Chọn phương án 1 cho trang thử đồ VirtualFit |
| 05:28 | Claude Code, session mới "Social media copy for web design", đính kèm video CleanShot `.mp4` | `We'll post this on Twitter, LinkedIn, and Threads. Please write me a option for social media on for each platform that will most likely go viral. My focus is to get web design clients` | Viết bài đăng kiếm khách từ video demo |
| 07:30 | MotionSites Studio | `redesign for this comapny https://bobobobo.com/` | Làm bản redesign cho một shop thời trang thật để chào hàng |
| 09:56 | Claude Code (repo MotionSites Studio) | `Yes, push it` (trả lời câu hỏi "Push the free-designs-only rule?") | Duyệt cho Claude đẩy code lên nhánh chính |
| 10:26 | Claude chat, bật web search | `Give me list of the best apps for my industry, say for web design, that are very trending, that is something is emerging, not something that has already been tried. I want something that would work in the future. Do not suggest me ideas like Framer or Webflow. I want something that not a lot of people thinking about it today, but it will be very, very trending and popular and necessary in the future.` | Tìm xu hướng để làm sản phẩm mới |

Thanh chọn model ở cuối khung chat ghi **Opus 5.5 · Medium · Auto** trong Claude Code và **Opus 5.5 · Medium · Manual** trong Claude chat.

---

## 2. Claude trả lời gì

### 2.1 Từ ảnh Pinterest ra 3 phương án (02:42-03:02)

> I'm making three low-quality 1k redesign options of the glassy VirtualFit try-on window with the reference attached, leaving out the watermark and QR code.

Ba phương án lưu thành `option1.png`, `option2.png`, `option3.png` (khoảng 800 KB mỗi file) trong `~/Downloads/pin-743234744804756299/`:

1. **Spatial arc**: quần áo xếp thành vòng cung 3D quanh người mẫu, mờ dần ra hai bên; chữ "FIT" mờ khổng lồ phía sau; tab Tops / Bottoms / Outerwear / Shoes / Accessories; thẻ dưới có nút size S/M/L/XL và chấm màu.
2. **Clean original**: bản sắc nét hơn của ảnh gốc. Claude tự báo: *"I asked for a split layout with a big headline, but the image generator ignored that"* và đề nghị làm lại nếu cần.
3. **Dark night mode**: phòng tối, đèn ấm, kính khói; quần áo xếp thành dải ô ở dưới; chọn size bằng núm xoay.

Câu kết: *"Which one do you want, and is it Free or Paid?"* Claude còn nhắc việc đang treo: *"The Vasari VHS shelf is still waiting for your OK at http://localhost:5571/index.html."*

### 2.2 Dựng phương án 1 (03:06)

Claude báo trang đã chạy ở `http://localhost:5572/index.html`, kèm danh sách hành vi:

- **Garment arc**: thẻ kính cong quanh người mẫu theo 3D, thẻ ngoài nhỏ và mờ hơn, mọi thẻ nhấp nhô nhẹ; kéo được (vuốt nhanh thì quay xa hơn), dùng được bánh xe chuột, phím mũi tên, nút tròn, hoặc bấm thẳng vào thẻ.
- **Try-on**: khi vòng cung dừng ở món nào, một vệt sáng quét từ trên xuống và người mẫu "mặc" món đó (áo thun trắng, sweater oversize, sơ mi linen, hoodie xám, ringer tee).
- **Thẻ dưới**: tên, giá, ảnh nhỏ đổi theo món đang chọn; nút size và chấm màu bấm được. Claude nói rõ chấm màu không đổi màu áo thật *"because there's only one photo of each"*.
- **Tab và chữ mờ**: viên pill trắng trượt theo tab, vòng cung quay một vòng; chữ "FIT" nổi lên khi tải trang và lệch theo chuột.
- **Nền và con trỏ**: phòng nền trôi nhẹ theo chuột; con trỏ kính 58px ghi "TRY ON" khi rê lên thẻ, "DRAG" ở chỗ khác.

Viktor kiểm tra bản mobile bằng Chrome DevTools (giả lập iPhone 16, 393×852).

### 2.3 Dựng từ code gốc (02:00-02:14)

> I'm starting the option 2 build from your original code, which matches `~/Downloads/vasari-vhs-hero/hero-standalone.html`. Next I'm fetching a Japanese font for the large background characters.

Kết quả gồm 3 file (`style.css`, `body.html`, `logic.js`, tổng +404 dòng). Claude kiểm bố cục ở cỡ desktop và điện thoại, mở trang trong Chrome cho Viktor xem, rồi chốt:

> Tell me if it looks right or what to change. I'll wait for your OK before the recording, prompt, standalone file and preview. I've noted it as Free.

Câu này cho thấy SOP của session gồm 4 sản phẩm đầu ra cho mỗi mẫu: **video quay, prompt, file standalone, ảnh preview**, có một bước dừng chờ duyệt.

### 2.4 Bài đăng mạng xã hội (05:28-06:46)

Claude xem video, mở đầu bằng một đoạn tóm tắt: *"It's a concept site for a fashion brand called Maison Vell… That runway effect is what will make people stop scrolling, so every post opens with it."* Các bước nó tự làm: **trích khung hình từ video → xem khung hình → viết bài cho X, LinkedIn, Threads** (32 giây).

**X (Twitter)**
```
Fashion e-commerce sites are boring: grid, product, add to cart.
So I built one where the homepage is a runway.
Click, and the next look walks forward. The products update to match.
Works on mobile too 👇
```
Trả lời ngay dưới bài của chính mình (link để ở đây, không để trong bài chính, để bài vẫn được phân phối):
```
I design sites like this for fashion, beauty and luxury brands.
If your site looks like everyone else's, DM me "RUNWAY" and I'll send you 3 free ideas for yours.
```
Mẹo: đăng video trực tiếp, không đăng dạng link. Ghim bài một tuần. Sau 24 giờ quote lại bài với câu *"this did numbers, here's how I built it"* để có đợt lan truyền thứ hai.

**LinkedIn**
```
Most fashion brands spend $50k on a photoshoot...
...then put the photos in a website that looks like every other store.
I wanted to fix that.
So I designed a homepage that works like a runway:
→ Each look walks forward when you click
→ "Shop the look" changes with the outfit
→ The whole thing works on mobile
The idea is simple. People don't buy clothes from a grid. They buy the feeling of the show.
A website should give them that feeling too, not just a list of prices.
If you run a fashion, beauty or luxury brand and your site feels flat, I'd love to help.
Comment "RUNWAY" and I'll send you a free 3-point review of your current site.
♻️ Repost if you think e-commerce design needs more of this.
```
Mẹo: tải video trực tiếp, không để link trong bài. Từ khóa trong bình luận kéo nhiều bình luận, giúp tăng tiếp cận, và mỗi người bình luận là một lead "ấm" để nhắn tin. Đăng thứ Ba đến thứ Năm, 8-10 giờ sáng theo múi giờ của khách.

**Threads**: video chỉ lộ dòng đầu *"I turned an online store into a runway show"*, phần còn lại không thấy.

Viktor đăng đúng bản X ở trên, kèm video quay bằng CleanShot, và tự trả lời bằng câu DM "RUNWAY".

### 2.5 Xu hướng mới nổi (10:54-11:20)

> Most truly early stuff right now isn't a polished app yet. It's new standards and APIs that apps will be built on.

1. **WebMCP: websites for AI agents, not just people.** Nhóm Chrome của Google công bố bản xem trước ngày 10/02/2026, Google và Microsoft cùng phát triển, cho phép website khai báo các "công cụ" để AI agent gọi. Còn nằm sau cờ thử nghiệm của Chrome Canary. Ý chính: *"structured data told Google what a page is about, while WebMCP tells agents what a page can do."* Hầu như chưa designer nào để ý.
2. **Generative UI**: giao diện được AI dựng tại chỗ cho từng người dùng. Ví dụ Thesys C1; Google công bố Generative UI trong Search tại I/O 2026; W3C đã bàn khung đánh giá chất lượng.
3. **DESIGN.md**: hệ thống thiết kế viết cho AI đọc. Bắt đầu từ Google Stitch; repo awesome-design-md đạt hơn 10.000 sao GitHub trong vài ngày; Google có cả linter cho định dạng này.
4. **Agent-ready design as a service**: dịch vụ làm site phục vụ cả người lẫn AI agent, *"something nobody really sells yet"*.

Nhận định cuối của Claude: *"#1 and #4 are the least crowded. 'Agent-ready websites' could be a whole new offer, like SEO was 20 years ago."* Có kèm nguồn: Similarweb, DEV, No Hacks, W3C, Noata, tài liệu Thesys C1, Google DESIGN.md.

### 2.6 Claude Code bảo trì sản phẩm MotionSites Studio (00:20, 09:56)

Các báo cáo Claude gửi về: đã kéo commit "Let Studio AI read PDFs" và cài thư viện mới; quy tắc *free-designs-only* (người dùng gói miễn phí chỉ mở được 1 mẫu free) giữ nguyên và **190 test pass**; sau khi được duyệt thì push commit `d528387` và nhắc *"Press Publish in Lovable to make it live"*; lần kéo sau thêm đăng nhập Google, sửa lỗi tính chi phí AI trên mọi cuộc chat của người dùng, **198 test pass**. Cách làm này cho thấy sản phẩm có test tự động và Claude phải hỏi trước khi push.

---

## 3. MotionSites Studio (sản phẩm được giới thiệu)

| Hạng mục | Chi tiết thấy trên màn hình |
|---|---|
| Định vị | *"Introducing MotionSites Studio: the first AI agent that customizes premium animated websites for your brand."* Khẩu hiệu trang chủ: **MAKE YOUR WEBSITE LOOK DESIGNED.** |
| Prompt mẫu ở trang chủ | "A website for my bakery in Lisbon" · "An online store for handmade candles" · "A landing page for my fitness app" · "A portfolio for a wedding photographer" |
| Luồng làm việc | Chọn mẫu (Start from a design) → Customize → các bước AI tự chạy: *Looking through the code → Reading your site → Making images → Making a video → Editing your site → Saving a new version* → Preview → Download code |
| Câu hỏi AI đặt cho khách | *"Tell me your business name, what you do, and any brand colors you'd like me to use."* |
| Nút gợi ý | "Show my plan" · "Make it look more premium" · "Restyle the images and videos to fit my brand" |
| Mẫu có sẵn (ví dụ) | Runway Lookbook, Jellyfish Scroll, Shelf Hero Portfolio, Living Portrait Portfolio, Flower Valley 3D, 3D Jack Portfolio, Orvante Agency, Particle Brain 3D, Orbit Sphere, Glass Tree 3D, Pink Rider… |
| Bảng giá | Starter / Basic / Pro / Studio: ngân sách AI **25 / 99 / 199 / 499 USD mỗi tháng**; Starter tùy biến 5 mẫu/tháng, các gói còn lại không giới hạn; hủy bất cứ lúc nào, không phí cài đặt; có ưu đãi "Due today $149 → $99" |
| Hỏi đáp | What is MotionSites Studio? · How much does it cost? · Can I cancel at any time? · Is hosting included? · Who owns my website? |
| Ví dụ bản redesign (bobobobo.com) | *"I'll turn the Runway Lookbook design into a Bobobobo site… I'll change all the words, the navigation and the product details to fit Bobobobo."* Sau đó AI nhắc khách tự kiểm ảnh: *"If anything looks cut off, tell me which one and I'll fix it."* |

---

## 4. Mẫu copywriting trong các bài đăng của Viktor

| Kiểu mở bài | Ví dụ nguyên văn |
|---|---|
| Phủ định hiện trạng → giải pháp | *"Fashion websites are still just product grids. So I turned one into a runway."* |
| Tuyên bố mạnh | *"Agency sites will never look the same."* · *"Design is officially solved."* |
| "Cái cũ đã chết" | *"Every portfolio on the internet is dead. So I built one that looks back at you. Nobody forgets a website that winks at them."* |
| Trước/sau | *"A year ago this took a 3D dev and weeks of work. Today it's Claude + one prompt."* |
| Mô tả tương tác bằng hình ảnh | *"A solar company's hero section that changes from day to night. Click the toggle and the whole house sinks into the fog, then floats back up in new light."* |
| Ý kiến gây tranh luận | *"or just skip figma and design in claude directly. why design it twice?"* |
| Kêu gọi bằng từ khóa | *"Comment "PROMPT" and I'll send you the exact prompt behind this site."* · *DM me "RUNWAY"* |
| Đặt chuẩn | *"This is the bar for a 3D site now. One prompt, five minutes."* |

---

## 5. Tài nguyên và công cụ xuất hiện

**Danh sách "7 free AI design resources worth bookmarking" (bài X của Viktor):**

| # | Trang | Mô tả của tác giả |
|---|---|---|
| 1 | motionsites.ai | 800+ prompt website, 1000+ nền chuyển động. "Paste into Claude, ship." |
| 2 | land-book.com | landing page inspiration done right |
| 3 | recent.design | cool gallery for web design inspo |
| 4 | landdding.com | top notch landings |
| 5 | fontinlogo.com | fonts behind brands |
| 6 | godly.website | award websites |
| 7 | 60fps.design | mobile UI animations |

Một bài khác, *"If you design with AI, this is all you need"*, chỉ có 3 mục: `studio.motionsites.ai` ("cheaper than lovable"), `motionsites.ai` ("800+ 3d websites, motion sections. Paste into Claude, ship.") và `land-book.com`.

**Công cụ thấy trên màn hình:**

| Nhóm | Công cụ | Dùng vào việc |
|---|---|---|
| AI | Claude desktop: tab Chat và Code, Opus 5.5 | Dựng site, viết bài, nghiên cứu, bảo trì sản phẩm |
| AI | Bảng Preview trong Claude Code (nhiều server: mindflux :8000, medusa :5553, vante :5556, crestora :5557, aurelis :5558), cấu hình trong `.claude/launch.json` | Chạy và xem nhiều site cùng lúc |
| AI | Image generator (session tên "Redesign options with GPT image…") | Vẽ 3 phương án trước khi code |
| Cảm hứng | Pinterest, Dribbble, Awwwards, Google | Tìm tham chiếu và tìm khách |
| Quay và dựng video | CleanShot X, Screen Studio, CapCut | Quay demo để đăng |
| Hosting | Vercel (kéo thả), Lovable (app Studio) | Đưa site lên mạng |
| Mạng xã hội | X (kèm Tweet Hunter), Instagram, LinkedIn, Threads | Phân phối và kiếm lead |
| Khác | Chrome DevTools (giả lập iPhone 16), Notion, Figma | Kiểm tra mobile, ghi chú |
