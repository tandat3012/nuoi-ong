"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { getAssets } from "@/features/assets/api/assets.api";
import { assetError } from "@/features/assets/asset.logic";
import {
  ASSET_STATUS_LABELS,
  type AssetView,
} from "@/features/assets/types/asset";
import { Combobox } from "@/shared/components/ui/combobox";

export function InventoryAssetFilter({
  farmId,
  warehouseId,
  itemId,
  value,
  disabled,
  selectedLabel,
  onChange,
}: {
  farmId: string;
  warehouseId?: string;
  itemId?: string;
  value?: string;
  disabled: boolean;
  selectedLabel?: string;
  onChange: (id?: string) => void;
}) {
  const request = useAuthenticatedRequest();
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<{
    search: string;
    attempt: number;
    rows: AssetView[];
    total: number;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (disabled) return;
    let alive = true;
    const timer = setTimeout(() => {
      void getAssets(request, farmId, {
        warehouseId,
        itemId,
        search,
        page: 1,
        pageSize: 50,
      })
        .then((response) => {
          if (alive)
            setResult({
              search,
              attempt,
              rows: response.data,
              total: response.page.totalItems,
            });
        })
        .catch((error) => {
          if (alive)
            setResult({
              search,
              attempt,
              rows: [],
              total: 0,
              error: assetError(error).message,
            });
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [request, farmId, warehouseId, itemId, search, attempt, disabled]);
  const current =
    result?.search === search && result.attempt === attempt ? result : null;
  return (
    <div className="grid gap-1.5 text-sm font-medium">
      <span>Tài sản</span>
      <Combobox
        aria-label="Tài sản"
        value={value ?? ""}
        disabled={disabled}
        onSearchChange={setSearch}
        loading={!disabled && !current}
        total={current?.total}
        selectedLabel={selectedLabel || label}
        placeholder={
          disabled ? "Chọn vật tư theo tài sản" : "Tìm mã tài sản hoặc serial"
        }
        emptyText="Không có tài sản phù hợp. Thử mã hoặc serial cụ thể hơn."
        options={[
          { value: "", label: "Tất cả tài sản" },
          ...(current?.rows ?? []).map(({ asset }) => ({
            value: asset.id,
            label: `${asset.assetCode}${asset.serialNumber ? ` · ${asset.serialNumber}` : ""}`,
            hint: ASSET_STATUS_LABELS[asset.status],
          })),
        ]}
        onChange={(id) => {
          const row = current?.rows.find(({ asset }) => asset.id === id);
          setLabel(row?.asset.assetCode ?? "");
          onChange(id || undefined);
        }}
      />
      {current?.error && (
        <p role="alert" className="text-sm font-normal text-destructive">
          {current.error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại
          </button>
        </p>
      )}
    </div>
  );
}
