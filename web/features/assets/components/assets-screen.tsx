"use client";

import { useAuthContext } from "@/features/auth";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { AssetList } from "./asset-list";
import { AssetDetail } from "./asset-detail";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export function AssetsScreen({
  id,
  assetCode,
}: {
  id?: string;
  assetCode?: string;
}) {
  const { selectedFarmId, data, isLoading, error } = useAuthContext();
  if (isLoading) return <BeeLoader label="Đang tải thông tin trang trại…" />;
  if (error)
    return (
      <ErrorAlert message="Không thể tải quyền truy cập trang trại. Vui lòng tải lại trang." />
    );
  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để xem tài sản.</p>;
  const roles =
    data.memberships.find(({ farm }) => farm.id === selectedFarmId)?.roles ??
    [];
  const detail = id !== undefined || assetCode !== undefined;
  return detail ? (
    <AssetDetail
      key={`${selectedFarmId}:${id ?? ""}:${assetCode ?? ""}`}
      farmId={selectedFarmId}
      identity={assetCode ?? id ?? ""}
      byCode={assetCode !== undefined}
      roles={roles}
    />
  ) : (
    <AssetList key={selectedFarmId} farmId={selectedFarmId} roles={roles} />
  );
}
