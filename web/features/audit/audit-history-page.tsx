"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest, useAuthContext } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";

type AuditRecord = {
  id: string;
  farmId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData: unknown;
  newData: unknown;
  createdAt: string;
  actor: { name: string | null; email: string | null } | null;
};
type AuditResponse = PaginatedResponse<AuditRecord> & { scope: "FARM" | "CREATED_BY_ME" };

const actionLabel: Record<string, string> = {
  CREATE: "Tạo mới", INSERT: "Tạo mới", UPDATE: "Cập nhật", CANCEL: "Hủy",
  SUBMIT: "Gửi duyệt", CONFIRM: "Xác nhận", REJECT: "Từ chối",
};

export function AuditHistoryPage() {
  const request = useAuthenticatedRequest();
  const { selectedFarmId } = useAuthContext();
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [result, setResult] = useState<{ farmId: string; entityType: string; page: number; response: AuditResponse } | null>(null);
  const [errorResult, setErrorResult] = useState<{ farmId: string; entityType: string; page: number; message: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const current = result?.farmId === selectedFarmId && result.entityType === entityType && result.page === page ? result.response : null;
  const error = errorResult?.farmId === selectedFarmId && errorResult.entityType === entityType && errorResult.page === page ? errorResult.message : null;

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    void request<AuditResponse>("/audit-logs", { params: { farmId: selectedFarmId, entityType: entityType || undefined, page, pageSize: 20 } })
      .then((response) => { if (!cancelled) setResult({ farmId: selectedFarmId, entityType, page, response }); })
      .catch(() => { if (!cancelled) setErrorResult({ farmId: selectedFarmId, entityType, page, message: "Không thể tải lịch sử thao tác của farm này." }); });
    return () => { cancelled = true; };
  }, [request, selectedFarmId, entityType, page, retry]);

  if (!selectedFarmId) return <p role="status">Vui lòng chọn trang trại để xem lịch sử.</p>;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Quản trị</span><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Lịch sử thao tác</h1><p className="mt-2 text-sm text-muted-foreground">Dữ liệu giới hạn theo farm và phạm vi quyền do API áp dụng cho tài khoản.</p></div>
        <label className="grid gap-1 text-sm font-medium">Loại dữ liệu
          <select value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }} className="min-h-10 rounded-lg border bg-background px-3 font-normal">
            <option value="">Tất cả</option><option value="STOCK_RECEIPT">Phiếu nhập</option><option value="STOCK_ISSUE">Phiếu xuất</option><option value="STOCK_TRANSFER">Điều chuyển</option><option value="STOCK_COUNT">Kiểm kê</option><option value="MAINTENANCE">Bảo trì</option>
          </select>
        </label>
      </header>
      {error ? <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}<button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-3 underline">Thử lại</button></div> : !current ? <p role="status" className="text-sm text-muted-foreground">Đang tải lịch sử...</p> : current.data.length === 0 ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Chưa có thao tác phù hợp trong farm này.</p> : (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="divide-y">{current.data.map((record) => <article key={record.id} className="p-4 sm:p-5">
            <button type="button" aria-expanded={expanded === record.id} onClick={() => setExpanded(expanded === record.id ? null : record.id)} className="grid w-full gap-2 text-left sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <span><span className="font-semibold">{actionLabel[record.action] ?? record.action}</span><span className="ml-2 text-sm text-muted-foreground">{record.entityType.replaceAll("_", " ")}</span><span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{record.entityId}</span></span>
              <span className="text-sm">{record.actor?.name || record.actor?.email || "Không rõ người thực hiện"}</span><time className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt))}</time>
            </button>
            {expanded === record.id && <div className="mt-4 grid gap-3 border-t pt-4 lg:grid-cols-2"><JsonSnapshot label="Trước thay đổi" value={record.oldData} /><JsonSnapshot label="Sau thay đổi" value={record.newData} /></div>}
          </article>)}</div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 text-sm"><span>Phạm vi: {current.scope === "FARM" ? "Toàn farm" : "Thao tác của tôi"} · {current.page.totalItems} bản ghi</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-50">Trước</button><span className="px-2 py-1.5">{page} / {Math.max(1, current.page.totalPages)}</span><button type="button" disabled={page >= current.page.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-50">Sau</button></div></div>
        </section>
      )}
    </div>
  );
}

function JsonSnapshot({ label, value }: { label: string; value: unknown }) {
  return <div className="min-w-0"><h2 className="mb-2 text-sm font-semibold">{label}</h2><pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs leading-5">{value == null ? "Không có dữ liệu" : JSON.stringify(value, null, 2)}</pre></div>;
}
