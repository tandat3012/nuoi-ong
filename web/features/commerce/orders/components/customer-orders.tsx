"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Package,
  ShoppingBag,
  RefreshCw,
  Search,
  X,
  CreditCard,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
} from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Pagination } from "@/shared/components/ui/pagination";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { useOptionalCart } from "@/features/commerce/cart/hooks/use-cart";
import { cancelCustomerOrder, getCustomerOrder, getCustomerOrders } from "../orders.api";
import { orderErrorMessage } from "../order.logic";
import type { CustomerOrder, CustomerOrderDetail } from "../types/order";
import { CustomerOrderCard } from "./customer-order-card";
import { CustomerOrderPayDialog } from "./customer-order-pay-dialog";
import { CustomerOrderCancelDialog } from "./customer-order-cancel-dialog";
import { CustomerOrderContactDialog } from "./customer-order-contact-dialog";
import { cn } from "@/shared/lib/utils";

export type ShopeeTabKey =
  | "ALL"
  | "TO_PAY"
  | "TO_SHIP"
  | "SHIPPING"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURN";

interface TabDefinition {
  key: ShopeeTabKey;
  label: string;
  icon: typeof Package;
}

const SHOPEE_TABS: TabDefinition[] = [
  { key: "ALL", label: "Tất cả", icon: Package },
  { key: "TO_PAY", label: "Chờ thanh toán", icon: CreditCard },
  { key: "TO_SHIP", label: "Chờ xác nhận / Vận chuyển", icon: Clock },
  { key: "SHIPPING", label: "Đang giao", icon: Truck },
  { key: "COMPLETED", label: "Hoàn thành", icon: CheckCircle2 },
  { key: "CANCELLED", label: "Đã hủy", icon: XCircle },
  { key: "RETURN", label: "Trả hàng/Hoàn tiền", icon: RotateCcw },
];

function isOrderInTab(order: CustomerOrder, tab: ShopeeTabKey): boolean {
  if (tab === "ALL") return true;

  const isUnpaidBank =
    order.paymentMethod === "BANK_TRANSFER" &&
    order.paymentStatus === "UNPAID" &&
    order.status !== "CANCELLED";

  if (tab === "TO_PAY") {
    return isUnpaidBank;
  }

  if (tab === "TO_SHIP") {
    return (
      ["PENDING", "PREPARING", "CONFIRMED"].includes(order.status) &&
      !isUnpaidBank
    );
  }

  if (tab === "SHIPPING") {
    return order.status === "SHIPPING";
  }

  if (tab === "COMPLETED") {
    return order.status === "COMPLETED";
  }

  if (tab === "CANCELLED") {
    return order.status === "CANCELLED";
  }

  if (tab === "RETURN") {
    return order.status === "RETURNING" || order.status === "RETURNED";
  }

  return true;
}

export function CustomerOrders() {
  const router = useRouter();
  const request = useAuthenticatedRequest();
  const cart = useOptionalCart();

  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<ShopeeTabKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [result, setResult] = useState<{
    page: number;
    response?: PaginatedResponse<CustomerOrder>;
    error?: string;
  } | null>(null);

  // Background cache for full order details (items, images, payments)
  const [orderDetails, setOrderDetails] = useState<
    Record<string, CustomerOrderDetail>
  >({});
  const inFlightIdsRef = useRef<Set<string>>(new Set());

  // Modals state
  const [payTargetDetail, setPayTargetDetail] = useState<CustomerOrderDetail | null>(null);
  const [cancelTargetOrder, setCancelTargetOrder] = useState<CustomerOrder | null>(null);
  const [contactTargetOrder, setContactTargetOrder] = useState<CustomerOrder | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 1. Fetch paginated orders
  useEffect(() => {
    let cancelled = false;
    void getCustomerOrders(request, page)
      .then((response) => {
        if (cancelled) return;
        if (page > Math.max(1, response.page.totalPages)) {
          setPage(Math.max(1, response.page.totalPages));
          return;
        }
        setResult({ page, response });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ page, error: orderErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, page, attempt]);

  const current = result?.page === page ? result : null;
  const rawOrders = useMemo(
    () => current?.response?.data ?? [],
    [current?.response?.data]
  );

  // 2. Pre-fetch details for visible orders in the background so product items & images render smoothly
  useEffect(() => {
    if (!rawOrders.length) return;
    let cancelled = false;

    const needed = rawOrders.filter(
      (order) => !orderDetails[order.id] && !inFlightIdsRef.current.has(order.id)
    );
    if (!needed.length) return;

    for (const o of needed) {
      inFlightIdsRef.current.add(o.id);
    }

    void Promise.allSettled(
      needed.map((order) =>
        getCustomerOrder(request, order.id).then((res) => ({
          id: order.id,
          detail: res.data,
        }))
      )
    ).then((settled) => {
      for (const o of needed) {
        inFlightIdsRef.current.delete(o.id);
      }
      if (cancelled) return;
      const newMap: Record<string, CustomerOrderDetail> = {};
      for (const item of settled) {
        if (item.status === "fulfilled" && item.value.detail) {
          newMap[item.value.id] = item.value.detail;
        }
      }
      if (Object.keys(newMap).length > 0) {
        setOrderDetails((prev) => ({ ...prev, ...newMap }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [rawOrders, request, orderDetails]);

  // 3. Tab counters based on current list
  const tabCounts = useMemo(() => {
    const counts: Record<ShopeeTabKey, number> = {
      ALL: rawOrders.length,
      TO_PAY: 0,
      TO_SHIP: 0,
      SHIPPING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      RETURN: 0,
    };
    for (const order of rawOrders) {
      if (isOrderInTab(order, "TO_PAY")) counts.TO_PAY++;
      if (isOrderInTab(order, "TO_SHIP")) counts.TO_SHIP++;
      if (isOrderInTab(order, "SHIPPING")) counts.SHIPPING++;
      if (isOrderInTab(order, "COMPLETED")) counts.COMPLETED++;
      if (isOrderInTab(order, "CANCELLED")) counts.CANCELLED++;
      if (isOrderInTab(order, "RETURN")) counts.RETURN++;
    }
    return counts;
  }, [rawOrders]);

  // 4. Filter orders by active tab and search query
  const filteredOrders = useMemo(() => {
    let list = rawOrders.filter((order) => isOrderInTab(order, activeTab));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((order) => {
        if (order.code.toLowerCase().includes(q)) return true;
        if (order.recipientName.toLowerCase().includes(q)) return true;
        if (order.phone.includes(q)) return true;
        const detail = orderDetails[order.id];
        if (detail) {
          const matchedItem = detail.items.some(
            (it) =>
              it.productName.toLowerCase().includes(q) ||
              it.variantName.toLowerCase().includes(q)
          );
          if (matchedItem) return true;
        }
        return false;
      });
    }
    return list;
  }, [rawOrders, activeTab, searchQuery, orderDetails]);

  // Action handlers
  const handleOpenPayModal = (detail: CustomerOrderDetail) => {
    setPayTargetDetail(detail);
  };

  const handleOpenCancelModal = (order: CustomerOrder) => {
    setActionError(null);
    setCancelTargetOrder(order);
  };

  const handleConfirmCancel = async (reason: string) => {
    if (!cancelTargetOrder) return;
    setIsCancelling(true);
    setActionError(null);

    try {
      const res = await cancelCustomerOrder(
        request,
        cancelTargetOrder.id,
        reason
      );

      // Update local state smoothly
      setResult((prev) => {
        if (!prev?.response) return prev;
        const updatedList = prev.response.data.map((o) =>
          o.id === cancelTargetOrder.id ? res.data.order : o
        );
        return {
          ...prev,
          response: {
            ...prev.response,
            data: updatedList,
          },
        };
      });

      // Update order details cache
      setOrderDetails((prev) => ({
        ...prev,
        [cancelTargetOrder.id]: res.data,
      }));

      setActionSuccess(`Đã hủy thành công đơn hàng #${cancelTargetOrder.code}`);
      setCancelTargetOrder(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      setActionError(orderErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReorder = (detail: CustomerOrderDetail) => {
    if (!cart || !detail.items.length) {
      router.push(`/orders/${encodeURIComponent(detail.order.id)}`);
      return;
    }

    let addedCount = 0;
    for (const item of detail.items) {
      if (!item.productSlug) continue;
      const ok = cart.addItem({
        productId: item.productId,
        productSlug: item.productSlug,
        productName: item.productName,
        variantId: item.variantId,
        variantName: item.variantName,
        unitPrice: Number(item.unitPrice),
        image: item.imageUrl
          ? { src: item.imageUrl, alt: item.productName }
          : undefined,
        quantity: item.quantity,
        inStock: true,
      });
      if (ok) addedCount++;
    }

    if (addedCount > 0) {
      void cart.reconcileCart();
      router.push("/cart");
    } else {
      router.push(`/orders/${encodeURIComponent(detail.order.id)}`);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* 1. Header & Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Đơn hàng của tôi
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Theo dõi hành trình đơn hàng, lịch sử mua sắm và quản lý thanh toán.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAttempt((v) => v + 1)}
          className="gap-1.5 cursor-pointer text-xs h-9 hover:border-primary/50"
        >
          <RefreshCw className="size-3.5 text-muted-foreground" />
          <span>Tải lại</span>
        </Button>
      </div>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <ErrorAlert
          message={actionError}
          onRetry={() => setActionError(null)}
        />
      )}

      {current?.error && (
        <ErrorAlert
          message={current.error}
          onRetry={() => setAttempt((v) => v + 1)}
        />
      )}

      {/* 2. Shopee-Style Tabs Header */}
      <section className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        {/* Horizontal Scrollable Tabs */}
        <div
          role="tablist"
          aria-label="Lọc trạng thái đơn hàng"
          className="flex border-b overflow-x-auto no-scrollbar scroll-smooth bg-card"
        >
          {SHOPEE_TABS.map((tab) => {
            const count = tabCounts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex items-center justify-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-xs sm:text-sm font-medium transition-all cursor-pointer flex-1 sm:flex-initial",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[11px] font-semibold transition-colors",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
                {/* Active Indicator Underline */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-xs" />
                )}
              </button>
            );
          })}
        </div>

        {/* Shopee-Style Search Bar */}
        <div className="p-3 sm:p-4 bg-muted/15 border-b">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Bạn có thể tìm kiếm theo Mã đơn hàng, Tên sản phẩm, Tên người nhận hoặc SĐT..."
              className="pl-9 pr-9 h-10 text-xs sm:text-sm bg-background/80 focus:bg-background transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. Orders List or Loader */}
      {!current && (
        <div className="py-12">
          <BeeLoader label="Đang tải danh sách đơn hàng của bạn…" />
        </div>
      )}

      {current?.response && (
        <>
          {filteredOrders.length > 0 ? (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <CustomerOrderCard
                  key={order.id}
                  order={order}
                  detail={orderDetails[order.id]}
                  isLoadingDetail={!orderDetails[order.id]}
                  onPayNow={handleOpenPayModal}
                  onCancelOrder={handleOpenCancelModal}
                  onReorder={handleReorder}
                  onContactSupport={(o) => setContactTargetOrder(o)}
                />
              ))}
            </div>
          ) : (
            /* Shopee Empty State */
            <div className="rounded-2xl border bg-card p-12 text-center shadow-xs">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary mb-4">
                <ShoppingBag className="size-8" />
              </div>
              <h3 className="font-bold text-base sm:text-lg text-foreground">
                {searchQuery
                  ? "Không tìm thấy đơn hàng phù hợp"
                  : activeTab !== "ALL"
                  ? "Chưa có đơn hàng nào trong mục này"
                  : "Bạn chưa có đơn hàng nào"}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                {searchQuery
                  ? `Không có kết quả nào khớp với "${searchQuery}". Hãy thử kiểm tra lại mã đơn hoặc từ khóa tìm kiếm.`
                  : "Khám phá các sản phẩm mật ong nguyên chất, tổ ong giống và dụng cụ nuôi ong chuyên nghiệp từ Mộc Ong."}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {searchQuery ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="cursor-pointer"
                  >
                    Xóa bộ lọc tìm kiếm
                  </Button>
                ) : (
                  <Link
                    href="/products"
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    Khám phá sản phẩm ngay
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Pagination */}
          <Pagination
            pageInfo={current.response.page}
            itemLabel="đơn hàng"
            onPageChange={setPage}
          />
        </>
      )}

      {/* 4. Modals */}
      <CustomerOrderPayDialog
        isOpen={Boolean(payTargetDetail)}
        orderDetail={payTargetDetail}
        onClose={() => setPayTargetDetail(null)}
      />

      <CustomerOrderCancelDialog
        isOpen={Boolean(cancelTargetOrder)}
        order={cancelTargetOrder}
        isCancelling={isCancelling}
        onClose={() => setCancelTargetOrder(null)}
        onConfirm={handleConfirmCancel}
      />

      <CustomerOrderContactDialog
        isOpen={Boolean(contactTargetOrder)}
        order={contactTargetOrder}
        onClose={() => setContactTargetOrder(null)}
      />
    </main>
  );
}
