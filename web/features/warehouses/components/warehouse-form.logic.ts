import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  Warehouse,
} from '../types/warehouse';

export type WarehouseFormValues = {
  code: string;
  name: string;
  address: string;
  description: string;
};

export type WarehouseFormErrors = Partial<
  Record<keyof WarehouseFormValues | 'form', string>
>;

export function getWarehouseFormInitialValues(
  warehouse?: Warehouse | null,
): WarehouseFormValues {
  return {
    code: warehouse?.code ?? '',
    name: warehouse?.name ?? '',
    address: warehouse?.address ?? '',
    description: warehouse?.description ?? '',
  };
}

export function validateWarehouseForm(values: WarehouseFormValues) {
  const errors: WarehouseFormErrors = {};
  const code = values.code.trim();
  const name = values.name.trim();
  if (!code) errors.code = 'Mã kho là bắt buộc';
  else if (code.length > 50)
    errors.code = 'Mã kho không được vượt quá 50 ký tự';
  if (!name) errors.name = 'Tên kho là bắt buộc';
  else if (name.length > 255)
    errors.name = 'Tên kho không được vượt quá 255 ký tự';
  if (values.address.trim().length > 4000)
    errors.address = 'Địa chỉ không được vượt quá 4.000 ký tự';
  if (values.description.trim().length > 4000)
    errors.description = 'Mô tả không được vượt quá 4.000 ký tự';
  return errors;
}

const normalized = (values: WarehouseFormValues): WarehouseFormValues => ({
  code: values.code.trim().toUpperCase(),
  name: values.name.trim(),
  address: values.address.trim(),
  description: values.description.trim(),
});

const nullable = (value: string) => value || null;

export function buildWarehousePayload(
  values: WarehouseFormValues,
  initialWarehouse?: Warehouse | null,
): CreateWarehouseInput | UpdateWarehouseInput | null {
  const next = normalized(values);
  if (!initialWarehouse) {
    return {
      code: next.code,
      name: next.name,
      address: nullable(next.address),
      description: nullable(next.description),
    };
  }

  const previous = normalized(getWarehouseFormInitialValues(initialWarehouse));
  const payload: UpdateWarehouseInput = {};
  if (next.code !== previous.code) payload.code = next.code;
  if (next.name !== previous.name) payload.name = next.name;
  if (next.address !== previous.address)
    payload.address = nullable(next.address);
  if (next.description !== previous.description)
    payload.description = nullable(next.description);
  return Object.keys(payload).length > 0 ? payload : null;
}
