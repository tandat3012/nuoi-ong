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
  const [salesWarehouseId, setSalesWarehouseId] = useState("");
  const [sourceWarehouseIds, setSourceWarehouseIds] = useState<string[]>([]);
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
        setSalesWarehouseId(settingsResponse.data.salesWarehouse?.id ?? "");
        setSourceWarehouseIds(settingsResponse.data.sourceWarehouses.map(({ id }) => id));
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
      const salesWarehouseId =
        String(data.get("salesWarehouseId")) || undefined;
      const response = await saveStoreSettings(request, farmId, {
        salesWarehouseId,
        salesEnabled: data.get("salesEnabled") === "on",
        regions: data.getAll("regions").map(String) as StoreRegion[],
        // The sales warehouse cannot top itself up.
        sourceWarehouseIds: data
          .getAll("sourceWarehouseIds")
          .map(String)
          .filter((id) => id !== salesWarehouseId),
      });
      setSettings(response.data);
      setSalesWarehouseId(response.data.salesWarehouse?.id ?? "");
      setSourceWarehouseIds(response.data.sourceWarehouses.map(({ id }) => id));
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
      <CardContent className="pt-5 sm:pt-6">
        <form
          action={submit}
          className="space-y-6"
          key={JSON.stringify(settings)}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">
                Cấu hình bán hàng của trại
              </h2>
              <p className="text-sm text-muted-foreground">
                Đơn online chỉ xuất từ kho bán hàng, giao cho khách ở các miền
                đã chọn.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Đã lưu:
              <Badge variant={settings.salesEnabled ? "success" : "outline"}>
                {settings.salesEnabled ? "Đang bán online" : "Chưa bán online"}
              </Badge>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <label className="block space-y-2 text-sm">
              <span className="font-medium">Kho bán hàng</span>
              <span className="block text-muted-foreground">
                Kho đang lưu: {settings.salesWarehouse
                  ? `${settings.salesWarehouse.code} — ${settings.salesWarehouse.name}`
                  : "Chưa chọn"}.
              </span>
              <Select
                name="salesWarehouseId"
                value={salesWarehouseId}
                onChange={(event) => setSalesWarehouseId(event.target.value)}
              >
                <option value="">Chưa chọn</option>
                {settings.salesWarehouse && !warehouses.some(({ id }) => id === settings.salesWarehouse?.id) && (
                  <option value={settings.salesWarehouse.id}>
                    {settings.salesWarehouse.code} — {settings.salesWarehouse.name}
                    {settings.salesWarehouse.status !== "ACTIVE" && " (không hoạt động)"}
                  </option>
                )}
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </Select>
            </label>
            <fieldset className="space-y-2 text-sm">
              <legend className="font-medium">Miền phục vụ</legend>
              <p className="text-muted-foreground">Chọn khu vực nhận đơn online.</p>
              <div className="flex flex-wrap gap-2">
                {regions.map((region) => (
                  <label key={region} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 transition-colors hover:border-primary/50 has-checked:border-primary has-checked:bg-primary/5">
                    <input
                      type="checkbox"
                      name="regions"
                      value={region}
                      defaultChecked={settings.regions.includes(region)}
                      className="size-4 accent-primary"
                    />
                    {storeRegionLabels[region]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <fieldset className="space-y-3 border-t border-border pt-5 text-sm">
            <legend className="font-medium">Kho nguồn bù hàng</legend>
            <p className="max-w-3xl text-muted-foreground">
              Tồn ở các kho được chọn sẽ được tính để bán. Khi thiếu hàng, hệ
              thống tạo phiếu chuyển nháp về kho bán.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {warehouses.filter(({ id }) => id !== salesWarehouseId).map((warehouse) => (
                <label key={warehouse.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 transition-colors hover:border-primary/50 has-checked:border-primary has-checked:bg-primary/5">
                  <input
                    type="checkbox"
                    name="sourceWarehouseIds"
                    value={warehouse.id}
                    checked={sourceWarehouseIds.includes(warehouse.id)}
                    onChange={(event) => setSourceWarehouseIds((current) =>
                      event.target.checked
                        ? [...current, warehouse.id]
                        : current.filter((id) => id !== warehouse.id),
                    )}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{warehouse.name}</span>
                    <span className="block text-xs text-muted-foreground">{warehouse.code}</span>
                  </span>
                </label>
              ))}
            </div>
            {!warehouses.some(({ id }) => id !== salesWarehouseId) && (
              <p className="text-muted-foreground">Không có kho nguồn khả dụng.</p>
            )}
          </fieldset>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <input
              type="checkbox"
              name="salesEnabled"
              defaultChecked={settings.salesEnabled}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block font-medium">Bật bán online</span>
              <span className="mt-1 block text-muted-foreground">
                Cần chọn kho bán hàng và ít nhất một miền phục vụ.
              </span>
            </span>
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
