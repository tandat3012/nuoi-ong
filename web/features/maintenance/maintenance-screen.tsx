"use client";

import { MAINTENANCE_STATUSES } from "./maintenance.logic";
import {
  MaintenanceRecordCard,
  type MaintenanceRecord,
} from "./maintenance-record-card";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { RefreshCw, Plus, SlidersHorizontal, Wrench } from "lucide-react";
import {
  hasAnyRole,
  MAINTENANCE_SCHEDULE_ROLES,
} from "@/features/auth/farm-roles";
import { MaintenanceActions } from "./maintenance-actions";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthContext, useAuthenticatedRequest } from "@/features/auth";
import { assetError } from "@/features/assets/asset.logic";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { Select } from "@/shared/components/ui/select";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { DateRangeFilter } from "@/shared/components/ui/date-range-filter";

function MaintenanceList({
  farmId,
  roles,
  recordId,
}: {
  farmId: string;
  roles: readonly string[];
  recordId?: string;
}) {
  const request = useAuthenticatedRequest();
  const router = useRouter();
  const [today, setToday] = useState(() => Date.now());
  const [rangeKey, setRangeKey] = useState(0);
  const [query, setQuery] = useState<{
    page: number;
    status: string;
    recordId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>({ page: 1, status: "", recordId });
  const [result, setResult] = useState<{
    query: typeof query;
    response?: PaginatedResponse<MaintenanceRecord>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void request<PaginatedResponse<MaintenanceRecord>>("/maintenance-records", {
      params: {
        farmId,
        recordId: query.recordId,
        page: query.page,
        pageSize: 20,
        status: query.status || undefined,
        dateFrom: query.dateFrom || undefined,
        dateTo: query.dateTo || undefined,
      },
    })
      .then((response) => {
        if (!alive) return;
        if (query.page > Math.max(1, response.page.totalPages)) {
          setQuery({ ...query, page: Math.max(1, response.page.totalPages) });
          return;
        }
        setToday(Date.now());
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
        title="Bảo trì & sửa chữa"
        description="Theo dõi lịch bảo trì, kết quả nghiệm thu và nhập lại thiết bị."
        badge={
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="size-4" aria-hidden="true" />
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              disabled={!current}
              onClick={() => setQuery({ ...query })}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Tải lại
            </Button>
            <Link
              href="/assets"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="size-4" aria-hidden="true" />
              {hasAnyRole(roles, MAINTENANCE_SCHEDULE_ROLES)
                ? "Lập lịch bảo trì"
                : "Xem tài sản"}
            </Link>
          </>
        }
      />
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full space-y-2 text-sm font-medium sm:max-w-xs">
          <span className="flex items-center gap-2">
            <SlidersHorizontal
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Trạng thái hồ sơ
          </span>
          <Select
            value={query.status}
            onChange={(event) =>
              setQuery({ ...query, page: 1, status: event.target.value })
            }
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(MAINTENANCE_STATUSES).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <div
          className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
          aria-live="polite"
        >
          {current?.response && (
            <span>
              <strong className="font-semibold text-foreground">
                {current.response.page.totalItems}
              </strong>{" "}
              hồ sơ{query.status ? " phù hợp" : " trong trang trại"}
            </span>
          )}
          {query.recordId && <Badge variant="info">Đang xem một hồ sơ</Badge>}
          {(query.status ||
            query.recordId ||
            query.dateFrom ||
            query.dateTo) && (
            <Button
              variant="ghost"
              onClick={() => {
                router.replace("/maintenance");
                setQuery({ page: 1, status: "" });
                setRangeKey((value) => value + 1);
              }}
            >
              Xem tất cả
            </Button>
          )}
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-sm font-medium">
          Lọc theo lịch bảo trì dự kiến
        </p>
        <DateRangeFilter
          key={rangeKey}
          onApply={(range) => setQuery({ ...query, ...range, page: 1 })}
        />
      </div>
      <section className="min-w-0 space-y-3" aria-label="Danh sách bảo trì">
        {!current ? (
          <BeeLoader label="Đang tải bảo trì…" />
        ) : current.error ? (
          <ErrorAlert
            className="m-4"
            message={current.error}
            onRetry={() => setQuery({ ...query })}
          />
        ) : (
          <>
            {!current.response?.data.length ? (
              <div className="rounded-xl border border-border bg-card">
                <EmptyState
                  icon={Wrench}
                  title={
                    query.status || query.recordId
                      ? "Không tìm thấy hồ sơ phù hợp"
                      : "Chưa có lịch bảo trì"
                  }
                  description={
                    query.status || query.recordId
                      ? "Thử chọn trạng thái khác hoặc xem tất cả hồ sơ của trang trại."
                      : "Mở tài sản và chọn Lên lịch bảo trì để bắt đầu theo dõi."
                  }
                  action={
                    query.status || query.recordId ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          router.replace("/maintenance");
                          setQuery({ page: 1, status: "" });
                        }}
                      >
                        Xem tất cả hồ sơ
                      </Button>
                    ) : (
                      <Link
                        href="/assets"
                        className="text-sm font-medium text-primary underline underline-offset-4"
                      >
                        Mở danh sách tài sản
                      </Link>
                    )
                  }
                />
              </div>
            ) : (
              <ul className="space-y-3">
                {current.response?.data.map((record) => (
                  <li key={record.id}>
                    <MaintenanceRecordCard
                      record={record}
                      roles={roles}
                      now={today}
                      actions={
                        <MaintenanceActions
                          record={record}
                          farmId={farmId}
                          roles={roles}
                          onSaved={() => setQuery({ ...query })}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            {current.response && (
              <Pagination
                className="rounded-xl border border-border"
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

function MaintenanceContent() {
  const search = useSearchParams();
  const recordId = search.get("id") ?? undefined;
  const { selectedFarmId, isLoading, error, data } = useAuthContext();
  if (isLoading) return <BeeLoader label="Đang tải trang trại…" />;
  if (error)
    return (
      <ErrorAlert message="Không tải được quyền truy cập trang trại. Vui lòng tải lại trang." />
    );
  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để xem bảo trì.</p>;
  return (
    <MaintenanceList
      key={`${selectedFarmId}:${recordId ?? ""}`}
      farmId={selectedFarmId}
      recordId={recordId}
      roles={
        data?.memberships.find((m) => m.farm.id === selectedFarmId)?.roles ?? []
      }
    />
  );
}

export function MaintenanceScreen() {
  return (
    <Suspense fallback={<BeeLoader label="Đang tải bảo trì…" />}>
      <MaintenanceContent />
    </Suspense>
  );
}
