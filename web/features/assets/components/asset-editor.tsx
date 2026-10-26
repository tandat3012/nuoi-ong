"use client";

import { useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Input } from "@/shared/components/ui/input";
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
        <>
          <label className="block space-y-2 text-sm font-medium">
            Mã tài sản
            <Input
              name="assetCode"
              required
              maxLength={100}
              pattern=".*\S.*"
              autoComplete="off"
            />
          </label>
          <AssetLookup
            farmId={farmId}
            kind="item"
            activeOnly
            selected={item}
            onSelect={setItem}
          />
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
        </>
      )}
      <label className="block space-y-2 text-sm font-medium">
        Serial
        <Input
          name="serialNumber"
          maxLength={255}
          defaultValue={asset?.serialNumber ?? ""}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          Ngày mua
          <Input
            type="date"
            name="purchaseDate"
            defaultValue={asset?.purchaseDate ?? ""}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Giá mua (VNĐ)
          <Input
            name="purchasePrice"
            inputMode="decimal"
            pattern="(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?"
            placeholder="1250000.00"
            defaultValue={asset?.purchasePrice ?? ""}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Hết hạn bảo hành
          <Input
            type="date"
            name="warrantyExpiryDate"
            defaultValue={asset?.warrantyExpiryDate ?? ""}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Bảo trì tiếp theo
          <Input
            type="date"
            name="nextMaintenanceDate"
            min={asset?.lastMaintenanceDate ?? undefined}
            defaultValue={asset?.nextMaintenanceDate ?? ""}
          />
        </label>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        Ghi chú
        <Textarea
          name="note"
          maxLength={4000}
          rows={3}
          defaultValue={asset?.note ?? ""}
        />
      </label>
    </AssetMutationDialog>
  );
}
