# P1 — Business rules và UX đã triển khai

Phạm vi: sáu mục P1 trong `business-rules-ux-review-2026-10-12.md`.

1. **Phục hồi dữ liệu:** chặn autosave khi dữ liệu không đọc được; giữ bản gốc, tải bản lỗi, khôi phục bản hợp lệ gần nhất hoặc nhập backup. Tạo dữ liệu mới là thao tác rõ ràng của người dùng.
2. **Tồn kho:** ghi lượng nguyên liệu thực tế được dùng khi hoàn tất bữa; giữ lịch sử mua và sử dụng khi đổi tuần. Mở tuần mới cần xác nhận lượng tồn thực tế; đồ đã chuẩn bị được giữ riêng khỏi nguyên liệu sống.
3. **Bảo quản:** mỗi mẻ có trạng thái thực phẩm, nơi bảo quản và lịch sử sơ chế/cấp đông/rã đông/nấu/kiểm tra. Đổi lịch không thay thời điểm gốc. Dữ liệu thiếu được đánh dấu cần kiểm tra, không tự đặt hạn dùng.
4. **Công thức:** nguyên liệu có ID ổn định; từng bước sơ chế liên kết trực tiếp tới nguyên liệu và lượng đã phân bổ. Không phân bổ một lượng nguyên liệu hai lần qua nhiều thao tác. Công thức nhập/tùy chỉnh chưa đủ liên kết cần người dùng xác nhận; kiểm tra ID, lượng và tổng phân bổ.
5. **Lịch:** lịch bảy ngày hiển thị bữa chính và đồ bổ sung. Xem tuần khác không reset dữ liệu; tuần cũ được lưu để xem. Thay bữa, gộp cùng công thức và thêm bữa riêng là các thao tác khác nhau. Nguồn nguyên liệu của từng phần được giữ khi gộp.
6. **Nấu và phần dư:** bắt đầu mẻ hoặc bật timer giữ số phần đang nấu. Hoàn tất ghi đã nấu/đã ăn/còn lại, mặc định bằng kế hoạch. Phần chưa nấu được giữ ở đồ sơ chế; phần chín dư có thời điểm nấu riêng, ghi nơi bảo quản, lên lịch và ăn dần. Sử dụng đồ chín không trừ nguyên liệu lần hai. Hoàn tác bị chặn khi phần dư đã được lên lịch, ăn hoặc bỏ. Mở tuần mới/đổi công thức bị chặn khi mẻ đang nấu chưa kết thúc; có thao tác hủy trạng thái mẻ nếu chưa nấu thực tế.

## Cách dùng phần chín còn lại

Ở **Đồ cần sắp xếp**, kiểm tra bảo quản, chọn ngày/buổi rồi lưu. Phần này xuất hiện trên lịch bảy ngày. Nếu dùng để thay một bữa chính, bỏ bữa chính tương ứng để danh sách mua cập nhật. Ghi số phần đã ăn; phần còn lại giữ nguyên thời điểm nấu và lịch sử bảo quản. Đồ chín không chạy lại hướng dẫn nấu nguyên liệu sống.

Hướng dẫn đồ chín dựa trên [USDA — Leftovers and Food Safety](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety), đối chiếu ngày 2026-10-12. App hiển thị hướng dẫn và yêu cầu kiểm tra thực tế; không tự xác nhận an toàn hoặc kéo dài hạn dùng khi đổi lịch.

## Xác minh

- Kiểm thử hồi phục dữ liệu, tồn kho/kiểm kê, lịch sử bảo quản, liên kết nguyên liệu, lịch bảy ngày/gộp phần và kết quả nấu/phần dư.
- Kiểm thử luồng React cho lịch, Settings và Nấu Ăn; chạy toàn bộ Vitest, TypeScript và production build.
- Chưa kiểm thử giao diện trực quan trên trình duyệt/thiết bị thật trong môi trường này.
