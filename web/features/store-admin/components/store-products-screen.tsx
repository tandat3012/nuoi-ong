"use client";

import { useAuthContext } from "@/features/auth";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { canManageStore } from "../store-admin.logic";
import { StoreProductDetail } from "./store-product-detail";
import { StoreProductList } from "./store-product-list";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export function StoreProductsScreen({ id }: { id?: string }) {
  const { selectedFarmId, data, isLoading, error } = useAuthContext();
  if (isLoading) return <BeeLoader label="Đang tải thông tin trang trại…" />;
  if (error)
    return (
      <ErrorAlert message="Không thể tải quyền truy cập trang trại. Vui lòng tải lại trang." />
    );
  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để quản trị cửa hàng.</p>;
  const roles =
    data.memberships.find(({ farm }) => farm.id === selectedFarmId)?.roles ??
    [];
  if (!canManageStore(roles))
    return (
      <ErrorAlert message="Chỉ quản trị viên hoặc chủ trang trại được quản trị cửa hàng." />
    );
  return id ? (
    <StoreProductDetail key={`${selectedFarmId}:${id}`} farmId={selectedFarmId} id={id} />
  ) : (
    <StoreProductList key={selectedFarmId} farmId={selectedFarmId} />
  );
}
