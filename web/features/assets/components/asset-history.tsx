"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Pagination } from "@/shared/components/ui/pagination";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  assetAction,
  getAssetHistory,
  maintenanceAction,
} from "../api/assets.api";
import { assetError } from "../asset.logic";
import {
  HISTORY_KINDS,
  ASSET_HISTORY_STATUS_LABELS,
  type AssetHistoryEntry,
  type AssetHistoryKind,
} from "../types/asset";
import {
  AssetMutationDialog,
  type AssetMutationFeedback,
} from "./asset-mutation-dialog";

export function AssetHistory({
  farmId,
  assetId,
  writable,
  ...feedback
}: Omit<AssetMutationFeedback, "onClose"> & {
  farmId: string;
  assetId: string;
  writable: boolean;
}) {
  const request = useAuthenticatedRequest();
  const actionTrigger = useRef<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState<{ kind: AssetHistoryKind; page: number }>({
    kind: "movements",
    page: 1,
  });
  const [result, setResult] = useState<{
    query: typeof query;
    response?: PaginatedResponse<AssetHistoryEntry>;
    error?: string;
  } | null>(null);
  const [action, setAction] = useState<{
    record: AssetHistoryEntry;
    value:
      | "start"
      | "complete"
      | "cancel"
      | "IN_PROGRESS"
      | "RESOLVED"
      | "CANCELLED";
    label: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void getAssetHistory(request, farmId, assetId, query.kind, query.page)
      .then((response) => {
        if (!alive) return;
        if (query.page > Math.max(1, response.page.totalPages)) {
          setQuery({ ...query, page: Math.max(1, response.page.totalPages) });
          return;
        }
        setResult({ query, response });
      })
      .catch((error) => {
        if (alive) setResult({ query, error: assetError(error).message });
      });
    return () => {
      alive = false;
    };
  }, [request, farmId, assetId, query]);
  const current = result?.query === query ? result : null;
  return (
    <section
      aria-label="Lịch sử tài sản"
      className="min-w-0 rounded-xl border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h2 className="font-semibold">Lịch sử và xử lý</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setQuery({ ...query })}
          disabled={!current}
        >
          Tải lại lịch sử
        </Button>
      </div>
      <div
        className="flex flex-wrap gap-2 border-b p-3"
        role="group"
        aria-label="Loại lịch sử"
      >
        {Object.entries(HISTORY_KINDS).map(([kind, label]) => (
          <Button
            key={kind}
            size="sm"
            variant={query.kind === kind ? "default" : "ghost"}
            aria-pressed={query.kind === kind}
            onClick={() =>
              setQuery({ kind: kind as AssetHistoryKind, page: 1 })
            }
          >
            {label}
          </Button>
        ))}
      </div>
      {!current ? (
        <p role="status" className="p-5 text-sm">
          Đang tải lịch sử…
        </p>
      ) : current.error ? (
        <ErrorAlert
          className="m-4"
          message={current.error}
          onRetry={() => setQuery({ ...query })}
        />
      ) : (
        <>
          {!current.response?.data.length && (
            <p className="p-5 text-sm text-muted-foreground">
              Chưa có bản ghi {HISTORY_KINDS[query.kind].toLowerCase()}.
            </p>
          )}
          <ol className="divide-y">
            {current.response?.data.map((record) => {
              const actions: {
                value: NonNullable<typeof action>["value"];
                label: string;
              }[] =
                query.kind === "maintenance"
                  ? record.status === "SCHEDULED"
                    ? [
                        { value: "start", label: "Bắt đầu bảo trì" },
                        { value: "cancel", label: "Hủy lịch" },
                      ]
                    : record.status === "IN_PROGRESS"
                      ? [
                          { value: "complete", label: "Hoàn tất bảo trì" },
                          { value: "cancel", label: "Dừng bảo trì" },
                        ]
                      : []
                  : query.kind === "incidents" &&
                      ["OPEN", "IN_PROGRESS"].includes(record.status ?? "")
                    ? [
                        ...(record.status === "OPEN"
                          ? [
                              {
                                value: "IN_PROGRESS" as const,
                                label: "Tiếp nhận xử lý",
                              },
                            ]
                          : []),
                        { value: "RESOLVED", label: "Đã giải quyết" },
                        { value: "CANCELLED", label: "Hủy báo cáo" },
                      ]
                    : [];
              return (
                <li key={record.id} className="space-y-2 p-4 sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-medium break-words">
                      {record.title}
                    </h3>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={record.at}
                    >
                      {new Date(record.at).toLocaleString("vi-VN")}
                    </time>
                  </div>
                  {record.status && (
                    <p className="text-xs text-muted-foreground">
                      {ASSET_HISTORY_STATUS_LABELS[record.status] ?? record.status}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {record.detail || "—"}
                  </p>
                  {writable && record.referenceId && actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {actions.map((item) => (
                        <Button
                          key={item.value}
                          size="sm"
                          variant="outline"
                          disabled={feedback.error?.reloadRequired}
                          onClick={(event) => {
                            actionTrigger.current = event.currentTarget;
                            setAction({ record, ...item });
                          }}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {current.response && (
            <Pagination
              pageInfo={current.response.page}
              itemLabel="bản ghi"
              onPageChange={(page) => setQuery({ ...query, page })}
            />
          )}
        </>
      )}
      {action && (
        <AssetMutationDialog
          {...feedback}
          onCloseFocus={() => {
            if (
              actionTrigger.current?.isConnected &&
              !actionTrigger.current.disabled
            )
              actionTrigger.current.focus();
            else feedback.onCloseFocus?.();
          }}
          onClose={() => setAction(null)}
          title={action.label}
          description={
            query.kind === "maintenance"
              ? `${action.record.title}. Hoàn tất hoặc dừng bảo trì sẽ chuyển tài sản sang Đang sử dụng; hãy trả kho khi nhận lại thực tế.`
              : `${action.record.title}. Cập nhật tình trạng xử lý báo cáo. Giải quyết báo cáo mất không tự nhập lại tài sản; hãy dùng Ghi nhận tìm lại khi đã nhận thực tế.`
          }
          submitLabel={action.label}
          perform={(data) =>
            query.kind === "maintenance"
              ? maintenanceAction(
                  request,
                  farmId,
                  action.record.referenceId!,
                  action.value as "start" | "complete" | "cancel",
                  action.value === "complete"
                    ? Object.fromEntries(
                        [...data.entries()].filter(([, value]) =>
                          String(value).trim(),
                        ),
                      )
                    : {},
                )
              : assetAction(
                  request,
                  farmId,
                  assetId,
                  `incidents/${encodeURIComponent(action.record.referenceId!)}/status`,
                  { status: action.value },
                )
          }
        >
          {action.value === "complete" && (
            <>
              <label className="block space-y-2 text-sm font-medium">
                Kết quả bảo trì
                <Textarea name="resultNote" maxLength={4000} rows={3} />
              </label>
              <p className="text-xs text-muted-foreground">
                Để trống chi phí để giữ số đã ghi nhận; nhập số mới nếu cần điều
                chỉnh.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["laborCost", "Nhân công"],
                  ["materialCost", "Vật tư"],
                  ["otherCost", "Khác"],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className="block space-y-2 text-sm font-medium"
                  >
                    {label} (VNĐ)
                    <Input
                      name={name}
                      inputMode="decimal"
                      pattern="(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </AssetMutationDialog>
      )}
    </section>
  );
}
