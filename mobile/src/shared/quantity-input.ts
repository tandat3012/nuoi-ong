export type QuantityInputOptions = {
  allowZero?: boolean;
  max?: number;
};

/** Validate the same decimal shape accepted by the stock document API. */
export function validateQuantityInput(raw: string, options: QuantityInputOptions = {}): string | null {
  const value = raw.trim().replace(',', '.');
  if (!/^(0|[1-9]\d{0,14})(?:\.\d{1,3})?$/.test(value)) {
    return 'Nhập số không âm, tối đa 15 chữ số nguyên và 3 chữ số thập phân.';
  }
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || (!options.allowZero && quantity <= 0)) {
    return options.allowZero ? 'Số lượng phải từ 0 trở lên.' : 'Số lượng phải lớn hơn 0.';
  }
  if (options.max !== undefined && quantity > options.max) {
    return `Số lượng không được vượt tồn khả dụng (${options.max.toLocaleString('vi-VN', { maximumFractionDigits: 3, useGrouping: false })}).`;
  }
  return null;
}

export function quantityInputNumber(raw: string): number {
  return Number(raw.trim().replace(',', '.'));
}
