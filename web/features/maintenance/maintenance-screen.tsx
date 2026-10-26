"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext, useAuthenticatedRequest } from "@/features/auth";
import { assetError, formatAssetPrice } from "@/features/assets/asset.logic";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { Select } from "@/shared/components/ui/select";

type Maintenance = {
  id: string;
  assetId: string;
  assetCode: string | null;
  maintenanceType: string;
  scheduledAt: string | null;
  description: string | null;
  status: string;
  totalCost: string | null;
};
const STATUSES: Record<string, string> = {
  SCHEDULED: "Đã lên lịch",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
const TYPES: Record<string, string> = {
  PREVENTIVE: "Bảo dưỡng định kỳ",
  CORRECTIVE: "Sửa chữa",
  INSPECTION: "Kiểm tra",
};

function MaintenanceList({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  const [query, setQuery] = useState({ page: 1, status: "" });
  const [result, setResult] = useState<{
    query: typeof query;
    response?: PaginatedResponse<Maintenance>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void request<PaginatedResponse<Maintenance>>("/maintenance-records", {
      params: {
        farmId,
        page: query.page,
        pageSize: 20,
        status: query.status || undefined,
      },
    })
      .then((response) => {
        if (!alive) return;
        if (query.page > Math.max(1, response.page.totalPages)) {
          setQuery({ ...query, page: Math.max(1, response.page.totalPages) });
          return;
        }
        setResult({ query, response });
      })
      .catch((error) => {
        if (alive) setResult({ query, error: assetError(error).message });
      });
    return () => {
      alive = false;
    };
  }, [request, farmId, query]);
  const current = result?.query === query ? result : null;
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Bảo trì và sửa chữa"
        description="Theo dõi hồ sơ bảo trì trong trang trại. Mở tài sản để lập lịch, ghi kết quả và xử lý."
        actions={
          <Button
            variant="outline"
            disabled={!current}
            onClick={() => setQuery({ ...query })}
          >
            Tải lại
          </Button>
        }
      />
      <label className="block max-w-sm space-y-2 text-sm font-medium">
        Trạng thái bảo trì
        <Select
          value={query.status}
          onChange={(event) =>
            setQuery({ page: 1, status: event.target.value })
          }
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUSES).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </Select>
      </label>
      <section
        className="min-w-0 rounded-xl border bg-card"
        aria-label="Danh sách bảo trì"
      >
        {!current ? (
          <p role="status" className="p-5">
            Đang tải bảo trì…
          </p>
        ) : current.error ? (
          <ErrorAlert
            className="m-4"
            message={current.error}
            onRetry={() => setQuery({ ...query })}
          />
        ) : (
          <>
            {!current.response?.data.length && (
              <div className="space-y-2 p-6">
                <p>Chưa có hồ sơ bảo trì phù hợp.</p>
                <Link href="/assets" className="text-sm text-primary underline">
                  Mở danh sách tài sản để lập lịch
                </Link>
              </div>
            )}
            <ul className="divide-y">
              {current.response?.data.map((record) => (
                <li
                  key={record.id}
                  className="grid min-w-0 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={`/assets/${encodeURIComponent(record.assetId)}`}
                      className="font-semibold text-primary underline break-words"
                    >
                      {record.assetCode || "Mở tài sản"}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {TYPES[record.maintenanceType] ?? record.maintenanceType}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trạng thái</p>
                    <p className="mt-1 text-sm font-medium">
                      {STATUSES[record.status] ?? record.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Lịch dự kiến
                    </p>
                    <p className="mt-1 text-sm">
                      {record.scheduledAt
                        ? new Date(record.scheduledAt).toLocaleString("vi-VN")
                        : "Chưa đặt lịch"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Tổng chi phí
                    </p>
                    <p className="mt-1 break-words text-sm">
                      {formatAssetPrice(record.totalCost)}
                    </p>
                  </div>
                  {record.description && (
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
                      {record.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {current.response && (
              <Pagination
                pageInfo={current.response.page}
                itemLabel="hồ sơ"
                onPageChange={(page) => setQuery({ ...query, page })}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

export function MaintenanceScreen() {
  const { selectedFarmId, isLoading, error } = useAuthContext();
  if (isLoading) return <p role="status">Đang tải trang trại…</p>;
  if (error)
    return (
      <ErrorAlert message="Không tải được quyền truy cập trang trại. Vui lòng tải lại trang." />
    );
  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để xem bảo trì.</p>;
  return <MaintenanceList key={selectedFarmId} farmId={selectedFarmId} />;
}
