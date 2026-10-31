"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuthenticatedRequest } from "@/features/auth";
import { getWarehouseById } from "@/features/warehouses/api/warehouses.api";
import { AssetRequestDialog } from "@/features/requests";
import { assetRequestActions } from "@/features/requests/requests.logic";
import type { RequestType } from "@/features/requests/types/request";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { getAsset, getAssetByCode } from "../api/assets.api";
import {
  assetError,
  canReturnAsset,
  formatAssetDate,
  formatAssetPrice,
  validAssetIdentity,
  canWriteAssets,
  assetActions,
} from "../asset.logic";
import { type AssetView } from "../types/asset";
import { AssetStatusBadge } from "./asset-status-badge";
import { AssetReturnDialog } from "./asset-return-dialog";
import { AssetEditor } from "./asset-editor";
import {
  AssetActionDialog,
  ASSET_ACTION_LABELS,
  type AssetActionKind,
} from "./asset-action-dialog";
import { AssetHistory } from "./asset-history";
import { AssetHolderCard } from "./asset-holder";
import { AssetLabelDialog } from "./asset-label-dialog";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export function AssetDetail({
  farmId,
  identity,
  byCode,
  roles,
}: {
  farmId: string;
  identity: string;
  byCode: boolean;
  roles: readonly string[];
}) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [returnOpen, setReturnOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<RequestType | null>(null);
  const [action, setAction] = useState<
    AssetActionKind | "edit" | "label" | null
  >(null);
  const [returnError, setReturnError] = useState<ReturnType<
    typeof assetError
  > | null>(null);
  const returnTrigger = useRef<HTMLButtonElement>(null);
  const refreshTrigger = useRef<HTMLButtonElement>(null);
  const operationTrigger = useRef<HTMLButtonElement | null>(null);
  const [result, setResult] = useState<{
    attempt: number;
    view?: AssetView;
    error?: string;
  } | null>(null);
  const [warehouse, setWarehouse] = useState<{
    id: string;
    attempt: number;
    label?: string;
    error?: string;
  } | null>(null);
  const valid = validAssetIdentity(identity, byCode);
  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    void (
      byCode
        ? getAssetByCode(request, farmId, identity)
        : getAsset(request, farmId, identity)
    )
      .then(({ data }) => {
        if (!cancelled) setResult({ attempt, view: data });
      })
      .catch((error) => {
        if (!cancelled)
          setResult({ attempt, error: assetError(error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, identity, byCode, attempt, valid]);
  const current = result?.attempt === attempt ? result : null;
  const warehouseId = current?.view?.locationWarehouseId;
  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    void getWarehouseById(request, warehouseId, farmId)
      .then(({ data }) => {
        if (!cancelled)
          setWarehouse({
            id: warehouseId,
            attempt,
            label: `${data.code} — ${data.name}`,
          });
      })
      .catch((error) => {
        if (!cancelled)
          setWarehouse({
            id: warehouseId,
            attempt,
            error: assetError(error).message,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, warehouseId, attempt]);
  const currentWarehouse =
    warehouse && warehouse.id === warehouseId && warehouse.attempt === attempt
      ? warehouse
      : null;
  const reload = () => {
    setRequestType(null);
    setReturnOpen(false);
    setAction(null);
    setReturnError(null);
    setAttempt((value) => value + 1);
  };
  if (!valid)
    return (
      <div className="space-y-4">
        <Link href="/assets" className="text-primary underline">
          Về danh sách tài sản
        </Link>
        <ErrorAlert
          message={
            byCode
              ? "Mã tài sản phải có từ 1 đến 100 ký tự và không được chỉ có khoảng trắng."
              : "ID tài sản không hợp lệ."
          }
        />
      </div>
    );
  const view = current?.view;
  const asset = view?.asset;
  const writable = canWriteAssets(roles);
  const requestActions = assetRequestActions(roles, asset?.status ?? "");
  const feedback = {
    error: returnError,
    onError: setReturnError,
    onClose: () => setAction(null),
    onCloseFocus: () => {
      if (
        operationTrigger.current?.isConnected &&
        !operationTrigger.current.disabled
      )
        operationTrigger.current.focus();
      else refreshTrigger.current?.focus();
    },
    onReload: reload,
    onSaved: () => {
      setSuccess(true);
      reload();
    },
    onUnavailable: (error: string) => {
      setAction(null);
      setResult({ attempt, error });
    },
  };
  return (
    <div className="min-w-0 space-y-6">
      <Link
        href="/assets"
        className="inline-block text-sm text-primary underline"
      >
        Về danh sách tài sản
      </Link>
      <PageHeader
        title={
          asset ? (
            <span className="break-all">{asset.assetCode}</span>
          ) : (
            "Chi tiết tài sản"
          )
        }
        badge={asset && <AssetStatusBadge status={asset.status} />}
        actions={
          <>
            <Button
              ref={refreshTrigger}
              variant="outline"
              onClick={reload}
              disabled={!current}
            >
              Tải lại tài sản
            </Button>
            {asset && canReturnAsset(roles, asset.status) && (
              <Button
                ref={returnTrigger}
                disabled={returnError?.reloadRequired}
                onClick={() => setReturnOpen(true)}
              >
                Trả về kho
              </Button>
            )}
          </>
        }
      />
      {success && (
        <p role="status" className="rounded-lg border bg-muted p-4 text-sm">
          Đã ghi nhận thao tác. Thông tin được tải lại từ hệ thống.
        </p>
      )}
      {requestSuccess && (
        <p role="status" className="rounded-lg border bg-muted p-4 text-sm">
          Đã gửi yêu cầu {requestSuccess === "maintenance" ? "bảo trì" : "chuyển tài sản"}.{" "}
          <Link href={`/requests?type=${requestSuccess}`} className="text-primary underline">
            Xem yêu cầu
          </Link>
        </p>
      )}
      {requestError && <ErrorAlert message={requestError} />}
      {returnError?.reloadRequired && !returnOpen && (
        <ErrorAlert
          message={returnError.message}
          onRetry={reload}
          retryLabel="Tải lại tài sản"
        />
      )}
      {!current ? (
        <BeeLoader label="Đang tải tài sản…" />
      ) : current.error ? (
        <ErrorAlert message={current.error} onRetry={reload} />
      ) : (
        asset &&
        view && (
          <>
            <section
              className="flex flex-wrap gap-2 rounded-xl border bg-card p-4"
              aria-label="Thao tác tài sản"
            >
              <Button
                variant="outline"
                onClick={(event) => {
                  operationTrigger.current = event.currentTarget;
                  setAction("label");
                }}
              >
                Nhãn QR / in
              </Button>
              {writable && (
                <Button
                  variant="outline"
                  disabled={returnError?.reloadRequired}
                  onClick={(event) => {
                    operationTrigger.current = event.currentTarget;
                    setAction("edit");
                  }}
                >
                  Sửa thông tin
                </Button>
              )}
              {writable &&
                assetActions(asset.status).map((value) => (
                  <Button
                    key={value}
                    variant="outline"
                    disabled={returnError?.reloadRequired}
                    onClick={(event) => {
                      operationTrigger.current = event.currentTarget;
                      setAction(value);
                    }}
                  >
                    {ASSET_ACTION_LABELS[value]}
                  </Button>
                ))}
              {requestActions.maintenance && (
                <Button variant="outline" onClick={() => { setRequestSuccess(null); setRequestType("maintenance"); }}>
                  Báo cần sửa
                </Button>
              )}
              {requestActions.transfer && (
                <Button variant="outline" onClick={() => { setRequestSuccess(null); setRequestType("transfer"); }}>
                  Yêu cầu chuyển
                </Button>
              )}
            </section>
            <dl className="grid min-w-0 gap-x-8 gap-y-5 rounded-xl border bg-card p-5 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Mã tài sản", asset.assetCode],
                ["Serial", asset.serialNumber || "—"],
                ["Vật tư", `${view.itemCode} — ${view.itemName}`],
                [
                  "Vị trí hiện tại",
                  [view.locationCode, view.locationName]
                    .filter(Boolean)
                    .join(" — ") || "Chưa ghi nhận vị trí",
                ],
                [
                  "Kho hiện tại",
                  warehouseId
                    ? (currentWarehouse?.label ??
                      (currentWarehouse?.error
                        ? "Không tải được tên kho"
                        : "Đang tải tên kho…"))
                    : "Chưa ghi nhận kho",
                ],
                ["Ngày mua", formatAssetDate(asset.purchaseDate)],
                ["Giá mua", formatAssetPrice(asset.purchasePrice)],
                ["Hết hạn bảo hành", formatAssetDate(asset.warrantyExpiryDate)],
                [
                  "Bảo trì gần nhất",
                  formatAssetDate(asset.lastMaintenanceDate),
                ],
                [
                  "Bảo trì tiếp theo",
                  formatAssetDate(asset.nextMaintenanceDate),
                ],
                ["Ngày tạo", new Date(asset.createdAt).toLocaleString("vi-VN")],
                [
                  "Cập nhật lần cuối",
                  new Date(asset.updatedAt).toLocaleString("vi-VN"),
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium">
                    {value}
                  </dd>
                </div>
              ))}
              <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                <dt className="text-xs text-muted-foreground">Ghi chú</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {asset.note || "—"}
                </dd>
              </div>
            </dl>
            {currentWarehouse?.error && (
              <ErrorAlert message={currentWarehouse.error} onRetry={reload} />
            )}
            <AssetHolderCard
              key={`holder:${attempt}`}
              farmId={farmId}
              assetId={asset.id}
            />
            <AssetHistory
              key={`history:${attempt}`}
              farmId={farmId}
              assetId={asset.id}
              writable={writable}
              {...feedback}
            />
            {requestType && requestActions[requestType] && (
              <AssetRequestDialog
                farmId={farmId}
                asset={asset}
                type={requestType}
                onClose={() => setRequestType(null)}
                onReload={reload}
                onError={setRequestError}
                onSent={() => setRequestSuccess(requestType)}
              />
            )}
            {action === "edit" && (
              <AssetEditor farmId={farmId} asset={asset} {...feedback} />
            )}
            {action === "label" && (
              <AssetLabelDialog
                farmId={farmId}
                asset={asset}
                onClose={() => setAction(null)}
                onCloseFocus={feedback.onCloseFocus}
              />
            )}
            {action && action !== "edit" && action !== "label" && (
              <AssetActionDialog
                key={action}
                farmId={farmId}
                asset={asset}
                action={action}
                {...feedback}
              />
            )}
            {returnOpen && canReturnAsset(roles, asset.status) && (
              <AssetReturnDialog
                farmId={farmId}
                asset={asset}
                onClose={() => setReturnOpen(false)}
                error={returnError}
                onError={setReturnError}
                onCloseFocus={() => {
                  if (returnTrigger.current && !returnTrigger.current.disabled)
                    returnTrigger.current.focus();
                  else refreshTrigger.current?.focus();
                }}
                onUnavailable={(error) => {
                  setReturnOpen(false);
                  setResult({ attempt, error });
                }}
                onReload={reload}
                onReturned={() => {
                  setSuccess(true);
                  reload();
                }}
              />
            )}
          </>
        )
      )}
    </div>
  );
}
