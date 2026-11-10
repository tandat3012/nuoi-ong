import {
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  type Issue,
  type IssueStatus,
  type IssueType,
} from "../types/issue";
import { Button } from '@/shared/components/ui/button';
import { documentCodeLabel } from "@/features/stock-documents";
import { ArrowUpRight } from "lucide-react";

const STATUS_CONFIG: Record<
  IssueStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  CONFIRMED: {
    label: "Đã xác nhận",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  DRAFT: {
    label: "Nháp",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  PENDING_APPROVAL: {
    label: "Chờ duyệt",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
  },
  CANCELLED: {
    label: "Đã hủy",
    dotClass: "bg-zinc-400",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  REJECTED: {
    label: "Đã từ chối",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
};

const TYPE_CONFIG: Record<
  IssueType,
  { badgeClass: string }
> = {
  CONSUMPTION: {
    badgeClass: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
  },
  SALE: {
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  MAINTENANCE: {
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  DAMAGE: {
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  DISPOSAL: {
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  OTHER: {
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

export function IssueTable({
  issues,
  onOpen,
}: {
  issues: Issue[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Danh sách phiếu xuất kho</caption>
        <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">Mã phiếu</th>
            <th scope="col" className="px-4 py-3">Ngày xuất</th>
            <th scope="col" className="px-4 py-3">Kho nguồn</th>
            <th scope="col" className="px-4 py-3">Loại phiếu</th>
            <th scope="col" className="px-4 py-3">Trạng thái</th>
            <th scope="col" className="px-4 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {issues.map((issue) => {
            const statusConfig = STATUS_CONFIG[issue.status] ?? {
              label: ISSUE_STATUS_LABELS[issue.status] ?? issue.status,
              dotClass: "bg-zinc-400",
              badgeClass: "bg-muted text-muted-foreground border-border",
            };
            const typeConfig = TYPE_CONFIG[issue.issueType] ?? {
              badgeClass: "bg-muted text-muted-foreground border-border",
            };
            const code = documentCodeLabel(issue.issueCode, issue.id, "PX");

            return (
              <tr
                key={issue.id}
                className="transition-colors hover:bg-muted/30 focus-within:bg-muted/30"
              >
                {/* Issue Code */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                    {code}
                  </span>
                </td>

                {/* Issue Date */}
                <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted-foreground">
                  {issue.issueDate ? issue.issueDate.split("-").reverse().join("/") : "—"}
                </td>

                {/* Warehouse */}
                <td className="px-4 py-3">
                  {issue.warehouseName ? (
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground text-xs">
                        {issue.warehouseName}
                      </span>
                      {issue.warehouseCode && (
                        <span className="font-mono text-[0.6875rem] text-muted-foreground">
                          {issue.warehouseCode}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Không có thông tin kho</span>
                  )}
                </td>

                {/* Issue Type */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeConfig.badgeClass}`}
                  >
                    {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                  </span>
                </td>

                {/* Status */}
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusConfig.badgeClass}`}
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${statusConfig.dotClass}`}
                      aria-hidden="true"
                    />
                    {statusConfig.label}
                  </span>
                </td>

                {/* Actions */}
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    onClick={() => onOpen(issue.id)}
                    aria-label={`Chi tiết phiếu ${code}`}
                    className="h-8 gap-1 px-2.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <span>Chi tiết</span>
                    <ArrowUpRight className="size-3.5 opacity-60" aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
