"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { getAssetHolder } from "../api/assets.api";
import { assetError } from "../asset.logic";
import type { AssetHolder } from "../types/asset";

export function AssetHolderCard({
  farmId,
  assetId,
}: {
  farmId: string;
  assetId: string;
}) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    holder?: AssetHolder | null;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void getAssetHolder(request, farmId, assetId)
      .then(({ data }) => {
        if (alive) setResult({ attempt, holder: data });
      })
      .catch((error) => {
        if (alive) setResult({ attempt, error: assetError(error).message });
      });
    return () => {
      alive = false;
    };
  }, [request, farmId, assetId, attempt]);
  const current = result?.attempt === attempt ? result : null;
  return (
    <section
      className="min-w-0 rounded-xl border bg-card p-5"
      aria-label="Người đang giữ tài sản"
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserRound
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        Người đang giữ
      </h2>
      {!current ? (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải cấp phát…
        </p>
      ) : current.error ? (
        <ErrorAlert
          message={current.error}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      ) : current.holder ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium break-words">{current.holder.memberName}</p>
          <p className="text-muted-foreground">
            Nhận ngày{" "}
            {new Date(current.holder.assignedAt).toLocaleString("vi-VN")}
          </p>
          {current.holder.expectedReturnAt && (
            <p className="text-muted-foreground">
              Dự kiến trả{" "}
              {new Date(current.holder.expectedReturnAt).toLocaleString(
                "vi-VN",
              )}
            </p>
          )}
          {current.holder.note && (
            <p className="whitespace-pre-wrap break-words">
              {current.holder.note}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Chưa có cấp phát đang hoạt động.
        </p>
      )}
    </section>
  );
}
