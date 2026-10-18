import type { Metadata } from "next";

import { InventoryPage } from "@/features/inventory";
import { parseInitialInventoryFilters } from "@/features/inventory/inventory.logic";

export const metadata: Metadata = { title: "Tồn kho" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    warehouseId?: string | string[];
    itemId?: string | string[];
  }>;
}) {
  const initialFilters = parseInitialInventoryFilters(await searchParams);
  return <InventoryPage initialFilters={initialFilters} />;
}
