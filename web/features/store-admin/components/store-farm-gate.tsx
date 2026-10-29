"use client";

import { Store } from "lucide-react";
import { useAuthContext, useFarmMembership } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";

/** Store screens only work on the farm that owns the store warehouse. */
export function StoreFarmGate({ children }: { children: React.ReactNode }) {
  const { data, selectFarm } = useAuthContext();
  const { storeFarm, isStoreFarm } = useFarmMembership();
  if (isStoreFarm) return children;
  if (!storeFarm)
    return (
      <EmptyState
        icon={Store}
        title="Cửa hàng chưa được cấu hình"
        description="Chưa chọn kho bán hàng cho cửa hàng. Liên hệ quản trị viên để thiết lập."
      />
    );
  const canSwitch = data.memberships.some(({ farm }) => farm.id === storeFarm.id);
  return (
    <EmptyState
      icon={Store}
      title="Cửa hàng thuộc trại khác"
      description={
        canSwitch
          ? `Cửa hàng thuộc ${storeFarm.name}. Chuyển sang trại này để quản lý sản phẩm, đơn hàng và báo cáo.`
          : `Cửa hàng thuộc ${storeFarm.name}. Bạn chưa là thành viên của trại này.`
      }
      action={
        canSwitch && (
          <Button type="button" onClick={() => selectFarm(storeFarm.id)}>
            Chuyển sang {storeFarm.name}
          </Button>
        )
      }
    />
  );
}
