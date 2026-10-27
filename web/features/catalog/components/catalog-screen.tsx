'use client';

import { useEffect, useState } from 'react';

import { useAuthContext, useAuthenticatedRequest } from '@/features/auth';
import { getWarehouses } from '@/features/warehouses/api/warehouses.api';
import type { PageInfo } from '@/shared/api/contracts';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ErrorAlert } from '@/shared/components/ui/error-alert';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { Input } from '@/shared/components/ui/input';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Pagination } from '@/shared/components/ui/pagination';
import { Select } from '@/shared/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { getCatalogRecords, saveCatalogRecord } from '../api/catalog.api';
import { canWriteCatalog, catalogError, catalogFieldValue, catalogPayload } from '../catalog.logic';
import type { CatalogField, CatalogRecord, CatalogResource, CatalogResourceKey } from '../types/catalog';

const LOCATION_TYPES = [
  ['WAREHOUSE', 'Kho'],
  ['WAREHOUSE_ZONE', 'Khu trong kho'],
  ['APIARY', 'Bãi ong'],
  ['SITE', 'Địa điểm'],
  ['IN_USE', 'Đang sử dụng'],
  ['MAINTENANCE', 'Bảo trì'],
  ['OTHER', 'Khác'],
].map(([value, label]) => ({ value, label }));

const code = (maxLength: number): CatalogField => ({ name: 'code', label: 'Mã', required: true, maxLength });
const name = (maxLength: number): CatalogField => ({ name: 'name', label: 'Tên', required: true, maxLength });

const RESOURCES: readonly CatalogResource[] = [
  {
    key: 'suppliers', label: 'Nhà cung cấp', path: '/suppliers', shared: false,
    fields: [code(50), name(255), { name: 'phone', label: 'Điện thoại', maxLength: 50 }, { name: 'email', label: 'Email', type: 'email', maxLength: 255 }, { name: 'address', label: 'Địa chỉ', maxLength: 4000 }, { name: 'note', label: 'Ghi chú', maxLength: 4000 }],
    columns: [{ name: 'code', label: 'Mã' }, { name: 'name', label: 'Tên' }, { name: 'phone', label: 'Điện thoại' }, { name: 'email', label: 'Email' }],
  },
  {
    key: 'locations', label: 'Vị trí', path: '/locations', shared: false,
    fields: [code(50), name(255), { name: 'type', label: 'Loại vị trí', required: true, type: 'select', options: LOCATION_TYPES }, { name: 'warehouseId', label: 'Thuộc kho', type: 'select' }, { name: 'description', label: 'Mô tả', maxLength: 4000 }],
    columns: [{ name: 'code', label: 'Mã' }, { name: 'name', label: 'Tên' }, { name: 'type', label: 'Loại' }, { name: 'warehouseId', label: 'Kho' }],
  },
  {
    key: 'categories', label: 'Nhóm hàng', path: '/categories', shared: true,
    fields: [code(50), name(255), { name: 'description', label: 'Mô tả', maxLength: 4000 }],
    columns: [{ name: 'code', label: 'Mã' }, { name: 'name', label: 'Tên' }, { name: 'description', label: 'Mô tả' }],
  },
  {
    key: 'units', label: 'Đơn vị tính', path: '/units', shared: true,
    fields: [code(30), name(100), { name: 'symbol', label: 'Ký hiệu', maxLength: 30 }],
    columns: [{ name: 'code', label: 'Mã' }, { name: 'name', label: 'Tên' }, { name: 'symbol', label: 'Ký hiệu' }],
  },
];

export function CatalogScreen() {
  const { selectedFarmId, data, isLoading, error } = useAuthContext();
  const [tab, setTab] = useState<CatalogResourceKey>('suppliers');
  if (isLoading) return <p role="status">Đang tải thông tin trang trại…</p>;
  if (error) return <ErrorAlert message="Không thể tải quyền truy cập trang trại. Vui lòng tải lại trang." />;
  if (!selectedFarmId) return <p role="status">Vui lòng chọn trang trại để xem danh mục.</p>;
  const roles = data.memberships.find(({ farm }) => farm.id === selectedFarmId)?.roles ?? [];
  const resource = RESOURCES.find(({ key }) => key === tab)!;
  return (
    <div className="space-y-6">
      <PageHeader title="Danh mục" description="Nhà cung cấp và vị trí theo trang trại; nhóm hàng và đơn vị tính dùng chung, chỉ quản trị viên được sửa." />
      <div role="tablist" aria-label="Loại danh mục" className="flex flex-wrap gap-2">
        {RESOURCES.map(({ key, label }) => (
          <Button key={key} role="tab" aria-selected={tab === key} variant={tab === key ? 'default' : 'outline'} onClick={() => setTab(key)}>{label}</Button>
        ))}
      </div>
      <CatalogTable key={`${selectedFarmId}:${tab}`} farmId={selectedFarmId} resource={resource} canWrite={canWriteCatalog(resource, roles)} />
    </div>
  );
}

function CatalogTable({ farmId, resource, canWrite }: { farmId: string; resource: CatalogResource; canWrite: boolean }) {
  const request = useAuthenticatedRequest();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ rows: CatalogRecord[]; page: PageInfo; error?: string } | null>(null);
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [editing, setEditing] = useState<CatalogRecord | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void getCatalogRecords(request, resource, farmId, page, search)
        .then((response) => { if (!cancelled) setResult({ rows: response.data, page: response.page }); })
        .catch((failure: unknown) => { if (!cancelled) setResult({ rows: [], page: { number: 1, size: 0, totalItems: 0, totalPages: 0 }, error: catalogError(failure) }); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [request, resource, farmId, page, search, revision]);

  useEffect(() => {
    if (resource.key !== 'locations') return;
    let cancelled = false;
    void getWarehouses(request, { farmId, page: 1, pageSize: 100, status: 'ACTIVE' })
      .then((response) => { if (!cancelled) setWarehouses(response.data.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.code} - ${warehouse.name}` }))); })
      .catch(() => { if (!cancelled) setWarehouses([]); });
    return () => { cancelled = true; };
  }, [request, resource.key, farmId]);

  const optionsFor = (field: CatalogField) => (field.name === 'warehouseId' ? warehouses : field.options ?? []);
  const display = (record: CatalogRecord, column: string) => {
    const value = catalogFieldValue(record, column);
    if (column === 'type') return LOCATION_TYPES.find((option) => option.value === value)?.label ?? value;
    if (column === 'warehouseId') return warehouses.find((option) => option.value === value)?.label ?? (value ? '—' : 'Không gắn kho');
    return value || '—';
  };

  async function toggleStatus(record: CatalogRecord) {
    setActionError(null);
    try {
      await saveCatalogRecord(request, resource, farmId, record.id, { status: record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      setRevision((value) => value + 1);
    } catch (failure) { setActionError(catalogError(failure)); }
  }

  const record = editing === 'new' ? null : editing;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input aria-label={`Tìm ${resource.label.toLowerCase()}`} placeholder="Tìm theo mã hoặc tên" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} className="md:max-w-xs" />
        {canWrite ? <Button onClick={() => setEditing('new')}>Thêm {resource.label.toLowerCase()}</Button> : <p className="text-sm text-muted-foreground">{resource.shared ? 'Chỉ quản trị viên (ADMIN) được sửa danh mục dùng chung.' : 'Chỉ quản trị viên hoặc chủ trang trại được sửa.'}</p>}
      </div>
      {actionError && <ErrorAlert message={actionError} />}
      {!result ? <p role="status" className="text-sm text-muted-foreground">Đang tải…</p> : result.error ? <ErrorAlert message={result.error} /> : result.rows.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p> : (
        <Table>
          <TableHeader><TableRow>{resource.columns.map((column) => <TableHead key={column.name}>{column.label}</TableHead>)}<TableHead>Trạng thái</TableHead>{canWrite && <TableHead className="text-right">Thao tác</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.id}>
                {resource.columns.map((column) => <TableCell key={column.name}>{display(row, column.name)}</TableCell>)}
                <TableCell><Badge variant={row.status === 'ACTIVE' ? 'success' : 'secondary'}>{row.status === 'ACTIVE' ? 'Đang dùng' : 'Ngưng'}</Badge></TableCell>
                {canWrite && <TableCell className="space-x-2 text-right"><Button size="sm" variant="outline" onClick={() => setEditing(row)}>Sửa</Button><Button size="sm" variant="ghost" onClick={() => void toggleStatus(row)}>{row.status === 'ACTIVE' ? 'Ngưng' : 'Dùng lại'}</Button></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {result && !resource.shared && <Pagination pageInfo={result.page} errorMessage={result.error} onPageChange={setPage} />}
      {editing && (
        <FormDialog
          title={record ? `Sửa ${resource.label.toLowerCase()}` : `Thêm ${resource.label.toLowerCase()}`}
          description={resource.shared ? 'Thay đổi áp dụng cho mọi trang trại.' : 'Chỉ áp dụng cho trang trại đang chọn.'}
          errorMessage={catalogError}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            await saveCatalogRecord(request, resource, farmId, record?.id ?? null, catalogPayload(resource.fields, data));
            setRevision((value) => value + 1);
          }}
        >
          {resource.fields.map((field) => (
            <label key={field.name} className="block space-y-1 text-sm">
              <span className="font-medium">{field.label}{field.required && ' *'}</span>
              {field.type === 'select' ? (
                <Select name={field.name} required={field.required} defaultValue={catalogFieldValue(record, field.name)}>
                  <option value="">{field.required ? 'Chọn…' : 'Không chọn'}</option>
                  {optionsFor(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              ) : (
                <Input name={field.name} type={field.type ?? 'text'} required={field.required} maxLength={field.maxLength} defaultValue={catalogFieldValue(record, field.name)} />
              )}
            </label>
          ))}
        </FormDialog>
      )}
    </section>
  );
}
