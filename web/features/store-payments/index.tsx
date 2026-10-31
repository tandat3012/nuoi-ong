"use client";

import { useState } from "react";
import { useAuthContext } from "@/features/auth";
import { STORE_MANAGE_ROLES, hasAnyRole } from "@/features/auth/farm-roles";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PaymentSimulator } from "./components/payment-simulator";
import { StorePaymentsList } from "./components/store-payments-list";

export function StorePaymentsScreen() {
  const { data, selectedFarmId } = useAuthContext();
  const [refresh, setRefresh] = useState(0);
  const membership = data.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );
  if (!membership || !hasAnyRole(membership.roles, STORE_MANAGE_ROLES))
    return (
      <ErrorAlert message="Bạn không có quyền xem thanh toán trong trại đang chọn." />
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Thanh toán cửa hàng"
        description="Giao dịch chuyển khoản ngân hàng báo về, kể cả giao dịch không khớp đơn."
      />
      <PaymentSimulator
        key={`sim:${membership.farm.id}`}
        farmId={membership.farm.id}
        onRecorded={() => setRefresh((value) => value + 1)}
      />
      <StorePaymentsList
        key={membership.farm.id}
        farmId={membership.farm.id}
        refresh={refresh}
      />
    </div>
  );
}
