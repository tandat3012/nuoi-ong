import Link from "next/link";
import type { ReactNode } from "react";
import { RejectionNotice } from "@/features/stock-documents";
import { Badge } from "@/shared/components/ui/badge";
import {
  REQUEST_MAINTENANCE_LABELS,
  REQUEST_STATUS_LABELS,
  transferDestination,
} from "../requests.logic";
import type { RequestRow, RequestDetail } from "../types/request";

function RequestTime({ value }: { value: string | null }) {
  return value ? <time dateTime={value}>{new Date(value).toLocaleString("vi-VN")}</time> : <>—</>;
}

export function RequestCard({ row, href, detail = false, children }: {
  row: RequestRow | RequestDetail;
  href?: string;
  detail?: boolean;
  children?: ReactNode;
}) {
  const maintenance = "maintenanceType" in row;
  const person = (name: string | null | undefined, email: string | null | undefined) =>
    name || email || (href ? <Link href={href} className="text-primary underline">Xem trong chi tiết</Link> : "Chưa có tên");
  return (
    <article className="min-w-0 space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href={`/assets/${encodeURIComponent(row.assetId)}`} className="break-words font-semibold text-primary underline">
            {row.assetCode} — {row.itemName}
          </Link>
          <p className="break-words text-sm text-muted-foreground">
            {maintenance ? REQUEST_MAINTENANCE_LABELS[row.maintenanceType] : transferDestination(row)}
          </p>
        </div>
        <Badge variant={row.status === "PENDING_APPROVAL" ? "warning" : row.status === "CONFIRMED" ? "success" : "destructive"}>
          {REQUEST_STATUS_LABELS[row.status]}
        </Badge>
      </div>
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Người gửi</dt>
          <dd className="mt-1 break-words">{person(row.requestedByName, row.requestedByEmail)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Thời gian gửi</dt>
          <dd className="mt-1"><RequestTime value={row.createdAt} /></dd>
        </div>
        {row.status !== "PENDING_APPROVAL" && (
          <>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Người xử lý</dt>
              <dd className="mt-1 break-words">{person(row.reviewedByName, row.reviewedByEmail)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Thời gian xử lý</dt>
              <dd className="mt-1"><RequestTime value={row.reviewedAt} /></dd>
            </div>
          </>
        )}
        {detail && !maintenance && (
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Vị trí nguồn</dt>
            <dd className="mt-1 break-words">{row.fromLocationName || row.fromLocationCode || "Chưa có tên"}</dd>
          </div>
        )}
        {detail && "maintenanceScheduledAt" in row && row.maintenanceScheduledAt && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Lịch bảo trì đã duyệt</dt>
            <dd className="mt-1"><RequestTime value={row.maintenanceScheduledAt} /></dd>
          </div>
        )}
      </dl>
      {detail && (
        <p className="whitespace-pre-wrap break-words text-sm">
          {maintenance ? row.description : row.note || "Không có ghi chú."}
        </p>
      )}
      {row.status === "REJECTED" && <RejectionNotice reason={row.rejectionReason} />}
      <div className="flex flex-wrap items-center gap-3">
        {href && <Link href={href} className="text-sm text-primary underline">Xem yêu cầu</Link>}
        {maintenance && row.status === "CONFIRMED" && row.maintenanceRecordId && (
          <Link href="/maintenance" className="text-sm text-primary underline">Mở hồ sơ bảo trì</Link>
        )}
        {children}
      </div>
    </article>
  );
}
