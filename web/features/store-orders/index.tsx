"use client";

import { useAuthContext } from "@/features/auth";
import { STORE_MANAGE_ROLES, hasAnyRole } from "@/features/auth/farm-roles";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { StoreOrderCustomer } from "./components/store-order-customer";
import { StoreOrderDetail } from "./components/store-order-detail";
import { StoreOrderReports } from "./components/store-order-reports";
import { StoreOrdersList } from "./components/store-orders-list";

export function StoreOrdersScreen() {
  const { data, selectedFarmId } = useAuthContext();
  const membership = data.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );
  if (!membership || !canManageOrders(membership.roles))
    return (
      <ErrorAlert message="Bạn không có quyền xử lý đơn hàng trong trại đang chọn." />
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn hàng cửa hàng"
        description="Theo dõi đơn, thanh toán và giao hàng của trại."
      />
      <StoreOrdersList key={membership.farm.id} farmId={membership.farm.id} />
    </div>
  );
}

export function StoreOrderDetailScreen({ id }: { id: string }) {
  const { data, selectedFarmId } = useAuthContext();
  const membership = data.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );
  if (!membership || !canManageOrders(membership.roles))
    return (
      <ErrorAlert message="Bạn không có quyền xử lý đơn hàng trong trại đang chọn." />
    );
  return (
    <StoreOrderDetail
      key={`${membership.farm.id}:${id}`}
      farmId={membership.farm.id}
      id={id}
      canWrite
    />
  );
}

export function StoreOrderCustomerScreen({ userId }: { userId: string }) {
  const { data, selectedFarmId } = useAuthContext();
  const membership = data.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );
  if (!membership || !canManageOrders(membership.roles))
    return (
      <ErrorAlert message="Bạn không có quyền xem lịch sử mua hàng của khách." />
    );
  return (
    <StoreOrderCustomer
      key={`${membership.farm.id}:${userId}`}
      farmId={membership.farm.id}
      userId={userId}
    />
  );
}

export function StoreOrderReportsScreen() {
  const { data, selectedFarmId } = useAuthContext();
  const membership = data.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );
  if (!membership || !canManageOrders(membership.roles))
    return (
      <ErrorAlert message="Chỉ quản trị viên, chủ trại hoặc quản lý cửa hàng mới được xem báo cáo bán hàng." />
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo bán hàng"
        description={`Doanh thu và đơn hàng · ${membership.farm.name}`}
      />
      <StoreOrderReports key={membership.farm.id} farmId={membership.farm.id} />
    </div>
  );
}

function canManageOrders(roles: string[]) {
  return hasAnyRole(roles, STORE_MANAGE_ROLES);
}
