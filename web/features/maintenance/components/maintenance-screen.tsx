'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthenticatedRequest, useAuthContext } from '@/features/auth';
import { ApiError } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';

type RequestRow = { id: string; assetId: string; assetCode: string; itemName: string; maintenanceType: string; description: string; status: string; rejectionReason: string | null; createdAt: string; maintenanceRecordId: string | null };
type RecordRow = { id: string; assetId: string; assetCode: string | null; serialNumber: string | null; maintenanceType: string; scheduledAt: string | null; startedAt: string | null; completedAt: string | null; status: string; description: string | null; resultNote: string | null; totalCost: string | null };
type AssetOption = { asset: { id: string; assetCode: string; status: string }; itemName: string };

function errorMessage(error: unknown) { return error instanceof ApiError ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.'; }
function displayDate(value: string | null) { return value ? new Date(value).toLocaleString('vi-VN') : '—'; }

export function MaintenanceScreen() {
  const request = useAuthenticatedRequest();
  const { data: auth, selectedFarmId, isLoading: authLoading, error: authError } = useAuthContext();
  const roles = auth?.memberships.find(({ farm }) => farm.id === selectedFarmId)?.roles ?? [];
  const canManage = roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER');
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [status, setStatus] = useState('PENDING_APPROVAL');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState({ assetId: '', maintenanceType: 'PREVENTIVE', scheduledAt: '', description: '' });
  const [schedules, setSchedules] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    if (!selectedFarmId) return;
    const [requestPage, recordPage, assetPage] = await Promise.all([
      request<PaginatedResponse<RequestRow>>('/maintenance-requests', { params: { farmId: selectedFarmId, page: 1, pageSize: 100, status: status || undefined } }),
      request<PaginatedResponse<RecordRow>>('/maintenance-records', { params: { farmId: selectedFarmId, page: 1, pageSize: 100 } }),
      request<PaginatedResponse<AssetOption>>('/assets', { params: { farmId: selectedFarmId, page: 1, pageSize: 100 } }),
    ]);
    setRequests(requestPage.data);
    setRecords(recordPage.data);
    setAssets(assetPage.data.filter(({ asset }) => !['LOST', 'RETIRED'].includes(asset.status)));
    setForm((value) => ({ ...value, assetId: value.assetId || assetPage.data.find(({ asset }) => !['LOST', 'RETIRED', 'MAINTENANCE'].includes(asset.status))?.asset.id || '' }));
    setError(null);
  }, [request, selectedFarmId, status]);

  useEffect(() => { let cancelled = false; void reload().catch((cause: unknown) => { if (!cancelled) setError(errorMessage(cause)); }); return () => { cancelled = true; }; }, [reload, refresh]);

  async function createSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedFarmId || !canManage) return;
    setBusyId('create'); setError(null);
    try {
      await request('/maintenance-records', { method: 'POST', params: { farmId: selectedFarmId }, data: { assetId: form.assetId, maintenanceType: form.maintenanceType, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null, description: form.description.trim() } });
      setForm((value) => ({ ...value, scheduledAt: '', description: '' })); setRefresh((value) => value + 1);
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusyId(null); }
  }

  async function decide(row: RequestRow, action: 'approve' | 'reject') {
    if (!selectedFarmId) return;
    if (action === 'approve' && !schedules[row.id]) { setError('Chọn lịch bảo trì trước khi duyệt yêu cầu.'); return; }
    if (action === 'reject' && (reasons[row.id] ?? '').trim().length < 3) { setError('Nhập lý do từ chối ít nhất 3 ký tự.'); return; }
    setBusyId(row.id); setError(null);
    try {
      await request(`/maintenance-requests/${encodeURIComponent(row.id)}/${action}`, { method: 'POST', params: { farmId: selectedFarmId }, data: action === 'approve' ? { scheduledAt: new Date(schedules[row.id]).toISOString() } : { rejectionReason: reasons[row.id].trim() } });
      setRefresh((value) => value + 1);
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusyId(null); }
  }

  async function transition(record: RecordRow, action: 'start' | 'complete' | 'cancel') {
    if (!selectedFarmId) return;
    setBusyId(record.id); setError(null);
    try { await request(`/maintenance-records/${encodeURIComponent(record.id)}/${action}`, { method: 'POST', params: { farmId: selectedFarmId } }); setRefresh((value) => value + 1); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusyId(null); }
  }

  if (authLoading) return <p>Đang tải farm...</p>;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (!selectedFarmId) return <p>Không có farm hoạt động để xem bảo trì.</p>;
  const assetLabel = (id: string) => { const asset = assets.find((row) => row.asset.id === id); return asset ? `${asset.asset.assetCode} · ${asset.itemName}` : id.slice(0, 8); };

  return <div className="space-y-6">
    <section><span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Maintenance</span><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Bảo trì và sự cố</h1><p className="mt-2 text-sm text-muted-foreground">Owner/admin lập lịch; nhân viên gửi sự cố để quản lý duyệt. Duyệt tạo hồ sơ bảo trì hiện có.</p></section>
    {canManage && <section className="rounded-2xl border bg-card p-5 shadow-sm"><h2 className="font-semibold">Lập lịch bảo trì</h2><form onSubmit={createSchedule} className="mt-4 grid gap-3 md:grid-cols-2"><select required value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="">Chọn tài sản</option>{assets.filter(({ asset }) => !['MAINTENANCE'].includes(asset.status)).map(({ asset, itemName }) => <option key={asset.id} value={asset.id}>{asset.assetCode} · {itemName}</option>)}</select><select value={form.maintenanceType} onChange={(event) => setForm({ ...form, maintenanceType: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="PREVENTIVE">Định kỳ</option><option value="INSPECTION">Kiểm tra</option><option value="CORRECTIVE">Sửa chữa</option></select><input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm" /><input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Nội dung bảo trì" className="min-h-11 rounded-xl border bg-background px-3 text-sm" /><button disabled={busyId === 'create'} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2">{busyId === 'create' ? 'Đang lưu…' : 'Tạo lịch bảo trì'}</button></form></section>}
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>}
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><h2 className="font-semibold">Yêu cầu sự cố</h2><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm"><option value="PENDING_APPROVAL">Chờ duyệt</option><option value="CONFIRMED">Đã duyệt</option><option value="REJECTED">Từ chối</option><option value="">Tất cả</option></select></div>{requests.length ? <div className="divide-y">{requests.map((row) => <article key={row.id} className="space-y-3 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.itemName} · {row.assetCode}</p><p className="mt-1 text-sm text-muted-foreground">{row.maintenanceType === 'CORRECTIVE' ? 'Sửa chữa đột xuất' : 'Kiểm tra'} · gửi {displayDate(row.createdAt)}</p><p className="mt-2 text-sm">{row.description}</p>{row.rejectionReason && <p className="mt-2 text-sm text-destructive">Lý do từ chối: {row.rejectionReason}</p>}</div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{row.status}</span></div>{canManage && row.status === 'PENDING_APPROVAL' && <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]"><input aria-label="Thời gian bảo trì được duyệt" type="datetime-local" value={schedules[row.id] ?? ''} onChange={(event) => setSchedules((all) => ({ ...all, [row.id]: event.target.value }))} className="min-h-10 rounded-lg border bg-background px-3 text-sm" /><input aria-label="Lý do từ chối" value={reasons[row.id] ?? ''} onChange={(event) => setReasons((all) => ({ ...all, [row.id]: event.target.value }))} placeholder="Lý do nếu từ chối" className="min-h-10 rounded-lg border bg-background px-3 text-sm" /><button disabled={busyId === row.id} onClick={() => void decide(row, 'approve')} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Duyệt & lên lịch</button><button disabled={busyId === row.id} onClick={() => void decide(row, 'reject')} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Từ chối</button></div>}{row.maintenanceRecordId && <p className="text-xs text-muted-foreground">Hồ sơ bảo trì: {row.maintenanceRecordId.slice(0, 8)}</p>}</article>)}</div> : <p className="p-5 text-sm text-muted-foreground">Không có yêu cầu ở trạng thái này.</p>}</section>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="border-b p-5"><h2 className="font-semibold">Lịch bảo trì</h2></div>{records.length ? <div className="divide-y">{records.map((record) => <article key={record.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{assetLabel(record.assetId)} · {record.maintenanceType}</p><p className="mt-1 text-sm text-muted-foreground">{record.status} · lịch {displayDate(record.scheduledAt)} · bắt đầu {displayDate(record.startedAt)} · hoàn tất {displayDate(record.completedAt)}</p>{record.description && <p className="mt-2 text-sm">{record.description}</p>}{record.resultNote && <p className="mt-1 text-sm text-muted-foreground">Kết quả: {record.resultNote}</p>}</div><div className="flex gap-2">{canManage && record.status === 'SCHEDULED' && <button disabled={busyId === record.id} onClick={() => void transition(record, 'start')} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Bắt đầu</button>}{canManage && record.status === 'IN_PROGRESS' && <button disabled={busyId === record.id} onClick={() => void transition(record, 'complete')} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Hoàn tất</button>}{canManage && ['SCHEDULED', 'IN_PROGRESS'].includes(record.status) && <button disabled={busyId === record.id} onClick={() => void transition(record, 'cancel')} className="rounded-lg border px-3 py-2 text-sm">Hủy lịch</button>}</div></article>)}</div> : <p className="p-5 text-sm text-muted-foreground">Chưa có lịch bảo trì.</p>}</section>
  </div>;
}
