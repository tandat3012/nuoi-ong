export type CatalogResourceKey = 'suppliers' | 'locations' | 'items' | 'categories' | 'units';

export type CatalogField = {
  name: string;
  label: string;
  required?: boolean;
  maxLength?: number;
  type?: 'text' | 'email' | 'number' | 'select';
  /** Prefilled when creating a record. */
  defaultValue?: string;
  /** Static options; warehouses, categories and units are loaded at runtime. */
  options?: readonly { value: string; label: string }[];
};

export type CatalogResource = {
  key: CatalogResourceKey;
  label: string;
  path: string;
  /** Extra list filters, e.g. only equipment/tool items. */
  query?: Record<string, string>;
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

/** A `/items` list row: the item plus its category and unit names. */
export type CatalogItemRow = { item: CatalogRecord; categoryName?: string; unitName?: string };
