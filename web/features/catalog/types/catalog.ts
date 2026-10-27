export type CatalogResourceKey = 'suppliers' | 'locations' | 'categories' | 'units';

export type CatalogField = {
  name: string;
  label: string;
  required?: boolean;
  maxLength?: number;
  type?: 'text' | 'email' | 'select';
  /** Static options; the location form adds warehouses at runtime. */
  options?: readonly { value: string; label: string }[];
};

export type CatalogResource = {
  key: CatalogResourceKey;
  label: string;
  path: string;
  /** Shared by every farm (categories, units); only ADMIN may write. */
  shared: boolean;
  fields: readonly CatalogField[];
  columns: readonly { name: string; label: string }[];
};

export type CatalogRecord = Record<string, unknown> & {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
};
