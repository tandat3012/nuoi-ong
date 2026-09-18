'use client';

import { useState } from 'react';
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
  const [values, setValues] = useState<WarehouseFormValues>(() =>
    getWarehouseFormInitialValues(initialWarehouse),
  );
  const [errors, setErrors] = useState<WarehouseFormErrors>({});
  const isEdit = mode === 'edit';
  const set = (field: keyof WarehouseFormValues, value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }));

  async function submit(event: React.FormEvent) {
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
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              {isEdit ? 'Cập nhật kho' : 'Thêm kho mới'}
            </h2>
            <span className="rounded-full bg-secondary px-3 py-0.5 text-xs font-medium text-secondary-foreground">
              {farmName}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {isEdit
              ? 'Chỉnh sửa thông tin kho trong trang trại hiện tại.'
              : 'Đăng ký kho lưu trữ cho trang trại.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo kho'}
          </button>
        </div>
      </div>
      {(errorMessage || errors.form) && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {errorMessage || errors.form}
        </div>
      )}
      <fieldset
        disabled={isSubmitting}
        className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      >
        <legend className="px-2 text-base font-semibold">Thông tin kho</legend>
        <p className="mb-4 text-xs text-muted-foreground">
          Các trường đánh dấu{' '}
          <span className="font-bold text-destructive">*</span> là bắt buộc.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="warehouse-code"
            label="Mã kho"
            required
            value={values.code}
            error={errors.code}
            maxLength={50}
            onChange={(value) => set('code', value)}
          />
          <Field
            id="warehouse-name"
            label="Tên kho"
            required
            value={values.name}
            error={errors.name}
            maxLength={255}
            onChange={(value) => set('name', value)}
          />
          <div className="sm:col-span-2">
            <Field
              id="warehouse-address"
              label="Địa chỉ"
              value={values.address}
              error={errors.address}
              maxLength={4000}
              onChange={(value) => set('address', value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="warehouse-description"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Mô tả
            </label>
            <textarea
              id="warehouse-description"
              rows={5}
              value={values.description}
              maxLength={4000}
              onChange={(event) => set('description', event.target.value)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? 'warehouse-description-error' : undefined
              }
              className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-2"
            />
            {errors.description && (
              <p
                id="warehouse-description-error"
                role="alert"
                className="mt-1 text-xs text-destructive"
              >
                {errors.description}
              </p>
            )}
          </div>
        </div>
      </fieldset>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  value,
  error,
  maxLength,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-2"
      />
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
