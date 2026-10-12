# Review business rule và UX — 12/10/2026

Phạm vi: lịch tuần, đổi lịch, khẩu phần, mua sắm, sơ chế, nấu ăn, đồ để dành, cài đặt, backup, an toàn thực phẩm và lưu dữ liệu. Review dựa trên mã nguồn, test tương tác React và nghiên cứu nguồn chính thức. Chưa kiểm tra trực quan hoặc usability test trên điện thoại thật; chưa chứng nhận WCAG hay an toàn thực phẩm.

## Đã triển khai và kiểm tra

| Commit | Kết quả |
|---|---|
| `7b9af91` | Hoán đổi lịch, giữ định danh món, tiến độ và timer. |
| `181235d` | Số người ăn riêng từng bữa; lưu lượng đã mua khi kế hoạch thay đổi. |
| `4227fcf` | Giữ phần đã sơ chế, kể cả sơ chế một phần; thay bữa chưa chuẩn bị, giữ công thức bị thay, đặt ngày ngoài tuần và giữ qua tuần mới. |
| `901117d` | Không ăn từng bữa/cả ngày; khôi phục số người trước đó; loại bữa bỏ khỏi sơ chế, mua sắm và nấu ăn. |
| `7bb4bae` | Không tính nguyên liệu đã nằm trong đồ để dành là nguyên liệu còn sẵn cho mẻ mới. |
| `9dced1d` | Nhãn hộp theo lịch mới; thông báo rõ hướng dẫn bảo quản gốc không tự thay đổi theo ngày ăn mới. |

Kết quả cuối: **57 test / 19 file pass**, TypeScript và production build pass. Backup có dữ liệu khẩu phần, đồ để dành, ngày sơ chế và lịch riêng. File backup của người dùng không bị chỉnh sửa hoặc đưa vào commit.

## Phát hiện còn lại — chưa triển khai

P1: nên xử lý trước khi mở rộng automation hoặc dùng thường xuyên. P2: cải thiện trải nghiệm và mở rộng sau khi dữ liệu nền ổn định. Đây là thứ tự đề xuất của review, không phải danh sách tính năng đã có.

### P1 — Dữ liệu và business rule

**1. Lỗi đọc dữ liệu có thể dẫn đến ghi đè bản đang có.**

Bằng chứng: `source/src/hooks/usePlannerController.ts:76` báo lỗi và dùng menu gốc khi hydrate thất bại; effect ở dòng 116 vẫn ghi state đó và xóa thông báo lỗi. Một record đồ để dành không hợp lệ có thể khiến cả state cũ bị thay. Đây là kết luận từ luồng mã, chưa có bài kiểm tra phục hồi dành riêng.

Đề xuất: tách lỗi đọc khỏi lỗi ghi, giữ nguyên raw backup bị lỗi, chặn autosave cho đến khi người dùng chủ động khôi phục hoặc tạo kế hoạch mới. Cho tải dữ liệu gốc để phục hồi từng phần. Lưu ít nhất một snapshot hợp lệ gần nhất. [MDN — storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) cũng cho thấy dữ liệu trình duyệt không thay thế một cơ chế backup.

**2. Kho nguyên liệu chưa phải sổ tồn kho thực tế.**

Bằng chứng: `source/src/helpers/scheduling.ts:119` giữ `pantry` khi bắt đầu tuần, nhưng xóa `purchased`; hoàn thành bữa chỉ cập nhật `progress.done`. Nguyên liệu đã dùng chưa được trừ khỏi pantry. Lượng đã mua nhưng chưa sơ chế cũng chưa có luồng kiểm kê chuyển tuần.

Ví dụ: đã khai có sẵn 500 g tôm, đã dùng trong tuần, sang tuần sau vẫn có thể bị tính còn 500 g.

Đề xuất: phân biệt tồn thực tế, lượng giữ cho bữa, lượng đã dùng và ghi nhận mua. Trước khi mở tuần mới, hiện bước “Kiểm tra đồ còn lại”; không tự coi tất cả lượng mua cũ là tồn, cũng không bỏ mất lịch sử mua. [EPA](https://www.epa.gov/recycle/preventing-wasted-food-home) khuyến nghị kiểm tra thực phẩm đang có rồi mới lập lịch và mua thêm; [Paprika](https://www.paprikaapp.com/help/windows/) lưu lượng, ngày mua và thông tin hạn dùng trong pantry.

**3. Chưa đủ dữ liệu để gợi ý hạn sử dụng hoặc ưu tiên theo bảo quản.**

Bằng chứng: `SavedFood` trong `source/src/types/index.ts` có ngày sơ chế theo task và `storageNote` dạng chữ; chưa phân biệt sống/đã nấu, ngăn mát/ngăn đông, thời điểm cấp đông/rã đông. Món mới sơ chế một nguyên liệu cũng có thể có 2 phần, nhưng không có nghĩa là hai bữa đã hoàn chỉnh.

Đề xuất: ghi trạng thái thực phẩm và lịch sử bảo quản theo phần/lô, cho phép “chưa biết”. Chỉ gợi ý “cần kiểm tra trước” khi thiếu dữ liệu. Không dùng chung mốc bảo quản đồ chín cho thịt sống: [USDA Refrigeration](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/refrigeration) phân biệt hai nhóm; [USDA Leftovers](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety) áp dụng hướng dẫn riêng cho đồ đã nấu. Không tự dời đồ sang tuần sau chỉ vì còn chỗ trong lịch.

**4. Công thức tùy chỉnh chưa liên kết đầy đủ với nguyên liệu đã sơ chế.**

Bằng chứng: `source/src/helpers/shopping.ts:6` chỉ trừ lượng đã chuẩn bị khi nhận diện được allocation từ profile đã kiểm tra. Recipe import/chỉnh sửa và các task trộn nhiều nguyên liệu chưa nhận diện hết; có thể vẫn xuất hiện nguyên liệu đã chuẩn bị trong nhu cầu mua.

Đề xuất: task sơ chế cần liên kết trực tiếp với ingredient ID, lượng và trạng thái của từng nguyên liệu. Nếu chưa liên kết, cho người dùng xác nhận thay vì đoán qua tên món hoặc nội dung câu hướng dẫn. Trước mắt cần hiển thị rõ trường hợp chưa tự đối chiếu được. Đây là giới hạn của implementation hiện tại, không phải lỗi đã được khắc phục hoàn toàn.

**5. Bữa có ngày riêng vẫn tách khỏi lịch tuần chính.**

Bằng chứng: `SavedFoodPanel` hiển thị bữa thêm và ngày riêng, trong khi weekly grid vẫn là 10 slot thứ Hai–thứ Sáu. Đặt bữa để dành vào thứ Ba tối là thêm một bữa riêng, không tự thay món thứ Ba tối đang có; giao diện đã nói rõ nhưng người dùng vẫn phải đối chiếu hai nơi.

Đề xuất: lịch ngày thống nhất, nhìn thấy cả bữa chính lẫn phần để dành; chọn rõ “thay bữa”, “ăn thêm” hoặc “gộp phần”. Có ngày cuối tuần, chuyển tuần bằng điều hướng thay vì dùng thao tác reset. [AnyList Leftovers](https://help.anylist.com/articles/meal-plan-leftovers/) phân biệt queue chờ và calendar, có badge riêng cho đồ đã chuẩn bị; [Paprika](https://www.paprikaapp.com/help/windows/) có lịch ngày/tuần/tháng. Không cần sao chép toàn bộ tính năng của hai sản phẩm.

**6. Nấu xong chưa ghi số phần thực tế và đồ chín còn lại.**

Bằng chứng: `source/src/containers/CookingManagement/CookingSession/index.tsx:308` chỉ đánh dấu bữa hoàn tất. Chưa có “nấu 2, ăn 1, giữ 1”; thay đổi khẩu phần giữa lúc nấu vẫn chưa có trạng thái mẻ đang nấu.

Đề xuất: kết thúc bữa hỏi ngắn “Đã nấu / đã dùng / còn lại”, mặc định bằng kế hoạch để không thêm thao tác thường ngày. Lưu phần còn lại thành đồ đã nấu với thời điểm riêng. Khi timer đang chạy, đổi khẩu phần cần xem tác động lên mẻ đang làm. Hướng dẫn cho phần còn lại phải dựa trên [USDA Leftovers](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety), không kế thừa thời gian bảo quản nguyên liệu sống.

### P2 — UX và khả năng sử dụng

**7. Thiếu Undo cho các thao tác mới.**

Hiện có Undo sơ chế/hoàn thành bữa, nhưng thay bữa, ghi nhận đã dùng/đã bỏ và chỉnh số người chưa có Undo nhất quán. Xác nhận bằng `confirm()` chưa giúp khôi phục một thao tác nhầm. Đề xuất lưu giao dịch trước/sau và nút “Hoàn tác”; không dùng hoàn tác để xóa lịch sử thực phẩm đã thực sự dùng. [NN/g — User Control and Freedom](https://www.nngroup.com/articles/user-control-and-freedom/) coi khả năng thoát và hoàn tác là nguyên tắc nền.

**8. Mục đồ cần sắp xếp sẽ dài khi có nhiều phần dư.**

`SavedFoodPanel` mở nhiều điều khiển trên từng card. Cần tách “đồ đã chuẩn bị”, “công thức chưa lên lịch”, “đã xử lý”; card mặc định chỉ có số phần, trạng thái và hành động chính. Gộp phần cùng lô chỉ khi cùng công thức và lịch sử bảo quản, không gộp chỉ vì trùng tên món. [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) hỗ trợ việc đưa lựa chọn phụ vào phần mở rộng; không biến hướng dẫn nấu thành chuỗi Next.

**9. Danh sách mua chưa ghi lượng mua thực tế theo quy cách gói.**

Checkbox hiện ghi lượng yêu cầu, còn gợi ý mua làm tròn chỉ là gợi ý. Mua gói 500 g khi cần 350 g chưa tạo 150 g tồn thực. Đề xuất nhập nhanh lượng thực mua và đơn vị gói, rồi hỏi phần thừa để đâu. Giữ lượng công thức chính xác; tách số lượng mua nguyên quả/quả trứng khỏi định lượng phần cần dùng. [EPA](https://www.epa.gov/recycle/preventing-wasted-food-home) nhấn mạnh lượng mua theo nhu cầu thực tế, tránh mua nhiều chỉ vì quy cách hoặc khuyến mãi.

**10. Chưa có hồ sơ dị ứng / nguyên liệu cần tránh.**

`Ingredient` chưa có metadata dị ứng; app chỉ nhắc kiểm tra ở hướng dẫn an toàn. Đề xuất hồ sơ tùy chọn theo người, chỉ rõ thành phần gây cảnh báo trong món và gia vị; khi thay món phải kiểm tra lại. Không gắn nhãn “an toàn dị ứng” chỉ từ tên nguyên liệu. [FDA Food Allergies](https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know) là nguồn tham khảo về dị ứng và đọc nhãn; danh sách pháp lý Hoa Kỳ không được coi là danh sách đầy đủ hoặc quy định Việt Nam.

**11. Chưa đảm bảo mở lại app khi mất mạng.**

`source/src/services/mealPlanService.ts:4` fetch menu trước khi khởi tạo state; repository chưa có service worker. Dữ liệu localStorage không đồng nghĩa với khả năng tải giao diện offline. Đề xuất cache app/menu, ưu tiên bản đã lưu hợp lệ, có nhãn trạng thái offline và quy trình cập nhật cache. [web.dev — Service workers](https://web.dev/learn/pwa/service-workers) mô tả cơ chế phục vụ tài nguyên khi offline.

**12. Chưa xử lý thay đổi từ tab khác hoặc người cùng nhà.**

`storageService` chỉ đọc/ghi một bản localStorage; không có xử lý `storage` event hay version conflict. Hai tab có thể ghi đè nhau. Trước mắt cảnh báo và tải thay đổi từ tab khác; đồng bộ giữa hai điện thoại là tính năng riêng cần thiết kế quyền sở hữu/chia sẻ. [MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) mô tả event để nhận thay đổi ở context khác; event đó không tạo đồng bộ giữa thiết bị.

**13. Trải nghiệm nấu cần kiểm tra khi khóa màn hình và khi cầm điện thoại trong bếp.**

Chưa có Wake Lock. Âm báo/Notification phụ thuộc phiên và trình duyệt; không hứa báo đúng giờ khi app bị đóng hoặc hệ điều hành đình chỉ. Đề xuất “Giữ màn hình sáng” tùy chọn, trả trạng thái khi không hỗ trợ và gợi ý timer hệ thống nếu cần báo nền đáng tin cậy. [MDN Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) nêu giới hạn HTTPS, visibility và khả năng bị thu hồi lock.

**14. Cần một vòng kiểm tra accessibility và thao tác thật trên mobile.**

Test hiện dùng jsdom, chưa chứng minh không tràn ngang, bàn phím số/date thuận tiện, focus sau khi card bị thay, tương phản và vùng chạm đạt yêu cầu. Đề xuất kiểm tra ít nhất 320/375/768 px, zoom 200%, keyboard và screen reader trên các luồng mới; bổ sung kiểm tra tự động cho lỗi phát hiện được. [W3C WCAG 2.2 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) có yêu cầu tối thiểu và ngoại lệ cụ thể; không kết luận đạt chuẩn chỉ vì vài control có chiều cao 44 px.

## Thứ tự đề xuất

1. Phục hồi dữ liệu không ghi đè bản lỗi; kiểm kê nguyên liệu khi sang tuần.
2. Liên kết task–ingredient và dữ liệu bảo quản theo lô.
3. Lịch ngày thống nhất, phần thực nấu/thực ăn/còn lại và Undo.
4. Lượng mua thực tế, dị ứng tùy chọn và giao diện đồ để dành gọn hơn.
5. Offline, xử lý nhiều tab, chế độ nấu và kiểm tra mobile/accessibility thực tế.

Các đề xuất này dựa trên đối chiếu sản phẩm và nguồn tham khảo, chưa được xác nhận bằng quan sát người dùng thực tế. Vòng usability tiếp theo nên dùng bốn kịch bản đã yêu cầu, thêm một kịch bản “khôi phục bữa nhưng phần đã sơ chế đang giữ cho hôm khác”.
