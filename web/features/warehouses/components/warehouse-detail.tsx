'use client';

import type { Warehouse } from '../types/warehouse';
import { WAREHOUSE_STATUS_LABELS } from '../types/warehouse';

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
  const active = warehouse.status === 'ACTIVE';
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="rounded-xl border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            ← Quay lại
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                {warehouse.name}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
              >
                {WAREHOUSE_STATUS_LABELS[warehouse.status]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Mã kho:{' '}
              <span className="font-mono font-medium text-foreground">
                {warehouse.code}
              </span>
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              disabled={isSubmitting}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Chỉnh sửa
            </button>
            {active && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Bạn có chắc muốn vô hiệu hóa kho này? Kho có tồn kho hoặc tài sản sẽ không thể vô hiệu hóa.',
                    )
                  )
                    onDeactivate();
                }}
                disabled={isSubmitting}
                className="rounded-xl border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                Vô hiệu hóa kho
              </button>
            )}
          </div>
        )}
      </div>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="border-b pb-3 text-base font-semibold">Thông tin kho</h3>
        <dl className="mt-4 divide-y divide-border/60 text-sm">
          <DetailRow label="Mã kho" value={warehouse.code} mono />
          <DetailRow label="Tên kho" value={warehouse.name} />
          <DetailRow label="Địa chỉ" value={warehouse.address} />
          <DetailRow label="Mô tả" value={warehouse.description} multiline />
          <DetailRow
            label="Trạng thái"
            value={WAREHOUSE_STATUS_LABELS[warehouse.status]}
          />
          <DetailRow label="Ngày tạo" value={formatDate(warehouse.createdAt)} />
          <DetailRow
            label="Cập nhật lần cuối"
            value={formatDate(warehouse.updatedAt)}
          />
        </dl>
      </section>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`col-span-2 ${mono ? 'font-mono' : ''} ${multiline ? 'whitespace-pre-line' : ''}`}
      >
        {value || '—'}
      </dd>
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
