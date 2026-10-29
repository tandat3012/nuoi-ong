import type { CatalogField, CatalogRecord, CatalogResource } from './types/catalog';

/** Who may write a resource: shared lists need ADMIN, farm lists need ADMIN or FARM_OWNER. */
export function canWriteCatalog(resource: Pick<CatalogResource, 'shared'>, roles: readonly string[]) {
  return resource.shared ? roles.includes('ADMIN') : roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER');
}

/** Form values to a request body; blank optional fields become null so they clear on edit. */
export function catalogPayload(fields: readonly CatalogField[], data: FormData) {
  const body: Record<string, string | null> = {};
  for (const field of fields) {
    const value = String(data.get(field.name) ?? '').trim();
    body[field.name] = value || (field.required ? '' : null);
  }
  return body;
}

export function catalogFieldValue(record: CatalogRecord | null, name: string) {
  const value = record?.[name];
  return typeof value === 'string' ? value : '';
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
      : 'Mã đã tồn tại, vui lòng dùng mã khác.';
    case 400: return `Dữ liệu không hợp lệ${message ? `: ${message}` : '.'}`;
    default: return 'Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.';
  }
}
