"use client";

import { Input } from "@/shared/components/ui/input";
import type { NumberingDraft, NumberingOptions } from "./stock-document.logic";

/** Owner-only options, collapsed by default; render it only for the farm owner. */
export function NumberingOptionsFields({
  value,
  onChange,
}: {
  value: NumberingDraft;
  onChange: (value: NumberingDraft) => void;
}) {
  const field = (key: keyof NumberingDraft) => ({
    value: value[key],
    onChange: (event: { target: { value: string } }) =>
      onChange({ ...value, [key]: event.target.value }),
  });
  return (
    <details className="rounded-md border p-3 md:col-span-2 sm:col-span-2">
      <summary className="cursor-pointer text-sm font-medium">
        Tùy chọn nâng cao (chủ trại)
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Số chứng từ giấy
          <Input maxLength={100} className="w-full" {...field("externalReference")} />
        </label>
        <label className="space-y-1 text-sm">
          Mã phiếu yêu cầu
          <Input
            maxLength={50}
            className="w-full"
            placeholder="Để trống để cấp tự động"
            {...field("requestedCode")}
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          Lý do yêu cầu mã
          <Input maxLength={500} className="w-full" {...field("requestedCodeReason")} />
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Mã yêu cầu chỉ được dùng nếu còn trống khi xác nhận; số chứng từ giấy không thay đổi mã phiếu.
        </p>
      </div>
    </details>
  );
}

/** Read-only numbering details for a document detail <dl>; renders nothing when unused. */
export function NumberingDetails({
  document,
}: {
  document: NumberingOptions & { codeSource?: "AUTO" | "MANUAL" | null };
}) {
  const rows: [string, string][] = [];
  if (document.externalReference)
    rows.push(["Số chứng từ giấy", document.externalReference]);
  if (document.requestedCode)
    rows.push([
      document.codeSource === "MANUAL" ? "Mã do chủ trại chỉ định" : "Mã phiếu yêu cầu",
      `${document.requestedCode}${document.requestedCodeReason ? ` (${document.requestedCodeReason})` : ""}`,
    ]);
  return rows.map(([label, value]) => (
    <div key={label}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  ));
}
