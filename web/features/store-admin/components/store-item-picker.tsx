"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { ReceiptItemReference } from "@/features/receipts/types/receipt";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { searchStoreItems } from "../api/store-admin.api";
import { storeAdminError } from "../store-admin.logic";

/** Searchable select of the farm's active items, submitted as `itemId`. */
export function StoreItemPicker({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ReceiptItemReference[]>([]);
  const [itemError, setItemError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      searchStoreItems(request, farmId, search)
        .then((response) => !cancelled && setItems(response.data))
        .catch(
          (failure) => !cancelled && setItemError(storeAdminError(failure)),
        );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [request, farmId, search]);

  return (
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
  );
}
