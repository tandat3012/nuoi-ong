'use client';

import * as React from 'react';
import type { Warehouse, WarehouseFilterParams } from '../types/warehouse';
import { WAREHOUSE_STATUS_LABELS } from '../types/warehouse';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Warehouse as WarehouseIcon, Eye, Edit } from 'lucide-react';
import { BeeLoader } from '@/shared/components/ui/bee-loader';

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
    <Table className="min-w-[640px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-36 font-semibold uppercase tracking-wider text-[0.7rem]">
            Mã kho
          </TableHead>
          <TableHead className="font-semibold uppercase tracking-wider text-[0.7rem]">
            Tên kho
          </TableHead>
          <TableHead className="font-semibold uppercase tracking-wider text-[0.7rem]">
            Địa chỉ
          </TableHead>
          <TableHead className="w-32 text-center font-semibold uppercase tracking-wider text-[0.7rem]">
            Trạng thái
          </TableHead>
          <TableHead className="w-36 text-right font-semibold uppercase tracking-wider text-[0.7rem]">
            Thao tác
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
              <BeeLoader label="Đang tải danh sách kho..." size="sm" />
            </TableCell>
          </TableRow>
        ) : errorMessage ? (
          <TableRow>
            <TableCell colSpan={5} className="py-12 text-center text-destructive">
              Không thể hiển thị danh sách kho.
            </TableCell>
          </TableRow>
        ) : warehouses.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="p-0">
              <EmptyState
                icon={WarehouseIcon}
                title={hasFilters ? 'Không tìm thấy kho phù hợp' : 'Chưa có kho nào trong trang trại'}
                description={
                  hasFilters
                    ? 'Thử điều chỉnh từ khóa hoặc bộ lọc.'
                    : 'Bắt đầu bằng cách thêm kho đầu tiên cho trang trại.'
                }
                action={
                  canWrite && !hasFilters ? (
                    <Button size="sm" onClick={onStartCreate}>
                      + Thêm kho mới
                    </Button>
                  ) : undefined
                }
              />
            </TableCell>
          </TableRow>
        ) : (
          warehouses.map((warehouse) => (
            <TableRow key={warehouse.id}>
              <TableCell className="font-mono text-xs font-semibold text-foreground">
                {warehouse.code}
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => onViewDetail(warehouse)}
                  className="text-left font-medium text-foreground transition-colors hover:text-primary hover:underline cursor-pointer"
                >
                  {warehouse.name}
                </button>
              </TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground text-xs">
                {warehouse.address || '—'}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={warehouse.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {WAREHOUSE_STATUS_LABELS[warehouse.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1"
                    onClick={() => onViewDetail(warehouse)}
                  >
                    <Eye className="size-3" aria-hidden="true" />
                    <span>Chi tiết</span>
                  </Button>
                  {canWrite && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1 text-primary hover:text-primary"
                      onClick={() => onStartEdit(warehouse)}
                    >
                      <Edit className="size-3" aria-hidden="true" />
                      <span>Sửa</span>
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
