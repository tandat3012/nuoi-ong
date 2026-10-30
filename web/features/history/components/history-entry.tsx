import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ASSET_HISTORY_STATUS_LABELS, ASSET_STATUS_LABELS } from "@/features/assets/types/asset";
import { formatInventoryQuantity } from "@/features/inventory/inventory.logic";
import { ISSUE_TYPE_LABELS } from "@/features/issues/types/issue";
import { ROLE_LABELS } from "@/features/personnel/types";
import { notificationHref } from "@/features/notifications/notifications.logic";
import { RECEIPT_STATUS_LABELS } from "@/features/receipts/types/receipt";
import { REQUEST_MAINTENANCE_LABELS, REQUEST_STATUS_LABELS } from "@/features/requests/requests.logic";
import { Badge } from "@/shared/components/ui/badge";
import {
  HISTORY_ACTION_LABELS, HISTORY_ENTITY_LABELS, HISTORY_FIELD_LABELS,
  historyActorLabel, historyChanges,
} from "../history.logic";
import type { AuditLog } from "../types/history";

const label = (labels: Record<string, string>, value: string) =>
  Object.hasOwn(labels, value) ? labels[value] : value;

export function HistoryEntry({ log, references, showEntity }: {
  log: AuditLog;
  references: Record<string, string>;
  showEntity: boolean;
}) {
  const href = showEntity ? notificationHref(log.entityType, log.entityId) : null;
  const statusLabels: Record<string, string> = log.entityType === "ASSET"
    ? { ...ASSET_STATUS_LABELS, ...ASSET_HISTORY_STATUS_LABELS }
    : log.entityType.endsWith("_REQUEST")
      ? REQUEST_STATUS_LABELS
      : { ...RECEIPT_STATUS_LABELS, COUNTING: "Đang kiểm" };
  const valueLabels: Record<string, Record<string, string>> = {
    status: statusLabels,
    membershipStatus: { ACTIVE: "Đang hoạt động", INACTIVE: "Ngừng hoạt động" },
    issueType: ISSUE_TYPE_LABELS,
    maintenanceType: REQUEST_MAINTENANCE_LABELS,
    roleCodes: ROLE_LABELS,
  };
  const changes = historyChanges(log, {
    references,
    label: (key, value) =>
      valueLabels[key]
        ? label(valueLabels[key], value)
        : /quantity|difference/i.test(key) && /^-?\d+(\.\d+)?$/.test(value)
          ? formatInventoryQuantity(value)
          : value,
  });
  const entityName = references[log.entityId] ?? "Không xác định";
  const initial = !log.oldData || log.action === "CREATE" || log.action === "ASSET_CREATED";

  return (
    <article className="min-w-0 space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{historyActorLabel(log.actor)}</span>
          <Badge className="max-w-full whitespace-normal">{label(HISTORY_ACTION_LABELS, log.action)}</Badge>
        </div>
        <time dateTime={log.createdAt} className="shrink-0 text-xs leading-6 tabular-nums text-muted-foreground">
          {new Date(log.createdAt).toLocaleString("vi-VN")}
        </time>
      </div>
      {showEntity && (
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span className="text-muted-foreground">{label(HISTORY_ENTITY_LABELS, log.entityType)}</span>
          {href
            ? <Link href={href} className="min-w-0 break-words font-medium text-primary underline-offset-4 hover:underline [overflow-wrap:anywhere]">{entityName}</Link>
            : <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{entityName}</span>}
        </p>
      )}
      {changes.length ? (
        <div className="overflow-hidden rounded-lg border">
          <div aria-hidden="true" className="hidden gap-4 border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[9rem_minmax(0,1fr)]">
            <span>{initial ? "Trường dữ liệu" : "Trường thay đổi"}</span>
            {initial ? <span>Giá trị ban đầu</span> : <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] gap-3">
              <span>Trước</span><span /><span>Sau</span>
            </div>}
          </div>
          <dl className="divide-y text-sm">
            {changes.map((change) => (
              <div key={change.key} className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                <dt className="break-words font-medium leading-6">{label(HISTORY_FIELD_LABELS, change.key)}</dt>
                <dd className={`grid min-w-0 gap-2 leading-6 ${initial ? "" : "sm:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] sm:gap-3"}`}>
                  {!initial && <>
                    <div className="min-w-0 whitespace-pre-wrap break-words text-muted-foreground [overflow-wrap:anywhere]">
                      <span className="mr-2 inline-block text-xs font-medium sm:sr-only">Trước: </span>{change.before}
                    </div>
                    <ArrowRight className="mt-1 hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
                  </>}
                  <div className="min-w-0 whitespace-pre-wrap break-words font-medium [overflow-wrap:anywhere]">
                    <span className={initial ? "sr-only" : "mr-2 inline-block text-xs text-muted-foreground sm:sr-only"}>
                      {initial ? "Giá trị ban đầu: " : "Sau: "}
                    </span>{change.after}
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : <p className="text-sm text-muted-foreground">Không có trường dữ liệu thay đổi.</p>}
    </article>
  );
}
