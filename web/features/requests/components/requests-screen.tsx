"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthContext, useAuthenticatedRequest, useFarmMembership } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { Select } from "@/shared/components/ui/select";
import { getRequestById, getRequests } from "../api/requests.api";
import { parseRequestsQuery, REQUEST_STATUS_LABELS, requestsHref } from "../requests.logic";
import type { RequestDetail, RequestRow, RequestStatusFilter } from "../types/request";
import { RequestCard } from "./request-card";
import { requestFailureMessage } from "./request-error";
import { RequestReview } from "./request-review";

export function RequestsScreen() {
  const { selectedFarmId, isLoading, error } = useAuthContext();
  const { membership } = useFarmMembership();
  if (isLoading) return <p role="status">Đang tải thông tin trang trại…</p>;
  if (error) return <ErrorAlert message="Không thể tải quyền truy cập trang trại. Vui lòng tải lại trang." />;
  if (!selectedFarmId || !membership) return <p role="status">Vui lòng chọn trang trại để xem yêu cầu.</p>;
  return <FarmRequestsScreen key={`${selectedFarmId}:${membership.roles.join(",")}`} farmId={selectedFarmId} roles={membership.roles} />;
}

function FarmRequestsScreen({ farmId, roles }: { farmId: string; roles: readonly string[] }) {
  const request = useAuthenticatedRequest();
  const params = useSearchParams();
  const router = useRouter();
  const query = parseRequestsQuery(params, roles);
  const { type, status, page, id } = query;
  const [revision, setRevision] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [list, setList] = useState<{
    key: string;
    response?: PaginatedResponse<RequestRow>;
    error?: string;
  } | null>(null);
  const [detail, setDetail] = useState<{
    key: string;
    row?: RequestDetail;
    error?: string;
  } | null>(null);
  const listKey = `${type}:${status}:${page}:${revision}`;
  const detailKey = `${type}:${id}:${revision}`;
  const reload = () => setRevision((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    void getRequests(request, farmId, type, { status, page })
      .then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(1, response.page.totalPages);
        if (page > lastPage) {
          router.replace(requestsHref({ type, status, page: lastPage, id }), { scroll: false });
          return;
        }
        setList({ key: listKey, response });
      })
      .catch((failure) => {
        if (!cancelled) setList({ key: listKey, error: requestFailureMessage(failure) });
      });
    return () => { cancelled = true; };
  }, [request, farmId, type, status, page, listKey, router, id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getRequestById(request, farmId, type, id)
      .then(({ data }) => {
        if (!cancelled) setDetail({ key: detailKey, row: data });
      })
      .catch((failure) => {
        if (!cancelled) setDetail({ key: detailKey, error: requestFailureMessage(failure) });
      });
    return () => { cancelled = true; };
  }, [request, farmId, type, id, detailKey]);

  const currentList = list?.key === listKey ? list : null;
  const currentDetail = detail?.key === detailKey ? detail : null;
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Yêu cầu" description="Theo dõi yêu cầu bảo trì và chuyển tài sản trong trang trại." actions={
        <Button variant="outline" onClick={reload}>Tải lại</Button>
      } />
      <nav aria-label="Loại yêu cầu" className="flex flex-wrap gap-2">
        {(["maintenance", "transfer"] as const).map((value) => (
          <Link key={value} href={requestsHref({ ...query, type: value, page: 1, id: undefined })}
            aria-current={type === value ? "page" : undefined}
            className={`rounded-lg border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${type === value ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted"}`}>
            {value === "maintenance" ? "Bảo trì" : "Chuyển tài sản"}
          </Link>
        ))}
      </nav>
      <label className="block max-w-sm space-y-2 text-sm font-medium">
        Trạng thái yêu cầu
        <Select value={status} onChange={(event) => router.push(requestsHref({
          ...query, status: event.target.value as RequestStatusFilter, page: 1, id: undefined,
        }), { scroll: false })}>
          <option value="ALL">Tất cả</option>
          {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </label>
      {actionError && <ErrorAlert message={actionError} />}
      {id && (
        <section aria-label="Chi tiết yêu cầu" className="min-w-0 rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <h2 className="font-semibold">Chi tiết yêu cầu</h2>
            <Link href={requestsHref({ ...query, id: undefined })} className="text-sm text-primary underline">Đóng chi tiết</Link>
          </div>
          {!currentDetail ? <p role="status" className="p-5">Đang tải yêu cầu…</p>
            : currentDetail.error ? <ErrorAlert className="m-4" message={currentDetail.error} onRetry={reload} />
              : currentDetail.row && <RequestCard row={currentDetail.row} detail>
                <RequestReview farmId={farmId} row={currentDetail.row} roles={roles} onChanged={reload} onError={setActionError} />
              </RequestCard>}
        </section>
      )}
      <section aria-label="Danh sách yêu cầu" className="min-w-0 rounded-xl border bg-card">
        <h2 className="border-b p-5 font-semibold">Danh sách yêu cầu</h2>
        {!currentList ? <p role="status" className="p-5">Đang tải danh sách…</p>
          : currentList.error ? <ErrorAlert className="m-4" message={currentList.error} onRetry={reload} />
            : currentList.response && <>
              {!currentList.response.data.length && <p role="status" className="p-5 text-sm text-muted-foreground">Chưa có yêu cầu phù hợp.</p>}
              <ul className="divide-y">
                {currentList.response.data.map((row) => <li key={row.id}>
                  <RequestCard row={row} href={requestsHref({ ...query, id: row.id })}>
                    <RequestReview farmId={farmId} row={row} roles={roles} onChanged={reload} onError={setActionError} />
                  </RequestCard>
                </li>)}
              </ul>
              <Pagination pageInfo={currentList.response.page} itemLabel="yêu cầu" onPageChange={(nextPage) => router.push(
                requestsHref({ ...query, page: nextPage, id: undefined }), { scroll: false },
              )} />
            </>}
      </section>
    </div>
  );
}
