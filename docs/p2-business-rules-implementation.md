# P2 — Các mục 7 đến 13

Đã triển khai bảy mục từ review ngày 2026-10-12, mỗi mục có commit riêng.

| Mục | Hành vi |
|---|---|
| 7 — Undo | Nút hoàn tác thao tác mới nhất trong phiên, dùng cho đổi số người, thay món, lịch, mua sắm và ghi nhận đồ ăn. Thao tác sau làm mất quyền hoàn tác thao tác trước. Ghi nhận đã dùng/đã bỏ hoặc kết quả nấu cần xác nhận là nhập nhầm; không dùng Undo để đảo ngược thực phẩm đã xử lý thực tế. Giữ tối đa 20 lần sửa cùng các ghi nhận thực phẩm trước khi sửa, xem tại Settings. |
| 8 — Đồ cần sắp xếp | Tách thực phẩm đã sơ chế/đã nấu, công thức và lịch sử xử lý. Card mặc định thu gọn, có tên/số phần/trạng thái/ngày; mở khi cần thao tác. Có tìm kiếm, liên kết từ lịch mở đúng card. Các lô riêng giữ riêng, không tự gộp theo tên món. |
| 9 — Lượng mua thực tế | Ghi lần mua theo tổng lượng hoặc số gói × lượng mỗi gói, cùng nơi cất phần dư. Công thức giữ định lượng chính xác. Lượng mua thực tế cộng vào tồn, được trừ khi dùng và giữ lịch sử qua tuần. Checkbox nhanh vẫn là ghi lượng theo nhu cầu; dùng form lượng thực mua để ghi quy cách gói. |
| 10 — Cần tránh | Hồ sơ tùy chọn theo người; nhập nguyên liệu/nhóm cần tránh bằng dấu phẩy. Đối chiếu tên tiếng Anh/Việt, gia vị và tag nhập từ nhãn tại editor. Cảnh báo trong lịch, nấu, đồ để dành và khi sửa công thức. Đối chiếu cả hồ sơ gia đình vì app chưa chọn danh tính người ăn cho từng bữa. Không coi tên nguyên liệu hay việc không có cảnh báo là xác nhận an toàn dị ứng. |
| 11 — Offline | Production build tạo service worker cache giao diện, JS/CSS và menu theo phiên bản. Khởi động từ dữ liệu đã lưu không phải chờ mạng; có menu đóng gói để fallback. Trạng thái online/offline và bản cập nhật hiển thị trong app. Người dùng chủ động tải bản mới sau khi lưu chỉnh sửa/kết thúc mẻ và timer. |
| 12 — Nhiều tab | Theo dõi storage event, kiểm tra bản gốc trước khi ghi; khóa lượt ghi giữa các tab khi có Web Locks. Khi có thay đổi, dừng autosave/chỉnh sửa, cho tải hai bản, nạp bản từ tab khác hoặc chủ động giữ bản của tab này. Bản bị thay được lưu riêng trong localStorage. Không tự merge dữ liệu. |
| 13 — Màn hình khi nấu | Wake Lock tùy chọn, mặc định tắt; báo đúng trạng thái đang yêu cầu/đang giữ/đã thả/lỗi/không hỗ trợ. Thả khóa khi rời màn hình nấu hoặc vào nền, xin lại khi quay về nếu còn bật. Có nút thử lại và hướng dẫn dùng timer điện thoại cho nhu cầu báo nền. |

## Giới hạn vận hành

- Offline và Wake Lock cần môi trường HTTPS (localhost được trình duyệt hỗ trợ). Dùng offline sau lần tải/cache đầu thành công; xóa dữ liệu website có thể xóa cả cache và dữ liệu. Bản dev không đăng ký service worker.
- Cache được tách theo scope, giữ hai phiên bản gần nhất. Cấu hình hosting `_headers` được loại khỏi precache. Cập nhật không tự reset kế hoạch.
- Trình duyệt không có Web Locks dùng kiểm tra bản lưu và storage event; đây không phải giao dịch nguyên tử giữa hai tab. App nhắc chỉ chỉnh sửa ở một tab trong trường hợp này.
- Đây là dữ liệu theo trình duyệt/thiết bị, chưa đồng bộ giữa hai điện thoại. Âm báo web và Wake Lock không bảo đảm chạy khi app bị đóng hoặc hệ điều hành đình chỉ.
- Cảnh báo cần tránh là gợi ý kiểm tra; vẫn cần đọc nhãn thực tế và xem nguy cơ nhiễm chéo. Danh sách gợi ý không phải danh sách dị ứng đầy đủ hay quy định Việt Nam.

## Xác minh

Toàn bộ 82 test / 31 file pass, TypeScript và production build pass. Test bao gồm Undo, tồn sau mua gói, cảnh báo gia vị/tag, cache navigation/assets khi mất mạng, kích hoạt bản cập nhật có chủ đích, chặn ghi từ bản cũ, nạp thay đổi tab khác và vòng đời Wake Lock. Chưa chạy kiểm thử trình duyệt/điện thoại thật, offline thực trên deployment hoặc chứng nhận accessibility; mục 14 chưa thuộc phạm vi yêu cầu này.

## Nguồn đối chiếu

- [FDA — Food allergies and reading labels](https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know)
- [MDN — Using service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [MDN — Storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event)
- [MDN — Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
