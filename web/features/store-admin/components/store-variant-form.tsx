"use client";

import { storeAdminError } from "../store-admin.logic";
import type { StoreVariant, StoreVariantInput } from "../types/store-admin";
import { FormDialog } from "@/shared/components/ui/form-dialog";
import { Input } from "@/shared/components/ui/input";
import { StoreItemPicker } from "./store-item-picker";

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
  return (
    <FormDialog
      errorMessage={storeAdminError}
      title={variant ? "Sửa quy cách bán" : "Thêm quy cách bán"}
      description="Vật tư đầu tiên là của trại đang chọn và quyết định đơn vị của quy cách; các trại khác tự gắn vật tư cùng đơn vị."
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
      {!variant && <StoreItemPicker farmId={farmId} />}
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
    </FormDialog>
  );
}
