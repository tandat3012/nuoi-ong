'use client';

import * as React from 'react';
import type {
  Warehouse,
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from '../types/warehouse';
import {
  buildWarehousePayload,
  getWarehouseFormInitialValues,
  type WarehouseFormErrors,
  type WarehouseFormValues,
  validateWarehouseForm,
} from './warehouse-form.logic';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ErrorAlert } from '@/shared/components/ui/error-alert';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { Save, ArrowLeft, Building2 } from 'lucide-react';

export function WarehouseForm({
  mode,
  farmName,
  initialWarehouse,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit';
  farmName: string;
  initialWarehouse?: Warehouse | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (
    payload: CreateWarehouseInput | UpdateWarehouseInput,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = React.useState<WarehouseFormValues>(() =>
    getWarehouseFormInitialValues(initialWarehouse),
  );
  const [errors, setErrors] = React.useState<WarehouseFormErrors>({});
  const [confirmCancelOpen, setConfirmCancelOpen] = React.useState(false);

  const isEdit = mode === 'edit';

  const isDirty = React.useMemo(() => {
    const initial = getWarehouseFormInitialValues(initialWarehouse);
    return (
      values.code !== initial.code ||
      values.name !== initial.name ||
      values.address !== initial.address ||
      values.description !== initial.description
    );
  }, [values, initialWarehouse]);

  const handleCancelClick = () => {
    if (isDirty) {
      setConfirmCancelOpen(true);
    } else {
      onCancel();
    }
  };

  const handleFieldChange = (field: keyof WarehouseFormValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) {
      setErrors((previous) => {
        const next = { ...previous };
        delete next[field];
        return next;
      });
    }
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validateWarehouseForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = buildWarehousePayload(values, initialWarehouse);
    if (!payload) {
      setErrors({ form: 'Chưa có thay đổi nào để lưu.' });
      return;
    }

    setErrors({});
    await onSubmit(payload);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Top Header Card */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelClick}
                disabled={isSubmitting}
                className="size-9 p-0"
                aria-label="Quay lại danh sách"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {isEdit ? 'Cập nhật kho lưu trữ' : 'Đăng ký kho mới'}
                  </h1>
                  <Badge variant="secondary" className="font-semibold">
                    {farmName}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {isEdit
                    ? 'Chỉnh sửa thông tin địa điểm và mô tả kho trong trang trại.'
                    : 'Thiết lập kho mới phục vụ quản lý xuất nhập và bảo quản vật tư nông nghiệp.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelClick}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                className="gap-1.5"
              >
                <Save className="size-3.5" />
                <span>{isEdit ? 'Lưu thay đổi' : 'Tạo kho'}</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* Form-level Error Alert */}
        {(errorMessage || errors.form) && (
          <ErrorAlert message={errorMessage || errors.form || ''} />
        )}

        {/* Main Details Card */}
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <span>Thông tin kho</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Các trường đánh dấu <span className="text-destructive font-bold">*</span> là bắt buộc.
            </p>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Code */}
              <div>
                <label
                  htmlFor="warehouse-code"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Mã kho <span className="text-destructive">*</span>
                </label>
                <Input
                  id="warehouse-code"
                  value={values.code}
                  maxLength={50}
                  placeholder="Ví dụ: KHO-THUOC-01"
                  onChange={(event) => handleFieldChange('code', event.target.value)}
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-invalid={Boolean(errors.code)}
                  aria-describedby={errors.code ? 'warehouse-code-error' : undefined}
                />
                {errors.code && (
                  <p
                    id="warehouse-code-error"
                    role="alert"
                    className="mt-1 text-xs text-destructive font-medium"
                  >
                    {errors.code}
                  </p>
                )}
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  Mã định danh duy nhất (tối đa 50 ký tự, tự động viết hoa).
                </p>
              </div>

              {/* Name */}
              <div>
                <label
                  htmlFor="warehouse-name"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Tên kho <span className="text-destructive">*</span>
                </label>
                <Input
                  id="warehouse-name"
                  value={values.name}
                  maxLength={255}
                  placeholder="Ví dụ: Kho Vật Tư Nông Nghiệp Khu A"
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'warehouse-name-error' : undefined}
                />
                {errors.name && (
                  <p
                    id="warehouse-name-error"
                    role="alert"
                    className="mt-1 text-xs text-destructive font-medium"
                  >
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="warehouse-address"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Địa chỉ kho
                </label>
                <Input
                  id="warehouse-address"
                  value={values.address}
                  maxLength={4000}
                  placeholder="Ví dụ: Lô B2, Khu chế biến trung tâm trang trại"
                  onChange={(event) => handleFieldChange('address', event.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.address)}
                  aria-describedby={errors.address ? 'warehouse-address-error' : undefined}
                />
                {errors.address && (
                  <p
                    id="warehouse-address-error"
                    role="alert"
                    className="mt-1 text-xs text-destructive font-medium"
                  >
                    {errors.address}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="warehouse-description"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Mô tả / Ghi chú
                </label>
                <Textarea
                  id="warehouse-description"
                  rows={4}
                  value={values.description}
                  maxLength={4000}
                  placeholder="Mô tả chức năng kho, điều kiện nhiệt độ hoặc lưu ý an toàn..."
                  onChange={(event) => handleFieldChange('description', event.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={
                    errors.description ? 'warehouse-description-error' : undefined
                  }
                />
                {errors.description && (
                  <p
                    id="warehouse-description-error"
                    role="alert"
                    className="mt-1 text-xs text-destructive font-medium"
                  >
                    {errors.description}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Confirmation Dialog on Unsaved Cancel */}
      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Rời khỏi biểu mẫu?"
        description="Bạn có các thay đổi chưa được lưu. Nếu rời đi bây giờ, toàn bộ dữ liệu vừa nhập sẽ bị mất."
        confirmLabel="Rời đi"
        cancelLabel="Tiếp tục chỉnh sửa"
        variant="destructive"
        onConfirm={() => {
          setConfirmCancelOpen(false);
          onCancel();
        }}
      />
    </>
  );
}
