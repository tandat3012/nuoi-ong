# Bộ công cụ Quản lý & Đồng bộ Ảnh Sản phẩm (Python Tools)

Bộ công cụ nằm trong thư mục `tools/` phục vụ việc tự động hóa tìm kiếm, kiểm tra, chuẩn hóa và đồng bộ ảnh vật tư lên Cloudinary và cơ sở dữ liệu PostgreSQL Docker.

## 1. Cài đặt môi trường
Đảm bảo đã cài đặt các thư viện cần thiết trong Python:
```bash
pip install icrawler pillow imagehash requests python-dotenv
```

## 2. Các lệnh sử dụng qua `image_tool.py`

### 2.1. Kiểm tra đối chiếu trước khi tải lên (`check`)
Kiểm tra xem 165 ảnh trong `assets/product-images/` có khớp với các bản ghi trong bảng `items` của cơ sở dữ liệu Docker hay không:
```bash
python tools/image_tool.py check
```

### 2.2. Tải ảnh lên Cloudinary và cập nhật Database (`upload`)
Đọc cấu hình trong `api/.env` (`CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`):
```bash
# Tải các ảnh chưa có URL
python tools/image_tool.py upload

# Hoặc khi đổi sang tài khoản Cloudinary mới (ép tải lại toàn bộ và ghi đè URL mới vào DB):
python tools/image_tool.py upload --force
```

### 2.3. Tạo lại trang xem trước HTML Gallery (`process`)
Xuất file `assets/product-images/gallery.html` để kiểm tra trực quan toàn bộ 165 ảnh:
```bash
python tools/image_tool.py process
```

### 2.4. Tìm kiếm và cào ảnh mới (`crawl`)
Tự động tìm và cào ảnh vật tư từ internet:
```bash
python tools/image_tool.py crawl --query "Bộ thùng ong Langstroth" --max 1
```

## 3. Nghiên cứu danh mục mới và ảnh ứng viên (không ghi DB/Cloudinary)

`catalog_research.py` là luồng staging riêng. Nó không thay thế hay tự chạy các lệnh upload ảnh cũ. CSV baseline hiện được ghi nhận từ DB Docker ngày 03/11/2026; trước khi sử dụng phải cập nhật từ DB đang chạy để quota và phát hiện trùng không dựa trên snapshot cũ. Từ baseline 166, phân bổ thêm 400 để tổng gần cân bằng theo **tracking_mode** là `QUANTITY +84`, `LOT +163`, `ASSET +153`, dự kiến tổng cuối lần lượt `189 / 189 / 188`. Đây là mục tiêu số lượng ứng viên, không có nghĩa 400 dòng sẽ được tự duyệt.

### Ảnh cho 400 ứng viên đã có trong CSV

`stage_candidate_images.py` đọc riêng `new-item-candidates.csv`, ưu tiên ghép model/tên với trang nhà cung cấp đã ghi trong CSV. Nếu trang đó không có kết quả rõ, dùng lại feeder/parser `icrawler`/Bing như `crawl_product_images.py`, truy vấn theo model và tên từng ứng viên. Bing chỉ trả metadata tiêu đề/URL để chấm độ khớp; chương trình tải tối đa một ảnh được chọn, thử tối đa ba URL nếu host từ chối, rồi mới tìm Openverse/Wikimedia Commons. Mỗi lượt Bing chạy trong tiến trình riêng, có timeout; lỗi HTTP hoặc host chậm chỉ bỏ qua ứng viên đó. CSV được checkpoint sau từng ứng viên nên có thể chạy lại để tiếp tục, còn ảnh không có tiêu đề khớp ngưỡng được ghi vào `image-unresolved.csv`. Kết quả Bing lưu nguồn ảnh, trang gốc và tiêu đề kết quả nhưng quyền ảnh ở trạng thái `unverified`; mọi ảnh đều cần rà hình và quyền trước khi dùng.

```powershell
python tools/stage_candidate_images.py
```

Kết quả nằm trong `image-discovery.csv`, `image-candidates.csv`, `image-unresolved.csv`, thư mục `candidates/` và gallery riêng `gallery-review.html`. Lệnh xác nhận 400 ứng viên và 166 dòng baseline trước khi chạy; không sửa `new-item-candidates.csv`, `items-catalog.csv`, DB, Cloudinary hoặc `gallery.html`. Có thể chỉ dùng Bing bằng `--providers bing`; Pinterest chỉ tạo link tìm thủ công, không crawler tự động. Không chạy `image_tool.py upload` cho ảnh ứng viên.

```powershell
python tools/catalog_research.py balance --add 400 --groups QUANTITY,LOT,ASSET
```

Làm mới baseline (ghi đè `items-catalog.csv` bằng dữ liệu DB đã kết nối trong `api/.env`):

```powershell
node tools/export_items_csv.cjs
```

Kiểm tra kết quả xuất và phân bổ trước khi cào. Không chạy lệnh này nếu `DATABASE_URL` đang trỏ nhầm DB.

Khai báo nguồn trong `tools/catalog-sources.csv` theo từng danh mục hẹp. Cột `sitemap_url` cũng nhận URL trang danh mục HTML; khi đó crawler lấy các liên kết cùng miền, rồi chỉ mở URL khớp `product_url_regex`. Có thể khai báo `pagination_url_regex` (regex khớp path và query, ví dụ tham số trang) để crawler lần theo các trang kế tiếp, với giới hạn `--max-pages`. Trước khi dùng nguồn cần kiểm tra điều khoản và `robots.txt`; script tự kiểm tra robots cho cả trang danh mục, trang phân trang, trang sản phẩm và ảnh, đồng thời bỏ qua khi không đọc được hoặc bị chặn. Chỉ dùng trang sản phẩm thực; không coi bài Wikipedia, báo chí hay bài nghiên cứu là hồ sơ hàng hóa.

Phân loại `item_type`, `tracking_mode`, `category_code` và `unit_code` trong file nguồn là quy tắc gán tạm cho từng sitemap. Một sitemap thường trộn thiết bị, dụng cụ, vật tư và nhiều đơn vị tính; vì vậy chỉ cấu hình một quy tắc cho sitemap khi các sản phẩm trong đó thực sự cùng loại. Chia nguồn theo sitemap/category hoặc bổ sung bước rà soát thủ công trước khi import. Mã loại và tên hiện có lấy từ CSV baseline; không phát sinh category/unit mới tự động.

```powershell
# Quét trang sản phẩm theo từng nhóm, 20 trang/lô, nghỉ 8 giây giữa các lô.
# Có thể tăng thời gian nghỉ với --request-delay/--batch-pause.
python tools/catalog_research.py crawl-products --tracking-mode QUANTITY --limit 84 --batch-size 20 --batch-pause 8
python tools/catalog_research.py crawl-products --tracking-mode LOT --limit 163 --batch-size 20 --batch-pause 8
python tools/catalog_research.py crawl-products --tracking-mode ASSET --limit 153 --batch-size 20 --batch-pause 8

# Tải ảnh được khai báo trên đúng trang sản phẩm về assets/product-images/candidates/.
python tools/catalog_research.py download-images --tracking-mode QUANTITY
python tools/catalog_research.py download-images --tracking-mode LOT
python tools/catalog_research.py download-images --tracking-mode ASSET

# Tạo gallery rà soát tách biệt; không ghi đè gallery.html đang dùng.
python tools/catalog_research.py gallery

# Nghiên cứu thư mục (Wikidata/OpenAlex/Crossref), không tạo mặt hàng.
python tools/catalog_research.py references --queries assets/product-images/research-queries.example.csv
```

`--limit` là tổng số ứng viên đã ghi trong file ứng viên cho mode đó, không phải số cần thêm trong lần chạy đơn lẻ. Crawler xử lý tuần tự theo lô, chờ `--request-delay` giữa request và `--batch-pause` sau mỗi `--batch-size` trang. Khi gặp HTTP 429, crawler dừng nguồn đó và chuyển sang nguồn kế tiếp; không retry dồn. Mặc định nguồn có robots không đọc được sẽ bị bỏ qua; có thể bật `--allow-unreadable-robots` để tiếp tục trong trường hợp này. Tùy chọn này vẫn tôn trọng `Disallow` nếu đọc được và không vượt 429. Lệnh bỏ qua tên trùng, mã trùng, barcode trùng; chỉ lưu Product JSON-LD và ảnh đính kèm trang tương ứng. Tất cả ứng viên được gắn `pending_product_review`, ảnh được gắn `pending_visual_review` và `rights_status=unverified`. Tên sản phẩm, model/SKU, biến thể, category/unit, hình đúng sản phẩm, nguồn, giấy phép và quyền tái sử dụng phải được duyệt; ảnh nhà cung cấp không được tự hiểu là có quyền đăng lại.

Nguồn để nghiên cứu phân loại và tên gọi: Wikipedia/Wikidata; tài liệu kỹ thuật của cơ quan/hiệp hội nuôi ong; bài báo và tạp chí chuyên ngành; cơ sở dữ liệu thư mục như OpenAlex/Crossref/AGRIS. Các nguồn này chỉ cung cấp ngữ cảnh, không phải bằng chứng tồn kho hay nguồn ảnh sản phẩm. Trình thu thập thư mục chỉ lưu metadata/tham chiếu và không sao chép nội dung bài viết.

Quy trình kết thúc ở staging + gallery. Chỉ sau khi duyệt đủ 400 hồ sơ, ánh xạ đúng enum/category/unit và xác minh quyền ảnh mới chuyển sang bước import DB và Cloudinary riêng. Không chạy `image_tool.py upload` với ảnh ứng viên chưa duyệt.
