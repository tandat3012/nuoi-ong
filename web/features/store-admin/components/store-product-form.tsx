"use client";

import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { slugify, storeAdminError } from "../store-admin.logic";
import type {
  StoreCategory,
  StoreProduct,
  StoreProductInput,
} from "../types/store-admin";
import { FormDialog } from "@/shared/components/ui/form-dialog";

const SLUG_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";

export function StoreProductForm({
  product,
  categories,
  onSubmit,
  onClose,
}: {
  product?: StoreProduct;
  categories: StoreCategory[];
  onSubmit: (input: StoreProductInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(product));
  return (
    <FormDialog
      errorMessage={storeAdminError}
      title={product ? "Sửa sản phẩm" : "Thêm sản phẩm"}
      description={
        product
          ? "Đổi slug sẽ đổi đường dẫn công khai của sản phẩm."
          : "Sản phẩm mới ở trạng thái nháp, chưa hiển thị trên cửa hàng."
      }
      onClose={onClose}
      onSubmit={(data) =>
        onSubmit({
          categoryId: String(data.get("categoryId")),
          name: String(data.get("name")).trim(),
          slug,
          description: String(data.get("description") ?? "").trim(),
        })
      }
    >
      <label className="block space-y-2 text-sm font-medium">
        Tên sản phẩm
        <Input
          name="name"
          required
          maxLength={255}
          pattern=".*\S.*"
          defaultValue={product?.name}
          onChange={(event) => {
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Slug (đường dẫn)
        <Input
          name="slug"
          required
          maxLength={255}
          pattern={SLUG_PATTERN}
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Danh mục
        <Select
          name="categoryId"
          required
          defaultValue={product?.categoryId ?? ""}
        >
          <option value="" disabled>
            Chọn danh mục
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Mô tả
        <Textarea
          name="description"
          rows={4}
          maxLength={10000}
          defaultValue={product?.description}
        />
      </label>
    </FormDialog>
  );
}

export function StoreCategoryForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (input: Omit<StoreCategory, "id">) => Promise<unknown>;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState("");
  return (
    <FormDialog
      errorMessage={storeAdminError}
      title="Thêm danh mục cửa hàng"
      description="Danh mục dùng để nhóm sản phẩm trên cửa hàng."
      onClose={onClose}
      onSubmit={(data) =>
        onSubmit({ name: String(data.get("name")).trim(), slug })
      }
    >
      <label className="block space-y-2 text-sm font-medium">
        Tên danh mục
        <Input
          name="name"
          required
          maxLength={255}
          pattern=".*\S.*"
          onChange={(event) => setSlug(slugify(event.target.value))}
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Slug
        <Input
          required
          maxLength={100}
          pattern={SLUG_PATTERN}
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
      </label>
    </FormDialog>
  );
}
