"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import type { PaginatedResponse } from "@/shared/api/contracts";
import {
  getIssueMaintenanceRecord,
  getIssueMaintenanceRecords,
} from "../api/issues.api";
import type { IssueMaintenanceReference } from "../types/issue";

const TYPE_LABELS = {
  INSPECTION: "Kiểm tra",
  PREVENTIVE: "Bảo trì định kỳ",
  CORRECTIVE: "Sửa chữa",
};
const STATUS_LABELS = {
  SCHEDULED: "Đã lên lịch",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export function IssueMaintenancePicker({
  farmId,
  selectedId,
  onSelect,
}: {
  farmId: string;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const request = useAuthenticatedRequest();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState({ page: 1 });
  const [attempt, setAttempt] = useState(0);
  const [lookup, setLookup] = useState<{
    farmId: string;
    id: string;
    attempt: number;
    record?: IssueMaintenanceReference;
    error?: string;
  } | null>(null);
  const [result, setResult] = useState<{
    farmId: string;
    query: typeof query;
    attempt: number;
    response?: PaginatedResponse<IssueMaintenanceReference>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void getIssueMaintenanceRecord(request, farmId, selectedId)
      .then(({ data }) => {
        if (data.id !== selectedId || data.farmId !== farmId)
          throw new Error("Unexpected maintenance record");
        if (!cancelled)
          setLookup({ farmId, id: selectedId, attempt, record: data });
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setLookup({
            farmId,
            id: selectedId,
            attempt,
            error: maintenanceError(failure),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, selectedId, attempt]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getIssueMaintenanceRecords(request, farmId, { ...query, pageSize: 10 })
      .then((response) => {
        if (!cancelled) setResult({ farmId, query, attempt, response });
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setResult({
            farmId,
            query,
            attempt,
            error: maintenanceError(failure),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, open, query, attempt]);

  const selected =
    lookup?.farmId === farmId &&
    lookup.id === selectedId &&
    lookup.attempt === attempt
      ? lookup
      : null;
  const current =
    result?.farmId === farmId &&
    result.query === query &&
    result.attempt === attempt
      ? result
      : null;
  const rows =
    current?.response?.data.filter((row) => row.farmId === farmId) ?? [];
  return (
    <section
      aria-label="Hồ sơ bảo trì liên kết"
      className="space-y-3 rounded-xl border bg-card p-4"
    >
      <h2 className="font-semibold">Hồ sơ bảo trì{onSelect ? " *" : ""}</h2>
      {selectedId ? (
        <>
          <p className="break-all text-sm">Hồ sơ đã chọn: {selectedId}</p>
          {!selected ? (
            <p role="status">Đang tải hồ sơ đã lưu...</p>
          ) : selected.error ? (
            <div role="status">
              <p>{selected.error} Liên kết đã lưu vẫn được giữ lại.</p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="underline"
              >
                Thử lại
              </button>
            </div>
          ) : (
            selected.record && (
              <p className="whitespace-pre-wrap text-sm">
                {recordLabel(selected.record)}
              </p>
            )
          )}
        </>
      ) : (
        <p role="status">Chưa chọn hồ sơ bảo trì.</p>
      )}
      {onSelect && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => {
                setOpen((value) => !value);
                setAttempt((value) => value + 1);
              }}
            >
              {open
                ? "Đóng danh sách hồ sơ"
                : selectedId
                  ? "Thay hồ sơ bảo trì"
                  : "Chọn hồ sơ bảo trì"}
            </button>
            {selectedId && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Bỏ chọn hồ sơ
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Chọn hồ sơ đã có trong trang trại. Loại phiếu khác sẽ xóa liên kết
            bảo trì.
          </p>
        </>
      )}
      {open &&
        onSelect &&
        (!current ? (
          <p role="status">Đang tải danh sách hồ sơ...</p>
        ) : current.error ? (
          <div role="alert">
            <p>{current.error}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="underline"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {rows.length === 0 && (
              <p role="status">Chưa có hồ sơ bảo trì trong trang trại.</p>
            )}
            <ul className="space-y-2">
              {rows.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(record.id);
                      setOpen(false);
                    }}
                    className="text-left underline"
                  >
                    {recordLabel(record)} · Hồ sơ: {record.id}
                  </button>
                </li>
              ))}
            </ul>
            {current.response && (
              <nav aria-label="Phân trang hồ sơ bảo trì" className="flex gap-3">
                <button
                  type="button"
                  disabled={query.page <= 1}
                  onClick={() => setQuery({ page: query.page - 1 })}
                  className="disabled:opacity-40"
                >
                  Trang trước
                </button>
                <span>
                  Trang {query.page} /{" "}
                  {Math.max(1, current.response.page.totalPages)}
                </span>
                <button
                  type="button"
                  disabled={query.page >= current.response.page.totalPages}
                  onClick={() => setQuery({ page: query.page + 1 })}
                  className="disabled:opacity-40"
                >
                  Trang sau
                </button>
              </nav>
            )}
          </>
        ))}
    </section>
  );
}

function recordLabel(record: IssueMaintenanceReference): string {
  return `${record.assetCode ?? record.assetId} · Serial: ${record.serialNumber ?? "—"} · ${TYPE_LABELS[record.maintenanceType]} · Lịch: ${record.scheduledAt ?? "Chưa có lịch"} · ${STATUS_LABELS[record.status]}${record.description ? ` · ${record.description}` : ""}`;
}

function maintenanceError(failure: unknown): string {
  return failure instanceof ApiError && failure.status === 403
    ? "Bạn không có quyền xem hồ sơ bảo trì trong trang trại này."
    : failure instanceof ApiError && failure.status === 401
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : failure instanceof ApiError && failure.status === 404
        ? "Hồ sơ bảo trì không còn tồn tại hoặc không thuộc trang trại này."
        : "Không thể tải hồ sơ bảo trì. Vui lòng thử lại.";
}
