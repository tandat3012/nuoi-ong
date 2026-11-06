import type { CatalogField, CatalogItemRow, CatalogRecord, CatalogResource } from './types/catalog';
import { WAREHOUSE_MANAGE_ROLES, hasAnyRole } from '../auth/farm-roles.ts';

/** Who may write a resource: shared lists need ADMIN, farm lists a warehouse manager role. */
export function canWriteCatalog(resource: Pick<CatalogResource, 'shared'>, roles: readonly string[]) {
  return resource.shared ? roles.includes('ADMIN') : hasAnyRole(roles, WAREHOUSE_MANAGE_ROLES);
}

/** Form values to a request body; blank optional fields become null so they clear on edit. */
export function catalogPayload(fields: readonly CatalogField[], data: FormData) {
  const body: Record<string, string | number | null> = {};
  for (const field of fields) {
    const value = String(data.get(field.name) ?? '').trim();
    body[field.name] = !value ? (field.required ? '' : null) : field.type === 'number' ? Number(value) : value;
  }
  return body;
}

export function catalogFieldValue(record: CatalogRecord | null, name: string) {
  const value = record?.[name];
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/** Adds the record's current value when the active-only options no longer list it. */
export function withCurrentOption(options: readonly { value: string; label: string }[], value: string, name: string) {
  return !value || options.some((option) => option.value === value)
    ? options
    : [...options, { value, label: `${name || 'Đang chọn'} (đã ngưng)` }];
}

/** `/items` rows nest the item next to its category and unit names; the table wants one flat record. */
export function flattenCatalogItem(row: CatalogItemRow): CatalogRecord {
  return { ...row.item, categoryName: row.categoryName, unitName: row.unitName };
}

export function catalogError(failure: unknown): string {
  if (!failure || typeof failure !== 'object' || !('status' in failure))
    return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  const details = 'details' in failure ? (failure.details as { message?: string | string[] } | undefined) : undefined;
  const message = Array.isArray(details?.message) ? details.message.join(', ') : details?.message ?? '';
  switch (failure.status) {
    case 401: return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 403: return 'Bạn không có quyền sửa danh mục này.';
    case 404: return 'Bản ghi không tồn tại hoặc thuộc trang trại khác.';
    case 409: return message.includes('holds assets')
      ? 'Vị trí đang chứa tài sản. Hãy điều chuyển tài sản sang vị trí khác trước khi đổi kho hoặc ngưng vị trí.'
      : message.includes('Tracking mode')
        ? 'Không đổi được cách theo dõi vì mặt hàng đã có tồn kho hoặc tài sản.'
        : 'Mã đã tồn tại, vui lòng dùng mã khác.';
    case 400: return message.includes('storefront')
      ? 'Mặt hàng đang gắn với sản phẩm cửa hàng: phải giữ đơn vị tính, và chỉ theo dõi từng cá thể khi bước số lượng bán là 1.'
      : `Dữ liệu không hợp lệ${message ? `: ${message}` : '.'}`;
    default: return 'Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.';
  }
}
