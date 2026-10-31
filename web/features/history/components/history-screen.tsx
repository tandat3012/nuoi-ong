"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthContext, useFarmMembership } from "@/features/auth";
import { FARM_ADMIN_ROLES, hasAnyRole } from "@/features/auth/farm-roles";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Select } from "@/shared/components/ui/select";
import {
  changeHistoryFilters, HISTORY_ACTION_LABELS, HISTORY_ENTITY_LABELS,
  historyEntityIdError, historyErrorMessage, historyHref, parseHistoryQuery,
} from "../history.logic";
import { HistoryList } from "./history-list";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export function HistoryScreen() {
  const { selectedFarmId, isLoading, error } = useAuthContext();
  const { membership, canViewHistory } = useFarmMembership();
  if (isLoading) return <BeeLoader label="Đang tải thông tin trang trại…" />;
  if (error) return <ErrorAlert message="Không thể tải quyền truy cập trang trại. Vui lòng tải lại trang." />;
  if (!selectedFarmId || !membership) return <p role="status">Vui lòng chọn trang trại để xem lịch sử thay đổi.</p>;
  if (!canViewHistory) return <ErrorAlert message={historyErrorMessage(403, "")} />;
  return <FarmHistoryScreen key={`${selectedFarmId}:${membership.roles.join(",")}`} farmId={selectedFarmId} roles={membership.roles} />;
}

function FarmHistoryScreen({ farmId, roles }: { farmId: string; roles: readonly string[] }) {
  const params = useSearchParams();
  const search = params.toString();
  const router = useRouter();
  const query = parseHistoryQuery(params);
  const { entityType, entityId, action, page } = query;
  const [revision, setRevision] = useState(0);
  const [filterError, setFilterError] = useState<string | null>(null);
  const changePage = useCallback((nextPage: number) => {
    const current = parseHistoryQuery(new URLSearchParams(search));
    router.push(historyHref({ ...current, page: nextPage }), { scroll: false });
  }, [router, search]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const filters = {
      entityType: String(data.get("entityType") ?? ""),
      action: String(data.get("action") ?? ""),
      entityId: String(data.get("entityId") ?? "").trim(),
    };
    const invalid = historyEntityIdError(filters.entityId);
    setFilterError(invalid);
    if (invalid) return;
    router.push(historyHref(changeHistoryFilters(query, filters)), { scroll: false });
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Lịch sử thay đổi" description="Theo dõi người thao tác và dữ liệu thay đổi trong trang trại."
        actions={<Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Tải lại</Button>} />
      {!hasAnyRole(roles, FARM_ADMIN_ROLES) && (
        <p className="text-sm text-muted-foreground">Bạn chỉ xem được lịch sử của phiếu và yêu cầu do mình tạo.</p>
      )}
      <form key={historyHref(query)} onSubmit={applyFilters} onChange={() => setFilterError(null)}
        className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          Loại đối tượng
          <Select name="entityType" defaultValue={entityType}>
            <option value="">Tất cả loại đối tượng</option>
            {Object.entries(HISTORY_ENTITY_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </Select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Thao tác
          <Select name="action" defaultValue={action}>
            <option value="">Tất cả thao tác</option>
            {Object.entries(HISTORY_ACTION_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </Select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Mã đối tượng (UUID)
          <Input name="entityId" defaultValue={entityId} placeholder="Nhập UUID của đối tượng" autoComplete="off"
            hasError={Boolean(filterError || historyEntityIdError(entityId))} aria-describedby={filterError ? "history-filter-error" : undefined} />
        </label>
        {filterError && <p id="history-filter-error" role="alert" className="text-sm text-destructive md:col-span-2 lg:col-span-3">{filterError}</p>}
        <div className="flex gap-2 md:col-span-2 lg:col-span-3">
          <Button type="submit">Áp dụng</Button>
          <Button type="button" variant="outline" onClick={() => { setFilterError(null); router.push("/history", { scroll: false }); }}>Xóa bộ lọc</Button>
        </div>
      </form>
      <section aria-label="Danh sách lịch sử thay đổi" className="min-w-0 rounded-xl border bg-card">
        <HistoryList farmId={farmId} filters={{ entityType, entityId, action, page, pageSize: 20 }}
          revision={revision} onPageChange={changePage} showEntity />
      </section>
    </div>
  );
}
