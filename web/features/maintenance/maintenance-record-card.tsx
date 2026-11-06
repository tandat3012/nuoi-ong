import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Wrench,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/shared/components/ui/badge";
import { formatAssetPrice } from "@/features/assets/asset.logic";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
  RETURN_STATUSES,
  maintenanceDate,
  maintenanceCountdown,
  maintenanceNextStep,
  type MaintenanceWorkflow,
} from "./maintenance.logic";

export type MaintenanceRecord = MaintenanceWorkflow & {
  id: string;
  assetId: string;
  assetCode: string | null;
  maintenanceType: string;
  scheduledAt: string | null;
  description: string | null;
  totalCost: string | null;
  supplierId: string | null;
  expectedReturnAt: string | null;
  receivedAt: string | null;
  startedAt: string | null;
  issuedByMemberId: string | null;
  issuedByName: string | null;
  returnWarehouseName: string | null;
  returnLocationName: string | null;
  resultNote: string | null;
  returnRejectionReason: string | null;
  nextDueDate: string | null;
  alert: string | null;
  returnCode: string;
};
const tones: Record<string, BadgeProps["variant"]> = {
  SCHEDULED: "outline",
  IN_PROGRESS: "info",
  RECEIVED: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
};
export function MaintenanceRecordCard({
  record,
  roles,
  now,
  actions,
}: {
  record: MaintenanceRecord;
  roles: readonly string[];
  now: number;
  actions?: ReactNode;
}) {
  const terminal = ["COMPLETED", "FAILED", "CANCELLED"].includes(record.status);
  return (
    <article
      aria-labelledby={`maintenance-${record.id}`}
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xs"
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
              <Wrench className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <h2
                id={`maintenance-${record.id}`}
                className="break-words text-base font-semibold leading-snug"
              >
                <Link
                  className="rounded-sm text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  href={`/assets/${encodeURIComponent(record.assetId)}`}
                >
                  {record.assetCode || "Tài sản chưa có mã"}
                </Link>
              </h2>
              <p className="text-sm text-muted-foreground">
                {MAINTENANCE_TYPES[record.maintenanceType] ??
                  record.maintenanceType}
              </p>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Badge
              variant={tones[record.status] ?? "outline"}
              className="gap-1.5 px-2.5 py-1"
            >
              {record.status === "COMPLETED" ? (
                <CheckCircle2
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              {MAINTENANCE_STATUSES[record.status] ?? record.status}
            </Badge>
            {record.alert && (
              <Badge variant="warning" className="gap-1.5 px-2.5 py-1">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                {record.alert}
              </Badge>
            )}
          </div>
        </div>
        <dl className="grid gap-4 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Lịch bảo trì
            </dt>
            <dd className="mt-1.5 font-medium tabular-nums">
              {maintenanceDate(record.scheduledAt)}
            </dd>
          </div>
          {record.expectedReturnAt && (
            <div>
              <dt className="text-xs text-muted-foreground">
                Hẹn trả thiết bị
              </dt>
              <dd className="mt-1.5 font-medium tabular-nums">
                {maintenanceDate(record.expectedReturnAt)}
              </dd>
            </div>
          )}
          {record.startedAt && (
            <div>
              <dt className="text-xs text-muted-foreground">
                {/* Records started before T05 have no warehouse confirmation. */}
                {record.issuedByMemberId ? "Kho xác nhận xuất" : "Gửi sửa"}
              </dt>
              <dd className="mt-1.5 font-medium tabular-nums">
                {maintenanceDate(record.startedAt)}
                {record.issuedByName && ` · ${record.issuedByName}`}
              </dd>
            </div>
          )}
          {record.receivedAt && (
            <div>
              <dt className="text-xs text-muted-foreground">
                Nhận lại thực tế
              </dt>
              <dd className="mt-1.5 font-medium tabular-nums">
                {maintenanceDate(record.receivedAt)}
              </dd>
            </div>
          )}
          <div className="sm:col-start-2 lg:col-start-4">
            <dt className="text-xs text-muted-foreground">Tổng chi phí</dt>
            <dd className="mt-1.5 break-words font-semibold tabular-nums">
              {formatAssetPrice(record.totalCost?.replace(/\.0+$/, "") ?? null)}
            </dd>
          </div>
        </dl>
        {record.description && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {record.description}
          </p>
        )}
        {record.resultNote && (
          <div className="border-l-2 border-border pl-3">
            <p className="text-xs font-medium text-muted-foreground">
              Kết quả nghiệm thu
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {record.resultNote}
            </p>
          </div>
        )}
        {record.nextDueDate && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">Kỳ bảo trì tiếp theo</span>
            <span className="font-medium tabular-nums">
              {maintenanceDate(record.nextDueDate, false)}
            </span>
            <span className="text-muted-foreground">
              {maintenanceCountdown(record.nextDueDate, now)}
            </span>
          </div>
        )}
        {record.returnStatus && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <PackageCheck className="size-4 shrink-0" aria-hidden="true" />
                Nhập lại kho
              </p>
              <Badge
                variant={
                  record.returnStatus === "CONFIRMED"
                    ? "success"
                    : record.returnStatus === "REJECTED"
                      ? "destructive"
                      : "warning"
                }
              >
                {RETURN_STATUSES[record.returnStatus] ?? record.returnStatus}
              </Badge>
            </div>
            {record.returnWarehouseName && (
              <p className="break-words text-sm">
                {[record.returnWarehouseName, record.returnLocationName]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <p className="break-all text-xs text-muted-foreground">
              Phiếu {record.returnCode}
            </p>
            {record.returnRejectionReason && (
              <p className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="whitespace-pre-wrap break-words">
                  Lý do từ chối: {record.returnRejectionReason}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="flex min-w-0 items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          {terminal && !record.receivedAt ? (
            <CheckCircle2
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <ArrowRight
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>{maintenanceNextStep(record, roles)}</span>
        </p>
        {actions}
      </div>
    </article>
  );
}
