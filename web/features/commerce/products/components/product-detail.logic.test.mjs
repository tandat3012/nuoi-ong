import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildProductSpecifications,
  getAvailableDetailTabs,
  resolveActiveProductSnapshot,
  resolveProductQualityBadge,
  resolveProductUsageGuidance,
} from "./product-detail.logic.ts";

const baseProduct = {
  id: "prod-1",
  slug: "thung-quay-mat-4-cau",
  name: "Thùng quay mật 4 cầu inox",
  description: "Thùng quay mật inox 304 chuyên dụng.",
  category: { id: "cat-1", name: "Thiết bị nuôi ong", slug: "thiet-bi" },
  price: 2500000,
  inStock: true,
};

test("synthesizes specifications, usage guidance and quality badge from ERP item metadata", () => {
  const equipmentProduct = {
    ...baseProduct,
    unitName: "Bộ",
    unitSymbol: "bộ",
    itemType: "EQUIPMENT",
    trackingMode: "ASSET",
    warrantyMonths: 12,
    variants: [
      {
        id: "var-1",
        name: "Inox 304 — 4 cầu",
        price: 2500000,
        inStock: true,
        unitName: "Bộ",
        unitSymbol: "bộ",
        itemType: "EQUIPMENT",
        trackingMode: "ASSET",
        warrantyMonths: 12,
      },
    ],
  };

  const snapshot = resolveActiveProductSnapshot(
    equipmentProduct,
    equipmentProduct.variants[0],
  );
  assert.equal(snapshot.warrantyMonths, 12);
  assert.equal(snapshot.trackingMode, "ASSET");
  assert.equal(
    resolveProductQualityBadge(snapshot),
    "Bảo hành chính hãng 12 tháng",
  );

  const specs = buildProductSpecifications(
    equipmentProduct,
    equipmentProduct.variants[0],
  );
  assert.ok(specs.some((s) => s.name === "Danh mục" && s.value === "Thiết bị nuôi ong"));
  assert.ok(specs.some((s) => s.name === "Đơn vị tính" && s.value === "Bộ"));
  assert.ok(
    specs.some(
      (s) =>
        s.name === "Phương thức quản lý & Truy xuất" &&
        s.value.includes("Mã tài sản / Serial riêng"),
    ),
  );
  assert.ok(
    specs.some(
      (s) =>
        s.name === "Chính sách bảo hành" &&
        s.value.includes("12 tháng"),
    ),
  );

  const guidance = resolveProductUsageGuidance(
    equipmentProduct,
    equipmentProduct.variants[0],
  );
  assert.ok(guidance?.includes("Serial"));

  const tabs = getAvailableDetailTabs({
    ...equipmentProduct,
    specifications: specs,
    usageGuidance: guidance,
  });
  assert.deepEqual(
    tabs.map((t) => t.id),
    ["description", "specifications", "usage"],
  );
});

test("synthesizes FEFO lot quality badge and guidance for LOT-tracked honey/materials", () => {
  const honeyProduct = {
    ...baseProduct,
    name: "Mật ong hoa nhãn nguyên chất",
    slug: "mat-ong-hoa-nhan",
    category: { id: "cat-2", name: "Mật ong", slug: "mat-ong" },
    unitName: "Chai",
    unitSymbol: "ml",
    itemType: "MATERIAL",
    trackingMode: "LOT",
    warrantyMonths: null,
  };

  const snapshot = resolveActiveProductSnapshot(honeyProduct);
  assert.equal(
    resolveProductQualityBadge(snapshot),
    "Kiểm soát chất lượng theo lô (FEFO) · Giao lô hạn mới",
  );
  const specs = buildProductSpecifications(honeyProduct);
  assert.ok(specs.some((s) => s.name === "Đơn vị tính" && s.value === "Chai (ml)"));
  assert.ok(specs.some((s) => s.value.includes("FEFO")));
  assert.ok(resolveProductUsageGuidance(honeyProduct)?.includes("FEFO"));
});
