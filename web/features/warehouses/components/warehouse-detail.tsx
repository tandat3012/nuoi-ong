'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Warehouse } from '../types/warehouse';
import { WAREHOUSE_STATUS_LABELS } from '../types/warehouse';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import {
  ArrowLeft,
  Pencil,
  AlertTriangle,
  ExternalLink,
  Warehouse as WarehouseIcon,
  MapPin,
  Calendar,
  Clock,
  ShieldAlert,
  Boxes,
} from 'lucide-react';

export function WarehouseDetail({
  warehouse,
  canWrite,
  isSubmitting,
  onBack,
  onEdit,
  onDeactivate,
}: {
  warehouse: Warehouse;
  canWrite: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = React.useState(false);
  const active = warehouse.status === 'ACTIVE';

  const handleConfirmDeactivate = async () => {
    setConfirmDeactivateOpen(false);
    onDeactivate();
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              disabled={isSubmitting}
              className="size-9 p-0"
              aria-label="Quay lại danh sách"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {warehouse.name}
                </h1>
                <Badge variant={active ? 'success' : 'warning'}>
                  {WAREHOUSE_STATUS_LABELS[warehouse.status]}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  Mã kho: <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-medium text-foreground">{warehouse.code}</code>
                </span>
                {warehouse.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground" />
                    <span>{warehouse.address}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/inventory?warehouseId=${warehouse.id}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-semibold text-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
            >
              <Boxes className="size-3.5 text-muted-foreground" />
              <span>Xem tồn kho</span>
              <ExternalLink className="size-3 text-muted-foreground" />
            </Link>

            {canWrite && (
              <Button
                type="button"
                size="sm"
                onClick={onEdit}
                disabled={isSubmitting}
                className="gap-1.5"
              >
                <Pencil className="size-3.5" />
                <span>Chỉnh sửa kho</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 flex items-center gap-3.5">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <WarehouseIcon className="size-5" />
          </div>
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Mã kho lưu trữ
            </p>
            <p className="mt-0.5 font-mono text-base font-bold text-foreground">
              {warehouse.code}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className={`grid size-10 place-items-center rounded-xl ${active ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
            <Boxes className="size-5" />
          </div>
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Tình trạng hoạt động
            </p>
            <p className="mt-0.5 text-sm font-bold text-foreground">
              {WAREHOUSE_STATUS_LABELS[warehouse.status]}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="grid size-10 place-items-center rounded-xl bg-info/10 text-info">
            <MapPin className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Địa điểm kho
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">
              {warehouse.address || 'Chưa cập nhật địa chỉ'}
            </p>
          </div>
        </Card>
      </div>

      {/* Two Column Layout: Main Info & Operations/Audit */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Details (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <WarehouseIcon className="size-4 text-primary" />
                <span>Thông tin chi tiết kho</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Mã kho</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {warehouse.code}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Tên kho</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {warehouse.name}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">Địa chỉ kho</dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {warehouse.address || <span className="text-muted-foreground italic">Chưa có thông tin địa chỉ</span>}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">Mô tả / Ghi chú</dt>
                  <dd className="mt-1 whitespace-pre-line text-sm text-foreground">
                    {warehouse.description || <span className="text-muted-foreground italic">Không có mô tả chi tiết</span>}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Cards (1 col) */}
        <div className="space-y-6">
          {/* Operations & Deactivation Card */}
          <Card>
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldAlert className="size-4 text-primary" />
                <span>Trạng thái & Quản trị</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Trạng thái hiện tại:</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant={active ? 'success' : 'warning'}>
                    {WAREHOUSE_STATUS_LABELS[warehouse.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {active ? 'Kho mở cho giao dịch xuất nhập' : 'Kho đang bị tạm khóa'}
                  </span>
                </div>
              </div>

              {canWrite && active && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold">Vô hiệu hóa kho</h4>
                      <p className="mt-0.5 text-[0.7rem] text-muted-foreground leading-relaxed">
                        Kho có hàng tồn hoặc tài sản đang lưu trữ sẽ không thể vô hiệu hóa.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setConfirmDeactivateOpen(true)}
                    disabled={isSubmitting}
                  >
                    Vô hiệu hóa kho này
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Metadata Card */}
          <Card>
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <span>Nhật ký hệ thống</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Calendar className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Thời gian tạo:</span>
                  <p className="font-medium text-foreground">{formatDate(warehouse.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Cập nhật lần cuối:</span>
                  <p className="font-medium text-foreground">{formatDate(warehouse.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Accessible Confirm Dialog for Deactivation */}
      <ConfirmDialog
        open={confirmDeactivateOpen}
        onOpenChange={setConfirmDeactivateOpen}
        title="Xác nhận vô hiệu hóa kho"
        description={
          <>
            Bạn có chắc chắn muốn vô hiệu hóa kho{' '}
            <strong className="text-foreground">{warehouse.name} ({warehouse.code})</strong>?
            <br />
            Kho có tồn kho hoặc tài sản liên quan sẽ không thể vô hiệu hóa theo quy tắc nghiệp vụ hệ thống.
          </>
        }
        confirmLabel="Vô hiệu hóa kho"
        cancelLabel="Hủy bỏ"
        variant="destructive"
        isLoading={isSubmitting}
        onConfirm={handleConfirmDeactivate}
      />
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
