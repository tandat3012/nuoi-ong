'use client';

import * as React from 'react';
import { FileEdit, CheckCircle2, XCircle, ArrowRight, Warehouse, Building2, Calendar } from 'lucide-react';
import { RECEIPT_STATUS_LABELS, type Receipt } from '../types/receipt';
import { Button } from '@/shared/components/ui/button';
import { documentCodeLabel } from '@/features/stock-documents';

interface ReceiptTableProps {
  receipts: Receipt[];
  onOpen: (id: string) => void;
}

function formatReceiptDate(dateString: string) {
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  } catch {
    return dateString;
  }
}

export function ReceiptTable({ receipts, onOpen }: ReceiptTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
      <table className="w-full min-w-[950px] text-left text-sm">
        <caption className="sr-only">Danh sách phiếu nhập kho</caption>
        <thead className="border-b border-border bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3.5">Mã phiếu</th>
            <th scope="col" className="px-4 py-3.5">Ngày nhập</th>
            <th scope="col" className="px-4 py-3.5">Kho nhập</th>
            <th scope="col" className="px-4 py-3.5">Nhà cung cấp</th>
            <th scope="col" className="px-4 py-3.5">Trạng thái</th>
            <th scope="col" className="px-4 py-3.5">Ghi chú</th>
            <th scope="col" className="px-4 py-3.5 text-center w-28">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {receipts.map((receipt) => {
            const code = documentCodeLabel(receipt.receiptCode, receipt.id, 'PN');
            const isConfirmed = receipt.status === 'CONFIRMED';
            const isDraft = receipt.status === 'DRAFT';

            return (
              <tr
                key={receipt.id}
                onClick={() => onOpen(receipt.id)}
                className="group hover:bg-muted/40 transition-colors cursor-pointer"
              >
                {/* Receipt Code */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-foreground border border-border/80 group-hover:border-primary/40 group-hover:text-primary transition-colors">
                    {code}
                  </span>
                </td>

                {/* Receipt Date */}
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                    <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                    <span>{formatReceiptDate(receipt.receiptDate)}</span>
                  </div>
                </td>

                {/* Warehouse */}
                <td className="px-4 py-3">
                  {receipt.warehouseName ? (
                    <div>
                      <div className="font-semibold text-xs text-foreground flex items-center gap-1">
                        <Warehouse className="size-3 text-muted-foreground shrink-0" />
                        <span>{receipt.warehouseName}</span>
                      </div>
                      {receipt.warehouseCode && (
                        <div className="text-[0.7rem] font-mono text-muted-foreground pl-4">
                          {receipt.warehouseCode}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>

                {/* Supplier */}
                <td className="px-4 py-3">
                  {receipt.supplierName ? (
                    <div>
                      <div className="font-medium text-xs text-foreground flex items-center gap-1">
                        <Building2 className="size-3 text-muted-foreground shrink-0" />
                        <span>{receipt.supplierName}</span>
                      </div>
                      {receipt.supplierCode && (
                        <div className="text-[0.7rem] font-mono text-muted-foreground pl-4">
                          {receipt.supplierCode}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>

                {/* Status Semantic Badge */}
                <td className="whitespace-nowrap px-4 py-3">
                  {isConfirmed ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">
                      <CheckCircle2 className="size-3 shrink-0" />
                      <span>{RECEIPT_STATUS_LABELS[receipt.status]}</span>
                    </span>
                  ) : isDraft ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200/50">
                      <FileEdit className="size-3 shrink-0" />
                      <span>{RECEIPT_STATUS_LABELS[receipt.status]}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                      <XCircle className="size-3 shrink-0" />
                      <span>{RECEIPT_STATUS_LABELS[receipt.status]}</span>
                    </span>
                  )}
                </td>

                {/* Note */}
                <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                  <span className="line-clamp-2" title={receipt.note ?? undefined}>
                    {receipt.note || '—'}
                  </span>
                </td>

                {/* Action */}
                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpen(receipt.id)}
                    className="h-8 gap-1 text-xs font-medium text-primary hover:bg-secondary/60"
                    aria-label={`Chi tiết phiếu ${code}`}
                  >
                    <span>Chi tiết</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
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
