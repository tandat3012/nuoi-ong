"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthContext, useAuthenticatedRequest } from "@/features/auth";
import { STORE_MANAGE_ROLES, hasAnyRole } from "@/features/auth/farm-roles";
import { formatOrderMoney } from "@/features/commerce/orders/order.logic";
import type { OrderDetail } from "@/features/commerce/orders/types/order";
import { getStoreOrder, getStoreOrders } from "@/features/store-orders/store-orders.api";
import { Badge } from "@/shared/components/ui/badge";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { createWarranty, getWarranties, runWarrantyAction } from "../warranties.api";
import {
  lineAssets,
  nextSteps,
  WARRANTY_KIND_LABELS,
  WARRANTY_STATUS_LABELS,
  warrantyCoverage,
  warrantyErrorMessage,
  type ActionStep,
  type WarrantyKind,
  type WarrantyRequest,
  type WarrantyStatus,
} from "../warranty.logic";

const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";

export function StoreWarrantiesScreen() {
  const { data, selectedFarmId } = useAuthContext();
  const membership = data.memberships.find(({ farm }) => farm.id === selectedFarmId);
  if (!membership || !hasAnyRole(membership.roles, STORE_MANAGE_ROLES))
    return <ErrorAlert message="Chỉ quản lý cửa hàng, chủ trại hoặc quản trị viên được xử lý bảo hành." />;
  return <FarmWarranties key={membership.farm.id} farmId={membership.farm.id} />;
}

function FarmWarranties({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  const params = useSearchParams();
  const [status, setStatus] = useState<WarrantyStatus | "">("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<{ data: WarrantyRequest[]; totalPages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<WarrantyRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getWarranties(request, farmId, { page, status: status || undefined })
      .then((response) => {
        if (!cancelled) setRows({ data: response.data, totalPages: response.page.totalPages });
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(warrantyErrorMessage(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, page, status, revision]);

  const reload = (updated?: WarrantyRequest) => {
    setOpen(updated ?? null);
    setRevision((value) => value + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảo hành sau bán"
        description="Tiếp nhận thiết bị/dụng cụ khách đã mua, gửi đối tác sửa, ghi khách đồng ý phí, trả hoặc đổi hàng."
      />
      <CreateWarranty farmId={farmId} initialOrderId={params.get("orderId")} onCreated={reload} />
      {error && <ErrorAlert message={error} />}
      {open && (
        <WarrantyDetail key={`${open.id}:${open.status}`} farmId={farmId} warranty={open} onChanged={reload} onClose={() => setOpen(null)} />
      )}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-5">
          <h2 className="font-semibold">Yêu cầu bảo hành</h2>
          <div className="w-52">
            <Select
              aria-label="Trạng thái"
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as WarrantyStatus | "");
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(WARRANTY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
        </div>
        {!rows ? (
          !error && <BeeLoader label="Đang tải yêu cầu..." />
        ) : rows.data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Chưa có yêu cầu bảo hành.</p>
        ) : (
          <div className="divide-y">
            {rows.data.map((row) => (
              <article key={row.id} className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">
                    {row.code} · {row.productName} — {row.variantName} × {row.quantity}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Đơn {row.orderCode} · tiếp nhận {date(row.receivedAt)} · {WARRANTY_KIND_LABELS[row.kind]}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{WARRANTY_STATUS_LABELS[row.status]}</Badge>
                  <Button variant="outline" onClick={() => setOpen(row)}>Xem / xử lý</Button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t p-5 text-sm">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trang trước</Button>
          <span>Trang {page}/{Math.max(rows?.totalPages ?? 1, 1)}</span>
          <Button variant="outline" disabled={page >= (rows?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Trang sau</Button>
        </div>
      </section>
    </div>
  );
}

/** Find a delivered order by code (or the ?orderId link from the order page), then claim one line. */
function CreateWarranty({
  farmId,
  initialOrderId,
  onCreated,
}: {
  farmId: string;
  initialOrderId: string | null;
  onCreated: (created: WarrantyRequest) => void;
}) {
  const request = useAuthenticatedRequest();
  const [code, setCode] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [form, setForm] = useState({ lineId: "", assetId: "", quantity: "1", kind: "WARRANTY" as WarrantyKind, issueDescription: "", intakeNote: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!initialOrderId) return;
    let cancelled = false;
    void getStoreOrder(request, farmId, initialOrderId)
      .then(({ data }) => {
        if (!cancelled) setOrder(data);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(warrantyErrorMessage(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, initialOrderId]);

  async function find() {
    setError(null);
    setOrder(null);
    try {
      const found = await getStoreOrders(request, farmId, { page: 1, pageSize: 5, status: "COMPLETED", q: code });
      const match = found.data.find((row) => row.code.toUpperCase() === code.trim().toUpperCase()) ?? found.data[0];
      if (!match) {
        setError("Không tìm thấy đơn đã giao với mã này trong trại.");
        return;
      }
      setOrder((await getStoreOrder(request, farmId, match.id)).data);
    } catch (failure) {
      setError(warrantyErrorMessage(failure));
    }
  }

  const line = order?.items.find((item) => item.id === form.lineId);
  // An asset-tracked line is claimed one delivered unit at a time.
  const units = lineAssets(order?.deliveredAssets, line);
  const coverage = line ? warrantyCoverage(order?.order.completedAt, line.warrantyMonths) : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || !line || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await createWarranty(request, farmId, {
        orderId: order.order.id,
        orderItemId: line.id,
        quantity: units.length ? 1 : Number(form.quantity),
        assetId: units.length ? form.assetId : undefined,
        kind: coverage?.inWarranty ? form.kind : "PAID_REPAIR",
        issueDescription: form.issueDescription.trim(),
        intakeNote: form.intakeNote.trim() || undefined,
      });
      setOrder(null);
      setForm({ lineId: "", assetId: "", quantity: "1", kind: "WARRANTY", issueDescription: "", intakeNote: "" });
      onCreated(data);
    } catch (failure) {
      setError(warrantyErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Tiếp nhận yêu cầu</h2>
      <div className="flex flex-wrap gap-3">
        <Input aria-label="Mã đơn" placeholder="Mã đơn đã giao, ví dụ DH000123" value={code} onChange={(event) => setCode(event.target.value)} className="max-w-xs" />
        <Button variant="outline" disabled={!code.trim()} onClick={() => void find()}>Tìm đơn</Button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      {order && (
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <p className="text-sm md:col-span-2">
            Đơn <strong>{order.order.code}</strong> · {order.customer.fullName ?? order.order.recipientName} · giao thành công {date(order.order.completedAt)}{" "}
            <Link href={`/store-orders/${order.order.id}`} className="underline">Xem đơn</Link>
          </p>
          <Select aria-label="Dòng sản phẩm" required value={form.lineId} onChange={(event) => setForm({ ...form, lineId: event.target.value, assetId: "" })}>
            <option value="">Chọn sản phẩm trong đơn</option>
            {order.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.productName} — {item.variantName} (đã mua {item.quantity})
              </option>
            ))}
          </Select>
          {units.length ? (
            <Select aria-label="Tài sản đã giao" required value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })}>
              <option value="">Chọn tài sản (mã/serial) khách mang đến</option>
              {units.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetCode}{asset.serialNumber ? ` · Serial ${asset.serialNumber}` : ""}
                </option>
              ))}
            </Select>
          ) : (
            <Input aria-label="Số lượng" type="number" min={1} max={line?.quantity} required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          )}
          {coverage && <p className="text-sm text-muted-foreground md:col-span-2">{coverage.label}</p>}
          <Select aria-label="Loại yêu cầu" value={coverage?.inWarranty ? form.kind : "PAID_REPAIR"} disabled={!coverage?.inWarranty} onChange={(event) => setForm({ ...form, kind: event.target.value as WarrantyKind })}>
            <option value="WARRANTY">Bảo hành (còn hạn, chờ đối tác kiểm tra)</option>
            <option value="PAID_REPAIR">Sửa có phí</option>
          </Select>
          <Input aria-label="Cách nhận sản phẩm" placeholder="Cách nhận sản phẩm (khách mang đến, shipper nhận…)" value={form.intakeNote} onChange={(event) => setForm({ ...form, intakeNote: event.target.value })} />
          <Textarea aria-label="Mô tả lỗi" required maxLength={4000} placeholder="Mô tả lỗi khách báo" value={form.issueDescription} onChange={(event) => setForm({ ...form, issueDescription: event.target.value })} className="md:col-span-2" />
          <Button type="submit" disabled={busy || !line || (units.length > 0 && !form.assetId) || !form.issueDescription.trim()} className="md:col-span-2">
            {busy ? "Đang lưu..." : "Tạo yêu cầu"}
          </Button>
        </form>
      )}
    </section>
  );
}

function WarrantyDetail({
  farmId,
  warranty,
  onChanged,
  onClose,
}: {
  farmId: string;
  warranty: WarrantyRequest;
  onChanged: (updated: WarrantyRequest) => void;
  onClose: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [step, setStep] = useState<ActionStep | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(chosen: ActionStep, approved?: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string | boolean | undefined> = { action: chosen.action };
      for (const field of chosen.fields)
        if (field !== "approved") body[field] = values[field]?.trim() || undefined;
      if (approved !== undefined) body.approved = approved;
      const { data } = await runWarrantyAction(request, farmId, warranty.id, body as { action: ActionStep["action"] });
      onChanged(data);
    } catch (failure) {
      setError(warrantyErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const facts: [string, string | null | undefined][] = [
    ["Đơn", warranty.orderCode],
    ["Sản phẩm", `${warranty.productName} — ${warranty.variantName} × ${warranty.quantity}`],
    ["Tài sản", warranty.assetCode && `${warranty.assetCode}${warranty.assetSerialNumber ? ` · Serial ${warranty.assetSerialNumber}` : ""}`],
    ["Loại", WARRANTY_KIND_LABELS[warranty.kind]],
    ["Bảo hành", warrantyCoverage(warranty.completedAt, warranty.warrantyMonths).label],
    ["Lỗi khách báo", warranty.issueDescription],
    ["Cách nhận", warranty.intakeNote],
    ["Đối tác", warranty.partnerName],
    ["Báo giá", warranty.quoteAmount && formatOrderMoney(warranty.quoteAmount)],
    ["Khách", warranty.customerApproved === null ? null : warranty.customerApproved ? "Đồng ý" : "Từ chối"],
    ["Ghi chú của khách", warranty.customerDecisionNote],
    ["Kết quả", warranty.result],
    ["Chi phí thực tế", warranty.actualCost && formatOrderMoney(warranty.actualCost)],
    ["Lý do hủy", warranty.cancelReason],
  ];
  const labels: Record<string, string> = {
    partnerName: "Đối tác sửa chữa",
    quoteAmount: "Báo giá (VND)",
    result: "Kết quả đối tác báo",
    actualCost: "Chi phí thực tế (VND)",
    note: step?.action === "cancel" ? "Lý do hủy" : "Ghi chú",
  };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">
          {warranty.code} · {WARRANTY_STATUS_LABELS[warranty.status]}
        </h2>
        <Button variant="outline" onClick={onClose}>Đóng</Button>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="text-muted-foreground">{label}:</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {warranty.exchangeIssue && (
        <p className="text-sm">
          Phiếu xuất đổi hàng:{" "}
          <Link href={`/issues?id=${warranty.exchangeIssue.id}`} className="underline">
            {warranty.exchangeIssue.issueCode ?? "phiếu nháp"}
          </Link>{" "}
          ({warranty.exchangeIssue.status === "CONFIRMED" ? "kho đã xuất" : "chờ kho xác nhận"})
        </p>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {nextSteps(warranty).map((candidate) => (
          <Button
            key={candidate.action}
            variant={step?.action === candidate.action ? "default" : "outline"}
            disabled={busy}
            onClick={() => (candidate.fields.length ? setStep(candidate) : void run(candidate))}
          >
            {candidate.label}
          </Button>
        ))}
      </div>
      {step && (
        <div className="grid gap-3 md:grid-cols-2">
          {step.fields
            .filter((field) => field !== "approved")
            .map((field) => (
              <Input
                key={field}
                aria-label={labels[field]}
                placeholder={labels[field]}
                inputMode={field === "quoteAmount" || field === "actualCost" ? "numeric" : undefined}
                value={values[field] ?? ""}
                onChange={(event) => setValues({ ...values, [field]: event.target.value })}
              />
            ))}
          {step.fields.includes("approved") ? (
            <div className="flex gap-2 md:col-span-2">
              <Button disabled={busy} onClick={() => void run(step, true)}>Khách đồng ý</Button>
              <Button variant="outline" disabled={busy} onClick={() => void run(step, false)}>Khách từ chối</Button>
            </div>
          ) : (
            <Button disabled={busy} onClick={() => void run(step)} className="md:col-span-2">
              Lưu: {step.label}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
