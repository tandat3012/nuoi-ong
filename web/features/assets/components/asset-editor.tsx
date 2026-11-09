"use client";

import { useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Input } from "@/shared/components/ui/input";
import { DateInput } from "@/shared/components/ui/date-input";
import { Textarea } from "@/shared/components/ui/textarea";
import { createAsset, updateAsset } from "../api/assets.api";
import type { Asset, AssetChoice, AssetMetadataInput } from "../types/asset";
import { AssetLookup } from "./asset-lookup";
import {
  AssetMutationDialog,
  type AssetMutationFeedback,
} from "./asset-mutation-dialog";

export function AssetEditor({
  farmId,
  asset,
  ...feedback
}: AssetMutationFeedback & { farmId: string; asset?: Asset }) {
  const request = useAuthenticatedRequest();
  const [item, setItem] = useState<AssetChoice | null>(null);
  const [warehouse, setWarehouse] = useState<AssetChoice | null>(null);
  const [location, setLocation] = useState<AssetChoice | null>(null);

  return (
    <AssetMutationDialog
      {...feedback}
      title={asset ? "Sửa thông tin tài sản" : "Thêm tài sản"}
      description={
        asset
          ? `${asset.assetCode} · Thay đổi được lưu vào lịch sử. Tồn kho và vị trí chỉ thay đổi qua nghiệp vụ.`
          : "Đăng ký một tài sản đang có thực tế tại kho. Hệ thống tăng tồn kho 1 và ghi sổ nhập; không dùng cho tài sản đã được tạo từ phiếu nhập."
      }
      submitLabel={asset ? "Lưu thông tin" : "Tạo tài sản và ghi nhập kho"}
      disabled={!asset && (!item || !warehouse || !location)}
      perform={async (data) => {
        const value = (name: string) =>
          String(data.get(name) ?? "").trim() || null;
        const input: AssetMetadataInput = {
          serialNumber: value("serialNumber"),
          purchaseDate: value("purchaseDate"),
          purchasePrice: value("purchasePrice"),
          warrantyExpiryDate: value("warrantyExpiryDate"),
          nextMaintenanceDate: value("nextMaintenanceDate"),
          note: value("note"),
        };
        if (asset) return updateAsset(request, farmId, asset, input);
        if (!item || !warehouse || !location) return;
        return createAsset(request, farmId, {
          ...input,
          assetCode: value("assetCode")!,
          itemId: item.id,
          warehouseId: warehouse.id,
          locationId: location.id,
        });
      }}
    >
      {!asset && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-xs font-semibold text-foreground">
            Mã tài sản *
            <Input
              name="assetCode"
              required
              maxLength={100}
              pattern=".*\S.*"
              placeholder="Ví dụ: AST-EXTRACTOR-001"
              autoComplete="off"
              className="h-9 font-mono text-xs"
            />
          </label>

          <div className="space-y-1.5 text-xs font-semibold text-foreground">
            <span>Vật tư / Thiết bị *</span>
            <AssetLookup
              farmId={farmId}
              kind="item"
              activeOnly
              selected={item}
              onSelect={setItem}
            />
          </div>

          <div className="space-y-1.5 text-xs font-semibold text-foreground">
            <span>Kho nhận *</span>
            <AssetLookup
              farmId={farmId}
              kind="warehouse"
              activeOnly
              selected={warehouse}
              onSelect={(value) => {
                setWarehouse(value);
                setLocation(null);
              }}
            />
          </div>

          <div className="space-y-1.5 text-xs font-semibold text-foreground">
            <span>Vị trí nhận *</span>
            <AssetLookup
              key={warehouse?.id ?? "none"}
              farmId={farmId}
              kind="location"
              activeOnly
              warehouseId={warehouse?.id}
              selected={location}
              disabled={!warehouse}
              onSelect={setLocation}
            />
          </div>
        </div>
      )}

      <div className={`grid gap-4 sm:grid-cols-2 ${!asset ? "border-t border-border pt-4" : ""}`}>
        <label className="block space-y-1.5 text-xs font-semibold text-foreground">
          Số Serial
          <Input
            name="serialNumber"
            maxLength={255}
            placeholder="Ví dụ: EXT-2026-0001"
            defaultValue={asset?.serialNumber ?? ""}
            className="h-9 font-mono text-xs"
          />
        </label>

        <label className="block space-y-1.5 text-xs font-semibold text-foreground">
          Giá mua (VNĐ)
          <Input
            name="purchasePrice"
            inputMode="decimal"
            pattern="(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?"
            placeholder="Ví dụ: 1250000"
            defaultValue={asset?.purchasePrice ?? ""}
            className="h-9 text-xs tabular-nums"
          />
        </label>

        <label className="block space-y-1.5 text-xs font-semibold text-foreground">
          Ngày mua
          <DateInput
            name="purchaseDate"
            defaultValue={asset?.purchaseDate ?? ""}
            className="h-9 text-xs"
          />
        </label>

        <label className="block space-y-1.5 text-xs font-semibold text-foreground">
          Hết hạn bảo hành
          <DateInput
            name="warrantyExpiryDate"
            defaultValue={asset?.warrantyExpiryDate ?? ""}
            className="h-9 text-xs"
          />
        </label>

        <label className="block space-y-1.5 text-xs font-semibold text-foreground sm:col-span-2">
          Ngày bảo trì tiếp theo
          <DateInput
            name="nextMaintenanceDate"
            min={asset?.lastMaintenanceDate ?? undefined}
            defaultValue={asset?.nextMaintenanceDate ?? ""}
            className="h-9 text-xs"
          />
        </label>
      </div>

      <label className="block space-y-1.5 text-xs font-semibold text-foreground">
        Ghi chú tài sản
        <Textarea
          name="note"
          maxLength={4000}
          rows={2}
          placeholder="Mô tả phụ kiện đi kèm, tình trạng ban đầu..."
          defaultValue={asset?.note ?? ""}
          className="text-xs"
        />
      </label>
    </AssetMutationDialog>
  );
}
