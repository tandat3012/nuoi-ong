"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/features/auth";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { getBalanceQr, qrErrorMessage } from "./qr.api";

// Inventory labels resolve the balance, then open the inventory list on its item and warehouse.
export function QrInventoryLookup({ balanceId }: { balanceId: string }) {
  const { selectedFarmId, isLoading } = useAuthContext();
  const request = useAuthenticatedRequest();
  const router = useRouter();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    getBalanceQr(request, selectedFarmId, balanceId)
      .then(({ data }) => {
        if (!cancelled)
          router.replace(
            `/inventory?itemId=${data.balance.itemId}&warehouseId=${data.balance.warehouseId}`,
          );
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setError(
            qrErrorMessage(
              failure,
              "Không tìm thấy dòng tồn kho này trong trang trại đang chọn. Kiểm tra lại trang trại hoặc nhãn.",
            ),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [request, router, selectedFarmId, balanceId, attempt]);

  if (!isLoading && !selectedFarmId)
    return <p role="status">Chọn trang trại trước khi tra cứu tồn kho.</p>;
  if (error)
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <ErrorAlert
          message={error}
          onRetry={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}
        />
        <Link href="/scan" className="text-sm font-medium text-primary underline">
          Quét nhãn khác
        </Link>
      </div>
    );
  return <p role="status">Đang tìm dòng tồn kho…</p>;
}
