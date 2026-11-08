"use client";

import { useEffect, useState } from "react";
import { MapPin, Phone, Truck } from "lucide-react";
import { useAuthenticatedRequest, useFarmMembership } from "@/features/auth";
import {
  formatOrderMoney,
  storeRegionLabels,
} from "@/features/commerce/orders/order.logic";
import { Button } from "@/shared/components/ui/button";
import { useConfirm } from "@/shared/components/ui/confirm-dialog";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { cn } from "@/shared/lib/utils";
import { getDeliveries, runDeliveryAction } from "../deliveries.api";
import {
  canMarkDelivered,
  cashToCollect,
  deliveryErrorMessage,
} from "../deliveries.logic";
import type { DeliveryOrder, DeliveryScope } from "../types";
import { ReturnDeliveryDialog } from "./return-delivery-dialog";

const tabs: { scope: DeliveryScope; label: string }[] = [
  { scope: "available", label: "Chờ giao" },
  { scope: "mine", label: "Tôi đang giao" },
];

export function DeliveriesScreen() {
  const { selectedFarmId, canDeliver } = useFarmMembership();
  if (!selectedFarmId || !canDeliver)
    return (
      <ErrorAlert message="Bạn không có quyền giao hàng trong trại đang chọn." />
    );
  return <Deliveries key={selectedFarmId} farmId={selectedFarmId} />;
}

function Deliveries({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  const [ask, confirmDialog] = useConfirm();
  const [scope, setScope] = useState<DeliveryScope>("available");
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    orders?: DeliveryOrder[];
    error?: string;
  }>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [returning, setReturning] = useState<DeliveryOrder | null>(null);
  const key = `${scope}:${reload}`;

  useEffect(() => {
    let cancelled = false;
    getDeliveries(request, farmId, scope)
      .then(({ data }) => !cancelled && setResult({ key, orders: data }))
      .catch(
        (error: unknown) =>
          !cancelled && setResult({ key, error: deliveryErrorMessage(error) }),
      );
    return () => {
      cancelled = true;
    };
  }, [request, farmId, scope, key]);

  const current = result?.key === key ? result : undefined;
  const refresh = () => setReload((value) => value + 1);

  async function act(order: DeliveryOrder, action: "ship" | "complete") {
    const cash = cashToCollect(order);
    const confirmed = await ask({
      title: action === "ship" ? "Nhận giao đơn" : "Báo đã giao xong",
      description:
        action === "ship"
          ? `Nhận giao đơn ${order.code}? Bạn sẽ được ghi nhận là người giao.`
          : `Đơn ${order.code} đã giao cho khách?${cash ? ` Bạn xác nhận đã thu ${formatOrderMoney(cash)} tiền mặt.` : ""}`,
    });
    if (!confirmed) return;
    setBusyId(order.id);
    setActionError(null);
    try {
      await runDeliveryAction(request, farmId, order.id, action);
      if (action === "ship") setScope("mine");
      else refresh();
    } catch (error) {
      setActionError(deliveryErrorMessage(error));
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      {returning && (
        <ReturnDeliveryDialog
          farmId={farmId}
          order={returning}
          onReturned={refresh}
          onClose={() => setReturning(null)}
        />
      )}
      <PageHeader
        title="Giao hàng"
        description="Nhận đơn đã xác nhận, giao cho khách rồi báo giao xong."
      />
      <div role="tablist" className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.scope}
            role="tab"
            aria-selected={scope === tab.scope}
            variant={scope === tab.scope ? "default" : "outline"}
            onClick={() => setScope(tab.scope)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      {actionError && <ErrorAlert message={actionError} />}
      {!current && <BeeLoader label="Đang tải đơn giao…" />}
      {current?.error && <ErrorAlert message={current.error} />}
      {current?.orders?.length === 0 && (
        <EmptyState
          icon={Truck}
          title={scope === "available" ? "Chưa có đơn chờ giao" : "Bạn chưa nhận đơn nào"}
          description={
            scope === "available"
              ? "Đơn xuất hiện ở đây khi đã xác nhận và phiếu xuất đã được duyệt."
              : "Nhận đơn ở tab Chờ giao để bắt đầu giao."
          }
        />
      )}
      <ul className="grid gap-4 lg:grid-cols-2">
        {current?.orders?.map((order) => {
          const cash = cashToCollect(order);
          const busy = busyId === order.id;
          return (
            <li key={order.id} className="space-y-3 rounded-xl border bg-card p-5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{order.code}</span>
                <span className="text-muted-foreground">
                  {order.region ? storeRegionLabels[order.region] : "Chưa rõ miền"}
                </span>
              </div>
              <div className="space-y-1">
                <p className="font-medium">{order.recipientName}</p>
                <a className="flex items-center gap-2 text-primary underline" href={`tel:${order.phone.replace(/[^\d+]/g, "")}`}>
                  <Phone className="size-4" aria-hidden="true" />
                  {order.phone}
                </a>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="whitespace-pre-line">{order.address}</span>
                </p>
                {order.note && <p className="text-muted-foreground">Ghi chú: {order.note}</p>}
              </div>
              <ul className="space-y-0.5 border-t pt-2">
                {order.items.map((item, index) => (
                  <li key={index}>
                    {item.quantity} × {item.productName} · {item.variantName}
                  </li>
                ))}
              </ul>
              <p
                className={cn(
                  "rounded-md px-3 py-2 font-medium",
                  cash ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted",
                )}
              >
                {cash
                  ? `Thu tiền mặt: ${formatOrderMoney(cash)}`
                  : order.paymentStatus === "PAID"
                    ? "Đã thanh toán, không thu tiền"
                    : "Chuyển khoản chưa ghi nhận, chưa báo giao xong được"}
              </p>
              <div className="flex flex-wrap gap-2">
                {scope === "available" ? (
                  <Button isLoading={busy} disabled={busyId !== null} onClick={() => void act(order, "ship")}>
                    Nhận giao
                  </Button>
                ) : (
                  <>
                    <Button
                      isLoading={busy}
                      disabled={busyId !== null || !canMarkDelivered(order)}
                      onClick={() => void act(order, "complete")}
                    >
                      Đã giao xong
                    </Button>
                    <Button variant="outline" disabled={busyId !== null} onClick={() => setReturning(order)}>
                      Trả đơn
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
