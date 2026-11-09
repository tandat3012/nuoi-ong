'use client';

import { useMemo } from 'react';
import type { Issue } from '../types/issue';
import { ISSUE_TYPE_LABELS } from '../types/issue';
import {
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  Layers,
} from 'lucide-react';

export function IssueSummaryBar({
  issues,
  totalItems,
}: {
  issues: Issue[];
  totalItems?: number;
}) {
  const summary = useMemo(() => {
    const total = totalItems ?? issues.length;
    let draftCount = 0;
    let confirmedCount = 0;
    const typeCountMap: Record<string, number> = {};

    for (const item of issues) {
      if (item.status === 'DRAFT' || item.status === 'PENDING_APPROVAL') {
        draftCount++;
      } else if (item.status === 'CONFIRMED') {
        confirmedCount++;
      }

      if (item.issueType) {
        typeCountMap[item.issueType] = (typeCountMap[item.issueType] ?? 0) + 1;
      }
    }

    // Find the most frequent issue type
    let topType = 'CONSUMPTION';
    let maxCount = 0;
    for (const [type, count] of Object.entries(typeCountMap)) {
      if (count > maxCount) {
        maxCount = count;
        topType = type;
      }
    }

    return {
      total,
      draftCount,
      confirmedCount,
      topTypeName: ISSUE_TYPE_LABELS[topType as keyof typeof ISSUE_TYPE_LABELS] ?? 'Xuất sử dụng',
      topTypeCount: maxCount,
    };
  }, [issues, totalItems]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Total Issues */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Tổng phiếu xuất</span>
          <FileSpreadsheet className="size-4 text-primary" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-foreground tabular-nums">
          {summary.total}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Toàn bộ phiếu trong hệ thống</p>
      </div>

      {/* Pending / Drafts */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Chờ xuất / Nháp</span>
          <Clock className="size-4 text-amber-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
          {summary.draftCount}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Cần kiểm tra hoặc xác nhận</p>
      </div>

      {/* Confirmed */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Đã xuất kho</span>
          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
          {summary.confirmedCount}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Đã trừ tồn kho thành công</p>
      </div>

      {/* Top Issue Type */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Loại xuất chính</span>
          <Layers className="size-4 text-indigo-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 truncate text-base font-bold tracking-tight text-foreground">
          {summary.topTypeName}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
          {summary.topTypeCount > 0 ? `${summary.topTypeCount} phiếu gần đây` : 'Chưa có phân loại'}
        </p>
      </div>
    </div>
  );
}
