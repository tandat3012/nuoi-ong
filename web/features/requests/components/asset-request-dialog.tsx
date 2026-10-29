"use client";

import { useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { AssetLookup } from "@/features/assets/components/asset-lookup";
import type { Asset, AssetChoice } from "@/features/assets/types/asset";
import { FormDialog } from "@/shared/components/ui/form-dialog";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { createMaintenanceRequest, createTransferRequest } from "../api/requests.api";
import { normalizeRequestDescription, runRequestAction } from "../requests.logic";
import type { RequestedMaintenanceType, RequestType } from "../types/request";
import { requestFailureMessage, requestFormError } from "./request-error";

export function AssetRequestDialog({ farmId, asset, type, onClose, onReload, onError, onSent }: {
  farmId: string;
  asset: Asset;
  type: RequestType;
  onClose: () => void;
  onReload: () => void;
  onError: (message: string | null) => void;
  onSent: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [warehouse, setWarehouse] = useState<AssetChoice | null>(null);
  const [location, setLocation] = useState<AssetChoice | null>(null);
  const [maintenanceType, setMaintenanceType] = useState<RequestedMaintenanceType>("CORRECTIVE");
  return (
    <FormDialog
      title={type === "maintenance" ? "Báo cần sửa" : "Yêu cầu chuyển tài sản"}
      description={type === "maintenance"
        ? `Gửi yêu cầu sửa chữa hoặc kiểm tra tài sản ${asset.assetCode} để quản lý duyệt.`
        : `Tài sản ${asset.assetCode} sẽ chờ chuyển và khóa các thao tác vòng đời cho đến khi quản lý xử lý.`}
      submitLabel="Gửi yêu cầu"
      onClose={onClose}
      errorMessage={requestFormError}
      onSubmit={async (data) => {
        let perform: () => Promise<unknown>;
        if (type === "maintenance") {
          const result = normalizeRequestDescription(String(data.get("description") ?? ""));
          if ("error" in result) throw new Error(result.error);
          perform = () => createMaintenanceRequest(request, farmId, {
            assetId: asset.id, maintenanceType, description: result.description,
          });
        } else {
          if (!warehouse || !location) throw new Error("Hãy chọn kho nhận và vị trí nhận đang hoạt động.");
          const note = String(data.get("note") ?? "").trim();
          if (note.length > 4000) throw new Error("Ghi chú tối đa 4000 ký tự.");
          perform = () => createTransferRequest(request, farmId, {
            assetId: asset.id, warehouseId: warehouse.id, locationId: location.id,
            note: note || undefined,
          });
        }
        await runRequestAction(perform, {
          onChanged: onReload,
          onError: (failure) => onError(failure === null ? null : requestFailureMessage(failure)),
        });
        onSent();
      }}
    >
      {type === "maintenance" ? <>
        <label className="block space-y-2 text-sm font-medium">
          Loại yêu cầu
          <Select value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value as RequestedMaintenanceType)}>
            <option value="CORRECTIVE">Sửa chữa</option>
            <option value="INSPECTION">Kiểm tra</option>
          </Select>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Mô tả (3–4000 ký tự)
          <Textarea name="description" required minLength={3} maxLength={4000} rows={4} />
        </label>
      </> : <>
        <AssetLookup farmId={farmId} kind="warehouse" activeOnly selected={warehouse} onSelect={(value) => {
          setWarehouse(value); setLocation(null);
        }} />
        <AssetLookup key={warehouse?.id ?? "none"} farmId={farmId} kind="location" activeOnly
          selected={location} warehouseId={warehouse?.id} disabled={!warehouse} onSelect={setLocation} />
        <label className="block space-y-2 text-sm font-medium">
          Ghi chú (không bắt buộc)
          <Textarea name="note" maxLength={4000} rows={3} />
        </label>
      </>}
    </FormDialog>
  );
}
