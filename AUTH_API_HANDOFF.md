## Phần dùng chung đã có

- `useAuthenticatedRequest()` tự lấy Clerk token, gọi Axios và trả **response body**. Không cần tạo Axios instance, gọi lại `/auth/me` hoặc tự gắn token trong từng module.

## Cách gọi API

```tsx
"use client";

import { useAuthenticatedRequest } from "@/features/auth";
import { useAuthContext } from "@/features/auth/context/auth-context";
import { ApiError } from "@/shared/api/client";

// Bên trong component hoặc custom hook của module:
const request = useAuthenticatedRequest();
const { data: auth, selectedFarmId } = useAuthContext();
const membership = auth.memberships.find(
  ({ farm }) => farm.id === selectedFarmId,
);
const canWrite =
  membership?.roles.some((role) => role === "ADMIN" || role === "FARM_OWNER") ??
  false;
```

Ví dụ kho, đặt trong hàm tải dữ liệu hoặc event handler; không gọi request trực tiếp khi render:

```ts
// Các đoạn dưới là ví dụ riêng. Kiểm tra farm trước mỗi thao tác.
if (!selectedFarmId) return;

type Warehouse = { id: string; code: string; name: string };
type WarehouseList = {
  data: Warehouse[];
  page: {
    number: number;
    size: number;
    totalItems: number;
    totalPages: number;
  };
};

const result = await request<WarehouseList>("/warehouses", {
  params: { farmId: selectedFarmId, page: 1, pageSize: 20 },
});
// result.data là danh sách; result.page là thông tin phân trang.

const created = await request<{ data: Warehouse }>("/warehouses", {
  method: "POST",
  params: { farmId: selectedFarmId },
  data: { code: "WH-NEW", name: "Kho mới" },
});

await request<{ data: Warehouse }>(`/warehouses/${created.data.id}`, {
  method: "PATCH",
  params: { farmId: selectedFarmId },
  data: { name: "Kho đã cập nhật" },
});
```

Vật tư dùng tương tự với `/materials` và `/materials/:id`; khai báo type/body theo `api/src/modules/materials/` và DTO thực tế. Không dùng type `Warehouse` cho vật tư.

**Lưu ý contract:** `PaginatedResponse` hiện trong `web/shared/api/contracts.ts` chưa khớp kiểu `page` dạng object của API kho/vật tư. Định nghĩa type đúng response trước khi dùng; generic `<T>` không kiểm tra JSON lúc runtime.

## Khi đổi trại và khi gặp lỗi

- Effect tải danh sách phải theo dõi `selectedFarmId`, filter và phân trang. Đổi trại phải reset trang, dữ liệu/form cũ và bỏ response đến muộn của trại trước (cleanup effect hoặc abort). Provider không tự tải lại dữ liệu module.
- Dùng `canWrite` để ẩn/khóa action ghi; backend vẫn kiểm tra quyền trên từng request.
- Bắt lỗi async tại module. `401` đã được lớp chung chuyển về sign-in; `403` hiển thị không có quyền và giữ session; `400` hiển thị validation; `409` hiển thị xung đột như code trùng hoặc `WAREHOUSE_NOT_EMPTY`; lỗi mạng cho phép thử lại.

```ts
// Trong catch của hàm tải/submit; setError là state thông báo của module.
if (error instanceof ApiError) {
  if (error.status !== 401) {
    setError(
      error.status === 403 ? "Bạn không có quyền thực hiện." : error.message,
    );
  }
} else {
  setError("Có lỗi xảy ra, vui lòng thử lại.");
}
```

## Chuẩn bị local và bàn giao

Chạy `make db-up`, `make db-migrate`, `make db-seed`; mở hai terminal chạy `make be` và `make fe`.

User seed không phải tài khoản Clerk thật. User Clerk của mỗi thành viên cần được gán membership/role trong DB local để test. Chưa có membership sẽ thấy thông báo chưa được cấp quyền.

Trước PR: thử đổi trại, reload, quyền chủ trại so với nhân viên/khách, dữ liệu rỗng và lỗi API. Chạy lint/type-check/build và test liên quan. Chỉ báo hoàn thành khi thao tác ghi và dữ liệu hiển thị đều thuộc đúng trại đang chọn.
