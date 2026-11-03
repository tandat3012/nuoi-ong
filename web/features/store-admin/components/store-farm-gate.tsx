"use client";

import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { useFarmMembership } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";

/** Order, payment and report screens only apply to farms that sell online. */
export function StoreFarmGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isStoreFarm, canManageFarm } = useFarmMembership();
  if (isStoreFarm) return children;
  return (
    <EmptyState
      icon={Store}
      title="Trại chưa bán online"
      description={
        canManageFarm
          ? "Chọn kho bán hàng và miền phục vụ của trại để nhận đơn từ cửa hàng."
          : "Chủ trại chưa thiết lập kho bán hàng cho trại này."
      }
      action={
        canManageFarm && (
          <Button type="button" onClick={() => router.push("/store-products")}>
            Cấu hình bán hàng
          </Button>
        )
      }
    />
  );
}
