"use client";

import { useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { assetAction, maintenanceAction } from "../api/assets.api";
import type { Asset, AssetChoice } from "../types/asset";
import { AssetLookup } from "./asset-lookup";
import {
  AssetMutationDialog,
  type AssetMutationFeedback,
} from "./asset-mutation-dialog";

export const ASSET_ACTION_LABELS = {
  assign: "Cấp phát / bàn giao",
  "start-use": "Bắt đầu sử dụng",
  incidents: "Báo sự cố",
  maintenance: "Lên lịch bảo trì",
  recover: "Ghi nhận tìm lại",
  transfer: "Chuyển kho / vị trí",
  retire: "Ngừng sử dụng",
} as const;
export type AssetActionKind = keyof typeof ASSET_ACTION_LABELS;

export function AssetActionDialog({
  farmId,
  asset,
  action,
  ...feedback
}: AssetMutationFeedback & {
  farmId: string;
  asset: Asset;
  action: AssetActionKind;
}) {
  const request = useAuthenticatedRequest();
  const [member, setMember] = useState<AssetChoice | null>(null);
  const [warehouse, setWarehouse] = useState<AssetChoice | null>(null);
  const [location, setLocation] = useState<AssetChoice | null>(null);
  const [incidentType, setIncidentType] = useState("DAMAGE");
  const description =
    action === "assign"
      ? `${asset.assetCode} · Cấp phát từ kho giảm tồn 1. Bàn giao tài sản đang sử dụng chỉ đổi người giữ và vị trí.`
      : action === "retire"
        ? `${asset.assetCode} · Tài sản sẽ ngừng sử dụng, tồn kho giảm 1. Hồ sơ và lịch sử được giữ lại. Thao tác không thể hoàn tác tại đây.`
        : action === "transfer"
          ? `${asset.assetCode} · Di chuyển tài sản sẵn sàng tới kho và vị trí nhận. Hệ thống cập nhật tồn kho và ghi lịch sử điều chuyển.`
          : action === "recover"
            ? `${asset.assetCode} · Xác nhận đã tìm lại thực tế, nhập lại 1 tài sản vào kho và vị trí bạn chọn.`
            : action === "maintenance"
              ? `${asset.assetCode} · Khi bắt đầu bảo trì, tài sản rời tồn sẵn sàng. Sau hoàn tất, cần trả kho để đưa vào tồn lại.`
              : action === "incidents"
                ? `${asset.assetCode} · Báo mất sẽ đưa tài sản sang Thất lạc, kết thúc cấp phát và giảm tồn nếu đang ở kho. Báo hỏng không tự chuyển trạng thái; hãy lên lịch bảo trì để xử lý.`
                : `${asset.assetCode} · Xác nhận người nhận đã bắt đầu sử dụng tài sản.`;
  return (
    <AssetMutationDialog
      {...feedback}
      title={ASSET_ACTION_LABELS[action]}
      description={description}
      destructive={
        action === "retire" ||
        (action === "incidents" && incidentType === "LOSS")
      }
      disabled={
        (action === "assign" && (!member || !location)) ||
        (["recover", "transfer"].includes(action) && (!warehouse || !location))
      }
      perform={(data) => {
        const text = (name: string) => String(data.get(name) ?? "").trim();
        const note = text("note") || null;
        if (action === "assign")
          return assetAction(request, farmId, asset.id, action, {
            assignedToMemberId: member!.id,
            locationId: location!.id,
            expectedReturnAt: text("expectedReturnAt")
              ? new Date(text("expectedReturnAt")).toISOString()
              : null,
            note,
          });
        if (action === "incidents")
          return assetAction(request, farmId, asset.id, action, {
            incidentType,
            description: text("description"),
            severity: text("severity"),
          });
        if (action === "maintenance")
          return maintenanceAction(request, farmId, null, "create", {
            assetId: asset.id,
            maintenanceType: text("maintenanceType"),
            scheduledAt: text("scheduledAt")
              ? new Date(text("scheduledAt")).toISOString()
              : null,
            description: text("description") || null,
            laborCost: text("laborCost") || "0",
            materialCost: text("materialCost") || "0",
            otherCost: text("otherCost") || "0",
          });
        if (action === "recover" || action === "transfer")
          return assetAction(request, farmId, asset.id, action, {
            warehouseId: warehouse!.id,
            locationId: location!.id,
            note,
          });
        return assetAction(
          request,
          farmId,
          asset.id,
          action,
          action === "retire" ? { note } : {},
        );
      }}
    >
      {action === "assign" && (
        <>
          <AssetLookup
            farmId={farmId}
            kind="member"
            selected={member}
            onSelect={setMember}
          />
          <AssetLookup
            farmId={farmId}
            kind="location"
            activeOnly
            selected={location}
            onSelect={setLocation}
          />
          <label className="block space-y-2 text-sm font-medium">
            Dự kiến trả (không bắt buộc)
            <Input name="expectedReturnAt" type="datetime-local" />
          </label>
          {member && location && (
            <p className="rounded-lg bg-muted p-3 text-sm break-words">
              Giao <strong>{asset.assetCode}</strong> cho{" "}
              <strong>{member.label}</strong> tại{" "}
              <strong>{location.label}</strong>.
            </p>
          )}
        </>
      )}
      {(action === "recover" || action === "transfer") && (
        <>
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
            selected={location}
            warehouseId={warehouse?.id}
            disabled={!warehouse}
            onSelect={setLocation}
          />
        </>
      )}
      {action === "incidents" && (
        <>
          <label className="block space-y-2 text-sm font-medium">
            Loại sự cố
            <Select
              name="incidentType"
              value={incidentType}
              onChange={(event) => setIncidentType(event.target.value)}
            >
              <option value="DAMAGE">Hư hỏng</option>
              <option value="LOSS">Thất lạc / mất</option>
              <option value="OTHER">Khác</option>
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Mức độ
            <Select name="severity" defaultValue="MEDIUM">
              <option value="LOW">Thấp</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HIGH">Cao</option>
              <option value="CRITICAL">Nghiêm trọng</option>
            </Select>
          </label>
        </>
      )}
      {action === "maintenance" && (
        <>
          <label className="block space-y-2 text-sm font-medium">
            Loại bảo trì
            <Select name="maintenanceType">
              <option value="PREVENTIVE">Bảo dưỡng định kỳ</option>
              <option value="CORRECTIVE">Sửa chữa</option>
              <option value="INSPECTION">Kiểm tra</option>
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Lịch dự kiến (không bắt buộc)
            <Input name="scheduledAt" type="datetime-local" />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["laborCost", "Nhân công"],
              ["materialCost", "Vật tư"],
              ["otherCost", "Khác"],
            ].map(([name, label]) => (
              <label key={name} className="block space-y-2 text-sm font-medium">
                {label} (VNĐ)
                <Input
                  name={name}
                  inputMode="decimal"
                  pattern="(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?"
                  defaultValue="0"
                />
              </label>
            ))}
          </div>
        </>
      )}
      {(action === "incidents" || action === "maintenance") && (
        <label className="block space-y-2 text-sm font-medium">
          Mô tả{action === "incidents" ? " (bắt buộc)" : ""}
          <Textarea
            name="description"
            required={action === "incidents"}
            maxLength={4000}
            rows={3}
          />
        </label>
      )}
      {!["incidents", "maintenance", "start-use"].includes(action) && (
        <label className="block space-y-2 text-sm font-medium">
          {action === "retire" ? "Lý do ngừng sử dụng (bắt buộc)" : "Ghi chú"}
          <Textarea
            name="note"
            required={action === "retire"}
            maxLength={4000}
            rows={3}
          />
        </label>
      )}
    </AssetMutationDialog>
  );
}
