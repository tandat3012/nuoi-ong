"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { Button } from "@/shared/components/ui/button";
import { getReceiptLots } from "../api/receipts.api";
import type { ReceiptLotReference } from "../types/receipt";
import { lotChoice, type DraftChoice } from "./receipt-draft-picker";

const LOOKUP_DELAY_MS = 400;

/**
 * Advisory only: lists lots of the same item whose printed number matches exactly.
 * Equal numbers do not prove the same batch, so reuse needs an explicit click and
 * a failed lookup just hides the hint.
 */
export function SupplierLotMatches({
  farmId,
  itemId,
  supplierLotNumber,
  onUse,
}: {
  farmId: string;
  itemId: string;
  supplierLotNumber: string;
  onUse: (choice: DraftChoice) => void;
}) {
  const request = useAuthenticatedRequest();
  const number = supplierLotNumber.trim();
  const [result, setResult] = useState<{
    key: string;
    lots: ReceiptLotReference[];
  } | null>(null);
  const key = `${itemId}\u0000${number}`;
  useEffect(() => {
    if (!number) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      getReceiptLots(request, farmId, {
        page: 1,
        pageSize: 5,
        itemId,
        supplierLotNumber: number,
      })
        .then(({ data }) => {
          if (!cancelled) setResult({ key, lots: data });
        })
        .catch(() => {
          if (!cancelled) setResult(null);
        });
    }, LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [farmId, itemId, key, number, request]);

  const lots = number && result?.key === key ? result.lots : [];
  if (!lots.length) return null;
  return (
    <div
      role="status"
      className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-normal text-amber-950 sm:col-span-3 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p>
        Đã có {lots.length} lô cùng số lô trên hàng “{number}”. Số trùng không có
        nghĩa là cùng lô; chỉ chọn lô có sẵn khi đã kiểm tra hàng.
      </p>
      <ul className="space-y-1">
        {lots.map((lot) => {
          const choice = lotChoice(lot);
          return (
            <li key={lot.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{lot.lotCode}</span>
              {choice.hint && <span>{choice.hint}</span>}
              {lot.sourceSupplierName && <span>· NCC {lot.sourceSupplierName}</span>}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onUse(choice)}
              >
                Nhập thêm vào lô này
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
