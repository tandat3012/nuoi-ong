'use client';

import { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';

import { useAuthenticatedRequest, useAuthContext } from '@/features/auth';
import { ApiError } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';

type Warehouse = {
  id: string;
  farmId: string;
  code: string;
  name: string;
  address: string | null;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
};

type WarehouseInput = {
  code: string;
  name: string;
  address: string;
  description: string;
};

type WarehouseResponse = { data: Warehouse };

function getErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  const details = error.details as { message?: string | string[] } | undefined;
  const message = Array.isArray(details?.message)
    ? details.message.join(', ')
    : details?.message;

  if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (error.status === 409 && message?.toLowerCase().includes('code')) {
    return 'Mã kho đã tồn tại trong farm này.';
  }
  if (error.status === 409 && message?.includes('WAREHOUSE_NOT_EMPTY')) {
    return 'Không thể vô hiệu hóa kho vì kho còn tồn kho hoặc tài sản.';
  }
  return message ?? error.message;
}

const emptyForm: WarehouseInput = { code: '', name: '', address: '', description: '' };

export function WarehousesScreen() {
  const request = useAuthenticatedRequest();
  const { data: auth, selectedFarmId, isLoading: authLoading, error: authError } = useAuthContext();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loadedFarmId, setLoadedFarmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseInput>(emptyForm);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const membership = auth?.memberships.find(({ farm }) => farm.id === selectedFarmId);
  const currentFarm = membership?.farm;
  const canWrite = membership?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER') ?? false;

  useEffect(() => {
    startTransition(() => {
      setPage(1);
      setLoadedFarmId(null);
      setSelectedWarehouse(null);
      setForm(emptyForm);
      setShowForm(false);
      setTotalPages(1);
      setTotalItems(0);
    });
  }, [selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    void request<PaginatedResponse<Warehouse>>('/api/v1/warehouses', {
      params: {
        farmId: selectedFarmId,
        page,
        pageSize: 20,
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
      },
    })
      .then((response) => {
        if (cancelled) return;
        setWarehouses(response.data);
        setLoadedFarmId(selectedFarmId);
        setTotalPages(response.page.totalPages);
        setTotalItems(response.page.totalItems);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setWarehouses([]);
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, request, search, selectedFarmId, status]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function changeStatus(nextStatus: 'ALL' | 'ACTIVE' | 'INACTIVE') {
    setPage(1);
    setStatus(nextStatus);
  }

  function startCreate() {
    setSelectedWarehouse(null);
    setForm(emptyForm);
    setFormMode('create');
    setShowForm(true);
    setError(null);
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFarmId || !canWrite) return;
    setFormLoading(true);
    setError(null);
    const data = {
      code: form.code.trim(),
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      description: form.description.trim() || undefined,
    };

    try {
      const response = formMode === 'create'
        ? await request<WarehouseResponse>('/api/v1/warehouses', {
            method: 'POST',
            params: { farmId: selectedFarmId },
            data,
          })
        : await request<WarehouseResponse>(`/api/v1/warehouses/${selectedWarehouse?.id}`, {
            method: 'PATCH',
            params: { farmId: selectedFarmId },
            data,
          });

      setSelectedWarehouse(response.data);
      setForm({
        code: response.data.code,
        name: response.data.name,
        address: response.data.address ?? '',
        description: response.data.description ?? '',
      });
      setFormMode('edit');
      setShowForm(false);
      setWarehouses((items) => formMode === 'create'
        ? [response.data, ...items]
        : items.map((item) => item.id === response.data.id ? response.data : item));
      if (formMode === 'create') setTotalItems((value) => value + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setFormLoading(false);
    }
  }

  async function deactivateWarehouse(warehouse: Warehouse) {
    if (!selectedFarmId || !canWrite) return;
    if (!window.confirm(`Vô hiệu hóa kho ${warehouse.name}?`)) return;
    try {
      await request(`/api/v1/warehouses/${warehouse.id}`, {
        method: 'DELETE',
        params: { farmId: selectedFarmId },
      });
      setWarehouses((items) => items.filter((item) => item.id !== warehouse.id));
      setSelectedWarehouse((current) => current?.id === warehouse.id ? null : current);
      setTotalItems((value) => Math.max(0, value - 1));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  if (authLoading) return <p>Đang tải farm...</p>;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (!selectedFarmId) return <p>Không có farm hoạt động để xem kho.</p>;

  const visibleWarehouses = loadedFarmId === selectedFarmId ? warehouses : [];
  const isWarehouseLoading = loading || loadedFarmId !== selectedFarmId;

  return (
    <div className="space-y-6">
      <section>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Warehouse</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Quản lý kho</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {currentFarm?.name} · Vai trò: {membership?.roles.join(', ') || 'Chỉ xem'}
        </p>
      </section>

      {canWrite && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Thao tác kho</h2>
            <button type="button" onClick={() => showForm ? setShowForm(false) : startCreate()} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              {showForm ? 'Đóng form' : 'Tạo kho mới'}
            </button>
          </div>
          {showForm && <form onSubmit={submitForm} className="mt-4 grid gap-3 md:grid-cols-2">
            <input required maxLength={50} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="Mã kho" className="min-h-11 rounded-xl border bg-background px-3 text-sm" />
            <input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Tên kho" className="min-h-11 rounded-xl border bg-background px-3 text-sm" />
            <input maxLength={4000} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Địa chỉ" className="min-h-11 rounded-xl border bg-background px-3 text-sm" />
            <input maxLength={4000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Mô tả" className="min-h-11 rounded-xl border bg-background px-3 text-sm" />
            <button disabled={formLoading} type="submit" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2">
              {formLoading ? 'Đang lưu...' : formMode === 'create' ? 'Tạo kho' : 'Lưu thay đổi'}
            </button>
          </form>}
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <form onSubmit={submitSearch} className="flex flex-col gap-3 md:flex-row">
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm theo mã hoặc tên kho" className="min-h-11 flex-1 rounded-xl border bg-background px-3 text-sm" />
          <button type="submit" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Tìm kiếm</button>
          <select value={status} onChange={(event) => changeStatus(event.target.value as typeof status)} className="min-h-11 rounded-xl border bg-background px-3 text-sm">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Đã vô hiệu hóa</option>
          </select>
        </form>
      </section>

      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>}

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="font-semibold">Danh sách kho</h2>
          <span className="text-sm text-muted-foreground">{totalItems} kho</span>
        </div>
        {isWarehouseLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Đang tải danh sách kho...</p>
        ) : visibleWarehouses.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Không có kho phù hợp.</p>
        ) : (
          <div className="divide-y">
            {visibleWarehouses.map((warehouse) => (
              <article key={warehouse.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                <Link href={`/warehouses/${warehouse.id}`} className="text-left">
                  <p className="font-semibold">{warehouse.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{warehouse.code} · {warehouse.address ?? 'Chưa có địa chỉ'}</p>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{warehouse.status}</span>
                  {canWrite && warehouse.status === 'ACTIVE' && <button type="button" onClick={() => void deactivateWarehouse(warehouse)} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Vô hiệu hóa</button>}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t p-5 text-sm">
          <button type="button" disabled={page <= 1 || isWarehouseLoading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang trước</button>
          <span>Trang {page}/{totalPages}</span>
          <button type="button" disabled={page >= totalPages || isWarehouseLoading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang sau</button>
        </div>
      </section>

      {selectedWarehouse && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Chi tiết kho</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Mã kho</dt><dd className="font-medium">{selectedWarehouse.code}</dd></div>
            <div><dt className="text-muted-foreground">Tên kho</dt><dd className="font-medium">{selectedWarehouse.name}</dd></div>
            <div><dt className="text-muted-foreground">Trạng thái</dt><dd className="font-medium">{selectedWarehouse.status}</dd></div>
            <div><dt className="text-muted-foreground">Địa chỉ</dt><dd className="font-medium">{selectedWarehouse.address ?? 'Chưa có'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Mô tả</dt><dd className="font-medium">{selectedWarehouse.description ?? 'Chưa có'}</dd></div>
          </dl>
          {canWrite && <button type="button" onClick={() => setShowForm(true)} className="mt-4 rounded-lg border px-3 py-2 text-sm hover:bg-muted">Chỉnh sửa kho</button>}
        </section>
      )}
    </div>
  );
}
