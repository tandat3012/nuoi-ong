"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import {
  getStoreShippingFees,
  type StoreShippingFees,
} from "@/features/commerce/orders/shipping-fees.api";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { formatVndCurrency } from "@/shared/lib/currency";
import { saveStoreShippingFees } from "../api/store-admin.api";
import {
  isVndAmount,
  storeAdminError,
  storeRegionLabels,
} from "../store-admin.logic";
import type { StoreRegion } from "../types/store-admin";

const regions = Object.keys(storeRegionLabels) as StoreRegion[];

/** Store-wide delivery fee per region; everyone on the page sees it, only ADMIN edits (D09). */
export function StoreShippingFeesCard({
  farmId,
  canEdit,
}: {
  farmId: string;
  canEdit: boolean;
}) {
  const request = useAuthenticatedRequest();
  const [fees, setFees] = useState<StoreShippingFees>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStoreShippingFees()
      .then((data) => !cancelled && setFees(data))
      .catch(() => !cancelled && setError("Không tải được phí giao hàng."));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fees) return error ? <ErrorAlert message={error} /> : null;

  const submit = async (data: FormData) => {
    const input = Object.fromEntries(
      regions.map((region) => [region, String(data.get(region)).trim()]),
    ) as StoreShippingFees;
    if (!regions.every((region) => isVndAmount(input[region]))) {
      setError("Phí giao hàng phải là số tiền VNĐ nguyên, không âm.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      setFees((await saveStoreShippingFees(request, farmId, input)).data);
      setSaved(true);
    } catch (failure) {
      setError(storeAdminError(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-5 sm:pt-6">
        <form action={submit} className="space-y-5" key={JSON.stringify(fees)}>
          <div className="space-y-1 border-b border-border pb-4">
            <h2 className="text-base font-semibold">Phí giao hàng theo miền</h2>
            <p className="text-sm text-muted-foreground">
              Dùng chung cho mọi trại. Phí được cộng vào tổng đơn lúc khách đặt;
              đơn đã đặt giữ nguyên phí cũ.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {regions.map((region) => (
              <label key={region} className="block space-y-1 text-sm">
                <span className="font-medium">{storeRegionLabels[region]}</span>
                {canEdit ? (
                  <Input
                    name={region}
                    inputMode="numeric"
                    required
                    defaultValue={fees[region]}
                    aria-describedby={`fee-${region}`}
                  />
                ) : null}
                <span
                  id={`fee-${region}`}
                  className="block text-muted-foreground"
                >
                  Đang áp dụng: {formatVndCurrency(Number(fees[region]))}
                </span>
              </label>
            ))}
          </div>
          {error && <ErrorAlert message={error} />}
          {canEdit ? (
            <div className="flex items-center gap-3">
              <Button type="submit" isLoading={saving}>
                Lưu phí giao hàng
              </Button>
              {saved && (
                <span role="status" className="text-sm text-muted-foreground">
                  Đã lưu.
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Phí giao hàng dùng chung mọi trại, chỉ quản trị viên (ADMIN) được sửa.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
