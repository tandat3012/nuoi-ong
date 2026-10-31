"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { orderErrorMessage } from "@/features/commerce/orders/order.logic";
import type { PaymentTransaction } from "@/features/commerce/orders/types/order";
import { PaymentResultBadge } from "@/features/commerce/orders/components/order-presentation";
import { getStoreOrders } from "@/features/store-orders/store-orders.api";
import {
  getPaymentSimulator,
  simulatePayment,
  type SimulatePaymentInput,
} from "../store-payments.api";

/** Posts fake bank transfers through the same verification as the SePay webhook; hidden unless the API enables it. */
export function PaymentSimulator({
  farmId,
  onRecorded,
}: {
  farmId: string;
  onRecorded: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [config, setConfig] = useState<{
    enabled: boolean;
    accountNumber: string | null;
  } | null>(null);
  const [fields, setFields] = useState({
    orderCode: "",
    content: "",
    amount: "",
    accountNumber: "",
  });
  const [last, setLast] = useState<{
    input: SimulatePaymentInput;
    transaction: PaymentTransaction;
    duplicate: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPaymentSimulator(request, farmId)
      .then(({ data }) => {
        if (cancelled) return;
        setConfig(data);
        setFields((current) => ({
          ...current,
          accountNumber: data.accountNumber ?? "",
        }));
      })
      .catch(() => {
        if (!cancelled) setConfig({ enabled: false, accountNumber: null });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId]);

  if (!config?.enabled) return null;

  async function fillFromOrder() {
    const code = fields.orderCode.trim().toUpperCase();
    if (!code) return;
    setError(null);
    try {
      const { data } = await getStoreOrders(request, farmId, {
        page: 1,
        pageSize: 5,
        q: code,
      });
      const order = data.find((candidate) => candidate.code === code);
      if (!order) {
        setError(`Không tìm thấy đơn ${code}.`);
        return;
      }
      setFields((current) => ({
        ...current,
        content: order.code,
        amount: order.total,
      }));
    } catch (caught: unknown) {
      setError(orderErrorMessage(caught));
    }
  }

  async function send(input: SimulatePaymentInput) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await simulatePayment(request, farmId, input);
      setLast({ input, ...data });
      onRecorded();
    } catch (caught: unknown) {
      setError(orderErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send({
      amount: fields.amount.trim(),
      content: fields.content,
      accountNumber: fields.accountNumber.trim() || undefined,
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-warning/50 bg-warning/5 p-4">
      <div>
        <h2 className="font-semibold">Giả lập giao dịch ngân hàng</h2>
        <p className="text-sm text-muted-foreground">
          Chỉ dùng cho demo và kiểm thử. Giao dịch đi qua đúng bước đối soát như
          webhook SePay thật; đơn chỉ được thanh toán khi khớp tài khoản, mã đơn
          và số tiền.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span>Mã đơn</span>
          <Input
            value={fields.orderCode}
            placeholder="DH000123"
            onChange={(event) =>
              setFields({ ...fields, orderCode: event.target.value })
            }
          />
        </label>
        <Button type="button" variant="outline" onClick={() => void fillFromOrder()}>
          Điền đúng tiền theo đơn
        </Button>
      </div>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span>Nội dung chuyển khoản</span>
          <Input
            value={fields.content}
            maxLength={1000}
            onChange={(event) =>
              setFields({ ...fields, content: event.target.value })
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Số tiền (VND)</span>
          <Input
            required
            inputMode="numeric"
            pattern="0|[1-9][0-9]*"
            value={fields.amount}
            onChange={(event) =>
              setFields({ ...fields, amount: event.target.value })
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Tài khoản nhận</span>
          <Input
            value={fields.accountNumber}
            onChange={(event) =>
              setFields({ ...fields, accountNumber: event.target.value })
            }
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <Button type="submit" disabled={busy} isLoading={busy}>
            Gửi giao dịch
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !last}
            onClick={() =>
              last &&
              void send({
                ...last.input,
                providerTxId: last.transaction.providerTxId,
              })
            }
          >
            Gửi lại giao dịch vừa rồi
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {last && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
          {last.duplicate
            ? "Giao dịch trùng mã — không ghi thêm, kết quả cũ:"
            : "Đã ghi nhận giao dịch:"}
          <PaymentResultBadge result={last.transaction.result} />
          {last.transaction.orderCode && <span>· {last.transaction.orderCode}</span>}
        </p>
      )}
    </section>
  );
}
