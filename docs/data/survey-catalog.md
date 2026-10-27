# Survey catalog seed

Nguồn: `C:/Users/LEGION/Downloads/data_KhaoSat.xlsx`, sheet `01_Danh_muc_khao_sat`.

- Seed `159` dòng có `Mức độ liên quan = Cốt lõi` vào `FARM-DEMO`.
- Mỗi item dùng mã ổn định `SURV-<STT>` để seed nhiều lần không tạo bản ghi trùng.
- `Loại chính` được ánh xạ sang `item_type`: Thiết bị → `EQUIPMENT`, Dụng cụ → `TOOL`, Vật tư → `MATERIAL`.
- Vật tư có `Lô/HSD = Có` hoặc quản lý `Tồn kho theo lô` → `LOT`; các vật tư còn lại → `QUANTITY`.
- Dụng cụ được đánh `ASSET` chỉ khi cách quản lý là cá thể/cá thể hoặc bộ; các lựa chọn mơ hồ được giữ ở `QUANTITY` để không tạo tài sản giả.
- Đơn vị ghép như `gói/kg` được chuẩn hóa về đơn vị cơ sở đầu tiên; đơn vị gốc được giữ trong mô tả item.
- Không tạo số lượng tồn, lô hoặc tài sản cho catalog khảo sát vì file không cung cấp dữ liệu thực tế.
- `source_url`, công dụng, nguồn xác thực và `surveyed_at` được lưu trên item.

Các dòng `Mở rộng` (79 dòng), lựa chọn quản lý mơ hồ và dữ liệu cần số lượng thực tế chưa được seed vào tồn kho. Có thể rà soát sau khi xác nhận quy tắc nghiệp vụ.
