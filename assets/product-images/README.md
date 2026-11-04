# Ảnh đối chiếu mặt hàng

Nguồn dữ liệu: 166 bản ghi trong bảng `items` của DB Docker `nuoi_ong_local` tại ngày 03/11/2026.

- 165 ảnh đã tải, tên file là `items.id` kèm phần mở rộng. Xem nhanh tại `gallery.html`.
- `manifest.csv` đối chiếu ID, mã, tên, trang nguồn và trạng thái quyền sử dụng. `visual_match_checked` nghĩa là ảnh đã được xem và thể hiện đúng loại vật phẩm; ảnh không nhất thiết đúng nhãn hàng hoặc biến thể thực tế tại kho.
- `unresolved.csv` ghi 1 mặt hàng chưa có ảnh khớp đáng tin cậy, kèm URL tài liệu tham khảo đã có trong DB khi có; một số là vật phẩm mẫu dùng kiểm thử.

20 ảnh `open_license` có thông tin giấy phép và tác giả trong manifest; hãy tuân thủ điều kiện của từng giấy phép. 145 ảnh `supplier_catalog` lấy từ các trang sản phẩm chuyên ngành và nhà sản xuất; quyền tái sử dụng **chưa được xác minh**. Cần xin phép hoặc thay bằng ảnh tự chụp/ảnh có giấy phép phù hợp trước khi dùng công khai hay tải lên Cloudinary.

Ảnh `MAT-TREAT-01` chỉ minh họa đúng loại dung dịch; nhãn hàng trong kho chưa được xác nhận.

Ảnh chỉ nằm trong thư mục này. Chưa tải lên Cloudinary, chưa gán `items.image_url` hay `store_product_images.url`, và chưa thay đổi DB.

Script nhập ảnh: từ thư mục `api`, chạy `node scripts/import-item-images.cjs --check` để kiểm tra 165 ID với DB. Khi Cloudinary kết nối thành công, chạy `node scripts/import-item-images.cjs --upload`; script bỏ qua mã kiểm thử và URL đã có, lưu kết quả vào `cloudinary-urls.csv`. Script chỉ gán `items.image_url`, không thay đổi gallery ảnh của cửa hàng trong `store_product_images`.
