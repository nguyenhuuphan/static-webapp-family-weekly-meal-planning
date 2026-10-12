# Sửa UX sắp xếp và hoàn thành bữa ăn

- Thông báo cập nhật tự tắt sau 8 giây; có nút đóng. Mỗi thao tác mới đặt lại thời gian hiển thị và vẫn cho hoàn tác trong thời gian đó.
- Danh sách cần sắp xếp chỉ gồm các mục pending. Bữa đã có ngày chuyển sang nhóm Đã lên lịch; đã phân bổ, đã dùng hoặc đã bỏ nằm trong lịch sử. Link từ lịch mở đầy đủ nhóm chứa mục tương ứng.
- Không tạo công thức bị thay nếu cùng nội dung công thức hoặc đã có trong danh sách. Khi tải dữ liệu và cập nhật, gợi ý công thức trùng được chuyển vào lịch sử. So sánh nội dung và lượng nguyên liệu trên một phần, không chỉ tên món. Không gộp hoặc xóa các mẻ thực phẩm thực tế.
- Bộ chọn bữa hiển thị trực tiếp cuối tuần hiện tại và cả 7 ngày tuần sau, gồm trưa và tối. Các ngày này là bữa bổ sung, không âm thầm thay bữa đang có, đặt lại tuần hoặc ngày sơ chế. Có thể nhập ngày xa hơn trong biểu mẫu hiển thị sẵn. Đồ đã nấu cũng có bộ chọn nhanh.
- Mỗi bữa đang hoạt động trên lịch có nút Hoàn thành bữa ăn. Biểu mẫu xác nhận mặc định số phần đã nấu và đã ăn bằng số người; có thể điều chỉnh. Ghi nhận dùng nguyên liệu và phần dư theo cùng logic kết thúc nấu ăn; không giả lập đã sơ chế hoặc đã kiểm tra bảo quản. Không hoàn thành lần hai, bữa đã bỏ hoặc số phần không hợp lệ. Có thể hủy trước khi xác nhận hoặc hoàn tác sau khi ghi nhận theo quy tắc hiện có.

## Kiểm tra

89 test / 32 file pass; TypeScript và production build pass. Chưa kiểm tra trực tiếp trình duyệt hoặc điện thoại. Build có cảnh báo kích thước JavaScript trên 500 kB.
