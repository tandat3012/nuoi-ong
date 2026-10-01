'use client';

import type { Warehouse, WarehouseFilterParams } from '../types/warehouse';
import { WAREHOUSE_STATUS_LABELS } from '../types/warehouse';

export function WarehouseTable({
  warehouses,
  filters,
  canWrite,
  isLoading,
  errorMessage,
  onStartCreate,
  onViewDetail,
  onStartEdit,
}: {
  warehouses: Warehouse[];
  filters: WarehouseFilterParams;
  canWrite: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  onStartCreate: () => void;
  onViewDetail: (warehouse: Warehouse) => void;
  onStartEdit: (warehouse: Warehouse) => void;
}) {
  const hasFilters = Boolean(filters.search || filters.status);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3.5" scope="col">
              Mã kho
            </th>
            <th className="px-4 py-3.5" scope="col">
              Tên kho
            </th>
            <th className="px-4 py-3.5" scope="col">
              Địa chỉ
            </th>
            <th className="px-4 py-3.5 text-center" scope="col">
              Trạng thái
            </th>
            <th className="px-4 py-3.5 text-right" scope="col">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {isLoading ? (
            <tr>
              <td
                colSpan={5}
                className="py-12 text-center text-muted-foreground"
              >
                <span role="status">Đang tải danh sách kho...</span>
              </td>
            </tr>
          ) : errorMessage ? (
            <tr>
              <td colSpan={5} className="py-12 text-center">
                Không thể hiển thị danh sách kho.
              </td>
            </tr>
          ) : warehouses.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-16 text-center">
                <p className="font-semibold text-foreground">
                  {hasFilters
                    ? 'Không tìm thấy kho phù hợp'
                    : 'Chưa có kho nào trong trang trại'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasFilters
                    ? 'Thử điều chỉnh từ khóa hoặc bộ lọc.'
                    : 'Bắt đầu bằng cách thêm kho đầu tiên cho trang trại.'}
                </p>
                {canWrite && !hasFilters && (
                  <button
                    type="button"
                    onClick={onStartCreate}
                    className="mt-3 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    + Thêm kho mới
                  </button>
                )}
              </td>
            </tr>
          ) : (
            warehouses.map((warehouse) => (
              <tr
                key={warehouse.id}
                className="transition-colors hover:bg-muted/40"
              >
                <td className="px-4 py-3.5 font-mono text-xs font-medium">
                  {warehouse.code}
                </td>
                <td className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => onViewDetail(warehouse)}
                    className="text-left font-medium hover:text-primary hover:underline"
                  >
                    {warehouse.name}
                  </button>
                </td>
                <td className="max-w-xs truncate px-4 py-3.5 text-muted-foreground">
                  {warehouse.address || '—'}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${warehouse.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/20'}`}
                  >
                    {WAREHOUSE_STATUS_LABELS[warehouse.status]}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onViewDetail(warehouse)}
                      className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted focus-visible:ring-2"
                    >
                      Chi tiết
                    </button>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => onStartEdit(warehouse)}
                        className="rounded-lg border px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted focus-visible:ring-2"
                      >
                        Sửa
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
