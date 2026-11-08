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
  assert.ok(!specs.some((s) => s.name === "Phương thức quản lý & Truy xuất"));
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

test("does not expose internal tracking jargon for LOT-tracked materials", () => {
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
  assert.equal(resolveProductQualityBadge(snapshot), null);
  const specs = buildProductSpecifications(honeyProduct);
  assert.ok(specs.some((s) => s.name === "Đơn vị tính" && s.value === "Chai (ml)"));
  assert.ok(!specs.some((s) => /FEFO/.test(s.value)));
  assert.ok(!/FEFO/.test(resolveProductUsageGuidance(honeyProduct) ?? ""));
});

test("updates specifications per selected variant and preserves explicit null warranty", () => {
  const mixedProduct = {
    ...baseProduct,
    unitName: "Bộ",
    itemType: "EQUIPMENT",
    trackingMode: "ASSET",
    warrantyMonths: 12,
    variants: [
      {
        id: "var-12m",
        name: "Bản tiêu chuẩn",
        price: 2500000,
        inStock: true,
        unitName: "Bộ",
        itemType: "EQUIPMENT",
        trackingMode: "ASSET",
        warrantyMonths: 12,
      },
      {
        id: "var-24m",
        name: "Bản cao cấp",
        price: 3200000,
        inStock: true,
        unitName: "Chiếc",
        itemType: "EQUIPMENT",
        trackingMode: "ASSET",
        warrantyMonths: 24,
      },
      {
        id: "var-consumable",
        name: "Túi lọc mật thay thế",
        price: 90000,
        inStock: true,
        unitName: "Cái",
        itemType: "MATERIAL",
        trackingMode: "QUANTITY",
        warrantyMonths: null,
      },
    ],
  };

  const specs24 = buildProductSpecifications(mixedProduct, mixedProduct.variants[1]);
  assert.ok(
    specs24.some(
      (s) => s.name === "Chính sách bảo hành" && s.value.includes("24 tháng"),
    ),
  );
  assert.ok(
    specs24.some((s) => s.name === "Đơn vị tính" && s.value === "Chiếc"),
  );

  // Explicit null warrantyMonths on a MATERIAL variant must not fall back to product.warrantyMonths (12).
  const materialSnapshot = resolveActiveProductSnapshot(
    mixedProduct,
    mixedProduct.variants[2],
  );
  assert.equal(materialSnapshot.warrantyMonths, null);
  assert.equal(resolveProductQualityBadge(materialSnapshot), null);
  const materialSpecs = buildProductSpecifications(
    mixedProduct,
    mixedProduct.variants[2],
  );
  assert.equal(
    materialSpecs.some((s) => s.name === "Chính sách bảo hành"),
    false,
  );
});
