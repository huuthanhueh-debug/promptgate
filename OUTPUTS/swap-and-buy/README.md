# Swap & Buy: prompt dựng sàn đổi đồ kiểu quẹt thẻ

Prompt hoàn chỉnh để Claude dựng MVP một website đổi đồ: đăng món, quẹt như app hẹn hò, hai bên cùng thích thì khớp, thương lượng đổi có bù tiền hoặc mua thẳng. Đổi được hàng vật lý, file số, kiến thức, dịch vụ, mã khóa học, voucher. Chỉ giao dịch trong Việt Nam.

| File | Nội dung |
|---|---|
| `prompt-vi.txt` | Bản tiếng Việt (S-01), PromptGate **98/100** |
| `prompt-en.txt` | Bản tiếng Anh (S-02), PromptGate **98/100** |
| `scores.md` | Bảng điểm chi tiết |

## Cách dùng

1. Tạo thư mục trống, mở **Claude Code** tại đó (tab Code của app Claude desktop hoặc CLI). Đây là một ứng dụng nhiều phần có database, nên không dùng chat thường.
2. Copy toàn bộ một trong hai file (chọn một ngôn ngữ), dán vào Claude, gửi.
3. Claude làm mốc M0 (kế hoạch, spec, wireframe, 2 phương án màu) rồi **dừng chờ anh duyệt**. Duyệt xong, gõ "ok, làm M1", và lần lượt đến M6.
4. Mỗi mốc nên chạy trong một session mới, bắt đầu bằng câu: "Đọc PLAN.md và SPEC.md, làm tiếp mốc Mx". Hai file này là "bộ nhớ" của dự án, nên session có bị nén hay mở mới cũng không mất mạch.

Chấm lại điểm sau khi sửa prompt:
```bash
node OUTPUTS/claude-web-design-viktor-oddy/tools/score-prompts.js OUTPUTS/swap-and-buy/prompt-vi.txt OUTPUTS/swap-and-buy/prompt-en.txt --min 85 --write
```

## Prompt gồm những phần nào

Vai trò · Mục tiêu · 5 kịch bản bắt buộc · Người dùng · 11 tính năng MVP · Ghép cặp và cán cân · Giao dịch (state machine) · Tiền và vận chuyển · An toàn và pháp lý · Công nghệ · Dữ liệu · Giao diện · Dữ liệu mẫu · Đầu ra · Ràng buộc · Cách làm (M0–M6) · Hoàn thành khi.

Năm ví dụ anh đưa ra được biến thành **5 kịch bản kiểm thử tự động**: iPhone 15 đổi iPhone 18 có bù tiền và phản đề nghị; áo Gucci đổi giày Zegna gặp trực tiếp; mã khóa học đổi template (giao dịch số); mua thẳng voucher; buổi dạy tiếng Anh đổi buổi tư vấn logo. Claude chỉ được báo xong khi cả 5 kịch bản chạy trọn và có test pass.

## Quyết định thiết kế và lý do

| Quyết định | Lý do |
|---|---|
| Tiền bù và tiền cọc đi qua **đối tác trung gian thanh toán có ký quỹ** được Ngân hàng Nhà nước cấp phép; MVP dùng bản mock | Tự giữ tiền người dùng cần giấy phép. Ký quỹ cũng xử lý nỗi sợ số 1: gửi đồ mà không nhận lại |
| **Chỉ dùng VND** trên giao diện; "100 USD" trong ví dụ thành 2.600.000 ₫ | Thông tư 32/2013/TT-NHNN hạn chế niêm yết và thanh toán bằng ngoại tệ trong nước |
| Địa chỉ theo **34 tỉnh/thành, 2 cấp** (không còn huyện) | Cải cách hành chính có hiệu lực từ 01/07/2025; form địa chỉ kiểu cũ sẽ sai |
| **Két số** cho mã và file, mở theo luật: số đổi số mở cùng lúc; số đổi vật lý thì bên hàng vật lý gửi trước | Xử lý nỗi sợ số 2: nhận mã đã dùng. Không bên nào nhận được hết phần lợi trước khi bên kia đã cam kết |
| **Bên uy tín thấp hơn gửi trước**; cọc chỉ 10% | Giảm rủi ro mà không bắt người dùng đặt cọc bằng toàn bộ giá trị món |
| Tài khoản mới **tối đa 5 triệu/giao dịch** | Kẻ gian thường dùng tài khoản mới; người thật vẫn giao dịch nhỏ được ngay |
| iPhone bắt buộc **IMEI** và **thoát iCloud** | Máy còn khóa iCloud gần như không dùng được; đây là kiểu lừa hay gặp khi mua bán điện thoại cũ |
| Hàng hiệu bắt buộc **chứng từ** | Mua bán hoặc trao đổi hàng giả là vi phạm pháp luật, và hàng hiệu là nhóm hay bị làm giả |
| Che số điện thoại và số tài khoản trong chat **trước khi khóa giao dịch** | Chặn việc dắt người dùng ra ngoài nền tảng để lừa |
| Hiệu ứng chủ đạo **"cán cân công bằng"** | Theo bài học từ video Viktor Oddy: chỉ một tương tác đáng nhớ. Cán cân giúp hai bên thấy ngay chênh lệch giá trị và mức bù hợp lý |
| Bản nháp Điều khoản, Chính sách quyền riêng tư, Quy chế sàn | Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (hiệu lực 01/01/2026) và Luật Thương mại điện tử 122/2025/QH15 (hiệu lực 01/07/2026) |
| Dừng duyệt ở M0, báo cáo mỗi mốc | Chốt hướng khi đổi còn rẻ, giống bước "chọn phương án" trong quy trình của Viktor |

## Anh cần quyết trước khi làm thật

| Việc | Mặc định trong prompt |
|---|---|
| Tên thương hiệu và tên miền | "Swap & Buy" (tên tạm) |
| Mức phí | 3% trên phần tiền, đổi ngang miễn phí |
| Mức cọc, giới hạn tài khoản mới | 10%, 5.000.000 ₫ |
| Đối tác thanh toán có ký quỹ | Chưa chọn (mock) |
| Đơn vị vận chuyển | Chưa chọn (mock) |
| Nhà cung cấp SMS OTP (tin nhắn brandname cần đăng ký) | Chưa chọn (mock) |
| Pháp nhân vận hành sàn và luật sư rà soát văn bản | Cần có trước khi ra mắt |

## Nguồn kiểm chứng pháp lý

- [Cải cách hành chính 2025: 34 tỉnh/thành, chính quyền 2 cấp](https://en.wikipedia.org/wiki/2025_Vietnamese_administrative_reform)
- [Thông tư 32/2013/TT-NHNN về hạn chế sử dụng ngoại hối](https://luatvietnam.vn/legal-updates/circular-no-32-2013-tt-nhnn-on-foreign-exchange-restrictions-remains-effective-892-115661-article.html)
- [Luật Bảo vệ dữ liệu cá nhân, hiệu lực 01/01/2026](https://vneconomy.vn/nhung-diem-moi-trong-luat-bao-ve-du-lieu-ca-nhan-tu-112026.htm)
- [Luật Thương mại điện tử 2025, số 122/2025/QH15](https://thuvienphapluat.vn/van-ban/Thuong-mai/Luat-Thuong-mai-dien-tu-2025-so-122-2025-QH15-662035.aspx)

Đây là tham khảo kỹ thuật, không thay cho tư vấn pháp lý.
