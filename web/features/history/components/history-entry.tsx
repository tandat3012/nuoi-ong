import Link from "next/link";
import { ASSET_HISTORY_STATUS_LABELS, ASSET_STATUS_LABELS } from "@/features/assets/types/asset";
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
    label: (key, value) => (valueLabels[key] ? label(valueLabels[key], value) : value),
  });
  const entityName = references[log.entityId] ?? "Không xác định";

  return (
    <article className="min-w-0 space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <time dateTime={log.createdAt} className="text-muted-foreground">
          {new Date(log.createdAt).toLocaleString("vi-VN")}
        </time>
        <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{historyActorLabel(log.actor)}</span>
        <Badge variant="outline">{label(HISTORY_ACTION_LABELS, log.action)}</Badge>
      </div>
      {showEntity && (
        <p className="break-words text-sm">
          {label(HISTORY_ENTITY_LABELS, log.entityType)} · {href
            ? <Link href={href} className="break-all text-primary underline">{entityName}</Link>
            : <span className="break-all">{entityName}</span>}
        </p>
      )}
      {changes.length ? (
        <dl className="space-y-2 text-sm">
          {changes.map((change) => (
            <div key={change.key} className="grid min-w-0 gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3">
              <dt className="break-words text-muted-foreground">{label(HISTORY_FIELD_LABELS, change.key)}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                <span className="sr-only">Trước: </span>{change.before}
                <span aria-hidden="true"> → </span><span className="sr-only">; Sau: </span>
                {change.after}
              </dd>
            </div>
          ))}
        </dl>
      ) : <p className="text-sm text-muted-foreground">Không có trường dữ liệu thay đổi.</p>}
    </article>
  );
}
