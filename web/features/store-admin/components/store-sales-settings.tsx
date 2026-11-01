"use client";

import { useEffect, useState } from "react";
import { useAuthContext, useAuthenticatedRequest } from "@/features/auth";
import { getWarehouses } from "@/features/warehouses/api/warehouses.api";
import type { Warehouse } from "@/features/warehouses/types/warehouse";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Select } from "@/shared/components/ui/select";
import { getStoreSettings, saveStoreSettings } from "../api/store-admin.api";
import { storeAdminError, storeRegionLabels } from "../store-admin.logic";
import type { StoreRegion, StoreSettings } from "../types/store-admin";

const regions = Object.keys(storeRegionLabels) as StoreRegion[];

/** The farm's own sales warehouse and served regions; owners and admins only. */
export function StoreSalesSettings({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  // storeFarmIds in /auth/me gates the order, payment and report screens.
  const { refresh } = useAuthContext();
  const [settings, setSettings] = useState<StoreSettings>();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getStoreSettings(request, farmId),
      getWarehouses(request, {
        farmId,
        status: "ACTIVE",
        page: 1,
        pageSize: 100,
      }),
    ])
      .then(([settingsResponse, warehouseResponse]) => {
        if (cancelled) return;
        setSettings(settingsResponse.data);
        setWarehouses(warehouseResponse.data);
      })
      .catch((failure) => !cancelled && setError(storeAdminError(failure)));
    return () => {
      cancelled = true;
    };
  }, [request, farmId]);

  if (!settings) return error ? <ErrorAlert message={error} /> : null;

  const submit = async (data: FormData) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await saveStoreSettings(request, farmId, {
        salesWarehouseId: String(data.get("salesWarehouseId")) || undefined,
        salesEnabled: data.get("salesEnabled") === "on",
        regions: data.getAll("regions").map(String) as StoreRegion[],
      });
      setSettings(response.data);
      setSaved(true);
      refresh();
    } catch (failure) {
      setError(storeAdminError(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          action={submit}
          className="space-y-4"
          key={JSON.stringify(settings)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                Cấu hình bán hàng của trại
              </h2>
              <p className="text-sm text-muted-foreground">
                Đơn online chỉ xuất từ kho bán hàng, giao cho khách ở các miền
                đã chọn.
              </p>
            </div>
            <Badge variant={settings.salesEnabled ? "success" : "outline"}>
              {settings.salesEnabled ? "Đang bán online" : "Chưa bán online"}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              Kho bán hàng
              <Select
                name="salesWarehouseId"
                defaultValue={settings.salesWarehouse?.id ?? ""}
              >
                <option value="">Chưa chọn</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </Select>
            </label>
            <fieldset className="space-y-2 text-sm">
              <legend className="font-medium">Miền phục vụ</legend>
              <div className="flex flex-wrap gap-4 pt-2">
                {regions.map((region) => (
                  <label key={region} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="regions"
                      value={region}
                      defaultChecked={settings.regions.includes(region)}
                      className="size-4"
                    />
                    {storeRegionLabels[region]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="salesEnabled"
              defaultChecked={settings.salesEnabled}
              className="size-4"
            />
            Bật bán online (cần kho bán và ít nhất một miền)
          </label>
          {error && <ErrorAlert message={error} />}
          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={saving}>
              Lưu cấu hình
            </Button>
            {saved && (
              <span role="status" className="text-sm text-muted-foreground">
                Đã lưu.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
