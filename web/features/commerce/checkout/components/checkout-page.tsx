"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { useCart } from "@/features/commerce/cart/hooks/use-cart";
import type { CartItem } from "@/features/commerce/cart/types/cart";
import {
  calculateCartTotals,
  isValidCartPrice,
} from "@/features/commerce/cart/components/cart.logic";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { formatVndCurrency } from "@/shared/lib/currency";
import { ApiError } from "@/shared/api/client";
import {
  beginOrderAttempt,
  canonicalOrderPayload,
  isDefiniteOrderFailure,
  loadOrderAttempt,
  orderErrorMessage,
  parseOrderAttemptPayload,
  updateOrderAttempt,
  type OrderAttempt,
} from "@/features/commerce/orders/order.logic";
import { createCustomerOrder } from "@/features/commerce/orders/orders.api";
import type {
  CreateOrderInput,
  PaymentMethod,
} from "@/features/commerce/orders/types/order";
import {
  getStorePaymentMethods,
  type StorePaymentMethods,
} from "@/features/commerce/orders/payment-methods.api";

type CheckoutFields = {
  recipientName: string;
  phone: string;
  address: string;
  note: string;
  paymentMethod: PaymentMethod;
};

function cartSnapshotKey(items: CartItem[]) {
  return JSON.stringify(
    items
      .map((item) => [
        item.variantId,
        item.quantity,
        item.unitPrice,
        item.verification,
        item.inStock,
        item.isUnavailable,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}

function priceSignature(items: CartItem[]) {
  return JSON.stringify(
    items
      .map((item) => [item.variantId, item.unitPrice])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}

function canSubmitItems(items: CartItem[]) {
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        item.verification === "verified" &&
        item.inStock &&
        !item.isUnavailable &&
        Boolean(item.variantId) &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 10000 &&
        isValidCartPrice(item.unitPrice),
    )
  );
}

function cartOrderItems(items: CartItem[]) {
  return items.map((item) => ({
    variantId: item.variantId!,
    quantity: item.quantity,
    expectedUnitPrice: String(item.unitPrice),
  }));
}

function sameCartContent(
  cart: CartItem[],
  submitted: Omit<CreateOrderInput, "idempotencyKey">["items"],
) {
  const normalize = (lines: { variantId: string; quantity: number }[]) =>
    lines
      .map(({ variantId, quantity }) => [variantId, quantity])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return (
    JSON.stringify(
      normalize(
        cart.map((item) => ({
          variantId: item.variantId ?? "",
          quantity: item.quantity,
        })),
      ),
    ) === JSON.stringify(normalize(submitted))
  );
}

function validateFields(fields: CheckoutFields) {
  // Mirrors CreateStoreOrderDto so most mistakes are caught before the request.
  const phone = fields.phone.trim();
  const address = fields.address.trim();
  if (!fields.recipientName.trim()) return "Vui lòng nhập tên người nhận.";
  if (fields.recipientName.trim().length > 255)
    return "Tên người nhận không được quá 255 ký tự.";
  if (!phone) return "Vui lòng nhập số điện thoại.";
  if (!/^\+?[\d ()-]+$/.test(phone))
    return "Số điện thoại chỉ gồm chữ số, khoảng trắng và các ký tự + - ( ).";
  if (phone.length < 8 || phone.length > 30)
    return "Số điện thoại cần từ 8 đến 30 ký tự.";
  if (!address) return "Vui lòng nhập địa chỉ giao hàng.";
  if (address.length < 5)
    return "Địa chỉ giao hàng quá ngắn, cần ít nhất 5 ký tự.";
  if (address.length > 2000)
    return "Địa chỉ giao hàng không được quá 2.000 ký tự.";
  if (fields.note.trim().length > 2000)
    return "Ghi chú không được quá 2.000 ký tự.";
  return null;
}

export function CheckoutPage() {
  const request = useAuthenticatedRequest();
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const {
    items,
    isHydrated,
    isReconciling,
    isCheckoutSubmitting,
    reconcileCart,
    clearCart,
    setCheckoutSubmitting,
  } = useCart();
  const [fields, setFields] = useState<CheckoutFields>({
    recipientName: "",
    phone: "",
    address: "",
    note: "",
    paymentMethod: "COD",
  });
  const [verified, setVerified] = useState<{
    key: string;
    items: CartItem[];
  } | null>(null);
  const [acceptedPrices, setAcceptedPrices] = useState("");
  const [attempt, setAttempt] = useState<OrderAttempt | null>(null);
  const [attemptReady, setAttemptReady] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitPending = useRef(false);
  const currentKey = cartSnapshotKey(items);
  const verificationIsCurrent = verified?.key === currentKey;
  const checkoutItems =
    verificationIsCurrent && verified ? verified.items : items;
  const hasChangedPrices = checkoutItems.some((item) => item.isPriceChanged);
  const currentPriceSignature = priceSignature(checkoutItems);
  const [paymentMethods, setPaymentMethods] =
    useState<StorePaymentMethods | null>(null);
  const bankTransfer = paymentMethods?.bankTransfer ?? null;
  const bankTransferAvailable = Boolean(bankTransfer);
  const totals = useMemo(
    () => calculateCartTotals(checkoutItems),
    [checkoutItems],
  );

  useEffect(() => {
    let active = true;
    void getStorePaymentMethods()
      .then((methods) => {
        if (active) setPaymentMethods(methods);
      })
      .catch(() => {
        if (active) setPaymentMethods({ bankTransfer: null });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = userId
          ? loadOrderAttempt(window.sessionStorage, userId)
          : null;
        setAttempt(saved);
        const savedPayload = saved && parseOrderAttemptPayload(saved.payload);
        if (savedPayload) {
          setFields({
            recipientName: savedPayload.recipientName,
            phone: savedPayload.phone,
            address: savedPayload.address,
            note: savedPayload.note ?? "",
            paymentMethod: savedPayload.paymentMethod,
          });
        }
      } catch {
        setError(
          "Không thể đọc lần gửi đơn trước từ phiên trình duyệt. Hãy tải lại trang hoặc liên hệ cửa hàng.",
        );
      } finally {
        setAttemptReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [isLoaded, userId]);

  async function verifyCart() {
    if (
      !isHydrated ||
      !items.length ||
      attempt?.state === "pending" ||
      isVerifying ||
      isCheckoutSubmitting
    )
      return;
    setIsVerifying(true);
    setCheckoutSubmitting(true);
    setError(null);
    setVerified(null);
    setAcceptedPrices("");
    try {
      const snapshot = await reconcileCart();
      setVerified({ key: cartSnapshotKey(snapshot), items: snapshot });
    } catch {
      setError("Không thể xác minh giỏ hàng. Vui lòng thử lại.");
    } finally {
      setIsVerifying(false);
      setCheckoutSubmitting(false);
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitPending.current || isCheckoutSubmitting) return;
    if (!attemptReady) {
      setError("Đang kiểm tra lần gửi đơn trước. Vui lòng chờ.");
      return;
    }
    if (attempt?.state === "pending") {
      setError(
        "Hãy dùng “Kiểm tra lại lần đặt trước” để gửi lại đúng yêu cầu chưa xác định.",
      );
      return;
    }
    const fieldError = validateFields(fields);
    if (fieldError) {
      setError(fieldError);
      return;
    }
    if (!verificationIsCurrent || !verified) {
      setError(
        "Giỏ hàng đã thay đổi. Hãy xác minh lại giá và tồn kho trước khi đặt hàng.",
      );
      return;
    }
    if (!canSubmitItems(verified.items)) {
      setError(
        "Có dòng hàng chưa xác minh, hết hàng hoặc không còn hợp lệ. Hãy cập nhật giỏ rồi thử lại.",
      );
      return;
    }
    if (fields.paymentMethod === "BANK_TRANSFER" && !bankTransferAvailable) {
      setError(
        "Chưa có hướng dẫn chuyển khoản. Vui lòng chọn COD hoặc liên hệ cửa hàng.",
      );
      return;
    }

    const currentInput = {
      recipientName: fields.recipientName.trim(),
      phone: fields.phone.trim(),
      address: fields.address.trim(),
      note: fields.note.trim() || undefined,
      paymentMethod: fields.paymentMethod,
      items: cartOrderItems(verified.items),
    } satisfies Omit<CreateOrderInput, "idempotencyKey">;
    const input: Omit<CreateOrderInput, "idempotencyKey"> = currentInput;
    const payload = canonicalOrderPayload(currentInput);
    if (hasChangedPrices && acceptedPrices !== currentPriceSignature) {
      setError(
        "Giá đã thay đổi. Hãy kiểm tra giá mới và xác nhận trước khi đặt hàng.",
      );
      return;
    }
    if (!userId) {
      setError("Phiên đăng nhập chưa sẵn sàng. Vui lòng tải lại trang.");
      return;
    }

    submitPending.current = true;
    setIsSubmitting(true);
    setCheckoutSubmitting(true);
    setError(null);
    let activeAttempt: OrderAttempt | null = null;
    try {
      const orderAttempt = beginOrderAttempt(
        window.sessionStorage,
        userId,
        payload,
        () => {
          if (!globalThis.crypto?.randomUUID)
            throw new Error("Không thể tạo mã yêu cầu trong trình duyệt này.");
          return globalThis.crypto.randomUUID();
        },
      );
      activeAttempt = orderAttempt;
      updateOrderAttempt(
        window.sessionStorage,
        userId,
        orderAttempt,
        "pending",
      );
      setAttempt({ ...orderAttempt, state: "pending" });
      const { data } = await createCustomerOrder(request, {
        ...input,
        idempotencyKey: orderAttempt.key,
      });
      setCheckoutSubmitting(false);
      clearCart();
      updateOrderAttempt(
        window.sessionStorage,
        userId,
        orderAttempt,
        "succeeded",
        data.order.id,
      );
      setAttempt({
        ...orderAttempt,
        state: "succeeded",
        orderId: data.order.id,
      });
      router.push(`/orders/${encodeURIComponent(data.order.id)}`);
    } catch (failure: unknown) {
      const knownFailure =
        failure instanceof ApiError && isDefiniteOrderFailure(failure.status);
      const orderAttempt = activeAttempt;
      if (knownFailure && orderAttempt && userId)
        updateOrderAttempt(
          window.sessionStorage,
          userId,
          orderAttempt,
          "failed",
        );
      if (knownFailure && orderAttempt)
        setAttempt({ ...orderAttempt, state: "failed" });
      setError(
        failure instanceof Error &&
          failure.message.startsWith("UNRESOLVED_ATTEMPT")
          ? "Lần gửi trước chưa có kết quả xác định. Chỉ có thể gửi lại cùng nội dung đó; hãy mở Đơn hàng để kiểm tra trước."
          : failure instanceof Error &&
              failure.message.startsWith("STORAGE_UNAVAILABLE")
            ? "Không thể lưu mã chống tạo đơn trùng trong phiên này. Hãy bật session storage rồi thử lại."
            : orderErrorMessage(failure),
      );
      const code =
        failure instanceof ApiError &&
        failure.details &&
        typeof failure.details === "object" &&
        "code" in failure.details
          ? failure.details.code
          : null;
      if (knownFailure && code === "PRICE_CHANGED") {
        try {
          const snapshot = await reconcileCart();
          setVerified({ key: cartSnapshotKey(snapshot), items: snapshot });
          setAcceptedPrices("");
        } catch {
          // The error above still explains why the order was not sent.
        }
      }
    } finally {
      submitPending.current = false;
      setIsSubmitting(false);
      setCheckoutSubmitting(false);
    }
  }

  async function retrySavedOrder() {
    if (
      !attemptReady ||
      !attempt ||
      attempt.state !== "pending" ||
      !userId ||
      submitPending.current ||
      isCheckoutSubmitting
    )
      return;
    const input = parseOrderAttemptPayload(attempt.payload);
    if (!input) {
      setError(
        "Lần gửi trước bị lỗi dữ liệu trong phiên trình duyệt; không thể gửi lại an toàn.",
      );
      return;
    }
    const saved = attempt;
    submitPending.current = true;
    setIsSubmitting(true);
    setCheckoutSubmitting(true);
    setError(null);
    updateOrderAttempt(window.sessionStorage, userId, saved, "pending");
    try {
      const { data } = await createCustomerOrder(request, {
        ...input,
        idempotencyKey: saved.key,
      });
      setCheckoutSubmitting(false);
      if (sameCartContent(items, input.items)) clearCart();
      updateOrderAttempt(
        window.sessionStorage,
        userId,
        saved,
        "succeeded",
        data.order.id,
      );
      setAttempt({ ...saved, state: "succeeded", orderId: data.order.id });
      router.push(`/orders/${encodeURIComponent(data.order.id)}`);
    } catch (failure: unknown) {
      const knownFailure =
        failure instanceof ApiError && isDefiniteOrderFailure(failure.status);
      if (knownFailure) {
        updateOrderAttempt(window.sessionStorage, userId, saved, "failed");
        setAttempt({ ...saved, state: "failed" });
      }
      setError(orderErrorMessage(failure));
      const code =
        failure instanceof ApiError &&
        failure.details &&
        typeof failure.details === "object" &&
        "code" in failure.details
          ? failure.details.code
          : null;
      if (knownFailure && code === "PRICE_CHANGED") {
        try {
          const snapshot = await reconcileCart();
          setVerified({ key: cartSnapshotKey(snapshot), items: snapshot });
          setAcceptedPrices("");
        } catch {
          // The error above still explains why the order was not sent.
        }
      }
    } finally {
      submitPending.current = false;
      setIsSubmitting(false);
      setCheckoutSubmitting(false);
    }
  }

  if (!isHydrated)
    return (
      <p className="mx-auto max-w-4xl px-4 py-12" role="status">
        Đang khôi phục giỏ hàng…
      </p>
    );
  if (!items.length && attempt?.state !== "pending")
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-12">
        <h1 className="text-2xl font-bold">Đặt hàng</h1>
        <p>Giỏ hàng đang trống.</p>
        <Link className="text-primary underline" href="/products">
          Tiếp tục mua sắm
        </Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Đặt hàng</h1>
        <p className="text-sm text-muted-foreground">
          Kiểm tra lại giá và tồn kho trước khi gửi đơn.
        </p>
      </div>
      {attempt?.state === "pending" && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm"
        >
          <span>
            Có lần gửi đơn trước chưa xác định kết quả. Gửi lại đúng yêu cầu để
            nhận kết quả, hoặc mở{" "}
            <Link className="underline" href="/orders">
              Đơn hàng
            </Link>
            .
          </span>
          <Button
            type="button"
            disabled={!attemptReady || isSubmitting || isCheckoutSubmitting}
            isLoading={isSubmitting}
            onClick={() => void retrySavedOrder()}
          >
            Kiểm tra lại lần đặt trước
          </Button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      <form
        onSubmit={(event) => void submitOrder(event)}
        className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Thông tin nhận hàng</h2>
            <fieldset
              disabled={
                isSubmitting ||
                isCheckoutSubmitting ||
                attempt?.state === "pending"
              }
              className="space-y-4 disabled:opacity-70"
            >
              <label className="block space-y-1 text-sm">
                <span>Tên người nhận *</span>
                <Input
                  required
                  maxLength={200}
                  value={fields.recipientName}
                  onChange={(event) =>
                    setFields({ ...fields, recipientName: event.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Số điện thoại *</span>
                <Input
                  required
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                  value={fields.phone}
                  onChange={(event) =>
                    setFields({ ...fields, phone: event.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Địa chỉ giao hàng *</span>
                <Textarea
                  required
                  maxLength={1000}
                  rows={3}
                  autoComplete="street-address"
                  value={fields.address}
                  onChange={(event) =>
                    setFields({ ...fields, address: event.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Ghi chú</span>
                <Textarea
                  maxLength={2000}
                  rows={2}
                  value={fields.note}
                  onChange={(event) =>
                    setFields({ ...fields, note: event.target.value })
                  }
                />
              </label>
            </fieldset>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Phương thức thanh toán</h2>
            <fieldset
              disabled={
                isSubmitting ||
                isCheckoutSubmitting ||
                attempt?.state === "pending"
              }
              className="space-y-3 disabled:opacity-70"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="COD"
                  checked={fields.paymentMethod === "COD"}
                  onChange={() =>
                    setFields({ ...fields, paymentMethod: "COD" })
                  }
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Thanh toán khi nhận hàng (COD)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Đơn được ghi nhận chưa thanh toán cho đến khi giao xong.
                  </span>
                </span>
              </label>
              <label
                className={`flex items-start gap-3 rounded-lg border p-3 ${bankTransferAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="BANK_TRANSFER"
                  disabled={!bankTransferAvailable}
                  checked={fields.paymentMethod === "BANK_TRANSFER"}
                  onChange={() =>
                    setFields({ ...fields, paymentMethod: "BANK_TRANSFER" })
                  }
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Chuyển khoản ngân hàng
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {bankTransferAvailable
                      ? "Mã VietQR có sẵn số tiền hiện ngay sau khi đặt hàng; đơn tự xác nhận khi cửa hàng nhận được tiền."
                      : paymentMethods
                        ? "Chưa cấu hình hướng dẫn chuyển khoản; vui lòng chọn COD hoặc liên hệ cửa hàng."
                        : "Đang kiểm tra phương thức chuyển khoản…"}
                  </span>
                </span>
              </label>
              {fields.paymentMethod === "BANK_TRANSFER" && bankTransfer && (
                <dl className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Ngân hàng</dt>
                    <dd>{bankTransfer.bankName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Số tài khoản</dt>
                    <dd className="font-mono">{bankTransfer.accountNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Chủ tài khoản</dt>
                    <dd>{bankTransfer.accountName}</dd>
                  </div>
                </dl>
              )}
            </fieldset>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-xl border bg-card p-5 lg:sticky lg:top-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Đơn hàng</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                isVerifying ||
                isCheckoutSubmitting ||
                attempt?.state === "pending" ||
                !items.length
              }
              onClick={() => void verifyCart()}
            >
              {isVerifying || isReconciling
                ? "Đang xác minh…"
                : "Xác minh giá và tồn kho"}
            </Button>
          </div>
          {checkoutItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 border-b pb-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.variantName || "Quy cách"} · {item.quantity} bước bán
                </p>
                {item.isPriceChanged && (
                  <p className="text-xs font-medium text-warning">
                    Giá đã thay đổi
                  </p>
                )}
                {item.verification !== "verified" && (
                  <p className="text-xs text-destructive">
                    {item.verification === "pending"
                      ? "Chưa xác minh"
                      : "Không thể đặt dòng này"}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-right">
                {formatVndCurrency(
                  isValidCartPrice(item.unitPrice)
                    ? item.unitPrice * item.quantity
                    : null,
                ) ?? "Chưa có giá"}
              </span>
            </div>
          ))}
          {hasChangedPrices && verificationIsCurrent && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptedPrices === currentPriceSignature}
                onChange={(event) =>
                  setAcceptedPrices(
                    event.target.checked ? currentPriceSignature : "",
                  )
                }
                className="mt-1 accent-primary"
              />
              <span>
                Tôi đã kiểm tra và đồng ý với giá mới của các sản phẩm.
              </span>
            </label>
          )}
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Tạm tính sản phẩm</dt>
              <dd className="font-semibold">
                {items.length
                  ? (formatVndCurrency(totals.subtotal) ?? "Chưa xác định")
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Phí giao hàng</dt>
              <dd className="text-right">Cửa hàng xác nhận sau khi đặt</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Phí giao hàng chưa được tính ở bước này. Cửa hàng sẽ liên hệ xác
            nhận khi xử lý đơn.
          </p>
          {!verificationIsCurrent && (
            <p role="status" className="text-xs text-warning">
              Giỏ hàng chưa được xác minh sau lần thay đổi gần nhất.
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            isLoading={isSubmitting}
            disabled={
              !attemptReady ||
              isSubmitting ||
              isCheckoutSubmitting ||
              attempt?.state === "pending" ||
              !verificationIsCurrent ||
              !canSubmitItems(verified?.items ?? [])
            }
          >
            {isSubmitting ? "Đang gửi đơn hàng…" : "Đặt hàng"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {userId
              ? "Đơn hàng sẽ gắn với tài khoản hiện đang đăng nhập."
              : "Đang kiểm tra phiên đăng nhập…"}
          </p>
          <Link
            href="/cart"
            className="block text-center text-sm text-primary underline"
          >
            Quay lại giỏ hàng
          </Link>
        </aside>
      </form>
    </main>
  );
}
