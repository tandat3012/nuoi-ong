"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { ReceiptItemReference } from "@/features/receipts/types/receipt";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { searchStoreItems } from "../api/store-admin.api";
import { storeAdminError } from "../store-admin.logic";
import type { StoreVariant, StoreVariantInput } from "../types/store-admin";
import { StoreFormDialog } from "./store-form-dialog";

export function StoreVariantForm({
  farmId,
  variant,
  onSubmit,
  onClose,
}: {
  farmId: string;
  variant?: StoreVariant;
  onSubmit: (input: StoreVariantInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ReceiptItemReference[]>([]);
  const [itemError, setItemError] = useState<string | null>(null);

  useEffect(() => {
    if (variant) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchStoreItems(request, farmId, search)
        .then((response) => !cancelled && setItems(response.data))
        .catch((failure) => !cancelled && setItemError(storeAdminError(failure)));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [request, farmId, search, variant]);

  return (
    <StoreFormDialog
      title={variant ? "Sửa quy cách bán" : "Thêm quy cách bán"}
      description="Mỗi quy cách gắn một vật tư trong kho; tồn kho của vật tư quyết định còn hàng."
      onClose={onClose}
      onSubmit={(data) =>
        onSubmit({
          ...(variant ? {} : { itemId: String(data.get("itemId")) }),
          name: String(data.get("name")).trim(),
          price: String(data.get("price")).trim(),
          quantityStep: String(data.get("quantityStep")).trim(),
          active: data.get("active") === "on",
        })
      }
    >
      {variant ? (
        <p className="text-sm">
          Vật tư:{" "}
          <span className="font-medium">
            {variant.item?.code} — {variant.item?.name}
          </span>
        </p>
      ) : (
        <div className="space-y-2">
          <label className="block space-y-2 text-sm font-medium">
            Tìm vật tư
            <Input
              type="search"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Vật tư
            <Select name="itemId" required defaultValue="">
              <option value="" disabled>
                Chọn vật tư ({items.length} kết quả)
              </option>
              {items.map(({ item, unitName }) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name} ({unitName})
                </option>
              ))}
            </Select>
          </label>
          {itemError && (
            <p className="text-sm text-destructive" role="alert">
              {itemError}
            </p>
          )}
        </div>
      )}
      <label className="block space-y-2 text-sm font-medium">
        Tên quy cách
        <Input
          name="name"
          required
          maxLength={255}
          pattern=".*\S.*"
          placeholder="Chai 500ml"
          defaultValue={variant?.name}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          Giá bán (VNĐ)
          <Input
            name="price"
            required
            inputMode="numeric"
            pattern="0|[1-9][0-9]{0,17}"
            defaultValue={variant?.price}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Bước số lượng
          <Input
            name="quantityStep"
            required
            inputMode="decimal"
            pattern="(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?"
            defaultValue={variant?.quantityStep ?? "1"}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="active"
          defaultChecked={variant?.active ?? true}
          className="size-4"
        />
        Đang bán
      </label>
    </StoreFormDialog>
  );
}
